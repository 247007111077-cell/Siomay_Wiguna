import type {
  AppState,
  DailyChartPoint,
  IngredientDailyTrend,
  IngredientMaster,
  MonthlyTrendPoint,
  PolicyCalculation,
  SalesRecord,
  SkenarioId,
  StatusStok,
  StockBatch,
  SupplierDeliveryRecord,
  SupplierIngredientMetric,
  SupplierPerformanceSummary,
  WeeklyHeatmapRow,
} from '../src/types/inventory.ts';

export const PRASMANAN_ITEMS = [
  'Siomay',
  'Baso',
  'Tahu',
  'Kentang',
  'Kol',
  'Pare',
  'Telur',
] as const;

export const PACKAGE_EQUIVALENTS: Record<string, number> = {
  'Paket Pas Goreng': 5,
  'Paket Pas Kukus': 5,
  'Paket Kenyang Goreng': 7,
  'Paket Kenyang Kukus': 7,
  'Paket Mix': 6,
  'Paket Jamuan': 20,
};

export const IGNORED_BEVERAGES = ['Es Teh Manis', 'Es Jeruk'];

export function createDefaultIngredients(currentDate: string): IngredientMaster[] {
  const raw: Array<Omit<IngredientMaster, 'id' | 'batches'>> = [
    { nama: 'Ikan tenggiri', satuan: 'kg', harga: 45000, leadTimeHari: 1, umurSimpanHari: 2, stokAwal: 3, jenis: 'segar' },
    { nama: 'Daging sapi', satuan: 'kg', harga: 110000, leadTimeHari: 1, umurSimpanHari: 2, stokAwal: 2, jenis: 'segar' },
    { nama: 'Tahu', satuan: 'pcs', harga: 1000, leadTimeHari: 1, umurSimpanHari: 2, stokAwal: 30, jenis: 'segar' },
    { nama: 'Kentang', satuan: 'kg', harga: 18000, leadTimeHari: 1, umurSimpanHari: 5, stokAwal: 4, jenis: 'segar' },
    { nama: 'Kol', satuan: 'kg', harga: 9000, leadTimeHari: 1, umurSimpanHari: 3, stokAwal: 4, jenis: 'segar' },
    { nama: 'Pare', satuan: 'kg', harga: 14000, leadTimeHari: 1, umurSimpanHari: 3, stokAwal: 3, jenis: 'segar' },
    { nama: 'Telur', satuan: 'butir', harga: 2500, leadTimeHari: 1, umurSimpanHari: 14, stokAwal: 40, jenis: 'segar' },
    { nama: 'Kulit pangsit', satuan: 'lembar', harga: 400, leadTimeHari: 1, umurSimpanHari: 3, stokAwal: 150, jenis: 'segar' },
    { nama: 'Tepung tapioka', satuan: 'kg', harga: 12000, leadTimeHari: 3, umurSimpanHari: 180, stokAwal: 20, jenis: 'tahan lama' },
    { nama: 'Kacang tanah', satuan: 'kg', harga: 30000, leadTimeHari: 3, umurSimpanHari: 90, stokAwal: 10, jenis: 'tahan lama' },
    { nama: 'Gula', satuan: 'kg', harga: 16000, leadTimeHari: 3, umurSimpanHari: 365, stokAwal: 10, jenis: 'tahan lama' },
  ];

  return raw.map((item, idx) => ({
    ...item,
    id: `ing-${idx + 1}`,
    batches: [
      {
        id: `batch-init-${idx + 1}`,
        qty: item.stokAwal,
        sisaUmurHari: item.umurSimpanHari,
        asal: 'Stok awal',
        tanggalMasuk: currentDate,
      },
    ],
  }));
}

