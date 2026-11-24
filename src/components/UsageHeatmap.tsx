import { useState } from 'react';
import { Flame } from 'lucide-react';
import type { WeeklyHeatmapRow } from '../types/inventory';
import { formatNumber } from '../utils/format';
import { IngredientThumb } from './IngredientThumb';

interface UsageHeatmapProps {
  rows: WeeklyHeatmapRow[];
}

export function UsageHeatmap({ rows }: UsageHeatmapProps) {
  const [filter, setFilter] = useState<'segar' | 'semua'>('segar');
  const [hoveredCell, setHoveredCell] = useState<{
    nama: string;
    satuan: string;
    dayFull: string;
    avgUsage: number;
    weeklyAvg: number;
  } | null>(null);

  const visibleRows = filter === 'segar' ? rows.filter((r) => r.jenis === 'segar') : rows;

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-[#E6DDD2] bg-white p-6 text-sm text-[#6B5E55]">
        Belum ada data transaksi untuk memetakan heatmap pemakaian mingguan.
      </div>
    );
  }

  // Hitung hari puncak dominan di antara bahan segar
  const peakCounts = new Map<string, number>();
  for (const r of rows.filter((x) => x.jenis === 'segar')) {
    peakCounts.set(r.peakDay, (peakCounts.get(r.peakDay) || 0) + 1);
  }
  const topPeakDays = Array.from(peakCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([day]) => day);

  const dayHeaders = visibleRows[0]?.days || [];

  return (
    <div className="rounded-xl border border-[#E6DDD2] bg-white">
      <div className="flex flex-col gap-3 border-b border-[#E6DDD2] px-6 py-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-[#C24E2B]" />
            <h2 className="text-base font-semibold text-[#1F1A17]">
              Heatmap Pemakaian Bahan (Hari dalam Seminggu)
            </h2>
          </div>
          <p className="mt-0.5 text-xs text-[#6B5E55]">
            Rata-rata konsumsi harian per hari untuk optimasi jadwal belanja pasar sore · Puncak bahan segar:{' '}
            <strong className="text-[#C24E2B]">{topPeakDays.join(' & ') || '-'}</strong>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg bg-[#FAF7F2] p-1">
            <button
              type="button"
              onClick={() => setFilter('segar')}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                filter === 'segar'
                  ? 'bg-white text-[#1F1A17] shadow-xs'
                  : 'text-[#6B5E55] hover:text-[#1F1A17]'
              }`}
            >
              Bahan Segar
            </button>
            <button
              type="button"
              onClick={() => setFilter('semua')}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                filter === 'semua'
                  ? 'bg-white text-[#1F1A17] shadow-xs'
                  : 'text-[#6B5E55] hover:text-[#1F1A17]'
              }`}
            >
              Semua (11 Bahan)
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-[#6B5E55]">
            <span>Rendah</span>
            <span className="inline-block h-3 w-4 rounded-xs bg-[#C24E2B]/10" />
            <span className="inline-block h-3 w-4 rounded-xs bg-[#C24E2B]/35" />
            <span className="inline-block h-3 w-4 rounded-xs bg-[#C24E2B]/65" />
            <span className="inline-block h-3 w-4 rounded-xs bg-[#C24E2B]" />
            <span>Lonjakan</span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-xs">
          <thead className="border-b border-[#E6DDD2] bg-[#FAF7F2] text-[#6B5E55]">
            <tr>
              <th className="px-5 py-3 font-medium">Bahan Baku</th>
              {dayHeaders.map((d) => (
                <th key={d.dayIndex} className="px-2 py-3 text-center font-medium">
                  {d.dayShort}
                </th>
              ))}
              <th className="px-5 py-3 text-right font-medium">Hari Puncak</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EFE8DE]">
            {visibleRows.map((row) => (
              <tr key={row.bahanId}>
                <td className="px-5 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <IngredientThumb nama={row.nama} size="sm" />
                    <div>
                      <div className="font-medium text-[#1F1A17]">{row.nama}</div>
                      <div className="text-[11px] text-[#6B5E55]">{row.satuan}/hari</div>
                    </div>
                  </div>
                </td>

                {row.days.map((d) => {
                  const alpha = 0.07 + d.intensity * 0.85;
                  const darkText = d.intensity < 0.6;
                  return (
                    <td key={d.dayIndex} className="px-1.5 py-2 text-center">
                      <div
                        onMouseEnter={() =>
                          setHoveredCell({
                            nama: row.nama,
                            satuan: row.satuan,
                            dayFull: d.dayFull,
                            avgUsage: d.avgUsage,
                            weeklyAvg: row.weeklyAvg,
                          })
                        }
                        onMouseLeave={() => setHoveredCell(null)}
                        style={{
                          backgroundColor: `rgba(194, 78, 43, ${alpha.toFixed(2)})`,
                          color: darkText ? '#1F1A17' : '#FFFFFF',
                        }}
                        className={`mx-auto flex h-9 min-w-[54px] items-center justify-center rounded-md px-2 font-mono text-xs tabular-nums transition-transform ${
                          d.isPeak ? 'font-bold ring-1 ring-[#C24E2B]' : 'font-medium'
                        }`}
                      >
                        {formatNumber(d.avgUsage, 2)}
                      </div>
                    </td>
                  );
                })}

                <td className="px-5 py-2.5 text-right font-medium text-[#C24E2B]">
                  {row.peakDay}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hoveredCell && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#E6DDD2] bg-[#FAF7F2] px-6 py-2.5 text-xs text-[#1F1A17]">
          <span>
            <strong>{hoveredCell.nama}</strong> · {hoveredCell.dayFull}
          </span>
          <span className="font-mono tabular-nums">
            Rata-rata: <strong>{formatNumber(hoveredCell.avgUsage, 3)}</strong> {hoveredCell.satuan}/hari
            {hoveredCell.weeklyAvg > 0 && (
              <span className="ml-3 text-[#6B5E55]">
                ({hoveredCell.avgUsage >= hoveredCell.weeklyAvg ? '+' : ''}
                {formatNumber(
                  ((hoveredCell.avgUsage - hoveredCell.weeklyAvg) / hoveredCell.weeklyAvg) * 100,
                  1
                )}
                % vs rata-rata mingguan)
              </span>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
