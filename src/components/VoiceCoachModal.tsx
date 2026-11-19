import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  BrainCircuit,
  Check,
  CheckCircle2,
  Copy,
  History,
  Loader2,
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  Play,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  VolumeX,
  X,
} from 'lucide-react';
import type {
  AccountAiContext,
  AiFocusSection,
  AiMemoryAddition,
  BangleCombo,
  CoachConversation,
  CoachMessageRecord,
  PendingAiConfirmation,
  PlannerSnapshot,
} from '../types/stall';
import {
  assessConfirmationRequirement,
  executeLocalAiCommand,
} from '../utils/aiActions';
import { resolveCategoryGroups } from '../utils/optimizer';
import { copyTextReliable } from '../utils/orderAndProjectEngine';
import {
  VoicePlaybackRegistry,
  VoiceTurnGate,
  shouldSuppressMicFrame,
} from '../utils/voiceAudioGuard';

interface VoiceCoachModalProps {
  isOpen: boolean;
  onClose: () => void;
  contextSummary: string;
  plannerSnapshot: PlannerSnapshot;
  accountContext?: AccountAiContext;
  conversations: CoachConversation[];
  activeConversationId: string | null;
  onUpdateConversations: (
    conversations: CoachConversation[],
    activeId: string
  ) => void;
  onApplyAiState: (
    nextState: PlannerSnapshot,
    changes: string[],
    focusSection?: AiFocusSection | null
  ) => void;
  onMemoryAdditions?: (items: AiMemoryAddition[]) => void;
}

interface TranscriptMessage {
  id: string;
  role: 'user' | 'coach' | 'system';
  text: string;
  audioWavBase64?: string | null;
  changes?: string[];
  orderCopyText?: string;
  comboPreview?: {
    groupName: string;
    combo: BangleCombo;
    budgetCap: number;
  };
}

const STARTER_PROMPTS = [
  'Add 20 oxidised bangles at ₹45 each, appeal 4/5',
  'Create Hair Accessories & add 15 pearl clips at ₹30',
  'Copy my full supplier order',
  'Open Overview',
];

const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

function pcmFloatTo16BitBase64(float32: Float32Array): string {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  const bytes = new Uint8Array(int16.buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToPcmFloat32(base64: string): Float32Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const int16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / 32768;
  }
  return float32;
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Failed to read recorded audio.'));
    reader.readAsDataURL(blob);
  });
}

function extractActiveComboPreview(
  snapshot: PlannerSnapshot,
  changes: string[]
): TranscriptMessage['comboPreview'] | undefined {
  const relevantChange = changes.some((c) =>
    /mix|combo|budget|goal|objective|risk|profit|variety/i.test(c)
  );
  if (!relevantChange || !snapshot.categoryGroups?.length) return undefined;
  const resolved = resolveCategoryGroups(snapshot.categoryGroups);
  const target =
    resolved.find((rg) => rg.group.id === snapshot.activeGroupId) || resolved[0];
  if (!target?.activeCombo) return undefined;
  return {
    groupName: target.group.name,
    combo: target.activeCombo,
    budgetCap: target.group.budgetCap,
  };
}

function recordsToTranscript(records: CoachMessageRecord[]): TranscriptMessage[] {
  return records.map((r) => ({
    id: r.id,
    role: r.role,
    text: r.text,
    ...(r.changes ? { changes: r.changes } : {}),
    ...(r.orderCopyText ? { orderCopyText: r.orderCopyText } : {}),
  }));
}

function transcriptToRecords(messages: TranscriptMessage[]): CoachMessageRecord[] {
  const now = Date.now();
  return messages
    .filter((m) => m.id !== 'serverless_ready' && !m.id.startsWith('r_'))
    .slice(-40)
    .map((m) => ({
      id: m.id,
      role: m.role,
      text: m.text,
      createdAtMs: now,
      ...(m.changes && m.changes.length > 0 ? { changes: m.changes } : {}),
      ...(m.orderCopyText ? { orderCopyText: m.orderCopyText } : {}),
    }));
}

function deriveConversationTitle(messages: TranscriptMessage[]): string {
  const firstUser = messages.find((m) => m.role === 'user');
  if (!firstUser) return 'New chat';
  const clean = firstUser.text.trim();
  return clean.length > 42 ? `${clean.slice(0, 42)}…` : clean;
}