export function addDaysISO(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function diffDaysISO(startDate: string, endDate: string): number {
  const [y1, m1, d1] = startDate.split('-').map(Number);
  const [y2, m2, d2] = endDate.split('-').map(Number);
  const t1 = Date.UTC(y1, m1 - 1, d1);
  const t2 = Date.UTC(y2, m2 - 1, d2);
  return Math.max(1, Math.round((t2 - t1) / 86400000));
}

export const INGREDIENT_SUPPLIER_MAP: Record<string, string> = {
  'Ikan tenggiri': 'Lapak Bahari Cikurubuk',
  'Daging sapi': 'Kios Daging Sapi Jaya',
  'Tahu': 'Pabrik Tahu Galunggung',
  'Kentang': 'Bandar Sayur Cikurubuk',
  'Kol': 'Bandar Sayur Cikurubuk',
  'Pare': 'Bandar Sayur Cikurubuk',
  'Telur': 'Agen Telur & Pangsit Priangan',
  'Kulit pangsit': 'Agen Telur & Pangsit Priangan',
  'Tepung tapioka': 'Distributor Gudang PH Tasik',
  'Kacang tanah': 'Distributor Gudang PH Tasik',
  'Gula': 'Distributor Gudang PH Tasik',
};

export function getSupplierForIngredient(namaBahan: string): string {
  return INGREDIENT_SUPPLIER_MAP[namaBahan] || 'Pemasok Umum Tasikmalaya';
}

export function generateInitialSupplierDeliveries(
  endDate: string,
  ingredients: IngredientMaster[]
): SupplierDeliveryRecord[] {
  const rand = seededRandom(202688);
  const records: SupplierDeliveryRecord[] = [];
  let seq = 1;

  // Pola historis pengiriman realistis untuk seluruh bahan baku utama & pendukung
  const templates: Array<{
    bahan: string;
    deliveriesCount: number;
    intervalDays: number;
    avgQty: number;
    delayChance: number;
    maxDelay: number;
  }> = [
    { bahan: 'Ikan tenggiri', deliveriesCount: 12, intervalDays: 3, avgQty: 2.2, delayChance: 0.17, maxDelay: 1 },
    { bahan: 'Daging sapi', deliveriesCount: 10, intervalDays: 4, avgQty: 1.5, delayChance: 0.2, maxDelay: 1 },
    { bahan: 'Tahu', deliveriesCount: 12, intervalDays: 3, avgQty: 26, delayChance: 0.08, maxDelay: 1 },
    { bahan: 'Kentang', deliveriesCount: 8, intervalDays: 5, avgQty: 2.8, delayChance: 0.13, maxDelay: 1 },
    { bahan: 'Kol', deliveriesCount: 8, intervalDays: 5, avgQty: 2.2, delayChance: 0.25, maxDelay: 1 },
    { bahan: 'Pare', deliveriesCount: 7, intervalDays: 6, avgQty: 2.0, delayChance: 0.15, maxDelay: 1 },
    { bahan: 'Telur', deliveriesCount: 6, intervalDays: 7, avgQty: 35, delayChance: 0.15, maxDelay: 1 },
    { bahan: 'Kulit pangsit', deliveriesCount: 10, intervalDays: 4, avgQty: 110, delayChance: 0.1, maxDelay: 1 },
    { bahan: 'Tepung tapioka', deliveriesCount: 5, intervalDays: 14, avgQty: 12, delayChance: 0.4, maxDelay: 2 },
    { bahan: 'Kacang tanah', deliveriesCount: 5, intervalDays: 14, avgQty: 8, delayChance: 0.2, maxDelay: 1 },
    { bahan: 'Gula', deliveriesCount: 4, intervalDays: 18, avgQty: 6, delayChance: 0.25, maxDelay: 1 },
  ];

  for (const tpl of templates) {
    const ing = ingredients.find((i) => i.nama === tpl.bahan);
    if (!ing) continue;
    const planned = ing.leadTimeHari;

    for (let k = tpl.deliveriesCount - 1; k >= 0; k--) {
      const receiveOffset = -(k * tpl.intervalDays + Math.floor(rand() * 2));
      const tanggalDiterima = addDaysISO(endDate, receiveOffset);
      const isDelayed = rand() < tpl.delayChance;
      const delayDays = isDelayed ? 1 + (tpl.maxDelay > 1 && rand() < 0.45 ? 1 : 0) : 0;
      const actualLeadTimeHari = planned + delayDays;
      const tanggalPesan = addDaysISO(tanggalDiterima, -actualLeadTimeHari);
      const qtyFactor = 0.8 + rand() * 0.4;
      const qty = roundOrderQty(tpl.avgQty * qtyFactor, ing.satuan);

      records.push({
        id: `DEL-${String(seq++).padStart(4, '0')}`,
        pemasok: getSupplierForIngredient(ing.nama),
        bahan: ing.nama,
        satuan: ing.satuan,
        qty,
        tanggalPesan,
        tanggalDiterima,
        plannedLeadTimeHari: planned,
        actualLeadTimeHari,
        tepatWaktu: actualLeadTimeHari <= planned,
      });
    }
  }

  return records.sort((a, b) => a.tanggalDiterima.localeCompare(b.tanggalDiterima));
}

// Pembangkit bilangan acak normal sederhana (Box-Muller) dengan seed deterministik opsional
function seededRandom(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function normalSample(rand: () => number, mean: number, stdDev: number): number {
  const u1 = Math.max(1e-7, rand());
  const u2 = rand();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return Math.max(0, Math.round(mean + z0 * stdDev));
}

export function generateDummySales(endDate: string, days = 120, seed = 202611): SalesRecord[] {
  const rand = seededRandom(seed);
  const channels = ['Dine-in', 'GoFood', 'GrabFood', 'ShopeeFood', 'WhatsApp'];
  const records: SalesRecord[] = [];
  let txCounter = 1;

  for (let offset = days - 1; offset >= 0; offset--) {
    const tanggal = addDaysISO(endDate, -offset);
    const dayOfWeek = new Date(`${tanggal}T00:00:00Z`).getUTCDay();
    const weekendBoost = dayOfWeek === 0 || dayOfWeek === 6 ? 1.25 : 1.0;

    // 7 item prasmanan (rata-rata ~4 unit/hari per item, simpangan baku ~3)
    for (const item of PRASMANAN_ITEMS) {
      const qty = normalSample(rand, 4 * weekendBoost, 3);
      if (qty > 0) {
        const hour = 10 + Math.floor(rand() * 10);
        const minute = Math.floor(rand() * 60);
        records.push({
          ID_Transaksi: `TRX-${String(txCounter++).padStart(5, '0')}`,
          Tanggal: tanggal,
          Waktu: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
          Kanal_Penjualan: channels[Math.floor(rand() * channels.length)],
          Nama_Produk: item,
          Jenis_Pembelian: 'Prasmanan',
          Jumlah: qty,
        });
      }
    }

    // Paket reguler (Pas, Kenyang, Mix) sesekali setiap hari
    const regularPackages = [
      'Paket Pas Goreng',
      'Paket Pas Kukus',
      'Paket Kenyang Goreng',
      'Paket Kenyang Kukus',
      'Paket Mix',
    ];
    for (const pkg of regularPackages) {
      if (rand() < 0.35) {
        const qty = 1 + Math.floor(rand() * 2);
        records.push({
          ID_Transaksi: `TRX-${String(txCounter++).padStart(5, '0')}`,
          Tanggal: tanggal,
          Waktu: '12:30',
          Kanal_Penjualan: channels[Math.floor(rand() * channels.length)],
          Nama_Produk: pkg,
          Jenis_Pembelian: 'Paket',
          Jumlah: qty,
        });
      }
    }

    // Sesekali ada Paket Jamuan (~setiap 14-18 hari)
    if (rand() < 0.06) {
      records.push({
        ID_Transaksi: `TRX-${String(txCounter++).padStart(5, '0')}`,
        Tanggal: tanggal,
        Waktu: '11:00',
        Kanal_Penjualan: 'WhatsApp',
        Nama_Produk: 'Paket Jamuan',
        Jenis_Pembelian: 'Paket',
        Jumlah: 1 + (rand() < 0.25 ? 1 : 0),
      });
    }

    // 2 minuman (diabaikan dalam BOM bahan siomay)
    for (const drink of IGNORED_BEVERAGES) {
      if (rand() < 0.65) {
        records.push({
          ID_Transaksi: `TRX-${String(txCounter++).padStart(5, '0')}`,
          Tanggal: tanggal,
          Waktu: '13:15',
          Kanal_Penjualan: channels[Math.floor(rand() * channels.length)],
          Nama_Produk: drink,
          Jenis_Pembelian: 'Minuman',
          Jumlah: 1 + Math.floor(rand() * 5),
        });
      }
    }
  }

  return records;
}

export function parseSalesCsv(csvText: string): { records: SalesRecord[]; error?: string } {
  const lines = csvText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    return { records: [], error: 'File CSV kosong atau tidak memiliki baris data transaksi.' };
  }

  const delimiter = lines[0].includes(';') && !lines[0].includes(',') ? ';' : ',';
  const splitRow = (line: string): string[] => {
    const out: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === delimiter && !inQuotes) {
        out.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    out.push(cur.trim());
    return out;
  };

  const headers = splitRow(lines[0]).map((h) => h.replace(/^\uFEFF/, '').trim());
  const required = [
    'ID_Transaksi',
    'Tanggal',
    'Waktu',
    'Kanal_Penjualan',
    'Nama_Produk',
    'Jenis_Pembelian',
    'Jumlah',
  ];

  const missing = required.filter((col) => !headers.includes(col));
  if (missing.length > 0) {
    return {
      records: [],
      error: `Kolom wajib CSV belum lengkap: ${missing.join(', ')}.`,
    };
  }

  const idxMap = Object.fromEntries(required.map((col) => [col, headers.indexOf(col)]));
  const records: SalesRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = splitRow(lines[i]);
    if (cols.length < headers.length) continue;
    const jumlah = Number(cols[idxMap['Jumlah']]);
    const tanggal = cols[idxMap['Tanggal']];
    if (!tanggal || !Number.isFinite(jumlah) || jumlah < 0) continue;

    records.push({
      ID_Transaksi: cols[idxMap['ID_Transaksi']] || `CSV-${i}`,
      Tanggal: tanggal,
      Waktu: cols[idxMap['Waktu']] || '12:00',
      Kanal_Penjualan: cols[idxMap['Kanal_Penjualan']] || 'Dine-in',
      Nama_Produk: cols[idxMap['Nama_Produk']],
      Jenis_Pembelian: cols[idxMap['Jenis_Pembelian']] || 'Prasmanan',
      Jumlah: jumlah,
    });
  }

  if (records.length === 0) {
    return { records: [], error: 'Tidak ada baris transaksi valid yang dapat dibaca dari CSV.' };
  }

  return { records };
}

