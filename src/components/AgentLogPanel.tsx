import { useState } from 'react';
import { ChevronDown, ChevronRight, Download, FileDown, Play } from 'lucide-react';
import type { AgentRunRecord } from '../types/inventory';
import { buildAgentRunMarkdown, formatTanggalId } from '../utils/format';

interface AgentLogPanelProps {
  runs: AgentRunRecord[];
  isRunning: boolean;
  onRunAgent: () => void;
  onExportPdf?: (run: AgentRunRecord) => void;
}

export function AgentLogPanel({
  runs,
  isRunning,
  onRunAgent,
  onExportPdf,
}: AgentLogPanelProps) {
  const [selectedRunId, setSelectedRunId] = useState<string>(runs[0]?.id || '');
  const [expandedSteps, setExpandedSteps] = useState<Record<string, boolean>>({});

  const activeRun = runs.find((r) => r.id === selectedRunId) || runs[0];

  const handleExportMd = () => {
    if (!activeRun) return;
    const md = buildAgentRunMarkdown(activeRun);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `log-agen-siomay-wiguna-${activeRun.simulationDate}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const toggleStep = (stepId: string) => {
    setExpandedSteps((prev) => ({ ...prev, [stepId]: !prev[stepId] }));
  };

  if (!activeRun) {
    return (
      <div className="rounded-xl border border-[#E6DDD2] bg-white p-8 text-center">
        <h2 className="text-lg font-semibold text-[#1F1A17]">
          Belum Ada Riwayat Eksekusi Agen
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-[#6B5E55]">
          Tekan tombol di bawah untuk memicu loop agen Amati → Putuskan → Bertindak → Laporkan dengan Gemini Function Calling.
        </p>
        <button
          type="button"
          onClick={onRunAgent}
          disabled={isRunning}
          className="mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[#C24E2B] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#A63E1F] disabled:opacity-60 whitespace-nowrap"
        >
          <Play className="h-4 w-4" />
          {isRunning ? 'Agen Sedang Berjalan...' : 'Jalankan Agen Sore (16.30)'}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[#E6DDD2] bg-white p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#1F1A17]">
              Log Agen Persediaan (Amati → Putuskan → Bertindak → Laporkan)
            </h2>
            <p className="mt-1 text-xs text-[#6B5E55]">
              Tanggal operasional {formatTanggalId(activeRun.simulationDate)} · Kondisi {activeRun.scenario} ·{' '}
              <span className="font-mono tabular-nums">{activeRun.steps.length}</span> langkah tercatat
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {runs.length > 1 && (
              <select
                value={activeRun.id}
                onChange={(e) => setSelectedRunId(e.target.value)}
                aria-label="Pilih sesi eksekusi agen"
                className="min-h-[42px] rounded-lg border border-[#E6DDD2] bg-white px-3 py-2 text-xs text-[#1F1A17] focus:border-[#C24E2B] focus:outline-none"
              >
                {runs.map((r, idx) => (
                  <option key={r.id} value={r.id}>
                    Sesi #{runs.length - idx} · {r.simulationDate} ({r.scenario})
                  </option>
                ))}
              </select>
            )}

            <button
              type="button"
              onClick={handleExportMd}
              className="inline-flex min-h-[42px] items-center gap-2 rounded-lg border border-[#E6DDD2] bg-[#FAF7F2] px-4 py-2 text-xs font-medium text-[#1F1A17] transition-colors hover:bg-[#F1EAE0] whitespace-nowrap"
            >
              <Download className="h-4 w-4 text-[#C24E2B]" />
              Ekspor .md
            </button>

            {onExportPdf && (
              <button
                type="button"
                onClick={() => onExportPdf(activeRun)}
                className="inline-flex min-h-[42px] items-center gap-2 rounded-lg border border-[#E6DDD2] bg-white px-4 py-2 text-xs font-medium text-[#1F1A17] transition-colors hover:bg-[#FAF7F2] whitespace-nowrap"
              >
                <FileDown className="h-4 w-4 text-[#2D6A4F]" />
                Unduh Laporan PDF
              </button>
            )}
          </div>
        </div>

        {/* Laporan ringkas */}
        <div className="mt-5 rounded-lg border border-[#E6DDD2] bg-[#FAF7F2] p-4">
          <div className="text-xs font-semibold text-[#6B5E55]">
            Ringkasan Laporan Agen
          </div>
          <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-[#1F1A17]">
            {activeRun.summaryReport}
          </p>
        </div>
      </div>

      {/* Daftar langkah berurutan */}
      <div className="rounded-xl border border-[#E6DDD2] bg-white">
        <div className="border-b border-[#E6DDD2] px-6 py-4">
          <h3 className="text-base font-semibold text-[#1F1A17]">
            Jejak Pemanggilan Tool Berurutan
          </h3>
        </div>

        <div className="divide-y divide-[#EFE8DE]">
          {activeRun.steps.map((step) => {
            const isOpen = !!expandedSteps[step.id];
            const phaseColor =
              step.phase === 'Error'
                ? 'text-[#B91C1C]'
                : step.phase === 'Bertindak'
                  ? 'text-[#C24E2B]'
                  : step.phase === 'Laporkan'
                    ? 'text-[#2D6A4F]'
                    : 'text-[#6B5E55]';

            return (
              <div key={step.id} className="px-6 py-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-mono font-semibold tabular-nums text-[#1F1A17]">
                        #{step.stepNumber}
                      </span>
                      <span aria-hidden="true" className="text-[#6B5E55]">
                        ·
                      </span>
                      <span className={`font-semibold ${phaseColor}`}>{step.phase}</span>
                      <span aria-hidden="true" className="text-[#6B5E55]">
                        ·
                      </span>
                      <code className="font-mono text-[#1F1A17]">{step.tool}</code>
                    </div>
                    <p className="text-sm text-[#1F1A17]">{step.alasan}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleStep(step.id)}
                    className="inline-flex min-h-[36px] shrink-0 items-center gap-1 self-start rounded-md border border-[#E6DDD2] px-3 py-1.5 text-xs font-medium text-[#6B5E55] hover:bg-[#FAF7F2] hover:text-[#1F1A17] whitespace-nowrap"
                  >
                    {isOpen ? (
                      <>
                        <ChevronDown className="h-3.5 w-3.5" />
                        Tutup JSON
                      </>
                    ) : (
                      <>
                        <ChevronRight className="h-3.5 w-3.5" />
                        Lihat Input / Output
                      </>
                    )}
                  </button>
                </div>

                {isOpen && (
                  <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
                    <div className="rounded-lg bg-[#FAF7F2] p-3">
                      <div className="mb-1 text-[11px] font-semibold text-[#6B5E55]">Input</div>
                      <pre className="max-h-56 overflow-auto font-mono text-[11px] leading-relaxed text-[#1F1A17]">
                        {JSON.stringify(step.input, null, 2)}
                      </pre>
                    </div>
                    <div className="rounded-lg bg-[#FAF7F2] p-3">
                      <div className="mb-1 text-[11px] font-semibold text-[#6B5E55]">Output</div>
                      <pre className="max-h-56 overflow-auto font-mono text-[11px] leading-relaxed text-[#1F1A17]">
                        {JSON.stringify(step.output, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
