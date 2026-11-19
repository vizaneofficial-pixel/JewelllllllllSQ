import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface MobileBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function MobileBottomSheet({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
}: MobileBottomSheetProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/72 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="mobile-sheet-enter w-full max-w-lg max-h-[88dvh] flex flex-col rounded-t-[28px] bg-[#13111C] border-t border-x border-[#322C47] shadow-[0_-18px_50px_rgba(0,0,0,0.75)] pb-safe"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-2.5 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-[#3A3352]" aria-hidden="true" />
        </div>

        <div className="flex items-start justify-between gap-3 px-5 pt-2 pb-3 border-b border-[#252136] shrink-0">
          <div className="min-w-0">
            <h2 className="font-display text-base font-bold text-[#F5F3FA] truncate">
              {title}
            </h2>
            {subtitle && (
              <p className="text-xs text-[#A29BB8] mt-0.5 truncate">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={`Close ${title}`}
            className="w-11 h-11 -mr-1.5 -mt-1 rounded-2xl bg-[#1A1726] border border-[#252136] text-[#A29BB8] hover:text-[#F5F3FA] flex items-center justify-center shrink-0 active:scale-95 transition-transform"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {children}
        </div>

        {footer && (
          <div className="px-5 pt-3 pb-4 border-t border-[#252136] shrink-0 bg-[#13111C]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
