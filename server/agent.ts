import { GoogleGenAI, Type } from '@google/genai';
import type { Content, FunctionDeclaration } from '@google/genai';
import type {
  AgentRunRecord,
  AgentStepLog,
  AppState,
  PurchaseDraft,
  RiskFlag,
} from '../src/types/inventory.ts';
import {
  PRASMANAN_ITEMS,
  buildDailyUsageSeries,
  calculatePolicyForIngredient,
  findIngredientByName,
  getIngredientStockStats,
  getScenarioModifiers,
  meanAndStdDev,
} from './engine.ts';

const TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'get_sales_summary',
    description:
      'Mengambil ringkasan penjualan historis selama N hari terakhir beserta total ekivalen unit prasmanan per menu.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        hari: {
          type: Type.INTEGER,
          description: 'Jumlah hari terakhir yang diringkas, misalnya 7 atau 30.',
        },
      },
      required: ['hari'],
    },
  },
  {
    name: 'forecast_demand',
    description:
      'Menghitung ramalan permintaan deterministik menggunakan rata-rata bergerak 7 hari dan simpangan baku untuk suatu item menu atau bahan baku.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        item: {
          type: Type.STRING,
          description: 'Nama menu prasmanan (mis. Siomay) atau nama bahan baku (mis. Ikan tenggiri).',
        },
        horizon: {
          type: Type.INTEGER,
          description: 'Horizon ramalan dalam hari ke depan, misalnya 1 untuk besok.',
        },
      },
      required: ['item', 'horizon'],
    },
  },
  {
    name: 'get_inventory',
    description:
      'Mengambil status stok saat ini, sisa umur simpan terpendek, jumlah mendekati kedaluwarsa, dan pesanan masuk untuk seluruh 11 bahan baku.',
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: 'calc_policy',
    description:
      'Menghitung kebijakan persediaan deterministik untuk satu bahan baku: Safety Stock (SS), Target Stok (untuk bahan segar) atau ROP & EOQ (untuk bahan tahan lama), serta jumlah pesan disarankan.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        bahan: {
          type: Type.STRING,
          description: 'Nama bahan baku sesuai master bahan, misalnya Ikan tenggiri.',
        },
      },
      required: ['bahan'],
    },
  },
  {
    name: 'create_purchase_draft',
    description:
      'Membuat draf pesanan pembelian berstatus Menunggu persetujuan untuk disetujui oleh akuntan/pemilik.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        bahan: {
          type: Type.STRING,
          description: 'Nama bahan baku yang akan dipesan.',
        },
        qty: {
          type: Type.NUMBER,
          description: 'Jumlah pesanan persis dari recommendedOrderQty pada calc_policy.',
        },
        alasan: {
          type: Type.STRING,
          description: 'Alasan singkat 1-2 kalimat mengapa pesanan ini perlu dibuat.',
        },
      },
      required: ['bahan', 'qty', 'alasan'],
    },
  },
  {
    name: 'flag_risk',
    description:
      'Menandai risiko persediaan untuk bahan yang stoknya kritis atau mendekati kedaluwarsa.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        bahan: {
          type: Type.STRING,
          description: 'Nama bahan baku yang berisiko.',
        },
        jenis: {
          type: Type.STRING,
          description: 'Jenis risiko: stok_kritis atau mendekati_kedaluwarsa.',
        },
        alasan: {
          type: Type.STRING,
          description: 'Alasan singkat 1-2 kalimat mengenai risiko tersebut.',
        },
      },
      required: ['bahan', 'jenis', 'alasan'],
    },
  },
];

function inferPhase(toolName: string): AgentStepLog['phase'] {
  if (toolName === 'get_sales_summary' || toolName === 'get_inventory') return 'Amati';
  if (toolName === 'forecast_demand' || toolName === 'calc_policy') return 'Putuskan';
  return 'Bertindak';
}