export function getScenarioModifiers(scenario: SkenarioId): {
  demandMultiplier: number;
  leadTimePenalty: number;
  label: string;
} {
  if (scenario === 'lonjakan') {
    return {
      demandMultiplier: 1.5,
      leadTimePenalty: 0,
      label: 'Lonjakan permintaan +50% (pesanan acara)',
    };
  }
  if (scenario === 'terlambat') {
    return {
      demandMultiplier: 1.0,
      leadTimePenalty: 2,
      label: 'Pemasok terlambat +2 hari',
    };
  }
  return {
    demandMultiplier: 1.0,
    leadTimePenalty: 0,
    label: 'Normal',
  };
}

// Konversi satu baris penjualan ke ekivalen 7 item prasmanan
export function expandProductToPrasmananUnits(
  namaProduk: string,
  jenisPembelian: string,
  jumlah: number
): Record<string, number> {
  const out: Record<string, number> = {
    Siomay: 0,
    Baso: 0,
    Tahu: 0,
    Kentang: 0,
    Kol: 0,
    Pare: 0,
    Telur: 0,
  };
  if (jumlah <= 0) return out;

  const lowerName = namaProduk.trim().toLowerCase();
  const lowerJenis = jenisPembelian.trim().toLowerCase();

  // Abaikan minuman
  if (
    lowerJenis === 'minuman' ||
    lowerName.includes('teh') ||
    lowerName.includes('jeruk') ||
    lowerName.includes('minum')
  ) {
    return out;
  }

  // Cek paket
  if (lowerName.includes('jamuan')) {
    const perItem = (20 * jumlah) / 7;
    for (const item of PRASMANAN_ITEMS) out[item] = perItem;
    return out;
  }
  if (lowerName.includes('kenyang')) {
    const perItem = (7 * jumlah) / 7;
    for (const item of PRASMANAN_ITEMS) out[item] = perItem;
    return out;
  }
  if (lowerName.includes('mix')) {
    const perItem = (6 * jumlah) / 7;
    for (const item of PRASMANAN_ITEMS) out[item] = perItem;
    return out;
  }
  if (lowerName.includes('pas')) {
    const perItem = (5 * jumlah) / 7;
    for (const item of PRASMANAN_ITEMS) out[item] = perItem;
    return out;
  }

  // Cek item prasmanan individual
  for (const item of PRASMANAN_ITEMS) {
    if (lowerName.includes(item.toLowerCase())) {
      out[item] = jumlah;
      return out;
    }
  }

  return out;
}

