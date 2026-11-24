import { AnimatePresence, motion } from 'motion/react';
import { AlertOctagon, BellRing, CheckCircle2, Info, X } from 'lucide-react';

export interface ToastItem {
  id: string;
  variant: 'draft_created' | 'success' | 'info' | 'error';
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  return (
    <div
      aria-live="polite"
      aria-label="Notifikasi sistem persediaan"
      className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-2.5 sm:left-auto sm:right-5 sm:bottom-5 sm:w-full sm:max-w-sm"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const isDraft = t.variant === 'draft_created';
          const isError = t.variant === 'error';
          const isSuccess = t.variant === 'success';

          const borderClass = isError
            ? 'border-[#B91C1C]/40'
            : isDraft
              ? 'border-[#C24E2B]/50'
              : isSuccess
                ? 'border-[#2D6A4F]/40'
                : 'border-[#E6DDD2]';

          return (
            <motion.div
              key={t.id}
              role="status"
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className={`pointer-events-auto w-full rounded-xl border ${borderClass} bg-white p-4 shadow-lg`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">
                  {isDraft && <BellRing className="h-5 w-5 text-[#C24E2B]" />}
                  {isError && <AlertOctagon className="h-5 w-5 text-[#B91C1C]" />}
                  {isSuccess && <CheckCircle2 className="h-5 w-5 text-[#2D6A4F]" />}
                  {t.variant === 'info' && <Info className="h-5 w-5 text-[#C24E2B]" />}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-[#1F1A17]">{t.title}</div>
                  <p className="mt-0.5 text-xs leading-relaxed text-[#6B5E55]">{t.message}</p>

                  {t.actionLabel && t.onAction && (
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          t.onAction?.();
                          onDismiss(t.id);
                        }}
                        className="inline-flex min-h-[36px] items-center rounded-lg bg-[#C24E2B] px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#A63E1F] whitespace-nowrap"
                      >
                        {t.actionLabel}
                      </button>
                      <button
                        type="button"
                        onClick={() => onDismiss(t.id)}
                        className="inline-flex min-h-[36px] items-center rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#6B5E55] hover:text-[#1F1A17] whitespace-nowrap"
                      >
                        Nanti
                      </button>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => onDismiss(t.id)}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[#6B5E55] hover:bg-[#FAF7F2] hover:text-[#1F1A17]"
                  aria-label="Tutup notifikasi"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
