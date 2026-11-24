import { useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { IngredientDailyTrend, IngredientMaster } from '../types/inventory';
import { formatNumber, formatShortDateId, formatTanggalId } from '../utils/format';

interface IngredientStockChartProps {
  trends: Record<string, IngredientDailyTrend[]>;
  ingredients: IngredientMaster[];
}

type ViewMode = 'protein_utama' | string;
type MetricMode = 'stokLevel' | 'pemakaian';

interface StockChartRow {
  tanggal: string;
  labelTanggal: string;
  ikanStok?: number;
  ikanPakai?: number;
  dagingStok?: number;
  dagingPakai?: number;
  stokLevel?: number;
  pemakaian?: number;
}

export function IngredientStockChart({ trends, ingredients }: IngredientStockChartProps) {
  const [selectedView, setSelectedView] = useState<ViewMode>('protein_utama');
  const [metric, setMetric] = useState<MetricMode>('stokLevel');

  const ikanSeries = trends['Ikan tenggiri'] || [];
  const dagingSeries = trends['Daging sapi'] || [];

  const isProteinPair = selectedView === 'protein_utama';
  const activeIngredient = ingredients.find((i) => i.nama === selectedView);
  const singleSeries = !isProteinPair ? trends[selectedView] || [] : [];

  const chartRows: StockChartRow[] = isProteinPair
    ? ikanSeries.map((pt, idx) => ({
        tanggal: pt.tanggal,
        labelTanggal: formatShortDateId(pt.tanggal),
        ikanStok: pt.stokLevel,
        ikanPakai: pt.pemakaian,
        dagingStok: dagingSeries[idx]?.stokLevel ?? 0,
        dagingPakai: dagingSeries[idx]?.pemakaian ?? 0,
      }))
    : singleSeries.map((pt) => ({
        tanggal: pt.tanggal,
        labelTanggal: formatShortDateId(pt.tanggal),
        stokLevel: pt.stokLevel,
        pemakaian: pt.pemakaian,
      }));

  if (chartRows.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-[#E6DDD2] bg-[#FAF7F2]/60 p-6 text-center text-sm text-[#6B5E55]">
        Belum ada riwayat 30 hari untuk menampilkan fluktuasi stok bahan baku.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-base font-semibold text-[#1F1A17]">
            Fluktuasi Level Stok Bahan Baku Utama (30 Hari Terakhir)
          </h3>
          <p className="text-xs text-[#6B5E55]">
            {isProteinPair
              ? 'Perbandingan tren stok & pemakaian Ikan tenggiri dan Daging sapi (satuan kg)'
              : `Pergerakan level stok dan pemakaian harian ${selectedView} (${activeIngredient?.satuan || ''})`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {isProteinPair && (
            <div className="flex items-center gap-1 rounded-lg bg-[#FAF7F2] p-1">
              <button
                type="button"
                onClick={() => setMetric('stokLevel')}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  metric === 'stokLevel'
                    ? 'bg-white text-[#1F1A17] shadow-xs'
                    : 'text-[#6B5E55] hover:text-[#1F1A17]'
                }`}
              >
                Level Stok (kg)
              </button>
              <button
                type="button"
                onClick={() => setMetric('pemakaian')}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  metric === 'pemakaian'
                    ? 'bg-white text-[#1F1A17] shadow-xs'
                    : 'text-[#6B5E55] hover:text-[#1F1A17]'
                }`}
              >
                Pemakaian Harian (kg)
              </button>
            </div>
          )}

          <select
            value={selectedView}
            onChange={(e) => setSelectedView(e.target.value)}
            aria-label="Pilih bahan baku untuk grafik fluktuasi stok"
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

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartRows} margin={{ top: 10, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid stroke="#EFE8DE" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="labelTanggal"
              tick={{ fill: '#6B5E55', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: '#E6DDD2' }}
              minTickGap={24}
            />
            <YAxis
              tick={{ fill: '#6B5E55', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
              tickLine={false}
              axisLine={false}
              width={48}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || payload.length === 0) return null;
                const row = payload[0].payload as Record<string, string | number>;
                const fullDate = String(row.tanggal || '');
                return (
                  <div className="rounded-lg border border-[#E6DDD2] bg-white px-3.5 py-2.5 text-xs shadow-sm">
                    <div className="font-semibold text-[#1F1A17]">
                      {formatTanggalId(fullDate)}
                    </div>
                    <div className="mt-1.5 space-y-1 font-mono tabular-nums">
                      {payload.map((entry) => (
                        <div
                          key={String(entry.dataKey)}
                          className="flex items-center justify-between gap-4"
                        >
                          <span className="font-sans text-[#6B5E55]">{entry.name}:</span>
                          <span className="font-semibold" style={{ color: entry.color }}>
                            {formatNumber(Number(entry.value || 0), 3)}{' '}
                            {isProteinPair ? 'kg' : activeIngredient?.satuan || ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
              iconType="plainline"
            />

            {isProteinPair ? (
              <>
                <Line
                  type="monotone"
                  dataKey={metric === 'stokLevel' ? 'ikanStok' : 'ikanPakai'}
                  name={
                    metric === 'stokLevel'
                      ? 'Ikan tenggiri (Stok)'
                      : 'Ikan tenggiri (Pakai/hari)'
                  }
                  stroke="#C24E2B"
                  strokeWidth={2.4}
                  dot={false}
                  activeDot={{ r: 4, fill: '#C24E2B' }}
                />
                <Line
                  type="monotone"
                  dataKey={metric === 'stokLevel' ? 'dagingStok' : 'dagingPakai'}
                  name={
                    metric === 'stokLevel'
                      ? 'Daging sapi (Stok)'
                      : 'Daging sapi (Pakai/hari)'
                  }
                  stroke="#2D6A4F"
                  strokeWidth={2.4}
                  dot={false}
                  activeDot={{ r: 4, fill: '#2D6A4F' }}
                />
              </>
            ) : (
              <>
                <Line
                  type="monotone"
                  dataKey="stokLevel"
                  name={`Level Stok (${activeIngredient?.satuan || ''})`}
                  stroke="#C24E2B"
                  strokeWidth={2.4}
                  dot={false}
                  activeDot={{ r: 4, fill: '#C24E2B' }}
                />
                <Line
                  type="monotone"
                  dataKey="pemakaian"
                  name={`Pemakaian Harian (${activeIngredient?.satuan || ''})`}
                  stroke="#2D6A4F"
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  dot={false}
                  activeDot={{ r: 4, fill: '#2D6A4F' }}
                />
              </>
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
