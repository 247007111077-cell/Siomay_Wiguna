import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { IngredientMaster, MonthlyTrendPoint } from '../types/inventory';
import { formatNumber } from '../utils/format';

interface MonthlyTrendChartProps {
  data: MonthlyTrendPoint[];
  ingredients: IngredientMaster[];
}

type AggregationMode = 'total' | 'daily_avg';

interface BarChartRow {
  monthKey: string;
  monthShort: string;
  monthFull: string;
  activeDays: number;
  salesValue: number;
  salesMoMPct: number | null;
  ikanValue?: number;
  ikanMoMPct?: number | null;
  dagingValue?: number;
  dagingMoMPct?: number | null;
  singleValue?: number;
  singleMoMPct?: number | null;
}

function formatMoMText(pct: number | null | undefined): string {
  if (pct === null || pct === undefined) return 'Bulan dasar';
  const sign = pct > 0 ? '+' : '';
  return `${sign}${formatNumber(pct, 1)}% MoM`;
}

function momColorClass(pct: number | null | undefined): string {
  if (pct === null || pct === undefined) return 'text-[#6B5E55]';
  if (pct > 0) return 'text-[#2D6A4F]';
  if (pct < 0) return 'text-[#B91C1C]';
  return 'text-[#6B5E55]';
}