export function VoiceCoachModal({
  isOpen,
  onClose,
  contextSummary,
  plannerSnapshot,
  accountContext,
  conversations,
  activeConversationId,
  onUpdateConversations,
  onApplyAiState,
  onMemoryAdditions,
}: VoiceCoachModalProps) {
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>(
    'disconnected'
  );
  const [mode, setMode] = useState<'live-ws' | 'serverless'>('serverless');
  const [minimized, setMinimized] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [echoShield, setEchoShield] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [textInput, setTextInput] = useState('');
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const [pendingConfirmation, setPendingConfirmation] =
    useState<PendingAiConfirmation | null>(null);
  const [reconnectNonce, setReconnectNonce] = useState(0);
  const [showHistoryMenu, setShowHistoryMenu] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const wsReadyRef = useRef(false);
  const modeRef = useRef<'live-ws' | 'serverless'>('serverless');
  const messagesRef = useRef<TranscriptMessage[]>([]);
  const snapshotRef = useRef<PlannerSnapshot>(plannerSnapshot);
  const accountContextRef = useRef<AccountAiContext | undefined>(accountContext);
  const onApplyRef = useRef(onApplyAiState);
  const onMemoryRef = useRef(onMemoryAdditions);
  const contextRef = useRef(contextSummary);
  const echoShieldRef = useRef(echoShield);
  const listEndRef = useRef<HTMLDivElement | null>(null);
  const conversationsRef = useRef(conversations);
  const activeConvIdRef = useRef(activeConversationId);
  const onUpdateConversationsRef = useRef(onUpdateConversations);

  const inputCtxRef = useRef<AudioContext | null>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordTimeoutRef = useRef<number | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  const playbackRegistryRef = useRef(new VoicePlaybackRegistry());
  const turnGateRef = useRef(new VoiceTurnGate());

  messagesRef.current = messages;
  modeRef.current = mode;
  snapshotRef.current = plannerSnapshot;
  accountContextRef.current = accountContext;
  onApplyRef.current = onApplyAiState;
  onMemoryRef.current = onMemoryAdditions;
  contextRef.current = contextSummary;
  echoShieldRef.current = echoShield;
  conversationsRef.current = conversations;
  activeConvIdRef.current = activeConversationId;
  onUpdateConversationsRef.current = onUpdateConversations;

  const persistMessagesToConversation = useCallback(
    (nextMessages: TranscriptMessage[]) => {
      const records = transcriptToRecords(nextMessages);
      if (records.length === 0) return;

      const currentConvs = conversationsRef.current || [];
      let targetId = activeConvIdRef.current;
      const now = Date.now();

      if (!targetId || !currentConvs.some((c) => c.id === targetId)) {
        targetId = `conv_${now}`;
        const newConv: CoachConversation = {
          id: targetId,
          title: deriveConversationTitle(nextMessages),
          createdAtMs: now,
          updatedAtMs: now,
          messages: records,
        };
        activeConvIdRef.current = targetId;
        onUpdateConversationsRef.current([newConv, ...currentConvs].slice(0, 12), targetId);
        return;
      }

      const updated = currentConvs.map((c) =>
        c.id === targetId
          ? {
              ...c,
              title:
                c.title === 'New chat'
                  ? deriveConversationTitle(nextMessages)
                  : c.title,
              updatedAtMs: now,
              messages: records,
            }
          : c
      );
      onUpdateConversationsRef.current(updated, targetId);
    },
    []
  );

  // Wrapper to update messages state AND persist to project conversations cleanly outside state updaters
  const updateMessages = useCallback(
    (
      updater: (prev: TranscriptMessage[]) => TranscriptMessage[],
      shouldPersist = true
    ) => {
      const next = updater(messagesRef.current);
      messagesRef.current = next;
      setMessages(next);
      if (shouldPersist) {
        persistMessagesToConversation(next);
      }
    },
    [persistMessagesToConversation]
  );

  // Load persisted messages when active conversation changes or modal opens
  useEffect(() => {
    if (!isOpen) return;
    const activeConv =
      conversations.find((c) => c.id === activeConversationId) || conversations[0];
    if (activeConv && activeConv.messages.length > 0) {
      setMessages(recordsToTranscript(activeConv.messages));
    }
  }, [isOpen, activeConversationId]);

  useEffect(() => {
    if (!minimized) {
      listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, processing, pendingConfirmation, minimized]);

  const handleStartNewChat = () => {
    const now = Date.now();
    const newId = `conv_${now}`;
    const newConv: CoachConversation = {
      id: newId,
      title: 'New chat',
      createdAtMs: now,
      updatedAtMs: now,
      messages: [],
    };
    const nextList = [newConv, ...conversations].slice(0, 12);
    activeConvIdRef.current = newId;
    onUpdateConversations(nextList, newId);
    setMessages([
      {
        id: 'serverless_ready',
        role: 'coach',
        text: 'Started a fresh chat. Tell me products to add, categories to create, or supplier orders to copy.',
      },
    ]);
    setShowHistoryMenu(false);
  };

  const handleSwitchConversation = (convId: string) => {
    const found = conversations.find((c) => c.id === convId);
    if (!found) return;
    activeConvIdRef.current = convId;
    onUpdateConversations(conversations, convId);
    setMessages(
      found.messages.length > 0
        ? recordsToTranscript(found.messages)
        : [
            {
              id: 'serverless_ready',
              role: 'coach',
              text: 'Ready for voice or text. Tell me products to add or updates to make.',
            },
          ]
    );
    setShowHistoryMenu(false);
  };

  const handleCopyMessageOrder = async (msgId: string, text: string) => {
    const ok = await copyTextReliable(text);
    if (ok) {
      setCopiedMsgId(msgId);
      window.setTimeout(() => setCopiedMsgId(null), 2000);
    }
  };

  // Synchronously unlock AudioContext on user gesture so Safari/mobile plays TTS after async fetch
  const ensureUnlockedOutputContext = useCallback((): AudioContext | null => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return null;
      if (!outputCtxRef.current || outputCtxRef.current.state === 'closed') {
        outputCtxRef.current = new AudioCtx({ sampleRate: 24000 });
      }
      if (outputCtxRef.current.state === 'suspended') {
        void outputCtxRef.current.resume().catch(() => {});
      }
      return outputCtxRef.current;
    } catch {
      return null;
    }
  }, []);

  const stopAllAudioPlayback = useCallback(() => {
    const currentTime = outputCtxRef.current?.currentTime ?? 0;
    playbackRegistryRef.current.stopAll(currentTime);

    try {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.onended = null;
        audioPlayerRef.current.onerror = null;
        audioPlayerRef.current.pause();
        audioPlayerRef.current.currentTime = 0;
      }
    } catch {
      // Ignore pause errors
    }
    audioPlayerRef.current = null;

    try {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    } catch {
      // Ignore Web Speech cancel errors
    }
    setIsSpeaking(false);
  }, []);

  const speakBrowserVoice = useCallback(
    (text: string) => {
      try {
        stopAllAudioPlayback();
        if (!('speechSynthesis' in window)) return;
        const utter = new SpeechSynthesisUtterance(text);
        utter.rate = 1.02;
        setIsSpeaking(true);
        utter.onend = () => setIsSpeaking(false);
        utter.onerror = () => setIsSpeaking(false);
        window.speechSynthesis.speak(utter);
      } catch {
        setIsSpeaking(false);
      }
    },
    [stopAllAudioPlayback]
  );

  const playWavClip = useCallback(
    async (base64Wav: string, fallbackText?: string) => {
      stopAllAudioPlayback();

      const ctx = ensureUnlockedOutputContext();
      if (ctx) {
        try {
          if (ctx.state === 'suspended') {
            await ctx.resume();
          }
          const arrayBuf = base64ToArrayBuffer(base64Wav);
          const audioBuffer = await ctx.decodeAudioData(arrayBuf.slice(0));
          const source = ctx.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(ctx.destination);

          playbackRegistryRef.current.registerSource(source);
          setIsSpeaking(true);
          source.onended = () => {
            playbackRegistryRef.current.releaseSource(source);
            if (playbackRegistryRef.current.activeCount === 0 && !audioPlayerRef.current) {
              setIsSpeaking(false);
            }
          };
          source.start(ctx.currentTime);
          return;
        } catch {
          // Fall through to HTMLAudioElement
        }
      }

      try {
        const audio = new Audio(`data:audio/wav;base64,${base64Wav}`);
        audioPlayerRef.current = audio;
        setIsSpeaking(true);
        audio.onended = () => {
          if (audioPlayerRef.current === audio) {
            audioPlayerRef.current = null;
            setIsSpeaking(false);
          }
        };
        audio.onerror = () => {
          if (audioPlayerRef.current === audio) {
            audioPlayerRef.current = null;
            setIsSpeaking(false);
          }
        };
        await audio.play();
      } catch {
        audioPlayerRef.current = null;
        setIsSpeaking(false);
        if (fallbackText) speakBrowserVoice(fallbackText);
      }
    },
    [ensureUnlockedOutputContext, speakBrowserVoice, stopAllAudioPlayback]
  );

  const stopSession = useCallback(() => {
    turnGateRef.current.invalidateAll();
    setMicActive(false);
    setProcessing(false);
    wsReadyRef.current = false;
    stopAllAudioPlayback();

    if (recordTimeoutRef.current !== null) {
      window.clearTimeout(recordTimeoutRef.current);
      recordTimeoutRef.current = null;
    }

    try {
      if (recorderRef.current) {
        recorderRef.current.ondataavailable = null;
        recorderRef.current.onstop = null;
        if (recorderRef.current.state !== 'inactive') {
          recorderRef.current.stop();
        }
      }
      processorRef.current?.disconnect();
      gainNodeRef.current?.disconnect();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      inputCtxRef.current?.close();
      outputCtxRef.current?.close();
      if (wsRef.current) {
        wsRef.current.onmessage = null;
        wsRef.current.onerror = null;
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    } catch {
      // Ignore cleanup errors
    }
    recorderRef.current = null;
    processorRef.current = null;
    gainNodeRef.current = null;
    streamRef.current = null;
    inputCtxRef.current = null;
    outputCtxRef.current = null;
    wsRef.current = null;
  }, [stopAllAudioPlayback]);

  // Sync workspace state to active Live WebSocket
  useEffect(() => {
    if (
      isOpen &&
      mode === 'live-ws' &&
      status === 'connected' &&
      wsRef.current?.readyState === WebSocket.OPEN
    ) {
      wsRef.current.send(
        JSON.stringify({
          stateSync: plannerSnapshot,
          accountContext: accountContext || null,
        })
      );
    }
  }, [isOpen, mode, status, plannerSnapshot, accountContext]);

  // Probe /api/ai/health first so Vercel serverless starts immediately without WS timeout
  useEffect(() => {
    if (!isOpen) {
      stopSession();
      setStatus('disconnected');
      setMinimized(false);
      setPendingConfirmation(null);
      setShowHistoryMenu(false);
      return;
    }

    const connGen = turnGateRef.current.nextConnection();
    let cancelled = false;
    let fallbackTimer: number | null = null;
    const isStale = () => cancelled || !turnGateRef.current.isCurrentConnection(connGen);

    setStatus('connecting');
    setErrorMsg(null);
    setPendingConfirmation(null);
    wsReadyRef.current = false;
    stopAllAudioPlayback();

    const greetingName =
      accountContextRef.current?.preferredName ||
      accountContextRef.current?.displayName?.split(' ')[0] ||
      '';
    const namePrefix = greetingName ? `Hi ${greetingName} — ` : '';

    const hasExistingHistory = () => {
      const activeConv =
        conversationsRef.current.find((c) => c.id === activeConvIdRef.current) ||
        conversationsRef.current[0];
      return Boolean(activeConv && activeConv.messages.length > 0);
    };

    const activateServerlessMode = () => {
      if (isStale()) return;
      if (fallbackTimer !== null) window.clearTimeout(fallbackTimer);
      try {
        if (wsRef.current) {
          wsRef.current.onmessage = null;
          wsRef.current.onerror = null;
          wsRef.current.onclose = null;
          wsRef.current.close();
        }
      } catch {
        // Ignore close errors
      }
      wsRef.current = null;
      modeRef.current = 'serverless';
      setMode('serverless');
      setStatus('connected');
      setErrorMsg(null);
      if (!hasExistingHistory()) {
        setMessages([
          {
            id: 'serverless_ready',
            role: 'coach',
            text: `${namePrefix}Tell me the products you want to buy, categories to create, or ask me to copy your supplier order.`,
          },
        ]);
      }
    };

    const connectLiveWs = () => {
      if (isStale()) return;
      modeRef.current = 'live-ws';
      setMode('live-ws');
      fallbackTimer = window.setTimeout(() => {
        if (!wsReadyRef.current) activateServerlessMode();
      }, 3000);

      try {
        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const accountParam = accountContextRef.current
          ? `&account=${encodeURIComponent(
              JSON.stringify({
                ...accountContextRef.current,
                memories: accountContextRef.current.memories.slice(0, 12),
              })
            )}`
          : '';
        const wsUrl = `${proto}//${window.location.host}/live?context=${encodeURIComponent(
          contextRef.current
        )}${accountParam}`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        if (AudioCtx && (!outputCtxRef.current || outputCtxRef.current.state === 'closed')) {
          outputCtxRef.current = new AudioCtx({ sampleRate: 24000 });
        }

        ws.onmessage = (event) => {
          if (isStale() || modeRef.current !== 'live-ws') return;
          try {
            const msg = JSON.parse(event.data);
            if (msg.ready) {
              if (fallbackTimer !== null) window.clearTimeout(fallbackTimer);
              wsReadyRef.current = true;
              setStatus('connected');
              ws.send(
                JSON.stringify({
                  stateSync: snapshotRef.current,
                  accountContext: accountContextRef.current || null,
                })
              );
              if (!hasExistingHistory()) {
                setMessages([
                  {
                    id: `r_${Date.now()}`,
                    role: 'coach',
                    text: `${namePrefix}Live voice & chat ready. Speak or type products to add, budgets to set, or orders to copy.`,
                  },
                ]);
              }
            }
            if (Array.isArray(msg.memoryAdditions) && msg.memoryAdditions.length > 0) {
              onMemoryRef.current?.(msg.memoryAdditions as AiMemoryAddition[]);
            }
            if (msg.pendingConfirmation) {
              setPendingConfirmation(msg.pendingConfirmation as PendingAiConfirmation);
            }
            if (msg.appStateUpdate) {
              const rawState = msg.appStateUpdate as PlannerSnapshot;
              const nextState: PlannerSnapshot = {
                ...rawState,
                conversations: conversationsRef.current,
                activeConversationId: activeConvIdRef.current,
              };
              const changes = (msg.appliedChanges || []) as string[];
              onApplyRef.current(
                nextState,
                changes,
                (msg.focusSection as AiFocusSection | null) || null
              );
              if (changes.length > 0 || msg.orderCopyText) {
                updateMessages((prev) => [
                  ...prev,
                  {
                    id: `sys_${Date.now()}`,
                    role: 'system',
                    text:
                      changes.slice(0, 3).join(' · ') || 'Supplier order ready to copy',
                    changes,
                    orderCopyText:
                      typeof msg.orderCopyText === 'string'
                        ? msg.orderCopyText
                        : undefined,
                    comboPreview: extractActiveComboPreview(nextState, changes),
                  },
                ]);
              }
            } else if (typeof msg.orderCopyText === 'string' && msg.orderCopyText.trim()) {
              const changes = (msg.appliedChanges || []) as string[];
              updateMessages((prev) => [
                ...prev,
                {
                  id: `sys_order_${Date.now()}`,
                  role: 'system',
                  text:
                    changes.slice(0, 2).join(' · ') || 'Supplier order ready to copy (wholesale only)',
                  changes,
                  orderCopyText: msg.orderCopyText,
                },
              ]);
            }
            if (msg.error) {
              if (!wsReadyRef.current) {
                activateServerlessMode();
              } else {
                setStatus('error');
                setErrorMsg(msg.error);
              }
            }
            if (msg.inputTranscript) {
              updateMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last && last.role === 'user' && last.id.startsWith('live_u_')) {
                  return [
                    ...prev.slice(0, -1),
                    { ...last, text: `${last.text}${msg.inputTranscript}` },
                  ];
                }
                return [
                  ...prev,
                  { id: `live_u_${Date.now()}`, role: 'user', text: msg.inputTranscript },
                ];
              });
            }
            if (msg.outputTranscript) {
              updateMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last && last.role === 'coach' && last.id.startsWith('live_c_')) {
                  return [
                    ...prev.slice(0, -1),
                    { ...last, text: `${last.text}${msg.outputTranscript}` },
                  ];
                }
                return [
                  ...prev,
                  { id: `live_c_${Date.now()}`, role: 'coach', text: msg.outputTranscript },
                ];
              });
            }
            if (msg.turnComplete) {
              updateMessages((prev) =>
                prev.map((m, idx) =>
                  idx === prev.length - 1 &&
                  (m.id.startsWith('live_c_') || m.id.startsWith('live_u_'))
                    ? { ...m, id: `done_${m.id}` }
                    : m
                )
              );
            }
            if (msg.interrupted) {
              stopAllAudioPlayback();
            }
            if (msg.audio && outputCtxRef.current) {
              const ctx = outputCtxRef.current;
              if (ctx.state === 'suspended') {
                void ctx.resume().catch(() => {});
              }
              const samples = base64ToPcmFloat32(msg.audio);
              const buffer = ctx.createBuffer(1, samples.length, 24000);
              buffer.getChannelData(0).set(samples);
              const source = ctx.createBufferSource();
              source.buffer = buffer;
              source.connect(ctx.destination);
              playbackRegistryRef.current.registerSource(source);
              setIsSpeaking(true);
              source.onended = () => {
                playbackRegistryRef.current.releaseSource(source);
                if (playbackRegistryRef.current.activeCount === 0 && !audioPlayerRef.current) {
                  setIsSpeaking(false);
                }
              };
              const startAt = Math.max(
                ctx.currentTime,
                playbackRegistryRef.current.nextStartTime
              );
              source.start(startAt);
              playbackRegistryRef.current.nextStartTime = startAt + buffer.duration;
            }
          } catch {
            // Ignore malformed frame
          }
        };

        ws.onerror = () => {
          if (!isStale() && !wsReadyRef.current) activateServerlessMode();
        };
        ws.onclose = () => {
          setMicActive(false);
          if (!isStale() && !wsReadyRef.current) {
            activateServerlessMode();
          } else if (!isStale()) {
            setStatus('disconnected');
          }
        };
      } catch {
        activateServerlessMode();
      }
    };

    const probeHealth = async () => {
      let missingServerKey = false;
      try {
        const controller = new AbortController();
        const tid = window.setTimeout(() => controller.abort(), 3500);
        const res = await fetch('/api/ai/health', { signal: controller.signal });
        window.clearTimeout(tid);
        if (isStale()) return;
        if (res.ok) {
          const data = await res.json();
          if (data.aiConfigured === false) {
            missingServerKey = true;
          }
          if (data.supportsLiveWs === true && data.aiConfigured !== false) {
            connectLiveWs();
            return;
          }
        }
      } catch {
        // Health probe unavailable -> fall directly to serverless mode
      }
      activateServerlessMode();
      if (missingServerKey && !isStale()) {
        setErrorMsg(
          'Server AI key (GEMINI_API_KEY) is not configured yet. Add GEMINI_API_KEY in Vercel settings to enable full AI & voice responses.'
        );
      }
    };

    void probeHealth();

    return () => {
      cancelled = true;
      if (fallbackTimer !== null) window.clearTimeout(fallbackTimer);
      stopSession();
    };
  }, [isOpen, reconnectNonce, stopAllAudioPlayback, stopSession, updateMessages]);

  const handleConfirmPending = () => {
    if (!pendingConfirmation) return;
    const mergedState: PlannerSnapshot = {
      ...pendingConfirmation.proposedState,
      conversations: conversationsRef.current,
      activeConversationId: activeConvIdRef.current,
    };
    onApplyRef.current(
      mergedState,
      pendingConfirmation.changes,
      pendingConfirmation.focusSection || null
    );
    updateMessages((prev) => [
      ...prev,
      {
        id: `confirmed_${Date.now()}`,
        role: 'system',
        text: pendingConfirmation.changes.slice(0, 3).join(' · '),
        changes: pendingConfirmation.changes,
        comboPreview: extractActiveComboPreview(
          pendingConfirmation.proposedState,
          pendingConfirmation.changes
        ),
      },
    ]);
    setPendingConfirmation(null);
  };

  const handleCancelPending = () => {
    setPendingConfirmation(null);
    updateMessages((prev) => [
      ...prev,
      { id: `cancel_${Date.now()}`, role: 'coach', text: 'Cancelled — workspace unchanged.' },
    ]);
  };

  const submitServerlessTurn = async (payload: {
    text?: string;
    audioBase64?: string;
    mimeType?: string;
  }) => {
    const myTurnGen = turnGateRef.current.nextTurn();
    stopAllAudioPlayback();
    setProcessing(true);
    setErrorMsg(null);
    setPendingConfirmation(null);

    if (payload.text) {
      updateMessages((prev) => [
        ...prev,
        { id: `ut_${Date.now()}`, role: 'user', text: payload.text as string },
      ]);
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 45000);

    try {
      const history = messagesRef.current
        .filter((m): m is TranscriptMessage & { role: 'user' | 'coach' } => m.role !== 'system')
        .slice(-6)
        .map((m) => ({ role: m.role, text: m.text }));

      // Keep Vercel serverless payload lean by omitting stored chat history from plannerState
      const leanPlannerState: PlannerSnapshot = {
        ...snapshotRef.current,
        conversations: [],
      };

      const res = await fetch('/api/ai/voice-turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          ...payload,
          contextSummary: contextRef.current,
          plannerState: leanPlannerState,
          accountContext: accountContextRef.current,
          history,
          wantAudioReply: Boolean(payload.audioBase64),
        }),
      });
      const rawText = await res.text();
      let data: Record<string, unknown> = {};
      if (rawText) {
        try {
          data = JSON.parse(rawText) as Record<string, unknown>;
        } catch {
          if (res.status === 413) {
            throw new Error('Voice clip was too large for one turn. Try a shorter voice message.');
          }
          if (res.status === 504 || res.status === 502) {
            throw new Error('AI Coach timed out on the server. Please try again.');
          }
          throw new Error(`Unexpected server response (HTTP ${res.status}).`);
        }
      }
      if (!turnGateRef.current.isCurrentTurn(myTurnGen)) return;
      if (!res.ok) {
        throw new Error(
          typeof data.error === 'string' && data.error
            ? data.error
            : `Coach request failed (HTTP ${res.status}).`
        );
      }

      if (!payload.text && typeof data.userTranscript === 'string' && data.userTranscript) {
        const transcript = data.userTranscript;
        updateMessages((prev) => [
          ...prev,
          { id: `uv_${Date.now()}`, role: 'user', text: transcript },
        ]);
      }

      if (Array.isArray(data.memoryAdditions) && data.memoryAdditions.length > 0) {
        onMemoryRef.current?.(data.memoryAdditions as AiMemoryAddition[]);
      }

      if (data.pendingConfirmation) {
        setPendingConfirmation(data.pendingConfirmation as PendingAiConfirmation);
      } else if (data.updatedState) {
        const rawState = data.updatedState as PlannerSnapshot;
        const nextState: PlannerSnapshot = {
          ...rawState,
          conversations: conversationsRef.current,
          activeConversationId: activeConvIdRef.current,
        };
        const changes = (data.appliedChanges || []) as string[];
        onApplyRef.current(
          nextState,
          changes,
          (data.focusSection as AiFocusSection | null) || null
        );
        if (changes.length > 0 || data.orderCopyText) {
          updateMessages((prev) => [
            ...prev,
            {
              id: `sys_${Date.now()}`,
              role: 'system',
              text:
                changes.slice(0, 3).join(' · ') || 'Supplier order ready to copy',
              changes,
              orderCopyText:
                typeof data.orderCopyText === 'string'
                  ? data.orderCopyText
                  : undefined,
              comboPreview: extractActiveComboPreview(nextState, changes),
            },
          ]);
        }
      }

      if (data.actionError && !data.updatedState && !data.pendingConfirmation) {
        setErrorMsg(String(data.actionError));
      }

      const coachText = typeof data.coachText === 'string' ? data.coachText : '';
      const audioWavBase64 =
        typeof data.audioWavBase64 === 'string' ? data.audioWavBase64 : null;
      const orderCopyText =
        typeof data.orderCopyText === 'string' && data.orderCopyText.trim()
          ? data.orderCopyText
          : undefined;

      if (coachText) {
        updateMessages((prev) => [
          ...prev,
          {
            id: `cv_${Date.now()}`,
            role: 'coach',
            text: coachText,
            audioWavBase64,
            orderCopyText: !data.updatedState ? orderCopyText : undefined,
          },
        ]);
      } else if (!data.updatedState && orderCopyText) {
        updateMessages((prev) => [
          ...prev,
          {
            id: `sys_order_${Date.now()}`,
            role: 'system',
            text: 'Supplier order ready to copy (wholesale only)',
            orderCopyText,
          },
        ]);
      }

      if (audioWavBase64) {
        await playWavClip(audioWavBase64, coachText);
      } else if (payload.audioBase64 && coachText) {
        speakBrowserVoice(coachText);
      }
    } catch (err) {
      if (!turnGateRef.current.isCurrentTurn(myTurnGen)) return;
      if (payload.text) {
        const localExec = executeLocalAiCommand(
          payload.text,
          snapshotRef.current,
          accountContextRef.current
        );
        if (localExec.ok && localExec.updatedState) {
          const nextState = localExec.updatedState;
          const budgetChanged = nextState.budgetCap !== snapshotRef.current.budgetCap;
          const feeChanged = nextState.stallFee !== snapshotRef.current.stallFee;
          const check =
            budgetChanged || feeChanged
              ? assessConfirmationRequirement(
                  'configure_planner',
                  {
                    ...(budgetChanged ? { budgetCap: nextState.budgetCap } : {}),
                    ...(feeChanged ? { stallFee: nextState.stallFee } : {}),
                  },
                  snapshotRef.current
                )
              : { required: false };
          if (check.required) {
            setPendingConfirmation({
              id: `local_confirm_${Date.now()}`,
              summary: localExec.changes.join(' · '),
              changes: localExec.changes,
              proposedState: nextState,
              focusSection: localExec.focusSection || null,
              reason: check.reason || 'Confirm major change before applying.',
            });
            return;
          }
          onApplyRef.current(
            nextState,
            localExec.changes,
            localExec.focusSection || null
          );
          updateMessages((prev) => [
            ...prev,
            {
              id: `sys_${Date.now()}`,
              role: 'system',
              text:
                localExec.changes.slice(0, 3).join(' · ') ||
                'Updated your workspace',
              changes: localExec.changes,
              orderCopyText: localExec.orderCopyText,
              comboPreview: extractActiveComboPreview(
                nextState,
                localExec.changes
              ),
            },
          ]);
          return;
        }
        if (localExec.clarification) {
          updateMessages((prev) => [
            ...prev,
            {
              id: `clar_${Date.now()}`,
              role: 'coach',
              text: localExec.clarification!,
              orderCopyText: localExec.orderCopyText,
            },
          ]);
          return;
        }
      }
      setErrorMsg(
        err instanceof Error && err.name !== 'AbortError'
          ? err.message
          : 'Unable to reach AI Coach right now.'
      );
    } finally {
      window.clearTimeout(timeoutId);
      if (turnGateRef.current.isCurrentTurn(myTurnGen)) {
        setProcessing(false);
      }
    }
  };

  const toggleMic = async () => {
    ensureUnlockedOutputContext();

    if (mode === 'serverless') {
      if (micActive && recorderRef.current) {
        if (recordTimeoutRef.current !== null) {
          window.clearTimeout(recordTimeoutRef.current);
          recordTimeoutRef.current = null;
        }
        if (recorderRef.current.state !== 'inactive') {
          recorderRef.current.stop();
        }
        setMicActive(false);
        return;
      }
      stopAllAudioPlayback();

      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        setErrorMsg('Microphone recording is not supported in this browser. Type your message below.');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
          },
        });
        streamRef.current = stream;

        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : '';

        let recorder: MediaRecorder;
        try {
          recorder = mimeType
            ? new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 32000 })
            : new MediaRecorder(stream, { audioBitsPerSecond: 32000 });
        } catch {
          recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
        }
        recorderRef.current = recorder;
        const chunks: BlobPart[] = [];

        recorder.ondataavailable = (ev) => {
          if (ev.data.size > 0) chunks.push(ev.data);
        };

        recorder.onstop = async () => {
          if (recordTimeoutRef.current !== null) {
            window.clearTimeout(recordTimeoutRef.current);
            recordTimeoutRef.current = null;
          }
          stream.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
          recorderRef.current = null;
          setMicActive(false);
          const actualMime = recorder.mimeType || mimeType || 'audio/webm';
          const blob = new Blob(chunks, { type: actualMime });
          if (blob.size < 250) {
            setErrorMsg('Recording was too short. Tap Voice, speak clearly, then tap again to send.');
            return;
          }
          if (blob.size > 2_800_000) {
            setErrorMsg('Voice recording exceeded size limit. Please keep spoken turns under 55 seconds.');
            return;
          }
          try {
            const audioBase64 = await blobToBase64(blob);
            await submitServerlessTurn({
              audioBase64,
              mimeType: actualMime.split(';')[0],
            });
          } catch (err) {
            setErrorMsg(
              err instanceof Error ? err.message : 'Failed to process voice recording.'
            );
          }
        };

        recorder.start();
        setMicActive(true);
        setErrorMsg(null);
        // Auto-stop at 55s so recordings stay well within Vercel serverless request size limits
        recordTimeoutRef.current = window.setTimeout(() => {
          recordTimeoutRef.current = null;
          if (recorderRef.current && recorderRef.current.state !== 'inactive') {
            recorderRef.current.stop();
          }
        }, 55000);
      } catch (err) {
        const name = err instanceof DOMException ? err.name : '';
        setErrorMsg(
          name === 'NotAllowedError'
            ? 'Microphone blocked. Allow mic access in browser settings or type below.'
            : err instanceof Error
            ? err.message
            : 'Microphone unavailable.'
        );
      }
      return;
    }

    if (micActive) {
      processorRef.current?.disconnect();
      gainNodeRef.current?.disconnect();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      inputCtxRef.current?.close();
      processorRef.current = null;
      gainNodeRef.current = null;
      streamRef.current = null;
      inputCtxRef.current = null;
      setMicActive(false);
      return;
    }

    stopAllAudioPlayback();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
      streamRef.current = stream;
      const inputCtx = new AudioContext({ sampleRate: 16000 });
      inputCtxRef.current = inputCtx;
      const source = inputCtx.createMediaStreamSource(stream);
      const processor = inputCtx.createScriptProcessor(4096, 1, 1);
      const muteGain = inputCtx.createGain();
      muteGain.gain.value = 0;

      processorRef.current = processor;
      gainNodeRef.current = muteGain;
      source.connect(processor);
      processor.connect(muteGain);
      muteGain.connect(inputCtx.destination);

      processor.onaudioprocess = (e) => {
        if (wsRef.current?.readyState !== WebSocket.OPEN) return;
        const suppress = shouldSuppressMicFrame({
          echoShieldEnabled: echoShieldRef.current,
          activeSourceCount: playbackRegistryRef.current.activeCount,
          outputCurrentTime: outputCtxRef.current?.currentTime ?? 0,
          nextStartTime: playbackRegistryRef.current.nextStartTime,
        });
        if (suppress) return;
        const base64 = pcmFloatTo16BitBase64(e.inputBuffer.getChannelData(0));
        wsRef.current.send(JSON.stringify({ audio: base64 }));
      };
      setMicActive(true);
      setErrorMsg(null);
    } catch (err) {
      const name = err instanceof DOMException ? err.name : '';
      setErrorMsg(
        name === 'NotAllowedError'
          ? 'Microphone blocked. Allow mic access in browser settings or type below.'
          : err instanceof Error
          ? err.message
          : 'Microphone unavailable.'
      );
    }
  };

  const sendPromptText = async (raw: string) => {
    const text = raw.trim();
    if (!text || processing) return;

    ensureUnlockedOutputContext();
    stopAllAudioPlayback();
    setTextInput('');

    if (mode === 'serverless' || wsRef.current?.readyState !== WebSocket.OPEN) {
      await submitServerlessTurn({ text });
      return;
    }

    wsRef.current.send(
      JSON.stringify({
        stateSync: snapshotRef.current,
        accountContext: accountContextRef.current || null,
      })
    );
    wsRef.current.send(JSON.stringify({ text }));
    updateMessages((prev) => [...prev, { id: `ut_${Date.now()}`, role: 'user', text }]);
  };

  if (!isOpen) return null;

  const memoryCount = accountContext?.memories?.length || 0;

  const stateLabel = errorMsg
    ? 'Error'
    : micActive
    ? 'Listening'
    : processing
    ? 'Thinking'
    : isSpeaking
    ? 'Speaking'
    : status === 'connected'
    ? 'Ready'
    : status === 'connecting'
    ? 'Connecting'
    : 'Offline';

  const stateColor = errorMsg
    ? 'text-[#FB7185] bg-[#FB7185]/15 border-[#FB7185]/35'
    : micActive
    ? 'text-[#FB7185] bg-[#FB7185]/15 border-[#FB7185]/35'
    : processing
    ? 'text-[#FBBF24] bg-[#F59E0B]/15 border-[#F59E0B]/35'
    : isSpeaking
    ? 'text-[#C4B5FD] bg-[#8B5CF6]/20 border-[#8B5CF6]/40'
    : status === 'connected'
    ? 'text-[#34D399] bg-[#34D399]/15 border-[#34D399]/35'
    : 'text-[#A29BB8] bg-white/5 border-white/10';

  if (minimized) {
    return (
      <div
        role="region"
        aria-label="AI Coach minimized"
        className="fixed bottom-20 lg:bottom-5 right-4 z-40 surface-glass rounded-full px-3.5 py-2 flex items-center gap-2.5"
      >
        <Sparkles className="w-4 h-4 text-[#A78BFA]" />
        <span className="text-xs font-semibold text-[#F5F3FA]">AI Coach</span>
        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${stateColor}`}>
          {stateLabel}
        </span>
        {isSpeaking && (
          <button
            type="button"
            onClick={stopAllAudioPlayback}
            aria-label="Stop speaking"
            className="p-1.5 rounded-full bg-[#FB7185]/20 text-[#FB7185]"
          >
            <VolumeX className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={() => setMinimized(false)}
          aria-label="Expand AI Coach"
          className="p-1.5 rounded-full text-[#A29BB8] hover:text-[#F5F3FA]"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close AI Coach"
          className="p-1.5 rounded-full text-[#A29BB8] hover:text-[#F5F3FA]"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <aside
      role="region"
      aria-label="AI Stall Coach"
      className="fixed bottom-20 lg:bottom-5 right-3 sm:right-5 z-40 w-[360px] sm:w-[420px] max-w-[calc(100vw-1.5rem)] surface-glass rounded-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#13111C]/85 gap-2 relative">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-4 h-4 text-[#A78BFA] shrink-0" />
          <h2 className="font-display text-xs font-bold text-[#F5F3FA] truncate">
            AI Coach
          </h2>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold shrink-0 ${stateColor}`}
          >
            {stateLabel}
          </span>
          {memoryCount > 0 && (
            <span
              title={`${memoryCount} private memories active`}
              className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-[#8B5CF6]/15 text-[#C4B5FD] shrink-0"
            >
              <BrainCircuit className="w-2.5 h-2.5" />
              {memoryCount}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleStartNewChat}
            title="New chat"
            aria-label="Start new chat"
            className="p-1.5 rounded-lg text-[#A29BB8] hover:text-[#F5F3FA] hover:bg-white/5"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          {conversations.length > 0 && (
            <button
              type="button"
              onClick={() => setShowHistoryMenu((v) => !v)}
              title="Chat history"
              aria-label="Chat history"
              className={`p-1.5 rounded-lg transition-colors ${
                showHistoryMenu
                  ? 'bg-[#8B5CF6]/20 text-[#C4B5FD]'
                  : 'text-[#A29BB8] hover:text-[#F5F3FA] hover:bg-white/5'
              }`}
            >
              <History className="w-3.5 h-3.5" />
            </button>
          )}
          {mode === 'live-ws' && (
            <button
              type="button"
              onClick={() => setEchoShield((v) => !v)}
              title={echoShield ? 'Echo shield ON' : 'Echo shield OFF'}
              aria-label="Toggle Echo Shield"
              className={`p-1.5 rounded-lg border transition-colors ${
                echoShield
                  ? 'bg-[#8B5CF6]/20 border-[#8B5CF6]/40 text-[#C4B5FD]'
                  : 'bg-white/5 border-white/10 text-[#A29BB8]'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
            </button>
          )}
          {isSpeaking && (
            <button
              type="button"
              onClick={stopAllAudioPlayback}
              aria-label="Stop speaking"
              title="Stop speaking"
              className="p-1.5 rounded-lg bg-[#FB7185]/20 border border-[#FB7185]/40 text-[#FB7185]"
            >
              <VolumeX className="w-3.5 h-3.5" />
            </button>
          )}
          {(status === 'disconnected' || status === 'error') && (
            <button
              type="button"
              onClick={() => setReconnectNonce((n) => n + 1)}
              aria-label="Reconnect AI Coach"
              title="Reconnect"
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[#C4B5FD]"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            aria-label="Minimize AI Coach"
            onClick={() => setMinimized(true)}
            className="p-1.5 rounded-lg text-[#A29BB8] hover:text-[#F5F3FA] hover:bg-white/5"
          >
            <Minimize2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            aria-label="Close AI Coach"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#A29BB8] hover:text-[#F5F3FA] hover:bg-white/5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Saved Chats Dropdown */}
        {showHistoryMenu && (
          <div className="absolute right-3 top-full mt-1.5 w-64 rounded-xl bg-[#13111C] border border-[#2E2942] shadow-2xl p-2 z-50 space-y-1">
            <div className="flex items-center justify-between px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#A29BB8]">
              <span>Project chats ({conversations.length})</span>
              <button
                type="button"
                onClick={handleStartNewChat}
                className="text-[#C4B5FD] hover:text-white normal-case"
              >
                + New
              </button>
            </div>
            <div className="max-h-44 overflow-y-auto space-y-1">
              {conversations.map((c) => {
                const active = c.id === activeConversationId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleSwitchConversation(c.id)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors truncate ${
                      active
                        ? 'bg-[#8B5CF6]/20 text-[#F5F3FA] font-semibold'
                        : 'text-[#A29BB8] hover:bg-white/5 hover:text-[#F5F3FA]'
                    }`}
                  >
                    {c.title}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-3.5 space-y-3">
        {errorMsg && (
          <div className="bg-[#FB7185]/12 border border-[#FB7185]/35 rounded-xl px-3 py-2 text-[11px] text-[#FDA4AF] flex items-center justify-between gap-2">
            <span>{errorMsg}</span>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="text-[#F5F3FA] hover:underline shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Pending Confirmation Preview Card */}
        {pendingConfirmation && (
          <div className="bg-[#F59E0B]/12 border border-[#F59E0B]/40 rounded-xl p-3 space-y-2.5 text-xs">
            <div className="flex items-start gap-2 text-[#FDE68A]">
              <AlertTriangle className="w-4 h-4 text-[#FBBF24] shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className="font-semibold text-[#F5F3FA]">Confirm change</div>
                <p className="text-[11px] text-[#FDE68A]/90">
                  {pendingConfirmation.reason}
                </p>
                <div className="text-[11px] text-[#C4B5FD] pt-0.5">
                  {pendingConfirmation.changes.slice(0, 3).join(' · ')}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleConfirmPending}
                className="flex-1 py-1.5 rounded-lg bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-semibold"
              >
                Confirm changes
              </button>
              <button
                type="button"
                onClick={handleCancelPending}
                className="px-3 py-1.5 rounded-lg bg-[#1A1726] hover:bg-[#231F33] text-[#A29BB8] hover:text-[#F5F3FA] text-xs font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Messages Thread */}
        <div className="h-56 overflow-y-auto surface-inset rounded-xl p-3 space-y-2.5 text-xs">
          {messages.map((m) => (
            <div key={m.id} className="space-y-2">
              {m.role === 'system' ? (
                <div className="bg-[#34D399]/10 border border-[#34D399]/25 rounded-lg px-2.5 py-1.5 text-[11px] text-[#34D399] flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>{m.text}</span>
                </div>
              ) : (
                <div
                  className={
                    m.role === 'user'
                      ? 'text-[#C4B5FD] font-medium'
                      : 'text-[#F5F3FA]'
                  }
                >
                  <span className="font-semibold text-[#A29BB8] mr-1.5">
                    {m.role === 'user' ? 'You:' : 'Coach:'}
                  </span>
                  <span className="leading-relaxed whitespace-pre-line">{m.text}</span>
                  {m.role === 'coach' &&
                    m.id !== 'serverless_ready' &&
                    !m.id.startsWith('r_') && (
                      <button
                        type="button"
                        onClick={() => {
                          ensureUnlockedOutputContext();
                          if (m.audioWavBase64) {
                            void playWavClip(m.audioWavBase64, m.text);
                          } else {
                            speakBrowserVoice(m.text);
                          }
                        }}
                        className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-[10px] text-[#C4B5FD] border border-white/10 align-middle"
                      >
                        <Play className="w-2.5 h-2.5 fill-current" />
                        <span>{m.audioWavBase64 ? 'Replay' : 'Speak'}</span>
                      </button>
                    )}
                </div>
              )}

              {/* 1-click Supplier Order Copy Card */}
              {m.orderCopyText && (
                <div className="bg-[#161224] border border-[#8B5CF6]/40 rounded-xl p-2.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-[#C4B5FD]">
                      Supplier Order (Wholesale Only)
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleCopyMessageOrder(m.id, m.orderCopyText!)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-[11px] font-semibold"
                    >
                      {copiedMsgId === m.id ? (
                        <>
                          <Check className="w-3 h-3" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy order</span>
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="text-[10px] font-mono text-[#A29BB8] whitespace-pre-wrap leading-relaxed max-h-28 overflow-y-auto">
                    {m.orderCopyText}
                  </pre>
                </div>
              )}

              {/* Visual Stock Combination Card inside chat when Coach updates/recommends a mix */}
              {m.comboPreview && (
                <div className="bg-[#161224] border border-[#8B5CF6]/40 rounded-xl p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-[#C4B5FD]">
                      {m.comboPreview.groupName} · {m.comboPreview.combo.badge}
                    </span>
                    <span className="font-mono text-[#A29BB8]">
                      {m.comboPreview.combo.pieces} pcs
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 font-mono tabular-nums text-[11px]">
                    <div>
                      <div className="text-[9px] font-sans text-[#A29BB8]">Cost</div>
                      <div className="text-[#F5F3FA] font-semibold">
                        {fmt(m.comboPreview.combo.cost)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] font-sans text-[#A29BB8]">Profit</div>
                      <div className="text-[#34D399] font-semibold">
                        +{fmt(m.comboPreview.combo.prof90)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] font-sans text-[#A29BB8]">Budget</div>
                      <div className="text-[#C4B5FD] font-semibold">
                        {m.comboPreview.budgetCap > 0
                          ? `${Math.round(
                              (m.comboPreview.combo.cost / m.comboPreview.budgetCap) * 100
                            )}%`
                          : '—'}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {processing && (
            <div className="flex items-center gap-2 text-[#A29BB8] text-[11px]">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#A78BFA]" />
              <span>Thinking...</span>
            </div>
          )}
          <div ref={listEndRef} />
        </div>

        {/* Starter Prompt Chips */}
        {messages.length <= 2 && (
          <div className="flex flex-wrap gap-1.5">
            {STARTER_PROMPTS.map((p) => (
              <button
                key={p}
                type="button"
                disabled={processing}
                onClick={() => void sendPromptText(p)}
                className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-[#8B5CF6]/20 border border-white/10 hover:border-[#8B5CF6]/40 text-[11px] text-[#C4B5FD] transition-colors text-left"
              >
                {p}
              </button>
            ))}
          </div>
        )}

        {/* Voice + Text Composer */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={status === 'connecting' || processing}
            onClick={toggleMic}
            aria-label={micActive ? 'Stop microphone' : 'Start microphone'}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
              micActive
                ? 'bg-[#FB7185] hover:bg-[#F43F5E] text-[#0B0A10] coach-listening-pulse'
                : 'bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] hover:from-[#7C3AED] hover:to-[#5B21B6] text-white disabled:opacity-50'
            }`}
          >
            {status === 'connecting' || processing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : micActive ? (
              <MicOff className="w-3.5 h-3.5" />
            ) : (
              <Mic className="w-3.5 h-3.5" />
            )}
            <span>{micActive ? (mode === 'serverless' ? 'Send' : 'Mute') : 'Voice'}</span>
          </button>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void sendPromptText(textInput);
            }}
            className="flex-1 flex gap-1.5 min-w-0"
          >
            <input
              type="text"
              aria-label="Message AI Coach"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Add products, create categories, or ask..."
              className="flex-1 min-w-0 surface-inset rounded-xl px-3 py-2 text-xs text-[#F5F3FA] placeholder-[#78718E] focus:outline-none focus:border-[#8B5CF6]"
            />
            <button
              type="submit"
              disabled={processing || !textInput.trim()}
              aria-label="Send message"
              className="px-3 py-2 rounded-xl bg-[#1A1726] hover:bg-[#8B5CF6] disabled:opacity-40 text-[#C4B5FD] hover:text-white border border-[#2E2942] shrink-0 transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
