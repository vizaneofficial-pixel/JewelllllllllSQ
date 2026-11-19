import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  Gem,
  ShoppingBag,
  Sparkles,
  Store,
  X,
} from 'lucide-react';
import type { CreateProjectInput } from '../context/AuthContext';
import type { ProjectType } from '../types/stall';

const SETUP_DRAFT_KEY = 'stalliq_setup_draft_v1';

interface SetupDraft {
  step: 1 | 2 | 3;
  type: ProjectType;
  eventName: string;
  projectName: string;
  expectedFootfall: string;
  stallFee: string;
}

const DEFAULT_DRAFT: SetupDraft = {
  step: 1,
  type: 'exhibition_stall',
  eventName: '',
  projectName: '',
  expectedFootfall: '',
  stallFee: '',
};

const PROJECT_OPTIONS: Array<{
  id: ProjectType;
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: 'exhibition_stall',
    label: 'Exhibition / Jewellery Stall',
    hint: 'Trade fairs, festive expos, flea markets',
    icon: Gem,
  },
  {
    id: 'popup_shop',
    label: 'Pop-up Shop',
    hint: 'Weekend pop-ups, studio showcases, local events',
    icon: Store,
  },
  {
    id: 'retail_business',
    label: 'Retail Business',
    hint: 'Shop counter, boutique, or seasonal stock buy',
    icon: Building2,
  },
  {
    id: 'custom',
    label: 'Other',
    hint: 'Instagram drop, home trunk show, or custom plan',
    icon: ShoppingBag,
  },
];

interface ProjectSetupWizardProps {
  onComplete: (input: CreateProjectInput) => Promise<void>;
  onCancel?: () => void;
  canCancel?: boolean;
  userGreetingName?: string;
}

function readSavedDraft(): SetupDraft {
  if (typeof window === 'undefined') return DEFAULT_DRAFT;
  try {
    const raw = window.localStorage.getItem(SETUP_DRAFT_KEY);
    if (!raw) return DEFAULT_DRAFT;
    const parsed = JSON.parse(raw) as Partial<SetupDraft>;
    return {
      step: parsed.step === 2 || parsed.step === 3 ? parsed.step : 1,
      type:
        parsed.type === 'popup_shop' ||
        parsed.type === 'retail_business' ||
        parsed.type === 'custom' ||
        parsed.type === 'instagram_store'
          ? parsed.type
          : 'exhibition_stall',
      eventName: typeof parsed.eventName === 'string' ? parsed.eventName : '',
      projectName: typeof parsed.projectName === 'string' ? parsed.projectName : '',
      expectedFootfall: typeof parsed.expectedFootfall === 'string' ? parsed.expectedFootfall : '',
      stallFee: typeof parsed.stallFee === 'string' ? parsed.stallFee : '',
    };
  } catch {
    return DEFAULT_DRAFT;
  }
}

