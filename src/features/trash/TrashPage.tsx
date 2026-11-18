import { useCallback, useEffect, useMemo, useState } from 'react'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { useToast } from '@/components/ui/ToastProvider'
import {
  TRASH_KIND_META,
  TRASH_RETENTION_DAYS,
  TrashEntry,
  TrashKind,
  formatTrashDate,
  isTrashEntryExpired,
  loadTrash,
  purgeExpiredTrash,
  purgeTrashEntry,
  restoreTrashEntry,
  trashDaysLeft,
} from './trashService'

const KIND_ORDER: TrashKind[] = ['property', 'asset', 'contract', 'tenant', 'tenantDocument']

/**
 * Papelera: lo que se ha borrado en los últimos 30 días. La purga real se hace
 * aquí, desde la app, nunca con Cloud Functions: al abrir la página se eliminan
 * los elementos caducados y el resto espera a «Vaciar papelera» o a su fecha.
 */
export default function TrashPage() {
  const { showToast } = useToast()
  const [entries, setEntries] = useState<TrashEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [purgeTarget, setPurgeTarget] = useState<TrashEntry | null>(null)
  const [emptyOpen, setEmptyOpen] = useState(false)
  const [emptying, setEmptying] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const loaded = await loadTrash()
      const expired = loaded.filter((entry) => isTrashEntryExpired(entry))
      if (expired.length) {
        const result = await purgeExpiredTrash(loaded)
        setEntries(await loadTrash())
        showToast(`Se han eliminado definitivamente ${result.purged} elemento${result.purged === 1 ? '' : 's'} con más de ${TRASH_RETENTION_DAYS} días.`, { kind: 'info' })
        if (result.skippedFiles > 0) {
          showToast(
            `${result.skippedFiles} archivo${result.skippedFiles === 1 ? '' : 's'} de Storage no se pudo borrar. Comprueba que storage.rules esté publicada.`,
            { kind: 'error', duration: 10000 },
          )
        }
      } else {
        setEntries(loaded)
      }
    } catch (err: any) {
      console.error(err)
      setError(err?.message || 'No se pudo cargar la papelera.')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const groups = useMemo(
    () => KIND_ORDER
      .map((kind) => ({ kind, items: entries.filter((entry) => entry.kind === kind) }))
      .filter((group) => group.items.length > 0),
    [entries],
  )

  const handleRestore = async (entry: TrashEntry) => {
    setBusyId(entry.id)
    try {
      await restoreTrashEntry(entry)
      setEntries((current) => current.filter((item) => !(item.kind === entry.kind && item.id === entry.id)))
      showToast(
        entry.kind === 'contract'
          ? `«${entry.title}» restaurado. Márcalo como vigente en el inmueble si corresponde.`
          : `«${entry.title}» restaurado.`,
        { kind: 'success' },
      )
    } catch (err: any) {
      console.error(err)
      showToast(err?.message || 'No se pudo restaurar el elemento.', { kind: 'error' })
    } finally {
      setBusyId(null)
    }
  }

  const handlePurge = async () => {
    if (!purgeTarget) return
    setBusyId(purgeTarget.id)
    try {
      const result = await purgeTrashEntry(purgeTarget)
      setEntries((current) => current.filter((item) => !(item.kind === purgeTarget.kind && item.id === purgeTarget.id)))
      showToast(`«${purgeTarget.title}» se ha eliminado definitivamente.`, { kind: 'success' })
      if (result.skippedFiles > 0) {
        showToast(
          `${result.skippedFiles} archivo${result.skippedFiles === 1 ? '' : 's'} de Storage no se pudo borrar. Comprueba que storage.rules esté publicada.`,
          { kind: 'error', duration: 10000 },
        )
      }
      setPurgeTarget(null)
    } catch (err: any) {
      console.error(err)
      showToast(err?.message || 'No se pudo eliminar el elemento.', { kind: 'error' })
    } finally {
      setBusyId(null)
    }
  }

  const handleEmpty = async () => {
    setEmptying(true)
    let removed = 0
    let skippedFiles = 0
    try {
      for (const entry of entries) {
        const result = await purgeTrashEntry(entry)
        skippedFiles += result.skippedFiles
        removed++
      }
      setEntries([])
      setEmptyOpen(false)
      showToast(`Papelera vaciada: ${removed} elemento${removed === 1 ? '' : 's'} eliminado${removed === 1 ? '' : 's'}.`, { kind: 'success' })
      if (skippedFiles > 0) {
        showToast(
          `${skippedFiles} archivo${skippedFiles === 1 ? '' : 's'} de Storage no se pudo borrar. Comprueba que storage.rules esté publicada.`,
          { kind: 'error', duration: 10000 },
        )
      }
    } catch (err: any) {
      console.error(err)
      showToast(err?.message || 'No se pudo vaciar la papelera por completo.', { kind: 'error' })
      await refresh()
    } finally {
      setEmptying(false)
    }
  }

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-4 pb-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-100">Papelera</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Lo que borras se guarda aquí {TRASH_RETENTION_DAYS} días antes de desaparecer de verdad.
          </p>
        </div>
        {entries.length > 0 && (
          <button
            type="button"
            onClick={() => setEmptyOpen(true)}
            disabled={emptying}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-900 bg-red-950/40 px-4 py-2.5 text-xs font-semibold text-red-300 transition hover:bg-red-950/70 disabled:opacity-60"
          >
            🗑 Vaciar papelera
          </button>
        )}
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-xs leading-relaxed text-slate-400">
        <p>
          La papelera se purga <strong className="text-slate-200">desde la aplicación</strong>: al abrir esta página se
          eliminan definitivamente los elementos que llevan <strong className="text-slate-200">más de {TRASH_RETENTION_DAYS} días</strong> en
          la papelera, y el resto se borra cuando lo pidas con «Eliminar ya» o «Vaciar papelera». Si nadie la abre, no se
          borra nada solo.
        </p>
        <p className="mt-1.5">
          Al purgar un inmueble se borran también sus <strong className="text-slate-200">contratos, adendas y PDFs</strong>.
          Los documentos de los inquilinos se borran al purgar el inquilino. Los PDFs de contratos nunca se sobrescriben,
          solo se eliminan cuando la papelera los purga.
        </p>
      </div>

      {error && <p className="rounded-xl border border-red-900 bg-red-950/50 px-4 py-3 text-sm text-red-200">{error}</p>}

      {loading ? (
        <div className="py-16 text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-3 border-teal-700 border-t-transparent" />
          <p className="text-sm text-slate-400">Cargando la papelera…</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900 p-12 text-center">
          <p className="text-4xl" aria-hidden="true">🗑️</p>
          <h3 className="mt-3 text-lg font-bold text-slate-100">La papelera está vacía</h3>
          <p className="mt-1 text-sm text-slate-400">Aquí aparecerán los inmuebles, bienes, inquilinos y documentos que borres.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(({ kind, items }) => (
            <section key={kind} className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
              <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
                <h3 className="flex items-center gap-2 font-semibold text-slate-200">
                  <span aria-hidden="true">{TRASH_KIND_META[kind].icon}</span>
                  {TRASH_KIND_META[kind].label}
                </h3>
                <span className="text-xs text-slate-500">{items.length}</span>
              </header>
              <ul className="divide-y divide-slate-800">
                {items.map((entry) => {
                  const daysLeft = trashDaysLeft(entry)
                  const busy = busyId === entry.id
                  return (
                    <li key={`${entry.kind}-${entry.id}`} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-100">{entry.title}</p>
                        <p className="mt-0.5 truncate text-xs text-slate-400">{entry.subtitle}</p>
                        <p className="mt-1 text-[11px] text-slate-500">
                          Eliminado el {formatTrashDate(entry.deletedAt)} · se borra el {formatTrashDate(entry.expiresAt)} ·{' '}
                          {daysLeft === 0
                            ? 'se elimina al abrir la papelera'
                            : `quedan ${daysLeft} día${daysLeft === 1 ? '' : 's'}`}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void handleRestore(entry)}
                          disabled={busy}
                          className="rounded-lg border border-teal-900 bg-teal-950/40 px-3 py-1.5 text-xs font-semibold text-teal-200 transition hover:bg-teal-950/70 disabled:opacity-60"
                        >
                          {busy ? 'Restaurando…' : 'Restaurar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setPurgeTarget(entry)}
                          disabled={busy}
                          className="rounded-lg border border-red-900 bg-red-950/30 px-3 py-1.5 text-xs font-semibold text-red-300 transition hover:bg-red-950/60 disabled:opacity-60"
                        >
                          Eliminar ya
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <ConfirmModal
        isOpen={purgeTarget !== null}
        title="¿Eliminar definitivamente?"
        message={`«${purgeTarget?.title ?? ''}» y sus archivos asociados (si los hay) se borrarán sin posibilidad de recuperarlos. Los PDFs de contratos se conservan como archivo histórico.`}
        confirmWord="ELIMINAR"
        confirmButtonText="Eliminar definitivamente"
        isDestructive
        isLoading={busyId !== null && purgeTarget !== null}
        onConfirm={handlePurge}
        onClose={() => { if (busyId === null) setPurgeTarget(null) }}
      />

      <ConfirmModal
        isOpen={emptyOpen}
        title="¿Vaciar toda la papelera?"
        message={`Se eliminarán definitivamente ${entries.length} elemento${entries.length === 1 ? '' : 's'}. Esta acción no se puede deshacer.`}
        confirmWord="VACIAR"
        confirmButtonText="Vaciar papelera"
        isDestructive
        isLoading={emptying}
        onConfirm={handleEmpty}
        onClose={() => { if (!emptying) setEmptyOpen(false) }}
      />
    </div>
  )
}
