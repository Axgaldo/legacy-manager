import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { AssetItem } from '@/types'
import { cleanPayload } from '@/utils/cleanPayload'
import { deletePrivateStorageFile, isStoragePath, MAX_ASSET_IMAGE_BYTES, uploadPrivateStorageBlob } from '@/lib/storageFiles'
import { normalizeAssetCategory } from './assetCategories'

const COLLECTION_NAME = 'assets'

function optionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function optionalString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

export function subscribeToAssets(
  onSuccess: (assets: AssetItem[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'))

  return onSnapshot(
    q,
    (snapshot) => {
      const items: AssetItem[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data()
        return {
          id: docSnap.id,
          name: data.name ?? '',
          owner: data.owner ?? 'Gabriel',
          category: normalizeAssetCategory(data.category),
          tags: Array.isArray(data.tags) ? data.tags : [data.brandOrAuthor, data.material, data.historicalEra, data.country, data.ruler, data.mint, data.denomination, data.conservationState].filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0),
          description: optionalString(data.description),
          year: optionalNumber(data.year),
          historicalEra: optionalString(data.historicalEra),
          country: optionalString(data.country),
          placeOfOrigin: optionalString(data.placeOfOrigin) || optionalString(data.country),
          brandOrAuthor: optionalString(data.brandOrAuthor),
          ruler: optionalString(data.ruler),
          mint: optionalString(data.mint),
          denomination: optionalString(data.denomination),
          conservationState: optionalString(data.conservationState),
          material: optionalString(data.material),
          acquisitionYear: optionalNumber(data.acquisitionYear),
          acquisitionPrice: optionalNumber(data.acquisitionPrice),
          currentValue: optionalNumber(data.currentValue),
          notes: optionalString(data.notes),
          photos: Array.isArray(data.photos) ? data.photos : [],
          photoSizesBytes: Array.isArray(data.photoSizesBytes) ? data.photoSizesBytes.map((size: unknown) => Number(size) || 0) : [],
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,

          // Numismática fields (previously stored documents keep working)
          numismatica_type: data.numismatica_type === 'medalla'
            ? 'medalla'
            : data.numismatica_type === 'moneda'
              ? 'moneda'
              : (data.category === 'medals' || data.category === 'medallas' ? 'medalla' : undefined),
          medal_motive: optionalString(data.medal_motive),
          medal_size_mm: optionalString(data.medal_size_mm),
          acquisition_operation: optionalString(data.acquisition_operation),
          acquisition_source: optionalString(data.acquisition_source),
          medal_location: optionalString(data.medal_location),
          value: optionalNumber(data.value),
          market_value: optionalNumber(data.market_value),
          value_source: optionalString(data.value_source),
          purchase_price: optionalNumber(data.purchase_price),
          purchase_price_original: optionalNumber(data.purchase_price_original),
          purchase_currency: optionalString(data.purchase_currency),
          purchase_year: optionalNumber(data.purchase_year),
          obverse_info: optionalString(data.obverse_info),
          reverse_info: optionalString(data.reverse_info),
          era: optionalString(data.era),
          creation_year_range: optionalString(data.creation_year_range),
          reference_book: optionalString(data.reference_book),
          reference_book_value: optionalNumber(data.reference_book_value),
          reference_book_value_original: optionalNumber(data.reference_book_value_original),
          reference_book_currency: optionalString(data.reference_book_currency),
          empire_reign: optionalString(data.empire_reign),
          manufacturing_place: optionalString(data.manufacturing_place),
          mint_mark: optionalString(data.mint_mark),
          weight_grams: optionalString(data.weight_grams),
          diameter_mm: optionalString(data.diameter_mm),
          inventory_number: optionalString(data.inventory_number),
          catalog_reference: optionalString(data.catalog_reference),
          case_location: optionalString(data.case_location),
          case_number: optionalString(data.case_number),
          added_date: optionalString(data.added_date),
        }
      })
      onSuccess(items)
    },
    (err) => {
      console.error('Error fetching assets from Firestore:', err)
      if (onError) onError(err)
    },
  )
}

