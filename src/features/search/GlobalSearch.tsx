import { useDeferredValue, useEffect, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { AssetItem, Property, Tenant } from '@/types'
import { subscribeToProperties } from '@/features/properties/propertiesService'
import { subscribeToTenants } from '@/features/tenants/tenantsService'
import { subscribeToAssets } from '@/features/collections/assetsService'
import { categoryCollection, getCategoryInfo } from '@/features/collections/assetCategories'
import { buildAssetSlugIndex, propertySlug } from '@/utils/slugs'
import { useFocusTrap } from '@/hooks/useFocusTrap'

interface SearchResult {
  id: string
  icon: string
  label: string
  detail: string
  go: () => void
}

function normalizeText(value: string | undefined | null): string {
  return (value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es')
}

/**
 * Búsqueda global (Ctrl+K / ⌘K o el botón de la barra lateral) que salta a
 * cualquier inmueble, inquilino o bien desde cualquier pantalla. Los
 * listeners solo están activos mientras el buscador está abierto.
 */
export default function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const [activeIndex, setActiveIndex] = useState(0)
  const [properties, setProperties] = useState<Property[]>([])
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [assets, setAssets] = useState<AssetItem[]>([])
  // Escape ya cierra el buscador; el hook solo encierra el tabulador.
  const trapRef = useFocusTrap<HTMLDivElement>(open)

  useEffect(() => {
    if (!open) {
      setQuery('')
      setActiveIndex(0)
      return
    }
    const unsubscribeProperties = subscribeToProperties(setProperties, () => {})
    const unsubscribeTenants = subscribeToTenants(setTenants, () => {})
    const unsubscribeAssets = subscribeToAssets(setAssets, () => {})
    return () => {
      unsubscribeProperties()
      unsubscribeTenants()
      unsubscribeAssets()
    }
  }, [open])

  const slugIndex = useMemo(() => buildAssetSlugIndex(assets), [assets])

  const results = useMemo<SearchResult[]>(() => {
    const normalized = normalizeText(deferredQuery.trim())
    if (!normalized) return []
    const matches = (...fields: Array<string | undefined | null>) =>
      fields.some((field) => normalizeText(field).includes(normalized))

    const propertyResults: SearchResult[] = properties
      .filter((property) => matches(property.name, property.city, property.address, property.owner, property.tenantName, property.province))
      .slice(0, 5)
      .map((property) => ({
        id: property.id,
        icon: '🏠',
        label: property.name,
        detail: [property.city, property.owner].filter(Boolean).join(' · ') || 'Inmueble',
        go: () => navigate(`/inmuebles/${propertySlug(property, properties)}`),
      }))

    const tenantResults: SearchResult[] = tenants
      .filter((tenant) => matches(tenant.name, tenant.nif, tenant.phone, tenant.email, tenant.city))
      .slice(0, 5)
      .map((tenant) => ({
        id: tenant.id,
        icon: '👤',
        label: tenant.name,
        detail: tenant.isActive === false ? 'Inquilino inactivo' : 'Inquilino',
        go: () => navigate(`/inmuebles/inquilinos/${tenant.id}`),
      }))

    const assetResults: SearchResult[] = assets
      .filter((asset) => matches(asset.name, asset.brandOrAuthor, asset.inventory_number, asset.catalog_reference, asset.owner, asset.material, asset.denomination))
      .slice(0, 8)
      .map((asset) => {
        const category = getCategoryInfo(asset.category)
        return {
          id: asset.id,
          icon: category.icon,
          label: asset.name,
          detail: category.label,
          go: () => {
            const slug = slugIndex.slugById.get(asset.id)
            if (slug) navigate(`/bienes/categoria/${categoryCollection(asset.category)}/${slug}`)
          },
        }
      })

    return [...propertyResults, ...tenantResults, ...assetResults]
  }, [deferredQuery, properties, tenants, assets, slugIndex, navigate])

  useEffect(() => {
    setActiveIndex(0)
  }, [deferredQuery])

  if (!open) return null

  const choose = (result: SearchResult) => {
    result.go()
    onClose()
  }

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowDown' && results.length > 0) {
      event.preventDefault()
      setActiveIndex((current) => Math.min(current + 1, results.length - 1))
    }
    if (event.key === 'ArrowUp' && results.length > 0) {
      event.preventDefault()
      setActiveIndex((current) => Math.max(current - 1, 0))
    }
    if (event.key === 'Enter' && results[activeIndex]) {
      event.preventDefault()
      choose(results[activeIndex])
    }
    if (event.key === 'Escape') onClose()
  }

  return (
    <div
      ref={trapRef}
      tabIndex={-1}
      className="fixed inset-0 z-[65] flex items-start justify-center bg-black/70 p-4 pt-[12vh] backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Búsqueda global"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center gap-2.5 border-b border-slate-800 px-4 py-3">
          <span className="text-slate-500">⌕</span>
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar inmuebles, inquilinos o bienes…"
            className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
          />
          <kbd className="shrink-0 rounded border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-500">Esc</kbd>
        </div>

        <div className="max-h-[55vh] overflow-y-auto p-2">
          {results.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-slate-500">
              {deferredQuery.trim()
                ? `Sin resultados para «${deferredQuery.trim()}»`
                : 'Escribe para buscar en inmuebles, inquilinos y bienes.'}
            </p>
          ) : results.map((result, index) => (
            <button
              key={`${result.id}-${result.icon}`}
              type="button"
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => choose(result)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                index === activeIndex ? 'bg-slate-800' : 'hover:bg-slate-800/60'
              }`}
            >
              <span className="shrink-0 text-base" aria-hidden="true">{result.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-slate-100">{result.label}</span>
                <span className="block truncate text-[11px] text-slate-500">{result.detail}</span>
              </span>
              <span className="shrink-0 text-[10px] text-slate-600">↵</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4 border-t border-slate-800 px-4 py-2 text-[10px] text-slate-500">
          <span>↑↓ navegar</span>
          <span>↵ abrir</span>
          <span>Esc cerrar</span>
        </div>
      </div>
    </div>
  )
}
