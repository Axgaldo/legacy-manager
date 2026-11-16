import React, { useEffect, useMemo, useState } from 'react'
import { AssetCategory, AssetItem } from '@/types'
import { createAsset, updateAsset } from './assetsService'
import { compressImageToWebP } from '@/utils/imageCompression'
import { getHistoricalEraFromYear } from '@/utils/historicalEras'
import { resolveOwnerName } from '@/utils/owners'
import PrivateStorageImage from '@/components/ui/PrivateStorageImage'

export const ASSET_CATEGORIES: { value: AssetCategory; label: string; icon: string }[] = [
  { value: 'coins', label: 'Monedas', icon: '🪙' }, { value: 'banknotes', label: 'Billetes', icon: '💶' },
  { value: 'watches', label: 'Relojes', icon: '⌚' }, { value: 'art', label: 'Arte y cuadros', icon: '🎨' },
  { value: 'antiques', label: 'Antigüedades', icon: '🏺' }, { value: 'furniture', label: 'Muebles', icon: '🪑' },
  { value: 'jewelry', label: 'Joyas', icon: '💎' }, { value: 'electronics', label: 'Electrónica', icon: '📺' },
  { value: 'computers', label: 'Informática', icon: '💻' }, { value: 'vehicles', label: 'Vehículos', icon: '🚗' },
  { value: 'books', label: 'Libros', icon: '📚' }, { value: 'stamps', label: 'Sellos', icon: '✉️' },
  { value: 'musical-instruments', label: 'Instrumentos musicales', icon: '🎸' }, { value: 'sports', label: 'Deporte', icon: '⚽' },
  { value: 'tools', label: 'Herramientas', icon: '🛠️' }, { value: 'documents', label: 'Documentos', icon: '📜' },
  { value: 'collectibles', label: 'Coleccionismo', icon: '🧸' }, { value: 'other', label: 'Otros', icon: '📦' },
]

const QUICK_TAGS = ['ORO', 'PLATA', 'COBRE', 'BRONCE', 'ACERO', 'MADERA', 'CUERO', 'PLÁSTICO', 'ÉPOCA ROMANA', 'EDAD MEDIA', 'SIGLO XVIII', 'SIGLO XIX', 'SIGLO XX', 'ESPAÑA', 'CARLOS IV', 'FELIPE II', 'TRAJANO', 'EXCELENTE', 'BUEN ESTADO']
const inputClass = 'w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20'

interface AssetModalProps {
  isOpen: boolean
  assetToEdit: AssetItem | null
  existingTags?: string[]
  owners: string[]
  defaultOwner: string
  storageUsedBytes: number
  storageFreeBytes: number
  onClose: () => void
  onSaved: () => void
}

