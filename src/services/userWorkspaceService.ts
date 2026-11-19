import type { User } from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { OperationType, db, handleFirestoreError } from '../firebase';
import type {
  AiMemoryCategory,
  AiMemoryItem,
  PlannerSnapshot,
  UserProfile,
} from '../types/stall';
import {
  BLUEPRINT_LIMITS,
  clampStr,
  hydrateWorkspaceSnapshot,
  normalizeMemoryCategory,
  sanitizeWorkspaceMutableFields,
} from '../utils/accountHelpers';

export { BLUEPRINT_LIMITS, normalizeMemoryCategory };

function requireDb(operationType: OperationType, path: string) {
  if (!db) {
    handleFirestoreError(new Error('Firebase Firestore is not configured.'), operationType, path);
  }
  return db;
}

export async function ensureUserProfile(user: User): Promise<UserProfile> {
  const path = `users/${user.uid}`;
  const database = requireDb(OperationType.WRITE, path);
  const ref = doc(database, 'users', user.uid);
  const email = clampStr(user.email, BLUEPRINT_LIMITS.MAX_EMAIL_LEN, '');
  const displayName =
    clampStr(user.displayName, BLUEPRINT_LIMITS.MAX_DISPLAY_NAME_LEN, 'Merchant') || 'Merchant';
  const photoURL = clampStr(user.photoURL, BLUEPRINT_LIMITS.MAX_PHOTO_URL_LEN, '');

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      const initialProfile = {
        uid: user.uid,
        email,
        displayName,
        preferredName: '',
        photoURL,
        businessName: '',
        preferredScale: 'Exhibition Stall',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(ref, initialProfile);
      return {
        uid: user.uid,
        email,
        displayName,
        preferredName: '',
        photoURL,
        businessName: '',
        preferredScale: 'Exhibition Stall',
      };
    }

    const existing = snap.data();
    // Action: Sync Google Auth identity fields (exact allowlist in firestore.rules)
    if (
      existing.email !== email ||
      existing.displayName !== displayName ||
      existing.photoURL !== photoURL
    ) {
      await updateDoc(ref, {
        email,
        displayName,
        photoURL,
        updatedAt: serverTimestamp(),
      });
    }

    return {
      uid: user.uid,
      email,
      displayName,
      preferredName: typeof existing.preferredName === 'string' ? existing.preferredName : '',
      photoURL,
      businessName: typeof existing.businessName === 'string' ? existing.businessName : '',
      preferredScale:
        typeof existing.preferredScale === 'string' && existing.preferredScale
          ? existing.preferredScale
          : 'Exhibition Stall',
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function updateBusinessProfile(
  uid: string,
  updates: { preferredName: string; businessName: string; preferredScale: string }
): Promise<void> {
  if (!uid) return;
  const path = `users/${uid}`;
  const database = requireDb(OperationType.UPDATE, path);
  const ref = doc(database, 'users', uid);
  try {
    await updateDoc(ref, {
      preferredName: clampStr(updates.preferredName, BLUEPRINT_LIMITS.MAX_PREFERRED_NAME_LEN, ''),
      businessName: clampStr(updates.businessName, BLUEPRINT_LIMITS.MAX_BUSINESS_NAME_LEN, ''),
      preferredScale:
        clampStr(updates.preferredScale, BLUEPRINT_LIMITS.MAX_PREFERRED_SCALE_LEN, 'Exhibition Stall') ||
        'Exhibition Stall',
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

function sanitizeWorkspaceId(rawId: string): string {
  const cleaned = rawId.trim().replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
  return cleaned || 'active';
}

export async function loadAllUserWorkspaces(
  uid: string
): Promise<Record<string, PlannerSnapshot>> {
  if (!uid) return {};
  const path = `users/${uid}/workspaces`;
  const database = requireDb(OperationType.LIST, path);
  const results: Record<string, PlannerSnapshot> = {};

  try {
    const q = query(
      collection(database, 'users', uid, 'workspaces'),
      where('ownerId', '==', uid),
      limit(30)
    );
    const snap = await getDocs(q);
    snap.docs.forEach((d) => {
      const hydrated = hydrateWorkspaceSnapshot(d.data() as Record<string, unknown>);
      results[d.id] = {
        ...hydrated,
        projectMeta: {
          ...(hydrated.projectMeta || {
            id: d.id,
            name: hydrated.eventName || 'Main Stall Project',
            type: 'exhibition_stall',
            status: 'ongoing',
            createdAtMs: Date.now(),
            updatedAtMs: Date.now(),
          }),
          id: d.id,
        },
      };
    });
    return results;
  } catch (err) {
    // Fallback to direct get on legacy 'active' doc if list index/query hits any issue
    try {
      const legacy = await loadActiveWorkspace(uid);
      if (legacy) {
        return { active: legacy };
      }
    } catch {
      // Throw original error below
    }
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function loadActiveWorkspace(uid: string): Promise<PlannerSnapshot | null> {
  if (!uid) return null;
  const path = `users/${uid}/workspaces/active`;
  const database = requireDb(OperationType.GET, path);
  const ref = doc(database, 'users', uid, 'workspaces', 'active');
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const hydrated = hydrateWorkspaceSnapshot(snap.data() as Record<string, unknown>);
    return {
      ...hydrated,
      projectMeta: {
        ...(hydrated.projectMeta || {
          id: 'active',
          name: hydrated.eventName || 'Main Stall Project',
          type: 'exhibition_stall',
          status: 'ongoing',
          createdAtMs: Date.now(),
          updatedAtMs: Date.now(),
        }),
        id: 'active',
      },
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

export async function saveUserWorkspace(
  uid: string,
  workspaceId: string,
  snapshot: PlannerSnapshot
): Promise<void> {
  if (!uid) return;
  const safeId = sanitizeWorkspaceId(workspaceId);
  const path = `users/${uid}/workspaces/${safeId}`;
  const database = requireDb(OperationType.WRITE, path);
  const ref = doc(database, 'users', uid, 'workspaces', safeId);
  const mutableFields = sanitizeWorkspaceMutableFields({
    ...snapshot,
    projectMeta: {
      ...(snapshot.projectMeta || {
        id: safeId,
        name: snapshot.eventName || 'Main Stall Project',
        type: 'exhibition_stall',
        status: 'ongoing',
        createdAtMs: Date.now(),
        updatedAtMs: Date.now(),
      }),
      id: safeId,
      updatedAtMs: Date.now(),
    },
  });

  try {
    const existing = await getDoc(ref);
    if (!existing.exists()) {
      await setDoc(ref, {
        ownerId: uid,
        ...mutableFields,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        ...mutableFields,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteUserWorkspace(uid: string, workspaceId: string): Promise<void> {
  if (!uid || !workspaceId) return;
  const safeId = sanitizeWorkspaceId(workspaceId);
  const path = `users/${uid}/workspaces/${safeId}`;
  const database = requireDb(OperationType.DELETE, path);
  try {
    await deleteDoc(doc(database, 'users', uid, 'workspaces', safeId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function saveActiveWorkspace(uid: string, snapshot: PlannerSnapshot): Promise<void> {
  return saveUserWorkspace(uid, snapshot.projectMeta?.id || 'active', snapshot);
}

export async function loadAiMemories(uid: string): Promise<AiMemoryItem[]> {
  if (!uid) return [];
  const path = `users/${uid}/aiMemories`;
  const database = requireDb(OperationType.LIST, path);
  try {
    const q = query(
      collection(database, 'users', uid, 'aiMemories'),
      where('ownerId', '==', uid),
      limit(40)
    );
    const snap = await getDocs(q);
    const items: AiMemoryItem[] = snap.docs.map((d) => {
      const data = d.data();
      const createdAtMs =
        typeof data.createdAt?.toMillis === 'function' ? data.createdAt.toMillis() : Date.now();
      const updatedAtMs =
        typeof data.updatedAt?.toMillis === 'function' ? data.updatedAt.toMillis() : createdAtMs;
      return {
        id: d.id,
        ownerId: typeof data.ownerId === 'string' ? data.ownerId : uid,
        fact: typeof data.fact === 'string' ? data.fact : '',
        category: normalizeMemoryCategory(data.category),
        source:
          data.source === 'voice' || data.source === 'command' || data.source === 'manual'
            ? data.source
            : 'manual',
        createdAtMs,
        updatedAtMs,
      };
    });

    return items
      .filter((m) => m.fact.length >= BLUEPRINT_LIMITS.MIN_FACT_LEN)
      .sort((a, b) => b.createdAtMs - a.createdAtMs);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function addAiMemory(
  uid: string,
  entry: { fact: string; category?: string; source: 'voice' | 'command' | 'manual' }
): Promise<AiMemoryItem | null> {
  if (!uid) return null;
  const fact = clampStr(entry.fact, BLUEPRINT_LIMITS.MAX_FACT_LEN, '');
  if (fact.length < BLUEPRINT_LIMITS.MIN_FACT_LEN) return null;

  const category = normalizeMemoryCategory(entry.category);
  const path = `users/${uid}/aiMemories`;
  const database = requireDb(OperationType.CREATE, path);

  try {
    const docRef = await addDoc(collection(database, 'users', uid, 'aiMemories'), {
      ownerId: uid,
      fact,
      category,
      source: entry.source,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    const now = Date.now();
    return {
      id: docRef.id,
      ownerId: uid,
      fact,
      category,
      source: entry.source,
      createdAtMs: now,
      updatedAtMs: now,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function updateAiMemory(
  uid: string,
  memoryId: string,
  updates: { fact: string; category: AiMemoryCategory }
): Promise<{ fact: string; category: AiMemoryCategory; updatedAtMs: number } | null> {
  if (!uid || !memoryId) return null;
  const fact = clampStr(updates.fact, BLUEPRINT_LIMITS.MAX_FACT_LEN, '');
  if (fact.length < BLUEPRINT_LIMITS.MIN_FACT_LEN) return null;

  const category = normalizeMemoryCategory(updates.category);
  const path = `users/${uid}/aiMemories/${memoryId}`;
  const database = requireDb(OperationType.UPDATE, path);

  try {
    await updateDoc(doc(database, 'users', uid, 'aiMemories', memoryId), {
      fact,
      category,
      updatedAt: serverTimestamp(),
    });
    return { fact, category, updatedAtMs: Date.now() };
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function deleteAiMemory(uid: string, memoryId: string): Promise<void> {
  if (!uid || !memoryId) return;
  const path = `users/${uid}/aiMemories/${memoryId}`;
  const database = requireDb(OperationType.DELETE, path);
  try {
    await deleteDoc(doc(database, 'users', uid, 'aiMemories', memoryId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function clearAllAiMemories(uid: string): Promise<void> {
  if (!uid) return;
  const path = `users/${uid}/aiMemories`;
  const database = requireDb(OperationType.DELETE, path);
  try {
    const q = query(
      collection(database, 'users', uid, 'aiMemories'),
      where('ownerId', '==', uid),
      limit(100)
    );
    const snap = await getDocs(q);
    if (snap.empty) return;
    const batch = writeBatch(database);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}
