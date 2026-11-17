import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { AssetCategory, AssetItem } from '@/types'
import { createAsset, updateAsset } from './assetsService'
import { compressImageToWebP } from '@/utils/imageCompression'
import { getHistoricalEraFromYear } from '@/utils/historicalEras'
import { resolveOwnerName } from '@/utils/owners'
import PrivateStorageImage from '@/components/ui/PrivateStorageImage'
import { NumismaticaFields } from './NumismaticaFields'
import { ASSET_CATEGORIES } from './assetCategories'
import {
  buildCoinName,
  buildMedalName,
  getEraFromYear,
  getMidpointYearFromValues,
  getPrimaryYearFromValues,
  getRulerSuggestion,
  getYearLabelFromValues,
  parseYearRangeText,
} from './numismaticaMeta'

const QUICK_TAGS = ['ORO', 'PLATA', 'COBRE', 'BRONCE', 'ACERO', 'MADERA', 'CUERO', 'PLÁSTICO', 'ÉPOCA ROMANA', 'EDAD MEDIA', 'SIGLO XVIII', 'SIGLO XIX', 'SIGLO XX', 'ESPAÑA', 'CARLOS IV', 'FELIPE II', 'TRAJANO', 'EXCELENTE', 'BUEN ESTADO']
const MATERIAL_TAGS = ['ORO', 'PLATA', 'COBRE', 'BRONCE', 'ACERO', 'MADERA', 'CUERO', 'PLÁSTICO']
const inputClass = 'w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20'

interface AssetModalProps {
  isOpen: boolean
  assetToEdit: AssetItem | null
  existingTags?: string[]
  owners: string[]
  defaultOwner: string
  defaultCategory?: AssetCategory
  storageUsedBytes: number
  storageFreeBytes: number
  numismaticaSuggestions?: Record<string, string[]>
  onClose: () => void
  onSaved?: (category: AssetCategory) => void
}

function emptyNumismaticaData(): Record<string, string> {
  return {
    value: '',
    market_value: '',
    purchase_price: '',
    purchase_year: '',
    numismatica_type: 'moneda',
    medal_motive: '',
    medal_year: '',
    medal_size_mm: '',
    medal_name_override: '',
    acquisition_operation: '',
    medal_location: '',
    obverse_info: '',
    reverse_info: '',
    era: '',
    creation_year_range: '',
    reference_book: '',
    reference_book_value: '',
    empire_reign: '',
    ruler: '',
    mint: '',
    manufacturing_place: '',
    case_location: '',
    case_number: '',
    denomination: '',
    material: '',
    conservationState: '',
    added_date: '',
    year_mode: 'single',
    year_value: '',
    year_era: 'ad',
    range_start: '',
    range_end: '',
    range_start_era: 'ad',
    range_end_era: 'ad',
    range_legacy_text: '',
    name_override: '',
  }
}

function toInputValue(value?: number | string | null): string {
  return value === undefined || value === null ? '' : String(value)
}

function parseNumber(value: string | undefined): number | undefined {
  const trimmed = value?.trim()
  if (!trimmed) return undefined
  const parsed = Number(trimmed.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : undefined
}

function deriveMaterial(tags: string[]): string {
  return tags.find((tag) => MATERIAL_TAGS.includes(tag.toLocaleUpperCase())) ?? ''
}

function toDateInput(value: unknown): string {
  if (!value) return ''
  const timestamp = value as { toDate?: () => Date }
  if (typeof timestamp.toDate === 'function') return timestamp.toDate().toISOString().slice(0, 10)
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === 'string') return value.slice(0, 10)
  return ''
}

