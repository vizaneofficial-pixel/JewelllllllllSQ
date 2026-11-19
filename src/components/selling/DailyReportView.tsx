import React, { useMemo, useState } from 'react';
import {
  CalendarCheck,
  Check,
  Copy,
  Download,
  Lock,
  WifiOff,
} from 'lucide-react';
import type {
  DailySalesReport,
  LiveSellingSession,
  PaymentMethod,
} from '../../types/stall';
import { PAYMENT_METHOD_LABELS, formatInr } from '../../utils/liveSellingEngine';
import { copyTextReliable } from '../../utils/orderAndProjectEngine';

interface DailyReportViewProps {
  projectName: string;
  eventTotalExpenses: number;
  sessions: LiveSellingSession[];
  activeSessionId: string;
  selectedSessionId: string;
  onSelectSessionId: (sessionId: string) => void;
  report: DailySalesReport;
  onCloseCurrentDay: () => {
    closedSession: LiveSellingSession;
    nextSession: LiveSellingSession;
    report: DailySalesReport;
  };
}

const PAYMENT_KEYS: PaymentMethod[] = ['upi', 'cash', 'card', 'other', 'unrecorded'];

export function DailyReportView({
  projectName,
  eventTotalExpenses,
  sessions,
  activeSessionId,
  selectedSessionId,
  onSelectSessionId,
  report,
  onCloseCurrentDay,
}: DailyReportViewProps) {
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);

  const selectedSession =
    sessions.find((s) => s.id === selectedSessionId) ||
    sessions.find((s) => s.id === activeSessionId);

  const isViewingOpenSession =
    selectedSession?.id === activeSessionId && selectedSession?.status === 'open';

  const closedSessions = useMemo(
    () => sessions.filter((s) => s.status === 'closed'),
    [sessions]
  );

  const handleCopySummary = async () => {
    const lines = [
      `StallIQ Daily Sales Report — ${projectName}`,
      `Session: ${report.sessionLabel} (${report.dateKey})`,
      `Units Sold: ${report.totalUnitsSold} pcs across ${report.transactionCount} bills`,
      `Original Sales Value: ${formatInr(report.originalSalesValue)}`,
      `Discounts Given: -${formatInr(report.totalDiscounts)}`,
      `Actual Revenue Collected: ${formatInr(report.actualRevenue)}`,
      `Cost of Goods Sold (COGS): ${formatInr(report.costOfGoodsSold)}`,
      `Realized Gross Profit: ${formatInr(report.realizedGrossProfit)}`,
      `Avg Bill: ${formatInr(report.averageTransactionValue)} | Avg Discount/pc: ${formatInr(report.averageDiscountPerUnit)}`,
      `Remaining Tracked Stock: ${report.remainingTrackedStockUnits} pcs (${report.untrackedProductsCount} untracked items)`,
      `Payments: UPI ${formatInr(report.paymentBreakdown.upi.revenue)} | Cash ${formatInr(report.paymentBreakdown.cash.revenue)} | Card ${formatInr(report.paymentBreakdown.card.revenue)} | Not recorded ${formatInr(report.paymentBreakdown.unrecorded.revenue)}`,
    ];
    const ok = await copyTextReliable(lines.join('\n'));
    if (ok) {
      setCopiedSummary(true);
      window.setTimeout(() => setCopiedSummary(false), 2000);
    }
  };

  const handleDownloadCsv = () => {
    const rows = [
      ['Metric', 'Value'],
      ['Project', projectName],
      ['Session', report.sessionLabel],
      ['Date', report.dateKey],
      ['Units Sold', String(report.totalUnitsSold)],
      ['Transactions', String(report.transactionCount)],
      ['Original Sales Value', String(report.originalSalesValue)],
      ['Total Discounts', String(report.totalDiscounts)],
      ['Actual Revenue', String(report.actualRevenue)],
      ['COGS', String(report.costOfGoodsSold)],
      ['Realized Gross Profit', String(report.realizedGrossProfit)],
      ['Average Transaction Value', String(report.averageTransactionValue)],
      ['Average Discount Per Unit', String(report.averageDiscountPerUnit)],
      ['Remaining Tracked Stock Units', String(report.remainingTrackedStockUnits)],
      [],
      ['Product', 'Category', 'Units Sold', 'Original Value', 'Discount', 'Actual Revenue', 'COGS', 'Gross Profit'],
      ...report.productReport.map((p) => [
        `"${p.productName.replace(/"/g, '""')}"`,
        `"${p.categoryName.replace(/"/g, '""')}"`,
        String(p.unitsSold),
        String(p.originalValue),
        String(p.totalDiscount),
        String(p.revenue),
        String(p.cogs),
        String(p.realizedGrossProfit),
      ]),
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stalliq-report-${report.dateKey}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const netAfterEventCosts = report.realizedGrossProfit - eventTotalExpenses;

  return (
    <div className="space-y-4">
      {/* Day Switcher & Close Day Header */}
      <div className="rounded-3xl bg-[#13111C] border border-[#252136] p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display text-sm font-bold text-[#F5F3FA]">
                {report.sessionLabel}
              </h3>
              {selectedSession?.status === 'closed' ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#252136] text-[10px] font-semibold text-[#C4B5FD]">
                  <Lock className="w-2.5 h-2.5" />
                  Closed
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#34D399]/18 text-[10px] font-semibold text-[#34D399]">
                  Active Day
                </span>
              )}
            </div>
            <p className="text-xs text-[#9D95B8] mt-0.5">
              Generated from verified active transactions (excludes reversed &amp; superseded)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleCopySummary()}
              className="min-h-[38px] px-3 rounded-xl bg-[#1A1726] border border-[#2D2744] text-xs font-semibold text-[#DDD7EE] inline-flex items-center gap-1.5"
            >
              {copiedSummary ? (
                <Check className="w-3.5 h-3.5 text-[#34D399]" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-[#A78BFA]" />
              )}
              <span>{copiedSummary ? 'Copied' : 'Copy'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadCsv}
              className="min-h-[38px] px-3 rounded-xl bg-[#1A1726] border border-[#2D2744] text-xs font-semibold text-[#DDD7EE] inline-flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5 text-[#A78BFA]" />
              <span>CSV</span>
            </button>

            {isViewingOpenSession && (
              <button
                type="button"
                onClick={() => setConfirmCloseOpen(true)}
                className="min-h-[38px] px-3.5 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] text-white text-xs font-bold inline-flex items-center gap-1.5"
              >
                <CalendarCheck className="w-3.5 h-3.5" />
                <span>Close Day</span>
              </button>
            )}
          </div>
        </div>

        {/* Multi-day Session Selector Pills */}
        {sessions.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pt-1">
            {sessions.map((s) => {
              const active = s.id === (selectedSession?.id || activeSessionId);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onSelectSessionId(s.id)}
                  className={`shrink-0 min-h-[34px] px-3 rounded-xl text-xs font-semibold border transition-colors ${
                    active
                      ? 'bg-[#8B5CF6]/22 border-[#8B5CF6] text-[#C4B5FD]'
                      : 'bg-[#0E0C15] border-[#252136] text-[#A29BB8]'
                  }`}
                >
                  {s.label} {s.status === 'closed' ? '(Closed)' : '(Open)'}
                </button>
              );
            })}
          </div>
        )}

        {report.pendingSyncCount > 0 && (
          <div className="flex items-center gap-2 rounded-xl bg-[#F59E0B]/12 border border-[#F59E0B]/30 px-3 py-2 text-xs text-[#FCD34D]">
            <WifiOff className="w-3.5 h-3.5 shrink-0" />
            <span>
              {report.pendingSyncCount} local{' '}
              {report.pendingSyncCount === 1 ? 'sale' : 'sales'} waiting to sync — closing day preserves all unsynced records.
            </span>
          </div>
        )}
      </div>

      {/* 10 Core Financial Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        <div className="rounded-2xl bg-[#13111C] border border-[#252136] p-3">
          <div className="text-[11px] text-[#9D95B8]">1. Units Sold</div>
          <div className="font-mono tabular-nums text-lg font-bold text-[#F5F3FA] mt-0.5">
            {report.totalUnitsSold} pcs
          </div>
        </div>

        <div className="rounded-2xl bg-[#13111C] border border-[#252136] p-3">
          <div className="text-[11px] text-[#9D95B8]">2. Transactions</div>
          <div className="font-mono tabular-nums text-lg font-bold text-[#F5F3FA] mt-0.5">
            {report.transactionCount}
          </div>
        </div>

        <div className="rounded-2xl bg-[#13111C] border border-[#252136] p-3">
          <div className="text-[11px] text-[#9D95B8]">3. Original Value</div>
          <div className="font-mono tabular-nums text-lg font-bold text-[#DDD7EE] mt-0.5">
            {formatInr(report.originalSalesValue)}
          </div>
        </div>

        <div className="rounded-2xl bg-[#13111C] border border-[#252136] p-3">
          <div className="text-[11px] text-[#9D95B8]">4. Total Discounts</div>
          <div className="font-mono tabular-nums text-lg font-bold text-[#F59E0B] mt-0.5">
            -{formatInr(report.totalDiscounts)}
          </div>
        </div>

        <div className="rounded-2xl bg-[#13111C] border border-[#8B5CF6]/45 p-3">
          <div className="text-[11px] text-[#C4B5FD]">5. Actual Revenue</div>
          <div className="font-mono tabular-nums text-lg font-bold text-[#F5F3FA] mt-0.5">
            {formatInr(report.actualRevenue)}
          </div>
        </div>

        <div className="rounded-2xl bg-[#13111C] border border-[#252136] p-3">
          <div className="text-[11px] text-[#9D95B8]">6. Cost of Goods (COGS)</div>
          <div className="font-mono tabular-nums text-lg font-bold text-[#DDD7EE] mt-0.5">
            {formatInr(report.costOfGoodsSold)}
          </div>
        </div>

        <div className="rounded-2xl bg-[#13111C] border border-[#34D399]/40 p-3">
          <div className="text-[11px] text-[#6EE7B7]">7. Realized Gross Profit</div>
          <div
            className={`font-mono tabular-nums text-lg font-bold mt-0.5 ${
              report.realizedGrossProfit >= 0 ? 'text-[#34D399]' : 'text-[#FB7185]'
            }`}
          >
            {report.realizedGrossProfit >= 0 ? '+' : ''}
            {formatInr(report.realizedGrossProfit)}
          </div>
        </div>

        <div className="rounded-2xl bg-[#13111C] border border-[#252136] p-3">
          <div className="text-[11px] text-[#9D95B8]">8. Avg Bill / Avg Disc</div>
          <div className="font-mono tabular-nums text-sm font-bold text-[#F5F3FA] mt-1">
            {formatInr(report.averageTransactionValue)} /{' '}
            <span className="text-[#F59E0B]">{formatInr(report.averageDiscountPerUnit)}</span>
          </div>
        </div>

        <div className="rounded-2xl bg-[#13111C] border border-[#252136] p-3">
          <div className="text-[11px] text-[#9D95B8]">9. Reversals in Day</div>
          <div className="font-mono tabular-nums text-lg font-bold text-[#A29BB8] mt-0.5">
            {report.reversedCount}
          </div>
        </div>

        <div className="rounded-2xl bg-[#13111C] border border-[#252136] p-3">
          <div className="text-[11px] text-[#9D95B8]">10. Stock Left (Tracked)</div>
          <div className="font-mono tabular-nums text-lg font-bold text-[#F5F3FA] mt-0.5">
            {report.remainingTrackedStockUnits} pcs
          </div>
          {report.untrackedProductsCount > 0 && (
            <div className="text-[10px] text-[#8C84A6]">
              +{report.untrackedProductsCount} untracked
            </div>
          )}
        </div>
      </div>

      {/* Explicit Accounting Distinction Note */}
      <div className="rounded-2xl bg-[#100E18] border border-[#252136] p-3.5 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="text-[#A29BB8]">
          <strong className="text-[#F5F3FA]">Realized Gross Profit</strong> ({formatInr(report.realizedGrossProfit)}) is Revenue minus Cost of Goods Sold. After project stall/event expenses ({formatInr(eventTotalExpenses)}), this session&apos;s contribution to Net Profit is{' '}
          <strong className={netAfterEventCosts >= 0 ? 'text-[#34D399]' : 'text-[#FB7185]'}>
            {netAfterEventCosts >= 0 ? '+' : ''}
            {formatInr(netAfterEventCosts)}
          </strong>.
        </div>
      </div>

      {/* Product Report + Payment Method Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <section className="rounded-3xl bg-[#13111C] border border-[#252136] p-4 space-y-2.5">
          <h4 className="font-display text-sm font-bold text-[#F5F3FA]">
            Product Breakdown
          </h4>
          {report.productReport.length === 0 ? (
            <p className="text-xs text-[#9D95B8]">No completed sales in this session.</p>
          ) : (
            <div className="space-y-2">
              {report.productReport.map((p) => (
                <div
                  key={`${p.groupId}_${p.productId}`}
                  className="rounded-xl bg-[#0E0C15] border border-[#221E33] px-3 py-2 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-[#F5F3FA] truncate">
                      {p.productName}
                    </div>
                    <div className="text-[11px] text-[#8C84A6]">
                      {p.unitsSold} pcs · Cost {formatInr(p.cogs)}
                      {p.totalDiscount > 0 ? ` · Disc -${formatInr(p.totalDiscount)}` : ''}
                    </div>
                  </div>
                  <div className="text-right font-mono tabular-nums shrink-0">
                    <div className="font-bold text-[#F5F3FA]">{formatInr(p.revenue)}</div>
                    <div className="text-[11px] text-[#34D399]">
                      +{formatInr(p.realizedGrossProfit)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-3xl bg-[#13111C] border border-[#252136] p-4 space-y-2.5">
          <h4 className="font-display text-sm font-bold text-[#F5F3FA]">
            Payment Collection Breakdown
          </h4>
          <div className="space-y-2">
            {PAYMENT_KEYS.map((pm) => {
              const bucket = report.paymentBreakdown[pm];
              return (
                <div
                  key={pm}
                  className="rounded-xl bg-[#0E0C15] border border-[#221E33] px-3 py-2 flex items-center justify-between text-xs"
                >
                  <span className="font-medium text-[#DDD7EE]">
                    {PAYMENT_METHOD_LABELS[pm]} ({bucket.count})
                  </span>
                  <span className="font-mono tabular-nums font-bold text-[#F5F3FA]">
                    {formatInr(bucket.revenue)}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Historical Comparison Table (when multiple sessions exist) */}
      {closedSessions.length > 0 && (
        <section className="rounded-3xl bg-[#13111C] border border-[#252136] p-4 space-y-2.5">
          <h4 className="font-display text-sm font-bold text-[#F5F3FA]">
            Day-by-Day Comparison
          </h4>
          <div className="space-y-1.5">
            {sessions.map((s) => {
              const snap = s.closedReportSnapshot;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onSelectSessionId(s.id)}
                  className="w-full text-left rounded-xl bg-[#0E0C15] border border-[#221E33] px-3 py-2.5 flex items-center justify-between gap-2 text-xs hover:border-[#3A3352]"
                >
                  <div>
                    <div className="font-semibold text-[#F5F3FA]">{s.label}</div>
                    <div className="text-[11px] text-[#8C84A6]">
                      {s.status === 'closed' ? 'Closed' : 'Currently Open'}
                      {s.pendingSyncOnClose ? ' · Sync pending' : ''}
                    </div>
                  </div>
                  {snap ? (
                    <div className="text-right font-mono tabular-nums">
                      <div className="font-bold text-[#F5F3FA]">
                        {formatInr(snap.actualRevenue)} ({snap.totalUnitsSold} pcs)
                      </div>
                      <div className="text-[11px] text-[#34D399]">
                        +{formatInr(snap.realizedGrossProfit)} gross profit
                      </div>
                    </div>
                  ) : (
                    <span className="font-mono tabular-nums text-[#C4B5FD]">
                      {s.id === activeSessionId
                        ? `${formatInr(report.actualRevenue)}`
                        : 'Open report'}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Close Day Confirmation Modal */}
      {confirmCloseOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Close current selling day"
          onClick={() => setConfirmCloseOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-[#13111C] border border-[#322C47] p-5 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 className="font-display text-base font-bold text-[#F5F3FA]">
                Close {selectedSession?.label}?
              </h3>
              <p className="text-xs text-[#A29BB8] mt-1 leading-relaxed">
                This finalizes today&apos;s report snapshot ({formatInr(report.actualRevenue)} across {report.totalUnitsSold} units) and opens a fresh selling day session.
                {report.pendingSyncCount > 0
                  ? ' Your unsynced offline sales stay queued safely and will sync automatically when reconnected.'
                  : ''}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmCloseOpen(false)}
                className="min-h-[46px] rounded-2xl bg-[#1A1726] border border-[#2D2744] text-xs font-semibold text-[#DDD7EE]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onCloseCurrentDay();
                  setConfirmCloseOpen(false);
                }}
                className="min-h-[46px] rounded-2xl bg-[#8B5CF6] text-white text-xs font-bold"
              >
                Close Day &amp; Start Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
