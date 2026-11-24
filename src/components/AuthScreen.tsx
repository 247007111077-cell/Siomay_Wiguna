import { useEffect, useState, type FormEvent } from 'react';
import { Eye, EyeOff, Lock, LogIn, UserPlus } from 'lucide-react';
import type { AuthUser, UserRole } from '../types/inventory';
import { WIGUNA_HERO_IMAGE } from './IngredientThumb';

interface AuthScreenProps {
  onAuthenticated: (token: string, user: AuthUser) => void;
}

type AuthMode = 'login' | 'register';

const ROLE_OPTIONS: Array<{
  id: UserRole;
  title: string;
  desc: string;
}> = [
  {
    id: 'pemilik',
    title: 'Pemilik Usaha',
    desc: 'Akses penuh: jalankan agen sore, kelola stok & setujui pengadaan.',
  },
  {
    id: 'manajer_dapur',
    title: 'Manajer Dapur',
    desc: 'Operasional harian: agen sore, simulasi hari, stok & unggah CSV.',
  },
  {
    id: 'akuntan',
    title: 'Akuntan / Keuangan',
    desc: 'Otorisasi dana: tinjau, setujui/tolak draf belanja & ekspor PDF.',
  },
];

export function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [hasUsers, setHasUsers] = useState<boolean | null>(null);

  const [nama, setNama] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('pemilik');
  const [showPassword, setShowPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/auth/status')
      .then((r) => r.json())
      .then((res) => {
        if (!active) return;
        const exists = Boolean(res?.hasUsers);
        setHasUsers(exists);
        if (!exists) {
          setMode('register');
        }
      })
      .catch(() => {
        if (active) setHasUsers(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);

    try {
      const endpoint = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const body =
        mode === 'register'
          ? { nama, username, password, role }
          : { username, password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Gagal memproses autentikasi.');
      }

      if (json.token && json.user) {
        onAuthenticated(json.token, json.user);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Terjadi kesalahan saat masuk.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] px-4 py-8 sm:px-6 lg:flex lg:items-center lg:justify-center lg:px-8">
      <div className="mx-auto grid w-full max-w-5xl items-stretch overflow-hidden rounded-2xl border border-[#E6DDD2] bg-white lg:grid-cols-12">
        {/* Kolom Kiri: Visual Dapur Wiguna */}
        <div className="relative min-h-[240px] overflow-hidden bg-[#1F1A17] lg:col-span-5 lg:min-h-[580px]">
          <img
            src={WIGUNA_HERO_IMAGE}
            alt="Sajian Siomay Wiguna Tasikmalaya"
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/20" />
          <div className="absolute inset-x-0 bottom-0 p-6 text-white sm:p-8">
            <div className="text-xs text-white/80">
              UMKM Siomay Wiguna · Tasikmalaya
            </div>
            <h1 className="mt-1.5 font-display text-2xl font-bold leading-snug sm:text-3xl">
              Sistem Agen Persediaan Dapur &amp; Gudang PH
            </h1>
            <p className="mt-3 text-xs leading-relaxed text-white/85 sm:text-sm">
              Pantau stok segar harian, ramalan permintaan 7 hari, evaluasi kinerja pemasok, serta
              alur persetujuan belanja berbasis peran antara Manajer Dapur dan Akuntan.
            </p>
          </div>
        </div>

        {/* Kolom Kanan: Form Masuk / Daftar Akun */}
        <div className="flex flex-col justify-center p-6 sm:p-8 lg:col-span-7 lg:p-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-bold text-[#1F1A17] sm:text-2xl">
                {mode === 'login' ? 'Masuk ke Sistem' : 'Daftar Akun Baru'}
              </h2>
              <p className="mt-1 text-xs text-[#6B5E55]">
                {hasUsers === false && mode === 'register'
                  ? 'Belum ada akun terdaftar. Buat akun pertama untuk mulai mengelola persediaan.'
                  : 'Gunakan akun dengan peran Pemilik, Manajer Dapur, atau Akuntan.'}
              </p>
            </div>

            <div className="flex items-center gap-1 rounded-lg bg-[#FAF7F2] p-1">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrorMsg(null);
                }}
                className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                  mode === 'login'
                    ? 'bg-white text-[#C24E2B] shadow-xs'
                    : 'text-[#6B5E55] hover:text-[#1F1A17]'
                }`}
              >
                Masuk
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setErrorMsg(null);
                }}
                className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                  mode === 'register'
                    ? 'bg-white text-[#C24E2B] shadow-xs'
                    : 'text-[#6B5E55] hover:text-[#1F1A17]'
                }`}
              >
                Daftar Akun
              </button>
            </div>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="mt-4 rounded-lg border border-[#B91C1C]/30 bg-[#B91C1C]/5 px-4 py-2.5 text-xs font-medium text-[#B91C1C]"
            >
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {mode === 'register' && (
              <div>
                <label
                  htmlFor="auth-nama"
                  className="block text-xs font-semibold text-[#1F1A17]"
                >
                  Nama Lengkap
                </label>
                <input
                  id="auth-nama"
                  type="text"
                  required
                  minLength={2}
                  maxLength={80}
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  placeholder="Contoh: Siti Rahma"
                  className="mt-1.5 w-full rounded-lg border border-[#E6DDD2] bg-[#FAF7F2]/50 px-3.5 py-2.5 text-sm text-[#1F1A17] placeholder:text-[#6B5E55]/70 focus:border-[#C24E2B] focus:bg-white focus:outline-none"
                />
              </div>
            )}

            <div>
              <label
                htmlFor="auth-username"
                className="block text-xs font-semibold text-[#1F1A17]"
              >
                Username atau Email
              </label>
              <input
                id="auth-username"
                type="text"
                required
                minLength={3}
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Contoh: akuntan@wiguna.id atau siti.rahma"
                className="mt-1.5 w-full rounded-lg border border-[#E6DDD2] bg-[#FAF7F2]/50 px-3.5 py-2.5 text-sm text-[#1F1A17] placeholder:text-[#6B5E55]/70 focus:border-[#C24E2B] focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="auth-password"
                className="block text-xs font-semibold text-[#1F1A17]"
              >
                Kata Sandi
              </label>
              <div className="relative mt-1.5">
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  className="w-full rounded-lg border border-[#E6DDD2] bg-[#FAF7F2]/50 px-3.5 py-2.5 pr-11 text-sm text-[#1F1A17] placeholder:text-[#6B5E55]/70 focus:border-[#C24E2B] focus:bg-white focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-1 flex w-9 items-center justify-center text-[#6B5E55] hover:text-[#1F1A17]"
                  aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Lihat kata sandi'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {mode === 'register' && (
              <div>
                <span className="block text-xs font-semibold text-[#1F1A17]">
                  Peran Akses di Siomay Wiguna
                </span>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {ROLE_OPTIONS.map((opt) => {
                    const selected = role === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setRole(opt.id)}
                        className={`rounded-lg border p-3 text-left transition-colors ${
                          selected
                            ? 'border-[#C24E2B] bg-[#C24E2B]/5'
                            : 'border-[#E6DDD2] bg-white hover:border-[#C24E2B]/40'
                        }`}
                      >
                        <div className="text-xs font-bold text-[#1F1A17]">{opt.title}</div>
                        <p className="mt-1 text-[11px] leading-snug text-[#6B5E55]">
                          {opt.desc}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-[#C24E2B] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#A63E1F] disabled:opacity-60"
            >
              {mode === 'register' ? (
                <UserPlus className="h-4 w-4" />
              ) : (
                <LogIn className="h-4 w-4" />
              )}
              <span>
                {submitting
                  ? 'Memproses...'
                  : mode === 'register'
                    ? 'Daftar & Masuk ke Dasbor'
                    : 'Masuk ke Dasbor'}
              </span>
            </button>
          </form>

          <div className="mt-6 flex items-start gap-2 border-t border-[#EFE8DE] pt-4 text-xs text-[#6B5E55]">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#2D6A4F]" />
            <span>
              Kata sandi dienkripsi menggunakan salt acak di server. Anda dapat mendaftarkan akun
              terpisah untuk <strong className="text-[#1F1A17]">Manajer Dapur</strong> dan{' '}
              <strong className="text-[#1F1A17]">Akuntan</strong> agar alur persetujuan dana berjalan
              terpisah.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
