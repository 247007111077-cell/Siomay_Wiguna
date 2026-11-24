import { useState, type ChangeEvent } from 'react';
import { Database, Download, Save, Upload, UtensilsCrossed } from 'lucide-react';
import type {
  IngredientMaster,
  JenisBahan,
  SalesRecord,
  WasteLog,
} from '../types/inventory';
import { formatNumber, formatRupiah, formatTanggalId } from '../utils/format';
import { IngredientThumb } from './IngredientThumb';

interface MasterDataPanelProps {
  ingredients: IngredientMaster[];
  sales: SalesRecord[];
  wasteLogs: WasteLog[];
  onSaveIngredient: (
    id: string,
    patch: {
      harga: number;
      leadTimeHari: number;
      umurSimpanHari: number;
      stokSaatIni: number;
      jenis: JenisBahan;
    }
  ) => Promise<void>;
  onGenerateDummy: () => Promise<void>;
  onUploadCsv: (csvText: string) => Promise<void>;
}

interface DraftRowEdit {
  harga: string;
  leadTimeHari: string;
  umurSimpanHari: string;
  stokSaatIni: string;
  jenis: JenisBahan;
}

const WIGUNA_RECIPES = [
  { menu: 'Siomay', takaran: 'Ikan tenggiri 0,04 kg + Kulit pangsit 1 lbr + Tepung tapioka 0,005 kg' },
  { menu: 'Baso', takaran: 'Daging sapi 0,035 kg + Tepung tapioka 0,005 kg' },
  { menu: 'Tahu', takaran: 'Tahu 1 pcs + Ikan tenggiri 0,015 kg' },
  { menu: 'Kentang', takaran: 'Kentang 0,06 kg' },
  { menu: 'Kol', takaran: 'Kol 0,04 kg' },
  { menu: 'Pare', takaran: 'Pare 0,05 kg' },
  { menu: 'Telur', takaran: 'Telur 1 butir' },
];

const WIGUNA_PACKAGES = [
  { nama: 'Paket Pas Goreng / Kukus', ekivalen: '5 unit prasmanan campuran (5/7 per item)' },
  { nama: 'Paket Kenyang Goreng / Kukus', ekivalen: '7 unit prasmanan campuran (1 per item)' },
  { nama: 'Paket Mix', ekivalen: '6 unit prasmanan campuran (6/7 per item)' },
  { nama: 'Paket Jamuan', ekivalen: '20 unit prasmanan campuran (20/7 per item)' },
  { nama: 'Es Teh Manis & Es Jeruk', ekivalen: 'Minuman (tidak mengurangi stok bahan siomay)' },
];

