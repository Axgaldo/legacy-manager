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

const COLLECTION_NAME = 'assets'

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
          category: data.category ?? 'other',
          tags: Array.isArray(data.tags) ? data.tags : [data.brandOrAuthor, data.material, data.historicalEra, data.country, data.ruler, data.mint, data.denomination, data.conservationState].filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0),
          location: data.location ?? '',
          description: data.description ?? '',
          year: data.year !== undefined && data.year !== null ? Number(data.year) : undefined,
          historicalEra: data.historicalEra ?? '',
          country: data.country ?? '',
          placeOfOrigin: data.placeOfOrigin ?? data.country ?? '',
          brandOrAuthor: data.brandOrAuthor ?? '',
          ruler: data.ruler ?? '',
          mint: data.mint ?? '',
          denomination: data.denomination ?? '',
          conservationState: data.conservationState ?? '',
          material: data.material ?? '',
          acquisitionYear: data.acquisitionYear ? Number(data.acquisitionYear) : undefined,
          acquisitionPrice: data.acquisitionPrice ? Number(data.acquisitionPrice) : undefined,
          currentValue: data.currentValue ? Number(data.currentValue) : undefined,
          notes: data.notes ?? '',
          photos: Array.isArray(data.photos) ? data.photos : [],
          photoSizesBytes: Array.isArray(data.photoSizesBytes) ? data.photoSizesBytes.map((size: unknown) => Number(size) || 0) : [],
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
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
