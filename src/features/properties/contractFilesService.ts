import {
  Bytes,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  Unsubscribe,
  where,
  addDoc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { ContractAddendum, ContractFileKind, ContractFileVersion } from '@/types'
import { cleanPayload } from '@/utils/cleanPayload'
import { getPrivateStorageBlob, getPrivateStorageFileSize, isStoragePath, MAX_CONTRACT_PDF_BYTES, uploadPrivateStorageBlob } from '@/lib/storageFiles'

const ADDENDA_COLLECTION = 'contractAddenda'
const VERSIONS_COLLECTION = 'contractFileVersions'
const CONTENT_COLLECTION = 'contractFileContents'

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
    const items = snapshot.docs.map((snapshotDoc) => mapFileVersion(snapshotDoc.id, snapshotDoc.data()))
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
  if (typeof storagePath === 'string' && isStoragePath(storagePath)) return getPrivateStorageBlob(storagePath)

  const contentRef = doc(db, CONTENT_COLLECTION, versionId)
  const snapshot = await getDoc(contentRef)
  if (!snapshot.exists()) throw new Error('No se encontró el contenido de este PDF.')
  const metadata = snapshot.data()

  // Legacy versions used either one Firestore Bytes field or chunk subdocuments.
  if (metadata.pdf instanceof Bytes) return new Blob([metadata.pdf.toUint8Array().slice().buffer as ArrayBuffer], { type: 'application/pdf' })

  const chunkCount = Number(metadata.chunkCount) || 0
  if (!chunkCount) throw new Error('El contenido guardado no es un PDF válido.')
  const chunksSnapshot = await getDocs(query(collection(db, CONTENT_COLLECTION, versionId, 'chunks'), orderBy('index')))
  if (chunksSnapshot.size !== chunkCount) throw new Error('Faltan partes del PDF guardado. No se ha podido reconstruir el archivo.')

  const chunks = chunksSnapshot.docs.map((chunkDoc) => {
    const bytes = chunkDoc.data().bytes
    if (!(bytes instanceof Bytes)) throw new Error('Una parte del PDF guardado no es válida.')
    return bytes.toUint8Array()
  })
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const stored = new Uint8Array(length)
  let offset = 0
  chunks.forEach((chunk) => { stored.set(chunk, offset); offset += chunk.length })

  let pdfBytes = stored
  if (metadata.encoding === 'gzip') {
    if (typeof DecompressionStream === 'undefined') throw new Error('Este navegador no puede descomprimir el PDF. Ábrelo con una versión reciente de Chrome, Edge, Firefox o Safari.')
    pdfBytes = new Uint8Array(await new Response(new Blob([toArrayBuffer(stored)]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer())
  }
  return new Blob([toArrayBuffer(pdfBytes)], { type: 'application/pdf' })
}

export async function migrateContractPdfVersionToStorage(version: ContractFileVersion): Promise<number> {
  if (version.storagePath) return 0
  const path = `contracts/${version.propertyId}/${version.id}.pdf`
  let storedBytes = await getPrivateStorageFileSize(path)
  if (storedBytes === null) {
    const blob = await getContractPdfBlob(version.id)
    storedBytes = await uploadPrivateStorageBlob(path, blob, 'application/pdf')
  }
  await updateDoc(doc(db, VERSIONS_COLLECTION, version.id), {
    storagePath: path,
    storedSizeBytes: storedBytes,
    migratedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  // The Firestore copy is deliberately retained as a recoverable backup.
  return storedBytes
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

function timestampValue(value: any): number {
  if (typeof value?.toMillis === 'function') return value.toMillis()
  if (value instanceof Date) return value.getTime()
  return Date.parse(String(value || '')) || 0
}
