import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Calculator,
  CheckCircle2,
  ClipboardCheck,
  Database,
  Play,
  ScrollText,
  X,
} from 'lucide-react';

export type TutorialTargetTab = 'dasbor' | 'persetujuan' | 'log' | 'manual' | 'master';

interface TutorialModalProps {
  open: boolean;
  onClose: () => void;
  onNavigateTab: (tab: TutorialTargetTab) => void;
  onRunAgentFromTutorial: () => void;
  zScore: number;
}

interface TutorialStep {
  id: string;
  shortTitle: string;
  title: string;
  subtitle: string;
  icon: typeof BookOpen;
  targetTab?: TutorialTargetTab;
  targetLabel?: string;
}

const STEPS: TutorialStep[] = [
  {
    id: 'sistem',
    shortTitle: '1. Cara Kerja Sistem',
    title: 'Cara Kerja Manajemen Persediaan Wiguna',
    subtitle:
      'Sistem memisahkan pengelolaan bahan segar harian (pasar sore) dan bahan tahan lama (gudang PH) berbasis data penjualan & resep BOM.',
    icon: BookOpen,
    targetTab: 'dasbor',
    targetLabel: 'Lihat Kartu Stok di Dasbor',
  },
  {
    id: 'agen',
    shortTitle: '2. Agen Sore (16.30)',
    title: 'Menjalankan Agen Persediaan & Simulasi',
    subtitle:
      'Agen AI bekerja dalam siklus Amati → Putuskan → Bertindak → Laporkan dengan memanggil alat hitung deterministik di server.',
    icon: Play,
    targetTab: 'log',
    targetLabel: 'Buka Panel Log Agen',
  },
  {
    id: 'persetujuan',
    shortTitle: '3. Alur Persetujuan',
    title: 'Persetujuan Akuntan (Human-in-the-Loop)',
    subtitle:
      'Setiap draf pembelian dari agen tidak langsung dipesan ke pemasok—harus ditinjau dan disetujui terlebih dahulu.',
    icon: ClipboardCheck,
    targetTab: 'persetujuan',
    targetLabel: 'Buka Belanja & Persetujuan',
  },
  {
    id: 'verifikasi',
    shortTitle: '4. Uji Rumus & Data',
    title: 'Verifikasi Manual, Skenario & Data CSV',
    subtitle:
      'Gunakan alat uji untuk memverifikasi perhitungan Safety Stock, ROP, EOQ, mengganti kondisi pasar, atau mengunggah transaksi CSV.',
    icon: Calculator,
    targetTab: 'manual',
    targetLabel: 'Coba Hitung Manual',
  },
];

