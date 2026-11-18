import { useMemo } from 'react'
import { AssetItem } from '@/types'
import PrivateStorageImage from '@/components/ui/PrivateStorageImage'
import {
  coinValue,
  conservationRank,
  conservationTone,
  containerLabel,
  detailLabel,
  formatEuro,
  hasValue,
  inventoryNumber,
  inventorySortValue,
  isMedal,
  locationLabel,
  normalizeUiText,
  type NumismaticaGroupBy,
  type NumismaticaSortBy,
  yearLabel,
} from './numismaticaUi'

function groupLabel(asset: AssetItem, groupBy: Exclude<NumismaticaGroupBy, 'none'>): string {
  switch (groupBy) {
    case 'location':
      return containerLabel(asset)
    case 'owner':
      return asset.owner?.trim() || 'Sin propietario'
    case 'material':
      return asset.material?.trim() || 'Sin material'
    case 'conservation':
      return asset.conservationState?.trim() || 'Sin estado'
    case 'era':
      return asset.era?.trim() || asset.historicalEra?.trim() || 'Sin época'
    case 'type':
      return isMedal(asset) ? 'Medallas' : 'Monedas'
  }
}

function compareOptionalText(a: string, b: string): number {
  const aEmpty = a.startsWith('Sin ') || a === '—'
  const bEmpty = b.startsWith('Sin ') || b === '—'
  if (aEmpty !== bEmpty) return aEmpty ? 1 : -1
  return a.localeCompare(b, 'es', { numeric: true })
}

function sortAssets(assets: AssetItem[], sortBy: NumismaticaSortBy): AssetItem[] {
  return [...assets].sort((a, b) => {
    switch (sortBy) {
      case 'inventory':
        return inventorySortValue(a) - inventorySortValue(b)
          || a.name.localeCompare(b.name, 'es', { numeric: true })
      case 'value-desc':
        return coinValue(b) - coinValue(a) || a.name.localeCompare(b.name, 'es')
      case 'year-asc':
        return (a.year ?? Number.POSITIVE_INFINITY) - (b.year ?? Number.POSITIVE_INFINITY)
          || a.name.localeCompare(b.name, 'es')
      case 'material':
        return (a.material ?? '').localeCompare(b.material ?? '', 'es')
          || a.name.localeCompare(b.name, 'es')
      case 'conservation':
        return conservationRank(a.conservationState) - conservationRank(b.conservationState)
          || a.name.localeCompare(b.name, 'es')
      default:
        return a.name.localeCompare(b.name, 'es', { numeric: true })
    }
  })
}

function groupAssets(assets: AssetItem[], groupBy: NumismaticaGroupBy): Array<{ label: string; items: AssetItem[] }> {
  if (groupBy === 'none') return [{ label: '', items: assets }]

  const map = new Map<string, AssetItem[]>()
  assets.forEach((asset) => {
    const label = groupLabel(asset, groupBy)
    const list = map.get(label) ?? []
    list.push(asset)
    map.set(label, list)
  })

  const groups = Array.from(map.entries()).map(([label, items]) => ({ label, items }))
  groups.sort((a, b) => {
    if (groupBy === 'conservation') {
      return conservationRank(a.label) - conservationRank(b.label) || compareOptionalText(a.label, b.label)
    }
    return compareOptionalText(a.label, b.label)
  })
  return groups
}

function Tag({ tag }: { tag: string }) {
  const isReview = normalizeUiText(tag) === 'revisar'
  const isStorage = normalizeUiText(tag).startsWith('revisar estuche')
  return (
    <span
      className={`rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
        isReview
          ? 'border-amber-800 bg-amber-950/60 text-amber-300'
          : isStorage
            ? 'border-fuchsia-800 bg-fuchsia-950/60 text-fuchsia-200'
            : 'border-slate-700 bg-slate-950 text-slate-400'
      }`}
    >
      {tag}
    </span>
  )
}

