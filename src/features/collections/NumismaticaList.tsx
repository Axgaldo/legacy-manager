import { AssetItem } from '@/types'
import PrivateStorageImage from '@/components/ui/PrivateStorageImage'
import { formatSignedYear } from './numismaticaMeta'

const euroFormatter = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

function formatEuro(value?: number) {
  return value === undefined || Number.isNaN(value) ? '—' : euroFormatter.format(value)
}

function coinYearLabel(asset: AssetItem) {
  if (asset.creation_year_range?.trim()) return asset.creation_year_range.trim()
  if (asset.year !== undefined) return formatSignedYear(asset.year)
  return '—'
}

function coinValue(asset: AssetItem) {
  return asset.currentValue ?? asset.market_value ?? asset.value
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
      <div className="hidden grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)_110px_minmax(0,0.9fr)_90px_120px_90px_28px_36px] items-center gap-2 border-b border-slate-700 bg-slate-950/70 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 lg:grid">
        <span>Moneda</span>
        <span>Época</span>
        <span>Año</span>
        <span>Ceca</span>
        <span>Material</span>
        <span>Conservación</span>
        <span className="text-right">Valor</span>
        <span aria-hidden="true" />
        <span className="text-right">Foto</span>
      </div>

      <div className="divide-y divide-slate-800">
        {assets.map((asset) => {
          const photo = asset.photos?.[0]
          const value = coinValue(asset)
          const yearLabel = coinYearLabel(asset)
          const mobileSummary = [yearLabel !== '—' ? yearLabel : '', asset.mint, asset.material, asset.conservationState]
            .filter(Boolean)
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
              className="group grid cursor-pointer grid-cols-[minmax(0,1fr)_28px_36px] items-center gap-2 px-4 py-1.5 transition hover:bg-slate-800/60 focus:bg-slate-800/60 focus:outline-none lg:grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)_110px_minmax(0,0.9fr)_90px_120px_90px_28px_36px]"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-100" title={asset.name}>{asset.name}</p>
                <p className="mt-0.5 truncate text-[11px] text-slate-500 lg:hidden">
                  {mobileSummary || 'Sin datos'}
                </p>
              </div>

              <span className="hidden truncate text-xs text-slate-400 lg:block">{asset.era || asset.historicalEra || '—'}</span>
              <span className="hidden text-xs text-slate-300 lg:block">{yearLabel}</span>
              <span className="hidden truncate text-xs text-slate-400 lg:block">{asset.mint || '—'}</span>
              <span className="hidden truncate text-xs text-slate-400 lg:block">{asset.material || '—'}</span>
              <span className="hidden lg:block">
                {asset.conservationState
                  ? <span className="inline-flex max-w-full truncate rounded-full border border-slate-700 bg-slate-950 px-2 py-0.5 text-[10px] text-slate-300">{asset.conservationState}</span>
                  : <span className="text-xs text-slate-600">—</span>}
              </span>
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
                  : <div className="flex h-full w-full items-center justify-center text-sm text-slate-700">🪙</div>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
