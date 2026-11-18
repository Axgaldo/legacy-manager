import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

export type ToastKind = 'success' | 'error' | 'info'

export interface ToastOptions {
  kind?: ToastKind
  /** Milisgundos antes de que desaparezca solo. */
  duration?: number
}

interface ToastItem {
  id: number
  message: string
  kind: ToastKind
}

interface ToastContextValue {
  showToast: (message: string, options?: ToastOptions) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

let toastCounter = 0

const TONE: Record<ToastKind, string> = {
  success: 'border-emerald-800 bg-emerald-950/90 text-emerald-200',
  error: 'border-red-900 bg-red-950/90 text-red-200',
  info: 'border-slate-700 bg-slate-900/95 text-slate-200',
}

const ICON: Record<ToastKind, string> = {
  success: '✓',
  error: '⚠',
  info: 'ℹ',
}

/**
 * Avisos no bloqueantes (esquina inferior derecha) que sustituyen a los
 * `alert()`. Se cierran solos o al pulsarlos.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const showToast = useCallback((message: string, options: ToastOptions = {}) => {
    const id = ++toastCounter
    const kind = options.kind ?? 'info'
    setToasts((current) => [...current.slice(-3), { id, message, kind }])
    window.setTimeout(() => dismiss(id), options.duration ?? (kind === 'error' ? 7000 : 4000))
  }, [dismiss])

  const value = useMemo(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" className="fixed bottom-4 right-4 z-[70] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2 print:hidden">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            onClick={() => dismiss(toast.id)}
            className={`flex cursor-pointer items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm shadow-lg backdrop-blur transition hover:opacity-90 ${TONE[toast.kind]}`}
          >
            <span className="shrink-0 font-bold" aria-hidden="true">{ICON[toast.kind]}</span>
            <p className="min-w-0 break-words leading-snug">{toast.message}</p>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast debe usarse dentro de <ToastProvider>')
  return context
}