// Konversi kebutuhan item prasmanan ke kebutuhan 11 bahan baku berdasarkan resep BOM
export function expandPrasmananToIngredients(prasmananUnits: Record<string, number>): Record<string, number> {
  const totalPrasmanan = Object.values(prasmananUnits).reduce((a, b) => a + b, 0);
  const siomay = prasmananUnits['Siomay'] || 0;
  const baso = prasmananUnits['Baso'] || 0;
  const tahu = prasmananUnits['Tahu'] || 0;
  const kentang = prasmananUnits['Kentang'] || 0;
  const kol = prasmananUnits['Kol'] || 0;
  const pare = prasmananUnits['Pare'] || 0;
  const telur = prasmananUnits['Telur'] || 0;

  return {
    'Ikan tenggiri': siomay * 0.04 + tahu * 0.015,
    'Daging sapi': baso * 0.035,
    'Tahu': tahu * 1,
    'Kentang': kentang * 0.06,
    'Kol': kol * 0.04,
    'Pare': pare * 0.05,
    'Telur': telur * 1,
    'Kulit pangsit': siomay * 1,
    'Tepung tapioka': siomay * 0.005 + baso * 0.005,
    'Kacang tanah': totalPrasmanan * 0.008,
    'Gula': totalPrasmanan * 0.001,
  };
}

export interface DailySeriesEntry {
  tanggal: string;
  prasmananByItem: Record<string, number>;
  totalPrasmanan: number;
  ingredientsUsage: Record<string, number>;
}

export function buildDailyUsageSeries(sales: SalesRecord[]): DailySeriesEntry[] {
  if (sales.length === 0) return [];

  const byDate = new Map<string, Record<string, number>>();
  for (const row of sales) {
    const existing = byDate.get(row.Tanggal) || {
      Siomay: 0,
      Baso: 0,
      Tahu: 0,
      Kentang: 0,
      Kol: 0,
      Pare: 0,
      Telur: 0,
    };
    const expanded = expandProductToPrasmananUnits(row.Nama_Produk, row.Jenis_Pembelian, row.Jumlah);
    for (const item of PRASMANAN_ITEMS) {
      existing[item] += expanded[item];
    }
    byDate.set(row.Tanggal, existing);
  }

  const sortedDates = Array.from(byDate.keys()).sort();
  return sortedDates.map((tanggal) => {
    const prasmananByItem = byDate.get(tanggal)!;
    const totalPrasmanan = Object.values(prasmananByItem).reduce((a, b) => a + b, 0);
    const ingredientsUsage = expandPrasmananToIngredients(prasmananByItem);
    return {
      tanggal,
      prasmananByItem,
      totalPrasmanan,
      ingredientsUsage,
    };
  });
}

export function meanAndStdDev(values: number[]): { mean: number; stdDev: number } {
  if (values.length === 0) return { mean: 0, stdDev: 0 };
  const mean = values.reduce((acc, v) => acc + v, 0) / values.length;
  if (values.length === 1) return { mean, stdDev: 0 };
  const variance =
    values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (values.length - 1);
  return { mean, stdDev: Math.sqrt(variance) };
}

export function getIngredientStockStats(ing: IngredientMaster): {
  totalStock: number;
  minSisaUmurHari: number | null;
  nearExpiryQty: number;
} {
  const validBatches = ing.batches.filter((b) => b.qty > 0.0001);
  const totalStock = validBatches.reduce((sum, b) => sum + b.qty, 0);
  if (validBatches.length === 0) {
    return { totalStock: 0, minSisaUmurHari: null, nearExpiryQty: 0 };
  }
  const minSisaUmurHari = Math.min(...validBatches.map((b) => b.sisaUmurHari));
  const nearExpiryQty = validBatches
    .filter((b) => b.sisaUmurHari <= 1)
    .reduce((sum, b) => sum + b.qty, 0);
  return { totalStock, minSisaUmurHari, nearExpiryQty };
}

function roundOrderQty(qty: number, satuan: string): number {
  if (qty <= 0) return 0;
  if (satuan === 'pcs' || satuan === 'butir' || satuan === 'lembar') {
    return Math.ceil(qty);
  }
  return Math.round(qty * 100) / 100;
}

export function findIngredientByName(
  ingredients: IngredientMaster[],
  queryName: string
): IngredientMaster | undefined {
  const q = queryName.trim().toLowerCase();
  return (
    ingredients.find((i) => i.nama.toLowerCase() === q) ||
    ingredients.find((i) => i.nama.toLowerCase().includes(q) || q.includes(i.nama.toLowerCase()))
  );
}

export function calculatePolicyForIngredient(
  state: AppState,
  ingredient: IngredientMaster
): PolicyCalculation {
  const series = buildDailyUsageSeries(state.sales);
  const last7 = series.slice(-7);
  const { demandMultiplier, leadTimePenalty } = getScenarioModifiers(state.config.scenario);

  const dailyValues = last7.map((d) => (d.ingredientsUsage[ingredient.nama] || 0) * demandMultiplier);
  const { mean: dBar, stdDev: sigma } = meanAndStdDev(dailyValues);

  const effectiveLeadTime = Math.max(1, ingredient.leadTimeHari + leadTimePenalty);
  const zScore = state.config.zScore;
  const safetyStock = zScore * sigma * Math.sqrt(effectiveLeadTime);

  const { totalStock, minSisaUmurHari, nearExpiryQty } = getIngredientStockStats(ingredient);

  let targetStok: number | null = null;
  let rop: number | null = null;
  let eoq: number | null = null;
  let annualDemand: number | null = null;
  const holdingCostPerUnit = state.config.holdingCostRate * ingredient.harga;
  let recommendedOrderQty = 0;

  if (ingredient.jenis === 'segar') {
    targetStok = dBar + safetyStock;
    const deficit = Math.max(0, targetStok - totalStock);
    recommendedOrderQty = roundOrderQty(deficit, ingredient.satuan);
  } else {
    rop = dBar * effectiveLeadTime + safetyStock;
    annualDemand = dBar * 365;
    eoq =
      holdingCostPerUnit > 0 && annualDemand > 0
        ? Math.sqrt((2 * annualDemand * state.config.orderingCost) / holdingCostPerUnit)
        : 0;
    if (totalStock <= rop) {
      const need = Math.max(eoq, rop - totalStock);
      recommendedOrderQty = roundOrderQty(need, ingredient.satuan);
    }
  }

  let status: StatusStok = 'Aman';
  if (ingredient.jenis === 'segar') {
    const tgt = targetStok ?? 0;
    if (totalStock <= 0 || totalStock < tgt * 0.5 || totalStock < dBar) {
      status = 'Kritis';
    } else if (totalStock < tgt || nearExpiryQty > 0) {
      status = 'Waspada';
    }
  } else {
    const ropVal = rop ?? 0;
    if (totalStock <= 0 || totalStock <= ropVal) {
      status = 'Kritis';
    } else if (totalStock <= ropVal * 1.25) {
      status = 'Waspada';
    }
  }

  const estimatedOrderCost = Math.round(recommendedOrderQty * ingredient.harga);
  const nearExpiryRisk = minSisaUmurHari !== null && minSisaUmurHari <= 1 && totalStock > 0;

  return {
    bahanId: ingredient.id,
    nama: ingredient.nama,
    satuan: ingredient.satuan,
    jenis: ingredient.jenis,
    harga: ingredient.harga,
    stokSaatIni: Math.round(totalStock * 1000) / 1000,
    minSisaUmurHari,
    nearExpiryQty: Math.round(nearExpiryQty * 1000) / 1000,
    dBar,
    sigma,
    baseLeadTime: ingredient.leadTimeHari,
    effectiveLeadTime,
    zScore,
    safetyStock,
    targetStok,
    rop,
    eoq,
    annualDemand,
    holdingCostPerUnit,
    recommendedOrderQty,
    estimatedOrderCost,
    status,
    nearExpiryRisk,
  };
}

