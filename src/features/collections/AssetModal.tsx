import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { AssetCategory, AssetItem } from '@/types'
import { createAsset, updateAsset } from './assetsService'
import { compressImageToWebP } from '@/utils/imageCompression'
import { getHistoricalEraFromYear } from '@/utils/historicalEras'
import { resolveOwnerName } from '@/utils/owners'
import PrivateStorageImage from '@/components/ui/PrivateStorageImage'
import { NumismaticaFields } from './NumismaticaFields'
import { ASSET_CATEGORIES } from './assetCategories'

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
    obverse_info: '',
    reverse_info: '',
    era: '',
    creation_year_range: '',
    reference_book: '',
    reference_book_value: '',
    coin_type: '',
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
  const [location, setLocation] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [currentValue, setCurrentValue] = useState('')
  const [acquisitionPrice, setAcquisitionPrice] = useState('')
  const [notes, setNotes] = useState('')
  const [photos, setPhotos] = useState<string[]>([])
  const [numismaticaData, setNumismaticaData] = useState<Record<string, string>>(emptyNumismaticaData)
  const [isCompressing, setIsCompressing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [compressStatus, setCompressStatus] = useState('')

  const tagSuggestions = useMemo(() => Array.from(new Set([...QUICK_TAGS, ...existingTags])).filter((tag) => tag.trim()), [existingTags])
  const detectedEra = useMemo(() => (year ? getHistoricalEraFromYear(Number(year)) : undefined), [year])

  useEffect(() => {
    if (!isOpen) return

    setTagInput('')
    setErrorMsg('')
    setCompressStatus('')

    if (!assetToEdit) {
      setName('')
      setOwner('')
      setCategory(defaultCategory)
      setYear('')
      setPlaceOfOrigin('')
      setLocation('')
      setTags([])
      setCurrentValue('')
      setAcquisitionPrice('')
      setNotes('')
      setPhotos([])
      setNumismaticaData(emptyNumismaticaData())
      return
    }

    const legacyTags = [assetToEdit.brandOrAuthor, assetToEdit.material, assetToEdit.historicalEra, assetToEdit.country, assetToEdit.ruler, assetToEdit.mint, assetToEdit.denomination, assetToEdit.conservationState]
      .filter((tag): tag is string => Boolean(tag?.trim()))
    const isNumismatica = assetToEdit.category === 'numismatica'

    setName(assetToEdit.name)
    setOwner(assetToEdit.owner || '')
    setCategory(assetToEdit.category || defaultCategory)
    setYear(toInputValue(assetToEdit.year))
    setPlaceOfOrigin(assetToEdit.placeOfOrigin || assetToEdit.country || '')
    setLocation(assetToEdit.location || '')
    setTags(Array.from(new Set([...(assetToEdit.tags ?? []), ...legacyTags])))
    setCurrentValue(toInputValue(assetToEdit.currentValue))
    setAcquisitionPrice(toInputValue(assetToEdit.acquisitionPrice))
    setNotes(assetToEdit.notes || '')
    setPhotos(assetToEdit.photos || [])

    setNumismaticaData({
      ...emptyNumismaticaData(),
      value: toInputValue(assetToEdit.value),
      market_value: toInputValue(assetToEdit.market_value ?? (isNumismatica ? assetToEdit.currentValue : undefined)),
      purchase_price: toInputValue(assetToEdit.purchase_price ?? (isNumismatica ? assetToEdit.acquisitionPrice : undefined)),
      purchase_year: toInputValue(assetToEdit.purchase_year ?? (isNumismatica ? assetToEdit.acquisitionYear : undefined)),
      obverse_info: assetToEdit.obverse_info || '',
      reverse_info: assetToEdit.reverse_info || '',
      era: assetToEdit.era || '',
      creation_year_range: assetToEdit.creation_year_range || '',
      reference_book: assetToEdit.reference_book || '',
      reference_book_value: toInputValue(assetToEdit.reference_book_value),
      coin_type: assetToEdit.coin_type || '',
      empire_reign: assetToEdit.empire_reign || '',
      ruler: assetToEdit.ruler || '',
      mint: assetToEdit.mint || '',
      manufacturing_place: assetToEdit.manufacturing_place || '',
      case_location: assetToEdit.case_location || '',
      case_number: assetToEdit.case_number || '',
      denomination: assetToEdit.denomination || '',
      material: assetToEdit.material || '',
      conservationState: assetToEdit.conservationState || '',
      added_date: assetToEdit.added_date || toDateInput(assetToEdit.createdAt),
    })
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
    setNumismaticaData((current) => ({ ...current, [field]: value }))
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
    if (!name.trim()) {
      setErrorMsg('Escribe el nombre o la denominación del bien.')
      return
    }

    setIsLoading(true)
    setErrorMsg('')
    const isNumismatica = category === 'numismatica'
    const num = numismaticaData
    const yearNumber = parseNumber(year)
    const tagsList = Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean)))
    const marketValue = parseNumber(num.market_value)
    const nominalValue = parseNumber(num.value)
    const purchasePrice = parseNumber(num.purchase_price)
    const historicalEra = isNumismatica
      ? (num.era.trim() || getHistoricalEraFromYear(yearNumber) || assetToEdit?.historicalEra || '')
      : (getHistoricalEraFromYear(yearNumber) || assetToEdit?.historicalEra || '')

    const payload: Omit<AssetItem, 'id' | 'createdAt' | 'updatedAt'> = {
      name: name.trim(),
      owner: resolveOwnerName(owner, owners, defaultOwner),
      category,
      tags: tagsList,
      location: location.trim(),
      description: assetToEdit?.description ?? '',
      brandOrAuthor: assetToEdit?.brandOrAuthor ?? '',
      year: yearNumber,
      historicalEra,
      country: placeOfOrigin.trim() || assetToEdit?.country || '',
      placeOfOrigin: placeOfOrigin.trim() || assetToEdit?.placeOfOrigin || '',
      ruler: isNumismatica ? num.ruler.trim() : (assetToEdit?.ruler ?? ''),
      mint: isNumismatica ? num.mint.trim() : (assetToEdit?.mint ?? ''),
      denomination: isNumismatica ? num.denomination.trim() : (assetToEdit?.denomination ?? ''),
      conservationState: isNumismatica ? num.conservationState.trim() : (assetToEdit?.conservationState ?? ''),
      material: isNumismatica ? num.material.trim() : (assetToEdit?.material ?? deriveMaterial(tagsList)),
      acquisitionYear: isNumismatica ? parseNumber(num.purchase_year) : assetToEdit?.acquisitionYear,
      acquisitionPrice: isNumismatica ? (purchasePrice ?? assetToEdit?.acquisitionPrice) : parseNumber(acquisitionPrice),
      currentValue: isNumismatica ? (marketValue ?? nominalValue ?? assetToEdit?.currentValue) : parseNumber(currentValue),
      notes: notes.trim(),
      photos,
      photoSizesBytes: assetToEdit?.photoSizesBytes ?? [],

      // Numismática fields
      value: nominalValue,
      market_value: marketValue,
      purchase_price: purchasePrice,
      purchase_year: parseNumber(num.purchase_year),
      obverse_info: num.obverse_info.trim(),
      reverse_info: num.reverse_info.trim(),
      era: isNumismatica ? num.era.trim() : (assetToEdit?.era ?? ''),
      creation_year_range: num.creation_year_range.trim(),
      reference_book: num.reference_book.trim(),
      reference_book_value: parseNumber(num.reference_book_value),
      coin_type: isNumismatica ? num.coin_type.trim() : (assetToEdit?.coin_type ?? ''),
      empire_reign: isNumismatica ? num.empire_reign.trim() : (assetToEdit?.empire_reign ?? ''),
      manufacturing_place: num.manufacturing_place.trim(),
      case_location: num.case_location.trim(),
      case_number: num.case_number.trim(),
      added_date: num.added_date || assetToEdit?.added_date || toDateInput(assetToEdit?.createdAt) || new Date().toISOString().slice(0, 10),
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
            <h2 id="asset-modal-title" className="text-xl font-semibold text-slate-100">{assetToEdit ? `Editar ${assetToEdit.name}` : 'Añadir bien'}</h2>
            <p className="mt-1 text-sm text-slate-400">Una ficha común para todos los objetos; usa etiquetas y campos reutilizables para sus características.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white">✕</button>
        </div>

        {errorMsg && <p role="alert" className="mb-4 rounded-xl border border-red-900 bg-red-950/50 p-3 text-sm text-red-300">{errorMsg}</p>}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <div className="space-y-5 lg:col-start-1 lg:row-start-1">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Nombre / Denominación *</label>
              <input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. Ordenador portátil Dell XPS o 8 reales de Carlos IV" className={inputClass} />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Categoría</label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
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

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Año</label>
                <input type="number" value={year} onChange={(event) => setYear(event.target.value)} placeholder="Año de fabricación, emisión o creación" className={inputClass} />
                {detectedEra && <p className="mt-1.5 text-xs text-teal-300">Época calculada: {detectedEra}</p>}
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Lugar de origen</label>
                <input value={placeOfOrigin} onChange={(event) => setPlaceOfOrigin(event.target.value)} placeholder="País, región o lugar" className={inputClass} />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Ubicación actual</label>
              <input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Despacho, vitrina, caja fuerte…" className={inputClass} />
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
                  placeholder="Material, época, gobernante, marca…"
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

            {category !== 'numismatica' && (
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
            )}

            {category === 'numismatica' && (
              <NumismaticaFields values={numismaticaData} onChange={handleNumismaticaChange} suggestions={numismaticaSuggestions} />
            )}
          </div>

          <aside className="space-y-3 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
            <div className="flex items-center justify-between gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400">Fotografías</label>
                <p className="mt-1 text-[11px] text-slate-500">La primera imagen es la principal.</p>
                <p className="mt-1 text-[10px] text-slate-500">Fotos guardadas: {formatStorageBytes(storageUsedBytes)} · margen estimado: {formatStorageBytes(storageFreeBytes)}</p>
              </div>
              <label className="cursor-pointer rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-200 hover:border-teal-600">
                {isCompressing ? 'Comprimiendo…' : 'Añadir fotos'}
                <input type="file" accept="image/*" multiple onChange={handlePhotoUpload} disabled={isCompressing} className="hidden" />
              </label>
            </div>
            <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-2xl border border-slate-700 bg-slate-950">
              {photos[0] ? <PrivateStorageImage source={photos[0]} alt={name || 'Vista principal del bien'} className="h-full w-full object-contain" /> : <div className="text-6xl text-slate-700">▧</div>}
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
              {isLoading ? 'Guardando…' : 'Guardar bien'}
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