export async function createAsset(
  asset: Omit<AssetItem, 'id' | 'createdAt' | 'updatedAt'>,
) {
  const assetRef = doc(collection(db, COLLECTION_NAME))
  const stored = await storeAssetPhotos(assetRef.id, asset.photos ?? [])
  try {
    await setDoc(assetRef, {
      ...cleanPayload({ ...asset, photos: stored.paths, photoSizesBytes: stored.sizes }),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return assetRef
  } catch (error) {
    await removeUploadedFiles(stored.uploadedPaths)
    throw error
  }
}

export async function updateAsset(
  id: string,
  asset: Partial<Omit<AssetItem, 'id' | 'createdAt' | 'updatedAt'>>,
  previousPhotos: string[] = [],
  previousPhotoSizes: number[] = [],
) {
  const docRef = doc(db, COLLECTION_NAME, id)
  const stored = await storeAssetPhotos(id, asset.photos ?? [], previousPhotos, previousPhotoSizes)
  try {
    await backupLegacyPhotos(id, asset.photos ?? [])
    const cleaned = cleanPayload({ ...asset, photos: stored.paths, photoSizesBytes: stored.sizes })
    await updateDoc(docRef, { ...cleaned, updatedAt: serverTimestamp() })
  } catch (error) {
    await removeUploadedFiles(stored.uploadedPaths)
    throw error
  }
  const retained = new Set(stored.paths)
  await Promise.allSettled(previousPhotos.filter(isStoragePath).filter((path) => !retained.has(path)).map(deletePrivateStorageFile))
}

export async function deleteAsset(id: string) {
  const docRef = doc(db, COLLECTION_NAME, id)
  const snapshot = await getDoc(docRef)
  const asset = snapshot.data()
  await deleteDoc(docRef)
  if (Array.isArray(asset?.photos)) await Promise.allSettled(asset.photos.filter((path: unknown): path is string => typeof path === 'string' && isStoragePath(path)).map(deletePrivateStorageFile))
}

export async function migrateLegacyAssetPhotos(onProgress?: (done: number, total: number) => void) {
  const snapshot = await getDocs(collection(db, COLLECTION_NAME))
  const legacyAssets = snapshot.docs.filter((item) => Array.isArray(item.data().photos) && item.data().photos.some((photo: unknown) => typeof photo === 'string' && photo.startsWith('data:image/')))
  let done = 0
  for (const item of legacyAssets) {
    const data = item.data()
    await updateAsset(item.id, { photos: data.photos, photoSizesBytes: data.photoSizesBytes ?? [] }, data.photos, data.photoSizesBytes ?? [])
    done++
    onProgress?.(done, legacyAssets.length)
  }
  return { migratedAssets: done, totalAssets: legacyAssets.length }
}

async function storeAssetPhotos(assetId: string, photos: string[], existingPhotos: string[] = [], existingSizes: number[] = []) {
  const paths: string[] = []
  const sizes: number[] = []
  const uploadedPaths: string[] = []
  const sizeByPath = new Map(existingPhotos.map((path, index) => [path, existingSizes[index] ?? 0]))
  try {
    for (let index = 0; index < photos.length; index++) {
      const photo = photos[index]
      if (isStoragePath(photo)) {
        paths.push(photo)
        sizes.push(sizeByPath.get(photo) ?? 0)
        continue
      }
      const blob = await dataUrlToBlob(photo)
      if (blob.size > MAX_ASSET_IMAGE_BYTES) throw new Error(`La imagen comprimida ${index + 1} supera el límite de 2 MiB.`)
      const extension = blob.type === 'image/webp' ? 'webp' : blob.type === 'image/png' ? 'png' : 'jpg'
      const path = `assets/${assetId}/${crypto.randomUUID()}.${extension}`
      const size = await uploadPrivateStorageBlob(path, blob, blob.type)
      uploadedPaths.push(path); paths.push(path); sizes.push(size)
    }
    return { paths, sizes, uploadedPaths }
  } catch (error) {
    await removeUploadedFiles(uploadedPaths)
    throw error
  }
}

async function dataUrlToBlob(value: string): Promise<Blob> {
  if (!value.startsWith('data:image/')) throw new Error('Una fotografía no tiene un formato de imagen válido.')
  const response = await fetch(value)
  return response.blob()
}

async function backupLegacyPhotos(assetId: string, photos: string[]) {
  const legacyPhotos = photos.map((source, position) => ({ source, position })).filter(({ source }) => source.startsWith('data:image/'))
  await Promise.all(legacyPhotos.map(({ source, position }) => addDoc(collection(db, 'assetPhotoBackups', assetId, 'photos'), {
    source,
    position,
    backedUpAt: serverTimestamp(),
  })))
}

async function removeUploadedFiles(paths: string[]) {
  await Promise.allSettled(paths.map(deletePrivateStorageFile))
}