export function buildChartData(state: AppState): DailyChartPoint[] {
  const series = buildDailyUsageSeries(state.sales);
  if (series.length === 0) return [];

  const { demandMultiplier } = getScenarioModifiers(state.config.scenario);
  const recent = series.slice(-30);
  const startIdx = Math.max(0, series.length - 30);

  const points: DailyChartPoint[] = recent.map((entry, i) => {
    const fullIdx = startIdx + i;
    const windowStart = Math.max(0, fullIdx - 6);
    const windowSlice = series.slice(windowStart, fullIdx + 1);
    const ma7 =
      windowSlice.reduce((sum, w) => sum + w.totalPrasmanan, 0) / windowSlice.length;

    return {
      tanggal: entry.tanggal,
      totalUnitPrasmanan: Math.round(entry.totalPrasmanan * 10) / 10,
      movingAvg7: Math.round(ma7 * 10) / 10,
      isForecast: false,
    };
  });

  // Tambahkan proyeksi 3 hari ke depan berbasis rata-rata bergerak 7 hari terakhir + pengali skenario
  const last7 = series.slice(-7);
  const baseForecast =
    (last7.reduce((sum, d) => sum + d.totalPrasmanan, 0) / Math.max(1, last7.length)) *
    demandMultiplier;
  const lastDate = recent[recent.length - 1].tanggal;

  for (let h = 1; h <= 3; h++) {
    points.push({
      tanggal: addDaysISO(lastDate, h),
      totalUnitPrasmanan: Math.round(baseForecast * 10) / 10,
      movingAvg7: Math.round(baseForecast * 10) / 10,
      isForecast: true,
    });
  }

  return points;
}

export function buildIngredientTrends(
  state: AppState
): Record<string, IngredientDailyTrend[]> {
  const series = buildDailyUsageSeries(state.sales);
  const recent = series.slice(-30);
  const result: Record<string, IngredientDailyTrend[]> = {};

  if (recent.length === 0) {
    for (const ing of state.ingredients) {
      result[ing.nama] = [];
    }
    return result;
  }

  for (const ing of state.ingredients) {
    const usages = recent.map((d) => d.ingredientsUsage[ing.nama] || 0);
    const { mean: meanUsage, stdDev: sigmaUsage } = meanAndStdDev(usages);
    const { totalStock: currentLiveStock } = getIngredientStockStats(ing);

    let simStock = Math.max(ing.stokAwal, meanUsage * 2);
    const restockTrigger =
      ing.jenis === 'segar'
        ? meanUsage * 1.15 + state.config.zScore * sigmaUsage * 0.5
        : meanUsage * ing.leadTimeHari +
          state.config.zScore * sigmaUsage * Math.sqrt(ing.leadTimeHari);
    const restockTarget =
      ing.jenis === 'segar'
        ? Math.max(ing.stokAwal, meanUsage * 2.4 + state.config.zScore * sigmaUsage)
        : Math.max(ing.stokAwal, restockTrigger + meanUsage * 10);

    const points: IngredientDailyTrend[] = recent.map((day, idx) => {
      const pemakaian = usages[idx];
      simStock = Math.max(0, simStock - pemakaian);

      // Rekonstruksi belanja sore historis agar grafik menunjukkan fluktuasi stok yang realistis
      if (idx < recent.length - 1 && simStock <= restockTrigger) {
        simStock = restockTarget;
      }

      let finalLevel = simStock;
      const recorded = state.stockSnapshots?.[day.tanggal]?.[ing.nama];
      if (typeof recorded === 'number') {
        finalLevel = recorded;
      } else if (idx === recent.length - 1) {
        finalLevel = currentLiveStock;
      }

      return {
        tanggal: day.tanggal,
        stokLevel: Math.round(finalLevel * 1000) / 1000,
        pemakaian: Math.round(pemakaian * 1000) / 1000,
      };
    });

    result[ing.nama] = points;
  }

  return result;
}