function buildNumismaticaData(asset: AssetItem): Record<string, string> {
  const base = emptyNumismaticaData()
  const rangeText = asset.creation_year_range?.trim() ?? ''
  const parsedRange = rangeText ? parseYearRangeText(rangeText) : {}
  const hasParsedRange = parsedRange.start !== undefined || parsedRange.end !== undefined
  const useRange = Boolean(rangeText)
  const signedYear = asset.year
  const start = useRange ? parsedRange.start : signedYear
  const end = useRange ? parsedRange.end : signedYear

  const values: Record<string, string> = {
    ...base,
    value: toInputValue(asset.value),
    market_value: toInputValue(asset.market_value ?? asset.currentValue),
    purchase_price: toInputValue(asset.purchase_price ?? asset.acquisitionPrice),
    purchase_year: toInputValue(asset.purchase_year ?? asset.acquisitionYear),
    numismatica_type: asset.numismatica_type === 'medalla' ? 'medalla' : 'moneda',
    medal_motive: asset.medal_motive || '',
    medal_year: asset.numismatica_type === 'medalla' && signedYear !== undefined ? String(signedYear) : '',
    medal_size_mm: toInputValue(asset.medal_size_mm),
    acquisition_operation: asset.acquisition_operation || '',
    medal_location: asset.medal_location || '',
    obverse_info: asset.obverse_info || '',
    reverse_info: asset.reverse_info || '',
    era: asset.era || '',
    creation_year_range: rangeText,
    reference_book: asset.reference_book || '',
    reference_book_value: toInputValue(asset.reference_book_value),
    empire_reign: asset.empire_reign || '',
    ruler: asset.ruler || '',
    mint: asset.mint || '',
    manufacturing_place: asset.manufacturing_place || '',
    case_location: asset.case_location || '',
    case_number: asset.case_number || '',
    denomination: asset.denomination || '',
    material: asset.material || '',
    conservationState: asset.conservationState || '',
    added_date: asset.added_date || toDateInput(asset.createdAt),
    year_mode: useRange ? 'range' : 'single',
    year_value: !useRange && signedYear !== undefined ? String(Math.abs(signedYear)) : '',
    year_era: signedYear !== undefined && signedYear < 0 ? 'bc' : 'ad',
    range_start: useRange && start !== undefined ? String(Math.abs(start)) : '',
    range_end: useRange && end !== undefined ? String(Math.abs(end)) : '',
    range_start_era: useRange && start !== undefined && start < 0 ? 'bc' : 'ad',
    range_end_era: useRange && end !== undefined && end < 0 ? 'bc' : 'ad',
    range_legacy_text: useRange && !hasParsedRange ? rangeText : '',
  }

  const generated = values.numismatica_type === 'medalla'
    ? buildMedalName(values.medal_motive)
    : buildCoinName({
      denomination: values.denomination,
      ruler: values.ruler,
      material: values.material,
      yearLabel: getYearLabelFromValues(values),
    })
  if (values.numismatica_type === 'medalla') {
    values.medal_name_override = asset.name && asset.name !== generated ? asset.name : ''
  } else {
    values.name_override = asset.name && asset.name !== generated ? asset.name : ''
  }
  return values
}

const YEAR_FIELDS = new Set([
  'year_mode', 'year_value', 'year_era', 'range_start', 'range_end', 'range_start_era', 'range_end_era',
])

