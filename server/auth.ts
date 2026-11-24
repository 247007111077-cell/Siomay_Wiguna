import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { AuthUser, UserRole } from '../src/types/inventory.ts';

interface StoredUser {
  id: string;
  nama: string;
  username: string;
  role: UserRole;
  salt: string;
  passwordHash: string;
  createdAt: string;
}

interface SessionPayload {
  jti: string;
  sub: string;
  role: UserRole;
  exp: number;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const USERS_FILE = path.resolve(DATA_DIR, 'users.json');

if (!USERS_FILE.startsWith(DATA_DIR + path.sep)) {
  throw new Error('Konfigurasi path penyimpanan pengguna tidak valid.');
}

const ROLE_LABELS: Record<UserRole, string> = {
  pemilik: 'Pemilik Usaha',
  manajer_dapur: 'Manajer Dapur',
  akuntan: 'Akuntan',
};

const VALID_ROLES: readonly UserRole[] = ['pemilik', 'manajer_dapur', 'akuntan'];
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

// Kunci penanda tangan token sesi: baca dari env jika tersedia, atau fallback acak di memori
const SIGNING_KEY =
  process.env.SESSION_SECRET && process.env.SESSION_SECRET.trim().length >= 16
    ? Buffer.from(process.env.SESSION_SECRET, 'utf8')
    : crypto.randomBytes(32);

const activeSessions = new Map<string, { userId: string; expiresAt: number }>();

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadUsers(): StoredUser[] {
  ensureDataDir();
  try {
    if (fs.existsSync(USERS_FILE)) {
      const raw = fs.readFileSync(USERS_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (u): u is StoredUser =>
            Boolean(u && typeof u.id === 'string' && typeof u.username === 'string' && typeof u.passwordHash === 'string')
        );
      }
    }
  } catch (err) {
    console.error('Gagal membaca data pengguna:', err);
  }
  return [];
}

function saveUsers(users: StoredUser[]): void {
  ensureDataDir();
  const tmpFile = `${USERS_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(users, null, 2), 'utf8');
  fs.renameSync(tmpFile, USERS_FILE);
}

function toPublicUser(user: StoredUser): AuthUser {
  return {
    id: user.id,
    nama: user.nama,
    username: user.username,
    role: user.role,
    roleLabel: ROLE_LABELS[user.role] || user.role,
    createdAt: user.createdAt,
  };
}

function hashPassword(password: string, salt: string): Buffer {
  return crypto.scryptSync(password, salt, 64);
}

function signToken(payload: SessionPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', SIGNING_KEY).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

function parseAndVerifyToken(token: string): SessionPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  if (!encoded || !sig) return null;

  const expectedSig = crypto
    .createHmac('sha256', SIGNING_KEY)
    .update(encoded)
    .digest('base64url');

  const sigBuf = Buffer.from(sig, 'utf8');
  const expBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const decoded = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload;
    if (!decoded || typeof decoded.jti !== 'string' || typeof decoded.sub !== 'string') {
      return null;
    }
    if (typeof decoded.exp !== 'number' || Date.now() > decoded.exp) {
      activeSessions.delete(decoded.jti);
      return null;
    }
    const session = activeSessions.get(decoded.jti);
    if (!session || session.userId !== decoded.sub || Date.now() > session.expiresAt) {
      activeSessions.delete(decoded.jti);
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

function issueSessionForUser(user: StoredUser): string {
  const jti = crypto.randomBytes(16).toString('hex');
  const expiresAt = Date.now() + SESSION_TTL_MS;
  activeSessions.set(jti, { userId: user.id, expiresAt });
  return signToken({
    jti,
    sub: user.id,
    role: user.role,
    exp: expiresAt,
  });
}

export function getAuthStatus(): { hasUsers: boolean; totalUsers: number } {
  const users = loadUsers();
  return {
    hasUsers: users.length > 0,
    totalUsers: users.length,
  };
}

export function registerUser(input: {
  nama?: unknown;
  username?: unknown;
  password?: unknown;
  role?: unknown;
}): { ok: true; token: string; user: AuthUser } | { ok: false; status: number; error: string } {
  const nama = typeof input.nama === 'string' ? input.nama.trim() : '';
  const username = typeof input.username === 'string' ? input.username.trim().toLowerCase() : '';
  const password = typeof input.password === 'string' ? input.password : '';
  const role = typeof input.role === 'string' ? (input.role.trim() as UserRole) : 'pemilik';

  if (nama.length < 2 || nama.length > 80) {
    return { ok: false, status: 400, error: 'Nama lengkap harus diisi (2–80 karakter).' };
  }
  if (!/^[a-z0-9._@-]{3,48}$/.test(username)) {
    return {
      ok: false,
      status: 400,
      error: 'Username/email minimal 3 karakter (hanya huruf kecil, angka, titik, _, @, -).',
    };
  }
  if (password.length < 6 || password.length > 100) {
    return { ok: false, status: 400, error: 'Kata sandi minimal 6 karakter.' };
  }
  if (!VALID_ROLES.includes(role)) {
    return { ok: false, status: 400, error: 'Peran pengguna tidak valid.' };
  }

  const users = loadUsers();
  if (users.some((u) => u.username === username)) {
    return { ok: false, status: 409, error: 'Username atau email sudah terdaftar. Silakan masuk.' };
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = hashPassword(password, salt).toString('hex');

  const newUser: StoredUser = {
    id: `USR-${crypto.randomUUID()}`,
    nama,
    username,
    role,
    salt,
    passwordHash,
    createdAt: new Date().toISOString(),
  };

  saveUsers([...users, newUser]);
  const token = issueSessionForUser(newUser);
  return { ok: true, token, user: toPublicUser(newUser) };
}

export function loginUser(input: {
  username?: unknown;
  password?: unknown;
}): { ok: true; token: string; user: AuthUser } | { ok: false; status: number; error: string } {
  const username = typeof input.username === 'string' ? input.username.trim().toLowerCase() : '';
  const password = typeof input.password === 'string' ? input.password : '';

  if (!username || !password) {
    return { ok: false, status: 400, error: 'Username dan kata sandi wajib diisi.' };
  }

  const users = loadUsers();
  const found = users.find((u) => u.username === username);
  if (!found) {
    return { ok: false, status: 401, error: 'Username atau kata sandi tidak sesuai.' };
  }

  const derived = hashPassword(password, found.salt);
  const stored = Buffer.from(found.passwordHash, 'hex');
  if (derived.length !== stored.length || !crypto.timingSafeEqual(derived, stored)) {
    return { ok: false, status: 401, error: 'Username atau kata sandi tidak sesuai.' };
  }

  const token = issueSessionForUser(found);
  return { ok: true, token, user: toPublicUser(found) };
}

export function verifyBearerToken(authHeader?: string): AuthUser | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;

  const payload = parseAndVerifyToken(token);
  if (!payload) return null;

  const users = loadUsers();
  const user = users.find((u) => u.id === payload.sub);
  if (!user) {
    activeSessions.delete(payload.jti);
    return null;
  }
  return toPublicUser(user);
}

export function revokeBearerToken(authHeader?: string): void {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return;
  const token = authHeader.slice(7).trim();
  const payload = parseAndVerifyToken(token);
  if (payload) {
    activeSessions.delete(payload.jti);
  }
}

export function canManageOperations(role: UserRole): boolean {
  return role === 'pemilik' || role === 'manajer_dapur';
}

export function canApproveDrafts(role: UserRole): boolean {
  return role === 'pemilik' || role === 'akuntan';
}