export function buildWeeklyUsageHeatmap(state: AppState): WeeklyHeatmapRow[] {
  const series = buildDailyUsageSeries(state.sales);
  const weekdayOrder = [
    { utcDay: 1, dayIndex: 1, dayShort: 'Sen', dayFull: 'Senin' },
    { utcDay: 2, dayIndex: 2, dayShort: 'Sel', dayFull: 'Selasa' },
    { utcDay: 3, dayIndex: 3, dayShort: 'Rab', dayFull: 'Rabu' },
    { utcDay: 4, dayIndex: 4, dayShort: 'Kam', dayFull: 'Kamis' },
    { utcDay: 5, dayIndex: 5, dayShort: 'Jum', dayFull: 'Jumat' },
    { utcDay: 6, dayIndex: 6, dayShort: 'Sab', dayFull: 'Sabtu' },
    { utcDay: 0, dayIndex: 7, dayShort: 'Min', dayFull: 'Minggu' },
  ];

  return state.ingredients.map((ing) => {
    const sums = new Map<number, { total: number; count: number }>();
    for (const w of weekdayOrder) sums.set(w.utcDay, { total: 0, count: 0 });

    for (const day of series) {
      const utcDay = new Date(`${day.tanggal}T00:00:00Z`).getUTCDay();
      const bucket = sums.get(utcDay);
      if (bucket) {
        bucket.total += day.ingredientsUsage[ing.nama] || 0;
        bucket.count += 1;
      }
    }

    const rawAverages = weekdayOrder.map((w) => {
      const b = sums.get(w.utcDay)!;
      const avg = b.count > 0 ? b.total / b.count : 0;
      return { ...w, avgUsage: Math.round(avg * 1000) / 1000 };
    });

    const vals = rawAverages.map((d) => d.avgUsage);
    const minVal = Math.min(...vals);
    const maxVal = Math.max(...vals);
    const span = maxVal - minVal;
    const weeklyAvg =
      vals.length > 0 ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 1000) / 1000 : 0;

    let peakDay = rawAverages[0]?.dayFull || 'Sabtu';
    let bestVal = -1;
    for (const d of rawAverages) {
      if (d.avgUsage > bestVal) {
        bestVal = d.avgUsage;
        peakDay = d.dayFull;
      }
    }

    const days = rawAverages.map((d) => ({
      dayIndex: d.dayIndex,
      dayShort: d.dayShort,
      dayFull: d.dayFull,
      avgUsage: d.avgUsage,
      intensity: span > 1e-6 ? (d.avgUsage - minVal) / span : d.avgUsage > 0 ? 0.5 : 0,
      isPeak: maxVal > 0 && d.avgUsage === maxVal,
    }));

    return {
      bahanId: ing.id,
      nama: ing.nama,
      satuan: ing.satuan,
      jenis: ing.jenis,
      peakDay,
      weeklyAvg,
      days,
    };
  });
}

const MONTH_SHORT_ID = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];

const MONTH_FULL_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

export function buildMonthlyTrends(state: AppState): MonthlyTrendPoint[] {
  const series = buildDailyUsageSeries(state.sales);
  if (series.length === 0) return [];

  const buckets = new Map<
    string,
    {
      activeDays: number;
      salesVolume: number;
      ingredientsUsage: Record<string, number>;
    }
  >();

  for (const day of series) {
    const monthKey = day.tanggal.slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(monthKey)) continue;

    let bucket = buckets.get(monthKey);
    if (!bucket) {
      bucket = {
        activeDays: 0,
        salesVolume: 0,
        ingredientsUsage: Object.fromEntries(state.ingredients.map((i) => [i.nama, 0])),
      };
      buckets.set(monthKey, bucket);
    }

    bucket.activeDays += 1;
    bucket.salesVolume += day.totalPrasmanan;
    for (const ing of state.ingredients) {
      bucket.ingredientsUsage[ing.nama] =
        (bucket.ingredientsUsage[ing.nama] || 0) + (day.ingredientsUsage[ing.nama] || 0);
    }
  }

  const sortedKeys = Array.from(buckets.keys()).sort();

  const rawMonths = sortedKeys.map((monthKey) => {
    const [yearStr, monthStr] = monthKey.split('-');
    const mIdx = Math.max(0, Math.min(11, Number(monthStr) - 1));
    const b = buckets.get(monthKey)!;

    const roundedUsage: Record<string, number> = {};
    for (const ing of state.ingredients) {
      roundedUsage[ing.nama] = Math.round((b.ingredientsUsage[ing.nama] || 0) * 100) / 100;
    }

    return {
      monthKey,
      monthShort: `${MONTH_SHORT_ID[mIdx]} ${yearStr}`,
      monthFull: `${MONTH_FULL_ID[mIdx]} ${yearStr}`,
      activeDays: b.activeDays,
      salesVolume: Math.round(b.salesVolume * 10) / 10,
      avgDailySales: Math.round((b.salesVolume / Math.max(1, b.activeDays)) * 10) / 10,
      ingredientsUsage: roundedUsage,
    };
  });

  return rawMonths.map((curr, idx) => {
    const prev = idx > 0 ? rawMonths[idx - 1] : null;
    const salesMoMPct =
      prev && prev.salesVolume > 0
        ? Math.round(((curr.salesVolume - prev.salesVolume) / prev.salesVolume) * 1000) / 10
        : null;

    const ingredientsMoMPct: Record<string, number | null> = {};
    for (const ing of state.ingredients) {
      const currVal = curr.ingredientsUsage[ing.nama] || 0;
      const prevVal = prev ? prev.ingredientsUsage[ing.nama] || 0 : 0;
      ingredientsMoMPct[ing.nama] =
        prev && prevVal > 0 ? Math.round(((currVal - prevVal) / prevVal) * 1000) / 10 : null;
    }

    return {
      ...curr,
      salesMoMPct,
      ingredientsMoMPct,
    };
  });
}

