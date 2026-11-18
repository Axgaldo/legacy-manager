import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Unsubscribe,
  where,
  addDoc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { ContractAddendum, ContractFileKind, ContractFileVersion } from '@/types'
import { cleanPayload } from '@/utils/cleanPayload'
import { getPrivateStorageBlob, isStoragePath, MAX_CONTRACT_PDF_BYTES, uploadPrivateStorageBlob } from '@/lib/storageFiles'

const ADDENDA_COLLECTION = 'contractAddenda'
const VERSIONS_COLLECTION = 'contractFileVersions'

export { MAX_CONTRACT_PDF_BYTES }
export type ContractPdfUploadResult = { id: string; originalBytes: number; storedBytes: number }

function mapFileVersion(id: string, data: Record<string, any>): ContractFileVersion {
  return {
    id,
    propertyId: data.propertyId,
    contractId: data.contractId,
    documentKind: data.documentKind === 'addendum' ? 'addendum' : 'contract',
    addendumId: data.addendumId,
    fileName: data.fileName || 'contrato.pdf',
    sizeBytes: Number(data.sizeBytes) || 0,
    storedSizeBytes: Number(data.storedSizeBytes ?? data.sizeBytes) || 0,
    storagePath: data.storagePath,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  }
}

export function validateContractPdf(file: File): string | null {
  if (file.size > MAX_CONTRACT_PDF_BYTES) {
    return `El PDF supera el límite de 50 MiB (${(file.size / (1024 * 1024)).toFixed(1)} MiB).`
  }
  if (!file.name.toLowerCase().endsWith('.pdf') || (file.type && file.type !== 'application/pdf')) {
    return 'Selecciona un archivo PDF.'
  }
  return null
}

export function subscribeToPropertyContractFiles(
  propertyId: string,
  onSuccess: (versions: ContractFileVersion[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(query(collection(db, VERSIONS_COLLECTION), where('propertyId', '==', propertyId)), (snapshot) => {
    // Los PDF antiguos guardados en Firestore ya no se soportan: solo se listan
    // las versiones que tienen su archivo en Storage.
    const items = snapshot.docs
      .filter((snapshotDoc) => Boolean(snapshotDoc.data().storagePath))
      .map((snapshotDoc) => mapFileVersion(snapshotDoc.id, snapshotDoc.data()))
    items.sort((a, b) => timestampValue(a.createdAt) - timestampValue(b.createdAt))
    onSuccess(items)
  }, onError)
}

export function subscribeToPropertyAddenda(
  propertyId: string,
  onSuccess: (addenda: ContractAddendum[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(query(collection(db, ADDENDA_COLLECTION), where('propertyId', '==', propertyId)), (snapshot) => {
    const items = snapshot.docs.map((snapshotDoc) => {
      const data = snapshotDoc.data()
      return {
        id: snapshotDoc.id,
        propertyId: data.propertyId,
        contractId: data.contractId,
        title: data.title || 'Adenda',
        date: data.date || '',
        notes: data.notes || '',
        rentChange: data.rentChange === undefined ? undefined : Number(data.rentChange),
        rentEffectiveFrom: data.rentEffectiveFrom || undefined,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      }
    })
    items.sort((a, b) => b.date.localeCompare(a.date))
    onSuccess(items)
  }, onError)
}

export async function addContractAddendum(addendum: Omit<ContractAddendum, 'id' | 'createdAt' | 'updatedAt'>) {
  return addDoc(collection(db, ADDENDA_COLLECTION), {
    ...cleanPayload(addendum),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function addContractPdfVersion(args: {
  propertyId: string
  contractId: string
  documentKind: ContractFileKind
  addendumId?: string
  file: File
  onProgress?: (percent: number) => void
  uploadedBy?: string
}): Promise<ContractPdfUploadResult> {
  const validationError = validateContractPdf(args.file)
  if (validationError) throw new Error(validationError)

  const header = new TextDecoder().decode(new Uint8Array(await args.file.slice(0, 5).arrayBuffer()))
  if (header !== '%PDF-') throw new Error('El archivo seleccionado no parece ser un PDF válido.')

  const versionRef = doc(collection(db, VERSIONS_COLLECTION))
  const storagePath = `contracts/${args.propertyId}/${versionRef.id}.pdf`
  const storedBytes = await uploadPrivateStorageBlob(storagePath, args.file, 'application/pdf', args.onProgress)
  const version: Omit<ContractFileVersion, 'id'> = {
    propertyId: args.propertyId,
    contractId: args.contractId,
    documentKind: args.documentKind,
    addendumId: args.addendumId,
    fileName: args.file.name,
    sizeBytes: args.file.size,
    storedSizeBytes: storedBytes,
    storagePath,
    createdAt: serverTimestamp(),
  }
  await setDoc(versionRef, cleanPayload(version))
  return { id: versionRef.id, originalBytes: args.file.size, storedBytes }
}

export async function getContractPdfBlob(versionId: string): Promise<Blob> {
  const versionSnapshot = await getDoc(doc(db, VERSIONS_COLLECTION, versionId))
  const storagePath = versionSnapshot.data()?.storagePath
  if (typeof storagePath === 'string' && isStoragePath(storagePath)) {
    return getPrivateStorageBlob(storagePath)
  }
  throw new Error('Este PDF antiguo ya no está disponible. Vuelve a subirlo como nueva versión.')
}

function timestampValue(value: any): number {
  if (typeof value?.toMillis === 'function') return value.toMillis()
  if (value instanceof Date) return value.getTime()
  return Date.parse(String(value || '')) || 0
}
