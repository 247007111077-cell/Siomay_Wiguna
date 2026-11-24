import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  BookOpen,
  Calculator,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Database,
  FastForward,
  FileDown,
  LayoutDashboard,
  LogOut,
  Menu,
  Play,
  RotateCcw,
  ScrollText,
  X,
} from 'lucide-react';
import type {
  AgentRunRecord,
  AuthUser,
  DashboardResponse,
  JenisBahan,
  PurchaseDraft,
  SkenarioId,
} from './types/inventory';
import { formatNumber, formatRupiah, formatTanggalId } from './utils/format';
import { exportOperationalReportPdf } from './utils/pdfExport';
import { SalesForecastChart } from './components/SalesForecastChart';
import { MonthlyTrendChart } from './components/MonthlyTrendChart';
import { IngredientStockChart } from './components/IngredientStockChart';
import { UsageHeatmap } from './components/UsageHeatmap';
import { SupplierPerformancePanel } from './components/SupplierPerformancePanel';
import {
  CATEGORY_IMAGES,
  IngredientThumb,
  WIGUNA_HERO_IMAGE,
} from './components/IngredientThumb';
import { ManualCalculator } from './components/ManualCalculator';
import { AgentLogPanel } from './components/AgentLogPanel';
import { ApprovalPanel } from './components/ApprovalPanel';
import { MasterDataPanel } from './components/MasterDataPanel';
import { ToastContainer, type ToastItem } from './components/ToastContainer';
import { TutorialModal } from './components/TutorialModal';
import { AuthScreen } from './components/AuthScreen';

type NavTab = 'dasbor' | 'persetujuan' | 'log' | 'manual' | 'master';

const NAV_ITEMS: Array<{ id: NavTab; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'dasbor', label: 'Stok & Ringkasan', icon: LayoutDashboard },
  { id: 'persetujuan', label: 'Belanja & Persetujuan', icon: ClipboardCheck },
  { id: 'log', label: 'Log Agen', icon: ScrollText },
  { id: 'manual', label: 'Hitung Manual', icon: Calculator },
  { id: 'master', label: 'Bahan & Penjualan', icon: Database },
];