export function buildSupplierPerformance(state: AppState): SupplierPerformanceSummary[] {
  const deliveries = state.supplierDeliveries || [];
  if (deliveries.length === 0) return [];

  const bySupplier = new Map<string, SupplierDeliveryRecord[]>();
  for (const d of deliveries) {
    const list = bySupplier.get(d.pemasok) || [];
    list.push(d);
    bySupplier.set(d.pemasok, list);
  }

  const ingredientLookup = new Map(state.ingredients.map((i) => [i.nama, i]));
  const summaries: SupplierPerformanceSummary[] = [];

  for (const [pemasok, items] of bySupplier.entries()) {
    const sorted = [...items].sort((a, b) => a.tanggalDiterima.localeCompare(b.tanggalDiterima));
    const latest = sorted[sorted.length - 1];

    const totalPengiriman = sorted.length;
    const actualSum = sorted.reduce((sum, r) => sum + r.actualLeadTimeHari, 0);
    const targetSum = sorted.reduce((sum, r) => sum + r.plannedLeadTimeHari, 0);
    const onTimeCount = sorted.filter((r) => r.tepatWaktu).length;

    const rataRataLeadTimeAktual = Math.round((actualSum / totalPengiriman) * 100) / 100;
    const rataRataLeadTimeTarget = Math.round((targetSum / totalPengiriman) * 100) / 100;
    const selisihRataRataHari =
      Math.round((rataRataLeadTimeAktual - rataRataLeadTimeTarget) * 100) / 100;
    const ketepatanWaktuPct = Math.round((onTimeCount / totalPengiriman) * 1000) / 10;
    const leadTimeMin = Math.min(...sorted.map((r) => r.actualLeadTimeHari));
    const leadTimeMax = Math.max(...sorted.map((r) => r.actualLeadTimeHari));

    // Rincian per bahan baku yang dipasok oleh supplier ini
    const byBahan = new Map<string, SupplierDeliveryRecord[]>();
    for (const r of sorted) {
      const bList = byBahan.get(r.bahan) || [];
      bList.push(r);
      byBahan.set(r.bahan, bList);
    }

    const rincianBahan: SupplierIngredientMetric[] = Array.from(byBahan.entries()).map(
      ([bahan, bItems]) => {
        const latestB = bItems[bItems.length - 1];
        const ingMeta = ingredientLookup.get(bahan);
        const avgActual =
          Math.round(
            (bItems.reduce((s, x) => s + x.actualLeadTimeHari, 0) / bItems.length) * 100
          ) / 100;
        const avgTarget =
          Math.round(
            (bItems.reduce((s, x) => s + x.plannedLeadTimeHari, 0) / bItems.length) * 100
          ) / 100;
        const otd =
          Math.round(
            (bItems.filter((x) => x.tepatWaktu).length / bItems.length) * 1000
          ) / 10;

        return {
          bahan,
          satuan: latestB.satuan,
          jenis: ingMeta?.jenis || 'segar',
          totalPengiriman: bItems.length,
          leadTimeAktualTerbaru: latestB.actualLeadTimeHari,
          rataRataLeadTimeAktual: avgActual,
          rataRataLeadTimeTarget: avgTarget,
          ketepatanWaktuPct: otd,
        };
      }
    );

    const hasDurable = rincianBahan.some((r) => r.jenis === 'tahan lama');
    const kategori: 'Segar Harian' | 'Gudang PH' = hasDurable ? 'Gudang PH' : 'Segar Harian';

    let statusKinerja: SupplierPerformanceSummary['statusKinerja'] = 'Andal';
    if (ketepatanWaktuPct < 70 || selisihRataRataHari >= 0.6) {
      statusKinerja = 'Sering Terlambat';
    } else if (ketepatanWaktuPct < 85 || selisihRataRataHari > 0.25) {
      statusKinerja = 'Perlu Pantau';
    }

    summaries.push({
      pemasok,
      kategori,
      bahanUtama: rincianBahan.map((r) => r.bahan),
      totalPengiriman,
      leadTimeAktualTerbaru: latest.actualLeadTimeHari,
      tanggalTerbaru: latest.tanggalDiterima,
      rataRataLeadTimeAktual,
      rataRataLeadTimeTarget,
      leadTimeMin,
      leadTimeMax,
      selisihRataRataHari,
      ketepatanWaktuPct,
      statusKinerja,
      rincianBahan,
    });
  }

  return summaries.sort((a, b) => a.kategori.localeCompare(b.kategori));
}