function summarizeAutoReason(toolName: string, args: Record<string, unknown>, output: Record<string, unknown>): string {
  if (typeof args.alasan === 'string' && args.alasan.trim().length > 0) {
    return args.alasan.trim();
  }
  if (toolName === 'get_sales_summary') {
    return `Mengamati ringkasan penjualan ${args.hari ?? 7} hari terakhir untuk memahami pola permintaan aktual.`;
  }
  if (toolName === 'get_inventory') {
    return 'Mengamati posisi stok fisik seluruh 11 bahan baku beserta sisa umur simpan batch aktif.';
  }
  if (toolName === 'forecast_demand') {
    return `Memeriksa proyeksi permintaan ${String(args.item ?? '')} untuk horizon ${args.horizon ?? 1} hari ke depan.`;
  }
  if (toolName === 'calc_policy') {
    const status = typeof output.status === 'string' ? output.status : '-';
    const rec = output.recommendedOrderQty ?? 0;
    return `Menghitung kebijakan persediaan ${String(args.bahan ?? '')}: status ${status}, saran pesan ${rec} ${String(output.satuan ?? '')}.`;
  }
  return `Menjalankan tool ${toolName}.`;
}

export async function runAfternoonInventoryAgent(state: AppState): Promise<{
  runRecord: AgentRunRecord;
  createdDrafts: PurchaseDraft[];
  createdFlags: RiskFlag[];
}> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error(
      'GEMINI_API_KEY belum tersedia di konfigurasi server. Tambahkan API key pada panel Secrets sebelum menjalankan agen.'
    );
  }

  if (state.sales.length === 0) {
    throw new Error(
      'Data penjualan masih kosong. Klik "Gunakan data dummy" atau unggah file CSV penjualan terlebih dahulu.'
    );
  }

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const steps: AgentStepLog[] = [];
  const createdDrafts: PurchaseDraft[] = [];
  const createdFlags: RiskFlag[] = [];
  const draftedBahanSet = new Set<string>();
  const flaggedSet = new Set<string>();

  const executeTool = (name: string, rawArgs: Record<string, unknown>): Record<string, unknown> => {
    if (name === 'get_sales_summary') {
      const hari = Math.max(1, Math.min(120, Number(rawArgs.hari) || 7));
      const series = buildDailyUsageSeries(state.sales);
      if (series.length === 0) {
        return { status: 'data tidak tersedia', pesan: 'Tidak ada data penjualan.' };
      }
      const slice = series.slice(-hari);
      const { demandMultiplier, label } = getScenarioModifiers(state.config.scenario);
      const totalPerMenu: Record<string, number> = {};
      for (const item of PRASMANAN_ITEMS) {
        totalPerMenu[item] = Math.round(
          slice.reduce((sum, d) => sum + (d.prasmananByItem[item] || 0), 0) * 10
        ) / 10;
      }
      const avgDailyTotal =
        Math.round(
          (slice.reduce((sum, d) => sum + d.totalPrasmanan, 0) / slice.length) * 100
        ) / 100;

      return {
        periodeHari: slice.length,
        tanggalMulai: slice[0].tanggal,
        tanggalAkhir: slice[slice.length - 1].tanggal,
        skenarioAktif: label,
        pengaliPermintaan: demandMultiplier,
        rataRataUnitPrasmananPerHari: avgDailyTotal,
        totalEkivalenPerMenu: totalPerMenu,
      };
    }

    if (name === 'forecast_demand') {
      const itemQuery = String(rawArgs.item || '').trim();
      const horizon = Math.max(1, Math.min(14, Number(rawArgs.horizon) || 1));
      const series = buildDailyUsageSeries(state.sales);
      const last7 = series.slice(-7);
      if (last7.length === 0) {
        return { status: 'data tidak tersedia' };
      }
      const { demandMultiplier } = getScenarioModifiers(state.config.scenario);

      // Cek apakah item menu prasmanan
      const menuMatch = PRASMANAN_ITEMS.find(
        (m) => m.toLowerCase() === itemQuery.toLowerCase()
      );
      if (menuMatch) {
        const vals = last7.map((d) => (d.prasmananByItem[menuMatch] || 0) * demandMultiplier);
        const { mean, stdDev } = meanAndStdDev(vals);
        return {
          item: menuMatch,
          tipe: 'menu',
          horizonHari: horizon,
          movingAverage7Hari: Math.round(mean * 100) / 100,
          simpanganBaku: Math.round(stdDev * 100) / 100,
          proyeksiTotalHorizon: Math.round(mean * horizon * 100) / 100,
        };
      }

      // Cek bahan baku
      const ing = findIngredientByName(state.ingredients, itemQuery);
      if (!ing) {
        return { status: 'data tidak tersedia', pesan: `Item '${itemQuery}' tidak ditemukan.` };
      }
      const vals = last7.map((d) => (d.ingredientsUsage[ing.nama] || 0) * demandMultiplier);
      const { mean, stdDev } = meanAndStdDev(vals);
      return {
        item: ing.nama,
        satuan: ing.satuan,
        tipe: 'bahan',
        horizonHari: horizon,
        movingAverage7Hari: Math.round(mean * 1000) / 1000,
        simpanganBaku: Math.round(stdDev * 1000) / 1000,
        proyeksiTotalHorizon: Math.round(mean * horizon * 1000) / 1000,
      };
    }

    if (name === 'get_inventory') {
      const items = state.ingredients.map((ing) => {
        const stats = getIngredientStockStats(ing);
        return {
          bahan: ing.nama,
          jenis: ing.jenis,
          satuan: ing.satuan,
          stokSaatIni: Math.round(stats.totalStock * 1000) / 1000,
          minSisaUmurHari: stats.minSisaUmurHari,
          qtyMendekatiKedaluwarsa: Math.round(stats.nearExpiryQty * 1000) / 1000,
          leadTimeDasarHari: ing.leadTimeHari,
          hargaSatuan: ing.harga,
        };
      });
      return {
        tanggalSimulasi: state.config.currentDate,
        totalBahan: items.length,
        pesananSedangJalan: state.incomingOrders,
        daftarStok: items,
      };
    }

    if (name === 'calc_policy') {
      const bahanQuery = String(rawArgs.bahan || '').trim();
      const ing = findIngredientByName(state.ingredients, bahanQuery);
      if (!ing) {
        return { status: 'data tidak tersedia', pesan: `Bahan '${bahanQuery}' tidak ditemukan.` };
      }
      const policy = calculatePolicyForIngredient(state, ing);
      return {
        bahan: policy.nama,
        jenis: policy.jenis,
        satuan: policy.satuan,
        stokSaatIni: policy.stokSaatIni,
        rataRataHarian7Hari: Math.round(policy.dBar * 1000) / 1000,
        simpanganBaku: Math.round(policy.sigma * 1000) / 1000,
        zScore: policy.zScore,
        effectiveLeadTimeHari: policy.effectiveLeadTime,
        safetyStock: Math.round(policy.safetyStock * 1000) / 1000,
        targetStok: policy.targetStok !== null ? Math.round(policy.targetStok * 1000) / 1000 : null,
        rop: policy.rop !== null ? Math.round(policy.rop * 1000) / 1000 : null,
        eoq: policy.eoq !== null ? Math.round(policy.eoq * 1000) / 1000 : null,
        recommendedOrderQty: policy.recommendedOrderQty,
        estimatedOrderCostRp: policy.estimatedOrderCost,
        status: policy.status,
        nearExpiryRisk: policy.nearExpiryRisk,
        minSisaUmurHari: policy.minSisaUmurHari,
      };
    }

    if (name === 'create_purchase_draft') {
      const bahanQuery = String(rawArgs.bahan || '').trim();
      const ing = findIngredientByName(state.ingredients, bahanQuery);
      if (!ing) {
        return { status: 'data tidak tersedia', pesan: `Bahan '${bahanQuery}' tidak ditemukan.` };
      }
      const policy = calculatePolicyForIngredient(state, ing);
      // Gunakan nilai deterministik bila agen memesan > 0; tolak jika duplikat atau 0
      const requestedQty = Number(rawArgs.qty);
      const finalQty =
        Number.isFinite(requestedQty) && requestedQty > 0
          ? requestedQty
          : policy.recommendedOrderQty;

      if (finalQty <= 0) {
        return {
          status: 'dilewati',
          pesan: `Stok ${ing.nama} masih mencukupi (recommendedOrderQty = 0).`,
        };
      }

      if (draftedBahanSet.has(ing.nama)) {
        return {
          status: 'sudah_ada',
          pesan: `Draf pesanan untuk ${ing.nama} sudah dibuat pada sesi ini.`,
        };
      }

      draftedBahanSet.add(ing.nama);
      const { leadTimePenalty } = getScenarioModifiers(state.config.scenario);
      const draft: PurchaseDraft = {
        id: `DRF-${Date.now()}-${createdDrafts.length + 1}`,
        tanggalBuat: state.config.currentDate,
        bahan: ing.nama,
        satuan: ing.satuan,
        qty: finalQty,
        hargaSatuan: ing.harga,
        estimasiBiaya: Math.round(finalQty * ing.harga),
        leadTimeHari: ing.leadTimeHari + leadTimePenalty,
        alasan: String(rawArgs.alasan || 'Stok di bawah kebijakan target/ROP.'),
        status: 'Menunggu persetujuan',
      };
      createdDrafts.push(draft);

      return {
        status: 'berhasil',
        draftId: draft.id,
        bahan: draft.bahan,
        qty: draft.qty,
        satuan: draft.satuan,
        estimasiBiayaRp: draft.estimasiBiaya,
        statusPersetujuan: draft.status,
      };
    }

    if (name === 'flag_risk') {
      const bahanQuery = String(rawArgs.bahan || '').trim();
      const ing = findIngredientByName(state.ingredients, bahanQuery);
      const namaBahan = ing ? ing.nama : bahanQuery;
      const jenisRaw = String(rawArgs.jenis || 'stok_kritis').toLowerCase();
      const jenis: RiskFlag['jenis'] = jenisRaw.includes('kedaluwarsa')
        ? 'mendekati_kedaluwarsa'
        : 'stok_kritis';

      const dedupKey = `${namaBahan}::${jenis}`;
      if (flaggedSet.has(dedupKey)) {
        return { status: 'sudah_ditandai', bahan: namaBahan, jenis };
      }
      flaggedSet.add(dedupKey);

      const flag: RiskFlag = {
        id: `RSK-${Date.now()}-${createdFlags.length + 1}`,
        bahan: namaBahan,
        jenis,
        alasan: String(rawArgs.alasan || 'Risiko terdeteksi oleh agen persediaan.'),
        tanggal: state.config.currentDate,
      };
      createdFlags.push(flag);

      return {
        status: 'ditandai',
        flagId: flag.id,
        bahan: flag.bahan,
        jenis: flag.jenis,
      };
    }

    return { status: 'data tidak tersedia', pesan: `Tool '${name}' tidak dikenal.` };
  };

  const scenarioInfo = getScenarioModifiers(state.config.scenario);
  const systemInstruction = `Anda adalah Agen Persediaan Sore (16.30) untuk UMKM Siomay Wiguna Tasikmalaya.
Tugas Anda adalah menjalankan siklus Amati → Putuskan → Bertindak → Laporkan sebelum waktu belanja bahan segar (17.00–18.00) untuk produksi besok pukul 05.00.

ATURAN WAJIB:
1. DILARANG menghitung angka sendiri. Semua angka permintaan, safety stock, target stok, ROP, EOQ, dan jumlah pesanan HARUS diambil langsung dari output tool server.
2. Bila sebuah tool mengembalikan "data tidak tersedia", jawab persis "data tidak tersedia" untuk bagian tersebut dan jangan mengarang angka.
3. Ikuti urutan loop ini:
   - AMATI: Panggil get_sales_summary(hari=7) dan get_inventory().
   - PUTUSKAN: Panggil calc_policy untuk SELURUH 11 bahan baku (Ikan tenggiri, Daging sapi, Tahu, Kentang, Kol, Pare, Telur, Kulit pangsit, Tepung tapioka, Kacang tanah, Gula), serta forecast_demand untuk item menu utama bila relevan.
   - BERTINDAK: Untuk setiap bahan yang berstatus Kritis atau nearExpiryRisk=true, panggil flag_risk. Untuk setiap bahan dengan recommendedOrderQty > 0, panggil create_purchase_draft menggunakan angka recommendedOrderQty persis dari calc_policy beserta alasan 1–2 kalimat.
   - LAPORKAN: Tulis laporan ringkas akhir (maksimal 2 paragraf + poin ringkas) dalam Bahasa Indonesia tentang status persediaan sore ini, total draf belanja yang menunggu persetujuan akuntan, dan risiko kedaluwarsa/kritis yang perlu diwaspadai.`;

  const userPrompt = `Sekarang pukul 16.30 tanggal simulasi ${state.config.currentDate}.
Skenario aktif: ${scenarioInfo.label}.
Service level z = ${state.config.zScore}.
Silakan jalankan pemeriksaan persediaan sore hari secara lengkap dari langkah Amati, Putuskan, Bertindak, hingga Laporkan.`;

  const contents: Content[] = [{ role: 'user', parts: [{ text: userPrompt }] }];
  let summaryReport = '';
  const maxTurns = 16;

  const generateWithRetry = async (callContents: Content[]) => {
    const delays = [1000, 2500];
    let lastErr: unknown;
    for (let attempt = 0; attempt <= delays.length; attempt++) {
      try {
        return await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: callContents,
          config: {
            systemInstruction,
            tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
          },
        });
      } catch (err) {
        lastErr = err;
        const msg = err instanceof Error ? err.message : String(err);
        const isTransient = msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('ECONNRESET');
        if (!isTransient || attempt === delays.length) {
          throw err;
        }
        await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
      }
    }
    throw lastErr;
  };

  try {
    for (let turn = 0; turn < maxTurns; turn++) {
      const response = await generateWithRetry(contents);

      const candidateContent = response.candidates?.[0]?.content;
      const functionCalls = response.functionCalls;

      if (!functionCalls || functionCalls.length === 0) {
        summaryReport = (response.text || '').trim() || 'Agen selesai menyusun evaluasi persediaan sore.';
        steps.push({
          id: `step-${steps.length + 1}`,
          stepNumber: steps.length + 1,
          phase: 'Laporkan',
          tool: 'final_report',
          input: {},
          output: { summaryLength: summaryReport.length },
          alasan: summaryReport,
          timestamp: new Date().toISOString(),
        });
        break;
      }

      if (candidateContent) {
        contents.push(candidateContent);
      }

      const responseParts = functionCalls.map((call, idx) => {
        const callArgs = (call.args || {}) as Record<string, unknown>;
        const toolResult = executeTool(call.name || '', callArgs);
        const stepReason = summarizeAutoReason(call.name || '', callArgs, toolResult);

        steps.push({
          id: `step-${steps.length + 1}-${idx}`,
          stepNumber: steps.length + 1,
          phase: inferPhase(call.name || ''),
          tool: call.name || 'unknown',
          input: callArgs,
          output: toolResult,
          alasan: stepReason,
          timestamp: new Date().toISOString(),
        });

        return {
          functionResponse: {
            id: call.id,
            name: call.name,
            response: { result: toolResult },
          },
        };
      });

      contents.push({
        role: 'user',
        parts: responseParts,
      });
    }

    if (!summaryReport) {
      summaryReport =
        'Siklus agen mencapai batas langkah maksimum; draf pesanan dan penandaan risiko yang berhasil diproses telah disimpan.';
    }

    const runRecord: AgentRunRecord = {
      id: `RUN-${Date.now()}`,
      runAt: new Date().toISOString(),
      simulationDate: state.config.currentDate,
      scenario: state.config.scenario,
      summaryReport,
      steps,
    };

    return { runRecord, createdDrafts, createdFlags };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    let friendlyError = `Gagal menjalankan Agen Gemini: ${message}`;
    if (message.includes('403') || message.includes('PERMISSION_DENIED') || message.includes('API_KEY_INVALID')) {
      friendlyError =
        'API key Gemini tidak valid atau ditolak (403/400). Periksa pengaturan Secrets untuk GEMINI_API_KEY.';
    } else if (message.includes('429') || message.includes('RESOURCE_EXHAUSTED')) {
      friendlyError =
        'Kuota Gemini API sementara terlampaui (429). Tunggu sejenak lalu coba jalankan agen kembali.';
    } else if (message.includes('404') || message.includes('NOT_FOUND')) {
      friendlyError =
        'Model Gemini yang diminta tidak ditemukan (404). Pastikan model gemini-4-hydrogen tersedia pada environment Anda.';
    }

    steps.push({
      id: `step-err-${Date.now()}`,
      stepNumber: steps.length + 1,
      phase: 'Error',
      tool: 'gemini_api',
      input: { model: 'gemini-4-hydrogen' },
      output: { error: friendlyError },
      alasan: friendlyError,
      timestamp: new Date().toISOString(),
    });

    const runRecord: AgentRunRecord = {
      id: `RUN-${Date.now()}`,
      runAt: new Date().toISOString(),
      simulationDate: state.config.currentDate,
      scenario: state.config.scenario,
      summaryReport: friendlyError,
      steps,
      error: friendlyError,
    };

    return { runRecord, createdDrafts, createdFlags };
  }
}
