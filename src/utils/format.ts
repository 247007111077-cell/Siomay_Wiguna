import type { AgentRunRecord } from '../types/inventory';

export function formatRupiah(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Math.round(value));
}

export function formatNumber(value: number, maxDecimals = 2): string {
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  }).format(value);
}

export function formatTanggalId(dateStr: string): string {
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return dateStr;
  const dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(dt);
}

export function formatShortDateId(dateStr: string): string {
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return dateStr;
  const dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(dt);
}

export function buildAgentRunMarkdown(run: AgentRunRecord): string {
  const lines: string[] = [
    `# Log Agen Persediaan – Siomay Wiguna`,
    ``,
    `- **ID Sesi**: \`${run.id}\``,
    `- **Tanggal Simulasi**: ${run.simulationDate}`,
    `- **Waktu Eksekusi**: ${run.runAt}`,
    `- **Skenario Aktif**: ${run.scenario}`,
    ``,
    `## Laporan Ringkas Agen`,
    ``,
    run.summaryReport,
    ``,
    `## Jejak Langkah Berurutan (Amati → Putuskan → Bertindak → Laporkan)`,
    ``,
  ];

  for (const step of run.steps) {
    lines.push(`### Langkah ${step.stepNumber} · ${step.phase} · \`${step.tool}\``);
    lines.push(`- **Alasan**: ${step.alasan}`);
    lines.push(`- **Input**:`);
    lines.push('```json');
    lines.push(JSON.stringify(step.input, null, 2));
    lines.push('```');
    lines.push(`- **Output**:`);
    lines.push('```json');
    lines.push(JSON.stringify(step.output, null, 2));
    lines.push('```');
    lines.push('');
  }

  return lines.join('\n');
}
