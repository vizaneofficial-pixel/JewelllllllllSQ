import React, { useMemo } from 'react';
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, TrendingUp } from 'lucide-react';
import type { DailySalesReport, PaymentMethod } from '../../types/stall';
import { PAYMENT_METHOD_LABELS, formatInr } from '../../utils/liveSellingEngine';

interface LiveAnalyticsViewProps {
  report: DailySalesReport;
}

const PAYMENT_KEYS: PaymentMethod[] = ['upi', 'cash', 'card', 'other', 'unrecorded'];

export function LiveAnalyticsView({ report }: LiveAnalyticsViewProps) {
  const productChartData = useMemo(
    () =>
      report.productReport.slice(0, 6).map((p) => ({
        name: p.productName.length > 12 ? `${p.productName.slice(0, 11)}…` : p.productName,
        revenue: Math.round(p.revenue),
        profit: Math.round(p.realizedGrossProfit),
      })),
    [report.productReport]
  );

  const discountRatePct =
    report.originalSalesValue > 0
      ? Math.round((report.totalDiscounts / report.originalSalesValue) * 100)
      : 0;

  return (
    <div className="space-y-4">
      {/* Live Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="rounded-2xl bg-[#13111C] border border-[#252136] p-3.5">
          <div className="text-[11px] text-[#9D95B8]">Actual Revenue</div>
          <div className="font-mono tabular-nums text-xl font-bold text-[#F5F3FA] mt-1">
            {formatInr(report.actualRevenue)}
          </div>
          <div className="text-[11px] text-[#8C84A6] font-mono tabular-nums mt-0.5">
            {report.transactionCount} bills · {report.totalUnitsSold} pcs
          </div>
        </div>

        <div className="rounded-2xl bg-[#13111C] border border-[#252136] p-3.5">
          <div className="text-[11px] text-[#9D95B8]">Realized Gross Profit</div>
          <div
            className={`font-mono tabular-nums text-xl font-bold mt-1 ${
              report.realizedGrossProfit >= 0 ? 'text-[#34D399]' : 'text-[#FB7185]'
            }`}
          >
            {report.realizedGrossProfit >= 0 ? '+' : ''}
            {formatInr(report.realizedGrossProfit)}
          </div>
          <div className="text-[11px] text-[#8C84A6] font-mono tabular-nums mt-0.5">
            COGS {formatInr(report.costOfGoodsSold)}
          </div>
        </div>

        <div className="rounded-2xl bg-[#13111C] border border-[#252136] p-3.5">
          <div className="text-[11px] text-[#9D95B8]">Discounts Given</div>
          <div className="font-mono tabular-nums text-xl font-bold text-[#F59E0B] mt-1">
            {formatInr(report.totalDiscounts)}
          </div>
          <div className="text-[11px] text-[#8C84A6] font-mono tabular-nums mt-0.5">
            {discountRatePct}% off list ({formatInr(report.averageDiscountPerUnit)}/pc)
          </div>
        </div>

        <div className="rounded-2xl bg-[#13111C] border border-[#252136] p-3.5">
          <div className="text-[11px] text-[#9D95B8]">Avg Transaction</div>
          <div className="font-mono tabular-nums text-xl font-bold text-[#C4B5FD] mt-1">
            {formatInr(report.averageTransactionValue)}
          </div>
          <div className="text-[11px] text-[#8C84A6] font-mono tabular-nums mt-0.5">
            Tracked stock left: {report.remainingTrackedStockUnits}
          </div>
        </div>
      </div>

      {/* Product Performance Chart */}
      {productChartData.length > 0 ? (
        <section className="rounded-3xl bg-[#13111C] border border-[#252136] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#A78BFA]" />
              <h3 className="font-display text-sm font-bold text-[#F5F3FA]">
                Top Products (Revenue vs Gross Profit)
              </h3>
            </div>
            <TrendingUp className="w-4 h-4 text-[#34D399]" />
          </div>

          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={productChartData}
                margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
              >
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#9D95B8', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#8C84A6', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
                />
                <Tooltip
                  formatter={(v) => formatInr(Number(v) || 0)}
                  contentStyle={{
                    backgroundColor: '#13111C',
                    border: '1px solid #322C47',
                    borderRadius: '12px',
                    fontSize: '12px',
                    color: '#F5F3FA',
                  }}
                />
                <Bar dataKey="revenue" name="Revenue" fill="#8B5CF6" radius={[6, 6, 0, 0]} />
                <Bar dataKey="profit" name="Gross Profit" fill="#34D399" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      ) : (
        <div className="rounded-3xl bg-[#13111C] border border-[#252136] p-8 text-center text-xs text-[#9D95B8]">
          Record sales in the Sell tab to view real-time product &amp; category charts.
        </div>
      )}

      {/* Payment Breakdown + Category Split */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <section className="rounded-3xl bg-[#13111C] border border-[#252136] p-4 space-y-2.5">
          <h3 className="font-display text-sm font-bold text-[#F5F3FA]">
            Payment Breakdown
          </h3>
          <div className="space-y-2">
            {PAYMENT_KEYS.map((pm) => {
              const bucket = report.paymentBreakdown[pm];
              const sharePct =
                report.actualRevenue > 0
                  ? Math.round((bucket.revenue / report.actualRevenue) * 100)
                  : 0;
              return (
                <div
                  key={pm}
                  className="flex items-center justify-between text-xs rounded-xl bg-[#0E0C15] border border-[#221E33] px-3 py-2"
                >
                  <div>
                    <span className="font-semibold text-[#F5F3FA]">
                      {PAYMENT_METHOD_LABELS[pm]}
                    </span>
                    <span className="text-[#8C84A6] ml-1.5">({bucket.count} bills)</span>
                  </div>
                  <div className="font-mono tabular-nums text-right">
                    <span className="font-bold text-[#F5F3FA]">
                      {formatInr(bucket.revenue)}
                    </span>
                    <span className="text-[11px] text-[#9D95B8] ml-1.5">{sharePct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-3xl bg-[#13111C] border border-[#252136] p-4 space-y-2.5">
          <h3 className="font-display text-sm font-bold text-[#F5F3FA]">
            Category Contribution
          </h3>
          {report.categoryReport.length === 0 ? (
            <p className="text-xs text-[#9D95B8]">No category sales yet.</p>
          ) : (
            <div className="space-y-2">
              {report.categoryReport.map((c) => (
                <div
                  key={c.categoryName}
                  className="flex items-center justify-between text-xs rounded-xl bg-[#0E0C15] border border-[#221E33] px-3 py-2"
                >
                  <div>
                    <div className="font-semibold text-[#F5F3FA]">{c.categoryName}</div>
                    <div className="text-[11px] text-[#8C84A6]">
                      {c.unitsSold} pcs · Disc {formatInr(c.totalDiscount)}
                    </div>
                  </div>
                  <div className="text-right font-mono tabular-nums">
                    <div className="font-bold text-[#F5F3FA]">{formatInr(c.revenue)}</div>
                    <div className="text-[11px] text-[#34D399]">
                      +{formatInr(c.realizedGrossProfit)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