export default function AssetModal({
  isOpen,
  assetToEdit,
  existingTags = [],
  owners,
  defaultOwner,
  defaultCategory = 'objetos',
  storageUsedBytes,
  storageFreeBytes,
  numismaticaSuggestions,
  onClose,
  onSaved,
}: AssetModalProps) {
  const [name, setName] = useState('')
  const [owner, setOwner] = useState('')
  const [category, setCategory] = useState<AssetCategory>(defaultCategory)
  const [year, setYear] = useState('')
  const [placeOfOrigin, setPlaceOfOrigin] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [currentValue, setCurrentValue] = useState('')
  const [acquisitionPrice, setAcquisitionPrice] = useState('')
  const [notes, setNotes] = useState('')
  const [photos, setPhotos] = useState<string[]>([])
  const [numismaticaData, setNumismaticaData] = useState<Record<string, string>>(emptyNumismaticaData)
  const [eraTouched, setEraTouched] = useState(false)
  const [rulerTouched, setRulerTouched] = useState(false)
  const [isCompressing, setIsCompressing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [compressStatus, setCompressStatus] = useState('')

  const isNumismatica = category === 'numismatica'
  const isMedal = isNumismatica && numismaticaData.numismatica_type === 'medalla'
  const tagSuggestions = useMemo(() => Array.from(new Set([...QUICK_TAGS, ...existingTags])).filter((tag) => tag.trim()), [existingTags])
  const detectedEra = useMemo(() => (year ? getHistoricalEraFromYear(Number(year)) : undefined), [year])

  const coinYearLabel = useMemo(() => getYearLabelFromValues(numismaticaData), [numismaticaData])
  const generatedCoinName = useMemo(() => buildCoinName({
    denomination: numismaticaData.denomination,
    ruler: numismaticaData.ruler,
    material: numismaticaData.material,
    yearLabel: coinYearLabel,
  }), [numismaticaData.denomination, numismaticaData.ruler, numismaticaData.material, coinYearLabel])
  const generatedMedalName = useMemo(() => buildMedalName(numismaticaData.medal_motive), [numismaticaData.medal_motive])
  const activeNameOverride = isMedal ? numismaticaData.medal_name_override : numismaticaData.name_override
  const effectiveName = isNumismatica
    ? (activeNameOverride?.trim() || (isMedal ? generatedMedalName : generatedCoinName))
    : name

  useEffect(() => {
    if (!isOpen) return

    setTagInput('')
    setErrorMsg('')
    setCompressStatus('')
    setEraTouched(Boolean(assetToEdit?.era))
    setRulerTouched(Boolean(assetToEdit?.ruler))

    if (!assetToEdit) {
      setName('')
      setOwner('')
      setCategory(defaultCategory)
      setYear('')
      setPlaceOfOrigin('')
      setTags([])
      setCurrentValue('')
      setAcquisitionPrice('')
      setNotes('')
      setPhotos([])
      setNumismaticaData({ ...emptyNumismaticaData(), added_date: new Date().toISOString().slice(0, 10) })
      return
    }

    const legacyTags = [assetToEdit.brandOrAuthor, assetToEdit.material, assetToEdit.historicalEra, assetToEdit.country, assetToEdit.ruler, assetToEdit.mint, assetToEdit.denomination, assetToEdit.conservationState]
      .filter((tag): tag is string => Boolean(tag?.trim()))

    setName(assetToEdit.name)
    setOwner(assetToEdit.owner || '')
    setCategory(assetToEdit.category || defaultCategory)
    setYear(toInputValue(assetToEdit.year))
    setPlaceOfOrigin(assetToEdit.placeOfOrigin || assetToEdit.country || '')
    setTags(Array.from(new Set([...(assetToEdit.tags ?? []), ...legacyTags])))
    setCurrentValue(toInputValue(assetToEdit.currentValue))
    setAcquisitionPrice(toInputValue(assetToEdit.acquisitionPrice))
    setNotes(assetToEdit.notes || '')
    setPhotos(assetToEdit.photos || [])
    setNumismaticaData(buildNumismaticaData(assetToEdit))
  }, [assetToEdit, defaultCategory, isOpen])

  if (!isOpen) return null

  const addTag = (raw: string) => {
    const value = raw.trim().replace(/[,;]+$/, '').trim()
    if (value && !tags.some((tag) => tag.toLocaleLowerCase() === value.toLocaleLowerCase())) {
      setTags((current) => [...current, value])
    }
    setTagInput('')
  }

  const handleNumismaticaChange = (field: string, value: string) => {
    const next = { ...numismaticaData, [field]: value }

    if (field === 'numismatica_type') {
      setNumismaticaData(next)
      return
    }
    if (field === 'era') {
      setEraTouched(true)
      setNumismaticaData(next)
      return
    }
    if (field === 'ruler' || field === 'empire_reign') {
      setRulerTouched(true)
      setNumismaticaData(next)
      return
    }
    if (YEAR_FIELDS.has(field) && next.numismatica_type !== 'medalla') {
      const midpoint = getMidpointYearFromValues(next)
      if (!eraTouched) {
        const era = getEraFromYear(midpoint)
        if (era) next.era = era
      }
      if (!rulerTouched) {
        const suggestion = getRulerSuggestion(midpoint)
        if (suggestion) {
          next.ruler = suggestion.ruler
          next.empire_reign = suggestion.empire
        }
      }
    }
    setNumismaticaData(next)
  }

  const handleAutoFill = () => {
    const midpoint = getMidpointYearFromValues(numismaticaData)
    const era = getEraFromYear(midpoint)
    const suggestion = getRulerSuggestion(midpoint)
    setNumismaticaData((current) => ({
      ...current,
      era: era ?? current.era,
      ruler: suggestion?.ruler ?? current.ruler,
      empire_reign: suggestion?.empire ?? current.empire_reign,
    }))
    setEraTouched(false)
    setRulerTouched(false)
  }

  const handlePhotoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files?.length) return
    setIsCompressing(true)
    setCompressStatus('Comprimiendo imágenes a WebP…')
    try {
      const results = []
      for (const file of Array.from(event.target.files)) {
        results.push(await compressImageToWebP(file, 1280, 0.8))
      }
      const uploaded = results.map((result) => result.base64)
      const compressedKB = results.reduce((total, result) => total + result.compressedSizeKB, 0)
      setPhotos((current) => [...current, ...uploaded])
      setCompressStatus(`${uploaded.length} foto(s) comprimidas: ${compressedKB} KiB en total. Se subirán a Storage al guardar.`)
    } catch (error) {
      setErrorMsg(`No se pudo procesar la imagen: ${error instanceof Error ? error.message : 'Error desconocido'}`)
    } finally {
      setIsCompressing(false)
      event.target.value = ''
    }
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()

    if (isNumismatica && isMedal && !numismaticaData.medal_motive.trim() && !numismaticaData.medal_name_override.trim()) {
      setErrorMsg('Indica el motivo de la medalla o escribe un nombre personalizado.')
      return
    }
    if (isNumismatica && !isMedal && !numismaticaData.denomination.trim() && !numismaticaData.name_override.trim()) {
      setErrorMsg('Indica la denominación de la moneda (denario, 8 reales, peseta…) o escribe un nombre personalizado.')
      return
    }
    if (!isNumismatica && !name.trim()) {
      setErrorMsg('Escribe el nombre del bien.')
      return
    }

    setIsLoading(true)
    setErrorMsg('')
    const num = numismaticaData
    const isMedalAsset = isNumismatica && num.numismatica_type === 'medalla'
    const yearNumber = parseNumber(year)
    const tagsList = Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean)))
    const marketValue = parseNumber(num.market_value)
    const nominalValue = parseNumber(num.value)
    const purchasePrice = parseNumber(num.purchase_price)
    const medalYear = parseNumber(num.medal_year)
    const medalSize = parseNumber(num.medal_size_mm)
    const rangeMode = num.year_mode === 'range'
    const coinPrimaryYear = getPrimaryYearFromValues(num) ?? assetToEdit?.year
    const coinMidpointYear = getMidpointYearFromValues(num) ?? assetToEdit?.year
    const coinRangeLabel = getYearLabelFromValues(num)
    const coinName = (num.name_override?.trim() || buildCoinName({
      denomination: num.denomination,
      ruler: num.ruler,
      material: num.material,
      yearLabel: coinRangeLabel,
    })).trim()
    const medalName = (num.medal_name_override?.trim() || buildMedalName(num.medal_motive)).trim()
    const origin = isMedalAsset
      ? ''
      : isNumismatica
        ? (num.mint.trim() || assetToEdit?.placeOfOrigin || assetToEdit?.country || '')
        : placeOfOrigin.trim()
    const creationYearRange = isMedalAsset
      ? undefined
      : isNumismatica
        ? rangeMode
          ? (coinRangeLabel || num.range_legacy_text || assetToEdit?.creation_year_range || '')
          : ''
        : (assetToEdit?.creation_year_range ?? '')
    const historicalEra = isMedalAsset
      ? ''
      : isNumismatica
        ? (num.era.trim() || getEraFromYear(coinMidpointYear) || getHistoricalEraFromYear(coinPrimaryYear) || assetToEdit?.historicalEra || '')
        : (getHistoricalEraFromYear(yearNumber) || assetToEdit?.historicalEra || '')

    const payload: Omit<AssetItem, 'id' | 'createdAt' | 'updatedAt'> = {
      name: isNumismatica ? (isMedalAsset ? medalName : coinName) : name.trim(),
      owner: resolveOwnerName(owner, owners, defaultOwner),
      category: isNumismatica ? 'numismatica' : category,
      tags: isNumismatica ? [] : tagsList,
      description: assetToEdit?.description ?? '',
      brandOrAuthor: assetToEdit?.brandOrAuthor ?? '',
      year: isNumismatica ? (isMedalAsset ? medalYear : coinPrimaryYear) : yearNumber,
      historicalEra,
      country: isMedalAsset ? '' : (origin || assetToEdit?.country || ''),
      placeOfOrigin: isMedalAsset ? '' : (origin || assetToEdit?.placeOfOrigin || ''),
      ruler: isMedalAsset ? undefined : isNumismatica ? num.ruler.trim() : (assetToEdit?.ruler ?? ''),
      mint: isMedalAsset ? undefined : isNumismatica ? num.mint.trim() : (assetToEdit?.mint ?? ''),
      denomination: isMedalAsset ? undefined : isNumismatica ? num.denomination.trim() : (assetToEdit?.denomination ?? ''),
      conservationState: isMedalAsset ? undefined : isNumismatica ? num.conservationState.trim() : (assetToEdit?.conservationState ?? ''),
      material: isNumismatica ? num.material.trim() : (assetToEdit?.material ?? deriveMaterial(tagsList)),
      acquisitionYear: isMedalAsset ? undefined : isNumismatica ? parseNumber(num.purchase_year) : assetToEdit?.acquisitionYear,
      acquisitionPrice: isNumismatica ? (purchasePrice ?? assetToEdit?.acquisitionPrice) : parseNumber(acquisitionPrice),
      currentValue: isMedalAsset
        ? undefined
        : isNumismatica
          ? (marketValue ?? nominalValue ?? assetToEdit?.currentValue)
          : parseNumber(currentValue),
      notes: notes.trim(),
      photos,
      photoSizesBytes: assetToEdit?.photoSizesBytes ?? [],

      // Numismática fields (kept in the same Firestore document as generic assets)
      numismatica_type: isNumismatica ? (isMedalAsset ? 'medalla' : 'moneda') : undefined,
      medal_motive: isMedalAsset ? num.medal_motive.trim() : undefined,
      medal_size_mm: isMedalAsset ? medalSize : undefined,
      acquisition_operation: isMedalAsset ? num.acquisition_operation.trim() : undefined,
      medal_location: isMedalAsset ? num.medal_location.trim() : undefined,
      value: isMedalAsset ? undefined : isNumismatica ? nominalValue : assetToEdit?.value,
      market_value: isMedalAsset ? undefined : isNumismatica ? marketValue : assetToEdit?.market_value,
      purchase_price: isNumismatica ? purchasePrice : assetToEdit?.purchase_price,
      purchase_year: isMedalAsset ? undefined : isNumismatica ? parseNumber(num.purchase_year) : assetToEdit?.purchase_year,
      obverse_info: isNumismatica ? num.obverse_info.trim() : (assetToEdit?.obverse_info ?? ''),
      reverse_info: isNumismatica ? num.reverse_info.trim() : (assetToEdit?.reverse_info ?? ''),
      era: isMedalAsset ? undefined : isNumismatica ? num.era.trim() : (assetToEdit?.era ?? ''),
      creation_year_range: creationYearRange,
      reference_book: isMedalAsset ? undefined : isNumismatica ? num.reference_book.trim() : (assetToEdit?.reference_book ?? ''),
      reference_book_value: isMedalAsset ? undefined : isNumismatica ? parseNumber(num.reference_book_value) : assetToEdit?.reference_book_value,
      empire_reign: isMedalAsset ? undefined : isNumismatica ? num.empire_reign.trim() : (assetToEdit?.empire_reign ?? ''),
      manufacturing_place: isMedalAsset ? undefined : isNumismatica ? num.manufacturing_place.trim() : (assetToEdit?.manufacturing_place ?? ''),
      case_location: isMedalAsset ? undefined : isNumismatica ? num.case_location.trim() : (assetToEdit?.case_location ?? ''),
      case_number: isMedalAsset ? undefined : isNumismatica ? num.case_number.trim() : (assetToEdit?.case_number ?? ''),
      added_date: isNumismatica
        ? (num.added_date || assetToEdit?.added_date || toDateInput(assetToEdit?.createdAt) || new Date().toISOString().slice(0, 10))
        : assetToEdit?.added_date,
    }

    try {
      if (assetToEdit) {
        await updateAsset(assetToEdit.id, payload, assetToEdit.photos ?? [], assetToEdit.photoSizesBytes ?? [])
      } else {
        await createAsset(payload)
      }
      if (onSaved) onSaved(category)
      else onClose()
    } catch (error) {
      setErrorMsg(`No se pudo guardar: ${error instanceof Error ? error.message : 'Error desconocido'}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/75 p-3 backdrop-blur-sm sm:p-6">
      <div className="my-auto max-h-[95vh] w-full max-w-6xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl sm:p-7" role="dialog" aria-modal="true" aria-labelledby="asset-modal-title">
        <div className="mb-5 flex items-start justify-between gap-3 border-b border-slate-700 pb-4">
          <div>
            <h2 id="asset-modal-title" className="text-xl font-semibold text-slate-100">
              {assetToEdit
                ? `Editar ${assetToEdit.name}`
                : isNumismatica
                  ? (isMedal ? 'Añadir medalla' : 'Añadir moneda')
                  : 'Añadir bien'}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              {isNumismatica
                ? (isMedal
                  ? 'Ficha simplificada de medalla: motivo, año, material, tamaño, anverso/reverso y adquisición.'
                  : 'Ficha especial de numismática: los datos genéricos del bien se rellenan solos.')
                : 'Una ficha común para arte y objetos diversos; usa etiquetas y campos reutilizables para sus características.'}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white">✕</button>
        </div>

        {errorMsg && <p role="alert" className="mb-4 rounded-xl border border-red-900 bg-red-950/50 p-3 text-sm text-red-300">{errorMsg}</p>}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <div className="space-y-5 lg:col-start-1 lg:row-start-1">
            {!isNumismatica && (
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Nombre *</label>
                <input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. Ordenador portátil Dell XPS, cuadro al óleo…" className={inputClass} />
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Categoría</label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {ASSET_CATEGORIES.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setCategory(item.value)}
                    className={`rounded-xl border px-3 py-2.5 text-left text-sm transition ${category === item.value ? 'border-teal-500 bg-teal-950/50 text-teal-200' : 'border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500'}`}
                  >
                    <span className="mr-2">{item.icon}</span>{item.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Propietario</label>
              <input list="asset-owner-suggestions" value={owner} onChange={(event) => setOwner(event.target.value)} placeholder={defaultOwner} className={inputClass} />
              <datalist id="asset-owner-suggestions">{owners.map((item) => <option key={item} value={item} />)}</datalist>
              <p className="mt-1 text-[11px] text-slate-500">Elige un propietario existente o escribe uno nuevo. Si lo dejas vacío se usará {defaultOwner}.</p>
            </div>

            {!isNumismatica && (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Año</label>
                    <input type="number" value={year} onChange={(event) => setYear(event.target.value)} placeholder="Año de fabricación, creación o emisión" className={inputClass} />
                    {detectedEra && <p className="mt-1.5 text-xs text-teal-300">Época calculada: {detectedEra}</p>}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Lugar de origen</label>
                    <input value={placeOfOrigin} onChange={(event) => setPlaceOfOrigin(event.target.value)} placeholder="País, región o lugar" className={inputClass} />
                  </div>
                </div>

                <section className="rounded-xl border border-slate-700 bg-slate-950/70 p-4">
                  <div className="mb-2">
                    <h3 className="text-sm font-semibold text-slate-200">Etiquetas</h3>
                    <p className="mt-0.5 text-xs text-slate-400">Elige una sugerencia frecuente o escribe y pulsa Enter. Se guardan en una lista común para autocompletar futuros bienes.</p>
                  </div>
                  <div className="flex gap-2">
                    <input
                      list="asset-tag-suggestions"
                      value={tagInput}
                      onChange={(event) => setTagInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ',') {
                          event.preventDefault()
                          addTag(tagInput)
                        }
                      }}
                      placeholder="Material, época, autor, marca…"
                      className={inputClass}
                    />
                    <datalist id="asset-tag-suggestions">{tagSuggestions.map((tag) => <option key={tag} value={tag} />)}</datalist>
                    <button type="button" onClick={() => addTag(tagInput)} className="shrink-0 rounded-xl bg-teal-700 px-4 text-sm font-medium text-white hover:bg-teal-600">Añadir</button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {QUICK_TAGS.map((tag) => (
                      <button key={tag} type="button" onClick={() => addTag(tag)} disabled={tags.includes(tag)} className="rounded-full border border-slate-700 px-2.5 py-1 text-[11px] text-slate-300 hover:border-teal-600 hover:text-teal-200 disabled:opacity-35">{tag}</button>
                    ))}
                  </div>
                  {tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {tags.map((tag) => (
                        <span key={tag} className="inline-flex items-center gap-1 rounded-full border border-teal-800 bg-teal-950/70 px-3 py-1 text-xs text-teal-200">
                          {tag}
                          <button type="button" aria-label={`Quitar ${tag}`} onClick={() => setTags((current) => current.filter((item) => item !== tag))} className="ml-1 text-teal-400 hover:text-white">×</button>
                        </span>
                      ))}
                    </div>
                  )}
                </section>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Valor estimado (€)</label>
                    <input type="number" min="0" step="0.01" value={currentValue} onChange={(event) => setCurrentValue(event.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Precio de adquisición (€)</label>
                    <input type="number" min="0" step="0.01" value={acquisitionPrice} onChange={(event) => setAcquisitionPrice(event.target.value)} className={inputClass} />
                  </div>
                </div>
              </>
            )}

            {isNumismatica && (
              <NumismaticaFields
                values={numismaticaData}
                onChange={handleNumismaticaChange}
                suggestions={numismaticaSuggestions}
                namePreview={effectiveName}
                onAutoFill={handleAutoFill}
              />
            )}
          </div>

          <aside className="space-y-3 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
            <div className="flex items-center justify-between gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400">Fotografías {isNumismatica && <span className="normal-case text-slate-500">(opcional)</span>}</label>
                <p className="mt-1 text-[11px] text-slate-500">La primera imagen es la principal.</p>
                <p className="mt-1 text-[10px] text-slate-500">Fotos guardadas: {formatStorageBytes(storageUsedBytes)} · margen estimado: {formatStorageBytes(storageFreeBytes)}</p>
              </div>
              <label className="cursor-pointer rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-200 hover:border-teal-600">
                {isCompressing ? 'Comprimiendo…' : 'Añadir fotos'}
                <input type="file" accept="image/*" multiple onChange={handlePhotoUpload} disabled={isCompressing} className="hidden" />
              </label>
            </div>
            <div className={`flex items-center justify-center overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 ${isNumismatica ? 'aspect-square w-32' : 'aspect-[4/3]'}`}>
              {photos[0] ? <PrivateStorageImage source={photos[0]} alt={effectiveName || 'Vista principal del bien'} className="h-full w-full object-contain" /> : <div className={`${isNumismatica ? 'text-3xl' : 'text-6xl'} text-slate-700`}>▧</div>}
            </div>
            {compressStatus && <p className="text-xs text-teal-300">{compressStatus}</p>}
            {photos.length > 0 && (
              <div className="grid grid-cols-4 gap-2">
                {photos.map((photo, index) => (
                  <div key={`${index}-${photo.slice(0, 24)}`} className={`relative aspect-square overflow-hidden rounded-lg border ${index === 0 ? 'border-emerald-500 ring-1 ring-emerald-500/40' : 'border-slate-700'}`}>
                    <PrivateStorageImage source={photo} alt={`Foto ${index + 1}`} className="h-full w-full object-cover" />
                    <button type="button" onClick={() => setPhotos((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Eliminar foto ${index + 1}`} className="absolute right-1 top-1 rounded-full bg-black/75 px-2 text-white">×</button>
                    {index === 0 && <span className="absolute bottom-1 left-1 rounded bg-emerald-950/90 px-1.5 py-0.5 text-[9px] text-emerald-200">Principal</span>}
                  </div>
                ))}
              </div>
            )}
          </aside>

          <div className="lg:col-start-1 lg:row-start-2">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Comentarios / notas</label>
            <textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} className={inputClass} />
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-700 pt-4 lg:col-span-2">
            <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">Cancelar</button>
            <button type="submit" disabled={isLoading || isCompressing} className="rounded-xl bg-teal-700 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-50">
              {isLoading ? 'Guardando…' : isNumismatica ? (isMedal ? 'Guardar medalla' : 'Guardar moneda') : 'Guardar bien'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function formatStorageBytes(bytes: number) {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GiB`
  return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KiB` : `${(bytes / (1024 * 1024)).toFixed(1)} MiB`
}
