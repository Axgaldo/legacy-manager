import { deleteObject, getBlob, getMetadata, ref, uploadBytesResumable } from 'firebase/storage'
import { storage } from './firebase'

export const MAX_CONTRACT_PDF_BYTES = 100 * 1024 * 1024
export const MAX_ASSET_IMAGE_BYTES = 2 * 1024 * 1024

export function isStoragePath(value: string): boolean {
  return value.startsWith('assets/') || value.startsWith('contracts/') || value.startsWith('tenants/')
}

export async function getPrivateStorageBlob(path: string): Promise<Blob> {
  return getBlob(ref(storage, path))
}

export async function getPrivateStorageFileSize(path: string): Promise<number | null> {
  try {
    const metadata = await getMetadata(ref(storage, path))
    return metadata.size
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'storage/object-not-found') return null
    throw error
  }
}

export async function uploadPrivateStorageBlob(
  path: string,
  blob: Blob,
  contentType: string,
  onProgress?: (percent: number) => void,
): Promise<number> {
  // Los nombres de archivo llevan UUID y las reglas impiden sobrescribirlos, así
  // que el navegador puede guardarlos indefinidamente: la segunda visita no
  // vuelve a descargar fotos ni PDFs y se reduce el tráfico facturable.
  const task = uploadBytesResumable(ref(storage, path), blob, {
    contentType,
    cacheControl: 'private, max-age=31536000, immutable',
  })
  return new Promise((resolve, reject) => {
    task.on('state_changed', (snapshot) => {
      onProgress?.(snapshot.totalBytes ? Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100) : 0)
    }, reject, () => resolve(task.snapshot.totalBytes))
  })
}

export async function deletePrivateStorageFile(path: string): Promise<void> {
  await deleteObject(ref(storage, path))
}
