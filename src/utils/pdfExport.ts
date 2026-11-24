import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { AgentRunRecord, DashboardResponse } from '../types/inventory';
import { formatNumber, formatRupiah, formatTanggalId } from './format';

interface JsPdfWithAutoTable extends jsPDF {
  lastAutoTable?: { finalY: number };
}

function getScenarioText(scenario: string): string {
  if (scenario === 'lonjakan') return 'Lonjakan Acara (+50% permintaan)';
  if (scenario === 'terlambat') return 'Pemasok Terlambat (+2 hari lead time)';
  return 'Normal';
}

export function exportOperationalReportPdf(
  data: DashboardResponse,
  explicitRun?: AgentRunRecord
): string {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as JsPdfWithAutoTable;
  const pageW = doc.internal.pageSize.getWidth();
  const marginX = 14;
  const currentDate = data.state.config.currentDate;

  // Header Dokumen
  doc.setFillColor(250, 247, 242);
  doc.rect(0, 0, pageW, 34, 'F');
  doc.setDrawColor(230, 221, 210);
  doc.line(0, 34, pageW, 34);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(31, 26, 23);
  doc.text('Siomay Wiguna – Laporan Operasional Persediaan', marginX, 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(107, 94, 85);
  doc.text('Dapur Produksi & Gudang PH Tasikmalaya · Arsip Manajemen Harian', marginX, 20.5);

  const cetakPada = new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date());

  doc.setFontSize(8.5);
  doc.text(
    `Tanggal Operasional: ${formatTanggalId(currentDate)}  |  Kondisi: ${getScenarioText(data.state.config.scenario)}  |  Service Level z = ${formatNumber(data.state.config.zScore, 2)}  |  Dicetak: ${cetakPada}`,
    marginX,
    28
  );

  // Bagian 1: Ringkasan Eksekutif Dasbor
  let y = 42;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(194, 78, 43);
  doc.text('1. Ringkasan Eksekutif Dasbor', marginX, y);

  autoTable(doc, {
    startY: y + 3,
    margin: { left: marginX, right: marginX },
    theme: 'grid',
    styles: {
      fontSize: 8.5,
      cellPadding: 2.5,
      textColor: [31, 26, 23],
      lineColor: [230, 221, 210],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [244, 239, 230],
      textColor: [31, 26, 23],
      fontStyle: 'bold',
    },
    head: [['Indikator Operasional', 'Nilai', 'Keterangan']],
    body: [
      [
        'Kesehatan Stok (11 Bahan)',
        `${data.summary.amanCount} Aman / ${data.summary.waspadaCount} Waspada / ${data.summary.kritisCount} Kritis`,
        'Evaluasi stok dapur segar & gudang PH',
      ],
      [
        'Anggaran Belanja Pasar Sore (17.00)',
        formatRupiah(data.summary.estimasiBelanjaSore),
        'Estimasi kebutuhan bahan segar produksi 05.00 besok',
      ],
      [
        'Kontrol Mutu & Waste FIFO',
        `${data.summary.kedaluwarsaRiskCount} bahan <= 1 hari · Waste ${formatRupiah(data.summary.totalWasteRp)}`,
        'Bahan mendekati umur simpan dan akumulasi susut',
      ],
      [
        'Antrean Persetujuan Akuntan',
        `${data.summary.pendingDraftsCount} draf menunggu`,
        `Total ${data.summary.totalSalesRows} transaksi kasir tercatat`,
      ],
    ],
  });

  // Bagian 2: Tabel Kartu Stok vs Target / ROP
  y = (doc.lastAutoTable?.finalY ?? y + 35) + 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(194, 78, 43);
  doc.text('2. Status Stok Bahan Baku vs Target / ROP', marginX, y);

  autoTable(doc, {
    startY: y + 3,
    margin: { left: marginX, right: marginX },
    theme: 'grid',
    styles: {
      fontSize: 7.8,
      cellPadding: 2,
      textColor: [31, 26, 23],
      lineColor: [230, 221, 210],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [194, 78, 43],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    columnStyles: {
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'right' },
      8: { halign: 'right' },
    },
    head: [
      [
        'Bahan',
        'Lokasi',
        'Stok',
        'Umur',
        'Pakai/Hr',
        'SS',
        'Target/ROP',
        'EOQ',
        'Pesan',
        'Status',
      ],
    ],
    body: data.policies.map((p) => {
      const targetOrRop = p.jenis === 'segar' ? p.targetStok : p.rop;
      return [
        p.nama,
        p.jenis === 'segar' ? 'Dapur Segar' : 'Gudang PH',
        `${formatNumber(p.stokSaatIni, 2)} ${p.satuan}`,
        p.minSisaUmurHari !== null ? `${p.minSisaUmurHari} hr` : 'Habis',
        formatNumber(p.dBar, 2),
        formatNumber(p.safetyStock, 2),
        targetOrRop !== null ? formatNumber(targetOrRop, 2) : '-',
        p.eoq !== null ? formatNumber(p.eoq, 1) : '-',
        p.recommendedOrderQty > 0 ? `${formatNumber(p.recommendedOrderQty, 2)} ${p.satuan}` : '0',
        p.nearExpiryRisk ? `${p.status} (Exp)` : p.status,
      ];
    }),
  });

  // Bagian 3: Draf Pengadaan & Risiko Hari Ini
  y = (doc.lastAutoTable?.finalY ?? y + 60) + 8;
  if (y > 245) {
    doc.addPage();
    y = 18;
  }

  const todayDrafts = data.state.drafts.filter((d) => d.tanggalBuat === currentDate);
  const draftsToPrint = todayDrafts.length > 0 ? todayDrafts : data.state.drafts.slice(0, 10);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(194, 78, 43);
  doc.text(
    todayDrafts.length > 0
      ? '3. Draf Pengadaan Hari Ini (Persetujuan Akuntan)'
      : '3. Draf Pengadaan Terbaru',
    marginX,
    y
  );

  if (draftsToPrint.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(107, 94, 85);
    doc.text('Belum ada draf pengadaan yang dibuat oleh Agen Persediaan.', marginX, y + 6);
    y += 12;
  } else {
    autoTable(doc, {
      startY: y + 3,
      margin: { left: marginX, right: marginX },
      theme: 'grid',
      styles: {
        fontSize: 7.8,
        cellPadding: 2,
        textColor: [31, 26, 23],
        lineColor: [230, 221, 210],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [45, 106, 79],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      head: [['Tanggal', 'Bahan', 'Qty', 'Estimasi Biaya', 'Status', 'Alasan Agen']],
      body: draftsToPrint.map((d) => [
        d.tanggalBuat,
        d.bahan,
        `${formatNumber(d.qty, 2)} ${d.satuan}`,
        formatRupiah(d.estimasiBiaya),
        d.status,
        d.alasan,
      ]),
    });
    y = (doc.lastAutoTable?.finalY ?? y + 25) + 8;
  }

  // Bagian 4: Log Keputusan Agen Hari Ini
  if (y > 235) {
    doc.addPage();
    y = 18;
  }

  const todayRun =
    explicitRun ||
    data.state.agentRuns.find((r) => r.simulationDate === currentDate) ||
    data.state.agentRuns[0];

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(194, 78, 43);
  doc.text('4. Log Keputusan Agen Sore (Amati -> Putuskan -> Bertindak -> Laporkan)', marginX, y);

  if (!todayRun) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(107, 94, 85);
    doc.text(
      'Agen Sore (16.30) belum dijalankan. Tekan "Jalankan Agen Sore (16.30)" sebelum mengarsipkan log keputusan.',
      marginX,
      y + 6
    );
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(107, 94, 85);
    doc.text(
      `Sesi Agen: ${formatTanggalId(todayRun.simulationDate)} · Kondisi: ${getScenarioText(todayRun.scenario)} · Total ${todayRun.steps.length} langkah`,
      marginX,
      y + 5.5
    );

    const summaryLines = doc.splitTextToSize(
      `Ringkasan Laporan: ${todayRun.summaryReport}`,
      pageW - marginX * 2
    );
    doc.setTextColor(31, 26, 23);
    doc.text(summaryLines, marginX, y + 11);

    const tableStartY = y + 12 + summaryLines.length * 4;
    autoTable(doc, {
      startY: tableStartY,
      margin: { left: marginX, right: marginX },
      theme: 'grid',
      styles: {
        fontSize: 7.6,
        cellPadding: 2,
        textColor: [31, 26, 23],
        lineColor: [230, 221, 210],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [31, 26, 23],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 22 },
        2: { cellWidth: 36 },
      },
      head: [['No', 'Fase', 'Tool', 'Alasan Keputusan']],
      body: todayRun.steps.map((s) => [
        String(s.stepNumber),
        s.phase,
        s.tool,
        s.alasan,
      ]),
    });
  }

  // Footer Nomor Halaman di setiap halaman
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageH = doc.internal.pageSize.getHeight();
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(107, 94, 85);
    doc.text(
      `Arsip Operasional Siomay Wiguna Tasikmalaya · Halaman ${i} dari ${pageCount}`,
      marginX,
      pageH - 8
    );
  }

  const filename = `laporan-operasional-siomay-wiguna-${currentDate}.pdf`;
  doc.save(filename);
  return filename;
}
