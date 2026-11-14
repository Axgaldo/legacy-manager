import {
  Bytes,
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  Unsubscribe,
  where,
  writeBatch,
  addDoc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { ContractAddendum, ContractFileKind, ContractFileVersion } from '@/types'
import { cleanPayload } from '@/utils/cleanPayload'

const ADDENDA_COLLECTION = 'contractAddenda'
const VERSIONS_COLLECTION = 'contractFileVersions'
const CONTENT_COLLECTION = 'contractFileContents'

// Firestore documents are limited to 1 MiB. This leaves room for encoding and metadata.
export const MAX_CONTRACT_PDF_BYTES = 700 * 1024

export function validateContractPdf(file: File): string | null {
  if (file.size > MAX_CONTRACT_PDF_BYTES) {
    return `El PDF supera el límite de 700 KiB (${Math.ceil(file.size / 1024)} KiB). Comprímelo y vuelve a intentarlo.`
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
    const items = snapshot.docs.map((snapshotDoc) => {
      const data = snapshotDoc.data()
      return {
        id: snapshotDoc.id,
        propertyId: data.propertyId,
        contractId: data.contractId,
        documentKind: data.documentKind === 'addendum' ? 'addendum' as const : 'contract' as const,
        addendumId: data.addendumId,
        fileName: data.fileName || 'contrato.pdf',
        sizeBytes: Number(data.sizeBytes) || 0,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      }
    })
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
  uploadedBy?: string
}): Promise<string> {
  const validationError = validateContractPdf(args.file)
  if (validationError) throw new Error(validationError)

  const content = new Uint8Array(await args.file.arrayBuffer())
  const header = new TextDecoder().decode(content.slice(0, 5))
  if (header !== '%PDF-') throw new Error('El archivo seleccionado no parece ser un PDF válido.')

  const batch = writeBatch(db)
  const versionRef = doc(collection(db, VERSIONS_COLLECTION))
  const contentRef = doc(db, CONTENT_COLLECTION, versionRef.id)
  const version: Omit<ContractFileVersion, 'id'> = {
    propertyId: args.propertyId,
    contractId: args.contractId,
    documentKind: args.documentKind,
    addendumId: args.addendumId,
    fileName: args.file.name,
    sizeBytes: args.file.size,
    createdAt: serverTimestamp(),
  }

  batch.set(versionRef, cleanPayload(version))
  batch.set(contentRef, {
    contractId: args.contractId,
    propertyId: args.propertyId,
    pdf: Bytes.fromUint8Array(content),
    createdAt: serverTimestamp(),
  })
  await batch.commit()
  return versionRef.id
}

export async function getContractPdfBlob(versionId: string): Promise<Blob> {
  const snapshot = await getDoc(doc(db, CONTENT_COLLECTION, versionId))
  if (!snapshot.exists()) throw new Error('No se encontró el contenido de este PDF.')
  const bytes = snapshot.data().pdf
  if (!(bytes instanceof Bytes)) throw new Error('El contenido guardado no es un PDF válido.')
  const buffer = bytes.toUint8Array().slice().buffer as ArrayBuffer
  return new Blob([buffer], { type: 'application/pdf' })
}

function timestampValue(value: any): number {
  if (typeof value?.toMillis === 'function') return value.toMillis()
  if (value instanceof Date) return value.getTime()
  return Date.parse(String(value || '')) || 0
}