export function MasterDataPanel({
  ingredients,
  sales,
  wasteLogs,
  onSaveIngredient,
  onGenerateDummy,
  onUploadCsv,
}: MasterDataPanelProps) {
  const [edits, setEdits] = useState<Record<string, DraftRowEdit>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [busyDummy, setBusyDummy] = useState(false);

  const getRowValues = (ing: IngredientMaster): DraftRowEdit => {
    if (edits[ing.id]) return edits[ing.id];
    const totalStok = ing.batches.reduce((sum, b) => sum + b.qty, 0);
    return {
      harga: String(ing.harga),
      leadTimeHari: String(ing.leadTimeHari),
      umurSimpanHari: String(ing.umurSimpanHari),
      stokSaatIni: String(Math.round(totalStok * 100) / 100),
      jenis: ing.jenis,
    };
  };

  const updateField = (id: string, ing: IngredientMaster, field: keyof DraftRowEdit, val: string) => {
    const current = getRowValues(ing);
    setEdits((prev) => ({
      ...prev,
      [id]: {
        ...current,
        [field]: val,
      },
    }));
  };

  const handleSaveRow = async (ing: IngredientMaster) => {
    const row = getRowValues(ing);
    setSavingId(ing.id);
    try {
      await onSaveIngredient(ing.id, {
        harga: Math.max(0, Number(row.harga) || 0),
        leadTimeHari: Math.max(1, Math.round(Number(row.leadTimeHari) || 1)),
        umurSimpanHari: Math.max(1, Math.round(Number(row.umurSimpanHari) || 1)),
        stokSaatIni: Math.max(0, Number(row.stokSaatIni) || 0),
        jenis: row.jenis,
      });
      setEdits((prev) => {
        const next = { ...prev };
        delete next[ing.id];
        return next;
      });
    } finally {
      setSavingId(null);
    }
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    await onUploadCsv(text);
    e.target.value = '';
  };

  const handleDownloadSampleCsv = () => {
    const sample = [
      'ID_Transaksi,Tanggal,Waktu,Kanal_Penjualan,Nama_Produk,Jenis_Pembelian,Jumlah',
      'TRX-001,2026-11-16,11:20,Dine-in,Siomay,Prasmanan,5',
      'TRX-002,2026-11-16,12:05,GoFood,Baso,Prasmanan,4',
      'TRX-003,2026-11-16,13:10,GrabFood,Paket Pas Goreng,Paket,2',
      'TRX-004,2026-11-17,11:45,WhatsApp,Paket Jamuan,Paket,1',
      'TRX-005,2026-11-17,14:00,Dine-in,Es Teh Manis,Minuman,3',
    ].join('\n');
    const blob = new Blob([sample], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'contoh-penjualan-siomay-wiguna.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDummyClick = async () => {
    setBusyDummy(true);
    try {
      await onGenerateDummy();
    } finally {
      setBusyDummy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Master Bahan Dapat Diedit */}
      <div className="rounded-xl border border-[#E6DDD2] bg-white">
        <div className="border-b border-[#E6DDD2] px-6 py-4">
          <h2 className="text-lg font-semibold text-[#1F1A17]">
            Master Bahan Baku Dapur &amp; Gudang PH
          </h2>
          <p className="mt-0.5 text-xs text-[#6B5E55]">
            Bahan segar disimpan di dapur (belanja sore 17.00–18.00), bahan tahan lama disimpan di gudang PH. Biaya pesan Rp15.000/order · Biaya simpan 20%/tahun.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-left text-sm">
            <thead className="border-b border-[#E6DDD2] bg-[#FAF7F2] text-xs font-medium text-[#6B5E55]">
              <tr>
                <th className="px-4 py-3">Bahan</th>
                <th className="px-3 py-3">Satuan</th>
                <th className="px-3 py-3">Harga (Rp)</th>
                <th className="px-3 py-3">Lead Time (hr)</th>
                <th className="px-3 py-3">Umur Simpan (hr)</th>
                <th className="px-3 py-3">Stok Fisik</th>
                <th className="px-3 py-3">Kategori</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFE8DE]">
              {ingredients.map((ing) => {
                const row = getRowValues(ing);
                const isDirty = Boolean(edits[ing.id]);

                return (
                  <tr key={ing.id} className="hover:bg-[#FAF7F2]/60">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <IngredientThumb nama={ing.nama} size="sm" />
                        <span className="font-medium text-[#1F1A17]">{ing.nama}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-[#6B5E55]">{ing.satuan}</td>
                    <td className="px-3 py-2.5">
                      <input
                        type="number"
                        min={0}
                        value={row.harga}
                        onChange={(e) => updateField(ing.id, ing, 'harga', e.target.value)}
                        aria-label={`Harga ${ing.nama}`}
                        className="w-28 rounded-md border border-[#E6DDD2] bg-white px-2.5 py-1.5 font-mono text-xs tabular-nums text-[#1F1A17] focus:border-[#C24E2B] focus:outline-none"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <input
                        type="number"
                        min={1}
                        value={row.leadTimeHari}
                        onChange={(e) => updateField(ing.id, ing, 'leadTimeHari', e.target.value)}
                        aria-label={`Lead time ${ing.nama}`}
                        className="w-20 rounded-md border border-[#E6DDD2] bg-white px-2.5 py-1.5 font-mono text-xs tabular-nums text-[#1F1A17] focus:border-[#C24E2B] focus:outline-none"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <input
                        type="number"
                        min={1}
                        value={row.umurSimpanHari}
                        onChange={(e) => updateField(ing.id, ing, 'umurSimpanHari', e.target.value)}
                        aria-label={`Umur simpan ${ing.nama}`}
                        className="w-20 rounded-md border border-[#E6DDD2] bg-white px-2.5 py-1.5 font-mono text-xs tabular-nums text-[#1F1A17] focus:border-[#C24E2B] focus:outline-none"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={row.stokSaatIni}
                        onChange={(e) => updateField(ing.id, ing, 'stokSaatIni', e.target.value)}
                        aria-label={`Stok ${ing.nama}`}
                        className="w-24 rounded-md border border-[#E6DDD2] bg-white px-2.5 py-1.5 font-mono text-xs tabular-nums text-[#1F1A17] focus:border-[#C24E2B] focus:outline-none"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <select
                        value={row.jenis}
                        onChange={(e) =>
                          updateField(ing.id, ing, 'jenis', e.target.value as JenisBahan)
                        }
                        aria-label={`Kategori ${ing.nama}`}
                        className="rounded-md border border-[#E6DDD2] bg-white px-2.5 py-1.5 text-xs text-[#1F1A17] focus:border-[#C24E2B] focus:outline-none"
                      >
                        <option value="segar">segar</option>
                        <option value="tahan lama">tahan lama</option>
                      </select>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        disabled={!isDirty || savingId === ing.id}
                        onClick={() => handleSaveRow(ing)}
                        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-md bg-[#C24E2B] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#A63E1F] disabled:bg-[#E6DDD2] disabled:text-[#6B5E55] whitespace-nowrap"
                      >
                        <Save className="h-3.5 w-3.5" />
                        {savingId === ing.id ? 'Menyimpan...' : 'Simpan'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Menu & Resep Produksi Siomay Wiguna */}
      <div className="rounded-xl border border-[#E6DDD2] bg-white p-6">
        <div className="flex items-center gap-2">
          <UtensilsCrossed className="h-4 w-4 text-[#C24E2B]" />
          <h3 className="text-base font-semibold text-[#1F1A17]">
            Standar Resep Menu Prasmanan &amp; Paket Siomay Wiguna (BOM)
          </h3>
        </div>
        <p className="mt-1 text-xs text-[#6B5E55]">
          Setiap 1 unit menu prasmanan otomatis memakai bumbu dasar: Kacang tanah 0,008 kg dan Gula 0,001 kg.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="divide-y divide-[#EFE8DE] rounded-lg border border-[#EFE8DE]">
            {WIGUNA_RECIPES.map((r) => (
              <div key={r.menu} className="flex flex-col gap-0.5 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-xs font-semibold text-[#1F1A17]">{r.menu}</span>
                <span className="font-mono text-[11px] text-[#6B5E55]">{r.takaran}</span>
              </div>
            ))}
          </div>

          <div className="divide-y divide-[#EFE8DE] rounded-lg border border-[#EFE8DE]">
            {WIGUNA_PACKAGES.map((p) => (
              <div key={p.nama} className="flex flex-col gap-0.5 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-xs font-semibold text-[#1F1A17]">{p.nama}</span>
                <span className="text-[11px] text-[#6B5E55]">{p.ekivalen}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Data Penjualan POS/CSV & Riwayat Waste */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-[#E6DDD2] bg-white p-6">
          <h3 className="text-base font-semibold text-[#1F1A17]">
            Rekap Penjualan Kasir &amp; Impor CSV ({formatNumber(sales.length, 0)} transaksi)
          </h3>
          <p className="mt-1 text-xs text-[#6B5E55]">
            Format kolom CSV: ID_Transaksi, Tanggal, Waktu, Kanal_Penjualan, Nama_Produk, Jenis_Pembelian, Jumlah.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleDummyClick}
              disabled={busyDummy}
              className="inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-[#C24E2B] px-4 py-2 text-xs font-medium text-white hover:bg-[#A63E1F] disabled:opacity-60 whitespace-nowrap"
            >
              <Database className="h-4 w-4" />
              {busyDummy ? 'Membangkitkan...' : 'Gunakan data dummy'}
            </button>

            <label className="inline-flex min-h-[42px] cursor-pointer items-center gap-2 rounded-lg border border-[#E6DDD2] bg-[#FAF7F2] px-4 py-2 text-xs font-medium text-[#1F1A17] hover:bg-[#F1EAE0] whitespace-nowrap">
              <Upload className="h-4 w-4 text-[#C24E2B]" />
              Unggah CSV Penjualan
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                className="sr-only"
              />
            </label>

            <button
              type="button"
              onClick={handleDownloadSampleCsv}
              className="inline-flex min-h-[42px] items-center gap-1.5 rounded-lg border border-[#E6DDD2] px-3 py-2 text-xs font-medium text-[#6B5E55] hover:bg-[#FAF7F2] hover:text-[#1F1A17] whitespace-nowrap"
            >
              <Download className="h-3.5 w-3.5" />
              Contoh CSV
            </button>
          </div>

          <div className="mt-5 overflow-x-auto rounded-lg border border-[#EFE8DE]">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#EFE8DE] bg-[#FAF7F2] text-[#6B5E55]">
                <tr>
                  <th className="px-3 py-2">Tanggal</th>
                  <th className="px-3 py-2">Produk</th>
                  <th className="px-3 py-2">Kanal</th>
                  <th className="px-3 py-2 text-right">Jumlah</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFE8DE]">
                {sales.slice(-8).reverse().map((row, idx) => (
                  <tr key={`${row.ID_Transaksi}-${idx}`}>
                    <td className="px-3 py-2 font-mono tabular-nums text-[#6B5E55]">
                      {row.Tanggal}
                    </td>
                    <td className="px-3 py-2 font-medium text-[#1F1A17]">{row.Nama_Produk}</td>
                    <td className="px-3 py-2 text-[#6B5E55]">{row.Kanal_Penjualan}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-[#1F1A17]">
                      {row.Jumlah}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Catatan Waste Bahan Kedaluwarsa */}
        <div className="rounded-xl border border-[#E6DDD2] bg-white p-6">
          <h3 className="text-base font-semibold text-[#1F1A17]">
            Catatan Susut &amp; Kedaluwarsa (Waste FIFO)
          </h3>
          <p className="mt-1 text-xs text-[#6B5E55]">
            Bahan segar yang melewati umur simpan saat tutup hari dicatat otomatis sebagai kerugian waste.
          </p>

          {wasteLogs.length === 0 ? (
            <div className="mt-4 rounded-lg border border-dashed border-[#E6DDD2] bg-[#FAF7F2]/60 p-6 text-center text-sm text-[#6B5E55]">
              Belum ada bahan kedaluwarsa yang tercatat sebagai waste.
            </div>
          ) : (
            <div className="mt-4 max-h-72 divide-y divide-[#EFE8DE] overflow-y-auto">
              {wasteLogs.map((w) => (
                <div key={w.id} className="flex items-start justify-between gap-3 py-2.5 text-xs">
                  <div>
                    <div className="font-semibold text-[#1F1A17]">
                      {w.bahan} ·{' '}
                      <span className="font-mono tabular-nums text-[#B91C1C]">
                        -{formatNumber(w.qty, 2)} {w.satuan}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[#6B5E55]">
                      {formatTanggalId(w.tanggal)} · {w.alasan}
                    </div>
                  </div>
                  <div className="font-mono font-medium tabular-nums text-[#B91C1C]">
                    {formatRupiah(w.nilaiKerugian)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
