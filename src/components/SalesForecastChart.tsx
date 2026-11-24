import { useState } from 'react';
import type { DailyChartPoint } from '../types/inventory';
import { formatNumber, formatShortDateId, formatTanggalId } from '../utils/format';

interface SalesForecastChartProps {
  data: DailyChartPoint[];
}

export function SalesForecastChart({ data }: SalesForecastChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-[#E6DDD2] bg-[#FAF7F2]/60 p-6 text-center text-sm text-[#6B5E55]">
        Belum ada data penjualan untuk ditampilkan pada grafik 30 hari.
      </div>
    );
  }

  const width = 760;
  const height = 250;
  const padLeft = 44;
  const padRight = 18;
  const padTop = 20;
  const padBottom = 34;
  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;

  const maxVal = Math.max(
    10,
    ...data.map((d) => Math.max(d.totalUnitPrasmanan, d.movingAvg7 ?? 0))
  );
  const yMax = Math.ceil(maxVal * 1.15);

  const stepX = innerW / Math.max(1, data.length);
  const barW = Math.max(6, Math.min(16, stepX * 0.6));

  const getX = (idx: number) => padLeft + idx * stepX + stepX / 2;
  const getY = (val: number) => padTop + innerH - (val / yMax) * innerH;

  const actualPoints = data
    .map((d, i) => ({ d, i }))
    .filter(({ d }) => !d.isForecast && d.movingAvg7 !== null);

  const forecastStartIdx = data.findIndex((d) => d.isForecast);
  const forecastPoints = data
    .map((d, i) => ({ d, i }))
    .filter(({ d, i }) => d.isForecast || (forecastStartIdx > 0 && i === forecastStartIdx - 1));

  const maPath = actualPoints
    .map(({ d, i }, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(d.movingAvg7!).toFixed(1)}`)
    .join(' ');

  const forecastPath = forecastPoints
    .map(({ d, i }, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(d.movingAvg7 ?? d.totalUnitPrasmanan).toFixed(1)}`)
    .join(' ');

  const yTicks = [0, Math.round(yMax * 0.33), Math.round(yMax * 0.66), yMax];
  const hovered = hoveredIdx !== null ? data[hoveredIdx] : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-[#1F1A17]">
            Penjualan 30 Hari Terakhir &amp; Garis Ramalan
          </h3>
          <p className="text-xs text-[#6B5E55]">
            Total ekivalen unit prasmanan harian · Rata-rata bergerak 7 hari dan proyeksi 3 hari ke depan
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs text-[#6B5E55]">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-xs bg-[#D9C7B4]" />
            Aktual harian
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 bg-[#C24E2B]" />
            Rata-rata 7 hari
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 border-b-2 border-dashed border-[#2D6A4F]" />
            Garis ramalan
          </span>
        </div>
      </div>

      <div className="relative w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-60 w-full min-w-[540px] select-none"
          role="img"
          aria-label="Grafik penjualan 30 hari dan garis ramalan"
        >
          {/* Grid horizontal */}
          {yTicks.map((tick) => {
            const y = getY(tick);
            return (
              <g key={tick}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke="#EFE8DE"
                  strokeWidth={1}
                />
                <text
                  x={padLeft - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-[#6B5E55] font-mono text-[10px]"
                >
                  {tick}
                </text>
              </g>
            );
          })}

          {/* Batang harian */}
          {data.map((pt, idx) => {
            const x = getX(idx) - barW / 2;
            const y = getY(pt.totalUnitPrasmanan);
            const h = padTop + innerH - y;
            const isHovered = hoveredIdx === idx;

            return (
              <g
                key={pt.tanggal}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className="cursor-pointer"
              >
                <rect
                  x={getX(idx) - stepX / 2}
                  y={padTop}
                  width={stepX}
                  height={innerH}
                  fill="transparent"
                />
                <rect
                  x={x}
                  y={y}
                  width={barW}
                  height={Math.max(1, h)}
                  rx={2}
                  fill={
                    pt.isForecast
                      ? isHovered
                        ? '#2D6A4F'
                        : '#2D6A4F40'
                      : isHovered
                        ? '#C24E2B'
                        : '#DFCEBC'
                  }
                />
              </g>
            );
          })}

          {/* Garis Moving Average 7 Hari */}
          {maPath && (
            <path
              d={maPath}
              fill="none"
              stroke="#C24E2B"
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Garis Proyeksi Ramalan */}
          {forecastPath && (
            <path
              d={forecastPath}
              fill="none"
              stroke="#2D6A4F"
              strokeWidth={2.2}
              strokeDasharray="5 4"
              strokeLinecap="round"
            />
          )}

          {/* Titik proyeksi ramalan */}
          {data.map((pt, idx) => {
            if (!pt.isForecast) return null;
            return (
              <circle
                key={`dot-${pt.tanggal}`}
                cx={getX(idx)}
                cy={getY(pt.movingAvg7 ?? pt.totalUnitPrasmanan)}
                r={3.5}
                fill="#2D6A4F"
              />
            );
          })}

          {/* Label sumbu X berkala */}
          {data.map((pt, idx) => {
            const showLabel = idx === 0 || idx === data.length - 1 || idx % 6 === 0;
            if (!showLabel) return null;
            return (
              <text
                key={`lbl-${pt.tanggal}`}
                x={getX(idx)}
                y={height - 10}
                textAnchor="middle"
                className="fill-[#6B5E55] text-[10px]"
              >
                {formatShortDateId(pt.tanggal)}
              </text>
            );
          })}
        </svg>

        {hovered && (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-md border border-[#E6DDD2] bg-[#FAF7F2] px-3 py-2 text-xs text-[#1F1A17]">
            <span className="font-medium">
              {formatTanggalId(hovered.tanggal)} · {hovered.isForecast ? 'Proyeksi Ramalan' : 'Penjualan Aktual'}
            </span>
            <div className="flex items-center gap-4 font-mono tabular-nums">
              <span>
                Total: <strong>{formatNumber(hovered.totalUnitPrasmanan, 1)}</strong> unit
              </span>
              {hovered.movingAvg7 !== null && (
                <span>
                  MA-7: <strong>{formatNumber(hovered.movingAvg7, 1)}</strong> unit/hari
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
