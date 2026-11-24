import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import type {
  AppState,
  AuthUser,
  DashboardResponse,
  IngredientMaster,
  SkenarioId,
} from './src/types/inventory.ts';
import {
  buildChartData,
  buildIngredientTrends,
  buildMonthlyTrends,
  buildSupplierPerformance,
  buildWeeklyUsageHeatmap,
  calculatePolicyForIngredient,
  findIngredientByName,
  generateDummySales,
  getSupplierForIngredient,
  parseSalesCsv,
  simulateAdvanceOneDay,
} from './server/engine.ts';
import { loadState, resetStateToDefault, saveState } from './server/store.ts';
import { runAfternoonInventoryAgent } from './server/agent.ts';
import {
  canApproveDrafts,
  canManageOperations,
  getAuthStatus,
  loginUser,
  registerUser,
  revokeBearerToken,
  verifyBearerToken,
} from './server/auth.ts';

function buildDashboardResponse(state: AppState): DashboardResponse {
  const policies = state.ingredients.map((ing) => calculatePolicyForIngredient(state, ing));
  const chartData = buildChartData(state);
  const ingredientTrends = buildIngredientTrends(state);
  const monthlyTrends = buildMonthlyTrends(state);
  const weeklyHeatmap = buildWeeklyUsageHeatmap(state);
  const supplierPerformance = buildSupplierPerformance(state);

  const amanCount = policies.filter((p) => p.status === 'Aman').length;
  const waspadaCount = policies.filter((p) => p.status === 'Waspada').length;
  const kritisCount = policies.filter((p) => p.status === 'Kritis').length;
  const kedaluwarsaRiskCount = policies.filter((p) => p.nearExpiryRisk).length;
  const estimasiBelanjaSore = policies
    .filter((p) => p.jenis === 'segar')
    .reduce((sum, p) => sum + p.estimatedOrderCost, 0);
  const totalWasteRp = state.wasteLogs.reduce((sum, w) => sum + w.nilaiKerugian, 0);
  const pendingDraftsCount = state.drafts.filter((d) => d.status === 'Menunggu persetujuan').length;

  return {
    state,
    policies,
    chartData,
    ingredientTrends,
    monthlyTrends,
    weeklyHeatmap,
    supplierPerformance,
    summary: {
      amanCount,
      waspadaCount,
      kritisCount,
      kedaluwarsaRiskCount,
      estimasiBelanjaSore,
      totalWasteRp,
      totalSalesRows: state.sales.length,
      pendingDraftsCount,
    },
  };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  let state = loadState();

  const getAuthenticatedUser = (req: express.Request, res: express.Response): AuthUser | null => {
    const user = verifyBearerToken(req.headers.authorization);
    if (!user) {
      res.status(401).json({
        error: 'Sesi login tidak valid atau telah berakhir. Silakan masuk kembali.',
      });
      return null;
    }
    return user;
  };

  // Endpoint Autentikasi Publik (Status, Registrasi, Masuk, Keluar, Profil)
  app.get('/api/auth/status', (_req, res) => {
    res.json(getAuthStatus());
  });

  app.post('/api/auth/register', (req, res) => {
    const result = registerUser(req.body || {});
    if (result.ok === false) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.status(201).json({ token: result.token, user: result.user });
  });

  app.post('/api/auth/login', (req, res) => {
    const result = loginUser(req.body || {});
    if (result.ok === false) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.json({ token: result.token, user: result.user });
  });

  app.post('/api/auth/logout', (req, res) => {
    revokeBearerToken(req.headers.authorization);
    res.json({ ok: true });
  });

  app.get('/api/auth/me', (req, res) => {
    const user = getAuthenticatedUser(req, res);
    if (!user) return;
    res.json({ user });
  });

  // Ambil state & seluruh kalkulasi dasbor (terautentikasi)
  app.get('/api/state', (req, res) => {
    const user = getAuthenticatedUser(req, res);
    if (!user) return;
    res.json(buildDashboardResponse(state));
  });

  // Reset seluruh simulasi ke kondisi awal
  app.post('/api/reset', (req, res) => {
    const user = getAuthenticatedUser(req, res);
    if (!user) return;
    if (!canManageOperations(user.role)) {
      res.status(403).json({
        error: 'Hanya Manajer Dapur atau Pemilik Usaha yang dapat mereset simulasi.',
      });
      return;
    }
    state = resetStateToDefault();
    res.json(buildDashboardResponse(state));
  });

  // Bangkitkan 120 hari data dummy penjualan
  app.post('/api/sales/dummy', (req, res) => {
    const user = getAuthenticatedUser(req, res);
    if (!user) return;
    if (!canManageOperations(user.role)) {
      res.status(403).json({
        error: 'Hanya Manajer Dapur atau Pemilik Usaha yang dapat memperbarui data penjualan.',
      });
      return;
    }
    const newSeed = Math.floor(Date.now() % 1000000);
    state = {
      ...state,
      sales: generateDummySales(state.config.currentDate, 120, newSeed),
    };
    saveState(state);
    res.json(buildDashboardResponse(state));
  });

  // Unggah CSV penjualan
  app.post('/api/sales/upload', (req, res) => {
    const user = getAuthenticatedUser(req, res);
    if (!user) return;
    if (!canManageOperations(user.role)) {
      res.status(403).json({
        error: 'Hanya Manajer Dapur atau Pemilik Usaha yang dapat mengunggah CSV penjualan.',
      });
      return;
    }
    const csvText = typeof req.body?.csv === 'string' ? req.body.csv : '';
    const parsed = parseSalesCsv(csvText);
    if (parsed.error) {
      res.status(400).json({ error: parsed.error });
      return;
    }

    const dates = Array.from(new Set(parsed.records.map((r) => r.Tanggal))).sort();
    const latestDate = dates[dates.length - 1] || state.config.currentDate;

    state = {
      ...state,
      sales: parsed.records,
      config: {
        ...state.config,
        currentDate: latestDate,
      },
    };
    saveState(state);
    res.json(buildDashboardResponse(state));
  });

  // Ubah konfigurasi simulasi (z-score, biaya pesan, biaya simpan, skenario)
  app.put('/api/config', (req, res) => {
    const user = getAuthenticatedUser(req, res);
    if (!user) return;
    if (!canManageOperations(user.role)) {
      res.status(403).json({
        error: 'Hanya Manajer Dapur atau Pemilik Usaha yang dapat mengubah konfigurasi skenario.',
      });
      return;
    }
    const { zScore, orderingCost, holdingCostRate, scenario } = req.body || {};
    const validScenarios: SkenarioId[] = ['normal', 'lonjakan', 'terlambat'];

    state = {
      ...state,
      config: {
        ...state.config,
        zScore:
          typeof zScore === 'number' && zScore >= 0.5 && zScore <= 3.5
            ? zScore
            : state.config.zScore,
        orderingCost:
          typeof orderingCost === 'number' && orderingCost >= 0
            ? orderingCost
            : state.config.orderingCost,
        holdingCostRate:
          typeof holdingCostRate === 'number' && holdingCostRate > 0 && holdingCostRate <= 1
            ? holdingCostRate
            : state.config.holdingCostRate,
        scenario: validScenarios.includes(scenario) ? scenario : state.config.scenario,
      },
    };
    saveState(state);
    res.json(buildDashboardResponse(state));
  });

  // Perbarui master bahan (harga, lead time, umur simpan, stok awal, jenis)
  app.put('/api/ingredients/:id', (req, res) => {
    const user = getAuthenticatedUser(req, res);
    if (!user) return;
    if (!canManageOperations(user.role)) {
      res.status(403).json({
        error: 'Hanya Manajer Dapur atau Pemilik Usaha yang dapat mengubah master bahan.',
      });
      return;
    }
    const { id } = req.params;
    const patch = req.body || {};

    const idx = state.ingredients.findIndex((i) => i.id === id);
    if (idx === -1) {
      res.status(404).json({ error: 'Bahan tidak ditemukan.' });
      return;
    }

    const current = state.ingredients[idx];
    const nextHarga =
      typeof patch.harga === 'number' && patch.harga >= 0 ? patch.harga : current.harga;
    const nextLead =
      typeof patch.leadTimeHari === 'number' && patch.leadTimeHari >= 1
        ? Math.round(patch.leadTimeHari)
        : current.leadTimeHari;
    const nextShelf =
      typeof patch.umurSimpanHari === 'number' && patch.umurSimpanHari >= 1
        ? Math.round(patch.umurSimpanHari)
        : current.umurSimpanHari;
    const nextJenis =
      patch.jenis === 'segar' || patch.jenis === 'tahan lama' ? patch.jenis : current.jenis;

    let nextBatches = current.batches;
    let nextStokAwal = current.stokAwal;

    // Jika pengguna mengubah stok langsung di tabel master bahan, sesuaikan batch aktif
    if (typeof patch.stokSaatIni === 'number' && patch.stokSaatIni >= 0) {
      nextStokAwal = patch.stokSaatIni;
      nextBatches = [
        {
          id: `batch-edit-${Date.now()}`,
          qty: patch.stokSaatIni,
          sisaUmurHari: nextShelf,
          asal: 'Penyesuaian manual',
          tanggalMasuk: state.config.currentDate,
        },
      ];
    }

    const updated: IngredientMaster = {
      ...current,
      harga: nextHarga,
      leadTimeHari: nextLead,
      umurSimpanHari: nextShelf,
      stokAwal: nextStokAwal,
      jenis: nextJenis,
      batches: nextBatches,
    };

    const nextList = [...state.ingredients];
    nextList[idx] = updated;
    state = { ...state, ingredients: nextList };
    saveState(state);
    res.json(buildDashboardResponse(state));
  });

  // Simulasi maju 1 hari (konsumsi FIFO, pesanan datang, buang bahan kedaluwarsa jadi waste)
  app.post('/api/simulate/advance-day', (req, res) => {
    const user = getAuthenticatedUser(req, res);
    if (!user) return;
    if (!canManageOperations(user.role)) {
      res.status(403).json({
        error: 'Hanya Manajer Dapur atau Pemilik Usaha yang dapat menjalankan simulasi hari berikutnya.',
      });
      return;
    }
    const { nextState, dayReport } = simulateAdvanceOneDay(state);
    state = nextState;
    saveState(state);
    res.json({
      ...buildDashboardResponse(state),
      dayReport,
    });
  });

  // Jalankan Agen Persediaan Sore (16.30) via Gemini Function Calling
  app.post('/api/agent/run', async (req, res) => {
    const user = getAuthenticatedUser(req, res);
    if (!user) return;
    if (!canManageOperations(user.role)) {
      res.status(403).json({
        error: 'Hanya Manajer Dapur atau Pemilik Usaha yang dapat menjalankan Agen Sore.',
      });
      return;
    }
    try {
      const { runRecord, createdDrafts, createdFlags } = await runAfternoonInventoryAgent(state);

      state = {
        ...state,
        drafts: [...createdDrafts, ...state.drafts].slice(0, 100),
        riskFlags: [...createdFlags, ...state.riskFlags].slice(0, 100),
        agentRuns: [runRecord, ...state.agentRuns].slice(0, 20),
      };
      saveState(state);

      if (runRecord.error) {
        res.status(502).json({
          error: runRecord.error,
          createdDrafts,
          ...buildDashboardResponse(state),
        });
        return;
      }

      res.json({
        ...buildDashboardResponse(state),
        createdDrafts,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan saat menjalankan agen.';
      res.status(400).json({ error: message });
    }
  });

  // Persetujuan human-in-the-loop (akuntan/pemilik Setujui / Tolak draf pesanan)
  app.post('/api/drafts/:id/decision', (req, res) => {
    const user = getAuthenticatedUser(req, res);
    if (!user) return;
    if (!canApproveDrafts(user.role)) {
      res.status(403).json({
        error: 'Hanya Akuntan atau Pemilik Usaha yang berwenang menyetujui atau menolak draf pengadaan.',
      });
      return;
    }
    const { id } = req.params;
    const decision = req.body?.decision;
    if (decision !== 'Disetujui' && decision !== 'Ditolak') {
      res.status(400).json({ error: 'Keputusan harus bernilai Disetujui atau Ditolak.' });
      return;
    }

    const idx = state.drafts.findIndex((d) => d.id === id);
    if (idx === -1) {
      res.status(404).json({ error: 'Draf pesanan tidak ditemukan.' });
      return;
    }

    const targetDraft = state.drafts[idx];
    if (targetDraft.status !== 'Menunggu persetujuan') {
      res.status(400).json({ error: 'Draf pesanan sudah diproses sebelumnya.' });
      return;
    }

    const updatedDraft = {
      ...targetDraft,
      status: decision,
      diputuskanPada: new Date().toISOString(),
      diputuskanOleh: `${user.nama} (${user.roleLabel})`,
    };

    const nextDrafts = [...state.drafts];
    nextDrafts[idx] = updatedDraft;

    let nextIncoming = [...state.incomingOrders];
    if (decision === 'Disetujui') {
      const ing = findIngredientByName(state.ingredients, targetDraft.bahan);
      const leadHari = ing ? targetDraft.leadTimeHari : 1;
      const plannedLeadHari = ing ? ing.leadTimeHari : 1;
      nextIncoming.push({
        id: `ORD-${Date.now()}`,
        bahan: targetDraft.bahan,
        satuan: targetDraft.satuan,
        qty: targetDraft.qty,
        sisaLeadTimeHari: Math.max(1, leadHari),
        plannedLeadTimeHari: plannedLeadHari,
        pemasok: getSupplierForIngredient(targetDraft.bahan),
        tanggalPesan: state.config.currentDate,
      });
    }

    state = {
      ...state,
      drafts: nextDrafts,
      incomingOrders: nextIncoming,
    };
    saveState(state);
    res.json(buildDashboardResponse(state));
  });

  // Vite middleware untuk development atau static dist untuk production
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server Siomay Wiguna berjalan di http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Gagal memulai server:', err);
  process.exit(1);
});
