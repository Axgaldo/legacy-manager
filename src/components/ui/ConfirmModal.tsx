import { useState } from 'react'
import { useFocusTrap } from '@/hooks/useFocusTrap'

interface ConfirmModalProps {
  isOpen: boolean
  title: string
  message: string
  confirmWord?: string // If provided, user must type this word to enable the button
  confirmButtonText?: string
  isDestructive?: boolean
  isLoading?: boolean
  onConfirm: () => void
  onClose: () => void
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmWord,
  confirmButtonText = 'Confirmar',
  isDestructive = true,
  isLoading = false,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  const [typedWord, setTypedWord] = useState('')
  const trapRef = useFocusTrap<HTMLDivElement>(isOpen, onClose)

  if (!isOpen) return null

  const isRequirementMet = !confirmWord || typedWord.trim().toUpperCase() === confirmWord.toUpperCase()

  const handleClose = () => {
    setTypedWord('')
    onClose()
  }

  const handleConfirm = () => {
    if (isRequirementMet && !isLoading) {
      onConfirm()
      setTypedWord('')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div ref={trapRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title" className="bg-slate-900 rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-700">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-950/60 text-red-400 flex items-center justify-center shrink-0">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h3 id="confirm-modal-title" className="text-lg font-bold text-slate-100">{title}</h3>
            <p className="text-sm text-slate-400 mt-1">{message}</p>
          </div>
        </div>

        {confirmWord && (
          <div className="pt-2">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Para confirmar, escribe <span className="text-red-400 font-bold font-mono">"{confirmWord}"</span>:
            </label>
            <input
              type="text"
              value={typedWord}
              onChange={(e) => setTypedWord(e.target.value)}
              placeholder={confirmWord}
              className="w-full px-3 py-2 border border-slate-700 rounded-lg text-sm bg-slate-950 text-slate-100 placeholder:text-slate-600 focus:ring-2 focus:ring-red-500 focus:outline-hidden"
              autoFocus
            />
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={handleClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 rounded-xl transition disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!isRequirementMet || isLoading}
            className={`px-4 py-2 text-sm font-semibold rounded-xl text-white shadow-xs transition ${
              !isRequirementMet || isLoading
                ? 'bg-slate-700 cursor-not-allowed'
                : isDestructive
                ? 'bg-red-600 hover:bg-red-700 active:scale-98'
                : 'bg-teal-700 hover:bg-teal-600 active:scale-98'
            }`}
          >
            {isLoading ? 'Procesando…' : confirmButtonText}
          </button>
        </div>
      </div>
    </div>
  )
}
