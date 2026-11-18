import { memo, useEffect, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { AssetItem } from '@/types'
import PrivateStorageImage from '@/components/ui/PrivateStorageImage'
import { useMoney } from '@/features/privacy/money'
import type { CollectionKey } from './assetCategories'
import {
  assetIcon,
  assetIconTitle,
  coinValue,
  conservationTone,
  detailLabel,
  groupNumismaticaAssets,
  hasValue,
  inventoryNumber,
  isMedal,
  locationLabel,
  normalizeUiText,
  sortNumismaticaAssets,
  type NumismaticaGroupBy,
  type NumismaticaSortBy,
  yearLabel,
} from './numismaticaUi'

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

/**
 * Compact row list used by every collection (numismática and the rest).
 * Rows adapt per asset: coins show ceca/anverso/reverso, other assets show
 * marca/autor and origen. Clicking a row opens its detail sheet.
 */
function AssetList({
  assets,
  onOpen,
  onDelete,
  onPrintGroup,
  groupBy = 'none',
  sortBy = 'name',
  collection = 'objetos',
}: {
  assets: AssetItem[]
  onOpen: (asset: AssetItem) => void
  onDelete: (asset: AssetItem) => void
  onPrintGroup?: (label: string, assets: AssetItem[]) => void
  groupBy?: NumismaticaGroupBy
  sortBy?: NumismaticaSortBy
  collection?: CollectionKey
}) {
  const PAGE_SIZE = 200
  const [limit, setLimit] = useState(PAGE_SIZE)
  const money = useMoney()
  const isNumismaticaView = collection === 'numismatica'
  const groups = useMemo(
    () => groupNumismaticaAssets(sortNumismaticaAssets(assets, sortBy), groupBy),
    [assets, groupBy, sortBy],
  )

  useEffect(() => {
    setLimit(PAGE_SIZE)
  }, [assets, groupBy, sortBy])

  const visibleGroups = useMemo(() => {
    let remaining = limit
    return groups
      .map((group) => {
        const allItems = group.items
        const items = allItems.slice(0, Math.max(0, remaining))
        remaining -= items.length
        return { ...group, allItems, items, hidden: allItems.length - items.length }
      })
      .filter((group) => group.items.length > 0)
  }, [groups, limit])

  const hiddenCount = assets.length - visibleGroups.reduce((total, group) => total + group.items.length, 0)

  const handleListKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    const row = (event.target as HTMLElement).closest<HTMLElement>('[data-coin-row]')
    if (!row) return
    const rows = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[data-coin-row]'))
    const index = rows.indexOf(row)
    const next = rows[index + (event.key === 'ArrowDown' ? 1 : -1)]
    if (next) {
      event.preventDefault()
      next.focus()
    }
  }

  const renderRow = (asset: AssetItem) => {
    const photo = asset.photos?.[0]
    const medal = isMedal(asset)
    const icon = assetIcon(asset)
    const iconTitle = assetIconTitle(asset)
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
    const extra = medal ? [asset.medal_motive, asset.description].filter(Boolean).join(' · ') : asset.description?.trim() ?? ''

    return (
      <div
        key={asset.id}
        role="button"
        tabIndex={0}
        data-coin-row
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
              <span className="shrink-0 text-xs" title={iconTitle}>{icon}</span>
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
              {[year !== '—' ? year : '', detail, location, hasValue(asset) ? money.formatEuro(value) : ''].filter((part) => part && part !== '—').join(' · ') || 'Sin datos'}
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
            {value ? money.formatEuro(value) : '—'}
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
              : <div className="flex h-full w-full items-center justify-center text-sm text-slate-700">{icon}</div>}
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
    <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-900" onKeyDown={handleListKeyDown}>
      <div className={`${gridClass} hidden border-b border-slate-700 bg-slate-950/70 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 lg:grid`}>
        <span>Pieza</span>
        <span>Año</span>
        <span>Material</span>
        <span>{isNumismaticaView ? 'Ceca / Tamaño' : 'Marca / ceca'}</span>
        <span>Conservación</span>
        <span>{isNumismaticaView ? 'Ubicación' : 'Ubicación / origen'}</span>
        <span className="text-right">Valor</span>
        <span aria-hidden="true" />
        <span className="text-right">Foto</span>
      </div>

      {visibleGroups.map((group) => (
        <section key={group.label || 'all'}>
          {group.label && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-t border-slate-700 bg-slate-950/80 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 first:border-t-0">
              <span>📍 {group.label}</span>
              <span className="flex items-center gap-3">
                {onPrintGroup && (
                  <button
                    type="button"
                    onClick={() => onPrintGroup(group.label, group.allItems)}
                    className="text-slate-500 transition hover:text-slate-200"
                    title={`Imprimir ${group.label}`}
                    aria-label={`Imprimir ${group.label}`}
                  >
                    🖨
                  </button>
                )}
                <span>{group.items.length + group.hidden} pieza(s)</span>
                <span className="text-emerald-400">
                  {money.formatEuro(group.items.reduce((total, asset) => total + coinValue(asset), 0))}
                  {group.hidden > 0 ? ' (visibles)' : ''}
                </span>
              </span>
            </div>
          )}
          <div className="divide-y divide-slate-800">
            {group.items.map(renderRow)}
          </div>
          {group.hidden > 0 && (
            <p className="border-t border-slate-800 px-4 py-1.5 text-[11px] text-slate-500">
              … y {group.hidden} pieza(s) más en este grupo
            </p>
          )}
        </section>
      ))}

      {hiddenCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-700 bg-slate-950/60 px-4 py-3 text-xs text-slate-400">
          <span>Mostrando {assets.length - hiddenCount} de {assets.length}</span>
          <span className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setLimit((value) => value + PAGE_SIZE)}
              className="rounded-lg border border-slate-700 px-3 py-1.5 font-semibold text-slate-200 transition hover:bg-slate-800"
            >
              Mostrar {PAGE_SIZE} más
            </button>
            <button
              type="button"
              onClick={() => setLimit(assets.length)}
              className="font-semibold text-teal-300 transition hover:text-teal-200"
            >
              Mostrar todo
            </button>
          </span>
        </div>
      )}
    </div>
  )
}

export default memo(AssetList)
