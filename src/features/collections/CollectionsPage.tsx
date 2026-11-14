import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AssetItem, AssetCategory, Property } from '@/types'
import { subscribeToAssets, deleteAsset } from './assetsService'
import { subscribeToProperties } from '@/features/properties/propertiesService'
import AssetModal, { ASSET_CATEGORIES } from './AssetModal'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { assetSlug } from '@/utils/slugs'
import { getDefaultOwner, getOwnerOptions } from '@/utils/owners'

const CATEGORY_MAP = new Map(ASSET_CATEGORIES.map((c) => [c.value, c]))

export default function CollectionsPage() {
  const navigate = useNavigate()
  const { assetSlug: routeAssetSlug } = useParams<{ assetSlug?: string }>()
  const [assets, setAssets] = useState<AssetItem[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [firestoreError, setFirestoreError] = useState<string | null>(null)

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingAsset, setEditingAsset] = useState<AssetItem | null>(null)

  // Safe delete
  const [assetToDelete, setAssetToDelete] = useState<AssetItem | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Filters & Search
  const [selectedOwner, setSelectedOwner] = useState('all')
  const [selectedCategory, setSelectedCategory] = useState<'all' | AssetCategory>('all')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [tagFilterOpen, setTagFilterOpen] = useState(false)
  const [sortBy, setSortBy] = useState('name')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const unsubscribe = subscribeToAssets(
      (items) => {
        setAssets(items)
        setLoading(false)
        setFirestoreError(null)
      },
      (err) => {
        setFirestoreError(err.message)
        setLoading(false)
      },
    )
    return () => unsubscribe()
  }, [])

  useEffect(() => subscribeToProperties(setProperties, (error) => console.error('No se pudieron cargar los propietarios de inmuebles:', error)), [])

  const ownerOptions = useMemo(() => getOwnerOptions(properties, assets), [properties, assets])
  const defaultOwner = useMemo(() => getDefaultOwner(properties, assets), [properties, assets])
  const routedAsset = useMemo(
    () => routeAssetSlug ? assets.find((asset) => assetSlug(asset, assets) === routeAssetSlug) : undefined,
    [assets, routeAssetSlug],
  )

  useEffect(() => {
    if (!routeAssetSlug) {
      if (editingAsset) { setEditingAsset(null); setIsModalOpen(false) }
      return
    }
    const selectedAsset = routedAsset
    if (selectedAsset && (!isModalOpen || editingAsset?.id !== selectedAsset.id)) {
      setEditingAsset(selectedAsset)
      setIsModalOpen(true)
    }
  }, [editingAsset?.id, isModalOpen, routeAssetSlug, routedAsset])

  const sourceAssets = assets

  // Metrics
  const metrics = useMemo(() => {
    let totalValue = 0
    let coinsCount = 0
    let watchesCount = 0

    sourceAssets.forEach((a) => {
      totalValue += a.currentValue || 0
      if (a.category === 'coins') coinsCount++
      if (a.category === 'watches') watchesCount++
    })

    return {
      totalCount: sourceAssets.length,
      totalValue,
      coinsCount,
      watchesCount,
    }
  }, [sourceAssets])

  const existingTags = useMemo(() => Array.from(new Set(assets.flatMap((asset) => [
    ...(asset.tags ?? []), asset.brandOrAuthor, asset.material, asset.historicalEra, asset.country, asset.ruler, asset.mint, asset.denomination, asset.conservationState,
  ].filter((tag): tag is string => Boolean(tag?.trim())).map((tag) => tag.trim()))).values()).sort((a, b) => a.localeCompare(b, 'es')), [assets])
  // Filtered assets
  const filteredAssets = useMemo(() => {
    const filtered = sourceAssets.filter((a) => {
      const matchesOwner = selectedOwner === 'all' || (a.owner || 'Gabriel') === selectedOwner
      const matchesCat = selectedCategory === 'all' || a.category === selectedCategory
      const matchesTags = selectedTags.every((tag) => (a.tags ?? []).includes(tag))
      const q = searchQuery.toLowerCase().trim()
      const matchesSearch =
        !q ||
        a.name.toLowerCase().includes(q) ||
        (a.tags ?? []).some((tag) => tag.toLowerCase().includes(q)) ||
        (a.brandOrAuthor && a.brandOrAuthor.toLowerCase().includes(q)) ||
        (a.year !== undefined && String(a.year).includes(q)) ||
        (a.country && a.country.toLowerCase().includes(q)) ||
        (a.ruler && a.ruler.toLowerCase().includes(q)) ||
        (a.mint && a.mint.toLowerCase().includes(q)) ||
        (a.denomination && a.denomination.toLowerCase().includes(q)) ||
        (a.material && a.material.toLowerCase().includes(q)) ||
        (a.location && a.location.toLowerCase().includes(q)) ||
        (a.notes && a.notes.toLowerCase().includes(q)) ||
        (a.conservationState && a.conservationState.toLowerCase().includes(q)) ||
        (a.owner && a.owner.toLowerCase().includes(q))

      return matchesOwner && matchesCat && matchesTags && matchesSearch
    })
    return filtered.sort((a, b) => sortBy === 'value-desc' ? (b.currentValue ?? 0) - (a.currentValue ?? 0) : sortBy === 'year-asc' ? (a.year ?? Infinity) - (b.year ?? Infinity) : a.name.localeCompare(b.name, 'es'))
  }, [sourceAssets, selectedOwner, selectedCategory, selectedTags, searchQuery, sortBy])

  const handleOpenAddModal = () => {
    navigate('/bienes', { replace: true })
    setEditingAsset(null)
    setIsModalOpen(true)
  }

  const handleOpenEditModal = (asset: AssetItem) => {
    setEditingAsset(asset)
    setIsModalOpen(true)
    navigate(`/bienes/${assetSlug(asset, assets)}`)
  }

  const handleCloseAssetModal = () => {
    setEditingAsset(null)
    setIsModalOpen(false)
    if (routeAssetSlug) navigate('/bienes', { replace: true })
  }

  const handleConfirmDelete = async () => {
    if (!assetToDelete) return
    setIsDeleting(true)
    try {
      await deleteAsset(assetToDelete.id)
      setAssetToDelete(null)
    } catch (err: any) {
      alert('Error al eliminar: ' + err.message)
    } finally {
      setIsDeleting(false)
    }
  }

  const formatEuro = (val?: number) => {
    if (val === undefined || isNaN(val)) return '—'
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(val)
  }

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 tracking-tight">Bienes y Activos</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Un catálogo común para todo el patrimonio, organizado con categorías y etiquetas reutilizables.
          </p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-600 active:scale-98 text-white text-sm font-semibold shadow-md shadow-teal-500/10 transition"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Añadir bien
        </button>
      </div>

      {/* Firestore Error Alert */}
      {firestoreError && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm flex items-start gap-3">
          <span className="text-lg">⚠️</span>
          <div>
            <p className="font-semibold">Aviso de permisos de Firestore:</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Verifica haber publicado las reglas con tu UID en Firebase Console.
            </p>
            <p className="text-[11px] font-mono text-amber-600 mt-1">{firestoreError}</p>
          </div>
        </div>
      )}

      {routeAssetSlug && !loading && !routedAsset && (
        <div role="alert" className="rounded-xl border border-amber-800 bg-amber-950/50 p-4 text-sm text-amber-200">
          No se encontró el bien «{routeAssetSlug}». Puede que haya cambiado de nombre o se haya eliminado.
          <button onClick={() => navigate('/bienes', { replace: true })} className="ml-3 underline">Volver al catálogo</button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Total Piezas / Bienes
          </p>
          <p className="text-2xl font-bold text-slate-900 mt-2">{metrics.totalCount}</p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">
            Valoración Total Catálogo
          </p>
          <p className="text-2xl font-bold text-emerald-600 mt-2">
            {formatEuro(metrics.totalValue)}
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider">
            Monedas & Numismática
          </p>
          <p className="text-2xl font-bold text-amber-700 mt-2">{metrics.coinsCount} piezas</p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <p className="text-xs font-semibold text-teal-300 uppercase tracking-wider">
            Relojes & Otros Bienes
          </p>
          <p className="text-2xl font-bold text-teal-200 mt-2">
            {assets.length - metrics.coinsCount} piezas
          </p>
        </div>
      </div>

      {/* ─── FILTROS MULTI-NIVEL ────────────────────────────────────── */}
      <div className="space-y-3.5 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
        {/* 1. Filtro por Propietario (Gabriel / Isabel / Antonio) */}
        <div className="flex items-center gap-2 overflow-x-auto text-xs pb-1">
          <span className="font-bold text-slate-500 uppercase text-[11px] shrink-0">Propietario:</span>
          <button
            onClick={() => setSelectedOwner('all')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition shrink-0 ${
              selectedOwner === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Todos ({sourceAssets.length})
          </button>
          {ownerOptions.map(({ name: o }) => {
            const count = sourceAssets.filter((a) => (a.owner || 'Gabriel') === o).length
            return (
              <button
                key={o}
                onClick={() => setSelectedOwner(o)}
                className={`px-3 py-1.5 rounded-xl font-semibold transition shrink-0 flex items-center gap-1.5 ${
                  selectedOwner === o
                    ? 'bg-teal-700 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span>👤 {o}</span>
                <span className="opacity-75">({count})</span>
              </button>
            )
          })}
        </div>

        {/* 2. Filtro por Categorías */}
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-xs">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition shrink-0 ${
              selectedCategory === 'all'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            Todas las categorías
          </button>
          {ASSET_CATEGORIES.map((cat) => {
            const count = assets.filter((a) => a.category === cat.value).length
            return (
              <button
                key={cat.value}
                onClick={() => setSelectedCategory(cat.value)}
                className={`px-3 py-1.5 rounded-xl font-semibold transition shrink-0 flex items-center gap-1.5 ${
                  selectedCategory === cat.value
                    ? 'bg-teal-700 text-white shadow-xs'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
                <span className="opacity-75">({count})</span>
              </button>
            )
          })}
        </div>

        <div className="grid grid-cols-1 gap-2.5 border-t border-slate-100 pt-4 text-xs sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative sm:col-span-2"><input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar nombre, marca o etiqueta…" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 pl-8 text-slate-100 placeholder:text-slate-500 focus:border-teal-500 focus:outline-none" /><span className="absolute left-2.5 top-2 text-slate-500">⌕</span></div>
          <div className="relative"><button type="button" aria-expanded={tagFilterOpen} onClick={() => setTagFilterOpen((open) => !open)} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-left text-sm text-slate-200">Etiquetas{selectedTags.length ? ` · ${selectedTags.length} seleccionada(s)` : ''} ▾</button>{tagFilterOpen && <div className="absolute right-0 z-20 mt-2 max-h-64 w-full min-w-64 overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-2 shadow-xl">{existingTags.length ? existingTags.map((tag) => <label key={tag} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-slate-200 hover:bg-slate-800"><input type="checkbox" checked={selectedTags.includes(tag)} onChange={(event) => setSelectedTags((current) => event.target.checked ? [...current, tag] : current.filter((item) => item !== tag))} className="accent-teal-500" />{tag}</label>) : <p className="p-2 text-xs text-slate-500">Aún no hay etiquetas en el catálogo.</p>}{selectedTags.length > 0 && <button type="button" onClick={() => setSelectedTags([])} className="mt-2 w-full border-t border-slate-700 px-2 pt-2 text-left text-xs text-teal-300">Limpiar etiquetas</button>}</div>}</div>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"><option value="name">Ordenar: nombre</option><option value="year-asc">Año: más antiguo</option><option value="value-desc">Valor: mayor a menor</option></select>
        </div>
      </div>

      {/* Grid of Items */}
      {loading ? (
        <div className="text-center py-16">
          <div className="w-8 h-8 border-3 border-teal-700 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500">Cargando inventario de Firestore…</p>
        </div>
      ) : filteredAssets.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center max-w-lg mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 text-2xl flex items-center justify-center mx-auto mb-4">
            🪙
          </div>
          <h3 className="text-base font-bold text-slate-900">
            {assets.length === 0 ? 'No hay bienes registrados aún' : 'No hay resultados para estos filtros'}
          </h3>
          <p className="text-xs text-slate-500 mt-1.5 max-w-xs mx-auto">
            {assets.length === 0
              ? 'Empieza a registrar tus monedas, relojes o activos asignando su propietario correspondiente.'
              : 'Prueba a cambiar el filtro de propietario, país o época.'}
          </p>
          {assets.length === 0 && (
            <button
              onClick={handleOpenAddModal}
              className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-teal-700 hover:bg-teal-600 text-white rounded-xl text-xs font-semibold shadow-sm transition"
            >
              + Añadir Primer Bien
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredAssets.map((asset) => {
            const catInfo = CATEGORY_MAP.get(asset.category)
            const mainPhoto = asset.photos && asset.photos.length > 0 ? asset.photos[0] : null
            const tags = Array.from(new Set([...(asset.tags ?? []), asset.brandOrAuthor].filter((tag): tag is string => Boolean(tag?.trim()))))

            return (
              <div
                key={asset.id}
                role="button"
                tabIndex={0}
                aria-label={`Ver o editar ${asset.name}`}
                onClick={() => handleOpenEditModal(asset)}
                onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); handleOpenEditModal(asset) } }}
                className="group flex cursor-pointer flex-col justify-between overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-xs transition-all hover:border-slate-500 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                {/* Photo Thumbnail */}
                <div className="relative aspect-4/3 bg-slate-100 overflow-hidden border-b border-slate-100">
                  {mainPhoto ? (
                    <img
                      src={mainPhoto}
                      alt={asset.name}
                      className="w-full h-full object-cover group-hover:scale-102 transition duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl text-slate-300 select-none">
                      {catInfo?.icon || '📦'}
                    </div>
                  )}

                  {/* Category Pill Tag on image */}
                  <div className="absolute top-2.5 left-2.5 flex items-center gap-1 bg-white/95 backdrop-blur-xs px-2.5 py-1 rounded-full text-[11px] font-semibold text-slate-700 shadow-xs">
                    <span>{catInfo?.icon}</span>
                    <span>{catInfo?.label.split(' ')[0]}</span>
                  </div>

                  {/* Owner Badge on top right */}
                  <div className="absolute top-2.5 right-2.5 bg-teal-700/95 text-white backdrop-blur-xs px-2 py-0.5 rounded-full text-[10px] font-bold shadow-xs">
                    👤 {asset.owner || 'Gabriel'}
                  </div>

                  {asset.photos && asset.photos.length > 1 && (
                    <span className="absolute bottom-2.5 right-2.5 bg-slate-900/75 backdrop-blur-xs text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
                      +{asset.photos.length - 1} foto(s)
                    </span>
                  )}
                </div>

                {/* Content */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <h4 className="text-base font-bold text-slate-900 line-clamp-1" title={asset.name}>
                      {asset.name}
                    </h4>

                    <p className="mt-1 text-xs text-slate-400">
                      {asset.year !== undefined ? `Año ${asset.year > 0 ? asset.year : `${Math.abs(asset.year)} a.C.`}` : ''}
                      {(asset.placeOfOrigin || asset.country) ? ` · ${asset.placeOfOrigin || asset.country}` : ''}
                      {asset.historicalEra ? ` · ${asset.historicalEra}` : ''}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {asset.year !== undefined && (
                        <span className="px-2 py-0.5 rounded-md bg-slate-800 text-teal-200 text-[11px] font-mono font-bold border border-slate-700">
                          📅 {asset.year > 0 ? asset.year : `${Math.abs(asset.year)} a.C.`}
                        </span>
                      )}
                      {tags.map((tag) => <button key={tag} onClick={(event) => { event.stopPropagation(); setSelectedTags([tag]) }} className="rounded-full border border-teal-900 bg-teal-950/60 px-2.5 py-1 text-[11px] text-teal-200 hover:border-teal-600">{tag}</button>)}
                    </div>

                    {asset.location && (
                      <p className="text-xs text-slate-500 mt-2 flex items-center gap-1 truncate">
                        <span>📍</span>
                        <span className="truncate">{asset.location}</span>
                      </p>
                    )}
                  </div>

                  {/* Financials */}
                  <div className="pt-2 border-t border-slate-100 flex items-baseline justify-between">
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-semibold">Valor Estimado</p>
                      <p className="text-base font-bold text-emerald-600">
                        {formatEuro(asset.currentValue)}
                      </p>
                    </div>

                    {asset.acquisitionPrice !== undefined && asset.acquisitionPrice > 0 && (
                      <div className="text-right">
                        <p className="text-[10px] text-slate-400 uppercase font-semibold">Compra</p>
                        <p className="text-xs font-medium text-slate-500">
                          {formatEuro(asset.acquisitionPrice)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="p-3 px-4 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between">
                  <button
                    onClick={(event) => { event.stopPropagation(); handleOpenEditModal(asset) }}
                    className="text-xs font-semibold text-teal-300 hover:text-teal-200 transition"
                  >
                    Ver detalles / Editar
                  </button>

                  <button
                    onClick={(event) => { event.stopPropagation(); setAssetToDelete(asset) }}
                    className="p-1 rounded-md text-slate-300 hover:text-red-600 hover:bg-red-50 transition"
                    title="Eliminar"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.75}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Asset Modal (Create / Edit) */}
      <AssetModal isOpen={isModalOpen} assetToEdit={editingAsset} existingTags={existingTags} owners={ownerOptions.map((owner) => owner.name)} defaultOwner={defaultOwner} onClose={handleCloseAssetModal} onSaved={() => {}} />

      {/* Safe Delete Modal */}
      <ConfirmModal
        isOpen={assetToDelete !== null}
        title="¿Eliminar este bien del inventario?"
        message={`Esta acción borrará definitivamente "${assetToDelete?.name}" y sus fotografías.`}
        confirmWord="BORRAR"
        confirmButtonText="Eliminar Bien"
        isDestructive={true}
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onClose={() => setAssetToDelete(null)}
      />
    </div>
  )
}

