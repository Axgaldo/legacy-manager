import { collection, onSnapshot, Unsubscribe } from 'firebase/firestore'
import { db } from './firebase'
import { isStoragePath } from './storageFiles'

export type AppStorageUsage = {
  pdfBytes: number
  imageBytes: number
  pdfCount: number
  imageCount: number
}

// The project's configured bucket ends in .firebasestorage.app; Firebase currently lists 5 GB-months at no cost for this bucket type.
export const STORAGE_NO_COST_STORAGE_BYTES = 5_000_000_000

/** Sums the exact object sizes recorded when app-managed Storage files are uploaded. */
export function subscribeToAppStorageUsage(onUsage: (usage: AppStorageUsage) => void, onError?: (error: Error) => void): Unsubscribe {
  let pdfVersions: Record<string, any>[] = []
  let assets: Record<string, any>[] = []
  let hasPdfSnapshot = false
  let hasAssetSnapshot = false
  const publish = () => {
    if (!hasPdfSnapshot || !hasAssetSnapshot) return
    const pdfs = pdfVersions.filter((version) => typeof version.storagePath === 'string' && isStoragePath(version.storagePath))
    let imageBytes = 0
    let imageCount = 0
    assets.forEach((asset) => {
      const photos: unknown[] = Array.isArray(asset.photos) ? asset.photos : []
      const sizes: unknown[] = Array.isArray(asset.photoSizesBytes) ? asset.photoSizesBytes : []
      photos.forEach((path, index) => {
        if (typeof path === 'string' && isStoragePath(path)) {
          imageCount++
          imageBytes += Number(sizes[index]) || 0
        }
      })
    })
    onUsage({
      pdfBytes: pdfs.reduce((sum, version) => sum + (Number(version.storedSizeBytes ?? version.sizeBytes) || 0), 0),
      imageBytes,
      pdfCount: pdfs.length,
      imageCount,
    })
  }
  const unsubs = [
    onSnapshot(collection(db, 'contractFileVersions'), (snapshot) => {
      pdfVersions = snapshot.docs.map((item) => item.data())
      hasPdfSnapshot = true
      publish()
    }, (error) => onError?.(error)),
    onSnapshot(collection(db, 'assets'), (snapshot) => {
      assets = snapshot.docs.map((item) => item.data())
      hasAssetSnapshot = true
      publish()
    }, (error) => onError?.(error)),
  ]
  return () => unsubs.forEach((unsubscribe) => unsubscribe())
}

export function formatStorageBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GiB`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KiB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`
}