export default function App() {
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<NavTab>('dasbor');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [isRunningAgent, setIsRunningAgent] = useState(false);
  const [isAdvancingDay, setIsAdvancingDay] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const knownPendingIdsRef = useRef<Set<string> | null>(null);

  const [tableFilter, setTableFilter] = useState<'semua' | 'segar' | 'tahan lama' | 'pesan'>('semua');
  const [onlyCritical, setOnlyCritical] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedBahanId, setExpandedBahanId] = useState<string | null>(null);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback(
    (
      item: Omit<ToastItem, 'id'>,
      durationMs?: number
    ) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [{ ...item, id }, ...prev].slice(0, 4));
      const timeout = durationMs ?? (item.variant === 'draft_created' ? 14000 : 5500);
      if (timeout > 0) {
        window.setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, timeout);
      }
    },
    []
  );

  const notifyNewDrafts = useCallback(
    (newDrafts: PurchaseDraft[]) => {
      if (newDrafts.length === 0) return;
      const totalBiaya = newDrafts.reduce((sum, d) => sum + d.estimasiBiaya, 0);
      const daftarBahan = newDrafts
        .slice(0, 3)
        .map((d) => `${d.bahan} (${formatNumber(d.qty, 2)} ${d.satuan})`)
        .join(', ');
      const extraCount = newDrafts.length > 3 ? ` +${newDrafts.length - 3} lainnya` : '';

      pushToast(
        {
          variant: 'draft_created',
          title: `${newDrafts.length} Draf Pengadaan Baru dari Agen`,
          message: `${daftarBahan}${extraCount} · Estimasi ${formatRupiah(totalBiaya)}. Menunggu persetujuan akuntan.`,
          actionLabel: 'Tinjau & Setujui',
          onAction: () => setActiveTab('persetujuan'),
        },
        15000
      );
    },
    [pushToast]
  );

  const syncStateAndDetectDrafts = useCallback(
    (json: DashboardResponse) => {
      setData(json);
      const pendingDrafts = json.state.drafts.filter(
        (d) => d.status === 'Menunggu persetujuan'
      );
      const currentPendingIds = new Set(pendingDrafts.map((d) => d.id));

      if (knownPendingIdsRef.current === null) {
        knownPendingIdsRef.current = currentPendingIds;
        return;
      }

      const newlyArrived = pendingDrafts.filter(
        (d) => !knownPendingIdsRef.current!.has(d.id)
      );
      knownPendingIdsRef.current = currentPendingIds;

      if (newlyArrived.length > 0) {
        notifyNewDrafts(newlyArrived);
      }
    },
    [notifyNewDrafts]
  );

  const apiFetch = useCallback(
    async (url: string, init: RequestInit = {}) => {
      const headers = new Headers(init.headers);
      if (authToken) {
        headers.set('Authorization', `Bearer ${authToken}`);
      }
      const res = await fetch(url, { ...init, headers });
      if (res.status === 401) {
        setAuthToken(null);
        setCurrentUser(null);
        setData(null);
        knownPendingIdsRef.current = null;
      }
      return res;
    },
    [authToken]
  );

  const handleAuthenticated = useCallback(
    (token: string, user: AuthUser) => {
      knownPendingIdsRef.current = null;
      setLoading(true);
      setAuthToken(token);
      setCurrentUser(user);
      pushToast({
        variant: 'success',
        title: `Selamat datang, ${user.nama}`,
        message: `Masuk sebagai ${user.roleLabel}.`,
      });
    },
    [pushToast]
  );

  const handleLogout = useCallback(async () => {
    try {
      if (authToken) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${authToken}` },
        });
      }
    } catch {
      // Abaikan gangguan jaringan saat keluar
    } finally {
      setAuthToken(null);
      setCurrentUser(null);
      setData(null);
      knownPendingIdsRef.current = null;
      setMobileMenuOpen(false);
      pushToast({
        variant: 'info',
        title: 'Sesi Ditutup',
        message: 'Anda telah keluar dari sistem Siomay Wiguna.',
      });
    }
  }, [authToken, pushToast]);

  const fetchState = useCallback(async () => {
    if (!authToken) return;
    try {
      const res = await apiFetch('/api/state');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal memuat data server.');
      syncStateAndDetectDrafts(json);
    } catch (err) {
      pushToast({
        variant: 'error',
        title: 'Gagal Memuat Data',
        message: err instanceof Error ? err.message : 'Gagal menghubungi server.',
      });
    } finally {
      setLoading(false);
    }
  }, [apiFetch, authToken, pushToast, syncStateAndDetectDrafts]);

  useEffect(() => {
    if (!authToken) return;
    void fetchState();
    const intervalId = window.setInterval(() => {
      void fetchState();
    }, 20000);
    const onFocus = () => void fetchState();
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', onFocus);
    };
  }, [authToken, fetchState]);

  const handleRunAgent = async () => {
    setIsRunningAgent(true);
    try {
      const res = await apiFetch('/api/agent/run', { method: 'POST' });
      const json = await res.json();
      if (json.state) {
        syncStateAndDetectDrafts(json);
      }
      if (!res.ok) {
        pushToast({
          variant: 'error',
          title: 'Evaluasi Agen Gagal',
          message: json.error || 'Agen gagal dijalankan.',
        });
        return;
      }
      const createdCount = Array.isArray(json.createdDrafts) ? json.createdDrafts.length : 0;
      if (createdCount === 0) {
        pushToast({
          variant: 'success',
          title: 'Evaluasi Agen Sore (16.30) Selesai',
          message: 'Seluruh stok dapur segar dan gudang PH mencukupi; tidak ada draf belanja baru.',
        });
      }
    } catch (err) {
      pushToast({
        variant: 'error',
        title: 'Koneksi Agen Terputus',
        message: err instanceof Error ? err.message : 'Koneksi ke server gagal.',
      });
    } finally {
      setIsRunningAgent(false);
    }
  };

  const handleScenarioChange = async (scenario: SkenarioId) => {
    try {
      const res = await apiFetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal mengubah kondisi operasional.');
      syncStateAndDetectDrafts(json);
    } catch (err) {
      pushToast({
        variant: 'error',
        title: 'Gagal Mengubah Kondisi',
        message: err instanceof Error ? err.message : 'Gagal memperbarui kondisi operasional.',
      });
    }
  };

  const handleZScoreChange = async (zScore: number) => {
    if (!Number.isFinite(zScore) || zScore < 0.5 || zScore > 3.5) return;
    try {
      const res = await apiFetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zScore }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal mengubah target layanan.');
      syncStateAndDetectDrafts(json);
    } catch (err) {
      pushToast({
        variant: 'error',
        title: 'Gagal Mengubah Service Level',
        message: err instanceof Error ? err.message : 'Gagal memperbarui nilai z.',
      });
    }
  };

  const handleAdvanceDay = async () => {
    setIsAdvancingDay(true);
    try {
      const res = await apiFetch('/api/simulate/advance-day', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal menutup buku harian.');
      syncStateAndDetectDrafts(json);
      const rep = json.dayReport;
      const wasteText =
        rep && rep.expiredBatchesCount > 0
          ? ` · ${rep.expiredBatchesCount} batch kedaluwarsa dicatat waste (${formatRupiah(rep.totalWasteRp)})`
          : '';
      const arrivedText =
        rep && rep.arrivedOrders > 0 ? ` · ${rep.arrivedOrders} pengiriman pemasok diterima` : '';
      pushToast({
        variant: 'info',
        title: `Hari Operasional ${formatTanggalId(rep?.newDate || json.state.config.currentDate)}`,
        message: `Stok FIFO diperbarui${arrivedText}${wasteText}.`,
      });
    } catch (err) {
      pushToast({
        variant: 'error',
        title: 'Gagal Memajukan Hari',
        message: err instanceof Error ? err.message : 'Gagal memajukan hari operasional.',
      });
    } finally {
      setIsAdvancingDay(false);
    }
  };

  const handleReset = async () => {
    try {
      const res = await apiFetch('/api/reset', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal mereset data.');
      knownPendingIdsRef.current = new Set();
      syncStateAndDetectDrafts(json);
      pushToast({
        variant: 'info',
        title: 'Data Direset',
        message: 'Persediaan dan transaksi dikembalikan ke posisi awal Wiguna.',
      });
    } catch (err) {
      pushToast({
        variant: 'error',
        title: 'Gagal Reset Data',
        message: err instanceof Error ? err.message : 'Gagal mereset data.',
      });
    }
  };

  const handleDecideDraft = async (draftId: string, decision: 'Disetujui' | 'Ditolak') => {
    try {
      const res = await apiFetch(`/api/drafts/${draftId}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal memproses persetujuan draf.');
      syncStateAndDetectDrafts(json);
      pushToast({
        variant: decision === 'Disetujui' ? 'success' : 'info',
        title: decision === 'Disetujui' ? 'Pengadaan Disetujui' : 'Draf Ditolak',
        message:
          decision === 'Disetujui'
            ? 'Pesanan dijadwalkan masuk ke gudang sesuai lead time pemasok.'
            : 'Draf pengadaan dibatalkan oleh akuntan.',
      });
    } catch (err) {
      pushToast({
        variant: 'error',
        title: 'Gagal Memproses Draf',
        message: err instanceof Error ? err.message : 'Gagal memproses draf.',
      });
    }
  };

  const handleSaveIngredient = async (
    id: string,
    patch: {
      harga: number;
      leadTimeHari: number;
      umurSimpanHari: number;
      stokSaatIni: number;
      jenis: JenisBahan;
    }
  ) => {
    try {
      const res = await apiFetch(`/api/ingredients/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal menyimpan perubahan bahan.');
      syncStateAndDetectDrafts(json);
      pushToast({
        variant: 'success',
        title: 'Master Bahan Diperbarui',
        message: 'Parameter bahan baku dan stok fisik telah disimpan.',
      });
    } catch (err) {
      pushToast({
        variant: 'error',
        title: 'Gagal Menyimpan Bahan',
        message: err instanceof Error ? err.message : 'Gagal menyimpan bahan.',
      });
    }
  };

  const handleGenerateDummy = async () => {
    try {
      const res = await apiFetch('/api/sales/dummy', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal membangkitkan data dummy.');
      syncStateAndDetectDrafts(json);
      pushToast({
        variant: 'success',
        title: 'Data Dummy 120 Hari Dimuat',
        message: `${json.summary.totalSalesRows} transaksi penjualan berhasil dibangkitkan.`,
      });
    } catch (err) {
      pushToast({
        variant: 'error',
        title: 'Gagal Memuat Data Dummy',
        message: err instanceof Error ? err.message : 'Gagal memuat data dummy.',
      });
    }
  };

  const handleUploadCsv = async (csvText: string) => {
    try {
      const res = await apiFetch('/api/sales/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: csvText }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Format CSV tidak valid.');
      syncStateAndDetectDrafts(json);
      pushToast({
        variant: 'success',
        title: 'CSV Penjualan Diimpor',
        message: `${json.summary.totalSalesRows} baris transaksi valid berhasil diproses.`,
      });
    } catch (err) {
      pushToast({
        variant: 'error',
        title: 'Gagal Membaca CSV',
        message: err instanceof Error ? err.message : 'Gagal membaca file CSV.',
      });
    }
  };

  const handleDownloadPdf = (explicitRun?: AgentRunRecord) => {
    if (!data) return;
    try {
      const filename = exportOperationalReportPdf(data, explicitRun);
      pushToast({
        variant: 'success',
        title: 'Arsip PDF Diunduh',
        message: `File ${filename} siap untuk arsip manajemen.`,
      });
    } catch (err) {
      pushToast({
        variant: 'error',
        title: 'Gagal Membuat PDF',
        message: err instanceof Error ? err.message : 'Gagal membuat file PDF laporan.',
      });
    }
  };

  const activeNavMeta = NAV_ITEMS.find((n) => n.id === activeTab)!;

  const filteredPolicies = (data?.policies || []).filter((p) => {
    if (onlyCritical && p.status !== 'Kritis') return false;
    if (tableFilter === 'segar' && p.jenis !== 'segar') return false;
    if (tableFilter === 'tahan lama' && p.jenis !== 'tahan lama') return false;
    if (tableFilter === 'pesan' && p.recommendedOrderQty <= 0) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      return p.nama.toLowerCase().includes(q);
    }
    return true;
  });

  const ingredientMap = new Map(
    (data?.state.ingredients || []).map((ing) => [ing.id, ing])
  );

  const canManageOps =
    currentUser?.role === 'pemilik' || currentUser?.role === 'manajer_dapur';
  const canApprove =
    currentUser?.role === 'pemilik' || currentUser?.role === 'akuntan';

  if (!authToken || !currentUser) {
    return (
      <>
        <AuthScreen onAuthenticated={handleAuthenticated} />
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#1F1A17] lg:flex">
      {/* Sidebar Desktop */}
      <aside className="hidden lg:flex lg:w-64 lg:shrink-0 lg:flex-col lg:border-r lg:border-[#E6DDD2] lg:bg-white">
        <div className="flex h-16 items-center border-b border-[#E6DDD2] px-6">
          <span className="font-display text-lg font-bold tracking-tight text-[#1F1A17] whitespace-nowrap">
            Siomay Wiguna
          </span>
        </div>

        <nav className="flex-1 space-y-1 p-4" aria-label="Navigasi utama">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const pendingCount =
              item.id === 'persetujuan' ? data?.summary.pendingDraftsCount || 0 : 0;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex min-h-[42px] w-full items-center justify-between rounded-lg px-3.5 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-[#C24E2B]/10 text-[#C24E2B]'
                    : 'text-[#6B5E55] hover:bg-[#FAF7F2] hover:text-[#1F1A17]'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </span>
                {pendingCount > 0 && (
                  <span className="font-mono text-xs font-semibold tabular-nums text-[#C24E2B]">
                    {pendingCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-[#E6DDD2] p-4 space-y-3">
          <div className="rounded-lg bg-[#FAF7F2] px-3 py-2.5 text-xs">
            <div className="truncate font-semibold text-[#1F1A17]">{currentUser.nama}</div>
            <div className="text-[#6B5E55]">{currentUser.roleLabel}</div>
          </div>

          <button
            type="button"
            onClick={() => setTutorialOpen(true)}
            className="flex min-h-[40px] w-full items-center gap-2.5 rounded-lg border border-[#E6DDD2] bg-white px-3.5 py-2 text-xs font-semibold text-[#1F1A17] transition-colors hover:border-[#C24E2B]/50 hover:text-[#C24E2B] whitespace-nowrap"
          >
            <BookOpen className="h-4 w-4 shrink-0 text-[#C24E2B]" />
            <span>Panduan Ringkas</span>
          </button>

          <button
            type="button"
            onClick={() => void handleLogout()}
            className="flex min-h-[40px] w-full items-center gap-2.5 rounded-lg border border-[#E6DDD2] bg-white px-3.5 py-2 text-xs font-semibold text-[#6B5E55] transition-colors hover:border-[#B91C1C]/40 hover:text-[#B91C1C] whitespace-nowrap"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span>Keluar / Ganti Akun</span>
          </button>

          <div className="px-1 text-[11px] text-[#6B5E55]">
            16.30 Evaluasi · 17.00 Belanja · 05.00 Produksi
          </div>
        </div>
      </aside>

      {/* Drawer Mobile */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/30"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-50 flex w-64 flex-col bg-white shadow-xl">
            <div className="flex h-14 items-center justify-between border-b border-[#E6DDD2] px-5">
              <span className="font-display text-base font-bold text-[#1F1A17]">
                Siomay Wiguna
              </span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-[#6B5E55] hover:bg-[#FAF7F2]"
                aria-label="Tutup menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 space-y-1 p-3">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3.5 py-2 text-sm font-medium whitespace-nowrap ${
                      isActive
                        ? 'bg-[#C24E2B]/10 text-[#C24E2B]'
                        : 'text-[#6B5E55] hover:bg-[#FAF7F2]'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="border-t border-[#E6DDD2] p-3 space-y-2">
              <div className="rounded-lg bg-[#FAF7F2] px-3 py-2 text-xs">
                <div className="truncate font-semibold text-[#1F1A17]">{currentUser.nama}</div>
                <div className="text-[#6B5E55]">{currentUser.roleLabel}</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setTutorialOpen(true);
                }}
                className="flex min-h-[42px] w-full items-center gap-2.5 rounded-lg border border-[#E6DDD2] bg-white px-3.5 py-2 text-xs font-semibold text-[#1F1A17] whitespace-nowrap"
              >
                <BookOpen className="h-4 w-4 text-[#C24E2B]" />
                <span>Panduan Ringkas</span>
              </button>
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="flex min-h-[42px] w-full items-center gap-2.5 rounded-lg border border-[#E6DDD2] bg-white px-3.5 py-2 text-xs font-semibold text-[#6B5E55] hover:text-[#B91C1C] whitespace-nowrap"
              >
                <LogOut className="h-4 w-4" />
                <span>Keluar / Ganti Akun</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Kolom Konten Utama */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Bar (1 baris bersih) */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-[#E6DDD2] bg-white px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#E6DDD2] text-[#1F1A17] lg:hidden"
              aria-label="Buka menu navigasi"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="truncate font-display text-base font-semibold text-[#1F1A17] sm:text-lg">
              {activeNavMeta.label}
            </h1>
          </div>

          <button
            type="button"
            onClick={handleRunAgent}
            disabled={isRunningAgent || loading || !canManageOps}
            title={!canManageOps ? 'Khusus peran Manajer Dapur atau Pemilik Usaha' : undefined}
            className="inline-flex min-h-[42px] shrink-0 items-center gap-2 rounded-lg bg-[#C24E2B] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#A63E1F] disabled:opacity-50 sm:px-5 sm:text-sm whitespace-nowrap"
          >
            <Play className="h-4 w-4" />
            <span>{isRunningAgent ? 'Mengevaluasi Stok...' : 'Jalankan Agen Sore (16.30)'}</span>
          </button>
        </header>

        {/* Tab navigasi cepat mobile */}
        <div className="flex gap-1 overflow-x-auto border-b border-[#E6DDD2] bg-white px-4 py-2 lg:hidden">
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-[#C24E2B]/10 text-[#C24E2B]'
                    : 'text-[#6B5E55] hover:text-[#1F1A17]'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <main className="mx-auto w-full max-w-[1280px] flex-1 space-y-6 p-4 sm:p-6 lg:p-8">
          {/* Bilah Kontrol Operasional Harian */}
          {data && (
            <section
              aria-label="Kontrol operasional harian dapur dan gudang"
              className="flex flex-col gap-4 rounded-xl border border-[#E6DDD2] bg-white p-4 xl:flex-row xl:items-center xl:justify-between"
            >
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[#6B5E55]">
                <span className="font-mono font-semibold tabular-nums text-[#1F1A17]">
                  {formatTanggalId(data.state.config.currentDate)}
                </span>
                <span aria-hidden="true">·</span>
                <span>Shift Sore (16.30)</span>
                <span aria-hidden="true">·</span>
                <div className="flex items-center gap-2">
                  <label htmlFor="z-select" className="text-[#6B5E55]">
                    Target Layanan (z):
                  </label>
                  <select
                    id="z-select"
                    value={String(data.state.config.zScore)}
                    disabled={!canManageOps}
                    onChange={(e) => handleZScoreChange(Number(e.target.value))}
                    className="rounded-md border border-[#E6DDD2] bg-[#FAF7F2] px-2 py-1 font-mono text-xs tabular-nums text-[#1F1A17] focus:border-[#C24E2B] focus:outline-none disabled:opacity-60"
                  >
                    <option value="1.28">90% (z = 1,28)</option>
                    <option value="1.65">95% (z = 1,65)</option>
                    <option value="2.33">99% (z = 2,33)</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {/* 3 Kondisi / Skenario Operasional */}
                <div className="flex flex-wrap items-center gap-1 rounded-lg bg-[#FAF7F2] p-1">
                  {(
                    [
                      { id: 'normal', label: 'Normal' },
                      { id: 'lonjakan', label: 'Lonjakan Acara +50%' },
                      { id: 'terlambat', label: 'Pemasok Terlambat +2 hr' },
                    ] as const
                  ).map((sc) => {
                    const active = data.state.config.scenario === sc.id;
                    return (
                      <button
                        key={sc.id}
                        type="button"
                        disabled={!canManageOps}
                        onClick={() => handleScenarioChange(sc.id)}
                        className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-60 whitespace-nowrap shrink-0 ${
                          active
                            ? 'bg-white text-[#C24E2B] shadow-xs'
                            : 'text-[#6B5E55] hover:text-[#1F1A17]'
                        }`}
                      >
                        {sc.label}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={handleAdvanceDay}
                  disabled={isAdvancingDay || !canManageOps}
                  title={!canManageOps ? 'Khusus peran Manajer Dapur atau Pemilik Usaha' : undefined}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[#E6DDD2] bg-white px-3.5 py-2 text-xs font-medium text-[#1F1A17] transition-colors hover:bg-[#FAF7F2] disabled:opacity-50 whitespace-nowrap"
                >
                  <FastForward className="h-3.5 w-3.5 text-[#C24E2B]" />
                  {isAdvancingDay ? 'Memproses...' : 'Maju 1 hari'}
                </button>

                <button
                  type="button"
                  onClick={() => handleDownloadPdf()}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[#E6DDD2] bg-white px-3.5 py-2 text-xs font-medium text-[#1F1A17] transition-colors hover:bg-[#FAF7F2] whitespace-nowrap"
                  title="Unduh ringkasan dasbor dan log agen hari ini sebagai arsip PDF"
                >
                  <FileDown className="h-3.5 w-3.5 text-[#2D6A4F]" />
                  Unduh PDF
                </button>

                <button
                  type="button"
                  onClick={() => setTutorialOpen(true)}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[#E6DDD2] bg-white px-3.5 py-2 text-xs font-medium text-[#1F1A17] transition-colors hover:bg-[#FAF7F2] whitespace-nowrap"
                  title="Buka tutorial interaktif dan panduan ringkas penggunaan sistem"
                >
                  <BookOpen className="h-3.5 w-3.5 text-[#C24E2B]" />
                  Panduan
                </button>

                <button
                  type="button"
                  onClick={handleReset}
                  disabled={!canManageOps}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[#E6DDD2] bg-white px-3 py-2 text-xs font-medium text-[#6B5E55] transition-colors hover:bg-[#FAF7F2] hover:text-[#1F1A17] disabled:opacity-50 whitespace-nowrap"
                  title={!canManageOps ? 'Khusus peran Manajer Dapur atau Pemilik Usaha' : 'Reset seluruh data ke kondisi awal'}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset
                </button>
              </div>
            </section>
          )}

          {/* Skeleton Loading Awal */}
          {loading && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[1, 2, 3, 4].map((k) => (
                  <div
                    key={k}
                    className="h-28 animate-pulse rounded-xl border border-[#E6DDD2] bg-white"
                  />
                ))}
              </div>
              <div className="h-72 animate-pulse rounded-xl border border-[#E6DDD2] bg-white" />
            </div>
          )}

          {/* Konten Utama Sesuai Tab Aktif */}
          {!loading && data && activeTab === 'dasbor' && (
            <div className="space-y-6">
              {/* 4 Kartu Ringkasan KPI */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border border-[#E6DDD2] bg-white p-5">
                  <p className="text-xs font-medium text-[#6B5E55]">
                    Kesehatan Stok Dapur &amp; Gudang PH
                  </p>
                  <div className="mt-3 flex items-baseline gap-4 font-mono tabular-nums">
                    <div>
                      <span className="text-2xl font-bold text-[#2D6A4F]">
                        {data.summary.amanCount}
                      </span>
                      <span className="ml-1 font-sans text-xs text-[#6B5E55]">Aman</span>
                    </div>
                    <div>
                      <span className="text-2xl font-bold text-[#B45309]">
                        {data.summary.waspadaCount}
                      </span>
                      <span className="ml-1 font-sans text-xs text-[#6B5E55]">Waspada</span>
                    </div>
                    <div>
                      <span className="text-2xl font-bold text-[#B91C1C]">
                        {data.summary.kritisCount}
                      </span>
                      <span className="ml-1 font-sans text-xs text-[#6B5E55]">Kritis</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-[#E6DDD2] bg-white p-5">
                  <p className="text-xs font-medium text-[#6B5E55]">
                    Anggaran Belanja Pasar (17.00)
                  </p>
                  <p className="mt-3 font-mono text-2xl font-bold tabular-nums text-[#1F1A17]">
                    {formatRupiah(data.summary.estimasiBelanjaSore)}
                  </p>
                  <p className="mt-1 text-xs text-[#6B5E55]">
                    Untuk produksi pukul 05.00 besok
                  </p>
                </div>

                <div className="rounded-xl border border-[#E6DDD2] bg-white p-5">
                  <p className="text-xs font-medium text-[#6B5E55]">
                    Kontrol Mutu &amp; Waste FIFO
                  </p>
                  <div className="mt-3 flex items-baseline justify-between gap-2">
                    <span className="font-mono text-2xl font-bold tabular-nums text-[#B45309]">
                      {data.summary.kedaluwarsaRiskCount}{' '}
                      <span className="font-sans text-xs font-normal text-[#6B5E55]">
                        bahan ≤ 1 hari
                      </span>
                    </span>
                  </div>
                  <p className="mt-1 font-mono text-xs tabular-nums text-[#6B5E55]">
                    Total susut/waste: {formatRupiah(data.summary.totalWasteRp)}
                  </p>
                </div>

                <div className="rounded-xl border border-[#E6DDD2] bg-white p-5">
                  <p className="text-xs font-medium text-[#6B5E55]">
                    Antrean Persetujuan Akuntan
                  </p>
                  <p className="mt-3 font-mono text-2xl font-bold tabular-nums text-[#C24E2B]">
                    {data.summary.pendingDraftsCount}{' '}
                    <span className="font-sans text-xs font-normal text-[#6B5E55]">
                      draf menunggu
                    </span>
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('persetujuan')}
                    className="mt-1 text-xs font-medium text-[#C24E2B] hover:underline"
                  >
                    Tinjau daftar pengadaan →
                  </button>
                </div>
              </div>

              {/* Galeri Visual Dapur & Kategori Bahan Baku */}
              <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-12">
                <div className="relative overflow-hidden rounded-xl border border-[#E6DDD2] bg-[#1F1A17] lg:col-span-5">
                  <img
                    src={WIGUNA_HERO_IMAGE}
                    alt="Sajian Siomay Wiguna Tasikmalaya lengkap dengan bumbu kacang"
                    referrerPolicy="no-referrer"
                    className="h-56 w-full object-cover lg:h-full"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                    <div className="text-xs text-white/80">
                      Dapur Produksi Tasikmalaya · 7 Menu Prasmanan &amp; 6 Paket
                    </div>
                    <h2 className="mt-1 text-lg font-semibold leading-snug">
                      Kualitas Segar untuk Produksi Pukul 05.00 WIB
                    </h2>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-7">
                  {[
                    {
                      title: 'Protein Segar',
                      sub: 'Ikan tenggiri & Daging sapi',
                      img: CATEGORY_IMAGES.protein,
                      filterKey: 'segar' as const,
                    },
                    {
                      title: 'Sayur & Tahu',
                      sub: 'Tahu, Kentang, Kol, Pare',
                      img: CATEGORY_IMAGES.sayur,
                      filterKey: 'segar' as const,
                    },
                    {
                      title: 'Telur & Kulit Pangsit',
                      sub: 'Stok harian dapur segar',
                      img: CATEGORY_IMAGES.telurPangsit,
                      filterKey: 'segar' as const,
                    },
                    {
                      title: 'Gudang PH (Tahan Lama)',
                      sub: 'Tepung tapioka, Kacang, Gula',
                      img: CATEGORY_IMAGES.gudangPh,
                      filterKey: 'tahan lama' as const,
                    },
                  ].map((card) => (
                    <button
                      key={card.title}
                      type="button"
                      onClick={() => setTableFilter(card.filterKey)}
                      className="group flex items-center gap-3.5 rounded-xl border border-[#E6DDD2] bg-white p-3.5 text-left transition-colors hover:border-[#C24E2B]/50"
                    >
                      <img
                        src={card.img}
                        alt={card.title}
                        referrerPolicy="no-referrer"
                        className="h-16 w-16 shrink-0 rounded-lg object-cover"
                      />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-[#1F1A17] group-hover:text-[#C24E2B]">
                          {card.title}
                        </div>
                        <div className="mt-0.5 line-clamp-2 text-xs text-[#6B5E55]">
                          {card.sub}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Grafik Penjualan 30 Hari + Garis Ramalan */}
              <div className="rounded-xl border border-[#E6DDD2] bg-white p-6">
                <SalesForecastChart data={data.chartData} />
              </div>

              {/* Analisis Tren Bulanan (Month-over-Month BarChart) */}
              <div className="rounded-xl border border-[#E6DDD2] bg-white p-6">
                <MonthlyTrendChart
                  data={data.monthlyTrends || []}
                  ingredients={data.state.ingredients}
                />
              </div>

              {/* Grafik Garis Recharts: Fluktuasi Level Stok & Pemakaian Bahan Baku 30 Hari */}
              <div className="rounded-xl border border-[#E6DDD2] bg-white p-6">
                <IngredientStockChart
                  trends={data.ingredientTrends || {}}
                  ingredients={data.state.ingredients}
                />
              </div>

              {/* Heatmap Pemakaian Bahan (Hari dalam Seminggu) */}
              <UsageHeatmap rows={data.weeklyHeatmap || []} />

              {/* Evaluasi Kinerja Pemasok (Lead Time Aktual vs Rata-rata dari State) */}
              <SupplierPerformancePanel
                suppliers={data.supplierPerformance || []}
                deliveries={data.state.supplierDeliveries || []}
              />

              {/* Tabel Kartu Stok Dapur Segar & Gudang PH */}
              <div className="rounded-xl border border-[#E6DDD2] bg-white">
                <div className="flex flex-col gap-3 border-b border-[#E6DDD2] px-6 py-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-[#1F1A17]">
                      Kartu Stok Dapur Segar &amp; Gudang PH vs Target / ROP
                    </h2>
                    <p className="mt-0.5 text-xs text-[#6B5E55]">
                      Klik baris bahan untuk melihat rincian batch umur simpan (FIFO) · Service level z ={' '}
                      <span className="font-mono tabular-nums">
                        {formatNumber(data.state.config.zScore, 2)}
                      </span>
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      aria-pressed={onlyCritical}
                      onClick={() => setOnlyCritical((prev) => !prev)}
                      className={`inline-flex min-h-[34px] items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                        onlyCritical
                          ? 'border-[#B91C1C] bg-[#B91C1C] text-white'
                          : 'border-[#E6DDD2] bg-white text-[#1F1A17] hover:border-[#B91C1C]/50 hover:text-[#B91C1C]'
                      }`}
                    >
                      <AlertOctagon
                        className={`h-3.5 w-3.5 shrink-0 ${
                          onlyCritical ? 'text-white' : 'text-[#B91C1C]'
                        }`}
                      />
                      <span>Hanya Tampilkan Stok Kritis</span>
                      <span
                        className={`font-mono text-[11px] tabular-nums ${
                          onlyCritical ? 'text-white/90' : 'text-[#6B5E55]'
                        }`}
                      >
                        ({data.summary.kritisCount})
                      </span>
                    </button>

                    <div className="flex items-center gap-1 rounded-lg bg-[#FAF7F2] p-1">
                      {(
                        [
                          { id: 'semua', label: 'Semua' },
                          { id: 'segar', label: 'Dapur Segar' },
                          { id: 'tahan lama', label: 'Gudang PH' },
                          { id: 'pesan', label: 'Perlu Belanja' },
                        ] as const
                      ).map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setTableFilter(tab.id)}
                          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                            tableFilter === tab.id
                              ? 'bg-white text-[#1F1A17] shadow-xs'
                              : 'text-[#6B5E55] hover:text-[#1F1A17]'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Cari bahan..."
                      aria-label="Cari bahan baku"
                      className="w-40 rounded-lg border border-[#E6DDD2] bg-white px-3 py-1.5 text-xs text-[#1F1A17] placeholder:text-[#6B5E55] focus:border-[#C24E2B] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] text-left text-sm">
                    <thead className="border-b border-[#E6DDD2] bg-[#FAF7F2] text-xs font-medium text-[#6B5E55]">
                      <tr>
                        <th className="px-5 py-3">Bahan &amp; Lokasi</th>
                        <th className="px-3 py-3 text-right">Stok Fisik</th>
                        <th className="px-3 py-3 text-right">Sisa Umur</th>
                        <th className="px-3 py-3 text-right">Pemakaian/Hr</th>
                        <th className="px-3 py-3 text-right">Safety Stock</th>
                        <th className="px-3 py-3 text-right">Target / ROP</th>
                        <th className="px-3 py-3 text-right">EOQ</th>
                        <th className="px-3 py-3 text-right">Saran Pesan</th>
                        <th className="px-5 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EFE8DE]">
                      {filteredPolicies.map((p) => {
                        const targetOrRop = p.jenis === 'segar' ? p.targetStok : p.rop;
                        const isExpanded = expandedBahanId === p.bahanId;
                        const masterIng = ingredientMap.get(p.bahanId);
                        const activeBatches = (masterIng?.batches || []).filter(
                          (b) => b.qty > 0.0001
                        );

                        return (
                          <Fragment key={p.bahanId}>
                            <tr
                              onClick={() =>
                                setExpandedBahanId(isExpanded ? null : p.bahanId)
                              }
                              className="cursor-pointer hover:bg-[#FAF7F2]/80"
                            >
                              <td className="px-5 py-3">
                                <div className="flex items-center gap-2.5">
                                  {isExpanded ? (
                                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#6B5E55]" />
                                  ) : (
                                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#6B5E55]" />
                                  )}
                                  <IngredientThumb nama={p.nama} size="sm" />
                                  <div>
                                    <div className="font-medium text-[#1F1A17]">{p.nama}</div>
                                    <div className="text-xs text-[#6B5E55]">
                                      {p.jenis === 'segar' ? 'Dapur Segar' : 'Gudang PH'} · L ={' '}
                                      {p.effectiveLeadTime} hr
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 py-3 text-right font-mono tabular-nums text-[#1F1A17]">
                                {formatNumber(p.stokSaatIni, 2)} {p.satuan}
                              </td>
                              <td className="px-3 py-3 text-right font-mono tabular-nums text-[#6B5E55]">
                                {p.minSisaUmurHari !== null ? `${p.minSisaUmurHari} hr` : 'Habis'}
                              </td>
                              <td className="px-3 py-3 text-right font-mono tabular-nums text-[#1F1A17]">
                                {formatNumber(p.dBar, 2)}
                              </td>
                              <td className="px-3 py-3 text-right font-mono tabular-nums text-[#1F1A17]">
                                {formatNumber(p.safetyStock, 2)}
                              </td>
                              <td className="px-3 py-3 text-right font-mono tabular-nums text-[#1F1A17]">
                                {targetOrRop !== null ? formatNumber(targetOrRop, 2) : '-'}
                              </td>
                              <td className="px-3 py-3 text-right font-mono tabular-nums text-[#6B5E55]">
                                {p.eoq !== null ? formatNumber(p.eoq, 1) : '—'}
                              </td>
                              <td className="px-3 py-3 text-right font-mono font-semibold tabular-nums text-[#C24E2B]">
                                {p.recommendedOrderQty > 0
                                  ? `${formatNumber(p.recommendedOrderQty, 2)} ${p.satuan}`
                                  : '0'}
                              </td>
                              <td className="px-5 py-3">
                                <div className="flex items-center gap-1.5 text-xs font-semibold">
                                  {p.status === 'Aman' && (
                                    <>
                                      <CheckCircle2 className="h-4 w-4 text-[#2D6A4F]" />
                                      <span className="text-[#2D6A4F]">Aman</span>
                                    </>
                                  )}
                                  {p.status === 'Waspada' && (
                                    <>
                                      <AlertTriangle className="h-4 w-4 text-[#B45309]" />
                                      <span className="text-[#B45309]">Waspada</span>
                                    </>
                                  )}
                                  {p.status === 'Kritis' && (
                                    <>
                                      <AlertOctagon className="h-4 w-4 text-[#B91C1C]" />
                                      <span className="text-[#B91C1C]">Kritis</span>
                                    </>
                                  )}
                                </div>
                                {p.nearExpiryRisk && (
                                  <div className="mt-0.5 text-[11px] text-[#B45309]">
                                    Mendekati kedaluwarsa
                                  </div>
                                )}
                              </td>
                            </tr>

                            {isExpanded && (
                              <tr className="bg-[#FAF7F2]/70">
                                <td colSpan={9} className="px-8 py-3">
                                  <div className="text-xs font-semibold text-[#1F1A17]">
                                    Rincian Batch Aktif FIFO ({p.nama})
                                  </div>
                                  {activeBatches.length === 0 ? (
                                    <p className="mt-1 text-xs text-[#B91C1C]">
                                      Stok kosong — seluruh batch habis terpakai atau kedaluwarsa.
                                    </p>
                                  ) : (
                                    <div className="mt-2 flex flex-wrap gap-4 text-xs text-[#6B5E55]">
                                      {activeBatches.map((b) => (
                                        <div
                                          key={b.id}
                                          className="rounded-md border border-[#E6DDD2] bg-white px-3 py-1.5"
                                        >
                                          <span className="font-mono font-semibold tabular-nums text-[#1F1A17]">
                                            {formatNumber(b.qty, 2)} {p.satuan}
                                          </span>
                                          <span className="mx-1.5">·</span>
                                          <span
                                            className={`font-mono tabular-nums ${
                                              b.sisaUmurHari <= 1
                                                ? 'font-semibold text-[#B45309]'
                                                : 'text-[#6B5E55]'
                                            }`}
                                          >
                                            Sisa {b.sisaUmurHari} hari
                                          </span>
                                          <span className="mx-1.5">·</span>
                                          <span>
                                            {b.asal} ({formatTanggalId(b.tanggalMasuk)})
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                      {filteredPolicies.length === 0 && (
                        <tr>
                          <td colSpan={9} className="px-5 py-8 text-center text-sm text-[#6B5E55]">
                            {onlyCritical ? (
                              <div className="space-y-2">
                                <p>
                                  Tidak ada bahan dengan status <strong>Stok Kritis</strong> sesuai filter aktif.
                                </p>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOnlyCritical(false);
                                    setTableFilter('semua');
                                    setSearchQuery('');
                                  }}
                                  className="inline-flex min-h-[34px] items-center rounded-lg border border-[#E6DDD2] bg-[#FAF7F2] px-3 py-1 text-xs font-medium text-[#1F1A17] hover:border-[#C24E2B]/50"
                                >
                                  Tampilkan Semua Bahan
                                </button>
                              </div>
                            ) : (
                              'Tidak ada bahan baku yang sesuai dengan filter pencarian.'
                            )}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {!loading && data && activeTab === 'persetujuan' && (
            <ApprovalPanel
              drafts={data.state.drafts}
              ingredients={data.state.ingredients}
              incomingOrders={data.state.incomingOrders}
              riskFlags={data.state.riskFlags}
              isRunningAgent={isRunningAgent}
              canApprove={canApprove}
              canManageOps={canManageOps}
              onDecideDraft={handleDecideDraft}
              onRunAgent={handleRunAgent}
            />
          )}

          {!loading && data && activeTab === 'log' && (
            <AgentLogPanel
              runs={data.state.agentRuns}
              isRunning={isRunningAgent}
              onRunAgent={handleRunAgent}
              onExportPdf={handleDownloadPdf}
            />
          )}

          {!loading && data && activeTab === 'manual' && (
            <ManualCalculator policies={data.policies} config={data.state.config} />
          )}

          {!loading && data && activeTab === 'master' && (
            <MasterDataPanel
              ingredients={data.state.ingredients}
              sales={data.state.sales}
              wasteLogs={data.state.wasteLogs}
              onSaveIngredient={handleSaveIngredient}
              onGenerateDummy={handleGenerateDummy}
              onUploadCsv={handleUploadCsv}
            />
          )}
        </main>
      </div>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <TutorialModal
        open={tutorialOpen}
        onClose={() => setTutorialOpen(false)}
        onNavigateTab={(tab) => setActiveTab(tab)}
        onRunAgentFromTutorial={() => void handleRunAgent()}
        zScore={data?.state.config.zScore ?? 1.65}
      />
    </div>
  );
}