export function simulateAdvanceOneDay(state: AppState): {
  nextState: AppState;
  dayReport: {
    newDate: string;
    arrivedOrders: number;
    expiredBatchesCount: number;
    totalWasteRp: number;
  };
} {
  const newDate = addDaysISO(state.config.currentDate, 1);
  const { demandMultiplier } = getScenarioModifiers(state.config.scenario);
  const rand = seededRandom(state.config.dayCounter * 9973 + 42);
  const channels = ['Dine-in', 'GoFood', 'GrabFood', 'ShopeeFood', 'WhatsApp'];

  // 1. Bangkitkan penjualan hari baru sesuai pola (~4 unit/hari per item, stdDev ~3) * pengali skenario
  const newSalesRows: SalesRecord[] = [];
  let seq = state.sales.length + 1;

  for (const item of PRASMANAN_ITEMS) {
    const qty = Math.round(normalSample(rand, 4, 3) * demandMultiplier);
    if (qty > 0) {
      newSalesRows.push({
        ID_Transaksi: `TRX-${String(seq++).padStart(5, '0')}`,
        Tanggal: newDate,
        Waktu: '14:00',
        Kanal_Penjualan: channels[Math.floor(rand() * channels.length)],
        Nama_Produk: item,
        Jenis_Pembelian: 'Prasmanan',
        Jumlah: qty,
      });
    }
  }

  if (rand() < 0.4) {
    newSalesRows.push({
      ID_Transaksi: `TRX-${String(seq++).padStart(5, '0')}`,
      Tanggal: newDate,
      Waktu: '12:15',
      Kanal_Penjualan: channels[Math.floor(rand() * channels.length)],
      Nama_Produk: 'Paket Mix',
      Jenis_Pembelian: 'Paket',
      Jumlah: Math.max(1, Math.round(1 * demandMultiplier)),
    });
  }

  if (state.config.scenario === 'lonjakan' || rand() < 0.08) {
    newSalesRows.push({
      ID_Transaksi: `TRX-${String(seq++).padStart(5, '0')}`,
      Tanggal: newDate,
      Waktu: '11:30',
      Kanal_Penjualan: 'WhatsApp',
      Nama_Produk: 'Paket Jamuan',
      Jenis_Pembelian: 'Paket',
      Jumlah: 1,
    });
  }

  // Hitung total kebutuhan bahan hari baru dari newSalesRows
  const dayPrasmanan: Record<string, number> = {
    Siomay: 0,
    Baso: 0,
    Tahu: 0,
    Kentang: 0,
    Kol: 0,
    Pare: 0,
    Telur: 0,
  };
  for (const r of newSalesRows) {
    const exp = expandProductToPrasmananUnits(r.Nama_Produk, r.Jenis_Pembelian, r.Jumlah);
    for (const item of PRASMANAN_ITEMS) dayPrasmanan[item] += exp[item];
  }
  const dayIngredientNeed = expandPrasmananToIngredients(dayPrasmanan);

  // 2. Proses kedatangan pesanan yang telah disetujui dan mencapai lead time
  const remainingIncoming = [];
  const arrivedByBahan = new Map<string, number>();
  const newDeliveries: SupplierDeliveryRecord[] = [];
  let arrivedOrders = 0;

  const ingMasterByName = new Map(state.ingredients.map((i) => [i.nama, i]));

  for (const ord of state.incomingOrders) {
    const sisa = ord.sisaLeadTimeHari - 1;
    if (sisa <= 0) {
      arrivedOrders++;
      arrivedByBahan.set(ord.bahan, (arrivedByBahan.get(ord.bahan) || 0) + ord.qty);

      const ingMeta = ingMasterByName.get(ord.bahan);
      const planned = ord.plannedLeadTimeHari ?? ingMeta?.leadTimeHari ?? 1;
      const actual = diffDaysISO(ord.tanggalPesan, newDate);
      newDeliveries.push({
        id: `DEL-${newDate}-${arrivedOrders}-${Math.floor(rand() * 1000)}`,
        pemasok: ord.pemasok || getSupplierForIngredient(ord.bahan),
        bahan: ord.bahan,
        satuan: ord.satuan,
        qty: ord.qty,
        tanggalPesan: ord.tanggalPesan,
        tanggalDiterima: newDate,
        plannedLeadTimeHari: planned,
        actualLeadTimeHari: actual,
        tepatWaktu: actual <= planned,
      });
    } else {
      remainingIncoming.push({ ...ord, sisaLeadTimeHari: sisa });
    }
  }

  // 3. Kurangi stok FIFO per bahan, turunkan sisa umur simpan batch, catat waste jika <= 0
  const newWasteLogs = [...state.wasteLogs];
  let expiredBatchesCount = 0;
  let dayWasteRp = 0;

  const nextIngredients: IngredientMaster[] = state.ingredients.map((ing) => {
    const updatedBatches: StockBatch[] = ing.batches
      .map((b) => ({ ...b }))
      .sort((a, b) => a.sisaUmurHari - b.sisaUmurHari);

    // Tambahkan barang datang pagi hari
    const arrivedQty = arrivedByBahan.get(ing.nama) || 0;
    if (arrivedQty > 0) {
      updatedBatches.push({
        id: `batch-${newDate}-${ing.id}-${Math.floor(rand() * 10000)}`,
        qty: arrivedQty,
        sisaUmurHari: ing.umurSimpanHari,
        asal: 'Pembelian disetujui',
        tanggalMasuk: newDate,
      });
    }

    // Kurangi pemakaian produksi hari ini secara FIFO
    let remainingToConsume = dayIngredientNeed[ing.nama] || 0;
    for (const batch of updatedBatches) {
      if (remainingToConsume <= 0) break;
      const take = Math.min(batch.qty, remainingToConsume);
      batch.qty = Math.round((batch.qty - take) * 10000) / 10000;
      remainingToConsume = Math.round((remainingToConsume - take) * 10000) / 10000;
    }

    // Turunkan sisa umur simpan -1 hari; yang <= 0 dibuang jadi waste
    const survivingBatches: StockBatch[] = [];
    for (const batch of updatedBatches) {
      if (batch.qty <= 0.0001) continue;
      const nextAge = batch.sisaUmurHari - 1;
      if (nextAge <= 0) {
        const nilaiKerugian = Math.round(batch.qty * ing.harga);
        expiredBatchesCount++;
        dayWasteRp += nilaiKerugian;
        newWasteLogs.unshift({
          id: `waste-${newDate}-${ing.id}-${Math.floor(rand() * 10000)}`,
          tanggal: newDate,
          bahan: ing.nama,
          satuan: ing.satuan,
          qty: Math.round(batch.qty * 100) / 100,
          nilaiKerugian,
          alasan: `Melewati umur simpan (${ing.umurSimpanHari} hari)`,
        });
      } else {
        survivingBatches.push({ ...batch, sisaUmurHari: nextAge });
      }
    }

    return {
      ...ing,
      batches: survivingBatches,
    };
  });

  const newDaySnapshots: Record<string, number> = {};
  for (const ing of nextIngredients) {
    const { totalStock } = getIngredientStockStats(ing);
    newDaySnapshots[ing.nama] = Math.round(totalStock * 1000) / 1000;
  }

  const nextState: AppState = {
    ...state,
    config: {
      ...state.config,
      currentDate: newDate,
      dayCounter: state.config.dayCounter + 1,
    },
    ingredients: nextIngredients,
    sales: [...state.sales, ...newSalesRows],
    incomingOrders: remainingIncoming,
    wasteLogs: newWasteLogs.slice(0, 200),
    stockSnapshots: {
      ...(state.stockSnapshots || {}),
      [newDate]: newDaySnapshots,
    },
    supplierDeliveries: [
      ...(state.supplierDeliveries || []),
      ...newDeliveries,
    ].slice(-300),
  };

  return {
    nextState,
    dayReport: {
      newDate,
      arrivedOrders,
      expiredBatchesCount,
      totalWasteRp: dayWasteRp,
    },
  };
}
