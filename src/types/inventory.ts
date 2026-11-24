export type JenisBahan = 'segar' | 'tahan lama';

export type SkenarioId = 'normal' | 'lonjakan' | 'terlambat';

export type StatusStok = 'Aman' | 'Waspada' | 'Kritis';

export type UserRole = 'pemilik' | 'manajer_dapur' | 'akuntan';

export interface AuthUser {
  id: string;
  nama: string;
  username: string;
  role: UserRole;
  roleLabel: string;
  createdAt: string;
}

export interface StockBatch {
  id: string;
  qty: number;
  sisaUmurHari: number;
  asal: string;
  tanggalMasuk: string;
}

export interface IngredientMaster {
  id: string;
  nama: string;
  satuan: string;
  harga: number;
  leadTimeHari: number;
  umurSimpanHari: number;
  stokAwal: number;
  jenis: JenisBahan;
  batches: StockBatch[];
}

export interface SalesRecord {
  ID_Transaksi: string;
  Tanggal: string; // YYYY-MM-DD
  Waktu: string; // HH:mm
  Kanal_Penjualan: string;
  Nama_Produk: string;
  Jenis_Pembelian: string;
  Jumlah: number;
}

export interface SimulationConfig {
  zScore: number; // default 1.65 (95% service level)
  orderingCost: number; // S = Rp15.000
  holdingCostRate: number; // H rate = 0.20 (20% per tahun)
  scenario: SkenarioId;
  currentDate: string; // YYYY-MM-DD
  dayCounter: number;
}

export interface PolicyCalculation {
  bahanId: string;
  nama: string;
  satuan: string;
  jenis: JenisBahan;
  harga: number;
  stokSaatIni: number;
  minSisaUmurHari: number | null;
  nearExpiryQty: number;
  dBar: number; // rata-rata harian 7 hari (termasuk pengali skenario)
  sigma: number; // simpangan baku 7 hari
  baseLeadTime: number;
  effectiveLeadTime: number;
  zScore: number;
  safetyStock: number;
  targetStok: number | null; // khusus bahan segar
  rop: number | null; // khusus bahan tahan lama
  eoq: number | null; // khusus bahan tahan lama
  annualDemand: number | null;
  holdingCostPerUnit: number;
  recommendedOrderQty: number;
  estimatedOrderCost: number;
  status: StatusStok;
  nearExpiryRisk: boolean;
}

export interface PurchaseDraft {
  id: string;
  tanggalBuat: string;
  bahan: string;
  satuan: string;
  qty: number;
  hargaSatuan: number;
  estimasiBiaya: number;
  leadTimeHari: number;
  alasan: string;
  status: 'Menunggu persetujuan' | 'Disetujui' | 'Ditolak';
  diputuskanPada?: string;
  diputuskanOleh?: string;
}

export interface IncomingOrder {
  id: string;
  bahan: string;
  satuan: string;
  qty: number;
  sisaLeadTimeHari: number;
  plannedLeadTimeHari?: number;
  pemasok?: string;
  tanggalPesan: string;
}

export interface SupplierDeliveryRecord {
  id: string;
  pemasok: string;
  bahan: string;
  satuan: string;
  qty: number;
  tanggalPesan: string;
  tanggalDiterima: string;
  plannedLeadTimeHari: number;
  actualLeadTimeHari: number;
  tepatWaktu: boolean;
}

export interface SupplierIngredientMetric {
  bahan: string;
  satuan: string;
  jenis: JenisBahan;
  totalPengiriman: number;
  leadTimeAktualTerbaru: number;
  rataRataLeadTimeAktual: number;
  rataRataLeadTimeTarget: number;
  ketepatanWaktuPct: number;
}

export interface SupplierPerformanceSummary {
  pemasok: string;
  kategori: 'Segar Harian' | 'Gudang PH';
  bahanUtama: string[];
  totalPengiriman: number;
  leadTimeAktualTerbaru: number;
  tanggalTerbaru: string;
  rataRataLeadTimeAktual: number;
  rataRataLeadTimeTarget: number;
  leadTimeMin: number;
  leadTimeMax: number;
  selisihRataRataHari: number;
  ketepatanWaktuPct: number;
  statusKinerja: 'Andal' | 'Perlu Pantau' | 'Sering Terlambat';
  rincianBahan: SupplierIngredientMetric[];
}

export interface RiskFlag {
  id: string;
  bahan: string;
  jenis: 'stok_kritis' | 'mendekati_kedaluwarsa';
  alasan: string;
  tanggal: string;
}

export interface AgentStepLog {
  id: string;
  stepNumber: number;
  phase: 'Amati' | 'Putuskan' | 'Bertindak' | 'Laporkan' | 'Error';
  tool: string;
  input: unknown;
  output: unknown;
  alasan: string;
  timestamp: string;
}

export interface AgentRunRecord {
  id: string;
  runAt: string;
  simulationDate: string;
  scenario: SkenarioId;
  summaryReport: string;
  steps: AgentStepLog[];
  error?: string;
}

export interface WasteLog {
  id: string;
  tanggal: string;
  bahan: string;
  satuan: string;
  qty: number;
  nilaiKerugian: number;
  alasan: string;
}

export interface DailyChartPoint {
  tanggal: string;
  totalUnitPrasmanan: number;
  movingAvg7: number | null;
  isForecast?: boolean;
}

export interface IngredientDailyTrend {
  tanggal: string;
  stokLevel: number;
  pemakaian: number;
}

export interface WeeklyHeatmapDay {
  dayIndex: number;
  dayShort: string;
  dayFull: string;
  avgUsage: number;
  intensity: number;
  isPeak: boolean;
}

export interface WeeklyHeatmapRow {
  bahanId: string;
  nama: string;
  satuan: string;
  jenis: JenisBahan;
  peakDay: string;
  weeklyAvg: number;
  days: WeeklyHeatmapDay[];
}

export interface MonthlyTrendPoint {
  monthKey: string;
  monthShort: string;
  monthFull: string;
  activeDays: number;
  salesVolume: number;
  avgDailySales: number;
  salesMoMPct: number | null;
  ingredientsUsage: Record<string, number>;
  ingredientsMoMPct: Record<string, number | null>;
}

export interface AppState {
  config: SimulationConfig;
  ingredients: IngredientMaster[];
  sales: SalesRecord[];
  drafts: PurchaseDraft[];
  incomingOrders: IncomingOrder[];
  riskFlags: RiskFlag[];
  agentRuns: AgentRunRecord[];
  wasteLogs: WasteLog[];
  stockSnapshots?: Record<string, Record<string, number>>;
  supplierDeliveries?: SupplierDeliveryRecord[];
}

export interface DashboardResponse {
  state: AppState;
  policies: PolicyCalculation[];
  chartData: DailyChartPoint[];
  ingredientTrends: Record<string, IngredientDailyTrend[]>;
  monthlyTrends: MonthlyTrendPoint[];
  weeklyHeatmap: WeeklyHeatmapRow[];
  supplierPerformance: SupplierPerformanceSummary[];
  summary: {
    amanCount: number;
    waspadaCount: number;
    kritisCount: number;
    kedaluwarsaRiskCount: number;
    estimasiBelanjaSore: number;
    totalWasteRp: number;
    totalSalesRows: number;
    pendingDraftsCount: number;
  };
}