export function ProjectSetupWizard({
  onComplete,
  onCancel,
  canCancel = false,
  userGreetingName,
}: ProjectSetupWizardProps) {
  const [draft, setDraft] = useState<SetupDraft>(() => (canCancel ? DEFAULT_DRAFT : readSavedDraft()));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (canCancel || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(SETUP_DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // Ignore storage errors
    }
  }, [draft, canCancel]);

  const updateDraft = (patch: Partial<SetupDraft>) => {
    setError(null);
    setDraft((prev) => ({ ...prev, ...patch }));
  };

  const handleNext = () => {
    if (draft.step === 1) {
      updateDraft({ step: 2 });
      return;
    }
    if (draft.step === 2) {
      if (!draft.eventName.trim() && !draft.projectName.trim()) {
        setError('Enter your event or business name to continue.');
        return;
      }
      updateDraft({ step: 3 });
    }
  };

  const handleBack = () => {
    setError(null);
    if (draft.step === 2) updateDraft({ step: 1 });
    else if (draft.step === 3) updateDraft({ step: 2 });
  };

  const handleSubmit = async (skipExpectations = false) => {
    const cleanEvent = draft.eventName.trim() || draft.projectName.trim();
    const cleanProject = draft.projectName.trim() || cleanEvent;
    if (!cleanEvent) {
      setError('Enter your event or business name to create your project.');
      updateDraft({ step: 2 });
      return;
    }

    const parsedFootfall =
      !skipExpectations && draft.expectedFootfall.trim()
        ? Math.max(0, Math.round(Number(draft.expectedFootfall) || 0))
        : 0;
    const parsedRent =
      !skipExpectations && draft.stallFee.trim()
        ? Math.max(0, Math.round(Number(draft.stallFee) || 0))
        : 0;

    setSubmitting(true);
    setError(null);
    try {
      await onComplete({
        type: draft.type,
        eventName: cleanEvent,
        projectName: cleanProject,
        expectedFootfall: parsedFootfall,
        stallFee: parsedRent,
      });
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.removeItem(SETUP_DRAFT_KEY);
        } catch {
          // Ignore
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create project right now.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0A10] text-[#F5F3FA] flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-2xl">
        {/* Top Brand + Step Indicator */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#8B5CF6] to-[#5B21B6] flex items-center justify-center shadow-[0_8px_22px_-6px_rgba(139,92,246,0.55)]">
              <Sparkles className="w-4 h-4 text-white" />
            </span>
            <div>
              <div className="font-display text-base font-extrabold tracking-tight text-[#F5F3FA]">
                StallIQ
              </div>
              <div className="text-[11px] text-[#A29BB8]">
                {userGreetingName ? `Welcome, ${userGreetingName}` : 'New project setup'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-mono font-semibold text-[#C4B5FD]">
              {draft.step} of 3
            </span>
            {canCancel && onCancel && (
              <button
                type="button"
                onClick={onCancel}
                aria-label="Cancel new project"
                className="p-1.5 rounded-lg text-[#A29BB8] hover:text-[#F5F3FA] hover:bg-white/5 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          {[1, 2, 3].map((stepNum) => (
            <div
              key={stepNum}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                stepNum <= draft.step
                  ? 'bg-gradient-to-r from-[#8B5CF6] to-[#A78BFA]'
                  : 'bg-[#1D192B]'
              }`}
            />
          ))}
        </div>

        {/* Main Card */}
        <div className="surface-card rounded-2xl p-6 sm:p-8 space-y-6 step-fade-in">
          {draft.step === 1 && (
            <>
              <div className="space-y-1.5">
                <h1 className="font-display text-2xl font-bold text-[#F5F3FA] tracking-tight">
                  What are you planning?
                </h1>
                <p className="text-sm text-[#A29BB8]">
                  Choose the setup that best matches your event or shop.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PROJECT_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const active = draft.type === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => updateDraft({ type: opt.id })}
                      className={`text-left p-4 rounded-xl border transition-all flex items-start gap-3 ${
                        active
                          ? 'bg-[#8B5CF6]/15 border-[#8B5CF6] shadow-[0_0_24px_-10px_rgba(139,92,246,0.6)]'
                          : 'bg-[#13111C] border-[#252136] hover:border-[#3A3352] hover:bg-[#171424]'
                      }`}
                    >
                      <span
                        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                          active
                            ? 'bg-[#8B5CF6] text-white'
                            : 'bg-[#1E1A2E] text-[#A29BB8]'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[#F5F3FA] flex items-center gap-1.5 leading-snug">
                          <span>{opt.label}</span>
                          {active && <Check className="w-3.5 h-3.5 text-[#A78BFA] shrink-0" />}
                        </div>
                        <p className="text-xs text-[#A29BB8] mt-0.5 leading-snug">{opt.hint}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {draft.step === 2 && (
            <>
              <div className="space-y-1.5">
                <h1 className="font-display text-2xl font-bold text-[#F5F3FA] tracking-tight">
                  Name your project
                </h1>
                <p className="text-sm text-[#A29BB8]">
                  Enter your real event or business details. You can change these anytime.
                </p>
              </div>

              <div className="space-y-4">
                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold text-[#D6D1E6]">
                    Event or Business Name
                  </span>
                  <input
                    type="text"
                    autoFocus
                    maxLength={120}
                    value={draft.eventName}
                    onChange={(e) => updateDraft({ eventName: e.target.value })}
                    placeholder="Example: Festive Craft Expo"
                    className="w-full bg-[#0E0C15] border border-[#2E2942] rounded-xl px-4 py-3 text-sm text-[#F5F3FA] placeholder-[#6F6885] focus:outline-none focus:border-[#8B5CF6]"
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold text-[#D6D1E6]">
                    Project Name
                  </span>
                  <input
                    type="text"
                    maxLength={100}
                    value={draft.projectName}
                    onChange={(e) => updateDraft({ projectName: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleNext();
                      }
                    }}
                    placeholder="Example: Diwali Jewellery Stall"
                    className="w-full bg-[#0E0C15] border border-[#2E2942] rounded-xl px-4 py-3 text-sm text-[#F5F3FA] placeholder-[#6F6885] focus:outline-none focus:border-[#8B5CF6]"
                  />
                </label>
              </div>
            </>
          )}

          {draft.step === 3 && (
            <>
              <div className="space-y-1.5">
                <h1 className="font-display text-2xl font-bold text-[#F5F3FA] tracking-tight">
                  Basic expectations
                </h1>
                <p className="text-sm text-[#A29BB8]">
                  Optional — add what you know now, or skip and fill these in later.
                </p>
              </div>

              <div className="space-y-4">
                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold text-[#D6D1E6]">
                    Expected footfall <span className="text-[#78718E] font-normal">(optional)</span>
                  </span>
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={draft.expectedFootfall}
                    onChange={(e) => updateDraft({ expectedFootfall: e.target.value })}
                    placeholder="Example: 2500"
                    className="w-full bg-[#0E0C15] border border-[#2E2942] rounded-xl px-4 py-3 text-sm font-mono text-[#F5F3FA] placeholder-[#6F6885] focus:outline-none focus:border-[#8B5CF6]"
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold text-[#D6D1E6]">
                    Expected stall rent / event cost (₹){' '}
                    <span className="text-[#78718E] font-normal">(optional)</span>
                  </span>
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={draft.stallFee}
                    onChange={(e) => updateDraft({ stallFee: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void handleSubmit(false);
                      }
                    }}
                    placeholder="Example: 5000"
                    className="w-full bg-[#0E0C15] border border-[#2E2942] rounded-xl px-4 py-3 text-sm font-mono text-[#F5F3FA] placeholder-[#6F6885] focus:outline-none focus:border-[#8B5CF6]"
                  />
                </label>
              </div>
            </>
          )}

          {error && (
            <div className="rounded-xl bg-[#FB7185]/10 border border-[#FB7185]/30 px-3.5 py-2.5 text-xs text-[#FDA4AF]">
              {error}
            </div>
          )}

          {/* Footer Controls */}
          <div className="pt-2 flex items-center justify-between gap-3">
            {draft.step > 1 ? (
              <button
                type="button"
                onClick={handleBack}
                disabled={submitting}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#161322] hover:bg-[#1E1A2E] border border-[#2A253D] text-xs font-semibold text-[#D6D1E6] transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2.5">
              {draft.step === 3 && (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void handleSubmit(true)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-[#A29BB8] hover:text-[#F5F3FA] hover:bg-white/5 transition-colors"
                >
                  Skip for now
                </button>
              )}

              {draft.step < 3 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] hover:from-[#7C3AED] hover:to-[#5B21B6] text-white text-xs font-semibold shadow-[0_8px_24px_-6px_rgba(139,92,246,0.55)] transition-all"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void handleSubmit(false)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] hover:from-[#7C3AED] hover:to-[#5B21B6] text-white text-xs font-semibold shadow-[0_8px_24px_-6px_rgba(139,92,246,0.55)] transition-all disabled:opacity-60"
                >
                  <span>{submitting ? 'Creating...' : 'Create Project'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
