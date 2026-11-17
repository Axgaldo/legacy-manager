import { useMemo, useState, type ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import { collection, doc, getDocs, serverTimestamp, writeBatch } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { AssetCategory, AssetImportRecord } from '@/types'
import { cleanPayload } from '@/utils/cleanPayload'

const VALID_CATEGORIES: AssetCategory[] = ['numismatica', 'arte', 'objetos']
const BATCH_SIZE = 400
const PREVIEW_STEP = 100

const euroFormatter = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

function formatEuro(value?: number) {
  return value === undefined || Number.isNaN(value) ? '—' : euroFormatter.format(value)
}

interface ParsedFile {
  batch: string
  description?: string
  records: AssetImportRecord[]
  errors: string[]
}

function parseImportFile(text: string): ParsedFile {
  const raw = JSON.parse(text) as unknown
  let recordsInput: unknown[]
  let batch = `import-${new Date().toISOString().slice(0, 10)}`
  let description: string | undefined

  if (Array.isArray(raw)) {
    recordsInput = raw
  } else if (raw && typeof raw === 'object') {
    const object = raw as Record<string, unknown>
    if (!Array.isArray(object.records)) {
      throw new Error('El JSON debe ser una lista de fichas o un objeto con la propiedad "records".')
    }
    recordsInput = object.records
    if (typeof object.batch === 'string' && object.batch.trim()) batch = object.batch.trim()
    if (typeof object.description === 'string' && object.description.trim()) description = object.description.trim()
  } else {
    throw new Error('El archivo no contiene un JSON válido.')
  }

  const errors: string[] = []
  const seenKeys = new Set<string>()
  const records: AssetImportRecord[] = []

  recordsInput.forEach((item, index) => {
    const position = index + 1
    if (!item || typeof item !== 'object') {
      errors.push(`Ficha ${position}: no es un objeto.`)
      return
    }
    const row = item as Record<string, unknown>
    const name = typeof row.name === 'string' ? row.name.trim() : ''
    const owner = typeof row.owner === 'string' ? row.owner.trim() : ''
    const category = row.category
    const numismaticaType = row.numismatica_type

    if (!name) errors.push(`Ficha ${position}: falta "name".`)
    if (!owner) errors.push(`Ficha ${position}: falta "owner".`)
    if (!VALID_CATEGORIES.includes(category as AssetCategory)) {
      errors.push(`Ficha ${position}: "category" no válida (${String(category)}).`)
    }
    if (numismaticaType !== undefined && numismaticaType !== 'moneda' && numismaticaType !== 'medalla') {
      errors.push(`Ficha ${position}: "numismatica_type" no válido (${String(numismaticaType)}).`)
    }

    const importKey = typeof row.import_key === 'string' && row.import_key.trim()
      ? row.import_key.trim()
      : `${batch}:${position}`
    if (seenKeys.has(importKey)) {
      errors.push(`Ficha ${position}: "import_key" duplicada (${importKey}).`)
    }
    seenKeys.add(importKey)

    records.push({
      ...(row as unknown as AssetImportRecord),
      name,
      owner,
      category: category as AssetCategory,
      photos: Array.isArray(row.photos) ? row.photos.filter((photo): photo is string => typeof photo === 'string') : [],
      photoSizesBytes: Array.isArray(row.photoSizesBytes) ? row.photoSizesBytes.map((size) => Number(size) || 0) : [],
      import_key: importKey,
      import_batch: typeof row.import_batch === 'string' && row.import_batch.trim() ? row.import_batch.trim() : batch,
    })
  })

  return { batch, description, records, errors }
}

function summarize(records: AssetImportRecord[]) {
  const countBy = (getKey: (record: AssetImportRecord) => string | undefined) => {
    const map = new Map<string, number>()
    records.forEach((record) => {
      const key = getKey(record)?.trim() || 'Sin especificar'
      map.set(key, (map.get(key) ?? 0) + 1)
    })
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'))
  }

  return {
    total: records.length,
    byOwner: countBy((record) => record.owner),
    byType: countBy((record) => record.numismatica_type === 'medalla' ? 'Medalla' : record.numismatica_type === 'moneda' ? 'Moneda' : record.category),
    bySource: countBy((record) => record.import_source),
    missingCountry: records.filter((record) => record.category === 'numismatica' && !record.country?.trim()).length,
    missingValue: records.filter((record) => record.category === 'numismatica'
      && record.market_value === undefined
      && record.reference_book_value === undefined
      && record.purchase_price === undefined).length,
  }
}

export default function ImportAssetsPage() {
  const [fileName, setFileName] = useState('')
  const [parsed, setParsed] = useState<ParsedFile | null>(null)
  const [parseError, setParseError] = useState('')
  const [previewLimit, setPreviewLimit] = useState(PREVIEW_STEP)
  const [isImporting, setIsImporting] = useState(false)
  const [progress, setProgress] = useState('')
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null)
  const [importError, setImportError] = useState('')

  const summary = useMemo(() => (parsed ? summarize(parsed.records) : null), [parsed])
  const visibleRecords = useMemo(
    () => (parsed ? parsed.records.slice(0, previewLimit) : []),
    [parsed, previewLimit],
  )

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setFileName(file.name)
    setParsed(null)
    setParseError('')
    setResult(null)
    setImportError('')
    setProgress('')
    setPreviewLimit(PREVIEW_STEP)

    try {
      const text = await file.text()
      const next = parseImportFile(text)
      setParsed(next)
      if (next.errors.length > 0) {
        setParseError(`El archivo tiene ${next.errors.length} problema(s). Corrígelos antes de importar.`)
      }
    } catch (error) {
      setParseError(error instanceof Error ? error.message : 'No se pudo leer el archivo.')
    }
  }

  const handleImport = async () => {
    if (!parsed || parsed.errors.length > 0 || isImporting) return
    const confirmed = window.confirm(
      `Se van a escribir ${parsed.records.length} ficha(s) en Firestore.\n\n` +
      'Las que ya tengan la misma import_key se omitirán. ¿Continuar?',
    )
    if (!confirmed) return

    setIsImporting(true)
    setImportError('')
    setResult(null)
    setProgress('Leyendo fichas existentes…')

    try {
      const snapshot = await getDocs(collection(db, 'assets'))
      const existingKeys = new Set<string>()
      snapshot.forEach((document) => {
        const key = document.data().import_key
        if (typeof key === 'string' && key) existingKeys.add(key)
      })

      const pending = parsed.records.filter((record) => !existingKeys.has(record.import_key))
      const skipped = parsed.records.length - pending.length

      if (pending.length === 0) {
        setResult({ imported: 0, skipped })
        setProgress('')
        return
      }

      for (let start = 0; start < pending.length; start += BATCH_SIZE) {
        const chunk = pending.slice(start, start + BATCH_SIZE)
        const batch = writeBatch(db)
        chunk.forEach((record) => {
          const ref = doc(collection(db, 'assets'))
          batch.set(ref, cleanPayload({
            ...record,
            photos: record.photos ?? [],
            photoSizesBytes: record.photoSizesBytes ?? [],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }))
        })
        await batch.commit()
        const done = Math.min(start + BATCH_SIZE, pending.length)
        setProgress(`Importadas ${done} de ${pending.length}…`)
      }

      setResult({ imported: pending.length, skipped })
      setProgress('')
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Error desconocido al importar.')
      setProgress('')
    } finally {
      setIsImporting(false)
    }
  }

  const reset = () => {
    setFileName('')
    setParsed(null)
    setParseError('')
    setProgress('')
    setResult(null)
    setImportError('')
    setPreviewLimit(PREVIEW_STEP)
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/bienes" className="text-xs font-semibold text-teal-300 hover:text-teal-200">← Volver a Bienes</Link>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-100">Importar datos</h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-400">
          Herramienta temporal para cargar fichas desde un JSON local. El archivo no se sube a ningún sitio: solo se escriben las fichas en Firestore cuando pulses «Importar».
        </p>
      </div>

      <section className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-200">1. Elige el archivo JSON</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Debe tener la forma <code className="text-slate-300">{'{ "batch": "...", "records": [...] }'}</code> o ser una lista de fichas.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {fileName && <span className="max-w-64 truncate text-xs text-slate-400" title={fileName}>{fileName}</span>}
            <label className="cursor-pointer rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-600">
              Seleccionar JSON
              <input type="file" accept=".json,application/json" onChange={(event) => void handleFileChange(event)} className="hidden" />
            </label>
            {parsed && <button type="button" onClick={reset} className="rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800">Limpiar</button>}
          </div>
        </div>

        {parseError && (
          <div role="alert" className="mt-4 rounded-xl border border-red-900 bg-red-950/50 p-3 text-sm text-red-300">
            {parseError}
            {parsed && parsed.errors.length > 0 && (
              <ul className="mt-2 max-h-40 list-inside list-disc overflow-y-auto text-xs">
                {parsed.errors.slice(0, 20).map((error) => <li key={error}>{error}</li>)}
              </ul>
            )}
          </div>
        )}
      </section>

      {parsed && summary && (
        <>
          <section className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-200">2. Previsualización</h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Lote <strong className="text-slate-300">{parsed.batch}</strong>
                  {parsed.description ? ` · ${parsed.description}` : ''}
                </p>
              </div>
              <div className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs font-semibold text-teal-200">
                {summary.total} ficha(s)
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryCard title="Total" value={String(summary.total)} />
              <SummaryCard title="Sin país" value={String(summary.missingCountry)} tone={summary.missingCountry > 0 ? 'amber' : 'slate'} />
              <SummaryCard title="Sin valoración" value={String(summary.missingValue)} tone={summary.missingValue > 0 ? 'amber' : 'slate'} />
              <SummaryCard title="Con import_key" value={String(parsed.records.filter((record) => Boolean(record.import_key)).length)} />
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <SummaryList title="Propietarios" items={summary.byOwner} />
              <SummaryList title="Tipos" items={summary.byType} />
              <SummaryList title="Documentos de origen" items={summary.bySource} />
            </div>

            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-800">
              <table className="min-w-full divide-y divide-slate-800 text-left text-xs">
                <thead className="bg-slate-950/80 text-[10px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Nombre</th>
                    <th className="px-3 py-2">Propietario</th>
                    <th className="px-3 py-2">Tipo</th>
                    <th className="px-3 py-2">País</th>
                    <th className="px-3 py-2">Año</th>
                    <th className="px-3 py-2">Ceca</th>
                    <th className="px-3 py-2">Catálogo</th>
                    <th className="px-3 py-2 text-right">Valor</th>
                    <th className="px-3 py-2">Origen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {visibleRecords.map((record) => (
                    <tr key={record.import_key} className="align-top">
                      <td className="max-w-64 px-3 py-2">
                        <p className="truncate font-semibold text-slate-200" title={record.name}>{record.name}</p>
                        <p className="mt-0.5 truncate text-[10px] text-slate-500" title={record.notes}>{record.notes || '—'}</p>
                      </td>
                      <td className="px-3 py-2 text-slate-300">{record.owner}</td>
                      <td className="px-3 py-2 text-slate-400">{record.numismatica_type === 'medalla' ? '🏅 Medalla' : record.numismatica_type === 'moneda' ? '🪙 Moneda' : record.category}</td>
                      <td className="px-3 py-2 text-slate-400">{record.country || '—'}</td>
                      <td className="px-3 py-2 text-slate-400">{record.year ?? '—'}</td>
                      <td className="px-3 py-2 text-slate-400">{record.mint || '—'}</td>
                      <td className="px-3 py-2 text-slate-400">{record.catalog_reference || record.inventory_number || '—'}</td>
                      <td className="px-3 py-2 text-right font-semibold text-emerald-400">{formatEuro(record.market_value ?? record.reference_book_value ?? record.purchase_price)}</td>
                      <td className="max-w-40 truncate px-3 py-2 text-slate-500" title={record.import_source}>{record.import_source || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {parsed.records.length > previewLimit && (
              <button
                type="button"
                onClick={() => setPreviewLimit((current) => current + PREVIEW_STEP)}
                className="mt-3 rounded-xl border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
              >
                Mostrar {Math.min(PREVIEW_STEP, parsed.records.length - previewLimit)} más
              </button>
            )}
          </section>

          <section className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
            <h3 className="text-sm font-semibold text-slate-200">3. Importar</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Se escribirán en lotes de {BATCH_SIZE}. Si vuelves a cargar el mismo archivo, las fichas con la misma <code className="text-slate-300">import_key</code> se omitirán.
            </p>

            {progress && <p role="status" className="mt-3 rounded-lg border border-teal-900 bg-teal-950/40 px-3 py-2 text-xs text-teal-200">{progress}</p>}
            {importError && <p role="alert" className="mt-3 rounded-lg border border-red-900 bg-red-950/50 px-3 py-2 text-xs text-red-300">{importError}</p>}
            {result && (
              <div className="mt-3 rounded-lg border border-emerald-900 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-200">
                Importación terminada: <strong>{result.imported}</strong> ficha(s) nueva(s), <strong>{result.skipped}</strong> omitida(s) por ya existir.
                <Link to="/bienes/categoria/numismatica" className="ml-2 underline">Ver numismática</Link>
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void handleImport()}
                disabled={isImporting || parsed.errors.length > 0}
                className="rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isImporting ? 'Importando…' : `Importar ${parsed.records.length} ficha(s)`}
              </button>
              {parsed.errors.length > 0 && <span className="text-xs text-red-300">Corrige los errores del JSON antes de importar.</span>}
            </div>
          </section>
        </>
      )}

      <section className="rounded-2xl border border-amber-900 bg-amber-950/30 p-4 text-xs text-amber-200">
        <p className="font-semibold">Notas</p>
        <ul className="mt-1 list-inside list-disc space-y-1 text-amber-200/90">
          <li>El JSON se lee en tu navegador; no se guarda en el repositorio ni en Storage.</li>
          <li>Esta pantalla es temporal: se puede retirar cuando termine la importación por fases.</li>
          <li>Las fotos incrustadas en los documentos no se importan en esta fase; se pueden añadir después desde la ficha.</li>
          <li>Si una importación se corta, vuelve a cargar el mismo JSON y se omitirán las fichas ya escritas.</li>
        </ul>
      </section>
    </div>
  )
}

function SummaryCard({ title, value, tone = 'slate' }: { title: string; value: string; tone?: 'slate' | 'amber' }) {
  return (
    <div className={`rounded-xl border p-3 ${tone === 'amber' ? 'border-amber-900 bg-amber-950/30' : 'border-slate-800 bg-slate-950/60'}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{title}</p>
      <p className={`mt-1 text-xl font-bold ${tone === 'amber' ? 'text-amber-300' : 'text-slate-100'}`}>{value}</p>
    </div>
  )
}

function SummaryList({ title, items }: { title: string; items: Array<[string, number]> }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{title}</p>
      <ul className="mt-2 space-y-1 text-xs text-slate-300">
        {items.length === 0 && <li className="text-slate-500">—</li>}
        {items.slice(0, 8).map(([label, count]) => (
          <li key={label} className="flex items-center justify-between gap-2">
            <span className="truncate" title={label}>{label}</span>
            <span className="font-semibold text-slate-400">{count}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
