import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AssetCategory, AssetItem, Property } from '@/types'
import { subscribeToAssets, deleteAsset, migrateLegacyAssetPhotos } from './assetsService'
import { subscribeToProperties } from '@/features/properties/propertiesService'
import AssetModal from './AssetModal'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { buildAssetSlugIndex } from '@/utils/slugs'
import { getDefaultOwner, getOwnerOptions } from '@/utils/owners'
import PrivateStorageImage from '@/components/ui/PrivateStorageImage'
import { formatStorageBytes, subscribeToAppStorageUsage, AppStorageUsage, STORAGE_NO_COST_STORAGE_BYTES } from '@/lib/storageUsage'
import { useMoney } from '@/features/privacy/money'
import {
  DEFAULT_LIST_PREFERENCES,
  loadPreferences,
  preferencesFromParams,
  preferencesToParams,
  savePreferences,
  type ListPreferences,
  type ListView,
} from './listPreferences'
import AssetList from './AssetList'
import {
  groupOptionsForCollection,
  orderNumismaticaAssets,
  sortOptionsForCollection,
  assetValue,
  type NumismaticaGroupBy,
  type NumismaticaSortBy,
} from './numismaticaUi'
import AssetDetailModal from './AssetDetailModal'
import AssetPrintTable from './AssetPrintTable'
import { CONSERVATION_STATES, formatSignedYear } from './numismaticaMeta'
import {
  ASSET_CATEGORIES,
  COLLECTIONS,
  COLLECTION_MAP,
  type CollectionKey,
  categoryCollection,
  getCategoryInfo,
  isCollectionKey,
  matchesCollection,
} from './assetCategories'

const SEARCHABLE_FIELDS = [
  'name', 'owner', 'brandOrAuthor', 'description', 'historicalEra', 'country', 'placeOfOrigin',
  'ruler', 'mint', 'mint_mark', 'denomination', 'conservationState', 'material', 'notes', 'era', 'empire_reign',
  'manufacturing_place', 'reference_book', 'case_location', 'case_number', 'obverse_info', 'reverse_info',
  'medal_motive', 'acquisition_operation', 'medal_location', 'numismatica_type',
  'inventory_number', 'catalog_reference', 'acquisition_source', 'value_source', 'purchase_currency',
  'weight_grams', 'diameter_mm',
] as const

function normalizeText(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es')
}

function uniqueValues(values: Array<string | undefined | null>): string[] {
  const seen = new Map<string, string>()
  values.forEach((value) => {
    const text = value?.trim()
    if (!text) return
    const key = text.toLocaleLowerCase('es')
    if (!seen.has(key)) seen.set(key, text)
  })
  return Array.from(seen.values()).sort((a, b) => a.localeCompare(b, 'es'))
}

function matchesSelected(value: string | undefined, selected: string) {
  return selected === 'all' || normalizeText(value ?? '') === normalizeText(selected)
}