export function MonthlyTrendChart({ data, ingredients }: MonthlyTrendChartProps) {
  const [selectedBahan, setSelectedBahan] = useState<string>('protein_utama');
  const [aggMode, setAggMode] = useState<AggregationMode>('total');

  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-[#E6DDD2] bg-[#FAF7F2]/60 p-6 text-center text-sm text-[#6B5E55]">
        Belum ada riwayat transaksi bulanan untuk menampilkan Analisis Tren Bulanan.
      </div>
    );
  }

  const isProteinPair = selectedBahan === 'protein_utama';
  const activeIngredient = ingredients.find((i) => i.nama === selectedBahan);
  const unitLabel = isProteinPair ? 'kg' : activeIngredient?.satuan || '';

  const rows: BarChartRow[] = data.map((m, idx) => {
    const prev = idx > 0 ? data[idx - 1] : null;
    const divCurr = aggMode === 'daily_avg' ? Math.max(1, m.activeDays) : 1;
    const divPrev = prev && aggMode === 'daily_avg' ? Math.max(1, prev.activeDays) : 1;

    const salesValue = Math.round((m.salesVolume / divCurr) * 10) / 10;
    const prevSalesValue = prev ? prev.salesVolume / divPrev : 0;
    const salesMoMPct =
      aggMode === 'total'
        ? m.salesMoMPct
        : prev && prevSalesValue > 0
          ? Math.round(((salesValue - prevSalesValue) / prevSalesValue) * 1000) / 10
          : null;

    if (isProteinPair) {
      const ikanRaw = m.ingredientsUsage['Ikan tenggiri'] || 0;
      const dagingRaw = m.ingredientsUsage['Daging sapi'] || 0;
      const ikanValue = Math.round((ikanRaw / divCurr) * 100) / 100;
      const dagingValue = Math.round((dagingRaw / divCurr) * 100) / 100;

      const prevIkan = prev ? (prev.ingredientsUsage['Ikan tenggiri'] || 0) / divPrev : 0;
      const prevDaging = prev ? (prev.ingredientsUsage['Daging sapi'] || 0) / divPrev : 0;

      return {
        monthKey: m.monthKey,
        monthShort: m.monthShort,
        monthFull: m.monthFull,
        activeDays: m.activeDays,
        salesValue,
        salesMoMPct,
        ikanValue,
        ikanMoMPct:
          aggMode === 'total'
            ? m.ingredientsMoMPct['Ikan tenggiri'] ?? null
            : prev && prevIkan > 0
              ? Math.round(((ikanValue - prevIkan) / prevIkan) * 1000) / 10
              : null,
        dagingValue,
        dagingMoMPct:
          aggMode === 'total'
            ? m.ingredientsMoMPct['Daging sapi'] ?? null
            : prev && prevDaging > 0
              ? Math.round(((dagingValue - prevDaging) / prevDaging) * 1000) / 10
              : null,
      };
    }

    const singleRaw = m.ingredientsUsage[selectedBahan] || 0;
    const singleValue = Math.round((singleRaw / divCurr) * 100) / 100;
    const prevSingle = prev ? (prev.ingredientsUsage[selectedBahan] || 0) / divPrev : 0;

    return {
      monthKey: m.monthKey,
      monthShort: m.monthShort,
      monthFull: m.monthFull,
      activeDays: m.activeDays,
      salesValue,
      salesMoMPct,
      singleValue,
      singleMoMPct:
        aggMode === 'total'
          ? m.ingredientsMoMPct[selectedBahan] ?? null
          : prev && prevSingle > 0
            ? Math.round(((singleValue - prevSingle) / prevSingle) * 1000) / 10
            : null,
    };
  });

  const latest = rows[rows.length - 1];
  const totalDaysRecorded = rows.reduce((sum, r) => sum + r.activeDays, 0);

  return (
    <div className="space-y-5">
      {/* Header & Kontrol */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-base font-semibold text-[#1F1A17]">
            Analisis Tren Bulanan (Month-over-Month)
          </h3>
          <p className="text-xs text-[#6B5E55]">
            Perbandingan volume penjualan ekivalen prasmanan dan penggunaan bahan baku utama antarbulan
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1 rounded-lg bg-[#FAF7F2] p-1">
            <button
              type="button"
              onClick={() => setAggMode('total')}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                aggMode === 'total'
                  ? 'bg-white text-[#1F1A17] shadow-xs'
                  : 'text-[#6B5E55] hover:text-[#1F1A17]'
              }`}
            >
              Total Bulanan
            </button>
            <button
              type="button"
              onClick={() => setAggMode('daily_avg')}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                aggMode === 'daily_avg'
                  ? 'bg-white text-[#1F1A17] shadow-xs'
                  : 'text-[#6B5E55] hover:text-[#1F1A17]'
              }`}
            >
              Rata-rata / Hari
            </button>
          </div>

          <select
            value={selectedBahan}
            onChange={(e) => setSelectedBahan(e.target.value)}
            aria-label="Pilih bahan baku utama untuk analisis tren bulanan"
            className="min-h-[36px] rounded-lg border border-[#E6DDD2] bg-white px-3 py-1.5 text-xs font-medium text-[#1F1A17] focus:border-[#C24E2B] focus:outline-none"
          >
            <option value="protein_utama">Ikan tenggiri &amp; Daging sapi (kg)</option>
            {ingredients.map((ing) => (
              <option key={ing.id} value={ing.nama}>
                {ing.nama} ({ing.satuan})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Ringkasan Angka MoM Bulan Terakhir (Hairline Strip, tanpa kartu bertumpuk) */}
      <div className="grid grid-cols-1 gap-4 border-y border-[#EFE8DE] py-3.5 sm:grid-cols-3">
        <div>
          <div className="text-xs text-[#6B5E55]">
            Volume Penjualan · {latest.monthFull} ({latest.activeDays} hr)
          </div>
          <div className="mt-1 flex flex-wrap items-baseline gap-2.5">
            <span className="font-mono text-lg font-bold tabular-nums text-[#C24E2B]">
              {formatNumber(latest.salesValue, 1)}{' '}
              <span className="font-sans text-xs font-normal text-[#6B5E55]">
                {aggMode === 'daily_avg' ? 'unit/hr' : 'unit'}
              </span>
            </span>
            <span className={`font-mono text-xs font-semibold tabular-nums ${momColorClass(latest.salesMoMPct)}`}>
              {formatMoMText(latest.salesMoMPct)}
            </span>
          </div>
        </div>

        <div>
          <div className="text-xs text-[#6B5E55]">
            {isProteinPair ? 'Pemakaian Ikan Tenggiri' : `Pemakaian ${selectedBahan}`} · {latest.monthShort}
          </div>
          <div className="mt-1 flex flex-wrap items-baseline gap-2.5">
            <span className="font-mono text-lg font-bold tabular-nums text-[#2D6A4F]">
              {formatNumber(isProteinPair ? latest.ikanValue || 0 : latest.singleValue || 0, 2)}{' '}
              <span className="font-sans text-xs font-normal text-[#6B5E55]">
                {aggMode === 'daily_avg' ? `${unitLabel}/hr` : unitLabel}
              </span>
            </span>
            <span
              className={`font-mono text-xs font-semibold tabular-nums ${momColorClass(
                isProteinPair ? latest.ikanMoMPct : latest.singleMoMPct
              )}`}
            >
              {formatMoMText(isProteinPair ? latest.ikanMoMPct : latest.singleMoMPct)}
            </span>
          </div>
        </div>

        <div>
          {isProteinPair ? (
            <>
              <div className="text-xs text-[#6B5E55]">
                Pemakaian Daging Sapi · {latest.monthShort}
              </div>
              <div className="mt-1 flex flex-wrap items-baseline gap-2.5">
                <span className="font-mono text-lg font-bold tabular-nums text-[#B45309]">
                  {formatNumber(latest.dagingValue || 0, 2)}{' '}
                  <span className="font-sans text-xs font-normal text-[#6B5E55]">
                    {aggMode === 'daily_avg' ? 'kg/hr' : 'kg'}
                  </span>
                </span>
                <span
                  className={`font-mono text-xs font-semibold tabular-nums ${momColorClass(latest.dagingMoMPct)}`}
                >
                  {formatMoMText(latest.dagingMoMPct)}
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="text-xs text-[#6B5E55]">Cakupan Riwayat Transaksi</div>
              <div className="mt-1 flex items-baseline gap-2 font-mono tabular-nums">
                <span className="text-lg font-bold text-[#1F1A17]">{rows.length} bulan</span>
                <span className="font-sans text-xs text-[#6B5E55]">
                  ({totalDaysRecorded} hari produksi)
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Grafik Batang Recharts Dual-Axis */}
      <div className="h-76 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={rows}
            margin={{ top: 10, right: 12, left: 0, bottom: 4 }}
            barGap={5}
            barCategoryGap="22%"
          >
            <CartesianGrid stroke="#EFE8DE" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="monthShort"
              tick={{ fill: '#6B5E55', fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: '#E6DDD2' }}
            />
            <YAxis
              yAxisId="sales"
              tick={{ fill: '#C24E2B', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
              tickLine={false}
              axisLine={false}
              width={52}
              label={{
                value: aggMode === 'daily_avg' ? 'Unit/hr' : 'Unit',
                position: 'insideTopLeft',
                offset: 0,
                dy: -6,
                fill: '#C24E2B',
                fontSize: 10,
              }}
            />
            <YAxis
              yAxisId="usage"
              orientation="right"
              tick={{ fill: '#2D6A4F', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
              tickLine={false}
              axisLine={false}
              width={48}
              label={{
                value: aggMode === 'daily_avg' ? `${unitLabel}/hr` : unitLabel,
                position: 'insideTopRight',
                offset: 0,
                dy: -6,
                fill: '#2D6A4F',
                fontSize: 10,
              }}
            />
            <Tooltip
              cursor={{ fill: '#FAF7F2' }}
              content={({ active, payload }) => {
                if (!active || !payload || payload.length === 0) return null;
                const row = payload[0].payload as BarChartRow;

                return (
                  <div className="rounded-lg border border-[#E6DDD2] bg-white px-3.5 py-2.5 text-xs shadow-sm">
                    <div className="font-semibold text-[#1F1A17]">
                      {row.monthFull}{' '}
                      <span className="font-normal text-[#6B5E55]">({row.activeDays} hari aktif)</span>
                    </div>
                    <div className="mt-2 space-y-1.5 font-mono tabular-nums">
                      <div className="flex items-center justify-between gap-5">
                        <span className="font-sans text-[#6B5E55]">Volume Penjualan:</span>
                        <span>
                          <strong className="text-[#C24E2B]">
                            {formatNumber(row.salesValue, 1)} unit
                          </strong>{' '}
                          <span className={`text-[11px] ${momColorClass(row.salesMoMPct)}`}>
                            ({formatMoMText(row.salesMoMPct)})
                          </span>
                        </span>
                      </div>

                      {isProteinPair ? (
                        <>
                          <div className="flex items-center justify-between gap-5">
                            <span className="font-sans text-[#6B5E55]">Ikan tenggiri:</span>
                            <span>
                              <strong className="text-[#2D6A4F]">
                                {formatNumber(row.ikanValue || 0, 2)} kg
                              </strong>{' '}
                              <span className={`text-[11px] ${momColorClass(row.ikanMoMPct)}`}>
                                ({formatMoMText(row.ikanMoMPct)})
                              </span>
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-5">
                            <span className="font-sans text-[#6B5E55]">Daging sapi:</span>
                            <span>
                              <strong className="text-[#B45309]">
                                {formatNumber(row.dagingValue || 0, 2)} kg
                              </strong>{' '}
                              <span className={`text-[11px] ${momColorClass(row.dagingMoMPct)}`}>
                                ({formatMoMText(row.dagingMoMPct)})
                              </span>
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center justify-between gap-5">
                          <span className="font-sans text-[#6B5E55]">{selectedBahan}:</span>
                          <span>
                            <strong className="text-[#2D6A4F]">
                              {formatNumber(row.singleValue || 0, 2)} {unitLabel}
                            </strong>{' '}
                            <span className={`text-[11px] ${momColorClass(row.singleMoMPct)}`}>
                              ({formatMoMText(row.singleMoMPct)})
                            </span>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              }}
            />
            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />

            <Bar
              yAxisId="sales"
              dataKey="salesValue"
              name={
                aggMode === 'daily_avg'
                  ? 'Rata-rata Penjualan (unit/hr)'
                  : 'Volume Penjualan (unit)'
              }
              fill="#C24E2B"
              radius={[4, 4, 0, 0]}
              maxBarSize={36}
            />

            {isProteinPair ? (
              <>
                <Bar
                  yAxisId="usage"
                  dataKey="ikanValue"
                  name={
                    aggMode === 'daily_avg'
                      ? 'Ikan tenggiri (kg/hr)'
                      : 'Ikan tenggiri (kg)'
                  }
                  fill="#2D6A4F"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={36}
                />
                <Bar
                  yAxisId="usage"
                  dataKey="dagingValue"
                  name={
                    aggMode === 'daily_avg'
                      ? 'Daging sapi (kg/hr)'
                      : 'Daging sapi (kg)'
                  }
                  fill="#D97706"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={36}
                />
              </>
            ) : (
              <Bar
                yAxisId="usage"
                dataKey="singleValue"
                name={
                  aggMode === 'daily_avg'
                    ? `${selectedBahan} (${unitLabel}/hr)`
                    : `${selectedBahan} (${unitLabel})`
                }
                fill="#2D6A4F"
                radius={[4, 4, 0, 0]}
                maxBarSize={36}
              />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Tabel Ringkasan Month-over-Month */}
      <div className="overflow-x-auto border-t border-[#EFE8DE] pt-3">
        <table className="w-full min-w-[640px] text-left text-xs">
          <thead className="text-[#6B5E55]">
            <tr className="border-b border-[#EFE8DE]">
              <th className="py-2 pr-4 font-medium">Bulan</th>
              <th className="px-3 py-2 text-right font-medium">Hari Aktif</th>
              <th className="px-3 py-2 text-right font-medium">
                Volume Penjualan ({aggMode === 'daily_avg' ? 'unit/hr' : 'unit'})
              </th>
              <th className="px-3 py-2 text-right font-medium">MoM Penjualan</th>
              <th className="px-3 py-2 text-right font-medium">
                {isProteinPair ? 'Ikan tenggiri (kg)' : `${selectedBahan} (${unitLabel})`}
              </th>
              <th className="px-3 py-2 text-right font-medium">MoM Bahan</th>
              {isProteinPair && (
                <>
                  <th className="px-3 py-2 text-right font-medium">Daging sapi (kg)</th>
                  <th className="py-2 pl-3 text-right font-medium">MoM Daging</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EFE8DE]/70">
            {rows.map((r) => (
              <tr key={r.monthKey} className="hover:bg-[#FAF7F2]/70">
                <td className="py-2 pr-4 font-medium text-[#1F1A17]">{r.monthFull}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-[#6B5E55]">
                  {r.activeDays} hr
                </td>
                <td className="px-3 py-2 text-right font-mono font-semibold tabular-nums text-[#1F1A17]">
                  {formatNumber(r.salesValue, 1)}
                </td>
                <td
                  className={`px-3 py-2 text-right font-mono font-medium tabular-nums ${momColorClass(
                    r.salesMoMPct
                  )}`}
                >
                  {formatMoMText(r.salesMoMPct)}
                </td>
                <td className="px-3 py-2 text-right font-mono font-semibold tabular-nums text-[#1F1A17]">
                  {formatNumber(isProteinPair ? r.ikanValue || 0 : r.singleValue || 0, 2)}
                </td>
                <td
                  className={`px-3 py-2 text-right font-mono font-medium tabular-nums ${momColorClass(
                    isProteinPair ? r.ikanMoMPct : r.singleMoMPct
                  )}`}
                >
                  {formatMoMText(isProteinPair ? r.ikanMoMPct : r.singleMoMPct)}
                </td>
                {isProteinPair && (
                  <>
                    <td className="px-3 py-2 text-right font-mono font-semibold tabular-nums text-[#1F1A17]">
                      {formatNumber(r.dagingValue || 0, 2)}
                    </td>
                    <td
                      className={`py-2 pl-3 text-right font-mono font-medium tabular-nums ${momColorClass(
                        r.dagingMoMPct
                      )}`}
                    >
                      {formatMoMText(r.dagingMoMPct)}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