export default function AssetModal({ isOpen, assetToEdit, existingTags = [], owners, defaultOwner, storageUsedBytes, storageFreeBytes, onClose, onSaved }: AssetModalProps) {
  const [name, setName] = useState('')
  const [owner, setOwner] = useState('')
  const [category, setCategory] = useState<AssetCategory>('other')
  const [year, setYear] = useState('')
  const [placeOfOrigin, setPlaceOfOrigin] = useState('')
  const [location, setLocation] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [currentValue, setCurrentValue] = useState('')
  const [acquisitionPrice, setAcquisitionPrice] = useState('')
  const [notes, setNotes] = useState('')
  const [photos, setPhotos] = useState<string[]>([])
  const [isCompressing, setIsCompressing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [compressStatus, setCompressStatus] = useState('')

  const tagSuggestions = useMemo(() => Array.from(new Set([...QUICK_TAGS, ...existingTags])).filter((tag) => tag.trim()), [existingTags])
  const detectedEra = useMemo(() => year ? getHistoricalEraFromYear(parseInt(year, 10)) : undefined, [year])

  useEffect(() => {
    if (!isOpen) return
    if (assetToEdit) {
      const legacyTags = [assetToEdit.brandOrAuthor, assetToEdit.material, assetToEdit.historicalEra, assetToEdit.country, assetToEdit.ruler, assetToEdit.mint, assetToEdit.denomination, assetToEdit.conservationState].filter((tag): tag is string => Boolean(tag?.trim()))
      setName(assetToEdit.name)
      setOwner(assetToEdit.owner || '')
      setCategory(assetToEdit.category || 'other')
      setYear(assetToEdit.year === undefined ? '' : String(assetToEdit.year))
      setPlaceOfOrigin(assetToEdit.placeOfOrigin || assetToEdit.country || '')
      setLocation(assetToEdit.location || '')
      setTags(Array.from(new Set([...(assetToEdit.tags ?? []), ...legacyTags])))
      setCurrentValue(assetToEdit.currentValue === undefined ? '' : String(assetToEdit.currentValue))
      setAcquisitionPrice(assetToEdit.acquisitionPrice === undefined ? '' : String(assetToEdit.acquisitionPrice))
      setNotes(assetToEdit.notes || '')
      setPhotos(assetToEdit.photos || [])
    } else {
      setName(''); setOwner(''); setCategory('other'); setYear(''); setPlaceOfOrigin(''); setLocation(''); setTags([]); setCurrentValue(''); setAcquisitionPrice(''); setNotes(''); setPhotos([])
    }
    setTagInput(''); setErrorMsg(''); setCompressStatus('')
  }, [assetToEdit, isOpen])

  if (!isOpen) return null

  const addTag = (raw: string) => {
    const value = raw.trim().replace(/[,;]+$/, '').trim()
    if (value && !tags.some((tag) => tag.toLocaleLowerCase() === value.toLocaleLowerCase())) setTags((current) => [...current, value])
    setTagInput('')
  }

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files?.length) return
    setIsCompressing(true); setCompressStatus('Comprimiendo imágenes a WebP…')
    try {
      const results = []
      for (const file of Array.from(event.target.files)) results.push(await compressImageToWebP(file, 1280, 0.8))
      const uploaded = results.map((result) => result.base64)
      const compressedKB = results.reduce((total, result) => total + result.compressedSizeKB, 0)
      setPhotos((current) => [...current, ...uploaded]); setCompressStatus(`${uploaded.length} foto(s) comprimidas: ${compressedKB} KiB en total. Se subirán a Storage al guardar.`)
    } catch (error) {
      setErrorMsg(`No se pudo procesar la imagen: ${error instanceof Error ? error.message : 'Error desconocido'}`)
    } finally { setIsCompressing(false); event.target.value = '' }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!name.trim()) { setErrorMsg('Escribe el nombre del bien.'); return }
    const allTags = Array.from(new Set(tags))
    setIsLoading(true); setErrorMsg('')
    const payload = {
      name: name.trim(), owner: resolveOwnerName(owner, owners, defaultOwner), category, tags: allTags,
      year: year ? Number(year) : undefined,
      historicalEra: detectedEra,
      placeOfOrigin: placeOfOrigin.trim() || undefined,
      country: placeOfOrigin.trim() || undefined,
      location: location.trim() || undefined,
      brandOrAuthor: '', ruler: '', mint: '', denomination: '', conservationState: '',
      material: allTags.find((tag) => ['ORO', 'PLATA', 'COBRE', 'BRONCE', 'ACERO', 'MADERA', 'CUERO'].includes(tag.toLocaleUpperCase())) ?? '',
      currentValue: currentValue ? Number(currentValue) : undefined,
      acquisitionPrice: acquisitionPrice ? Number(acquisitionPrice) : undefined,
      notes: notes.trim() || undefined, photos,
    }
    try {
      if (assetToEdit) await updateAsset(assetToEdit.id, payload, assetToEdit.photos ?? [], assetToEdit.photoSizesBytes ?? [])
      else await createAsset(payload)
      onSaved(); onClose()
    } catch (error) {
      setErrorMsg(`No se pudo guardar: ${error instanceof Error ? error.message : 'Error desconocido'}`)
    } finally { setIsLoading(false) }
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/75 p-3 backdrop-blur-sm sm:p-6">
    <div className="my-auto max-h-[95vh] w-full max-w-6xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl sm:p-7">
      <div className="mb-6 flex items-start justify-between border-b border-slate-700 pb-4">
        <div><h2 className="text-xl font-semibold text-slate-100">{assetToEdit ? `Editar ${assetToEdit.name}` : 'Añadir bien'}</h2><p className="mt-1 text-sm text-slate-400">Una ficha común para todos los objetos; usa etiquetas para sus características.</p></div>
        <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white">✕</button>
      </div>
      {errorMsg && <p className="mb-4 rounded-xl border border-red-900 bg-red-950/50 p-3 text-sm text-red-300">{errorMsg}</p>}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div className="space-y-5 lg:col-start-1 lg:row-start-1">
          <div><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Nombre *</label><input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. Ordenador portátil Dell XPS o 8 reales de Carlos IV" className={inputClass} /></div>
          <div><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Categoría</label><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{ASSET_CATEGORIES.map((item) => <button key={item.value} type="button" onClick={() => setCategory(item.value)} className={`rounded-xl border px-3 py-2.5 text-left text-sm transition ${category === item.value ? 'border-teal-500 bg-teal-950/50 text-teal-200' : 'border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500'}`}><span className="mr-2">{item.icon}</span>{item.label}</button>)}</div></div>
          <div><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Propietario</label><input list="asset-owner-suggestions" value={owner} onChange={(event) => setOwner(event.target.value)} placeholder={defaultOwner} className={inputClass} /><datalist id="asset-owner-suggestions">{owners.map((item) => <option key={item} value={item} />)}</datalist><p className="mt-1 text-[11px] text-slate-500">Elige un propietario existente o escribe uno nuevo. Si lo dejas vacío se usará {defaultOwner}.</p></div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><div><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Año</label><input type="number" value={year} onChange={(event) => setYear(event.target.value)} placeholder="Año de fabricación, emisión o creación" className={inputClass} />{detectedEra && <p className="mt-1.5 text-xs text-teal-300">Época calculada: {detectedEra}</p>}</div><div><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Lugar de origen</label><input value={placeOfOrigin} onChange={(event) => setPlaceOfOrigin(event.target.value)} placeholder="País, región o lugar" className={inputClass} /></div></div>
          <div><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Ubicación actual</label><input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Despacho, vitrina, caja fuerte…" className={inputClass} /></div>
          <section className="rounded-xl border border-slate-700 bg-slate-950/70 p-4"><div className="mb-2"><h3 className="text-sm font-semibold text-slate-200">Etiquetas</h3><p className="mt-0.5 text-xs text-slate-400">Elige una sugerencia frecuente o escribe y pulsa Enter. Se guardan en una lista común para autocompletar futuros bienes.</p></div><div className="flex gap-2"><input list="asset-tag-suggestions" value={tagInput} onChange={(event) => setTagInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ',') { event.preventDefault(); addTag(tagInput) } }} placeholder="Material, época, gobernante, marca…" className={inputClass} /><datalist id="asset-tag-suggestions">{tagSuggestions.map((tag) => <option key={tag} value={tag} />)}</datalist><button type="button" onClick={() => addTag(tagInput)} className="shrink-0 rounded-xl bg-teal-700 px-4 text-sm font-medium text-white hover:bg-teal-600">Añadir</button></div><div className="mt-3 flex flex-wrap gap-1.5">{QUICK_TAGS.map((tag) => <button key={tag} type="button" onClick={() => addTag(tag)} disabled={tags.includes(tag)} className="rounded-full border border-slate-700 px-2.5 py-1 text-[11px] text-slate-300 hover:border-teal-600 hover:text-teal-200 disabled:opacity-35">{tag}</button>)}</div>{tags.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{tags.map((tag) => <span key={tag} className="inline-flex items-center gap-1 rounded-full border border-teal-800 bg-teal-950/70 px-3 py-1 text-xs text-teal-200">{tag}<button type="button" aria-label={`Quitar ${tag}`} onClick={() => setTags((current) => current.filter((item) => item !== tag))} className="ml-1 text-teal-400 hover:text-white">×</button></span>)}</div>}</section>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><div><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Valor estimado (€)</label><input type="number" min="0" step="0.01" value={currentValue} onChange={(event) => setCurrentValue(event.target.value)} className={inputClass} /></div><div><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Precio de adquisición (€)</label><input type="number" min="0" step="0.01" value={acquisitionPrice} onChange={(event) => setAcquisitionPrice(event.target.value)} className={inputClass} /></div></div>
        </div>

        <aside className="space-y-3 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
          <div className="flex items-center justify-between gap-3"><div><label className="block text-xs font-semibold uppercase tracking-wide text-slate-400">Fotografías</label><p className="mt-1 text-[11px] text-slate-500">La primera imagen es la principal.</p><p className="mt-1 text-[10px] text-slate-500">Fotos guardadas: {formatStorageBytes(storageUsedBytes)} · margen estimado: {formatStorageBytes(storageFreeBytes)}</p></div><label className="cursor-pointer rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-200 hover:border-teal-600">{isCompressing ? 'Comprimiendo…' : 'Añadir fotos'}<input type="file" accept="image/*" multiple onChange={handlePhotoUpload} disabled={isCompressing} className="hidden" /></label></div>
          <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-2xl border border-slate-700 bg-slate-950">{photos[0] ? <PrivateStorageImage source={photos[0]} alt={name || 'Vista principal del bien'} className="h-full w-full object-contain" /> : <div className="text-6xl text-slate-700">▧</div>}</div>
          {compressStatus && <p className="text-xs text-teal-300">{compressStatus}</p>}
          {photos.length > 0 && <div className="grid grid-cols-4 gap-2">{photos.map((photo, index) => <div key={`${index}-${photo.slice(0, 24)}`} className={`relative aspect-square overflow-hidden rounded-lg border ${index === 0 ? 'border-emerald-500 ring-1 ring-emerald-500/40' : 'border-slate-700'}`}><PrivateStorageImage source={photo} alt={`Foto ${index + 1}`} className="h-full w-full object-cover" /><button type="button" onClick={() => setPhotos((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Eliminar foto ${index + 1}`} className="absolute right-1 top-1 rounded-full bg-black/75 px-2 text-white">×</button>{index === 0 && <span className="absolute bottom-1 left-1 rounded bg-emerald-950/90 px-1.5 py-0.5 text-[9px] text-emerald-200">Principal</span>}</div>)}</div>}
        </aside>

        <div className="lg:col-start-1 lg:row-start-2"><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Notas</label><textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} className={inputClass} /></div>
        <div className="flex justify-end gap-3 border-t border-slate-700 pt-4 lg:col-span-2"><button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">Cancelar</button><button disabled={isLoading || isCompressing} className="rounded-xl bg-teal-700 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-50">{isLoading ? 'Guardando…' : 'Guardar bien'}</button></div>
      </form>
    </div>
  </div>
}

function formatStorageBytes(bytes: number) {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GiB`
  return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KiB` : `${(bytes / (1024 * 1024)).toFixed(1)} MiB`
}
