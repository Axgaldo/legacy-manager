import { useEffect } from 'react'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import PrivateStorageImage from './PrivateStorageImage'

/**
 * Fotos a pantalla completa con flechas y teclado (← → y Esc), igual que la
 * navegación de las fichas.
 */
export default function PhotoLightbox({
  photos,
  index,
  title,
  onClose,
  onNavigate,
}: {
  photos: string[]
  index: number
  title?: string
  onClose: () => void
  onNavigate: (index: number) => void
}) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowLeft' && index > 0) onNavigate(index - 1)
      if (event.key === 'ArrowRight' && index < photos.length - 1) onNavigate(index + 1)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [index, photos.length, onClose, onNavigate])

  const goPrev = index > 0 ? () => onNavigate(index - 1) : undefined
  const goNext = index < photos.length - 1 ? () => onNavigate(index + 1) : undefined
  // Escape y flechas ya se gestionan arriba; aquí solo se atrapa el tabulador.
  const trapRef = useFocusTrap<HTMLDivElement>(true)

  return (
    <div
      ref={trapRef}
      tabIndex={-1}
      className="fixed inset-0 z-[60] flex flex-col bg-black/90 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title ? `Foto de ${title}` : 'Foto ampliada'}
      onClick={onClose}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm text-slate-200">
        <p className="min-w-0 truncate font-semibold" title={title}>{title ?? 'Foto'}</p>
        <span className="shrink-0 text-xs text-slate-400">{index + 1} / {photos.length}</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-slate-100"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-4">
        {goPrev && (
          <button
            type="button"
            onClick={(event) => { event.stopPropagation(); goPrev() }}
            aria-label="Foto anterior"
            className="absolute left-4 z-10 rounded-full border border-slate-700 bg-slate-950/80 p-2.5 text-slate-200 transition hover:border-teal-600"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        <PrivateStorageImage
          source={photos[index]}
          alt={`${title ?? 'Foto'} ${index + 1}`}
          className="max-h-full max-w-full object-contain"
          onClick={(event) => event.stopPropagation()}
        />
        {goNext && (
          <button
            type="button"
            onClick={(event) => { event.stopPropagation(); goNext() }}
            aria-label="Foto siguiente"
            className="absolute right-4 z-10 rounded-full border border-slate-700 bg-slate-950/80 p-2.5 text-slate-200 transition hover:border-teal-600"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
