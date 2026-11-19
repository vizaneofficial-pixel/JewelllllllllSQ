import React from 'react';
import { CheckCircle2, HelpCircle, Loader2, Send, Wand2, X } from 'lucide-react';

interface AiCommandBarProps {
  aiInput: string;
  onAiInputChange: (val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  aiLoading: boolean;
  aiFeedback: string;
  aiClarification: string | null;
  aiError: string | null;
  preferredName?: string;
  onDismissBanner?: () => void;
}

export function AiCommandBar({
  aiInput,
  onAiInputChange,
  onSubmit,
  aiLoading,
  aiFeedback,
  aiClarification,
  aiError,
  preferredName,
  onDismissBanner,
}: AiCommandBarProps) {
  const showBanner = Boolean(aiError || aiClarification || aiFeedback);

  return (
    <section
      aria-label="Smart AI Command Bar"
      className="bg-white border border-[#D9E2DC] rounded-2xl px-3.5 py-2.5 space-y-2 shadow-[0_1px_2px_rgba(19,32,30,0.04)]"
    >
      <form
        onSubmit={onSubmit}
        className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
      >
        <div className="flex items-center gap-1.5 text-[#0F5E54] text-xs font-semibold shrink-0">
          <Wand2 className="w-3.5 h-3.5" />
          <span>{preferredName ? `Quick AI · ${preferredName}` : 'Quick AI'}</span>
        </div>

        <input
          type="text"
          aria-label="Enter natural language rules or stock updates"
          value={aiInput}
          onChange={(e) => onAiInputChange(e.target.value)}
          placeholder='e.g. "Budget 4500 and open overview", "Stall rent 7500", "Open playbook"'
          className="flex-1 bg-[#FAF8F3] border border-[#D9E2DC] focus:border-[#0F5E54] rounded-xl px-3 py-1.5 text-xs text-[#13201E] placeholder-[#5B6D68] focus:outline-none"
        />

        <button
          type="submit"
          disabled={aiLoading}
          className="flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#0F5E54] hover:bg-[#0B4B43] disabled:opacity-60 text-white font-semibold text-xs whitespace-nowrap shrink-0 transition-colors"
        >
          {aiLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
          <span>{aiLoading ? 'Working...' : 'Apply'}</span>
        </button>
      </form>

      {showBanner && (
        <div
          role={aiError ? 'alert' : 'status'}
          className={`flex items-center justify-between gap-2 rounded-xl px-3 py-1.5 text-xs border ${
            aiError
              ? 'bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]'
              : aiClarification
              ? 'bg-[#FFFBEB] border-[#F59E0B]/40 text-[#92400E]'
              : 'bg-[#E7F3EF] border-[#0F5E54]/25 text-[#0F5E54]'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {aiClarification ? (
              <HelpCircle className="w-3.5 h-3.5 text-[#B45309] shrink-0" />
            ) : !aiError ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-[#0F5E54] shrink-0" />
            ) : null}
            <span className="truncate sm:whitespace-normal font-medium">
              {aiError || aiClarification || aiFeedback}
            </span>
          </div>
          {onDismissBanner && (
            <button
              type="button"
              onClick={onDismissBanner}
              aria-label="Dismiss AI message"
              className="text-[#465853] hover:text-[#13201E] p-0.5 shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </section>
  );
}
