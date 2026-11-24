import { Fragment, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
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
import type {
  SupplierDeliveryRecord,
  SupplierPerformanceSummary,
} from '../types/inventory';
import { formatNumber, formatTanggalId } from '../utils/format';
import { IngredientThumb } from './IngredientThumb';

interface SupplierPerformancePanelProps {
  suppliers: SupplierPerformanceSummary[];
  deliveries: SupplierDeliveryRecord[];
}

type CategoryFilter = 'semua' | 'Segar Harian' | 'Gudang PH';

function shortSupplierName(name: string): string {
  return name
    .replace('Lapak Bahari Cikurubuk', 'Lapak Bahari')
    .replace('Kios Daging Sapi Jaya', 'Kios Sapi Jaya')
    .replace('Pabrik Tahu Galunggung', 'Tahu Galunggung')
    .replace('Bandar Sayur Cikurubuk', 'Bandar Sayur')
    .replace('Agen Telur & Pangsit Priangan', 'Agen Priangan')
    .replace('Distributor Gudang PH Tasik', 'Gudang PH Tasik');
}

export function SupplierPerformancePanel({
  suppliers,
  deliveries,
}: SupplierPerformancePanelProps) {
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('semua');
  const [expandedSupplier, setExpandedSupplier] = useState<string | null>(null);

  if (suppliers.length === 0) {
    return (
      <section className="rounded-xl border border-[#E6DDD2] bg-white p-6">
        <h2 className="text-base font-semibold text-[#1F1A17]">
          Evaluasi Kinerja Pemasok
        </h2>
        <div className="mt-4 flex h-44 items-center justify-center rounded-lg border border-dashed border-[#E6DDD2] bg-[#FAF7F2]/60 p-6 text-center text-sm text-[#6B5E55]">
          Belum ada catatan riwayat pengiriman pemasok pada file state.
        </div>
      </section>
    );
  }

  const filteredSuppliers = suppliers.filter((s) =>
    categoryFilter === 'semua' ? true : s.kategori === categoryFilter
  );

  const totalDeliveries = filteredSuppliers.reduce((sum, s) => sum + s.totalPengiriman, 0);
  const weightedActual =
    totalDeliveries > 0
      ? filteredSuppliers.reduce(
          (sum, s) => sum + s.rataRataLeadTimeAktual * s.totalPengiriman,
          0
        ) / totalDeliveries
      : 0;
  const weightedTarget =
    totalDeliveries > 0
      ? filteredSuppliers.reduce(
          (sum, s) => sum + s.rataRataLeadTimeTarget * s.totalPengiriman,
          0
        ) / totalDeliveries
      : 0;
  const weightedOtd =
    totalDeliveries > 0
      ? filteredSuppliers.reduce(
          (sum, s) => sum + s.ketepatanWaktuPct * s.totalPengiriman,
          0
        ) / totalDeliveries
      : 0;

  const needAttentionCount = filteredSuppliers.filter(
    (s) => s.statusKinerja !== 'Andal'
  ).length;

  const chartData = filteredSuppliers.map((s) => ({
    pemasokFull: s.pemasok,
    pemasokShort: shortSupplierName(s.pemasok),
    bahanUtama: s.bahanUtama.join(', '),
    aktualTerbaru: s.leadTimeAktualTerbaru,
    rataRataAktual: s.rataRataLeadTimeAktual,
    targetSla: s.rataRataLeadTimeTarget,
    ketepatanPct: s.ketepatanWaktuPct,
    totalPengiriman: s.totalPengiriman,
  }));

  return (
    <section
      aria-label="Evaluasi kinerja pemasok bahan baku utama"
      className="space-y-5 rounded-xl border border-[#E6DDD2] bg-white p-6"
    >
      {/* Header & Filter Kategori */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-base font-semibold text-[#1F1A17]">
            Evaluasi Kinerja Pemasok
          </h2>
          <p className="mt-0.5 text-xs text-[#6B5E55]">
            Metrik lead time aktual vs rata-rata historis dan target SLA per pemasok bahan baku utama
          </p>
        </div>

        <div className="flex items-center gap-1 self-start rounded-lg bg-[#FAF7F2] p-1 lg:self-auto">
          {(
            [
              { id: 'semua', label: 'Semua Pemasok' },
              { id: 'Segar Harian', label: 'Segar Harian' },
              { id: 'Gudang PH', label: 'Gudang PH' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setCategoryFilter(tab.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                categoryFilter === tab.id
                  ? 'bg-white text-[#1F1A17] shadow-xs'
                  : 'text-[#6B5E55] hover:text-[#1F1A17]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Ringkasan Metrik Historis (Hairline Strip) */}
      <div className="grid grid-cols-1 gap-4 border-y border-[#EFE8DE] py-3.5 sm:grid-cols-3">
        <div>
          <div className="text-xs text-[#6B5E55]">Riwayat Pengiriman Tercatat</div>
          <div className="mt-1 flex items-baseline gap-2 font-mono tabular-nums">
            <span className="text-lg font-bold text-[#1F1A17]">
              {totalDeliveries} pengiriman
            </span>
            <span className="font-sans text-xs text-[#6B5E55]">
              dari {filteredSuppliers.length} pemasok
            </span>
          </div>
        </div>

        <div>
          <div className="text-xs text-[#6B5E55]">
            Rata-rata Lead Time Aktual vs Target
          </div>
          <div className="mt-1 flex flex-wrap items-baseline gap-2 font-mono tabular-nums">
            <span className="text-lg font-bold text-[#C24E2B]">
              {formatNumber(weightedActual, 2)} hari
            </span>
            <span className="font-sans text-xs text-[#6B5E55]">
              vs target {formatNumber(weightedTarget, 2)} hr (
              {weightedActual - weightedTarget > 0 ? '+' : ''}
              {formatNumber(weightedActual - weightedTarget, 2)} hr)
            </span>
          </div>
        </div>

        <div>
          <div className="text-xs text-[#6B5E55]">Ketepatan Waktu Pengiriman (OTD)</div>
          <div className="mt-1 flex flex-wrap items-baseline gap-2 font-mono tabular-nums">
            <span
              className={`text-lg font-bold ${
                weightedOtd >= 85
                  ? 'text-[#2D6A4F]'
                  : weightedOtd >= 70
                    ? 'text-[#B45309]'
                    : 'text-[#B91C1C]'
              }`}
            >
              {formatNumber(weightedOtd, 1)}%
            </span>
            <span className="font-sans text-xs text-[#6B5E55]">
              · {needAttentionCount > 0 ? `${needAttentionCount} pemasok perlu dipantau` : 'Seluruh pemasok andal'}
            </span>
          </div>
        </div>
      </div>

      {/* Grafik Perbandingan Lead Time Aktual vs Rata-rata per Pemasok */}
      <div className="h-68 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 10, right: 14, left: 0, bottom: 4 }}
            barGap={4}
            barCategoryGap="20%"
          >
            <CartesianGrid stroke="#EFE8DE" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="pemasokShort"
              tick={{ fill: '#6B5E55', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: '#E6DDD2' }}
            />
            <YAxis
              tick={{ fill: '#6B5E55', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
              tickLine={false}
              axisLine={false}
              width={44}
              allowDecimals={true}
              label={{
                value: 'Hari',
                position: 'insideTopLeft',
                offset: 0,
                dy: -6,
                fill: '#6B5E55',
                fontSize: 10,
              }}
            />
            <Tooltip
              cursor={{ fill: '#FAF7F2' }}
              content={({ active, payload }) => {
                if (!active || !payload || payload.length === 0) return null;
                const row = payload[0].payload as (typeof chartData)[number];
                return (
                  <div className="rounded-lg border border-[#E6DDD2] bg-white px-3.5 py-2.5 text-xs shadow-sm">
                    <div className="font-semibold text-[#1F1A17]">{row.pemasokFull}</div>
                    <div className="mt-0.5 text-[11px] text-[#6B5E55]">
                      Bahan: {row.bahanUtama} · {row.totalPengiriman}x kirim
                    </div>
                    <div className="mt-2 space-y-1 font-mono tabular-nums">
                      <div className="flex items-center justify-between gap-4">
                        <span className="font-sans text-[#6B5E55]">Lead time aktual terbaru:</span>
                        <strong className="text-[#C24E2B]">
                          {formatNumber(row.aktualTerbaru, 2)} hr
                        </strong>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="font-sans text-[#6B5E55]">Rata-rata aktual historis:</span>
                        <strong className="text-[#2D6A4F]">
                          {formatNumber(row.rataRataAktual, 2)} hr
                        </strong>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="font-sans text-[#6B5E55]">Target SLA:</span>
                        <strong className="text-[#1F1A17]">
                          {formatNumber(row.targetSla, 2)} hr
                        </strong>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="font-sans text-[#6B5E55]">Ketepatan waktu:</span>
                        <strong className="text-[#1F1A17]">
                          {formatNumber(row.ketepatanPct, 1)}%
                        </strong>
                      </div>
                    </div>
                  </div>
                );
              }}
            />
            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />

            <Bar
              dataKey="aktualTerbaru"
              name="Lead Time Aktual Terbaru (hr)"
              fill="#C24E2B"
              radius={[4, 4, 0, 0]}
              maxBarSize={30}
            />
            <Bar
              dataKey="rataRataAktual"
              name="Rata-rata Aktual Historis (hr)"
              fill="#2D6A4F"
              radius={[4, 4, 0, 0]}
              maxBarSize={30}
            />
            <Bar
              dataKey="targetSla"
              name="Target SLA Pemasok (hr)"
              fill="#DFCEBC"
              radius={[4, 4, 0, 0]}
              maxBarSize={30}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Tabel Detail Evaluasi Per Pemasok & Bahan Baku Utama */}
      <div className="overflow-x-auto border-t border-[#EFE8DE] pt-2">
        <table className="w-full min-w-[840px] text-left text-sm">
          <thead className="border-b border-[#E6DDD2] bg-[#FAF7F2] text-xs font-medium text-[#6B5E55]">
            <tr>
              <th className="px-4 py-3">Pemasok &amp; Bahan Utama</th>
              <th className="px-3 py-3 text-right">Pengiriman</th>
              <th className="px-3 py-3 text-right">Aktual Terbaru</th>
              <th className="px-3 py-3 text-right">Rata-rata Aktual</th>
              <th className="px-3 py-3 text-right">Target SLA</th>
              <th className="px-3 py-3 text-right">Rentang Min–Maks</th>
              <th className="px-3 py-3 text-right">Tepat Waktu</th>
              <th className="px-4 py-3">Status Kinerja</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EFE8DE]">
            {filteredSuppliers.map((sup) => {
              const isExpanded = expandedSupplier === sup.pemasok;
              const recentDeliveries = deliveries
                .filter((d) => d.pemasok === sup.pemasok)
                .slice(-4)
                .reverse();

              return (
                <Fragment key={sup.pemasok}>
                  <tr
                    onClick={() =>
                      setExpandedSupplier(isExpanded ? null : sup.pemasok)
                    }
                    className="cursor-pointer hover:bg-[#FAF7F2]/80"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        {isExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#6B5E55]" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#6B5E55]" />
                        )}
                        <IngredientThumb nama={sup.bahanUtama[0] || ''} size="sm" />
                        <div>
                          <div className="font-semibold text-[#1F1A17]">{sup.pemasok}</div>
                          <div className="text-xs text-[#6B5E55]">
                            {sup.kategori} · {sup.bahanUtama.join(', ')}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums text-[#6B5E55]">
                      {sup.totalPengiriman}x
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-semibold tabular-nums text-[#C24E2B]">
                      {formatNumber(sup.leadTimeAktualTerbaru, 1)} hr
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-semibold tabular-nums text-[#1F1A17]">
                      {formatNumber(sup.rataRataLeadTimeAktual, 2)} hr
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums text-[#6B5E55]">
                      {formatNumber(sup.rataRataLeadTimeTarget, 2)} hr
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums text-[#6B5E55]">
                      {sup.leadTimeMin}–{sup.leadTimeMax} hr
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-semibold tabular-nums text-[#1F1A17]">
                      {formatNumber(sup.ketepatanWaktuPct, 1)}%
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-xs font-semibold">
                        {sup.statusKinerja === 'Andal' && (
                          <>
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-[#2D6A4F]" />
                            <span className="text-[#2D6A4F]">Andal</span>
                          </>
                        )}
                        {sup.statusKinerja === 'Perlu Pantau' && (
                          <>
                            <AlertTriangle className="h-4 w-4 shrink-0 text-[#B45309]" />
                            <span className="text-[#B45309]">Perlu Pantau</span>
                          </>
                        )}
                        {sup.statusKinerja === 'Sering Terlambat' && (
                          <>
                            <AlertOctagon className="h-4 w-4 shrink-0 text-[#B91C1C]" />
                            <span className="text-[#B91C1C]">Sering Terlambat</span>
                          </>
                        )}
                      </div>
                      <div className="mt-0.5 text-[11px] text-[#6B5E55]">
                        Kirim terakhir: {formatTanggalId(sup.tanggalTerbaru)}
                      </div>
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr className="bg-[#FAF7F2]/75">
                      <td colSpan={8} className="px-6 py-4">
                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                          {/* Rincian per Bahan Baku */}
                          <div>
                            <div className="text-xs font-semibold text-[#1F1A17]">
                              Rincian Lead Time per Bahan Baku ({sup.pemasok})
                            </div>
                            <div className="mt-2 divide-y divide-[#EFE8DE] rounded-lg border border-[#E6DDD2] bg-white px-3">
                              {sup.rincianBahan.map((rb) => (
                                <div
                                  key={rb.bahan}
                                  className="flex items-center justify-between gap-3 py-2 text-xs"
                                >
                                  <div className="flex items-center gap-2">
                                    <IngredientThumb nama={rb.bahan} size="sm" />
                                    <div>
                                      <div className="font-medium text-[#1F1A17]">{rb.bahan}</div>
                                      <div className="text-[11px] text-[#6B5E55]">
                                        {rb.totalPengiriman} pengiriman · OTD{' '}
                                        <span className="font-mono tabular-nums">
                                          {formatNumber(rb.ketepatanWaktuPct, 1)}%
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="text-right font-mono tabular-nums">
                                    <div className="font-semibold text-[#C24E2B]">
                                      Aktual: {formatNumber(rb.leadTimeAktualTerbaru, 1)} hr
                                    </div>
                                    <div className="text-[11px] text-[#6B5E55]">
                                      Rata-rata {formatNumber(rb.rataRataLeadTimeAktual, 2)} hr · SLA{' '}
                                      {formatNumber(rb.rataRataLeadTimeTarget, 1)} hr
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* 4 Pengiriman Terakhir dari State */}
                          <div>
                            <div className="text-xs font-semibold text-[#1F1A17]">
                              Log Pengiriman Terbaru dari File State
                            </div>
                            <div className="mt-2 divide-y divide-[#EFE8DE] rounded-lg border border-[#E6DDD2] bg-white px-3">
                              {recentDeliveries.map((del) => (
                                <div
                                  key={del.id}
                                  className="flex items-center justify-between gap-3 py-2 text-xs"
                                >
                                  <div>
                                    <div className="font-medium text-[#1F1A17]">
                                      {del.bahan} ·{' '}
                                      <span className="font-mono tabular-nums">
                                        {formatNumber(del.qty, 2)} {del.satuan}
                                      </span>
                                    </div>
                                    <div className="text-[11px] text-[#6B5E55]">
                                      Pesan {formatTanggalId(del.tanggalPesan)} → Terima{' '}
                                      {formatTanggalId(del.tanggalDiterima)}
                                    </div>
                                  </div>
                                  <div className="text-right font-mono tabular-nums">
                                    <div
                                      className={`font-semibold ${
                                        del.tepatWaktu ? 'text-[#2D6A4F]' : 'text-[#B91C1C]'
                                      }`}
                                    >
                                      {del.actualLeadTimeHari} hr (SLA {del.plannedLeadTimeHari} hr)
                                    </div>
                                    <div className="text-[11px] text-[#6B5E55]">
                                      {del.tepatWaktu ? 'Tepat waktu' : `Terlambat +${del.actualLeadTimeHari - del.plannedLeadTimeHari} hr`}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
