import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { auth, firebaseConfigStatus, googleProvider } from '../firebase';
import {
  addAiMemory,
  clearAllAiMemories,
  deleteAiMemory,
  deleteUserWorkspace,
  ensureUserProfile,
  loadAiMemories,
  loadAllUserWorkspaces,
  saveUserWorkspace,
  updateAiMemory,
  updateBusinessProfile,
} from '../services/userWorkspaceService';
import type {
  AccountAiContext,
  AiMemoryAddition,
  AiMemoryCategory,
  AiMemoryItem,
  PlannerSnapshot,
  ProjectStatus,
  ProjectSummary,
  ProjectType,
  UserProfile,
} from '../types/stall';
import {
  BLUEPRINT_LIMITS,
  clampStr,
  formatAuthOrSyncError,
  hydrateWorkspaceSnapshot,
  resolvePreferredName,
} from '../utils/accountHelpers';
import { resolveCategoryGroups } from '../utils/optimizer';
import { createEmptyProjectSnapshot } from '../utils/orderAndProjectEngine';

export type CloudSyncStatus = 'guest' | 'loading' | 'saving' | 'saved' | 'error';

const GUEST_PROJECTS_KEY = 'stalliq_guest_projects_v1';
const ACTIVE_PROJECT_KEY = 'stalliq_active_project_v1';

function readGuestProjects(): Record<string, PlannerSnapshot> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(GUEST_PROJECTS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, Record<string, unknown>>;
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Record<string, PlannerSnapshot> = {};
    for (const [id, data] of Object.entries(parsed)) {
      if (!data || typeof data !== 'object') continue;
      const hydrated = hydrateWorkspaceSnapshot(data);
      out[id] = {
        ...hydrated,
        projectMeta: {
          ...(hydrated.projectMeta || {
            id,
            name: hydrated.eventName || 'My Project',
            type: 'exhibition_stall',
            status: 'ongoing',
            createdAtMs: Date.now(),
            updatedAtMs: Date.now(),
          }),
          id,
        },
      };
    }
    return out;
  } catch {
    return {};
  }
}

function writeGuestProjects(map: Record<string, PlannerSnapshot>) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(GUEST_PROJECTS_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage quota errors
  }
}

function readStoredActiveProjectId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(ACTIVE_PROJECT_KEY);
  } catch {
    return null;
  }
}

function writeStoredActiveProjectId(id: string | null) {
  if (typeof window === 'undefined') return;
  try {
    if (id) window.localStorage.setItem(ACTIVE_PROJECT_KEY, id);
    else window.localStorage.removeItem(ACTIVE_PROJECT_KEY);
  } catch {
    // Ignore
  }
}

