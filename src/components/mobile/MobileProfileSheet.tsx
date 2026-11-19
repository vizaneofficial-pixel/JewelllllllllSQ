import React, { useEffect, useState } from 'react';
import {
  Brain,
  Check,
  Cloud,
  LogIn,
  LogOut,
  Plus,
  Trash2,
  User,
} from 'lucide-react';
import type { StallWorkspaceController } from '../../hooks/useStallWorkspace';
import type { AiMemoryCategory } from '../../types/stall';
import { PWAInstallButton } from '../PWAInstallButton';
import { MobileBottomSheet } from './MobileBottomSheet';

interface MobileProfileSheetProps {
  isOpen: boolean;
  onClose: () => void;
  workspace: StallWorkspaceController;
}

export function MobileProfileSheet({
  isOpen,
  onClose,
  workspace,
}: MobileProfileSheetProps) {
  const { auth, setGuestMode, showToast } = workspace;
  const {
    user,
    profile,
    memories,
    syncStatus,
    updateMerchantProfile,
    addMemory,
    removeMemory,
    logout,
  } = auth;

  const [preferredName, setPreferredName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [preferredScale, setPreferredScale] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const [memoryFact, setMemoryFact] = useState('');
  const [memoryCat, setMemoryCat] = useState<AiMemoryCategory>('preference');

  useEffect(() => {
    if (!isOpen) return;
    setPreferredName(profile?.preferredName || '');
    setBusinessName(profile?.businessName || '');
    setPreferredScale(profile?.preferredScale || '');
  }, [isOpen, profile]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingProfile(true);
    try {
      await updateMerchantProfile({
        preferredName: preferredName.trim(),
        businessName: businessName.trim(),
        preferredScale: preferredScale.trim(),
      });
      showToast('Profile saved');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = memoryFact.trim();
    if (!clean || !user) return;
    await addMemory(clean, memoryCat, 'manual');
    setMemoryFact('');
    showToast('Saved to AI memory');
  };

  return (
    <MobileBottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Account & Settings"
      subtitle={user ? user.email || 'Signed in' : 'Local preview mode'}
    >
      {/* Account Summary */}
      <div className="rounded-2xl bg-[#1A1726] border border-[#252136] p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {user?.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName || 'Account avatar'}
              className="w-11 h-11 rounded-2xl object-cover border border-[#322C47]"
            />
          ) : (
            <div className="w-11 h-11 rounded-2xl bg-[#8B5CF6]/20 border border-[#8B5CF6]/35 flex items-center justify-center text-[#C4B5FD]">
              <User className="w-5 h-5" />
            </div>
          )}
          <div className="min-w-0">
            <div className="text-sm font-bold text-[#F5F3FA] truncate">
              {profile?.preferredName || user?.displayName || 'Guest Planner'}
            </div>
            <div className="text-xs text-[#9D95B8] flex items-center gap-1.5 mt-0.5">
              <Cloud className="w-3.5 h-3.5 text-[#A78BFA]" />
              <span>
                {user
                  ? syncStatus === 'saving'
                    ? 'Syncing to cloud...'
                    : 'Cloud sync active'
                  : 'Saved on this device only'}
              </span>
            </div>
          </div>
        </div>

        {user ? (
          <button
            type="button"
            onClick={() => {
              onClose();
              void logout();
            }}
            className="min-h-[42px] px-3 rounded-xl bg-[#252136] text-xs font-semibold text-[#FDA4AF] inline-flex items-center gap-1.5 shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign out</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              onClose();
              setGuestMode(false);
            }}
            className="min-h-[42px] px-3.5 rounded-xl bg-[#8B5CF6] text-xs font-semibold text-white inline-flex items-center gap-1.5 shrink-0"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Sign in</span>
          </button>
        )}
      </div>

      {/* PWA Install Card */}
      <PWAInstallButton variant="card" />

      {/* Merchant Profile Form (Signed-in Users) */}
      {user && (
        <form
          onSubmit={(e) => void handleSaveProfile(e)}
          className="rounded-2xl bg-[#161322] border border-[#252136] p-4 space-y-3"
        >
          <h3 className="font-display text-sm font-bold text-[#F5F3FA]">
            Personalization
          </h3>

          <label className="block space-y-1">
            <span className="text-xs text-[#A29BB8]">Preferred Name</span>
            <input
              type="text"
              value={preferredName}
              onChange={(e) => setPreferredName(e.target.value)}
              placeholder="e.g. Ananya"
              className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#0E0C15] border border-[#2A253D] text-sm text-[#F5F3FA]"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs text-[#A29BB8]">Business / Brand Name</span>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="e.g. Zari Studio"
              className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#0E0C15] border border-[#2A253D] text-sm text-[#F5F3FA]"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs text-[#A29BB8]">Typical Stall Scale</span>
            <input
              type="text"
              value={preferredScale}
              onChange={(e) => setPreferredScale(e.target.value)}
              placeholder="e.g. Weekend pop-ups, ₹15,000–₹40,000"
              className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#0E0C15] border border-[#2A253D] text-sm text-[#F5F3FA]"
            />
          </label>

          <button
            type="submit"
            disabled={savingProfile}
            className="w-full min-h-[44px] rounded-xl bg-[#8B5CF6] text-white text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-60"
          >
            <Check className="w-4 h-4" />
            <span>{savingProfile ? 'Saving...' : 'Save Profile'}</span>
          </button>
        </form>
      )}

      {/* AI Memory */}
      {user && (
        <div className="rounded-2xl bg-[#161322] border border-[#252136] p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-[#C4B5FD]" />
            <h3 className="font-display text-sm font-bold text-[#F5F3FA]">
              AI Coach Memory ({memories.length})
            </h3>
          </div>

          <form onSubmit={(e) => void handleAddMemory(e)} className="space-y-2">
            <input
              type="text"
              value={memoryFact}
              onChange={(e) => setMemoryFact(e.target.value)}
              placeholder="e.g. Prefer 3x retail markup on festive bangles"
              className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#0E0C15] border border-[#2A253D] text-sm text-[#F5F3FA]"
            />
            <div className="flex items-center gap-2">
              <select
                aria-label="Memory category"
                value={memoryCat}
                onChange={(e) => setMemoryCat(e.target.value as AiMemoryCategory)}
                className="flex-1 min-h-[42px] px-3 rounded-xl bg-[#0E0C15] border border-[#2A253D] text-xs text-[#DDD7EE]"
              >
                <option value="preference">Preference</option>
                <option value="inventory">Inventory</option>
                <option value="pricing">Pricing</option>
                <option value="event">Event</option>
                <option value="strategy">Strategy</option>
              </select>
              <button
                type="submit"
                className="min-h-[42px] px-4 rounded-xl bg-[#252136] text-[#C4B5FD] text-xs font-semibold inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>
          </form>

          {memories.length > 0 && (
            <div className="space-y-2 pt-1">
              {memories.map((mem) => (
                <div
                  key={mem.id}
                  className="flex items-start justify-between gap-2 rounded-xl bg-[#0E0C15] border border-[#221E33] px-3 py-2.5"
                >
                  <p className="text-xs text-[#DDD7EE] leading-relaxed">{mem.fact}</p>
                  <button
                    type="button"
                    aria-label={`Delete memory ${mem.fact}`}
                    onClick={() => void removeMemory(mem.id)}
                    className="w-8 h-8 rounded-lg text-[#9D95B8] hover:text-[#FB7185] flex items-center justify-center shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </MobileBottomSheet>
  );
}
