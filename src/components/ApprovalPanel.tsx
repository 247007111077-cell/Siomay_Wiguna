import { useState } from 'react';
import { AlertTriangle, Check, Clock, Play, ShoppingBag, X } from 'lucide-react';
import type {
  IncomingOrder,
  IngredientMaster,
  PurchaseDraft,
  RiskFlag,
} from '../types/inventory';
import { formatNumber, formatRupiah, formatTanggalId } from '../utils/format';

interface ApprovalPanelProps {
  drafts: PurchaseDraft[];
  ingredients: IngredientMaster[];
  incomingOrders: IncomingOrder[];
  riskFlags: RiskFlag[];
  isRunningAgent: boolean;
  canApprove: boolean;
  canManageOps: boolean;
  onDecideDraft: (draftId: string, decision: 'Disetujui' | 'Ditolak') => Promise<void>;
  onRunAgent: () => void;
}

export function ApprovalPanel({
  drafts,
  ingredients,
  incomingOrders,
  riskFlags,
  isRunningAgent,
  canApprove,
  canManageOps,
  onDecideDraft,
  onRunAgent,
}: ApprovalPanelProps) {
  const [filter, setFilter] = useState<'semua' | 'menunggu' | 'selesai'>('semua');
  const [busyId, setBusyId] = useState<string | null>(null);

  const jenisMap = new Map(ingredients.map((i) => [i.nama, i.jenis]));

  const filteredDrafts = drafts.filter((d) => {
    if (filter === 'menunggu') return d.status === 'Menunggu persetujuan';
    if (filter === 'selesai') return d.status !== 'Menunggu persetujuan';
    return true;
  });

  const approvedTodayOrPending = drafts.filter((d) => d.status === 'Disetujui');
  const belanjaSegar = approvedTodayOrPending.filter(
    (d) => (jenisMap.get(d.bahan) || 'segar') === 'segar'
  );
  const poGudangPh = approvedTodayOrPending.filter(
    (d) => jenisMap.get(d.bahan) === 'tahan lama'
  );

  const handleDecision = async (id: string, decision: 'Disetujui' | 'Ditolak') => {
    setBusyId(id);
    try {
      await onDecideDraft(id, decision);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Antrean Persetujuan Draf Pesanan (Alur Akuntan Wiguna) */}
      <div className="rounded-xl border border-[#E6DDD2] bg-white">
        <div className="flex flex-col gap-3 border-b border-[#E6DDD2] px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#1F1A17]">
              Persetujuan Belanja &amp; Pengadaan (Akuntan Wiguna)
            </h2>
            <p className="mt-0.5 text-xs text-[#6B5E55]">
              Draf usulan asisten persediaan berstatus Menunggu persetujuan sebelum dana belanja sore dicairkan.
            </p>
          </div>

          <div className="flex items-center gap-1 rounded-lg bg-[#FAF7F2] p-1">
            {(
              [
                { id: 'semua', label: 'Semua' },
                { id: 'menunggu', label: 'Menunggu' },
                { id: 'selesai', label: 'Diputuskan' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  filter === tab.id
                    ? 'bg-white text-[#1F1A17] shadow-xs'
                    : 'text-[#6B5E55] hover:text-[#1F1A17]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {filteredDrafts.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-[#6B5E55]">
              Belum ada draf pengadaan pada daftar ini. Jalankan evaluasi sore untuk memeriksa kebutuhan belanja hari ini.
            </p>
            {canManageOps && (
              <button
                type="button"
                onClick={onRunAgent}
                disabled={isRunningAgent}
                className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[#C24E2B] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#A63E1F] disabled:opacity-60 whitespace-nowrap"
              >
                <Play className="h-4 w-4" />
                {isRunningAgent ? 'Memproses Evaluasi...' : 'Jalankan Agen Sore (16.30)'}
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-[#EFE8DE]">
            {filteredDrafts.map((draft) => {
              const isPending = draft.status === 'Menunggu persetujuan';
              const jenisBahan = jenisMap.get(draft.bahan) || 'segar';
              const lokasiTujuan =
                jenisBahan === 'segar'
                  ? 'Belanja Pasar Sore (17.00–18.00)'
                  : 'Order Pemasok Gudang PH';
              const statusColor =
                draft.status === 'Disetujui'
                  ? 'text-[#2D6A4F]'
                  : draft.status === 'Ditolak'
                    ? 'text-[#B91C1C]'
                    : 'text-[#B45309]';

              return (
                <div
                  key={draft.id}
                  className="flex flex-col gap-4 px-6 py-4 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#6B5E55]">
                      <span className="font-mono tabular-nums">{formatTanggalId(draft.tanggalBuat)}</span>
                      <span aria-hidden="true">·</span>
                      <span className={`font-semibold ${statusColor}`}>{draft.status}</span>
                      <span aria-hidden="true">·</span>
                      <span>{lokasiTujuan}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">Lead time {draft.leadTimeHari} hari</span>
                    </div>
                    <div className="flex flex-wrap items-baseline gap-3">
                      <h3 className="text-base font-semibold text-[#1F1A17]">{draft.bahan}</h3>
                      <span className="font-mono text-sm font-semibold tabular-nums text-[#C24E2B]">
                        {formatNumber(draft.qty, 2)} {draft.satuan}
                      </span>
                      <span className="font-mono text-sm tabular-nums text-[#1F1A17]">
                        ({formatRupiah(draft.estimasiBiaya)})
                      </span>
                    </div>
                    <p className="text-sm text-[#6B5E55]">{draft.alasan}</p>
                    {draft.diputuskanOleh && (
                      <div className="text-xs text-[#6B5E55]">
                        Diputuskan oleh: <strong className="text-[#1F1A17]">{draft.diputuskanOleh}</strong>
                      </div>
                    )}
                  </div>

                  {isPending && (
                    <div className="flex shrink-0 items-center gap-2.5">
                      {canApprove ? (
                        <>
                          <button
                            type="button"
                            disabled={busyId === draft.id}
                            onClick={() => handleDecision(draft.id, 'Disetujui')}
                            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-[#2D6A4F] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[#23533D] disabled:opacity-50 whitespace-nowrap"
                          >
                            <Check className="h-4 w-4" />
                            Setujui
                          </button>
                          <button
                            type="button"
                            disabled={busyId === draft.id}
                            onClick={() => handleDecision(draft.id, 'Ditolak')}
                            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-[#E6DDD2] bg-white px-4 py-2 text-xs font-medium text-[#B91C1C] transition-colors hover:bg-[#FAF7F2] disabled:opacity-50 whitespace-nowrap"
                          >
                            <X className="h-4 w-4" />
                            Tolak
                          </button>
                        </>
                      ) : (
                        <span className="text-xs font-medium text-[#B45309]">
                          Perlu otorisasi Akuntan / Pemilik
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Ringkasan Daftar Belanja Pasar vs PO Gudang PH yang sudah Disetujui */}
      {approvedTodayOrPending.length > 0 && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-[#E6DDD2] bg-white p-6">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-[#C24E2B]" />
              <h3 className="text-base font-semibold text-[#1F1A17]">
                Daftar Belanja Pasar Sore (17.00–18.00)
              </h3>
            </div>
            <p className="mt-1 text-xs text-[#6B5E55]">
              Bahan segar yang telah disetujui akuntan untuk produksi pukul 05.00 besok.
            </p>
            {belanjaSegar.length === 0 ? (
              <p className="mt-4 text-sm text-[#6B5E55]">Belum ada bahan segar yang disetujui.</p>
            ) : (
              <div className="mt-4 divide-y divide-[#EFE8DE]">
                {belanjaSegar.slice(0, 8).map((item) => (
                  <div key={item.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="font-medium text-[#1F1A17]">
                      {item.bahan}{' '}
                      <span className="font-mono text-xs text-[#6B5E55]">
                        ({formatNumber(item.qty, 2)} {item.satuan})
                      </span>
                    </span>
                    <span className="font-mono text-xs font-semibold tabular-nums text-[#2D6A4F]">
                      {formatRupiah(item.estimasiBiaya)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-[#E6DDD2] bg-white p-6">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-[#2D6A4F]" />
              <h3 className="text-base font-semibold text-[#1F1A17]">
                Purchase Order Pemasok Gudang PH
              </h3>
            </div>
            <p className="mt-1 text-xs text-[#6B5E55]">
              Bahan tahan lama dengan metode EOQ &amp; ROP yang telah disetujui.
            </p>
            {poGudangPh.length === 0 ? (
              <p className="mt-4 text-sm text-[#6B5E55]">Belum ada PO Gudang PH yang disetujui.</p>
            ) : (
              <div className="mt-4 divide-y divide-[#EFE8DE]">
                {poGudangPh.slice(0, 8).map((item) => (
                  <div key={item.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="font-medium text-[#1F1A17]">
                      {item.bahan}{' '}
                      <span className="font-mono text-xs text-[#6B5E55]">
                        ({formatNumber(item.qty, 2)} {item.satuan})
                      </span>
                    </span>
                    <span className="font-mono text-xs font-semibold tabular-nums text-[#2D6A4F]">
                      {formatRupiah(item.estimasiBiaya)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pesanan dalam Pengiriman & Peringatan Risiko */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-[#E6DDD2] bg-white p-6">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-[#C24E2B]" />
            <h3 className="text-base font-semibold text-[#1F1A17]">
              Pengiriman Pemasok Dalam Perjalanan
            </h3>
          </div>
          <p className="mt-1 text-xs text-[#6B5E55]">
            Otomatis masuk ke stok dapur/gudang PH saat tiba sesuai jadwal lead time.
          </p>

          {incomingOrders.length === 0 ? (
            <p className="mt-4 text-sm text-[#6B5E55]">
              Tidak ada pengiriman pemasok yang sedang berjalan.
            </p>
          ) : (
            <div className="mt-4 divide-y divide-[#EFE8DE]">
              {incomingOrders.map((ord) => (
                <div key={ord.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <span className="font-medium text-[#1F1A17]">{ord.bahan}</span>
                    <span className="ml-2 font-mono text-xs tabular-nums text-[#6B5E55]">
                      +{formatNumber(ord.qty, 2)} {ord.satuan}
                    </span>
                  </div>
                  <span className="font-mono text-xs font-medium tabular-nums text-[#C24E2B]">
                    Tiba dalam {ord.sisaLeadTimeHari} hari
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-[#E6DDD2] bg-white p-6">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-[#B45309]" />
            <h3 className="text-base font-semibold text-[#1F1A17]">
              Peringatan Risiko Stok &amp; Kedaluwarsa
            </h3>
          </div>
          <p className="mt-1 text-xs text-[#6B5E55]">
            Catatan stok kritis dan bahan mendekati masa kedaluwarsa dari evaluasi agen.
          </p>

          {riskFlags.length === 0 ? (
            <p className="mt-4 text-sm text-[#6B5E55]">
              Belum ada peringatan risiko yang tercatat.
            </p>
          ) : (
            <div className="mt-4 divide-y divide-[#EFE8DE]">
              {riskFlags.slice(0, 8).map((flag) => (
                <div key={flag.id} className="py-2.5">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-semibold text-[#1F1A17]">{flag.bahan}</span>
                    <span aria-hidden="true" className="text-[#6B5E55]">·</span>
                    <span
                      className={`font-medium ${
                        flag.jenis === 'stok_kritis' ? 'text-[#B91C1C]' : 'text-[#B45309]'
                      }`}
                    >
                      {flag.jenis === 'stok_kritis' ? 'Stok Kritis' : 'Mendekati Kedaluwarsa'}
                    </span>
                    <span aria-hidden="true" className="text-[#6B5E55]">·</span>
                    <span className="font-mono tabular-nums text-[#6B5E55]">
                      {formatTanggalId(flag.tanggal)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[#6B5E55]">{flag.alasan}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
