import React from 'react';
import {
  BarChart3,
  Home,
  Package,
  Sparkles,
  Zap,
} from 'lucide-react';
import { triggerHaptic } from '../../utils/experienceMode';

export type MobileNavTab =
  | 'home'
  | 'stock'
  | 'coach'
  | 'sell'
  | 'stall'
  | 'insights';

interface MobileBottomNavProps {
  activeTab: MobileNavTab;
  onSelect: (tab: MobileNavTab) => void;
  coachLive?: boolean;
}

export function MobileBottomNav({
  activeTab,
  onSelect,
  coachLive = false,
}: MobileBottomNavProps) {
  const handlePress = (tab: MobileNavTab) => {
    triggerHaptic(8);
    onSelect(tab);
  };

  const renderStandardTab = (
    id: Exclude<MobileNavTab, 'coach'>,
    label: string,
    Icon: React.ComponentType<{ className?: string }>
  ) => {
    const active = activeTab === id;
    return (
      <button
        key={id}
        type="button"
        onClick={() => handlePress(id)}
        aria-current={active ? 'page' : undefined}
        aria-label={label}
        className={`flex-1 min-h-[52px] flex flex-col items-center justify-center gap-0.5 rounded-2xl transition-colors active:scale-95 ${
          active ? 'text-[#C4B5FD]' : 'text-[#8C84A6]'
        }`}
      >
        <div
          className={`w-9 h-7 rounded-xl flex items-center justify-center transition-colors ${
            active ? 'bg-[#8B5CF6]/20' : 'bg-transparent'
          }`}
        >
          <Icon className="w-[18px] h-[18px]" />
        </div>
        <span className="text-[10px] font-semibold tracking-tight whitespace-nowrap">
          {label}
        </span>
      </button>
    );
  };

  const coachActive = activeTab === 'coach';

  return (
    <nav
      aria-label="Mobile navigation"
      data-testid="mobile-bottom-nav"
      className="fixed bottom-0 inset-x-0 z-40 bg-[#100E18]/94 backdrop-blur-xl border-t border-[#252136] pb-safe"
    >
      <div className="max-w-lg mx-auto px-2 h-[62px] flex items-center justify-between gap-1">
        {renderStandardTab('home', 'Home', Home)}
        {renderStandardTab('stock', 'Stock', Package)}

        <div className="flex-1 flex justify-center -mt-3">
          <button
            type="button"
            onClick={() => handlePress('coach')}
            aria-current={coachActive ? 'page' : undefined}
            aria-label="AI Coach"
            className={`relative w-[54px] h-[54px] rounded-2xl flex flex-col items-center justify-center gap-0.5 border transition-transform active:scale-95 ${
              coachActive
                ? 'bg-gradient-to-br from-[#9F7AEA] via-[#8B5CF6] to-[#6D28D9] border-[#DDD6FE]/60 text-white shadow-[0_8px_24px_-4px_rgba(139,92,246,0.75)]'
                : 'bg-gradient-to-br from-[#231D38] to-[#171326] border-[#8B5CF6]/45 text-[#C4B5FD] shadow-[0_8px_20px_-6px_rgba(0,0,0,0.7)]'
            }`}
          >
            <Sparkles className="w-5 h-5" />
            <span className="text-[9px] font-bold tracking-tight whitespace-nowrap leading-none">
              Coach
            </span>
            {coachLive && (
              <span
                className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#34D399] ring-2 ring-[#100E18]"
                aria-hidden="true"
              />
            )}
          </button>
        </div>

        {renderStandardTab('sell', 'Sell', Zap)}
        {renderStandardTab('insights', 'Insights', BarChart3)}
      </div>
    </nav>
  );
}
