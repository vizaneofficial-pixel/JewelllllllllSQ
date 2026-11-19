import React, { useEffect, useState } from 'react';
import {
  Archive,
  BrainCircuit,
  Check,
  CheckCircle2,
  Cloud,
  FolderKanban,
  LogIn,
  LogOut,
  Pencil,
  Plus,
  Store,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { AiMemoryCategory, ProjectStatus } from '../types/stall';
import { PROJECT_STATUS_LABELS, PROJECT_TYPE_LABELS } from '../utils/orderAndProjectEngine';

interface AccountMemoryDrawerProps {
  isOpen: boolean;
  initialTab?: 'projects' | 'profile' | 'memory';
  onClose: () => void;
  onStartNewProject: () => void;
  onOpenLoginScreen?: () => void;
}

const MEMORY_CATEGORIES: Array<{ id: AiMemoryCategory; label: string }> = [
  { id: 'preference', label: 'Preference' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'event', label: 'Event' },
  { id: 'strategy', label: 'Strategy' },
];

export function AccountMemoryDrawer({
  isOpen,
  initialTab = 'projects',
  onClose,
  onStartNewProject,
  onOpenLoginScreen,
}: AccountMemoryDrawerProps) {
  const {
    user,
    profile,
    memories,
    projects,
    activeProjectId,
    syncStatus,
    switchProject,
    updateProjectMeta,
    deleteProject,
    updateMerchantProfile,
    addMemory,
    editMemory,
    removeMemory,
    clearAllMemories,
    logout,
  } = useAuth();

  const [tab, setTab] = useState<'projects' | 'profile' | 'memory'>(initialTab);
  const [statusFilter, setStatusFilter] = useState<'all' | ProjectStatus>('all');
  const [renamingProjectId, setRenamingProjectId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');
  const [confirmDeleteProjectId, setConfirmDeleteProjectId] = useState<string | null>(null);

  const [preferredName, setPreferredName] = useState(profile?.preferredName || '');
  const [businessName, setBusinessName] = useState(profile?.businessName || '');
  const [preferredScale, setPreferredScale] = useState(
    profile?.preferredScale || 'Exhibition Stall'
  );
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  const [newFact, setNewFact] = useState('');
  const [newCategory, setNewCategory] = useState<AiMemoryCategory>('preference');
  const [addingMemory, setAddingMemory] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFact, setEditFact] = useState('');
  const [editCategory, setEditCategory] = useState<AiMemoryCategory>('preference');
  const [savingEdit, setSavingEdit] = useState(false);

  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTab(initialTab);
    } else {
      setEditingId(null);
      setConfirmClearAll(false);
      setRenamingProjectId(null);
      setConfirmDeleteProjectId(null);
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (profile) {
      setPreferredName(profile.preferredName || '');
      setBusinessName(profile.businessName || '');
      setPreferredScale(profile.preferredScale || 'Exhibition Stall');
    }
  }, [profile]);

  if (!isOpen) return null;

  const fallbackFirstName = profile?.displayName?.split(' ')[0] || 'Merchant';
  const filteredProjects =
    statusFilter === 'all' ? projects : projects.filter((p) => p.status === statusFilter);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileSaved(false);
    await updateMerchantProfile({ preferredName, businessName, preferredScale });
    setSavingProfile(false);
    setProfileSaved(true);
    window.setTimeout(() => setProfileSaved(false), 2000);
  };

  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFact.trim() || addingMemory) return;
    setAddingMemory(true);
    await addMemory(newFact.trim(), newCategory, 'manual');
    setNewFact('');
    setAddingMemory(false);
  };

  const handleSaveEdit = async (memoryId: string) => {
    if (!editFact.trim() || savingEdit) return;
    setSavingEdit(true);
    await editMemory(memoryId, { fact: editFact.trim(), category: editCategory });
    setSavingEdit(false);
    setEditingId(null);
  };

  const handleClearAll = async () => {
    if (clearingAll) return;
    setClearingAll(true);
    await clearAllMemories();
    setClearingAll(false);
    setConfirmClearAll(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Projects, Profile and AI Memory"
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div className="w-full max-w-xl surface-glass rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#252136] bg-[#13111C]/90">
          <div className="flex items-center gap-3 min-w-0">
            {user && profile ? (
              <>
                {profile.photoURL ? (
                  <img
                    src={profile.photoURL}
                    alt={profile.displayName}
                    referrerPolicy="no-referrer"
                    className="w-9 h-9 rounded-full border border-[#8B5CF6]/40 object-cover shrink-0"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-[#8B5CF6]/20 border border-[#8B5CF6]/35 flex items-center justify-center text-[#C4B5FD] font-bold text-sm shrink-0">
                    {profile.displayName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-sm font-bold text-[#F5F3FA] truncate">
                    {profile.preferredName || profile.displayName}
                  </div>
                  <div className="text-[11px] text-[#A29BB8] truncate flex items-center gap-1.5">
                    <span>{profile.email}</span>
                    <span>·</span>
                    <span
                      className={`inline-flex items-center gap-1 font-medium ${
                        syncStatus === 'error' ? 'text-[#FB7185]' : 'text-[#34D399]'
                      }`}
                    >
                      <Cloud className="w-3 h-3" />
                      {syncStatus === 'saving'
                        ? 'Syncing...'
                        : syncStatus === 'saved'
                        ? 'Synced'
                        : syncStatus}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div>
                <div className="text-sm font-bold text-[#F5F3FA]">Workspace & Projects</div>
                <div className="text-[11px] text-[#A29BB8]">
                  Saved locally in this browser · Sign in to sync across devices
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close drawer"
            className="p-1.5 rounded-lg text-[#A29BB8] hover:text-[#F5F3FA] hover:bg-white/5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-5 pt-3 pb-2 border-b border-[#252136] flex items-center gap-1.5 bg-[#110F19]">
          <button
            type="button"
            onClick={() => setTab('projects')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              tab === 'projects'
                ? 'bg-[#8B5CF6]/20 text-[#C4B5FD] border border-[#8B5CF6]/40'
                : 'text-[#A29BB8] hover:text-[#F5F3FA]'
            }`}
          >
            <FolderKanban className="w-3.5 h-3.5" />
            <span>Projects ({projects.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('profile')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              tab === 'profile'
                ? 'bg-[#8B5CF6]/20 text-[#C4B5FD] border border-[#8B5CF6]/40'
                : 'text-[#A29BB8] hover:text-[#F5F3FA]'
            }`}
          >
            <Store className="w-3.5 h-3.5" />
            <span>Profile</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('memory')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              tab === 'memory'
                ? 'bg-[#8B5CF6]/20 text-[#C4B5FD] border border-[#8B5CF6]/40'
                : 'text-[#A29BB8] hover:text-[#F5F3FA]'
            }`}
          >
            <BrainCircuit className="w-3.5 h-3.5" />
            <span>AI Memory ({memories.length})</span>
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[72vh] overflow-y-auto">
          {tab === 'projects' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  {(['all', 'ongoing', 'completed', 'archived'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStatusFilter(st)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                        statusFilter === st
                          ? 'bg-[#8B5CF6]/20 text-[#C4B5FD] border border-[#8B5CF6]/35'
                          : 'bg-[#161322] text-[#A29BB8] hover:text-[#F5F3FA]'
                      }`}
                    >
                      {st === 'all' ? 'All' : PROJECT_STATUS_LABELS[st]}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onStartNewProject();
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] hover:from-[#7C3AED] hover:to-[#5B21B6] text-white text-xs font-semibold transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Project</span>
                </button>
              </div>

              <div className="space-y-2.5">
                {filteredProjects.length === 0 ? (
                  <div className="surface-inset rounded-xl p-6 text-center text-xs text-[#A29BB8]">
                    No projects in this view yet.
                  </div>
                ) : (
                  filteredProjects.map((p) => {
                    const isActive = p.id === activeProjectId;
                    const isRenaming = renamingProjectId === p.id;
                    const isConfirmingDelete = confirmDeleteProjectId === p.id;

                    return (
                      <div
                        key={p.id}
                        className={`rounded-xl p-3.5 border transition-colors ${
                          isActive
                            ? 'bg-[#8B5CF6]/10 border-[#8B5CF6]/45'
                            : 'surface-inset border-[#252136]'
                        }`}
                      >
                        {isRenaming ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              autoFocus
                              value={renameText}
                              onChange={(e) => setRenameText(e.target.value)}
                              className="flex-1 bg-[#0E0C15] border border-[#2E2942] rounded-lg px-2.5 py-1.5 text-xs text-[#F5F3FA]"
                            />
                            <button
                              type="button"
                              onClick={async () => {
                                if (renameText.trim()) {
                                  await updateProjectMeta(p.id, { name: renameText.trim() });
                                }
                                setRenamingProjectId(null);
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-[#8B5CF6] text-white text-xs font-semibold"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setRenamingProjectId(null)}
                              className="px-2 py-1.5 text-xs text-[#A29BB8]"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold text-[#F5F3FA] truncate">
                                  {p.name}
                                </span>
                                {isActive && (
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#8B5CF6]/20 text-[#C4B5FD]">
                                    Active
                                  </span>
                                )}
                                <span className="text-[10px] text-[#A29BB8]">
                                  {PROJECT_STATUS_LABELS[p.status]}
                                </span>
                              </div>
                              <div className="text-[11px] text-[#A29BB8]">
                                {PROJECT_TYPE_LABELS[p.type]} · {p.eventName} · {p.totalPieces} pcs · ₹
                                {Math.round(p.totalStockCost).toLocaleString('en-IN')}
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              {!isActive && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    switchProject(p.id);
                                    onClose();
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-[#1A1726] hover:bg-[#252136] text-xs font-semibold text-[#F5F3FA]"
                                >
                                  Open
                                </button>
                              )}
                              <button
                                type="button"
                                title="Rename project"
                                onClick={() => {
                                  setRenamingProjectId(p.id);
                                  setRenameText(p.name);
                                }}
                                className="p-1.5 rounded-lg text-[#78718E] hover:text-[#C4B5FD]"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                title={
                                  p.status === 'completed' ? 'Mark ongoing' : 'Mark completed'
                                }
                                onClick={() =>
                                  void updateProjectMeta(p.id, {
                                    status: p.status === 'completed' ? 'ongoing' : 'completed',
                                  })
                                }
                                className="p-1.5 rounded-lg text-[#78718E] hover:text-[#34D399]"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                title={p.status === 'archived' ? 'Restore' : 'Archive'}
                                onClick={() =>
                                  void updateProjectMeta(p.id, {
                                    status: p.status === 'archived' ? 'ongoing' : 'archived',
                                  })
                                }
                                className="p-1.5 rounded-lg text-[#78718E] hover:text-[#FBBF24]"
                              >
                                <Archive className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                title="Delete project"
                                onClick={() => setConfirmDeleteProjectId(p.id)}
                                className="p-1.5 rounded-lg text-[#78718E] hover:text-[#FB7185]"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        )}

                        {isConfirmingDelete && (
                          <div className="mt-2.5 pt-2.5 border-t border-[#2A253D] flex items-center justify-between gap-2 text-xs">
                            <span className="text-[#FDA4AF]">Delete &ldquo;{p.name}&rdquo; permanently?</span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={async () => {
                                  await deleteProject(p.id);
                                  setConfirmDeleteProjectId(null);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-[#FB7185] text-[#0B0A10] font-semibold"
                              >
                                Delete
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteProjectId(null)}
                                className="px-2 py-1 text-[#A29BB8]"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {tab === 'profile' && (
            <>
              {user && profile ? (
                <form
                  onSubmit={handleSaveProfile}
                  className="space-y-3 surface-inset rounded-xl p-4"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <label className="block text-[11px] text-[#A29BB8]">
                      <span className="block mb-1">Preferred name</span>
                      <input
                        type="text"
                        maxLength={80}
                        value={preferredName}
                        onChange={(e) => setPreferredName(e.target.value)}
                        placeholder={fallbackFirstName}
                        className="w-full bg-[#13111C] border border-[#2E2942] rounded-lg px-2.5 py-1.5 text-xs text-[#F5F3FA] focus:outline-none focus:border-[#8B5CF6]"
                      />
                    </label>
                    <label className="block text-[11px] text-[#A29BB8]">
                      <span className="block mb-1">Brand / shop name</span>
                      <input
                        type="text"
                        maxLength={120}
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        placeholder="Example: Studio Craft House"
                        className="w-full bg-[#13111C] border border-[#2E2942] rounded-lg px-2.5 py-1.5 text-xs text-[#F5F3FA] focus:outline-none focus:border-[#8B5CF6]"
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-end">
                    <label className="block text-[11px] text-[#A29BB8]">
                      <span className="block mb-1">Typical scale</span>
                      <select
                        value={preferredScale}
                        onChange={(e) => setPreferredScale(e.target.value)}
                        className="w-full bg-[#13111C] border border-[#2E2942] rounded-lg px-2.5 py-1.5 text-xs text-[#F5F3FA] focus:outline-none focus:border-[#8B5CF6]"
                      >
                        <option value="Mini Pop-Up">Mini Pop-Up</option>
                        <option value="Exhibition Stall">Exhibition Stall</option>
                        <option value="Retail Business">Retail Business</option>
                        <option value="Mega Expo">Mega Expo</option>
                        <option value="Custom Scale">Custom Scale</option>
                      </select>
                    </label>

                    <div className="flex items-center justify-end">
                      <button
                        type="submit"
                        disabled={savingProfile}
                        className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-semibold transition-colors disabled:opacity-50"
                      >
                        {profileSaved ? <Check className="w-3.5 h-3.5" /> : null}
                        <span>{profileSaved ? 'Saved' : savingProfile ? 'Saving...' : 'Save'}</span>
                      </button>
                    </div>
                  </div>
                </form>
              ) : (
                <div className="surface-inset rounded-xl p-6 text-center space-y-3">
                  <p className="text-xs text-[#A29BB8]">
                    Sign in with Google to save your preferred name, sync projects across devices, and enable private AI memory.
                  </p>
                  {onOpenLoginScreen && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenLoginScreen();
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-semibold"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      <span>Sign in with Google</span>
                    </button>
                  )}
                </div>
              )}
            </>
          )}

          {tab === 'memory' && (
            <>
              {user && profile ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs text-[#A29BB8]">
                      Durable preferences remembered privately for your account.
                    </div>
                    {memories.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        {confirmClearAll ? (
                          <>
                            <button
                              type="button"
                              onClick={handleClearAll}
                              disabled={clearingAll}
                              className="px-2 py-1 rounded-md bg-[#FB7185] text-[#0B0A10] text-[11px] font-semibold"
                            >
                              {clearingAll ? 'Clearing...' : 'Confirm Clear'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmClearAll(false)}
                              className="px-2 py-1 rounded-md bg-[#1A1726] text-[#A29BB8] text-[11px]"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmClearAll(true)}
                            className="text-[11px] text-[#A29BB8] hover:text-[#FB7185]"
                          >
                            Clear all
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <form onSubmit={handleAddMemory} className="flex flex-col sm:flex-row gap-2">
                    <select
                      aria-label="Memory category"
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value as AiMemoryCategory)}
                      className="bg-[#0E0C15] border border-[#2E2942] rounded-xl px-2.5 py-2 text-xs text-[#F5F3FA]"
                    >
                      {MEMORY_CATEGORIES.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      maxLength={500}
                      value={newFact}
                      onChange={(e) => setNewFact(e.target.value)}
                      placeholder="Add preference (e.g., Target 2.5x markup)"
                      className="flex-1 bg-[#0E0C15] border border-[#2E2942] rounded-xl px-3 py-2 text-xs text-[#F5F3FA] placeholder-[#78718E]"
                    />
                    <button
                      type="submit"
                      disabled={!newFact.trim() || addingMemory}
                      className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-[#8B5CF6]/20 hover:bg-[#8B5CF6]/30 text-[#C4B5FD] border border-[#8B5CF6]/35 text-xs font-semibold disabled:opacity-50"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add</span>
                    </button>
                  </form>

                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {memories.length === 0 ? (
                      <div className="surface-inset rounded-xl p-4 text-center text-xs text-[#A29BB8]">
                        No saved preferences yet.
                      </div>
                    ) : (
                      memories.map((m) => (
                        <div key={m.id} className="surface-inset rounded-xl px-3 py-2.5 text-xs">
                          {editingId === m.id ? (
                            <div className="space-y-2">
                              <div className="flex flex-col sm:flex-row gap-2">
                                <select
                                  value={editCategory}
                                  onChange={(e) => setEditCategory(e.target.value as AiMemoryCategory)}
                                  className="bg-[#13111C] border border-[#2E2942] rounded-lg px-2 py-1 text-xs text-[#F5F3FA]"
                                >
                                  {MEMORY_CATEGORIES.map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {c.label}
                                    </option>
                                  ))}
                                </select>
                                <input
                                  type="text"
                                  maxLength={500}
                                  value={editFact}
                                  onChange={(e) => setEditFact(e.target.value)}
                                  className="flex-1 bg-[#13111C] border border-[#2E2942] rounded-lg px-2.5 py-1 text-xs text-[#F5F3FA]"
                                />
                              </div>
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setEditingId(null)}
                                  className="px-2.5 py-1 text-[#A29BB8] text-[11px]"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  disabled={!editFact.trim() || savingEdit}
                                  onClick={() => void handleSaveEdit(m.id)}
                                  className="px-2.5 py-1 rounded-lg bg-[#8B5CF6] text-white font-semibold text-[11px]"
                                >
                                  Save
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start justify-between gap-2.5">
                              <div className="space-y-0.5 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] uppercase tracking-wider font-mono font-semibold text-[#A78BFA]">
                                    {m.category}
                                  </span>
                                  <span className="text-[10px] text-[#78718E]">· {m.source}</span>
                                </div>
                                <p className="text-[#F5F3FA] leading-snug break-words">{m.fact}</p>
                              </div>
                              <div className="flex items-center gap-0.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingId(m.id);
                                    setEditFact(m.fact);
                                    setEditCategory(m.category);
                                  }}
                                  className="text-[#78718E] hover:text-[#C4B5FD] p-1"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void removeMemory(m.id)}
                                  className="text-[#78718E] hover:text-[#FB7185] p-1"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                <div className="surface-inset rounded-xl p-6 text-center space-y-3">
                  <p className="text-xs text-[#A29BB8]">
                    Sign in with Google to save private AI preferences across your projects.
                  </p>
                  {onOpenLoginScreen && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenLoginScreen();
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-semibold"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      <span>Sign in with Google</span>
                    </button>
                  )}
                </div>
              )}
            </>
          )}

          {/* Footer */}
          <div className="pt-2 border-t border-[#252136] flex items-center justify-between">
            {user ? (
              <button
                type="button"
                onClick={async () => {
                  onClose();
                  await logout();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FB7185]/10 hover:bg-[#FB7185]/20 text-[#FDA4AF] border border-[#FB7185]/25 text-xs font-semibold transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign out</span>
              </button>
            ) : (
              <div />
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-[#1A1726] hover:bg-[#231F33] text-[#F5F3FA] border border-[#2E2942] text-xs font-semibold"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