export function TutorialModal({
  open,
  onClose,
  onNavigateTab,
  onRunAgentFromTutorial,
  zScore,
}: TutorialModalProps) {
  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight') {
        setStepIdx((prev) => Math.min(STEPS.length - 1, prev + 1));
      } else if (e.key === 'ArrowLeft') {
        setStepIdx((prev) => Math.max(0, prev - 1));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const currentStep = STEPS[stepIdx];
  const StepIcon = currentStep.icon;

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tutorial-modal-title"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#1F1A17]/45 backdrop-blur-[1px]"
            aria-hidden="true"
          />

          {/* Kontainer Modal */}
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-[#E6DDD2] bg-white shadow-xl"
          >
            {/* Header Modal */}
            <div className="flex items-start justify-between gap-4 border-b border-[#E6DDD2] bg-[#FAF7F2] px-5 py-4 sm:px-6">
              <div>
                <div className="text-xs font-medium text-[#C24E2B]">
                  Panduan Ringkas Pengguna Baru · Langkah {stepIdx + 1} dari {STEPS.length}
                </div>
                <h2
                  id="tutorial-modal-title"
                  className="mt-1 flex items-center gap-2 font-display text-lg font-semibold text-[#1F1A17]"
                >
                  <StepIcon className="h-5 w-5 shrink-0 text-[#C24E2B]" />
                  <span>{currentStep.title}</span>
                </h2>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#E6DDD2] bg-white text-[#6B5E55] transition-colors hover:text-[#1F1A17]"
                aria-label="Tutup panduan ringkas"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Navigasi Tab Langkah */}
            <div className="grid grid-cols-2 gap-1 border-b border-[#E6DDD2] bg-white px-4 py-2.5 sm:grid-cols-4 sm:px-6">
              {STEPS.map((st, idx) => {
                const isActive = idx === stepIdx;
                const isDone = idx < stepIdx;
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setStepIdx(idx)}
                    className={`flex min-h-[36px] items-center justify-center rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                      isActive
                        ? 'bg-[#C24E2B]/10 text-[#C24E2B]'
                        : isDone
                          ? 'text-[#2D6A4F] hover:bg-[#FAF7F2]'
                          : 'text-[#6B5E55] hover:bg-[#FAF7F2] hover:text-[#1F1A17]'
                    }`}
                  >
                    <span className="truncate">{st.shortTitle}</span>
                  </button>
                );
              })}
            </div>

            {/* Isi Tutorial (Scrollable) */}
            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 text-sm text-[#1F1A17] sm:px-6">
              <p className="leading-relaxed text-[#6B5E55]">{currentStep.subtitle}</p>

              {/* Langkah 1: Cara Kerja Sistem */}
              {stepIdx === 0 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 border-y border-[#EFE8DE] py-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <div className="text-xs font-semibold text-[#C24E2B]">
                        01. Bahan Segar (Pasar Sore 17.00–18.00)
                      </div>
                      <p className="text-xs leading-relaxed text-[#6B5E55]">
                        Ikan tenggiri, Daging sapi, Tahu, Kentang, Kol, Pare, Telur, dan Kulit
                        pangsit dibeli harian untuk produksi pukul 05.00 WIB.
                      </p>
                      <div className="pt-1 font-mono text-xs text-[#1F1A17] tabular-nums">
                        Target Stok = d̄ + Safety Stock
                      </div>
                    </div>

                    <div className="space-y-1.5 sm:border-l sm:border-[#EFE8DE] sm:pl-4">
                      <div className="text-xs font-semibold text-[#2D6A4F]">
                        02. Bahan Tahan Lama (Gudang PH)
                      </div>
                      <p className="text-xs leading-relaxed text-[#6B5E55]">
                        Tepung tapioka, Kacang tanah, dan Gula disimpan berkala dengan lead time
                        pemasok 3 hari. Dipesan ekonomis saat stok menyentuh ROP.
                      </p>
                      <div className="pt-1 font-mono text-xs text-[#1F1A17] tabular-nums">
                        ROP = (d̄ × L) + SS · EOQ = √(2·D·S/H)
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-[#1F1A17]">
                      Alur Data Harian Otomatis (FIFO &amp; BOM)
                    </div>
                    <ul className="space-y-2 text-xs leading-relaxed text-[#6B5E55]">
                      <li>
                        <strong className="text-[#1F1A17]">1. Ekspansi Resep (BOM):</strong>{' '}
                        Penjualan 7 item prasmanan &amp; 6 paket (Pas = 5, Kenyang = 7, Mix = 6,
                        Jamuan = 20) otomatis dikonversi menjadi pemakaian 11 bahan baku. Minuman
                        diabaikan.
                      </li>
                      <li>
                        <strong className="text-[#1F1A17]">2. Ramalan 7 Hari &amp; Safety Stock:</strong>{' '}
                        Rata-rata bergerak 7 hari (d̄) dan simpangan baku (σ) dihitung untuk menentukan{' '}
                        <span className="font-mono text-[#1F1A17]">
                          SS = {zScore.toFixed(2).replace('.', ',')} × σ × √L
                        </span>
                        .
                      </li>
                      <li>
                        <strong className="text-[#1F1A17]">3. Kontrol Umur Simpan FIFO:</strong>{' '}
                        Batch terlama dipakai lebih dulu. Klik baris bahan di tabel Dasbor untuk
                        memeriksa sisa umur tiap batch, atau jalankan{' '}
                        <strong className="text-[#1F1A17]">Maju 1 hari</strong> untuk menyimulasikan
                        konsumsi harian dan pencatatan <em className="not-italic font-medium">waste</em>.
                      </li>
                    </ul>
                  </div>
                </div>
              )}

              {/* Langkah 2: Cara Menggunakan Agen */}
              {stepIdx === 1 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 border-y border-[#EFE8DE] py-4 sm:grid-cols-4">
                    {[
                      {
                        phase: '1. Amati',
                        desc: 'Agen membaca ringkasan penjualan, level stok FIFO, dan sisa umur simpan seluruh bahan.',
                      },
                      {
                        phase: '2. Putuskan',
                        desc: 'Agen memanggil forecast_demand & calc_policy di server—angka tidak pernah dikarang AI.',
                      },
                      {
                        phase: '3. Bertindak',
                        desc: 'Membuat draf belanja untuk bahan defisit dan menandai risiko kritis atau kedaluwarsa.',
                      },
                      {
                        phase: '4. Laporkan',
                        desc: 'Menyusun ringkasan alasan operasional dan mencatat setiap panggilan tool ke Log Agen.',
                      },
                    ].map((item) => (
                      <div key={item.phase} className="space-y-1">
                        <div className="text-xs font-semibold text-[#C24E2B]">{item.phase}</div>
                        <p className="text-xs leading-relaxed text-[#6B5E55]">{item.desc}</p>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2 text-xs leading-relaxed text-[#6B5E55]">
                    <div className="font-semibold text-[#1F1A17]">Langkah Praktik Cepat:</div>
                    <ol className="list-decimal space-y-1.5 pl-4">
                      <li>
                        Pilih kondisi uji di bilah kontrol:{' '}
                        <strong className="text-[#1F1A17]">Normal</strong>,{' '}
                        <strong className="text-[#1F1A17]">Lonjakan Acara +50%</strong>, atau{' '}
                        <strong className="text-[#1F1A17]">Pemasok Terlambat +2 hr</strong>.
                      </li>
                      <li>
                        Jika stok awal masih aman, klik{' '}
                        <strong className="text-[#1F1A17]">Maju 1 hari</strong> 1–2 kali untuk
                        menyimulasikan pemakaian harian dan penurunan umur simpan.
                      </li>
                      <li>
                        Klik tombol oranye{' '}
                        <strong className="text-[#C24E2B]">Jalankan Agen Sore (16.30)</strong> di
                        pojok kanan atas.
                      </li>
                      <li>
                        Setiap langkah pemanggilan tool dapat diperiksa dan diekspor ke file{' '}
                        <span className="font-mono text-[#1F1A17]">.md</span> maupun{' '}
                        <span className="font-mono text-[#1F1A17]">.pdf</span> di tab{' '}
                        <strong className="text-[#1F1A17]">Log Agen</strong>.
                      </li>
                    </ol>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onRunAgentFromTutorial();
                      }}
                      className="inline-flex min-h-[38px] items-center gap-2 rounded-lg bg-[#C24E2B] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#A63E1F]"
                    >
                      <Play className="h-3.5 w-3.5" />
                      Jalankan Agen Sore Sekarang
                    </button>
                  </div>
                </div>
              )}

              {/* Langkah 3: Alur Persetujuan */}
              {stepIdx === 2 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 border-y border-[#EFE8DE] py-4 sm:grid-cols-3">
                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-[#C24E2B]">
                        Tahap 1 · Draf Agen + Toast
                      </div>
                      <p className="text-xs leading-relaxed text-[#6B5E55]">
                        Saat agen membuat draf baru berstatus{' '}
                        <strong className="text-[#1F1A17]">Menunggu persetujuan</strong>, notifikasi{' '}
                        <em>toast</em> instan muncul di pojok kanan bawah dengan tombol{' '}
                        <strong className="text-[#1F1A17]">Tinjau &amp; Setujui</strong>.
                      </p>
                    </div>
                    <div className="space-y-1 sm:border-l sm:border-[#EFE8DE] sm:pl-4">
                      <div className="text-xs font-semibold text-[#2D6A4F]">
                        Tahap 2 · Validasi Akuntan
                      </div>
                      <p className="text-xs leading-relaxed text-[#6B5E55]">
                        Manajemen atau akuntan memeriksa daftar{' '}
                        <strong className="text-[#1F1A17]">Belanja Pasar Sore</strong> dan{' '}
                        <strong className="text-[#1F1A17]">PO Gudang PH</strong>, lalu mengklik{' '}
                        <strong className="text-[#2D6A4F]">Setujui</strong> atau{' '}
                        <strong className="text-[#B91C1C]">Tolak</strong>.
                      </p>
                    </div>
                    <div className="space-y-1 sm:border-l sm:border-[#EFE8DE] sm:pl-4">
                      <div className="text-xs font-semibold text-[#1F1A17]">
                        Tahap 3 · Barang Masuk FIFO
                      </div>
                      <p className="text-xs leading-relaxed text-[#6B5E55]">
                        Pesanan yang disetujui masuk ke antrean pengiriman dan otomatis menambah batch
                        stok baru saat hari maju sesuai{' '}
                        <strong className="text-[#1F1A17]">lead time</strong> pemasok.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 rounded-lg bg-[#FAF7F2] px-4 py-3 text-xs text-[#6B5E55]">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#2D6A4F]" />
                    <span>
                      Kontrol <strong className="text-[#1F1A17]">human-in-the-loop</strong> ini
                      memastikan pengeluaran dana belanja sore dan PO pemasok tetap berada di bawah
                      persetujuan akuntan UMKM.
                    </span>
                  </div>
                </div>
              )}

              {/* Langkah 4: Verifikasi & Master Data */}
              {stepIdx === 3 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 border-y border-[#EFE8DE] py-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-[#1F1A17]">
                        <Calculator className="h-4 w-4 text-[#C24E2B]" />
                        <span>Tab Hitung Manual</span>
                      </div>
                      <p className="text-xs leading-relaxed text-[#6B5E55]">
                        Pilih salah satu dari 11 bahan baku untuk melihat substitusi angka langsung
                        pada rumus Safety Stock (SS), Target Stok / ROP, dan EOQ agar mudah diaudit.
                      </p>
                    </div>

                    <div className="space-y-1.5 sm:border-l sm:border-[#EFE8DE] sm:pl-4">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-[#1F1A17]">
                        <Database className="h-4 w-4 text-[#2D6A4F]" />
                        <span>Tab Bahan &amp; Penjualan</span>
                      </div>
                      <p className="text-xs leading-relaxed text-[#6B5E55]">
                        Ubah harga, lead time, umur simpan, atau stok fisik secara langsung, bangkitkan
                        120 hari data dummy baru, atau unggah file CSV transaksi penjualan Anda sendiri.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 rounded-lg bg-[#FAF7F2] px-4 py-3 text-xs text-[#6B5E55]">
                    <ScrollText className="mt-0.5 h-4 w-4 shrink-0 text-[#C24E2B]" />
                    <span>
                      Butuh arsip rapat operasional? Klik{' '}
                      <strong className="text-[#1F1A17]">Unduh PDF</strong> di bilah kontrol dasbor
                      untuk mengunduh ringkasan stok, draf pengadaan, dan log agen hari ini.
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Navigasi Langkah */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E6DDD2] bg-[#FAF7F2] px-5 py-3.5 sm:px-6">
              <div className="flex items-center gap-2">
                {currentStep.targetTab && currentStep.targetLabel && (
                  <button
                    type="button"
                    onClick={() => {
                      onNavigateTab(currentStep.targetTab!);
                      onClose();
                    }}
                    className="inline-flex min-h-[38px] items-center rounded-lg border border-[#E6DDD2] bg-white px-3.5 py-1.5 text-xs font-medium text-[#1F1A17] transition-colors hover:border-[#C24E2B]/50 hover:text-[#C24E2B] whitespace-nowrap"
                  >
                    {currentStep.targetLabel}
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStepIdx((prev) => Math.max(0, prev - 1))}
                  disabled={stepIdx === 0}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-[#E6DDD2] bg-white px-3.5 py-1.5 text-xs font-medium text-[#1F1A17] transition-colors hover:bg-[#FAF7F2] disabled:opacity-40 whitespace-nowrap"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Sebelumnya
                </button>

                {stepIdx < STEPS.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setStepIdx((prev) => Math.min(STEPS.length - 1, prev + 1))}
                    className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-[#C24E2B] px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#A63E1F] whitespace-nowrap"
                  >
                    Lanjut
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-[#2D6A4F] px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#23533D] whitespace-nowrap"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Selesai &amp; Mulai Gunakan
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
