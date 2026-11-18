import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { getPrivateStorageBlob, isStoragePath } from '@/lib/storageFiles'
import { AssetItem, ContractFileVersion, Property, TenantDocument } from '@/types'
import { slugify } from '@/utils/slugs'
import { createZipBlob, uniqueZipName, ZipFileInput } from '@/utils/zip'

/**
 * Exportación de los archivos de Storage (que el backup JSON no incluye) en un
 * ZIP generado en el dispositivo. Los PDFs se descargan con la sesión del
 * usuario: nunca se generan enlaces públicos.
 */

export interface ExportProgress {
  done: number
  total: number
  label: string
}

export interface DocumentsExportResult {
  files: number
  skipped: number
}

function stamp(): string {
  return new Date().toISOString().slice(0, 10)
}

function extensionOf(path: string, fallback: string): string {
  const match = /\.([a-z0-9]{2,5})$/i.exec(path)
  return match ? `.${match[1].toLocaleLowerCase('es')}` : fallback
}

function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 5000)
}

async function toBytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer())
}

function manifest(lines: Array<[string, string]>): ZipFileInput {
  const text = [
    'Legacy Manager · exportación de documentos',
    '',
    ...lines.map(([label, value]) => `${label}: ${value}`),
    '',
    `Generado el ${new Date().toLocaleString('es-ES')}`,
    'Los archivos se descargan tal como están guardados en Firebase Storage.',
  ].join('\n')
  return { name: 'LEEME.txt', data: new TextEncoder().encode(text) }
}

/** Documentos (contratos, adendas y archivos de inquilinos) de un inmueble. */
export async function downloadPropertyDocuments(
  property: Property,
  onProgress?: (progress: ExportProgress) => void,
): Promise<DocumentsExportResult> {
  const [versionsSnapshot, tenants] = await Promise.all([
    getDocs(query(collection(db, 'contractFileVersions'), where('propertyId', '==', property.id))),
    Promise.all((property.tenantIds ?? []).map(async (tenantId) => {
      try {
        const snapshot = await getDoc(doc(db, 'tenants', tenantId))
        return { id: tenantId, name: snapshot.exists() ? String(snapshot.data().name ?? 'Inquilino') : 'Inquilino' }
      } catch {
        return { id: tenantId, name: 'Inquilino' }
      }
    })),
  ])

  const tenantDocuments: Array<{ tenantName: string; document: TenantDocument }> = []
  for (const tenant of tenants) {
    const documents = await getDocs(query(collection(db, 'tenantDocuments'), where('tenantId', '==', tenant.id)))
    documents.docs
      .filter((item) => !item.data().deletedAt)
      .forEach((item) => tenantDocuments.push({
        tenantName: tenant.name,
        document: {
          id: item.id,
          tenantId: item.data().tenantId,
          fileName: item.data().fileName || 'documento',
          contentType: item.data().contentType || 'application/octet-stream',
          sizeBytes: Number(item.data().sizeBytes) || 0,
          storagePath: item.data().storagePath || '',
          kind: item.data().kind || 'otro',
        },
      }))
  }

  const contracts = versionsSnapshot.docs
    .map((item): ContractFileVersion => ({
      id: item.id,
      propertyId: item.data().propertyId,
      contractId: item.data().contractId,
      documentKind: item.data().documentKind === 'addendum' ? 'addendum' : 'contract',
      addendumId: item.data().addendumId,
      fileName: item.data().fileName || 'contrato.pdf',
      sizeBytes: Number(item.data().sizeBytes) || 0,
      storagePath: item.data().storagePath,
    }))
    .filter((version) => Boolean(version.storagePath))

  const pending: Array<{ folder: string; fileName: string; storagePath: string }> = [
    ...contracts.map((version) => ({
      folder: version.documentKind === 'addendum' ? 'Contratos/Adendas' : 'Contratos',
      fileName: version.fileName,
      storagePath: version.storagePath!,
    })),
    ...tenantDocuments.map(({ tenantName, document }) => ({
      folder: `Inquilinos/${tenantName}`,
      fileName: document.fileName,
      storagePath: document.storagePath,
    })).filter((item) => Boolean(item.storagePath)),
  ]

  if (!pending.length) {
    throw new Error('Este inmueble no tiene documentos en Storage: ni contratos ni archivos de inquilinos.')
  }

  const files: ZipFileInput[] = [manifest([
    ['Inmueble', property.name],
    ['Dirección', [property.address, property.city].filter(Boolean).join(', ')],
    ['Documentos', String(pending.length)],
  ])]
  const used = new Set<string>(files.map((file) => file.name))
  let skipped = 0

  for (let index = 0; index < pending.length; index++) {
    const item = pending[index]
    onProgress?.({ done: index, total: pending.length, label: item.fileName })
    try {
      const blob = await getPrivateStorageBlob(item.storagePath)
      const name = uniqueZipName(`${item.folder}/${item.fileName}`, used)
      files.push({ name, data: await toBytes(blob) })
    } catch (error) {
      console.warn('No se pudo descargar un documento del inmueble:', item.storagePath, error)
      skipped++
    }
  }
  onProgress?.({ done: pending.length, total: pending.length, label: 'Generando ZIP' })

  if (files.length === 1) {
    throw new Error('No se pudo descargar ningún documento. Comprueba tu conexión e inténtalo de nuevo.')
  }

  downloadBlob(`legacy-manager-${slugify(property.name) || 'inmueble'}-documentos-${stamp()}.zip`, createZipBlob(files))
  return { files: files.length - 1, skipped }
}

/** Fotografías originales de un bien en un ZIP. */
export async function downloadAssetPhotos(
  asset: AssetItem,
  onProgress?: (progress: ExportProgress) => void,
): Promise<DocumentsExportResult> {
  const photos = (asset.photos ?? []).filter(Boolean)
  if (!photos.length) throw new Error('Este bien no tiene fotografías que descargar.')

  const files: ZipFileInput[] = [manifest([
    ['Bien', asset.name],
    ['Categoría', asset.category],
    ['Fotografías', String(photos.length)],
  ])]
  const used = new Set<string>(files.map((file) => file.name))
  let skipped = 0

  for (let index = 0; index < photos.length; index++) {
    const photo = photos[index]
    onProgress?.({ done: index, total: photos.length, label: `Foto ${index + 1}` })
    try {
      const blob = isStoragePath(photo)
        ? await getPrivateStorageBlob(photo)
        : photo.startsWith('data:image/')
          ? await (await fetch(photo)).blob()
          : null
      if (!blob) {
        skipped++
        continue
      }
      const extension = isStoragePath(photo) ? extensionOf(photo, '.jpg') : '.jpg'
      files.push({
        name: uniqueZipName(`fotos/foto-${String(index + 1).padStart(2, '0')}${extension}`, used),
        data: await toBytes(blob),
      })
    } catch (error) {
      console.warn('No se pudo descargar una fotografía del bien:', asset.id, index, error)
      skipped++
    }
  }
  onProgress?.({ done: photos.length, total: photos.length, label: 'Generando ZIP' })

  if (files.length === 1) {
    throw new Error('No se pudo descargar ninguna fotografía. Comprueba tu conexión e inténtalo de nuevo.')
  }

  downloadBlob(`legacy-manager-${slugify(asset.name) || 'bien'}-fotos-${stamp()}.zip`, createZipBlob(files))
  return { files: files.length - 1, skipped }
}