export default function CollectionsPage() {
  const navigate = useNavigate()
  const { assetSlug: routeAssetSlug, collectionKey } = useParams<{ assetSlug?: string; collectionKey?: string }>()

  const [assets, setAssets] = useState<AssetItem[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [firestoreError, setFirestoreError] = useState<string | null>(null)
  const [storageUsage, setStorageUsage] = useState<AppStorageUsage>({ pdfBytes: 0, imageBytes: 0, documentBytes: 0, pdfCount: 0, imageCount: 0, documentCount: 0 })
  const [photoMigration, setPhotoMigration] = useState('')
  const [isMigratingPhotos, setIsMigratingPhotos] = useState(false)

  const [editingAsset, setEditingAsset] = useState<AssetItem | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [detailAsset, setDetailAsset] = useState<AssetItem | null>(null)
  const [printJob, setPrintJob] = useState<{ title: string; assets: AssetItem[]; subtitle?: string } | null>(null)

  const [assetToDelete, setAssetToDelete] = useState<AssetItem | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const [selectedOwner, setSelectedOwner] = useState('all')
  const [selectedCategory, setSelectedCategory] = useState<'all' | AssetCategory>('all')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [tagFilterOpen, setTagFilterOpen] = useState(false)
  const [sortBy, setSortBy] = useState<NumismaticaSortBy>('name')
  const [groupBy, setGroupBy] = useState<NumismaticaGroupBy>('none')
  const [view, setView] = useState<ListView>('list')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedMaterial, setSelectedMaterial] = useState('all')
  const [selectedConservationState, setSelectedConservationState] = useState('all')
  const [selectedEra, setSelectedEra] = useState('all')
  const [selectedNumismaticaType, setSelectedNumismaticaType] = useState('all')
  const [onlyReview, setOnlyReview] = useState(false)

  const deferredSearchQuery = useDeferredValue(searchQuery)
  const isSearchPending = deferredSearchQuery !== searchQuery
  const money = useMoney()

  const activeCollection: CollectionKey | undefined = isCollectionKey(collectionKey) ? collectionKey : undefined
  const isLanding = !activeCollection
  const isNumismaticaCollection = activeCollection === 'numismatica'

  useEffect(() => {
    if (collectionKey && !isCollectionKey(collectionKey)) navigate('/bienes', { replace: true })
  }, [collectionKey, navigate])

  useEffect(() => {
    const unsubscribe = subscribeToAssets(
      (items) => {
        setAssets(items)
        setLoading(false)
        setFirestoreError(null)
      },
      (error) => {
        setFirestoreError(error.message)
        setLoading(false)
      },
    )
    return () => unsubscribe()
  }, [])

  useEffect(() => subscribeToProperties(setProperties, (error) => console.error('No se pudieron cargar los propietarios de inmuebles:', error)), [])
  useEffect(() => subscribeToAppStorageUsage(setStorageUsage, (error) => setFirestoreError(`No se pudo leer el uso de Storage: ${error.message}`)), [])

  const defaultPreferences = useMemo<ListPreferences>(() => (
    activeCollection === 'numismatica'
      ? { ...DEFAULT_LIST_PREFERENCES, groupBy: 'location', sortBy: 'inventory' }
      : activeCollection === 'todos'
        ? { ...DEFAULT_LIST_PREFERENCES, groupBy: 'category', sortBy: 'name' }
        : { ...DEFAULT_LIST_PREFERENCES, groupBy: 'none', sortBy: 'name' }
  ), [activeCollection])

  const groupOptions = useMemo(
    () => groupOptionsForCollection(activeCollection ?? 'objetos'),
    [activeCollection],
  )
  const sortOptions = useMemo(
    () => sortOptionsForCollection(activeCollection ?? 'objetos'),
    [activeCollection],
  )

  useEffect(() => {
    if (!collectionKey) {
      setSearchQuery('')
      return
    }
    const fromUrl = preferencesFromParams(new URLSearchParams(window.location.search), defaultPreferences)
    const stored = fromUrl.hasParams ? null : loadPreferences(collectionKey, defaultPreferences)
    const loaded = fromUrl.hasParams ? fromUrl.preferences : stored ?? defaultPreferences

    // Un valor guardado que no encaja con esta colección vuelve al por defecto.
    const safeGroupBy = groupOptions.some((option) => option.value === loaded.groupBy) ? loaded.groupBy : defaultPreferences.groupBy
    const safeSortBy = sortOptions.some((option) => option.value === loaded.sortBy) ? loaded.sortBy : defaultPreferences.sortBy

    setSelectedOwner(loaded.owner)
    setSelectedCategory(loaded.category as 'all' | AssetCategory)
    setSelectedTags(loaded.tags)
    setSelectedMaterial(loaded.material)
    setSelectedConservationState(loaded.conservation)
    setSelectedEra(loaded.era)
    setSelectedNumismaticaType(loaded.type)
    setOnlyReview(loaded.onlyReview)
    setSearchQuery('')
    setGroupBy(safeGroupBy)
    setSortBy(safeSortBy)
    setView(loaded.view)
  }, [collectionKey, defaultPreferences, groupOptions, sortOptions])

  const preferences = useMemo<ListPreferences>(() => ({
    groupBy,
    sortBy,
    owner: selectedOwner,
    category: selectedCategory,
    tags: selectedTags,
    material: selectedMaterial,
    conservation: selectedConservationState,
    era: selectedEra,
    type: selectedNumismaticaType,
    onlyReview,
    view,
  }), [
    groupBy, sortBy, selectedOwner, selectedCategory, selectedTags, selectedMaterial,
    selectedConservationState, selectedEra, selectedNumismaticaType, onlyReview, view,
  ])

  const [, setSearchParams] = useSearchParams()
  const listParamsString = useMemo(
    () => (activeCollection ? preferencesToParams(preferences, defaultPreferences).toString() : ''),
    [activeCollection, preferences, defaultPreferences],
  )

  useEffect(() => {
    if (!collectionKey) return
    savePreferences(collectionKey, preferences)
    const current = window.location.search.replace(/^\?/, '')
    if (listParamsString !== current) {
      setSearchParams(listParamsString ? new URLSearchParams(listParamsString) : {}, { replace: true })
    }
  }, [collectionKey, preferences, listParamsString, setSearchParams])

  const listQuerySuffix = listParamsString ? `?${listParamsString}` : ''

  useEffect(() => {
    if (!printJob) return
    const clear = () => setPrintJob(null)
    window.addEventListener('afterprint', clear)
    const timer = window.setTimeout(() => window.print(), 150)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('afterprint', clear)
    }
  }, [printJob])

  const ownerOptions = useMemo(() => getOwnerOptions(properties, assets), [properties, assets])
  const defaultOwner = useMemo(() => getDefaultOwner(properties, assets), [properties, assets])
  const slugIndex = useMemo(() => buildAssetSlugIndex(assets), [assets])
  const routedAsset = useMemo(
    () => (routeAssetSlug ? slugIndex.bySlug.get(routeAssetSlug) : undefined),
    [routeAssetSlug, slugIndex],
  )

  useEffect(() => {
    if (!routeAssetSlug) {
      setDetailAsset(null)
      return
    }
    if (routedAsset) setDetailAsset(routedAsset)
  }, [routeAssetSlug, routedAsset])

  const scopedAssets = useMemo(
    () => (activeCollection ? assets.filter((asset) => matchesCollection(asset.category, activeCollection)) : assets),
    [activeCollection, assets],
  )

  const collectionStats = useMemo(() => COLLECTIONS.map((collection) => {
    const items = assets.filter((asset) => matchesCollection(asset.category, collection.key))
    return {
      ...collection,
      count: items.length,
      value: items.reduce((total, asset) => total + assetValue(asset), 0),
    }
  }), [assets])

  const metrics = useMemo(() => ({
    totalCount: scopedAssets.length,
    totalValue: scopedAssets.reduce((total, asset) => total + assetValue(asset), 0),
  }), [scopedAssets])

  const existingTags = useMemo(() => uniqueValues(assets.flatMap((asset) => [
    ...(asset.tags ?? []),
    asset.brandOrAuthor,
    asset.material,
    asset.historicalEra,
    asset.country,
    asset.ruler,
    asset.mint,
    asset.denomination,
    asset.conservationState,
  ])), [assets])

  const numismaticaSuggestions = useMemo(() => {
    const fields = ['material', 'conservationState', 'era', 'empire_reign', 'country', 'reference_book', 'denomination', 'ruler', 'mint', 'mint_mark', 'case_location', 'medal_motive', 'medal_location', 'acquisition_operation', 'acquisition_source', 'value_source']
    const suggestions: Record<string, string[]> = {}
    fields.forEach((field) => {
      suggestions[field] = uniqueValues(assets.map((asset) => {
        switch (field) {
          case 'material': return asset.material
          case 'conservationState': return asset.conservationState
          case 'era': return asset.era
          case 'empire_reign': return asset.empire_reign
          case 'country': return asset.country
          case 'reference_book': return asset.reference_book
          case 'denomination': return asset.denomination
          case 'ruler': return asset.ruler
          case 'mint': return asset.mint
          case 'mint_mark': return asset.mint_mark
          case 'case_location': return asset.case_location
          case 'medal_motive': return asset.medal_motive
          case 'medal_location': return asset.medal_location
          case 'acquisition_operation': return asset.acquisition_operation
          case 'acquisition_source': return asset.acquisition_source
          case 'value_source': return asset.value_source
          default: return undefined
        }
      }))
    })
    return suggestions
  }, [assets])

  const materialOptions = useMemo(() => uniqueValues(scopedAssets.map((asset) => asset.material)), [scopedAssets])
  const conservationOptions = useMemo(() => {
    const existing = uniqueValues(scopedAssets.map((asset) => asset.conservationState))
    return existing.sort((a, b) => {
      const indexA = CONSERVATION_STATES.findIndex((state) => normalizeText(state) === normalizeText(a))
      const indexB = CONSERVATION_STATES.findIndex((state) => normalizeText(state) === normalizeText(b))
      return (indexA === -1 ? CONSERVATION_STATES.length : indexA) - (indexB === -1 ? CONSERVATION_STATES.length : indexB)
        || a.localeCompare(b, 'es')
    })
  }, [scopedAssets])
  const eraOptions = useMemo(() => uniqueValues(scopedAssets.map((asset) => asset.era || asset.historicalEra)), [scopedAssets])
  const categoryOptions = useMemo(
    () => ASSET_CATEGORIES.filter((category) => scopedAssets.some((asset) => asset.category === category.value)),
    [scopedAssets],
  )

  const reviewCount = useMemo(
    () => scopedAssets.filter((asset) => (asset.tags ?? []).some((tag) => normalizeText(tag) === 'revisar')).length,
    [scopedAssets],
  )

  const legacyPhotoCount = useMemo(
    () => assets.reduce((sum, asset) => sum + (asset.photos ?? []).filter((photo) => photo.startsWith('data:image/')).length, 0),
    [assets],
  )

  const filteredAssets = useMemo(() => {
    const query = normalizeText(deferredSearchQuery.trim())
    const filtered = scopedAssets.filter((asset) => {
      const matchesOwner = selectedOwner === 'all' || normalizeText(asset.owner || 'Gabriel') === normalizeText(selectedOwner)
      const matchesCategory = selectedCategory === 'all' || asset.category === selectedCategory
      const matchesTags = selectedTags.every((tag) => (asset.tags ?? []).some((item) => normalizeText(item) === normalizeText(tag)))
      const matchesMaterialFilter = matchesSelected(asset.material, selectedMaterial)
      const matchesConservationFilter = matchesSelected(asset.conservationState, selectedConservationState)
      const matchesEraFilter = matchesSelected(asset.era || asset.historicalEra, selectedEra)
      const matchesNumismaticaType = selectedNumismaticaType === 'all'
        || (asset.numismatica_type === 'medalla' ? 'medalla' : 'moneda') === selectedNumismaticaType
      const matchesReview = !onlyReview || (asset.tags ?? []).some((tag) => normalizeText(tag) === 'revisar')

      if (!query) return matchesOwner && matchesCategory && matchesTags && matchesMaterialFilter && matchesConservationFilter && matchesEraFilter && matchesNumismaticaType && matchesReview

      const haystack = [
        ...SEARCHABLE_FIELDS.map((field) => asset[field]),
        ...(asset.tags ?? []),
        asset.year === undefined ? '' : String(asset.year),
      ].filter((value): value is string => typeof value === 'string' && value.length > 0).join(' ')

      const matchesSearch = normalizeText(haystack).includes(query)
      return matchesOwner && matchesCategory && matchesTags && matchesMaterialFilter && matchesConservationFilter && matchesEraFilter && matchesNumismaticaType && matchesReview && matchesSearch
    })

    return filtered.sort((a, b) => {
      if (sortBy === 'value-desc') return assetValue(b) - assetValue(a)
      if (sortBy === 'year-asc') return (a.year ?? Infinity) - (b.year ?? Infinity)
      if (sortBy === 'material') return (a.material ?? '').localeCompare(b.material ?? '', 'es')
      if (sortBy === 'conservation') return (a.conservationState ?? '').localeCompare(b.conservationState ?? '', 'es')
      if (sortBy === 'inventory') {
        const aNumber = Number.parseInt((a.inventory_number ?? a.case_number ?? '').replace(/[^\d]/g, ''), 10)
        const bNumber = Number.parseInt((b.inventory_number ?? b.case_number ?? '').replace(/[^\d]/g, ''), 10)
        return (Number.isNaN(aNumber) ? Infinity : aNumber) - (Number.isNaN(bNumber) ? Infinity : bNumber)
          || a.name.localeCompare(b.name, 'es')
      }
      return a.name.localeCompare(b.name, 'es')
    })
  }, [
    scopedAssets, selectedOwner, selectedCategory, selectedTags, selectedMaterial, selectedConservationState,
    selectedEra, selectedNumismaticaType, onlyReview, deferredSearchQuery, sortBy,
  ])

  const filteredValue = useMemo(
    () => filteredAssets.reduce((total, asset) => total + assetValue(asset), 0),
    [filteredAssets],
  )
  const hasActiveFilters = selectedOwner !== 'all'
    || selectedCategory !== 'all'
    || selectedTags.length > 0
    || selectedMaterial !== 'all'
    || selectedConservationState !== 'all'
    || selectedEra !== 'all'
    || selectedNumismaticaType !== 'all'
    || onlyReview
    || searchQuery.trim().length > 0

  const clearFilters = () => {
    setSelectedOwner('all')
    setSelectedCategory('all')
    setSelectedTags([])
    setSelectedMaterial('all')
    setSelectedConservationState('all')
    setSelectedEra('all')
    setSelectedNumismaticaType('all')
    setOnlyReview(false)
    setSearchQuery('')
  }

  // Orden exacto en pantalla: la lista sigue los grupos, la cuadrícula es plana.
  const displayOrder = useMemo(
    () => (view === 'grid' ? filteredAssets : orderNumismaticaAssets(filteredAssets, groupBy, sortBy)),
    [view, filteredAssets, groupBy, sortBy],
  )
  const detailIndex = detailAsset ? displayOrder.findIndex((item) => item.id === detailAsset.id) : -1

  const goToSibling = (offset: number) => {
    if (detailIndex < 0) return
    const target = displayOrder[detailIndex + offset]
    if (!target) return
    const slug = slugIndex.slugById.get(target.id)
    if (!slug) return
    const targetCollection = activeCollection ?? categoryCollection(target.category)
    navigate(`/bienes/categoria/${targetCollection}/${slug}${listQuerySuffix}`, { replace: true })
  }

  const handleOpenAddModal = () => {
    setEditingAsset(null)
    setIsModalOpen(true)
  }

  const handleOpenDetail = useCallback((asset: AssetItem) => {
    const slug = slugIndex.slugById.get(asset.id)
    if (!slug) return
    const targetCollection = activeCollection ?? categoryCollection(asset.category)
    navigate(`/bienes/categoria/${targetCollection}/${slug}${listQuerySuffix}`)
  }, [navigate, slugIndex, listQuerySuffix, activeCollection])

  const handleCloseDetail = () => {
    setDetailAsset(null)
    if (routeAssetSlug) {
      const target = activeCollection ?? categoryCollection(detailAsset?.category)
      navigate(`/bienes/categoria/${target}${listQuerySuffix}`, { replace: true })
    }
  }

  const handleEditFromDetail = (asset: AssetItem) => {
    setEditingAsset(asset)
    setIsModalOpen(true)
  }

  const handleCloseAssetModal = () => {
    setIsModalOpen(false)
    setEditingAsset(null)
  }

  const handleAssetSaved = (category: AssetCategory) => {
    setIsModalOpen(false)
    setEditingAsset(null)
    setDetailAsset(null)
    const target = activeCollection ?? categoryCollection(category)
    navigate(`/bienes/categoria/${target}${listQuerySuffix}`, { replace: Boolean(routeAssetSlug) })
  }

  const handleConfirmDelete = async () => {
    if (!assetToDelete) return
    setIsDeleting(true)
    try {
      await deleteAsset(assetToDelete.id)
      if (detailAsset?.id === assetToDelete.id) handleCloseDetail()
      setAssetToDelete(null)
    } catch (error) {
      alert(`Error al eliminar: ${error instanceof Error ? error.message : 'Error desconocido'}`)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleMigratePhotos = async () => {
    if (!window.confirm(`Se copiarán ${legacyPhotoCount} foto(s) comprimidas a Firebase Storage. Las copias originales de Firestore se conservarán como respaldo. ¿Continuar?`)) return
    setIsMigratingPhotos(true)
    setPhotoMigration('Preparando migración…')
    try {
      const result = await migrateLegacyAssetPhotos((done, total) => setPhotoMigration(`Bienes migrados: ${done}/${total}`))
      setPhotoMigration(`Migración terminada. ${result.migratedAssets} bien(es) con fotos copiados a Storage; los originales se conservaron.`)
    } catch (error) {
      setPhotoMigration(`La migración se detuvo: ${error instanceof Error ? error.message : 'error desconocido'}. Puedes volver a intentarlo; las fotos que ya estén en Storage se omitirán.`)
    } finally {
      setIsMigratingPhotos(false)
    }
  }

  const defaultCategory: AssetCategory = activeCollection && activeCollection !== 'todos' ? activeCollection : 'objetos'
  const collectionInfo = activeCollection ? COLLECTION_MAP.get(activeCollection) : undefined

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-4 pb-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {isLanding ? (
            <>
              <h2 className="text-2xl font-bold tracking-tight text-slate-100">Bienes y Activos</h2>
              <p className="mt-0.5 text-sm text-slate-500">Un catálogo común para todo el patrimonio, organizado por colecciones.</p>
            </>
          ) : (
            <>
              <button type="button" onClick={() => navigate('/bienes')} className="mb-2 text-xs font-semibold text-teal-300 hover:text-teal-200">← Volver a Bienes</button>
              <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-100">
                <span>{collectionInfo?.icon}</span>
                <span>{collectionInfo?.label}</span>
              </h2>
              <p className="mt-0.5 text-sm text-slate-500">
                {collectionInfo?.description} · {metrics.totalCount} pieza(s) · {money.formatEuro(metrics.totalValue)}
              </p>
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {legacyPhotoCount > 0 && (
            <button onClick={() => void handleMigratePhotos()} disabled={isMigratingPhotos} className="rounded-xl border border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-200 disabled:opacity-50">
              {isMigratingPhotos ? 'Migrando fotos…' : `Migrar ${legacyPhotoCount} foto(s) antiguas`}
            </button>
          )}
          <button onClick={handleOpenAddModal} className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-teal-500/10 transition hover:bg-teal-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            {isNumismaticaCollection ? 'Añadir moneda o medalla' : 'Añadir bien'}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-xs text-slate-300">
        <div className="flex flex-wrap gap-x-5 gap-y-1">
          <span>Storage de la app: <strong>{formatStorageBytes(storageUsage.pdfBytes + storageUsage.imageBytes + storageUsage.documentBytes)}</strong> / 5 GB-mes sin coste</span>
          <span>PDF: {formatStorageBytes(storageUsage.pdfBytes)} ({storageUsage.pdfCount})</span>
          <span>Fotos: {formatStorageBytes(storageUsage.imageBytes)} ({storageUsage.imageCount})</span>
          <span>Docs inquilinos: {formatStorageBytes(storageUsage.documentBytes)} ({storageUsage.documentCount})</span>
        </div>
      </div>

      {photoMigration && (
        <div role="status" className="rounded-lg border border-teal-900 bg-teal-950/40 px-3 py-2 text-xs text-teal-200">
          {photoMigration}
          <button className="ml-3 underline" onClick={() => setPhotoMigration('')}>Cerrar</button>
        </div>
      )}

      {firestoreError && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <span className="text-lg">⚠️</span>
          <div>
            <p className="font-semibold">Aviso de permisos de Firestore:</p>
            <p className="mt-0.5 text-xs text-amber-700">Verifica haber publicado las reglas con tu UID en Firebase Console.</p>
            <p className="mt-1 font-mono text-[11px] text-amber-600">{firestoreError}</p>
          </div>
        </div>
      )}

      {routeAssetSlug && !loading && !routedAsset && (
        <div role="alert" className="rounded-xl border border-amber-800 bg-amber-950/50 p-4 text-sm text-amber-200">
          No se encontró el bien «{routeAssetSlug}». Puede que haya cambiado de nombre o se haya eliminado.
          <button
            onClick={() => navigate(activeCollection ? `/bienes/categoria/${activeCollection}` : '/bienes', { replace: true })}
            className="ml-3 underline"
          >
            Volver al catálogo
          </button>
        </div>
      )}

      {isLanding ? (
        <section className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Colecciones</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {collectionStats.map((collection) => (
              <button
                key={collection.key}
                type="button"
                onClick={() => navigate(`/bienes/categoria/${collection.key}`)}
                className={`group rounded-2xl border p-5 text-left transition hover:bg-slate-900/80 ${
                  collection.key === 'todos'
                    ? 'border-teal-800 bg-teal-950/30 hover:border-teal-500'
                    : 'border-slate-700 bg-slate-900 hover:border-teal-500'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-3xl">{collection.icon}</span>
                    <h4 className="mt-3 text-lg font-bold text-slate-100">{collection.label}</h4>
                    <p className="mt-1 text-xs text-slate-400">{collection.description}</p>
                  </div>
                  <span className="rounded-full border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs font-semibold text-teal-200">{collection.count}</span>
                </div>
                <p className="mt-4 border-t border-slate-800 pt-3 text-xs text-slate-400">Valoración: <span className="font-semibold text-emerald-400">{money.formatEuro(collection.value)}</span></p>
                <p className="mt-1 text-xs font-semibold text-teal-300 group-hover:text-teal-200">Ver colección →</p>
              </button>
            ))}
          </div>
        </section>
      ) : (
        <>
          <div className="space-y-3.5 rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-sm">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
              <span className="shrink-0 text-[11px] font-bold uppercase text-slate-500">Propietario:</span>
              <button
                onClick={() => setSelectedOwner('all')}
                className={`shrink-0 rounded-xl px-3 py-1.5 font-semibold transition ${selectedOwner === 'all' ? 'bg-slate-100 text-slate-900' : 'border border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800'}`}
              >
                Todos ({scopedAssets.length})
              </button>
              {ownerOptions.map((owner) => {
                const count = scopedAssets.filter((asset) => normalizeText(asset.owner || 'Gabriel') === normalizeText(owner.name)).length
                return (
                  <button
                    key={owner.name}
                    onClick={() => setSelectedOwner(owner.name)}
                    className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 font-semibold transition ${selectedOwner === owner.name ? 'bg-teal-700 text-white' : 'border border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800'}`}
                  >
                    👤 {owner.name} <span className="opacity-75">({count})</span>
                  </button>
                )
              })}
            </div>

            {categoryOptions.length > 1 && (
              <div className="flex flex-wrap items-center gap-2 border-t border-slate-800 pt-3 text-xs">
                <span className="text-[11px] font-bold uppercase text-slate-500">Categoría:</span>
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`rounded-xl px-3 py-1.5 font-semibold transition ${selectedCategory === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-950 text-slate-300 hover:bg-slate-800'}`}
                >
                  Todas
                </button>
                {categoryOptions.map((category) => {
                  const count = scopedAssets.filter((asset) => asset.category === category.value).length
                  return (
                    <button
                      key={category.value}
                      onClick={() => setSelectedCategory(category.value)}
                      className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-semibold transition ${selectedCategory === category.value ? 'bg-teal-700 text-white' : 'bg-slate-950 text-slate-300 hover:bg-slate-800'}`}
                    >
                      <span>{category.icon}</span><span>{category.label}</span><span className="opacity-75">({count})</span>
                    </button>
                  )
                })}
              </div>
            )}

            <div className={`grid grid-cols-1 gap-2.5 border-t border-slate-800 pt-4 text-xs sm:grid-cols-2 ${isNumismaticaCollection ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
              {isNumismaticaCollection && (
                <select value={selectedNumismaticaType} onChange={(event) => setSelectedNumismaticaType(event.target.value)} className={filterInputClass}>
                  <option value="all">Tipo: todo</option>
                  <option value="moneda">Monedas</option>
                  <option value="medalla">Medallas</option>
                </select>
              )}
              <select value={selectedMaterial} onChange={(event) => setSelectedMaterial(event.target.value)} className={filterInputClass}>
                <option value="all">Material: todos</option>
                {materialOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
              <select value={selectedConservationState} onChange={(event) => setSelectedConservationState(event.target.value)} className={filterInputClass}>
                <option value="all">Estado: todos</option>
                {conservationOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
              <select value={selectedEra} onChange={(event) => setSelectedEra(event.target.value)} className={filterInputClass}>
                <option value="all">Época: todas</option>
                {eraOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-2.5 border-t border-slate-800 pt-4 text-xs sm:flex-row">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={isNumismaticaCollection ? 'Buscar nombre, motivo, ceca, gobernante, material…' : 'Buscar nombre, marca, material, etiqueta…'}
                  className={`${filterInputClass} pl-8 pr-24`}
                />
                <span className="absolute left-2.5 top-2 text-slate-500">⌕</span>
                {isSearchPending && (
                  <span className="absolute right-3 top-2 text-[11px] text-slate-500">Buscando…</span>
                )}
              </div>
              {!isNumismaticaCollection && (
                <div className="relative sm:w-56">
                  <button
                    type="button"
                    aria-expanded={tagFilterOpen}
                    onClick={() => setTagFilterOpen((open) => !open)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-left text-sm text-slate-200"
                  >
                    Etiquetas{selectedTags.length ? ` · ${selectedTags.length} seleccionada(s)` : ''} ▾
                  </button>
                  {tagFilterOpen && (
                    <div className="absolute right-0 z-20 mt-2 max-h-64 w-full min-w-64 overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-2 shadow-xl">
                      {existingTags.length ? existingTags.map((tag) => (
                        <label key={tag} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-slate-200 hover:bg-slate-800">
                          <input
                            type="checkbox"
                            checked={selectedTags.includes(tag)}
                            onChange={(event) => setSelectedTags((current) => event.target.checked ? [...current, tag] : current.filter((item) => item !== tag))}
                            className="accent-teal-500"
                          />
                          {tag}
                        </label>
                      )) : <p className="p-2 text-xs text-slate-500">Aún no hay etiquetas en el catálogo.</p>}
                      {selectedTags.length > 0 && (
                        <button type="button" onClick={() => setSelectedTags([])} className="mt-2 w-full border-t border-slate-700 px-2 pt-2 text-left text-xs text-teal-300">Limpiar etiquetas</button>
                      )}
                    </div>
                  )}
                </div>
              )}
              {isNumismaticaCollection && (
                <button
                  type="button"
                  onClick={() => setOnlyReview((value) => !value)}
                  aria-pressed={onlyReview}
                  disabled={reviewCount === 0}
                  className={`shrink-0 rounded-xl px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${onlyReview ? 'bg-amber-700 text-white' : 'border border-amber-900 bg-amber-950/40 text-amber-200 hover:bg-amber-950/60'}`}
                >
                  ⚠️ Solo REVISAR ({reviewCount})
                </button>
              )}
              <select
                value={groupBy}
                onChange={(event) => setGroupBy(event.target.value as NumismaticaGroupBy)}
                className={`${filterInputClass} sm:w-52`}
                aria-label="Agrupar por"
              >
                <option value="none">Agrupar: sin agrupar</option>
                {groupOptions.map((option) => (
                  <option key={option.value} value={option.value}>Agrupar: {option.label}</option>
                ))}
              </select>
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as NumismaticaSortBy)}
                className={`${filterInputClass} sm:w-56`}
                aria-label="Ordenar por"
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>Ordenar: {option.label}</option>
                ))}
              </select>
              <div className="flex shrink-0 overflow-hidden rounded-xl border border-slate-700 bg-slate-950" role="group" aria-label="Vista de la lista">
                <button
                  type="button"
                  onClick={() => setView('list')}
                  aria-pressed={view === 'list'}
                  className={`px-3 py-2 font-semibold transition ${view === 'list' ? 'bg-teal-700 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
                >
                  ☰ Lista
                </button>
                <button
                  type="button"
                  onClick={() => setView('grid')}
                  aria-pressed={view === 'grid'}
                  className={`px-3 py-2 font-semibold transition ${view === 'grid' ? 'bg-teal-700 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
                >
                  ▦ Cuadrícula
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-slate-500">
            <span>
              Mostrando <strong className="text-slate-200">{filteredAssets.length}</strong> de {scopedAssets.length} pieza(s)
              <span className="mx-1.5 text-slate-700">·</span>
              <span className="font-semibold text-emerald-400">{money.formatEuro(filteredValue)}</span>
            </span>
            <span className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setPrintJob({
                  title: collectionInfo?.label ?? 'Bienes',
                  assets: filteredAssets,
                  subtitle: hasActiveFilters ? 'Vista filtrada' : undefined,
                })}
                className="font-semibold text-slate-300 transition hover:text-slate-100"
              >
                🖨 Imprimir vista
              </button>
              {hasActiveFilters && (
                <button type="button" onClick={clearFilters} className="font-semibold text-teal-300 transition hover:text-teal-200">
                  Limpiar filtros
                </button>
              )}
            </span>
          </div>

          {loading ? (
            <LoadingState />
          ) : filteredAssets.length === 0 ? (
            <EmptyState
              title={scopedAssets.length === 0 ? 'Todavía no hay bienes en esta colección' : 'No hay resultados para estos filtros'}
              description={scopedAssets.length === 0 ? 'Añade el primer bien de esta colección para empezar.' : 'Prueba a cambiar los filtros o a limpiar la búsqueda.'}
              onAdd={scopedAssets.length === 0 ? handleOpenAddModal : undefined}
              addLabel={isNumismaticaCollection ? 'Añadir moneda o medalla' : 'Añadir bien'}
            />
          ) : view === 'grid' ? (
            <AssetGrid assets={filteredAssets} onOpen={handleOpenDetail} onDelete={setAssetToDelete} />
          ) : (
            <AssetList
              assets={filteredAssets}
              onOpen={handleOpenDetail}
              onDelete={setAssetToDelete}
              groupBy={groupBy}
              sortBy={sortBy}
              collection={activeCollection}
              onPrintGroup={(label, items) => setPrintJob({
                title: `${collectionInfo?.label ?? 'Bienes'} · ${label}`,
                assets: items,
              })}
            />
          )}
        </>
      )}

      {printJob && (
        <AssetPrintTable title={printJob.title} assets={printJob.assets} subtitle={printJob.subtitle} />
      )}

      <AssetDetailModal
        asset={detailAsset}
        suspended={isModalOpen}
        index={detailIndex >= 0 ? detailIndex + 1 : undefined}
        total={displayOrder.length}
        onPrevious={detailIndex > 0 ? () => goToSibling(-1) : undefined}
        onNext={detailIndex >= 0 && detailIndex < displayOrder.length - 1 ? () => goToSibling(1) : undefined}
        onClose={handleCloseDetail}
        onEdit={handleEditFromDetail}
        onDelete={setAssetToDelete}
      />

      <AssetModal
        isOpen={isModalOpen}
        assetToEdit={editingAsset}
        existingTags={existingTags}
        owners={ownerOptions.map((owner) => owner.name)}
        defaultOwner={defaultOwner}
        defaultCategory={defaultCategory}
        storageUsedBytes={storageUsage.imageBytes}
        storageFreeBytes={Math.max(0, STORAGE_NO_COST_STORAGE_BYTES - storageUsage.pdfBytes - storageUsage.imageBytes - storageUsage.documentBytes)}
        numismaticaSuggestions={numismaticaSuggestions}
        onClose={handleCloseAssetModal}
        onSaved={handleAssetSaved}
      />

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

const filterInputClass = 'w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:border-teal-500 focus:outline-none'

function AssetCard({ asset, onOpen, onDelete }: { asset: AssetItem; onOpen: (asset: AssetItem) => void; onDelete: (asset: AssetItem) => void }) {
  const money = useMoney()
  const category = getCategoryInfo(asset.category)
  const mainPhoto = asset.photos?.[0]
  const yearText = asset.creation_year_range?.trim() || (asset.year !== undefined ? formatSignedYear(asset.year) : '')
  const tags = Array.from(new Set([...(asset.tags ?? []), asset.material, asset.conservationState].filter((tag): tag is string => Boolean(tag?.trim())))).slice(0, 5)

  return (
    <div
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
      className="group flex cursor-pointer flex-col justify-between overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-sm transition-all hover:border-slate-500 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-teal-500"
    >
      <div className="relative aspect-[4/3] overflow-hidden border-b border-slate-800 bg-slate-950">
        {mainPhoto ? (
          <PrivateStorageImage source={mainPhoto} alt={asset.name} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
        ) : (
          <div className="flex h-full w-full select-none items-center justify-center text-5xl text-slate-700">{category.icon}</div>
        )}
        <div className="absolute left-2.5 top-2.5 flex items-center gap-1 rounded-full bg-slate-950/90 px-2.5 py-1 text-[11px] font-semibold text-slate-200 shadow-sm">
          <span>{category.icon}</span>
          <span>{category.label}</span>
        </div>
        <div className="absolute right-2.5 top-2.5 rounded-full bg-teal-700/95 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">👤 {asset.owner || 'Gabriel'}</div>
        {asset.photos && asset.photos.length > 1 && (
          <span className="absolute bottom-2.5 right-2.5 rounded-full bg-slate-900/80 px-2 py-0.5 text-[10px] font-semibold text-white">+{asset.photos.length - 1} foto(s)</span>
        )}
      </div>

      <div className="flex flex-1 flex-col justify-between space-y-3 p-4">
        <div>
          <h4 className="line-clamp-1 text-base font-bold text-slate-100" title={asset.name}>{asset.name}</h4>
          <p className="mt-1 text-xs text-slate-400">
            {yearText ? `Año ${yearText}` : ''}
            {(asset.placeOfOrigin || asset.country) ? ` · ${asset.placeOfOrigin || asset.country}` : ''}
            {(asset.era || asset.historicalEra) ? ` · ${asset.era || asset.historicalEra}` : ''}
          </p>
          {asset.brandOrAuthor && (
            <p className="mt-1 text-xs text-slate-500">{asset.brandOrAuthor}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {tags.map((tag) => (
              <span key={tag} className="rounded-full border border-teal-900 bg-teal-950/60 px-2.5 py-1 text-[11px] text-teal-200">{tag}</span>
            ))}
          </div>
        </div>

        <div className="flex items-baseline justify-between border-t border-slate-800 pt-2">
          <div>
            <p className="text-[10px] font-semibold uppercase text-slate-500">Valor estimado</p>
            <p className="text-base font-bold text-emerald-400">{money.formatEuro(assetValue(asset))}</p>
          </div>
          {asset.acquisitionPrice !== undefined && asset.acquisitionPrice > 0 && (
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase text-slate-500">Compra</p>
              <p className="text-xs font-medium text-slate-400">{money.formatEuro(asset.acquisitionPrice)}</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-slate-800 bg-slate-950/60 p-3 px-4">
        <button onClick={(event) => { event.stopPropagation(); onOpen(asset) }} className="text-xs font-semibold text-teal-300 transition hover:text-teal-200">Ver detalles</button>
        <button
          onClick={(event) => { event.stopPropagation(); onDelete(asset) }}
          className="rounded-md p-1 text-slate-400 transition hover:bg-red-950/50 hover:text-red-400"
          title="Eliminar"
          aria-label={`Eliminar ${asset.name}`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  )
}

/** Vista de cuadrícula: tarjetas con foto grande y pintado progresivo. */
function AssetGrid({ assets, onOpen, onDelete }: { assets: AssetItem[]; onOpen: (asset: AssetItem) => void; onDelete: (asset: AssetItem) => void }) {
  const PAGE_SIZE = 60
  const [limit, setLimit] = useState(PAGE_SIZE)

  useEffect(() => {
    setLimit(PAGE_SIZE)
  }, [assets])

  const visible = assets.slice(0, limit)
  const hidden = assets.length - visible.length

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {visible.map((asset) => (
          <AssetCard key={asset.id} asset={asset} onOpen={onOpen} onDelete={onDelete} />
        ))}
      </div>
      {hidden > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-xs text-slate-400">
          <span>Mostrando {visible.length} de {assets.length}</span>
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

function LoadingState() {
  return (
    <div className="py-16 text-center">
      <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-teal-700 border-t-transparent" />
      <p className="text-sm text-slate-500">Cargando inventario de Firestore…</p>
    </div>
  )
}

function EmptyState({ title, description, onAdd, addLabel = 'Añadir bien' }: { title: string; description: string; onAdd?: () => void; addLabel?: string }) {
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-dashed border-slate-700 bg-slate-900 p-12 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-950/40 text-2xl text-amber-300">🪙</div>
      <h3 className="text-base font-bold text-slate-100">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-xs text-xs text-slate-500">{description}</p>
      {onAdd && (
        <button onClick={onAdd} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-600">
          + {addLabel}
        </button>
      )}
    </div>
  )
}