export default function NumismaticaList({
  assets,
  onOpen,
  onDelete,
  groupBy = 'location',
  sortBy = 'inventory',
}: {
  assets: AssetItem[]
  onOpen: (asset: AssetItem) => void
  onDelete: (asset: AssetItem) => void
  groupBy?: NumismaticaGroupBy
  sortBy?: NumismaticaSortBy
}) {
  const groups = useMemo(() => groupAssets(sortAssets(assets, sortBy), groupBy), [assets, groupBy, sortBy])

  const renderRow = (asset: AssetItem) => {
    const photo = asset.photos?.[0]
    const medal = isMedal(asset)
    const value = coinValue(asset)
    const year = yearLabel(asset)
    const detail = detailLabel(asset)
    const location = locationLabel(asset)
    const tone = conservationTone(asset.conservationState)
    const inventory = inventoryNumber(asset)
    const tags = (asset.tags ?? []).filter((tag) => tag.trim())
    const obverse = asset.obverse_info?.trim()
    const reverse = asset.reverse_info?.trim()
    const notes = asset.notes?.trim()
    const extra = medal ? [asset.medal_motive, asset.description].filter(Boolean).join(' · ') : ''

    return (
      <div
        key={asset.id}
        role="button"
        tabIndex={0}
        aria-label={`Ver ${asset.name}`}
        onClick={() => onOpen(asset)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onOpen(asset)
          }
        }}
        className="group cursor-pointer px-3 py-2 transition hover:bg-slate-800/50 focus:bg-slate-800/60 focus:outline-none"
      >
        <div className="grid grid-cols-[minmax(0,1fr)_28px_36px] items-center gap-2 lg:grid-cols-[minmax(0,2.1fr)_84px_88px_minmax(0,1fr)_116px_minmax(0,1.1fr)_92px_28px_36px]">
          <div className="min-w-0">
            <p className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-slate-100" title={asset.name}>
              <span className="shrink-0 text-xs" title={medal ? 'Medalla' : 'Moneda'}>{medal ? '🏅' : '🪙'}</span>
              {inventory && (
                <span className="shrink-0 font-mono text-[11px] font-normal text-slate-500">#{inventory}</span>
              )}
              <span className="truncate">{asset.name}</span>
              {asset.catalog_reference && (
                <span className="shrink-0 rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 text-[9px] font-normal text-slate-400">
                  {asset.catalog_reference}
                </span>
              )}
            </p>
            <p className="mt-0.5 truncate text-[11px] text-slate-500 lg:hidden">
              {[year !== '—' ? year : '', detail, location, hasValue(asset) ? formatEuro(value) : ''].filter((part) => part && part !== '—').join(' · ') || 'Sin datos'}
            </p>
          </div>

          <span className="hidden text-xs text-slate-300 lg:block">{year}</span>
          <span className="hidden truncate text-xs text-slate-400 lg:block">{asset.material || '—'}</span>
          <span className="hidden truncate text-xs text-slate-400 lg:block" title={detail}>{detail}</span>
          <span className="hidden lg:block">
            {asset.conservationState ? (
              <span className={`inline-flex max-w-full items-center gap-1.5 truncate rounded-full border px-2 py-0.5 text-[10px] font-medium ${tone.chip}`}>
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone.dot}`} />
                <span className="truncate">{asset.conservationState}</span>
              </span>
            ) : (
              <span className="text-xs text-slate-600">—</span>
            )}
          </span>
          <span className="hidden truncate text-xs text-slate-400 lg:block" title={location}>{location}</span>
          <span className={`hidden text-right text-xs font-semibold lg:block ${value ? 'text-emerald-400' : 'text-slate-600'}`}>
            {value ? formatEuro(value) : '—'}
          </span>

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

        {(obverse || reverse || notes || tags.length > 0 || extra) && (
          <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1 pl-6 text-[11px] leading-snug lg:pl-7">
            {obverse && (
              <span className="max-w-full truncate text-slate-400 lg:max-w-[38ch]" title={obverse}>
                <span className="font-semibold text-slate-500">Anv. </span>{obverse}
              </span>
            )}
            {reverse && (
              <span className="max-w-full truncate text-slate-400 lg:max-w-[38ch]" title={reverse}>
                <span className="font-semibold text-slate-500">Rev. </span>{reverse}
              </span>
            )}
            {extra && <span className="max-w-full truncate text-slate-400 lg:max-w-[52ch]">{extra}</span>}
            {notes && (
              <span className="max-w-full truncate text-slate-500 lg:max-w-[52ch]" title={notes}>
                <span className="mr-1 text-slate-600">📝</span>{notes}
              </span>
            )}
            {tags.length > 0 && (
              <span className="flex flex-wrap items-center gap-1">
                {tags.slice(0, 6).map((tag) => <Tag key={tag} tag={tag} />)}
              </span>
            )}
          </div>
        )}
      </div>
    )
  }

  const gridClass = 'grid grid-cols-[minmax(0,1fr)_28px_36px] items-center gap-2 px-3 lg:grid-cols-[minmax(0,2.1fr)_84px_88px_minmax(0,1fr)_116px_minmax(0,1.1fr)_92px_28px_36px]'

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-900">
      <div className={`${gridClass} hidden border-b border-slate-700 bg-slate-950/70 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 lg:grid`}>
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

      {groups.map((group) => (
        <section key={group.label || 'all'}>
          {group.label && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-t border-slate-700 bg-slate-950/80 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 first:border-t-0">
              <span>📍 {group.label}</span>
              <span className="flex items-center gap-3">
                <span>{group.items.length} pieza(s)</span>
                <span className="text-emerald-400">{formatEuro(group.items.reduce((total, asset) => total + coinValue(asset), 0))}</span>
              </span>
            </div>
          )}
          <div className="divide-y divide-slate-800">
            {group.items.map(renderRow)}
          </div>
        </section>
      ))}
    </div>
  )
}