function readCachedUserState(uid: string): {
  profile: UserProfile | null;
  memories: AiMemoryItem[];
  workspaces: Record<string, PlannerSnapshot>;
} | null {
  if (typeof window === 'undefined' || !uid) return null;
  try {
    const raw = window.localStorage.getItem(`stalliq_user_cache_v1_${uid}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      profile?: UserProfile;
      memories?: AiMemoryItem[];
      workspaces?: Record<string, Record<string, unknown>>;
    };
    const workspaces: Record<string, PlannerSnapshot> = {};
    for (const [id, data] of Object.entries(parsed?.workspaces || {})) {
      if (data && typeof data === 'object') {
        workspaces[id] = hydrateWorkspaceSnapshot(data);
      }
    }
    return {
      profile: parsed?.profile || null,
      memories: Array.isArray(parsed?.memories) ? parsed.memories : [],
      workspaces,
    };
  } catch {
    return null;
  }
}

function writeCachedUserState(
  uid: string,
  payload: {
    profile?: UserProfile | null;
    memories?: AiMemoryItem[];
    workspaces?: Record<string, PlannerSnapshot>;
  }
) {
  if (typeof window === 'undefined' || !uid) return;
  try {
    const prev = readCachedUserState(uid);
    const next = {
      profile: payload.profile !== undefined ? payload.profile : prev?.profile || null,
      memories: payload.memories !== undefined ? payload.memories : prev?.memories || [],
      workspaces: payload.workspaces !== undefined ? payload.workspaces : prev?.workspaces || {},
    };
    window.localStorage.setItem(`stalliq_user_cache_v1_${uid}`, JSON.stringify(next));
  } catch {
    // Ignore quota errors
  }
}

function summarizeWorkspace(id: string, snap: PlannerSnapshot): ProjectSummary {
  const resolved = resolveCategoryGroups(snap.categoryGroups || []);
  let totalBudget = 0;
  let totalStockCost = 0;
  let totalPieces = 0;
  resolved.forEach(({ group, activeCombo }) => {
    totalBudget += group.budgetCap;
    if (activeCombo) {
      totalStockCost += activeCombo.cost;
      totalPieces += activeCombo.pieces;
    }
  });
  const meta = snap.projectMeta;
  return {
    id,
    name: meta?.name || snap.eventName || 'My Project',
    type: meta?.type || 'exhibition_stall',
    description: meta?.description,
    status: meta?.status || 'ongoing',
    eventName: snap.eventName,
    eventLocation: snap.eventLocation,
    totalBudget,
    totalStockCost,
    totalPieces,
    createdAtMs: meta?.createdAtMs || Date.now(),
    updatedAtMs: meta?.updatedAtMs || Date.now(),
  };
}

export interface CreateProjectInput {
  type: ProjectType;
  eventName: string;
  projectName: string;
  expectedFootfall?: number;
  stallFee?: number;
  eventLocation?: string;
  eventDate?: string;
}

interface AuthContextValue {
  authReady: boolean;
  workspacesReady: boolean;
  isFirebaseConfigured: boolean;
  configError: string | null;
  user: User | null;
  profile: UserProfile | null;
  memories: AiMemoryItem[];
  accountContext: AccountAiContext | undefined;
  syncStatus: CloudSyncStatus;
  authError: string | null;
  signingIn: boolean;
  projects: ProjectSummary[];
  activeProjectId: string | null;
  activeProjectSnapshot: PlannerSnapshot | null;
  needsProjectSetup: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  retryCloudSync: () => Promise<void>;
  updateMerchantProfile: (updates: {
    preferredName: string;
    businessName: string;
    preferredScale: string;
  }) => Promise<void>;
  addMemory: (fact: string, category: AiMemoryCategory, source: 'voice' | 'command' | 'manual') => Promise<void>;
  addMemoriesBatch: (items: AiMemoryAddition[], source: 'voice' | 'command' | 'manual') => Promise<void>;
  editMemory: (memoryId: string, updates: { fact: string; category: AiMemoryCategory }) => Promise<void>;
  removeMemory: (memoryId: string) => Promise<void>;
  clearAllMemories: () => Promise<void>;
  createProjectFromSetup: (input: CreateProjectInput) => Promise<PlannerSnapshot>;
  switchProject: (projectId: string) => void;
  updateProjectMeta: (
    projectId: string,
    patch: { name?: string; status?: ProjectStatus; type?: ProjectType; description?: string }
  ) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  syncWorkspace: (snapshot: PlannerSnapshot) => Promise<void>;
  registerWorkspaceHydrator: (cb: (snapshot: PlannerSnapshot) => void) => void;
  registerWorkspaceResetter: (cb: (opts?: { exitGuest?: boolean }) => void) => void;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authReady, setAuthReady] = useState(!firebaseConfigStatus.isConfigured);
  const [workspacesReady, setWorkspacesReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [memories, setMemories] = useState<AiMemoryItem[]>([]);
  const [syncStatus, setSyncStatus] = useState<CloudSyncStatus>('guest');
  const [authError, setAuthError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  const [workspacesMap, setWorkspacesMap] = useState<Record<string, PlannerSnapshot>>(() =>
    readGuestProjects()
  );
  const [activeProjectId, setActiveProjectId] = useState<string | null>(() => {
    const initial = readGuestProjects();
    const ids = Object.keys(initial);
    if (ids.length === 0) return null;
    const stored = readStoredActiveProjectId();
    if (stored && initial[stored]) return stored;
    return ids.sort(
      (a, b) => (initial[b].projectMeta?.updatedAtMs || 0) - (initial[a].projectMeta?.updatedAtMs || 0)
    )[0];
  });

  const hydratorRef = useRef<((snapshot: PlannerSnapshot) => void) | null>(null);
  const resetterRef = useRef<((opts?: { exitGuest?: boolean }) => void) | null>(null);
  const lastLoadedUidRef = useRef<string | null>(null);
  const activeProjectIdRef = useRef<string | null>(activeProjectId);

  useEffect(() => {
    activeProjectIdRef.current = activeProjectId;
  }, [activeProjectId]);

  const registerWorkspaceHydrator = useCallback((cb: (snapshot: PlannerSnapshot) => void) => {
    hydratorRef.current = cb;
  }, []);

  const registerWorkspaceResetter = useCallback(
    (cb: (opts?: { exitGuest?: boolean }) => void) => {
      resetterRef.current = cb;
    },
    []
  );

  const pickBestProjectId = useCallback((map: Record<string, PlannerSnapshot>): string | null => {
    const ids = Object.keys(map);
    if (ids.length === 0) return null;
    const stored = readStoredActiveProjectId();
    if (stored && map[stored]) return stored;
    const ongoing = ids.filter((id) => (map[id].projectMeta?.status || 'ongoing') === 'ongoing');
    const pool = ongoing.length > 0 ? ongoing : ids;
    return pool.sort(
      (a, b) => (map[b].projectMeta?.updatedAtMs || 0) - (map[a].projectMeta?.updatedAtMs || 0)
    )[0];
  }, []);

  const hydrateForUser = useCallback(
    async (targetUser: User) => {
      setSyncStatus('loading');
      setWorkspacesReady(false);
      setAuthError(null);

      if (!targetUser.emailVerified) {
        setProfile({
          uid: targetUser.uid,
          email: targetUser.email || '',
          displayName: targetUser.displayName || 'Merchant',
          preferredName: '',
          photoURL: targetUser.photoURL || '',
          businessName: '',
          preferredScale: 'Exhibition Stall',
        });
        setMemories([]);
        const localMap = readGuestProjects();
        setWorkspacesMap(localMap);
        const picked = pickBestProjectId(localMap);
        setActiveProjectId(picked);
        if (picked && localMap[picked]) {
          hydratorRef.current?.(localMap[picked]);
        }
        setSyncStatus('error');
        setWorkspacesReady(true);
        setAuthError(
          'Your Google account email is not marked verified, so cloud saves are paused. Verify your email or continue in local preview.'
        );
        return;
      }

      const cached = readCachedUserState(targetUser.uid);
      if (cached && Object.keys(cached.workspaces).length > 0 && typeof navigator !== 'undefined' && !navigator.onLine) {
        setProfile(
          cached.profile || {
            uid: targetUser.uid,
            email: targetUser.email || '',
            displayName: targetUser.displayName || 'Merchant',
            preferredName: '',
            photoURL: targetUser.photoURL || '',
            businessName: '',
            preferredScale: 'Exhibition Stall',
          }
        );
        setMemories(cached.memories);
        setWorkspacesMap(cached.workspaces);
        const picked = pickBestProjectId(cached.workspaces);
        setActiveProjectId(picked);
        writeStoredActiveProjectId(picked);
        if (picked && cached.workspaces[picked]) {
          hydratorRef.current?.(cached.workspaces[picked]);
        }
        setSyncStatus('saved');
        setWorkspacesReady(true);
        return;
      }

      try {
        const [loadedProfile, loadedMemories, allWorkspaces] = await Promise.all([
          ensureUserProfile(targetUser),
          loadAiMemories(targetUser.uid),
          loadAllUserWorkspaces(targetUser.uid),
        ]);
        setProfile(loadedProfile);
        setMemories(loadedMemories);
        setWorkspacesMap(allWorkspaces);
        writeCachedUserState(targetUser.uid, {
          profile: loadedProfile,
          memories: loadedMemories,
          workspaces: allWorkspaces,
        });
        const picked = pickBestProjectId(allWorkspaces);
        setActiveProjectId(picked);
        writeStoredActiveProjectId(picked);
        if (picked && allWorkspaces[picked]) {
          hydratorRef.current?.(allWorkspaces[picked]);
        } else {
          resetterRef.current?.();
        }
        setSyncStatus('saved');
      } catch (err) {
        if (cached && Object.keys(cached.workspaces).length > 0) {
          setProfile(
            cached.profile || {
              uid: targetUser.uid,
              email: targetUser.email || '',
              displayName: targetUser.displayName || 'Merchant',
              preferredName: '',
              photoURL: targetUser.photoURL || '',
              businessName: '',
              preferredScale: 'Exhibition Stall',
            }
          );
          setMemories(cached.memories);
          setWorkspacesMap(cached.workspaces);
          const picked = pickBestProjectId(cached.workspaces);
          setActiveProjectId(picked);
          if (picked && cached.workspaces[picked]) {
            hydratorRef.current?.(cached.workspaces[picked]);
          }
          setSyncStatus('saved');
        } else {
          const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
          setSyncStatus('error');
          setAuthError(formatAuthOrSyncError(err, hostname));
        }
      } finally {
        setWorkspacesReady(true);
      }
    },
    [pickBestProjectId]
  );

  useEffect(() => {
    if (!firebaseConfigStatus.isConfigured || !auth) {
      setAuthReady(true);
      setWorkspacesReady(true);
      return;
    }

    let resolvedInitialAuth = false;
    const failsafeTimer = window.setTimeout(() => {
      if (!resolvedInitialAuth) {
        setAuthReady(true);
        setWorkspacesReady(true);
      }
    }, 2000);

    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      resolvedInitialAuth = true;
      window.clearTimeout(failsafeTimer);

      if (!nextUser) {
        const hadSignedInUser = Boolean(lastLoadedUidRef.current);
        lastLoadedUidRef.current = null;
        setUser(null);
        setProfile(null);
        setMemories([]);
        setSyncStatus('guest');
        if (hadSignedInUser) {
          writeStoredActiveProjectId(null);
          resetterRef.current?.({ exitGuest: true });
        }
        const guestMap = readGuestProjects();
        setWorkspacesMap(guestMap);
        const picked = pickBestProjectId(guestMap);
        setActiveProjectId(picked);
        if (picked && guestMap[picked]) {
          hydratorRef.current?.(guestMap[picked]);
        } else if (!hadSignedInUser) {
          resetterRef.current?.({ exitGuest: false });
        }
        setAuthReady(true);
        setWorkspacesReady(true);
        return;
      }

      if (lastLoadedUidRef.current && lastLoadedUidRef.current !== nextUser.uid) {
        writeStoredActiveProjectId(null);
        resetterRef.current?.({ exitGuest: true });
      }
      lastLoadedUidRef.current = nextUser.uid;
      setUser(nextUser);
      await hydrateForUser(nextUser);
      setAuthReady(true);
    });

    return () => {
      window.clearTimeout(failsafeTimer);
      unsub();
    };
  }, [hydrateForUser, pickBestProjectId]);

  const signInWithGoogle = useCallback(async () => {
    if (!firebaseConfigStatus.isConfigured || !auth || !googleProvider) {
      setAuthError(
        firebaseConfigStatus.configError ||
          'Firebase Authentication is not configured for this environment.'
      );
      return;
    }
    setSigningIn(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        return;
      }
      const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
      setAuthError(formatAuthOrSyncError(err, hostname));
    } finally {
      setSigningIn(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setAuthError(null);
    lastLoadedUidRef.current = null;
    writeStoredActiveProjectId(null);
    setProfile(null);
    setMemories([]);
    setSyncStatus('guest');
    resetterRef.current?.({ exitGuest: true });
    const guestMap = readGuestProjects();
    setWorkspacesMap(guestMap);
    const picked = pickBestProjectId(guestMap);
    setActiveProjectId(picked);
    if (picked && guestMap[picked]) {
      hydratorRef.current?.(guestMap[picked]);
    }
    if (auth) {
      await signOut(auth);
    }
  }, [pickBestProjectId]);

  const retryCloudSync = useCallback(async () => {
    if (!user) return;
    await hydrateForUser(user);
  }, [user, hydrateForUser]);

  const updateMerchantProfile = useCallback(
    async (updates: { preferredName: string; businessName: string; preferredScale: string }) => {
      if (!user) return;
      setSyncStatus('saving');
      setAuthError(null);
      try {
        await updateBusinessProfile(user.uid, updates);
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                preferredName: clampStr(updates.preferredName, BLUEPRINT_LIMITS.MAX_PREFERRED_NAME_LEN, ''),
                businessName: clampStr(updates.businessName, BLUEPRINT_LIMITS.MAX_BUSINESS_NAME_LEN, ''),
                preferredScale:
                  clampStr(updates.preferredScale, BLUEPRINT_LIMITS.MAX_PREFERRED_SCALE_LEN, '') ||
                  prev.preferredScale,
              }
            : prev
        );
        setSyncStatus('saved');
      } catch (err) {
        setSyncStatus('error');
        setAuthError(formatAuthOrSyncError(err));
      }
    },
    [user]
  );

  const addMemory = useCallback(
    async (fact: string, category: AiMemoryCategory, source: 'voice' | 'command' | 'manual') => {
      if (!user) return;
      const normalized = fact.trim().toLowerCase();
      if (!normalized) return;
      const duplicate = memories.some((m) => m.fact.trim().toLowerCase() === normalized);
      if (duplicate) return;

      setSyncStatus('saving');
      try {
        const created = await addAiMemory(user.uid, { fact, category, source });
        if (created) {
          setMemories((prev) => [created, ...prev].slice(0, 40));
        }
        setSyncStatus('saved');
      } catch (err) {
        setSyncStatus('error');
        setAuthError(formatAuthOrSyncError(err));
      }
    },
    [user, memories]
  );

  const addMemoriesBatch = useCallback(
    async (items: AiMemoryAddition[], source: 'voice' | 'command' | 'manual') => {
      if (!user || items.length === 0) return;
      const existingSet = new Set(memories.map((m) => m.fact.trim().toLowerCase()));
      const fresh = items.filter((item) => {
        const k = item.fact.trim().toLowerCase();
        if (!k || existingSet.has(k)) return false;
        existingSet.add(k);
        return true;
      });
      if (fresh.length === 0) return;

      setSyncStatus('saving');
      try {
        const createdList = await Promise.all(
          fresh.map((item) =>
            addAiMemory(user.uid, {
              fact: item.fact,
              category: item.category,
              source,
            })
          )
        );
        const valid = createdList.filter((x): x is AiMemoryItem => Boolean(x));
        if (valid.length > 0) {
          setMemories((prev) => [...valid, ...prev].slice(0, 40));
        }
        setSyncStatus('saved');
      } catch (err) {
        setSyncStatus('error');
        setAuthError(formatAuthOrSyncError(err));
      }
    },
    [user, memories]
  );

  const editMemory = useCallback(
    async (memoryId: string, updates: { fact: string; category: AiMemoryCategory }) => {
      if (!user) return;
      setSyncStatus('saving');
      try {
        const saved = await updateAiMemory(user.uid, memoryId, updates);
        if (saved) {
          setMemories((prev) =>
            prev.map((m) =>
              m.id === memoryId
                ? {
                    ...m,
                    fact: saved.fact,
                    category: saved.category,
                    updatedAtMs: saved.updatedAtMs,
                  }
                : m
            )
          );
        }
        setSyncStatus('saved');
      } catch (err) {
        setSyncStatus('error');
        setAuthError(formatAuthOrSyncError(err));
      }
    },
    [user]
  );

  const removeMemory = useCallback(
    async (memoryId: string) => {
      if (!user) return;
      setSyncStatus('saving');
      try {
        await deleteAiMemory(user.uid, memoryId);
        setMemories((prev) => prev.filter((m) => m.id !== memoryId));
        setSyncStatus('saved');
      } catch (err) {
        setSyncStatus('error');
        setAuthError(formatAuthOrSyncError(err));
      }
    },
    [user]
  );

  const clearAllMemories = useCallback(async () => {
    if (!user) return;
    setSyncStatus('saving');
    try {
      await clearAllAiMemories(user.uid);
      setMemories([]);
      setSyncStatus('saved');
    } catch (err) {
      setSyncStatus('error');
      setAuthError(formatAuthOrSyncError(err));
    }
  }, [user]);

  const createProjectFromSetup = useCallback(
    async (input: CreateProjectInput): Promise<PlannerSnapshot> => {
      const snap = createEmptyProjectSnapshot({
        projectName: input.projectName,
        eventName: input.eventName,
        type: input.type,
        expectedFootfall: input.expectedFootfall,
        stallFee: input.stallFee,
        eventLocation: input.eventLocation,
        eventDate: input.eventDate,
      });
      const projectId = snap.projectMeta!.id;

      setWorkspacesMap((prev) => {
        const nextMap = { ...prev, [projectId]: snap };
        if (!user || !user.emailVerified) {
          writeGuestProjects(nextMap);
        }
        return nextMap;
      });
      setActiveProjectId(projectId);
      activeProjectIdRef.current = projectId;
      writeStoredActiveProjectId(projectId);
      hydratorRef.current?.(snap);

      if (user && user.emailVerified) {
        setSyncStatus('saving');
        try {
          await saveUserWorkspace(user.uid, projectId, snap);
          setSyncStatus('saved');
        } catch (err) {
          setSyncStatus('error');
          setAuthError(formatAuthOrSyncError(err));
        }
      }

      return snap;
    },
    [user]
  );

  const switchProject = useCallback(
    (projectId: string) => {
      const target = workspacesMap[projectId];
      if (!target) return;
      setActiveProjectId(projectId);
      activeProjectIdRef.current = projectId;
      writeStoredActiveProjectId(projectId);
      hydratorRef.current?.(target);
    },
    [workspacesMap]
  );

  const updateProjectMeta = useCallback(
    async (
      projectId: string,
      patch: { name?: string; status?: ProjectStatus; type?: ProjectType; description?: string }
    ) => {
      const target = workspacesMap[projectId];
      if (!target) return;
      const updatedSnap: PlannerSnapshot = {
        ...target,
        projectMeta: {
          ...(target.projectMeta || {
            id: projectId,
            name: target.eventName || 'My Project',
            type: 'exhibition_stall',
            status: 'ongoing',
            createdAtMs: Date.now(),
            updatedAtMs: Date.now(),
          }),
          ...(patch.name !== undefined ? { name: clampStr(patch.name, 100, target.eventName) || target.eventName } : {}),
          ...(patch.status !== undefined ? { status: patch.status } : {}),
          ...(patch.type !== undefined ? { type: patch.type } : {}),
          ...(patch.description !== undefined ? { description: clampStr(patch.description, 240) } : {}),
          updatedAtMs: Date.now(),
        },
      };

      setWorkspacesMap((prev) => {
        const nextMap = { ...prev, [projectId]: updatedSnap };
        if (!user || !user.emailVerified) {
          writeGuestProjects(nextMap);
        }
        return nextMap;
      });

      if (projectId === activeProjectIdRef.current) {
        hydratorRef.current?.(updatedSnap);
      }

      if (user && user.emailVerified) {
        setSyncStatus('saving');
        try {
          await saveUserWorkspace(user.uid, projectId, updatedSnap);
          setSyncStatus('saved');
        } catch (err) {
          setSyncStatus('error');
          setAuthError(formatAuthOrSyncError(err));
        }
      }
    },
    [user, workspacesMap]
  );

  const deleteProject = useCallback(
    async (projectId: string) => {
      if (!workspacesMap[projectId]) return;
      const nextMap = { ...workspacesMap };
      delete nextMap[projectId];
      setWorkspacesMap(nextMap);

      if (!user || !user.emailVerified) {
        writeGuestProjects(nextMap);
      }

      if (projectId === activeProjectIdRef.current) {
        const nextId = pickBestProjectId(nextMap);
        setActiveProjectId(nextId);
        activeProjectIdRef.current = nextId;
        writeStoredActiveProjectId(nextId);
        if (nextId && nextMap[nextId]) {
          hydratorRef.current?.(nextMap[nextId]);
        } else {
          resetterRef.current?.({ exitGuest: false });
        }
      }

      if (user && user.emailVerified) {
        setSyncStatus('saving');
        try {
          await deleteUserWorkspace(user.uid, projectId);
          setSyncStatus('saved');
        } catch (err) {
          setSyncStatus('error');
          setAuthError(formatAuthOrSyncError(err));
        }
      }
    },
    [user, workspacesMap, pickBestProjectId]
  );

  const syncWorkspace = useCallback(
    async (snapshot: PlannerSnapshot) => {
      const targetId = snapshot.projectMeta?.id || activeProjectIdRef.current;
      if (!targetId) return;

      const stamped: PlannerSnapshot = {
        ...snapshot,
        projectMeta: {
          ...(snapshot.projectMeta || {
            id: targetId,
            name: snapshot.eventName || 'My Project',
            type: 'exhibition_stall',
            status: 'ongoing',
            setupCompleted: true,
            createdAtMs: Date.now(),
            updatedAtMs: Date.now(),
          }),
          id: targetId,
          updatedAtMs: Date.now(),
        },
      };

      setWorkspacesMap((prev) => {
        const nextMap = { ...prev, [targetId]: stamped };
        if (!user || !user.emailVerified) {
          writeGuestProjects(nextMap);
        } else {
          writeCachedUserState(user.uid, { workspaces: nextMap });
        }
        return nextMap;
      });

      if (!user || !user.emailVerified) return;

      setSyncStatus('saving');
      try {
        await saveUserWorkspace(user.uid, targetId, stamped);
        setSyncStatus('saved');
      } catch (err) {
        setSyncStatus('error');
        setAuthError(formatAuthOrSyncError(err));
      }
    },
    [user]
  );

  const projects = useMemo<ProjectSummary[]>(() => {
    return Object.entries(workspacesMap)
      .map(([id, snap]) => summarizeWorkspace(id, snap))
      .sort((a, b) => b.updatedAtMs - a.updatedAtMs);
  }, [workspacesMap]);

  const activeProjectSnapshot = useMemo<PlannerSnapshot | null>(() => {
    if (!activeProjectId) return null;
    return workspacesMap[activeProjectId] || null;
  }, [activeProjectId, workspacesMap]);

  const needsProjectSetup = workspacesReady && projects.length === 0;

  const accountContext: AccountAiContext | undefined = useMemo(() => {
    if (!user || !profile) return undefined;
    const activeSummary = projects.find((p) => p.id === activeProjectId);
    return {
      preferredName: resolvePreferredName(profile),
      displayName: profile.displayName,
      businessName: profile.businessName || undefined,
      preferredScale: profile.preferredScale || undefined,
      activeProjectId: activeSummary?.id,
      activeProjectName: activeSummary?.name,
      activeProjectType: activeSummary?.type,
      otherProjects: projects
        .filter((p) => p.id !== activeProjectId)
        .slice(0, 8)
        .map((p) => ({
          id: p.id,
          name: p.name,
          type: p.type,
          status: p.status,
          eventName: p.eventName,
        })),
      memories: memories.slice(0, 20).map((m) => ({
        fact: m.fact,
        category: m.category,
      })),
    };
  }, [user, profile, memories, projects, activeProjectId]);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      authReady,
      workspacesReady,
      isFirebaseConfigured: firebaseConfigStatus.isConfigured,
      configError: firebaseConfigStatus.configError,
      user,
      profile,
      memories,
      accountContext,
      syncStatus,
      authError,
      signingIn,
      projects,
      activeProjectId,
      activeProjectSnapshot,
      needsProjectSetup,
      signInWithGoogle,
      logout,
      retryCloudSync,
      updateMerchantProfile,
      addMemory,
      addMemoriesBatch,
      editMemory,
      removeMemory,
      clearAllMemories,
      createProjectFromSetup,
      switchProject,
      updateProjectMeta,
      deleteProject,
      syncWorkspace,
      registerWorkspaceHydrator,
      registerWorkspaceResetter,
      clearAuthError,
    }),
    [
      authReady,
      workspacesReady,
      user,
      profile,
      memories,
      accountContext,
      syncStatus,
      authError,
      signingIn,
      projects,
      activeProjectId,
      activeProjectSnapshot,
      needsProjectSetup,
      signInWithGoogle,
      logout,
      retryCloudSync,
      updateMerchantProfile,
      addMemory,
      addMemoriesBatch,
      editMemory,
      removeMemory,
      clearAllMemories,
      createProjectFromSetup,
      switchProject,
      updateProjectMeta,
      deleteProject,
      syncWorkspace,
      registerWorkspaceHydrator,
      registerWorkspaceResetter,
      clearAuthError,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
