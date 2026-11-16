import React, { useEffect, useMemo, useState } from 'react'
import { AssetCategory, AssetItem } from '@/types'
import { createAsset, updateAsset } from './assetsService'
import { compressImageToWebP } from '@/utils/imageCompression'
import { getHistoricalEraFromYear } from '@/utils/historicalEras'
import { resolveOwnerName } from '@/utils/owners'
import PrivateStorageImage from '@/components/ui/PrivateStorageImage'
import { NumismaticaFields } from './NumismaticaFields'
 
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
 
// Numism�tica Defaults
export const NUMISMATICA_DEFAULTS: Record<string, string[]> = {
  conservationState: ['Excelente', 'Buen estado', 'Regular', 'Da�ado', 'Desgastado'],
  coin_type: ['Moneda', 'Medalla', 'Token', 'Ficha'],
  era: ['Romana', 'Medieval', 'Moderna', 'Contempor�nea', 'Pre-Colonial'],
  reference_book: ['Standard Catalog of World Coins', 'Krause', 'Moneda Espa�ola'],
}
 
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
 
  // Numism�tica Fields
  const [numismaticaData, setNumismaticaData] = useState<Record<string, string>>({
    value: '',
    market_value: '',
    purchase_year: '',
    obverse_info: '',
    reverse_info: '',
    era: '',
    creation_year_range: '',
    reference_book: '',
    reference_book_value: '',
    coin_type: '',
    empire_reign: '',
    manufacturing_place: '',
    case_location: '',
    case_number: '',
  })
 
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
 
      // Populate Numism�tica Fields
      setNumismaticaData({
        value: assetToEdit.value === undefined ? '' : String(assetToEdit.value),
        market_value: assetToEdit.market_value === undefined ? '' : String(assetToEdit.market_value),
        purchase_year: assetToEdit.purchase_year === undefined ? '' : String(assetToEdit.purchase_year),
        obverse_info: assetToEdit.obverse_info || '',
        reverse_info: assetToEdit.reverse_info || '',
        era: assetToEdit.era || '',
        creation_year_range: assetToEdit.creation_year_range || '',
        reference_book: assetToEdit.reference_book || '',
        reference_book_value: assetToEdit.reference_book_value === undefined ? '' : String(assetToEdit.reference_book_value),
        coin_type: assetToEdit.coin_type || '',
        empire_reign: assetToEdit.empire_reign || '',
        manufacturing_place: assetToEdit.manufacturing_place || '',
        case_location: assetToEdit.case_location || '',
        case_number: assetToEdit.case_number || '',
      })
    } else {
      setName(''); setOwner(''); setCategory('other'); setYear(''); setPlaceOfOrigin(''); setLocation(''); setTags([]); setCurrentValue(''); setAcquisitionPrice(''); setNotes(''); setPhotos([])
      setNumismaticaData({
        value: '',
        market_value: '',
        purchase_year: '',
        obverse_info: '',
        reverse_info: '',
        era: '',
        creation_year_range: '',
        reference_book: '',
        reference_book_value: '',
        coin_type: '',
        empire_reign: '',
        manufacturing_place: '',
        case_location: '',
        case_number: '',
      })
    }
    setTagInput(''); setErrorMsg(''); setCompre�6900 chars truncated�g(tagInput) } }} placeholder="Material, época, gobernante, marca…" className={inputClass} /><datalist id="asset-tag-suggestions">{tagSuggestions.map((tag) => <option key={tag} value={tag} />)}</datalist><button type="button" onClick={() => addTag(tagInput)} className="shrink-0 rounded-xl bg-teal-700 px-4 text-sm font-medium text-white hover:bg-teal-600">Añadir</button></div><div className="mt-3 flex flex-wrap gap-1.5">{QUICK_TAGS.map((tag) => <button key={tag} type="button" onClick={() => addTag(tag)} disabled={tags.includes(tag)} className="rounded-full border border-slate-700 px-2.5 py-1 text-[11px] text-slate-300 hover:border-teal-600 hover:text-teal-200 disabled:opacity-35">{tag}</button>)}</div>{tags.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{tags.map((tag) => <span key={tag} className="inline-flex items-center gap-1 rounded-full border border-teal-800 bg-teal-950/70 px-3 py-1 text-xs text-teal-200">{tag}<button type="button" aria-label={Quitar } onClick={() => setTags((current) => current.filter((item) => item !== tag))} className="ml-1 text-teal-400 hover:text-white">×</button></span>)}</div>}</section>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><div><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Valor estimado (€)</label><input type="number" min="0" step="0.01" value={currentValue} onChange={(event) => setCurrentValue(event.target.value)} className={inputClass} /></div><div><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Precio de adquisición (€)</label><input type="number" min="0" step="0.01" value={acquisitionPrice} onChange={(event) => setAcquisitionPrice(event.target.value)} className={inputClass} /></div></div>
        </div>

        <aside className="space-y-3 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
          <div className="flex items-center justify-between gap-3"><div><label className="block text-xs font-semibold uppercase tracking-wide text-slate-400">Fotografías</label><p className="mt-1 text-[11px] text-slate-500">La primera imagen es la principal.</p><p className="mt-1 text-[10px] text-slate-500">Fotos guardadas: {formatStorageBytes(storageUsedBytes)} · margen estimado: {formatStorageBytes(storageFreeBytes)}</p></div><label className="cursor-pointer rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-200 hover:border-teal-600">{isCompressing ? 'Comprimiendo…' : 'Añadir fotos'}<input type="file" accept="image/*" multiple onChange={handlePhotoUpload} disabled={isCompressing} className="hidden" /></label></div>
          <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-2xl border border-slate-700 bg-slate-950">{photos[0] ? <PrivateStorageImage source={photos[0]} alt={name || 'Vista principal del bien'} className="h-full w-full object-contain" /> : <div className="text-6xl text-slate-700">▧</div>}</div>
          {compressStatus && <p className="text-xs text-teal-300">{compressStatus}</p>}
          {photos.length > 0 && <div className="grid grid-cols-4 gap-2">{photos.map((photo, index) => <div key={${index}-} className={elative aspect-square overflow-hidden rounded-lg border }><PrivateStorageImage source={photo} alt={Foto } className="h-full w-full object-cover" /><button type="button" onClick={() => setPhotos((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={Eliminar foto } className="absolute right-1 top-1 rounded-full bg-black/75 px-2 text-white">×</button>{index === 0 && <span className="absolute bottom-1 left-1 rounded bg-emerald-950/90 px-1.5 py-0.5 text-[9px] text-emerald-200">Principal</span>}</div>)}</div>}
        </aside>

        <div className="lg:col-start-1 lg:row-start-2"><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Notas</label><textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} className={inputClass} /></div>
        <div className="flex justify-end gap-3 border-t border-slate-700 pt-4 lg:col-span-2"><button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">Cancelar</button><button disabled={isLoading || isCompressing} className="rounded-xl bg-teal-700 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-50">{isLoading ? 'Guardando…' : 'Guardar bien'}</button></div>
      </form>
    </div>
  </div>
}
 
function formatStorageBytes(bytes: number) {
  if (bytes >= 1024 * 1024 * 1024) return ${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GiB
  return bytes < 1024 * 1024 ? ${(bytes / 1024).toFixed(0)} KiB : ${(bytes / (1024 * 1024)).toFixed(1)} MiB
}
