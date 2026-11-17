import { AssetItem } from '@/types'
import PrivateStorageImage from '@/components/ui/PrivateStorageImage'
import { formatSignedYear } from './numismaticaMeta'

const euroFormatter = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

function formatEuro(value?: number) {
  return value === undefined || Number.isNaN(value) ? '—' : euroFormatter.format(value)
}

function isMedal(asset: AssetItem) {
  return asset.numismatica_type === 'medalla'
}

function yearLabel(asset: AssetItem) {
  if (asset.creation_year_range?.trim()) return asset.creation_year_range.trim()
  if (asset.year !== undefined) return formatSignedYear(asset.year)
  return '—'
}

function sizeLabel(value?: string) {
  const text = value?.trim()
  if (!text) return ''
  return /[a-zA-Z]/.test(text) ? text : `${text} mm`
}

function detailLabel(asset: AssetItem) {
  if (isMedal(asset)) return sizeLabel(asset.medal_size_mm) || '—'
  const parts = [asset.mint, asset.mint_mark ? `(${asset.mint_mark})` : '']
  if (asset.conservationState) parts.push(asset.conservationState)
  return parts.filter(Boolean).join(' · ') || '—'
}

function locationLabel(asset: AssetItem) {
  if (isMedal(asset)) return asset.medal_location || '—'
  const storage = [asset.case_location, asset.case_number].filter((part): part is string => Boolean(part?.trim())).join(' · ')
  return storage || '—'
}

function coinValue(asset: AssetItem) {
  return asset.currentValue ?? asset.market_value ?? asset.value ?? asset.purchase_price
}

export default function NumismaticaList({
  assets,
  onOpen,
  onDelete,
}: {
  assets: AssetItem[]
  onOpen: (asset: AssetItem) => void
  onDelete: (asset: AssetItem) => void
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-900">
      <div className="hidden grid-cols-[minmax(0,2.4fr)_100px_minmax(0,0.9fr)_minmax(0,1.1fr)_120px_minmax(0,1.2fr)_90px_28px_36px] items-center gap-2 border-b border-slate-700 bg-slate-950/70 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 lg:grid">
        <span>Pieza</span>
        <span>Año</span>
        <span>Material</span>
        <span>Ceca / Tamaño</span>
        <span>Conservación</span>
        <span>Ubicación</span>
        <span className="text-right">Valor</span>
        <span aria-hidden="true" />
        <span className="text-right">Foto</span>
      </div>

      <div className="divide-y divide-slate-800">
        {assets.map((asset) => {
          const photo = asset.photos?.[0]
          const medal = isMedal(asset)
          const value = coinValue(asset)
          const year = yearLabel(asset)
          const detail = detailLabel(asset)
          const location = locationLabel(asset)
          const mobileSummary = [year !== '—' ? year : '', detail, asset.material, location, asset.catalog_reference]
            .filter((part) => part && part !== '—')
            .join(' · ')

          return (
            <div
              key={asset.id}
              role="button"
              tabIndex={0}
              aria-label={`Ver o editar ${asset.name}`}
              onClick={() => onOpen(asset)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onOpen(asset)
                }
              }}
              className="group grid cursor-pointer grid-cols-[minmax(0,1fr)_28px_36px] items-center gap-2 px-4 py-1.5 transition hover:bg-slate-800/60 focus:bg-slate-800/60 focus:outline-none lg:grid-cols-[minmax(0,2.4fr)_100px_minmax(0,0.9fr)_minmax(0,1.1fr)_120px_minmax(0,1.2fr)_90px_28px_36px]"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-100" title={asset.name}>
                  <span className="mr-1.5 text-xs" title={medal ? 'Medalla' : 'Moneda'}>{medal ? '🏅' : '🪙'}</span>
                  {asset.name}
                  {asset.catalog_reference && (
                    <span className="ml-2 rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 text-[9px] font-normal text-slate-400">
                      {asset.catalog_reference}
                    </span>
                  )}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-slate-500 lg:hidden">
                  {mobileSummary || 'Sin datos'}
                </p>
              </div>

              <span className="hidden text-xs text-slate-300 lg:block">{year}</span>
              <span className="hidden truncate text-xs text-slate-400 lg:block">{asset.material || '—'}</span>
              <span className="hidden truncate text-xs text-slate-400 lg:block">{detail}</span>
              <span className="hidden lg:block">
                {!medal && asset.conservationState
                  ? <span className="inline-flex max-w-full truncate rounded-full border border-slate-700 bg-slate-950 px-2 py-0.5 text-[10px] text-slate-300">{asset.conservationState}</span>
                  : <span className="text-xs text-slate-600">—</span>}
              </span>
              <span className="hidden truncate text-xs text-slate-400 lg:block">{location}</span>
              <span className="hidden text-right text-xs font-semibold text-emerald-400 lg:block">{formatEuro(value)}</span>

              <button
                type="button"
                onClick={(event) => { event.stopPropagation(); onDelete(asset) }}
                className="rounded-md p-1 text-slate-500 transition hover:bg-red-950/50 hover:text-red-400 lg:text-slate-600 lg:opacity-0 lg:group-hover:opacity-100 lg:focus:opacity-100"
                title="Eliminar"
                aria-label={`Eliminar ${asset.name}`}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>

              <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
                {photo
                  ? <PrivateStorageImage source={photo} alt={asset.name} className="h-full w-full object-cover" />
                  : <div className="flex h-full w-full items-center justify-center text-sm text-slate-700">{medal ? '🏅' : '🪙'}</div>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
