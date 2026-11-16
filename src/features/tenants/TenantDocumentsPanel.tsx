import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
import { TenantDocument, TenantDocumentKind } from '@/types'
import { useAuth } from '@/features/auth/AuthProvider'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { formatStorageBytes } from '@/lib/storageUsage'
import {
  TENANT_DOCUMENT_ACCEPT,
  TENANT_DOCUMENT_KINDS,
  deleteTenantDocument,
  getTenantDocumentBlob,
  subscribeToTenantDocuments,
  uploadTenantDocument,
  validateTenantDocumentFile,
} from './tenantsService'

function documentIcon(document: TenantDocument): string {
  if (document.contentType.startsWith('image/')) return '🖼️'
  if (document.contentType === 'application/pdf') return '📄'
  return TENANT_DOCUMENT_KINDS.find((kind) => kind.value === document.kind)?.icon ?? '📎'
}

function formatDate(value: any): string {
  const date = typeof value?.toDate === 'function' ? value.toDate() : value instanceof Date ? value : value ? new Date(value) : null
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('es-ES') : ''
}

export default function TenantDocumentsPanel({ tenantId }: { tenantId: string }) {
  const { user } = useAuth()
  const [documents, setDocuments] = useState<TenantDocument[]>([])
  const [kind, setKind] = useState<TenantDocumentKind>('dni')
  const [label, setLabel] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [documentToDelete, setDocumentToDelete] = useState<TenantDocument | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => subscribeToTenantDocuments(tenantId, setDocuments, (err) => setError(err.message)), [tenantId])

  const totalBytes = useMemo(() => documents.reduce((sum, document) => sum + (document.storedSizeBytes ?? document.sizeBytes), 0), [documents])

  const handleFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (!files.length) return

    setError('')
    setNotice('')
    const invalid = files.map((file) => validateTenantDocumentFile(file)).filter((message): message is string => Boolean(message))
    if (invalid.length) {
      setError(invalid.join(' '))
      return
    }

    setUploading(true)
    let uploaded = 0
    try {
      for (let index = 0; index < files.length; index++) {
        setProgress(0)
        await uploadTenantDocument({
          tenantId,
          file: files[index],
          kind,
          label: files.length === 1 ? label : undefined,
          uploadedBy: user?.displayName || user?.email || 'Usuario',
          onProgress: setProgress,
        })
        uploaded++
      }
      setNotice(`${uploaded} documento${uploaded === 1 ? '' : 's'} añadido${uploaded === 1 ? '' : 's'} correctamente.`)
      if (files.length === 1) setLabel('')
    } catch (err: any) {
      console.error(err)
      setError(err?.message || 'No se pudieron subir los documentos.')
    } finally {
      setUploading(false)
      setProgress(0)
    }
  }

  const handleOpen = async (document: TenantDocument) => {
    setError('')
    setBusyId(document.id)
    const popup = window.open('', '_blank')
    try {
      const blob = await getTenantDocumentBlob(document)
      const url = URL.createObjectURL(blob)
      if (popup) {
        popup.location.href = url
      } else {
        const anchor = window.document.createElement('a')
        anchor.href = url
        anchor.download = document.fileName
        anchor.click()
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (err: any) {
      popup?.close()
      console.error(err)
      setError(err?.message || 'No se pudo abrir el documento.')
    } finally {
      setBusyId(null)
    }
  }

  const handleConfirmDelete = async () => {
    if (!documentToDelete) return
    setBusyId(documentToDelete.id)
    try {
      await deleteTenantDocument(documentToDelete)
      setNotice('Documento eliminado.')
      setDocumentToDelete(null)
    } catch (err: any) {
      console.error(err)
      setError(err?.message || 'No se pudo eliminar el documento.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-100">Documentos del inquilino</h3>
          <p className="mt-1 text-xs text-slate-400">
            {documents.length} archivo{documents.length === 1 ? '' : 's'} · {formatStorageBytes(totalBytes)}. PDF, imágenes, Word, Excel, ODT, TXT o ZIP hasta 25 MiB por archivo.
          </p>
        </div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-600 disabled:bg-slate-700"
        >
          {uploading ? 'Subiendo…' : '＋ Añadir documentos'}
        </button>
        <input ref={fileInputRef} type="file" multiple accept={TENANT_DOCUMENT_ACCEPT} onChange={handleFiles} className="hidden" />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,200px)_minmax(0,1fr)]">
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">Tipo de documento</span>
          <select value={kind} onChange={(event) => setKind(event.target.value as TenantDocumentKind)} disabled={uploading} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100">
            {TENANT_DOCUMENT_KINDS.map((item) => <option key={item.value} value={item.value}>{item.icon} {item.label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">Descripción (opcional, para un solo archivo)</span>
          <input value={label} onChange={(event) => setLabel(event.target.value)} disabled={uploading} placeholder="Ej. DNI anverso y reverso, nómina de marzo…" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600" />
        </label>
      </div>

      {uploading && (
        <div className="mt-4">
          <div className="h-2 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full rounded-full bg-teal-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Subiendo… {progress}%</p>
        </div>
      )}

      {error && <p className="mt-3 rounded-lg border border-red-900 bg-red-950/50 px-3 py-2 text-xs text-red-200">{error}</p>}
      {notice && <p className="mt-3 rounded-lg border border-emerald-900 bg-emerald-950/50 px-3 py-2 text-xs text-emerald-200">{notice}</p>}

      {documents.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-slate-700 p-8 text-center">
          <p className="text-3xl">📂</p>
          <p className="mt-2 text-sm font-semibold text-slate-200">Sin documentos todavía</p>
          <p className="mt-1 text-xs text-slate-400">Sube el contrato, DNI, nóminas o cualquier documentación relevante.</p>
        </div>
      ) : (
        <ul className="mt-5 divide-y divide-slate-800 overflow-hidden rounded-xl border border-slate-800">
          {documents.map((document) => {
            const kindMeta = TENANT_DOCUMENT_KINDS.find((item) => item.value === document.kind)
            return (
              <li key={document.id} className="flex flex-col gap-3 bg-slate-950/40 p-3 sm:flex-row sm:items-center">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-lg">{documentIcon(document)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-100" title={document.fileName}>{document.label || document.fileName}</p>
                  <p className="mt-0.5 truncate text-[11px] text-slate-400">
                    {kindMeta?.label ?? 'Documento'}
                    {document.label ? ` · ${document.fileName}` : ''}
                    {' · '}{formatStorageBytes(document.storedSizeBytes ?? document.sizeBytes)}
                    {formatDate(document.createdAt) ? ` · ${formatDate(document.createdAt)}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button type="button" onClick={() => void handleOpen(document)} disabled={busyId === document.id} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-teal-600 hover:text-teal-200 disabled:opacity-50">
                    {busyId === document.id ? 'Abriendo…' : 'Abrir'}
                  </button>
                  <button type="button" onClick={() => setDocumentToDelete(document)} disabled={busyId === document.id} className="rounded-lg border border-red-900 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-950/60 disabled:opacity-50">
                    Eliminar
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <ConfirmModal
        isOpen={documentToDelete !== null}
        title="¿Eliminar este documento?"
        message={`Se borrará «${documentToDelete?.label || documentToDelete?.fileName}» y su archivo del almacenamiento.`}
        confirmWord="BORRAR"
        confirmButtonText="Eliminar documento"
        isDestructive
        onConfirm={handleConfirmDelete}
        onClose={() => setDocumentToDelete(null)}
      />
    </section>
  )
}
