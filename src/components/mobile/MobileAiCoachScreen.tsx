import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  History,
  Loader2,
  Mic,
  MicOff,
  Play,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
  VolumeX,
} from 'lucide-react';
import type { StallWorkspaceController } from '../../hooks/useStallWorkspace';
import type {
  AccountAiContext,
  AiFocusSection,
  AiMemoryAddition,
  CoachConversation,
  CoachMessageRecord,
  PendingAiConfirmation,
  PlannerSnapshot,
} from '../../types/stall';
import {
  assessConfirmationRequirement,
  executeLocalAiCommand,
} from '../../utils/aiActions';
import { triggerHaptic } from '../../utils/experienceMode';
import { copyTextReliable } from '../../utils/orderAndProjectEngine';
import {
  VoicePlaybackRegistry,
  VoiceTurnGate,
  shouldSuppressMicFrame,
} from '../../utils/voiceAudioGuard';
import { MobileBottomSheet } from './MobileBottomSheet';

interface MobileAiCoachScreenProps {
  workspace: StallWorkspaceController;
}

interface MobileTranscriptMessage {
  id: string;
  role: 'user' | 'coach' | 'system';
  text: string;
  audioWavBase64?: string | null;
  changes?: string[];
  orderCopyText?: string;
}

const STARTER_PROMPTS = [
  'Add 20 oxidised bangles at ₹45 each, appeal 4/5',
  'Create Hair Accessories & add 15 pearl clips at ₹30',
  'Copy my full supplier order',
  'Summarise my stall plan',
];

const BAR_COUNT = 16;

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
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.onerror = () => reject(new Error('Failed to read recorded audio.'));
    reader.readAsDataURL(blob);
  });
}

function recordsToTranscript(
  records: CoachMessageRecord[]
): MobileTranscriptMessage[] {
  return records.map((r) => ({
    id: r.id,
    role: r.role,
    text: r.text,
    ...(r.changes ? { changes: r.changes } : {}),
    ...(r.orderCopyText ? { orderCopyText: r.orderCopyText } : {}),
  }));
}

