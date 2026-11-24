import { useState } from 'react';
import type { PolicyCalculation, SimulationConfig } from '../types/inventory';
import { formatNumber, formatRupiah } from '../utils/format';

interface ManualCalculatorProps {
  policies: PolicyCalculation[];
  config: SimulationConfig;
}

export function ManualCalculator({ policies, config }: ManualCalculatorProps) {
  const [selectedId, setSelectedId] = useState<string>(policies[0]?.bahanId || '');

  const policy = policies.find((p) => p.bahanId === selectedId) || policies[0];

  if (!policy) {
    return (
      <div className="rounded-xl border border-[#E6DDD2] bg-white p-6 text-sm text-[#6B5E55]">
        Belum ada bahan baku yang tersedia untuk dihitung.
      </div>
    );
  }

  const sqrtL = Math.sqrt(policy.effectiveLeadTime);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[#E6DDD2] bg-white p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#1F1A17]">
              Verifikasi Hitung Manual Kebijakan Persediaan
            </h2>
            <p className="mt-1 text-sm text-[#6B5E55]">
              Bandingkan langkah perhitungan deterministik untuk satu bahan guna memverifikasi keputusan Agen AI.
            </p>
          </div>
          <div className="w-full sm:w-72">
            <label htmlFor="manual-bahan" className="block text-xs font-medium text-[#6B5E55]">
              Pilih Bahan Baku
            </label>
            <select
              id="manual-bahan"
              value={policy.bahanId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-[#E6DDD2] bg-white px-3 py-2 text-sm text-[#1F1A17] focus:border-[#C24E2B] focus:outline-none"
            >
              {policies.map((p) => (
                <option key={p.bahanId} value={p.bahanId}>
                  {p.nama} ({p.jenis})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg bg-[#FAF7F2] p-4">
            <p className="text-xs text-[#6B5E55]">Rata-rata Harian (d̄, 7 hari)</p>
            <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-[#1F1A17]">
              {formatNumber(policy.dBar, 3)} {policy.satuan}
            </p>
          </div>
          <div className="rounded-lg bg-[#FAF7F2] p-4">
            <p className="text-xs text-[#6B5E55]">Simpangan Baku (σ, 7 hari)</p>
            <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-[#1F1A17]">
              {formatNumber(policy.sigma, 3)} {policy.satuan}
            </p>
          </div>
          <div className="rounded-lg bg-[#FAF7F2] p-4">
            <p className="text-xs text-[#6B5E55]">Lead Time Efektif (L)</p>
            <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-[#1F1A17]">
              {policy.effectiveLeadTime} hari
            </p>
          </div>
          <div className="rounded-lg bg-[#FAF7F2] p-4">
            <p className="text-xs text-[#6B5E55]">Stok Tersedia Saat Ini</p>
            <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-[#1F1A17]">
              {formatNumber(policy.stokSaatIni, 3)} {policy.satuan}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Langkah 1: Safety Stock */}
        <div className="rounded-xl border border-[#E6DDD2] bg-white p-6">
          <h3 className="text-base font-semibold text-[#1F1A17]">
            1. Perhitungan Safety Stock (SS)
          </h3>
          <p className="mt-1 text-xs text-[#6B5E55]">
            Menjaga ketersediaan stok terhadap fluktuasi permintaan pada service level z ={' '}
            <span className="font-mono tabular-nums">{formatNumber(policy.zScore, 2)}</span>.
          </p>

          <div className="mt-4 space-y-2 rounded-lg bg-[#FAF7F2] p-4 font-mono text-xs tabular-nums text-[#1F1A17]">
            <div>Rumus: SS = z × σ × √L</div>
            <div>
              Substitusi: SS = {formatNumber(policy.zScore, 2)} × {formatNumber(policy.sigma, 3)} × √
              {policy.effectiveLeadTime} ({formatNumber(sqrtL, 3)})
            </div>
            <div className="pt-1 text-sm font-semibold text-[#C24E2B]">
              Hasil SS = {formatNumber(policy.safetyStock, 3)} {policy.satuan}
            </div>
          </div>
        </div>

        {/* Langkah 2: Kebijakan Bahan Segar vs Tahan Lama */}
        <div className="rounded-xl border border-[#E6DDD2] bg-white p-6">
          {policy.jenis === 'segar' ? (
            <>
              <h3 className="text-base font-semibold text-[#1F1A17]">
                2. Target Stok Bahan Segar &amp; Saran Belanja Sore
              </h3>
              <p className="mt-1 text-xs text-[#6B5E55]">
                Bahan segar dibeli setiap sore (17.00–18.00) untuk mencukupi kebutuhan produksi besok pukul 05.00.
              </p>

              <div className="mt-4 space-y-2 rounded-lg bg-[#FAF7F2] p-4 font-mono text-xs tabular-nums text-[#1F1A17]">
                <div>Rumus: Target Stok = Ramalan Besok (d̄) + SS</div>
                <div>
                  Substitusi: {formatNumber(policy.dBar, 3)} + {formatNumber(policy.safetyStock, 3)} ={' '}
                  <strong>
                    {formatNumber(policy.targetStok ?? 0, 3)} {policy.satuan}
                  </strong>
                </div>
                <div>
                  Defisit = max(0, {formatNumber(policy.targetStok ?? 0, 3)} −{' '}
                  {formatNumber(policy.stokSaatIni, 3)})
                </div>
                <div className="pt-1 text-sm font-semibold text-[#C24E2B]">
                  Saran Pesan = {formatNumber(policy.recommendedOrderQty, 2)} {policy.satuan} (
                  {formatRupiah(policy.estimatedOrderCost)})
                </div>
              </div>
            </>
          ) : (
            <>
              <h3 className="text-base font-semibold text-[#1F1A17]">
                2. Titik Pemesanan Ulang (ROP) &amp; EOQ Bahan Tahan Lama
              </h3>
              <p className="mt-1 text-xs text-[#6B5E55]">
                Biaya pesan S = {formatRupiah(config.orderingCost)} · Biaya simpan H ={' '}
                {formatNumber(config.holdingCostRate * 100, 0)}% × {formatRupiah(policy.harga)} ={' '}
                {formatRupiah(policy.holdingCostPerUnit)}/{policy.satuan}/tahun.
              </p>

              <div className="mt-4 space-y-2 rounded-lg bg-[#FAF7F2] p-4 font-mono text-xs tabular-nums text-[#1F1A17]">
                <div>
                  ROP = (d̄ × L) + SS = ({formatNumber(policy.dBar, 3)} × {policy.effectiveLeadTime}) +{' '}
                  {formatNumber(policy.safetyStock, 3)} ={' '}
                  <strong>
                    {formatNumber(policy.rop ?? 0, 3)} {policy.satuan}
                  </strong>
                </div>
                <div>
                  D (tahunan) = d̄ × 365 = {formatNumber(policy.annualDemand ?? 0, 1)} {policy.satuan}
                </div>
                <div>
                  EOQ = √(2 × D × S / H) ={' '}
                  <strong>
                    {formatNumber(policy.eoq ?? 0, 2)} {policy.satuan}
                  </strong>
                </div>
                <div className="pt-1 text-sm font-semibold text-[#C24E2B]">
                  {policy.stokSaatIni <= (policy.rop ?? 0)
                    ? `Stok ≤ ROP → Pesan ${formatNumber(policy.recommendedOrderQty, 2)} ${policy.satuan} (${formatRupiah(policy.estimatedOrderCost)})`
                    : `Stok > ROP → Belum perlu pesan (0 ${policy.satuan})`}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
