import { ReactNode, useEffect, useState } from 'react'
import { AssetItem } from '@/types'
import PrivateStorageImage from '@/components/ui/PrivateStorageImage'
import PhotoLightbox from '@/components/ui/PhotoLightbox'
import { useMoney } from '@/features/privacy/money'
import { useToast } from '@/components/ui/ToastProvider'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { downloadAssetPhotos } from '@/features/backup/documentsExport'
import { getCategoryInfo } from './assetCategories'
import {
  coinValue,
  conservationTone,
  hasValue,
  isMedal,
  locationLabel,
  normalizeUiText,
  sizeLabel,
  yearLabel,
} from './numismaticaUi'

function formatText(value?: string | number): string {
  if (value === undefined || value === null) return ''
  return String(value).trim()
}

function Field({ label, value }: { label: string; value?: string | number }) {
  const text = formatText(value)
  if (!text) return null
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-slate-200">{text}</dd>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
      <h4 className="mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">{title}</h4>
      {children}
    </section>
  )
}

export default function AssetDetailModal({
  asset,
  onClose,
  onEdit,
  onDelete,
  onDuplicate,
  suspended = false,
  index,
  total,
  onPrevious,
  onNext,
}: {
  asset: AssetItem | null
  onClose: () => void
  onEdit: (asset: AssetItem) => void
  onDelete: (asset: AssetItem) => void
  onDuplicate?: (asset: AssetItem) => void
  suspended?: boolean
  index?: number
  total?: number
  onPrevious?: () => void
  onNext?: () => void
}) {
  const [copied, setCopied] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [exportingPhotos, setExportingPhotos] = useState(false)
  const [exportProgress, setExportProgress] = useState('')
  const money = useMoney()
  const toast = useToast()
  // Los diálogos que se abren encima (lightbox, confirmación) entran en la pila
  // del hook y toman el control del tabulador.
  const trapRef = useFocusTrap<HTMLDivElement>(Boolean(asset))

  useEffect(() => {
    if (!asset || suspended || lightboxIndex !== null) return
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowLeft' && onPrevious) onPrevious()
      if (event.key === 'ArrowRight' && onNext) onNext()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [asset, onClose, suspended, lightboxIndex, onPrevious, onNext])

  useEffect(() => {
    setCopied(false)
  }, [asset?.id])

  if (!asset) return null

  const category = getCategoryInfo(asset.category)
  const medal = isMedal(asset)
  const tone = conservationTone(asset.conservationState)
  const photos = asset.photos ?? []
  const tags = (asset.tags ?? []).filter((tag) => tag.trim())
  const value = coinValue(asset)
  const isNumismatica = normalizeUiText(asset.category) === 'numismatica'

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Copia el enlace de esta ficha:', window.location.href)
    }
  }

  const exportPhotos = async () => {
    setExportingPhotos(true)
    setExportProgress('')
    try {
      const result = await downloadAssetPhotos(asset, (progress) => setExportProgress(`${progress.done}/${progress.total}`))
      toast.showToast(
        `ZIP listo: ${result.files} foto${result.files === 1 ? '' : 's'}${result.skipped ? ` · ${result.skipped} omitida${result.skipped === 1 ? '' : 's'}` : ''}.`,
        { kind: 'success' },
      )
    } catch (error: any) {
      toast.showToast(error?.message || 'No se pudieron descargar las fotografías.', { kind: 'error' })
    } finally {
      setExportingPhotos(false)
      setExportProgress('')
    }
  }

  return (
    <div
      ref={trapRef}
      tabIndex={-1}
      className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/75 p-3 backdrop-blur-sm sm:items-center sm:p-6"
      id="asset-detail-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`Ficha de ${asset.name}`}
      onClick={onClose}
    >
      <div
        className="my-auto w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
        id="asset-detail-sheet"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="sticky top-0 z-10 flex flex-wrap items-start justify-between gap-3 border-b border-slate-700 bg-slate-900/95 px-5 py-4 backdrop-blur">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <span>{category.icon} {category.label}</span>
              <span className="text-slate-700">·</span>
              <span>{medal ? 'Medalla' : isNumismatica ? 'Moneda' : 'Bien'}</span>
              {asset.owner && <><span className="text-slate-700">·</span><span>👤 {asset.owner}</span></>}
            </p>
            <h3 className="mt-1 text-xl font-bold tracking-tight text-slate-100">{asset.name}</h3>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {asset.catalog_reference && (
                <span className="rounded border border-slate-700 bg-slate-950 px-2 py-0.5 font-mono text-[10px] text-slate-300">
                  {asset.catalog_reference}
                </span>
              )}
              {asset.conservationState && (
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium ${tone.chip}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                  {asset.conservationState}
                </span>
              )}
              {tags.slice(0, 6).map((tag) => (
                <span
                  key={tag}
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                    normalizeUiText(tag) === 'revisar'
                      ? 'border-amber-800 bg-amber-950/60 text-amber-300'
                      : 'border-slate-700 bg-slate-950 text-slate-400'
                  }`}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div className="print-hidden flex w-full flex-wrap items-center gap-2 [&>*]:shrink-0 sm:w-auto sm:justify-end">
            {(onPrevious || onNext) && (
              <div className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-950/60 px-1 py-0.5">
                <button
                  type="button"
                  onClick={onPrevious}
                  disabled={!onPrevious}
                  aria-label="Pieza anterior"
                  title="Anterior (←)"
                  className="rounded-md p-1 text-slate-300 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="min-w-12 text-center text-[10px] font-semibold text-slate-400">
                  {index && total ? `${index} / ${total}` : ''}
                </span>
                <button
                  type="button"
                  onClick={onNext}
                  disabled={!onNext}
                  aria-label="Pieza siguiente"
                  title="Siguiente (→)"
                  className="rounded-md p-1 text-slate-300 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-800"
              title="Imprimir esta ficha"
            >
              🖨 Imprimir
            </button>
            <button
              type="button"
              onClick={copyLink}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-800"
              title="Copiar enlace de esta ficha"
            >
              {copied ? '✓ Copiado' : '🔗 Copiar enlace'}
            </button>
            <button
              type="button"
              onClick={() => void exportPhotos()}
              disabled={exportingPhotos || photos.length === 0}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-800 disabled:opacity-50"
              title={photos.length === 0 ? 'Este bien no tiene fotografías' : 'Descargar todas las fotografías en un ZIP'}
            >
              {exportingPhotos ? `Preparando… ${exportProgress}` : '⬇ Fotos (ZIP)'}
            </button>
            {onDuplicate && (
              <button
                type="button"
                onClick={() => onDuplicate(asset)}
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-800"
                title="Crear una copia editable de esta ficha"
              >
                ⧉ Duplicar
              </button>
            )}
            <button
              type="button"
              onClick={() => onEdit(asset)}
              className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-teal-600"
            >
              Editar
            </button>
            <button
              type="button"
              onClick={() => onDelete(asset)}
              className="rounded-lg border border-red-900 bg-red-950/40 px-3 py-1.5 text-xs font-semibold text-red-300 transition hover:bg-red-950/70"
            >
              Borrar
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar ficha"
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-slate-100"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </header>

        <div className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <SummaryTile label="Año" value={yearLabel(asset)} />
              <SummaryTile label="Material" value={asset.material || '—'} />
              {medal ? (
                <SummaryTile label="Tamaño" value={sizeLabel(asset.medal_size_mm) || '—'} />
              ) : isNumismatica ? (
                <SummaryTile label="Ceca" value={asset.mint || '—'} />
              ) : (
                <SummaryTile label="Marca / autor" value={asset.brandOrAuthor || '—'} />
              )}
              <SummaryTile
                label="Valor"
                value={hasValue(asset) ? money.formatEuro(value) : '—'}
                valueClass={hasValue(asset) ? 'text-emerald-400' : 'text-slate-500'}
              />
            </div>

            {(asset.obverse_info || asset.reverse_info) && (
              <div className="grid gap-3 sm:grid-cols-2">
                {asset.obverse_info && (
                  <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Anverso</p>
                    <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-200">{asset.obverse_info}</p>
                  </div>
                )}
                {asset.reverse_info && (
                  <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Reverso</p>
                    <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-200">{asset.reverse_info}</p>
                  </div>
                )}
              </div>
            )}

            {asset.description && (
              <Section title="Descripción">
                <p className="whitespace-pre-line text-sm leading-relaxed text-slate-300">{asset.description}</p>
              </Section>
            )}

            <Section title="Datos">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
                <Field label="Denominación" value={asset.denomination} />
                <Field label="Gobernante" value={asset.ruler} />
                <Field label="Período" value={asset.empire_reign} />
                <Field label="País" value={asset.country} />
                <Field label="Ceca" value={asset.mint} />
                <Field label="Marca de ceca" value={asset.mint_mark} />
                <Field label="Época" value={asset.era || asset.historicalEra} />
                <Field label="Peso" value={asset.weight_grams ? `${asset.weight_grams} g` : ''} />
                <Field label="Diámetro" value={asset.diameter_mm ? `${asset.diameter_mm} mm` : ''} />
                <Field label="Catálogo" value={asset.catalog_reference} />
                <Field label="Nº inventario" value={asset.inventory_number} />
                <Field label="Ubicación" value={locationLabel(asset)} />
                <Field label="Motivo" value={asset.medal_motive} />
                <Field label="Autor / marca" value={asset.brandOrAuthor} />
                <Field label="Origen" value={asset.placeOfOrigin} />
                <Field label="Año de adquisición" value={asset.acquisitionYear} />
              </dl>
            </Section>

            <div className="grid gap-4 sm:grid-cols-2">
              <Section title="Valoración">
                <dl className="grid grid-cols-1 gap-3">
                  <Field label="Valor de mercado" value={asset.market_value !== undefined ? money.formatEuro(asset.market_value) : ''} />
                  <Field label="Valor de referencia" value={asset.reference_book_value !== undefined ? money.formatEuro(asset.reference_book_value) : ''} />
                  <Field
                    label="Importe original de referencia"
                    value={money.formatOriginal(asset.reference_book_value_original, asset.reference_book_currency)}
                  />
                  <Field label="Libro de referencia" value={asset.reference_book} />
                  <Field label="Valor declarado" value={asset.value !== undefined ? money.formatEuro(asset.value) : ''} />
                  <Field label="Fuente del valor" value={asset.value_source} />
                  <Field label="Precio de compra" value={asset.purchase_price !== undefined ? money.formatEuro(asset.purchase_price) : ''} />
                  <Field
                    label="Importe original de compra"
                    value={money.formatOriginal(asset.purchase_price_original, asset.purchase_currency)}
                  />
                  <Field label="Año de compra" value={asset.purchase_year} />
                  <Field label="Operación" value={asset.acquisition_operation} />
                  <Field label="Procedencia" value={asset.acquisition_source} />
                </dl>
              </Section>

              <Section title="Notas">
                {asset.notes ? (
                  <p className="whitespace-pre-line text-sm leading-relaxed text-slate-300">{asset.notes}</p>
                ) : (
                  <p className="text-xs text-slate-500">Sin notas.</p>
                )}
                <div className="mt-3 border-t border-slate-800 pt-3 text-[11px] text-slate-500">
                  <p>Alta: {asset.added_date || '—'}</p>
                  <p className="mt-0.5">ID: {asset.id}</p>
                </div>
              </Section>
            </div>
          </div>

          <aside className="space-y-3">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Imágenes ({photos.length})</h4>
            {photos.length === 0 ? (
              <div className="flex aspect-square w-full items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-950/60 text-4xl text-slate-700">
                {category.icon}
              </div>
            ) : (
              <div className={`grid gap-3 ${photos.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {photos.map((photo, index) => (
                  <div
                    key={`${photo}-${index}`}
                    className="group relative flex aspect-square cursor-zoom-in items-center justify-center overflow-hidden rounded-xl border border-slate-800 bg-slate-950 transition hover:border-teal-700"
                    title="Ampliar foto"
                    onClick={() => setLightboxIndex(index)}
                  >
                    <PrivateStorageImage
                      source={photo}
                      alt={`${asset.name} ${index + 1}`}
                      className="h-full w-full object-contain transition group-hover:scale-[1.02]"
                    />
                    <span className="pointer-events-none absolute bottom-1.5 left-1.5 rounded bg-slate-950/80 px-1.5 py-0.5 text-[9px] text-slate-300 opacity-0 transition group-hover:opacity-100">
                      🔍 Ampliar
                    </span>
                    {asset.photoSizesBytes?.[index] ? (
                      <span className="pointer-events-none absolute bottom-1 right-1 rounded bg-slate-950/80 px-1.5 py-0.5 text-[9px] text-slate-400">
                        {(asset.photoSizesBytes[index] / 1024).toFixed(0)} KB
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </aside>
        </div>
      </div>

      {lightboxIndex !== null && photos[lightboxIndex] && (
        <PhotoLightbox
          photos={photos}
          index={lightboxIndex}
          title={asset.name}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      )}
    </div>
  )
}

function SummaryTile({ label, value, valueClass = 'text-slate-100' }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2">
      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-0.5 truncate text-sm font-semibold ${valueClass}`} title={value}>{value}</p>
    </div>
  )
}