function transcriptToRecords(
  messages: MobileTranscriptMessage[]
): CoachMessageRecord[] {
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

function deriveConversationTitle(messages: MobileTranscriptMessage[]): string {
  const firstUser = messages.find((m) => m.role === 'user');
  if (!firstUser) return 'New chat';
  const clean = firstUser.text.trim();
  return clean.length > 42 ? `${clean.slice(0, 42)}…` : clean;
}

export function MobileAiCoachScreen({ workspace }: MobileAiCoachScreenProps) {
  const {
    auth,
    contextSummary,
    plannerSnapshot,
    effectiveAccountContext,
    conversations,
    activeConversationId,
    handleUpdateConversations,
    pushUndoSnapshot,
    applyWorkspaceSnapshot,
  } = workspace;

  const [status, setStatus] = useState<'connecting' | 'connected' | 'error'>(
    'connecting'
  );
  const [mode, setMode] = useState<'live-ws' | 'serverless'>('serverless');
  const [micActive, setMicActive] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [textInput, setTextInput] = useState('');
  const [messages, setMessages] = useState<MobileTranscriptMessage[]>([]);
  const [pendingConfirmation, setPendingConfirmation] =
    useState<PendingAiConfirmation | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);

  // Real audio-reactive waveform levels (strictly zero when idle!)
  const [levels, setLevels] = useState<number[]>(() => Array(BAR_COUNT).fill(0));
  const [orbEnergy, setOrbEnergy] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const wsReadyRef = useRef(false);
  const modeRef = useRef<'live-ws' | 'serverless'>('serverless');
  const messagesRef = useRef<MobileTranscriptMessage[]>([]);
  const snapshotRef = useRef<PlannerSnapshot>(plannerSnapshot);
  const accountContextRef = useRef<AccountAiContext | undefined>(
    effectiveAccountContext
  );
  const contextRef = useRef(contextSummary);
  const conversationsRef = useRef(conversations);
  const activeConvIdRef = useRef(activeConversationId);
  const listEndRef = useRef<HTMLDivElement | null>(null);

  const inputCtxRef = useRef<AudioContext | null>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const inputAnalyserRef = useRef<AnalyserNode | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);
  const rafIdRef = useRef<number | null>(null);
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
  accountContextRef.current = effectiveAccountContext;
  contextRef.current = contextSummary;
  conversationsRef.current = conversations;
  activeConvIdRef.current = activeConversationId;

  const applyAiStateRef = useRef(
    (
      next: PlannerSnapshot,
      changes: string[],
      focus?: AiFocusSection | null
    ) => {
      pushUndoSnapshot();
      applyWorkspaceSnapshot(next, changes, focus);
    }
  );
  applyAiStateRef.current = (
    next: PlannerSnapshot,
    changes: string[],
    focus?: AiFocusSection | null
  ) => {
    pushUndoSnapshot();
    applyWorkspaceSnapshot(next, changes, focus);
  };

  const memoryAddRef = useRef((items: AiMemoryAddition[]) => {
    if (auth.user && items.length > 0) {
      void auth.addMemoriesBatch(items, 'voice');
    }
  });
  memoryAddRef.current = (items: AiMemoryAddition[]) => {
    if (auth.user && items.length > 0) {
      void auth.addMemoriesBatch(items, 'voice');
    }
  };

  // Real AnalyserNode animation loop (ONLY active when mic or audio output is genuinely active)
  useEffect(() => {
    if (!micActive && !isSpeaking) {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      setLevels(Array(BAR_COUNT).fill(0));
      setOrbEnergy(0);
      return;
    }

    let alive = true;
    const freqBins = new Uint8Array(32);

    const tick = () => {
      if (!alive) return;
      const activeAnalyser = micActive
        ? inputAnalyserRef.current
        : outputAnalyserRef.current;

      if (activeAnalyser) {
        activeAnalyser.getByteFrequencyData(freqBins);
        const nextBars: number[] = [];
        let sum = 0;
        for (let i = 0; i < BAR_COUNT; i++) {
          const val = (freqBins[i] || 0) / 255;
          nextBars.push(val);
          sum += val;
        }
        setLevels(nextBars);
        setOrbEnergy(Math.min(1, (sum / BAR_COUNT) * 1.6));
      } else {
        setLevels(Array(BAR_COUNT).fill(0));
        setOrbEnergy(0);
      }

      rafIdRef.current = requestAnimationFrame(tick);
    };

    rafIdRef.current = requestAnimationFrame(tick);

    return () => {
      alive = false;
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [micActive, isSpeaking]);

  const persistMessagesToConversation = useCallback(
    (nextMessages: MobileTranscriptMessage[]) => {
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
        handleUpdateConversations([newConv, ...currentConvs].slice(0, 12), targetId);
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
      handleUpdateConversations(updated, targetId);
    },
    [handleUpdateConversations]
  );

  const updateMessages = useCallback(
    (
      updater: (prev: MobileTranscriptMessage[]) => MobileTranscriptMessage[],
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

  // Hydrate persisted conversation
  useEffect(() => {
    const activeConv =
      conversations.find((c) => c.id === activeConversationId) ||
      conversations[0];
    if (activeConv && activeConv.messages.length > 0) {
      setMessages(recordsToTranscript(activeConv.messages));
    }
  }, [activeConversationId]);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, processing, pendingConfirmation]);

  const ensureUnlockedOutputContext = useCallback((): AudioContext | null => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return null;
      if (!outputCtxRef.current || outputCtxRef.current.state === 'closed') {
        const ctx = new AudioCtx({ sampleRate: 24000 });
        outputCtxRef.current = ctx;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        analyser.smoothingTimeConstant = 0.75;
        analyser.connect(ctx.destination);
        outputAnalyserRef.current = analyser;
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
      // ignore
    }
    audioPlayerRef.current = null;

    try {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    } catch {
      // ignore
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
          source.connect(outputAnalyserRef.current || ctx.destination);

          playbackRegistryRef.current.registerSource(source);
          setIsSpeaking(true);
          source.onended = () => {
            playbackRegistryRef.current.releaseSource(source);
            if (
              playbackRegistryRef.current.activeCount === 0 &&
              !audioPlayerRef.current
            ) {
              setIsSpeaking(false);
            }
          };
          source.start(ctx.currentTime);
          return;
        } catch {
          // fallback
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

  const cleanupMicStream = useCallback(() => {
    if (recordTimeoutRef.current !== null) {
      window.clearTimeout(recordTimeoutRef.current);
      recordTimeoutRef.current = null;
    }
    try {
      processorRef.current?.disconnect();
      gainNodeRef.current?.disconnect();
      inputAnalyserRef.current?.disconnect();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      inputCtxRef.current?.close();
    } catch {
      // ignore
    }
    processorRef.current = null;
    gainNodeRef.current = null;
    inputAnalyserRef.current = null;
    streamRef.current = null;
    inputCtxRef.current = null;
  }, []);

  const stopSession = useCallback(() => {
    turnGateRef.current.invalidateAll();
    setMicActive(false);
    setProcessing(false);
    wsReadyRef.current = false;
    stopAllAudioPlayback();

    try {
      if (recorderRef.current) {
        recorderRef.current.ondataavailable = null;
        recorderRef.current.onstop = null;
        if (recorderRef.current.state !== 'inactive') {
          recorderRef.current.stop();
        }
      }
      cleanupMicStream();
      outputAnalyserRef.current?.disconnect();
      outputCtxRef.current?.close();
      if (wsRef.current) {
        wsRef.current.onmessage = null;
        wsRef.current.onerror = null;
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    } catch {
      // ignore
    }
    recorderRef.current = null;
    outputAnalyserRef.current = null;
    outputCtxRef.current = null;
    wsRef.current = null;
  }, [cleanupMicStream, stopAllAudioPlayback]);

  // Sync live state to WebSocket if active
  useEffect(() => {
    if (
      mode === 'live-ws' &&
      status === 'connected' &&
      wsRef.current?.readyState === WebSocket.OPEN
    ) {
      wsRef.current.send(
        JSON.stringify({
          stateSync: plannerSnapshot,
          accountContext: effectiveAccountContext || null,
        })
      );
    }
  }, [mode, status, plannerSnapshot, effectiveAccountContext]);

  // Health probe & connection bootstrap
  useEffect(() => {
    const connGen = turnGateRef.current.nextConnection();
    let cancelled = false;
    let fallbackTimer: number | null = null;
    const isStale = () =>
      cancelled || !turnGateRef.current.isCurrentConnection(connGen);

    setStatus('connecting');
    setErrorMsg(null);
    wsReadyRef.current = false;

    const greetingName =
      accountContextRef.current?.preferredName ||
      accountContextRef.current?.displayName?.split(' ')[0] ||
      '';
    const namePrefix = greetingName ? `Hi ${greetingName} — ` : '';

    const hasExistingHistory = () => {
      const activeConv =
        conversationsRef.current.find(
          (c) => c.id === activeConvIdRef.current
        ) || conversationsRef.current[0];
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
        // ignore
      }
      wsRef.current = null;
      modeRef.current = 'serverless';
      setMode('serverless');
      setStatus('connected');
      if (!hasExistingHistory()) {
        setMessages([
          {
            id: 'serverless_ready',
            role: 'coach',
            text: `${namePrefix}Tap the mic to speak or type below. I can add products, update budgets, compare mixes, or copy your supplier order.`,
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
        const wsUrl = `${proto}//${
          window.location.host
        }/live?context=${encodeURIComponent(contextRef.current)}${accountParam}`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

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
                    text: `${namePrefix}Live voice & chat ready. Speak naturally or type to update your stall plan.`,
                  },
                ]);
              }
            }
            if (
              Array.isArray(msg.memoryAdditions) &&
              msg.memoryAdditions.length > 0
            ) {
              memoryAddRef.current(msg.memoryAdditions as AiMemoryAddition[]);
            }
            if (msg.pendingConfirmation) {
              setPendingConfirmation(
                msg.pendingConfirmation as PendingAiConfirmation
              );
            }
            if (msg.appStateUpdate) {
              const rawState = msg.appStateUpdate as PlannerSnapshot;
              const nextState: PlannerSnapshot = {
                ...rawState,
                conversations: conversationsRef.current,
                activeConversationId: activeConvIdRef.current,
              };
              const changes = (msg.appliedChanges || []) as string[];
              applyAiStateRef.current(
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
                      changes.slice(0, 3).join(' · ') ||
                      'Supplier order ready to copy',
                    changes,
                    orderCopyText:
                      typeof msg.orderCopyText === 'string'
                        ? msg.orderCopyText
                        : undefined,
                  },
                ]);
              }
            } else if (
              typeof msg.orderCopyText === 'string' &&
              msg.orderCopyText.trim()
            ) {
              updateMessages((prev) => [
                ...prev,
                {
                  id: `sys_order_${Date.now()}`,
                  role: 'system',
                  text: 'Supplier order ready to copy (wholesale only)',
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
                if (
                  last &&
                  last.role === 'user' &&
                  last.id.startsWith('live_u_')
                ) {
                  return [
                    ...prev.slice(0, -1),
                    { ...last, text: `${last.text}${msg.inputTranscript}` },
                  ];
                }
                return [
                  ...prev,
                  {
                    id: `live_u_${Date.now()}`,
                    role: 'user',
                    text: msg.inputTranscript,
                  },
                ];
              });
            }
            if (msg.outputTranscript) {
              updateMessages((prev) => {
                const last = prev[prev.length - 1];
                if (
                  last &&
                  last.role === 'coach' &&
                  last.id.startsWith('live_c_')
                ) {
                  return [
                    ...prev.slice(0, -1),
                    { ...last, text: `${last.text}${msg.outputTranscript}` },
                  ];
                }
                return [
                  ...prev,
                  {
                    id: `live_c_${Date.now()}`,
                    role: 'coach',
                    text: msg.outputTranscript,
                  },
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
            if (msg.audio) {
              const ctx = ensureUnlockedOutputContext();
              if (ctx) {
                const samples = base64ToPcmFloat32(msg.audio);
                const buffer = ctx.createBuffer(1, samples.length, 24000);
                buffer.getChannelData(0).set(samples);
                const source = ctx.createBufferSource();
                source.buffer = buffer;
                source.connect(outputAnalyserRef.current || ctx.destination);
                playbackRegistryRef.current.registerSource(source);
                setIsSpeaking(true);
                source.onended = () => {
                  playbackRegistryRef.current.releaseSource(source);
                  if (
                    playbackRegistryRef.current.activeCount === 0 &&
                    !audioPlayerRef.current
                  ) {
                    setIsSpeaking(false);
                  }
                };
                const startAt = Math.max(
                  ctx.currentTime,
                  playbackRegistryRef.current.nextStartTime
                );
                source.start(startAt);
                playbackRegistryRef.current.nextStartTime =
                  startAt + buffer.duration;
              }
            }
          } catch {
            // ignore malformed frame
          }
        };

        ws.onerror = () => {
          if (!isStale() && !wsReadyRef.current) activateServerlessMode();
        };
        ws.onclose = () => {
          setMicActive(false);
          if (!isStale() && !wsReadyRef.current) {
            activateServerlessMode();
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
          if (data.aiConfigured === false) missingServerKey = true;
          if (data.supportsLiveWs === true && data.aiConfigured !== false) {
            connectLiveWs();
            return;
          }
        }
      } catch {
        // serverless fallback
      }
      activateServerlessMode();
      if (missingServerKey && !isStale()) {
        setErrorMsg(
          'Server AI key is not configured yet. Quick local commands still work.'
        );
      }
    };

    void probeHealth();

    return () => {
      cancelled = true;
      if (fallbackTimer !== null) window.clearTimeout(fallbackTimer);
      stopSession();
    };
  }, [ensureUnlockedOutputContext, stopAllAudioPlayback, stopSession, updateMessages]);

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
        .filter(
          (m): m is MobileTranscriptMessage & { role: 'user' | 'coach' } =>
            m.role !== 'system'
        )
        .slice(-6)
        .map((m) => ({ role: m.role, text: m.text }));

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
          throw new Error(
            res.status === 413
              ? 'Voice clip was too large. Try a shorter message.'
              : `Unexpected server response (HTTP ${res.status}).`
          );
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

      if (
        !payload.text &&
        typeof data.userTranscript === 'string' &&
        data.userTranscript
      ) {
        const transcript = data.userTranscript;
        updateMessages((prev) => [
          ...prev,
          { id: `uv_${Date.now()}`, role: 'user', text: transcript },
        ]);
      }

      if (
        Array.isArray(data.memoryAdditions) &&
        data.memoryAdditions.length > 0
      ) {
        memoryAddRef.current(data.memoryAdditions as AiMemoryAddition[]);
      }

      if (data.pendingConfirmation) {
        setPendingConfirmation(
          data.pendingConfirmation as PendingAiConfirmation
        );
      } else if (data.updatedState) {
        const rawState = data.updatedState as PlannerSnapshot;
        const nextState: PlannerSnapshot = {
          ...rawState,
          conversations: conversationsRef.current,
          activeConversationId: activeConvIdRef.current,
        };
        const changes = (data.appliedChanges || []) as string[];
        applyAiStateRef.current(
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
                changes.slice(0, 3).join(' · ') ||
                'Supplier order ready to copy',
              changes,
              orderCopyText:
                typeof data.orderCopyText === 'string'
                  ? data.orderCopyText
                  : undefined,
            },
          ]);
        }
      }

      const coachText =
        typeof data.coachText === 'string' ? data.coachText : '';
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
          const budgetChanged =
            nextState.budgetCap !== snapshotRef.current.budgetCap;
          const feeChanged =
            nextState.stallFee !== snapshotRef.current.stallFee;
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
          applyAiStateRef.current(
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

  const attachInputAnalyser = (stream: MediaStream, sampleRate?: number) => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return null;
      const ctx = sampleRate
        ? new AudioCtx({ sampleRate })
        : new AudioCtx();
      inputCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.72;
      src.connect(analyser);
      inputAnalyserRef.current = analyser;
      return { ctx, src, analyser };
    } catch {
      return null;
    }
  };

  const toggleMic = async () => {
    triggerHaptic(12);
    ensureUnlockedOutputContext();

    // Tap while speaking interrupts playback cleanly
    if (isSpeaking && !micActive) {
      stopAllAudioPlayback();
    }

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

      if (
        !navigator.mediaDevices?.getUserMedia ||
        typeof MediaRecorder === 'undefined'
      ) {
        setErrorMsg(
          'Microphone recording is unavailable in this browser. Type your message below.'
        );
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
        attachInputAnalyser(stream);

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
          recorder = mimeType
            ? new MediaRecorder(stream, { mimeType })
            : new MediaRecorder(stream);
        }

        recorderRef.current = recorder;
        const chunks: BlobPart[] = [];
        recorder.ondataavailable = (ev) => {
          if (ev.data.size > 0) chunks.push(ev.data);
        };
        recorder.onstop = async () => {
          cleanupMicStream();
          recorderRef.current = null;
          setMicActive(false);
          const actualMime = recorder.mimeType || mimeType || 'audio/webm';
          const blob = new Blob(chunks, { type: actualMime });
          if (blob.size < 250) {
            setErrorMsg(
              'Recording was too short. Tap mic, speak clearly, then tap again.'
            );
            return;
          }
          if (blob.size > 2_800_000) {
            setErrorMsg('Please keep voice messages under 55 seconds.');
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
              err instanceof Error ? err.message : 'Failed to send voice clip.'
            );
          }
        };

        recorder.start();
        setMicActive(true);
        setErrorMsg(null);
        recordTimeoutRef.current = window.setTimeout(() => {
          recordTimeoutRef.current = null;
          if (recorderRef.current && recorderRef.current.state !== 'inactive') {
            recorderRef.current.stop();
          }
        }, 55000);
      } catch (err) {
        cleanupMicStream();
        const name = err instanceof DOMException ? err.name : '';
        setErrorMsg(
          name === 'NotAllowedError'
            ? 'Microphone permission blocked. Allow mic access or type below.'
            : 'Microphone unavailable right now.'
        );
      }
      return;
    }

    // Live WebSocket voice stream mode
    if (micActive) {
      cleanupMicStream();
      setMicActive(false);
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
      const attached = attachInputAnalyser(stream, 16000);
      if (attached) {
        const { ctx, src } = attached;
        const processor = ctx.createScriptProcessor(2048, 1, 1);
        const silentGain = ctx.createGain();
        silentGain.gain.value = 0;

        processor.onaudioprocess = (ev) => {
          if (wsRef.current?.readyState !== WebSocket.OPEN) return;
          const samples = ev.inputBuffer.getChannelData(0);
          if (
            shouldSuppressMicFrame({
              echoShieldEnabled: true,
              activeSourceCount: playbackRegistryRef.current.activeCount,
              outputCurrentTime: outputCtxRef.current?.currentTime ?? 0,
              nextStartTime: playbackRegistryRef.current.nextStartTime,
            })
          ) {
            return;
          }
          wsRef.current.send(
            JSON.stringify({ audio: pcmFloatTo16BitBase64(samples) })
          );
        };

        src.connect(processor);
        processor.connect(silentGain);
        silentGain.connect(ctx.destination);
        processorRef.current = processor;
        gainNodeRef.current = silentGain;
      }
      setMicActive(true);
      setErrorMsg(null);
    } catch {
      cleanupMicStream();
      setErrorMsg('Microphone unavailable. Type your message below.');
    }
  };

  const handleSendText = async (overrideText?: string) => {
    const clean = (overrideText ?? textInput).trim();
    if (!clean || processing) return;
    setTextInput('');
    triggerHaptic(8);
    ensureUnlockedOutputContext();

    if (mode === 'live-ws' && wsRef.current?.readyState === WebSocket.OPEN) {
      stopAllAudioPlayback();
      updateMessages((prev) => [
        ...prev,
        { id: `ut_${Date.now()}`, role: 'user', text: clean },
      ]);
      wsRef.current.send(JSON.stringify({ text: clean }));
      return;
    }

    await submitServerlessTurn({ text: clean });
  };

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
    activeConvIdRef.current = newId;
    handleUpdateConversations([newConv, ...conversations].slice(0, 12), newId);
    setMessages([
      {
        id: 'serverless_ready',
        role: 'coach',
        text: 'Fresh chat ready. Speak or type products, budgets, or supplier orders.',
      },
    ]);
    setHistoryOpen(false);
  };

  const handleSwitchConversation = (convId: string) => {
    const found = conversations.find((c) => c.id === convId);
    if (!found) return;
    activeConvIdRef.current = convId;
    handleUpdateConversations(conversations, convId);
    setMessages(
      found.messages.length > 0
        ? recordsToTranscript(found.messages)
        : [
            {
              id: 'serverless_ready',
              role: 'coach',
              text: 'Ready for voice or text.',
            },
          ]
    );
    setHistoryOpen(false);
  };

  const handleConfirmPending = () => {
    if (!pendingConfirmation) return;
    const mergedState: PlannerSnapshot = {
      ...pendingConfirmation.proposedState,
      conversations: conversationsRef.current,
      activeConversationId: activeConvIdRef.current,
    };
    applyAiStateRef.current(
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
      },
    ]);
    setPendingConfirmation(null);
  };

  const handleCopyOrder = async (msgId: string, text: string) => {
    const ok = await copyTextReliable(text);
    if (ok) {
      triggerHaptic(10);
      setCopiedMsgId(msgId);
      window.setTimeout(() => setCopiedMsgId(null), 2000);
    }
  };

  const coachStateLabel = micActive
    ? mode === 'live-ws'
      ? 'Listening live...'
      : 'Recording — tap mic to send'
    : processing
    ? 'Thinking...'
    : isSpeaking
    ? 'Speaking — tap mic to interrupt'
    : status === 'connecting'
    ? 'Connecting...'
    : 'Tap mic or type below';

  return (
    <div
      data-testid="mobile-ai-coach"
      className="flex flex-col min-h-[calc(100dvh-146px)] step-fade-in"
    >
      {/* Top Assistant Sub-Header */}
      <div className="flex items-center justify-between gap-2 pb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-[#8B5CF6]/20 border border-[#8B5CF6]/40 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-[#C4B5FD]" />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-sm font-bold text-[#F5F3FA]">
              StallIQ AI Coach
            </h1>
            <p className="text-[11px] text-[#9D95B8] truncate">
              {mode === 'live-ws' ? 'Live Voice' : 'Voice & Text'} · {coachStateLabel}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isSpeaking && (
            <button
              type="button"
              onClick={stopAllAudioPlayback}
              aria-label="Stop speaking"
              className="w-10 h-10 rounded-xl bg-[#FB7185]/18 border border-[#FB7185]/40 text-[#FDA4AF] flex items-center justify-center"
            >
              <VolumeX className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            aria-label="Conversation history"
            className="w-10 h-10 rounded-xl bg-[#161322] border border-[#252136] text-[#C4B5FD] flex items-center justify-center"
          >
            <History className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleStartNewChat}
            aria-label="New chat"
            className="w-10 h-10 rounded-xl bg-[#161322] border border-[#252136] text-[#C4B5FD] flex items-center justify-center"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Central Voice Orb + Real Audio-Reactive Waveform */}
      <section className="rounded-3xl bg-gradient-to-b from-[#181429] to-[#110F1B] border border-[#2D2744] px-4 py-4 flex flex-col items-center gap-3 shrink-0">
        <div className="relative flex items-center justify-center">
          {/* Outer audio-reactive halo (scaled strictly by real orbEnergy) */}
          <div
            aria-hidden="true"
            className={`absolute w-24 h-24 rounded-full transition-transform duration-75 ${
              micActive
                ? 'bg-[#FB7185]/22'
                : isSpeaking
                ? 'bg-[#8B5CF6]/26'
                : processing
                ? 'bg-[#8B5CF6]/18 animate-pulse'
                : 'bg-transparent'
            }`}
            style={{
              transform:
                micActive || isSpeaking
                  ? `scale(${1 + orbEnergy * 0.45})`
                  : 'scale(1)',
            }}
          />

          <button
            type="button"
            onClick={() => void toggleMic()}
            aria-label={
              micActive ? 'Stop microphone' : 'Start speaking to AI Coach'
            }
            className={`relative z-10 w-[72px] h-[72px] rounded-full flex items-center justify-center border-2 transition-transform active:scale-95 ${
              micActive
                ? 'bg-gradient-to-br from-[#FB7185] to-[#E11D48] border-[#FDA4AF] text-white shadow-[0_0_28px_rgba(251,113,133,0.55)]'
                : processing
                ? 'bg-[#211B38] border-[#8B5CF6] text-[#C4B5FD]'
                : 'bg-gradient-to-br from-[#9F7AEA] via-[#8B5CF6] to-[#6D28D9] border-[#DDD6FE]/50 text-white shadow-[0_10px_28px_-6px_rgba(139,92,246,0.75)]'
            }`}
          >
            {processing ? (
              <Loader2 className="w-7 h-7 animate-spin" />
            ) : micActive ? (
              <MicOff className="w-7 h-7" />
            ) : (
              <Mic className="w-7 h-7" />
            )}
          </button>
        </div>

        {/* Real Web Audio AnalyserNode Bars (Flat resting baseline when idle — zero fake animation) */}
        <div
          aria-hidden="true"
          className="h-7 flex items-center justify-center gap-1"
        >
          {levels.map((lvl, idx) => {
            const px = Math.max(4, Math.round(4 + lvl * 22));
            return (
              <span
                key={idx}
                className={`w-1 rounded-full transition-[height] duration-75 ${
                  micActive
                    ? 'bg-[#FB7185]'
                    : isSpeaking
                    ? 'bg-[#C4B5FD]'
                    : 'bg-[#322C47]'
                }`}
                style={{ height: `${px}px` }}
              />
            );
          })}
        </div>

        <p className="text-xs font-medium text-[#C4B5FD] text-center">
          {coachStateLabel}
        </p>
      </section>

      {/* Error Banner */}
      {errorMsg && (
        <div className="mt-2.5 rounded-2xl bg-[#FB7185]/12 border border-[#FB7185]/35 px-3.5 py-2.5 flex items-start gap-2 text-xs text-[#FDA4AF]">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="flex-1">{errorMsg}</span>
        </div>
      )}

      {/* Pending Confirmation Card */}
      {pendingConfirmation && (
        <div className="mt-2.5 rounded-2xl bg-[#1E1833] border border-[#8B5CF6]/60 p-3.5 space-y-2.5">
          <div className="flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-[#C4B5FD] shrink-0 mt-0.5" />
            <div className="text-xs text-[#F5F3FA]">
              <div className="font-bold">Confirm workspace update</div>
              <p className="text-[#A29BB8] mt-0.5">{pendingConfirmation.reason}</p>
              <p className="text-[#C4B5FD] mt-1">{pendingConfirmation.summary}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPendingConfirmation(null)}
              className="min-h-[40px] rounded-xl bg-[#13111C] border border-[#252136] text-xs font-semibold text-[#A29BB8]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmPending}
              className="min-h-[40px] rounded-xl bg-[#8B5CF6] text-white text-xs font-semibold"
            >
              Apply Change
            </button>
          </div>
        </div>
      )}

      {/* Conversation Transcript */}
      <div className="flex-1 overflow-y-auto py-3 space-y-2.5">
        {messages.length <= 1 && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {STARTER_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => void handleSendText(prompt)}
                className="shrink-0 min-h-[38px] px-3.5 rounded-2xl bg-[#161322] border border-[#2D2744] text-xs text-[#DDD7EE] whitespace-nowrap active:scale-95 transition-transform"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}

        {messages.map((msg) => {
          if (msg.role === 'system') {
            return (
              <div
                key={msg.id}
                className="rounded-2xl bg-[#151D22] border border-[#34D399]/35 p-3 space-y-2"
              >
                <div className="flex items-start gap-2 text-xs text-[#A7F3D0]">
                  <CheckCircle2 className="w-4 h-4 text-[#34D399] shrink-0 mt-0.5" />
                  <span>{msg.text}</span>
                </div>
                {msg.orderCopyText && (
                  <button
                    type="button"
                    onClick={() => void handleCopyOrder(msg.id, msg.orderCopyText!)}
                    className="w-full min-h-[40px] rounded-xl bg-[#0E0C15] border border-[#34D399]/40 text-xs font-semibold text-[#34D399] inline-flex items-center justify-center gap-1.5"
                  >
                    {copiedMsgId === msg.id ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Copied Wholesale Order</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Wholesale Supplier Order</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            );
          }

          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  isUser
                    ? 'bg-[#8B5CF6] text-white rounded-br-md'
                    : 'bg-[#161322] border border-[#252136] text-[#F5F3FA] rounded-bl-md'
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{msg.text}</p>

                {msg.audioWavBase64 && (
                  <button
                    type="button"
                    onClick={() => void playWavClip(msg.audioWavBase64!, msg.text)}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[#C4B5FD]"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Replay voice</span>
                  </button>
                )}

                {msg.orderCopyText && (
                  <button
                    type="button"
                    onClick={() => void handleCopyOrder(msg.id, msg.orderCopyText!)}
                    className="mt-2.5 w-full min-h-[38px] rounded-xl bg-[#0E0C15] border border-[#8B5CF6]/45 text-xs font-semibold text-[#C4B5FD] inline-flex items-center justify-center gap-1.5"
                  >
                    {copiedMsgId === msg.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#34D399]" />
                        <span>Copied Wholesale Order</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Supplier Order</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
        <div ref={listEndRef} />
      </div>

      {/* Keyboard-Safe Docked Text Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleSendText();
        }}
        className="sticky bottom-0 pt-2 pb-1 bg-[#0B0A10]/95 backdrop-blur-md flex items-center gap-2"
      >
        <input
          type="text"
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          placeholder="Type products, budgets, or questions..."
          aria-label="Message AI Coach"
          className="flex-1 min-h-[46px] px-4 rounded-2xl bg-[#13111C] border border-[#2D2744] text-sm text-[#F5F3FA] placeholder:text-[#7E7699]"
        />
        <button
          type="submit"
          disabled={!textInput.trim() || processing}
          aria-label="Send message"
          className="w-12 h-12 rounded-2xl bg-[#8B5CF6] text-white flex items-center justify-center shrink-0 disabled:opacity-40 active:scale-95 transition-transform"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>

      {/* Conversation History Bottom Sheet */}
      <MobileBottomSheet
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        title="Conversations"
        subtitle="Saved to this project"
        footer={
          <button
            type="button"
            onClick={handleStartNewChat}
            className="w-full min-h-[46px] rounded-2xl bg-[#8B5CF6] text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Start New Chat</span>
          </button>
        }
      >
        {conversations.length === 0 ? (
          <p className="text-xs text-[#9D95B8] text-center py-4">
            No saved conversations yet.
          </p>
        ) : (
          <div className="space-y-2">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                type="button"
                onClick={() => handleSwitchConversation(conv.id)}
                className={`w-full text-left rounded-2xl p-3.5 border ${
                  conv.id === activeConversationId
                    ? 'bg-[#1C1730] border-[#8B5CF6]'
                    : 'bg-[#0E0C15] border-[#252136]'
                }`}
              >
                <div className="text-sm font-semibold text-[#F5F3FA] truncate">
                  {conv.title}
                </div>
                <div className="text-[11px] text-[#9D95B8] mt-0.5">
                  {conv.messages.length} messages
                </div>
              </button>
            ))}
          </div>
        )}
      </MobileBottomSheet>
    </div>
  );
}
