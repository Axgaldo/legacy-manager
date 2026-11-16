import { useEffect, useMemo, useRef, useState } from 'react'
import { Contract, ContractAddendum, ContractFileKind, ContractFileVersion, Property, Tenant } from '@/types'
import { addContract, setActiveContract, softDeleteContract, updateContract } from './contractsService'
import { addContractAddendum, addContractPdfVersion, getContractPdfBlob, migrateContractPdfVersionToStorage, subscribeToPropertyAddenda, subscribeToPropertyContractFiles, validateContractPdf } from './contractFilesService'
import { MAX_CONTRACT_PDF_BYTES } from '@/lib/storageFiles'
import { formatStorageBytes, subscribeToAppStorageUsage, AppStorageUsage, STORAGE_NO_COST_STORAGE_BYTES } from '@/lib/storageUsage'
import { updateProperty } from './propertiesService'
import { normalizeRentHistory } from './rentRates'
import { ensureTenantFromLegacyData } from '@/features/tenants/tenantsService'
import ConfirmModal from '@/components/ui/ConfirmModal'

type Props = { property: Property; contracts: Contract[]; tenants?: Tenant[] }

const fieldClass = 'w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-teal-500 focus:outline-none'
const labelClass = 'mb-1 block text-xs font-medium text-slate-300'

export default function ContractsPanel({ property, contracts, tenants = [] }: Props) {
  const [versions, setVersions] = useState<ContractFileVersion[]>([])
  const [addenda, setAddenda] = useState<ContractAddendum[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [uploadTarget, setUploadTarget] = useState<{ contractId: string; kind: ContractFileKind; addendumId?: string } | null>(null)
  const [newContractOpen, setNewContractOpen] = useState(false)
  const [editingContract, setEditingContract] = useState<Contract | null>(null)
  const [editContractIsActive, setEditContractIsActive] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Contract | null>(null)
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0)
  const [newAddendumFor, setNewAddendumFor] = useState<string | null>(null)
  const [applyContractData, setApplyContractData] = useState(false)
  const [applyAddendumRent, setApplyAddendumRent] = useState(false)
  const [tenantName, setTenantName] = useState(tenants[0]?.name || property.tenantName || '')
  const [tenantPhone, setTenantPhone] = useState(tenants[0]?.phone || property.tenantPhone || '')
  const [tenantEmail, setTenantEmail] = useState(tenants[0]?.email || property.tenantEmail || '')
  const [tenantNif, setTenantNif] = useState(tenants[0]?.nif || property.tenantNif || '')
  const [startDate, setStartDate] = useState(new Date().toLocaleDateString('sv-SE'))
  const [endDate, setEndDate] = useState('')
  const [rent, setRent] = useState(String(property.monthlyRent ?? ''))
  const [deposit, setDeposit] = useState(String(property.depositAmount ?? ''))
  const [avra, setAvra] = useState(property.avraReference || '')
  const [contractNotes, setContractNotes] = useState('')
  const [pdf, setPdf] = useState<File | null>(null)
  const [pendingContractId, setPendingContractId] = useState<string | null>(null)
  const [versionFile, setVersionFile] = useState<File | null>(null)
  const [addendumTitle, setAddendumTitle] = useState('')
  const [addendumDate, setAddendumDate] = useState(new Date().toLocaleDateString('sv-SE'))
  const [addendumNotes, setAddendumNotes] = useState('')
  const [addendumRent, setAddendumRent] = useState('')
  const [rentEffectiveFrom, setRentEffectiveFrom] = useState(new Date().toLocaleDateString('sv-SE').slice(0, 7))
  const [addendumPdf, setAddendumPdf] = useState<File | null>(null)
  const [storageUsage, setStorageUsage] = useState<AppStorageUsage>({ pdfBytes: 0, imageBytes: 0, documentBytes: 0, pdfCount: 0, imageCount: 0, documentCount: 0 })
  const [uploadNotice, setUploadNotice] = useState('')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [migrationMessage, setMigrationMessage] = useState('')
  const [isMigrating, setIsMigrating] = useState(false)

  useEffect(() => {
    const unsubs = [
      subscribeToPropertyContractFiles(property.id, setVersions, (e) => setError(e.message)),
      subscribeToPropertyAddenda(property.id, setAddenda, (e) => setError(e.message)),
      subscribeToAppStorageUsage(setStorageUsage, (e) => setError(e.message)),
    ]
    return () => unsubs.forEach((unsub) => unsub())
  }, [property.id])

  const versionsByDocument = useMemo(() => {
    const map = new Map<string, ContractFileVersion[]>()
    versions.forEach((version) => {
      const key = version.documentKind === 'addendum' ? `addendum:${version.addendumId}` : `contract:${version.contractId}`
      map.set(key, [...(map.get(key) ?? []), version])
    })
    map.forEach((items) => items.sort((a, b) => timestamp(b.createdAt) - timestamp(a.createdAt)))
    return map
  }, [versions])

  const applyRentAndTenant = async (data: { tenantName: string; tenantPhone?: string; tenantEmail?: string; tenantNif?: string; monthlyRent: number; startDate: string; depositAmount?: number; avraReference?: string }) => {
    const month = data.startDate.slice(0, 7)
    const existing = property.rentHistory?.length ? property.rentHistory : property.monthlyRent !== undefined
      ? [{ effectiveFrom: (property.createdAt?.toDate?.() as Date | undefined)?.toISOString().slice(0, 7) || month, amount: property.monthlyRent }]
      : []
    const rentHistory = normalizeRentHistory([...existing, { effectiveFrom: month, amount: data.monthlyRent }])
    await ensureTenantFromLegacyData(property, {
      tenantName: data.tenantName,
      tenantPhone: data.tenantPhone,
      tenantEmail: data.tenantEmail,
      tenantNif: data.tenantNif,
    })
    await updateProperty(property.id, {
      monthlyRent: data.monthlyRent,
      rentStartMonth: month,
      rentHistory,
      depositAmount: data.depositAmount,
      avraReference: data.avraReference || '',
    })
  }

  const handleNewContract = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!pdf || !tenantName.trim() || !rent) return
    const validation = validateContractPdf(pdf)
    if (validation) { setError(validation); return }
    setBusy(true); setError('')
    try {
      let contractId = pendingContractId
      if (!contractId) {
        const ref = await addContract({ propertyId: property.id, tenantName: tenantName.trim(), tenantPhone: tenantPhone.trim() || undefined, tenantEmail: tenantEmail.trim() || undefined, tenantNif: tenantNif.trim() || undefined, startDate, endDate: endDate || undefined, monthlyRent: Number(rent), depositAmount: deposit ? Number(deposit) : undefined, avraReference: avra.trim() || undefined, isActive: false, notes: contractNotes.trim() || undefined })
        contractId = ref.id
        setPendingContractId(contractId)
      }
      const upload = await addContractPdfVersion({ propertyId: property.id, contractId, documentKind: 'contract', file: pdf, onProgress: setUploadProgress })
      setUploadNotice(`PDF guardado en Storage: ${formatStorageBytes(upload.storedBytes)}.`)
      if (applyContractData) await applyRentAndTenant({ tenantName: tenantName.trim(), tenantPhone, tenantEmail, tenantNif, monthlyRent: Number(rent), startDate, depositAmount: deposit ? Number(deposit) : undefined, avraReference: avra })
      setNewContractOpen(false); setPendingContractId(null); setPdf(null)
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar el contrato. Si los datos ya se guardaron, puedes volver a adjuntar el PDF desde el contrato.') }
    finally { setBusy(false) }
  }

  const beginEdit = (contract: Contract) => {
    setEditingContract(contract)
    setEditContractIsActive(contract.isActive)
    setTenantName(contract.tenantName)
    setTenantPhone(contract.tenantPhone || '')
    setTenantEmail(contract.tenantEmail || '')
    setTenantNif(contract.tenantNif || '')
    setStartDate(contract.startDate)
    setEndDate(contract.endDate || '')
    setRent(String(contract.monthlyRent))
    setDeposit(contract.depositAmount === undefined ? '' : String(contract.depositAmount))
    setAvra(contract.avraReference || '')
    setContractNotes(contract.notes || '')
  }

  const handleEditContract = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!editingContract || !tenantName.trim() || !rent) return
    setBusy(true); setError('')
    try {
      await updateContract(editingContract.id, { tenantName: tenantName.trim(), tenantPhone: tenantPhone.trim() || '', tenantEmail: tenantEmail.trim() || '', tenantNif: tenantNif.trim() || '', startDate, endDate: endDate || '', monthlyRent: Number(rent), depositAmount: deposit ? Number(deposit) : undefined, avraReference: avra.trim() || '', notes: contractNotes.trim() || '' })
      const currentActive = contracts.find((contract) => contract.isActive)?.id ?? null
      const targetActive = editContractIsActive ? editingContract.id : currentActive === editingContract.id ? null : currentActive
      await setActiveContract(property.id, targetActive)
      setEditingContract(null)
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo actualizar el contrato.') }
    finally { setBusy(false) }
  }

  const confirmDeleteContract = async () => {
    if (!deleteTarget) return
    setBusy(true)
    try {
      await softDeleteContract(deleteTarget.id)
      setDeleteTarget(null); setDeleteStep(0)
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo eliminar el contrato.') }
    finally { setBusy(false) }
  }

  const handleVersionUpload = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!uploadTarget || !versionFile) return
    const validation = validateContractPdf(versionFile)
    if (validation) { setError(validation); return }
    setBusy(true); setError('')
    try {
      const upload = await addContractPdfVersion({ propertyId: property.id, contractId: uploadTarget.contractId, documentKind: uploadTarget.kind, addendumId: uploadTarget.addendumId, file: versionFile, onProgress: setUploadProgress })
      setUploadNotice(`PDF guardado en Storage: ${formatStorageBytes(upload.storedBytes)}.`)
      setUploadTarget(null); setVersionFile(null)
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar la versión.') }
    finally { setBusy(false) }
  }

  const handleAddendum = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!newAddendumFor || !addendumPdf || !addendumTitle.trim()) return
    const validation = validateContractPdf(addendumPdf)
    if (validation) { setError(validation); return }
    setBusy(true); setError('')
    try {
      const ref = await addContractAddendum({ propertyId: property.id, contractId: newAddendumFor, title: addendumTitle.trim(), date: addendumDate, notes: addendumNotes.trim() || undefined, rentChange: addendumRent ? Number(addendumRent) : undefined, rentEffectiveFrom: addendumRent ? rentEffectiveFrom : undefined })
      const upload = await addContractPdfVersion({ propertyId: property.id, contractId: newAddendumFor, documentKind: 'addendum', addendumId: ref.id, file: addendumPdf, onProgress: setUploadProgress })
      setUploadNotice(`PDF guardado en Storage: ${formatStorageBytes(upload.storedBytes)}.`)
      if (applyAddendumRent && addendumRent) {
        const existing = property.rentHistory?.length ? property.rentHistory : property.monthlyRent !== undefined ? [{ effectiveFrom: rentEffectiveFrom, amount: property.monthlyRent }] : []
        await updateProperty(property.id, { monthlyRent: Number(addendumRent), rentHistory: normalizeRentHistory([...existing, { effectiveFrom: rentEffectiveFrom, amount: Number(addendumRent) }]) })
      }
      setNewAddendumFor(null); setAddendumPdf(null); setAddendumTitle(''); setAddendumNotes(''); setAddendumRent('')
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar la adenda.') }
    finally { setBusy(false) }
  }

  const openPdfInCurrentTab = async (version: ContractFileVersion) => {
    setError('')
    try {
      const blob = await getContractPdfBlob(version.id)
      window.location.assign(URL.createObjectURL(blob))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo abrir el PDF.')
    }
  }

  const downloadVersion = async (version: ContractFileVersion) => {
    setBusy(true)
    try {
      const blob = await getContractPdfBlob(version.id)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = version.fileName; anchor.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo descargar el PDF.') }
    finally { setBusy(false) }
  }

  const migrateExistingPdfs = async () => {
    const pending = versions.filter((version) => !version.storagePath)
    if (!pending.length || !window.confirm(`Se copiarán ${pending.length} PDF(s) antiguos a Storage. Las copias de Firestore se conservarán como respaldo. ¿Continuar?`)) return
    setIsMigrating(true); setMigrationMessage('Preparando migración…')
    let done = 0
    try {
      for (const version of pending) {
        await migrateContractPdfVersionToStorage(version)
        done++
        setMigrationMessage(`PDF migrados a Storage: ${done}/${pending.length}`)
      }
      setMigrationMessage(`Migración terminada: ${done} PDF(s) copiados a Storage; los originales de Firestore se conservaron.`)
    } catch (e) {
      setMigrationMessage(`Migración detenida tras ${done}/${pending.length}: ${e instanceof Error ? e.message : 'error desconocido'}. Puedes volver a intentarlo.`)
    } finally { setIsMigrating(false) }
  }

  const filePicker = (value: File | null, setter: (file: File | null) => void) => <div>
    <input type="file" accept="application/pdf,.pdf" onChange={(e) => setter(e.target.files?.[0] ?? null)} className="block w-full text-xs text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-700 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-slate-100"/>
    <p className="mt-1 text-[11px] text-slate-500">PDF hasta {formatStorageBytes(MAX_CONTRACT_PDF_BYTES)}. Las versiones anteriores se conservan.</p>
    {value && <p className="mt-1 text-xs text-teal-300">{value.name} · {formatStorageBytes(value.size)}</p>}
    {busy && uploadProgress > 0 && <div className="mt-2"><div className="h-1.5 overflow-hidden rounded bg-slate-800"><div className="h-full bg-teal-500 transition-all" style={{ width: `${uploadProgress}%` }}/></div><p className="mt-1 text-[10px] text-slate-400">Subiendo a Storage… {uploadProgress}%</p></div>}
  </div>

  const editingContractPdf = editingContract ? versionsByDocument.get('contract:' + editingContract.id)?.[0] : undefined

  const renderFilePreview = (key: string, title: string, compact = false) => {
    const latest = versionsByDocument.get(key)?.[0]
    return latest ? <PdfThumbnail version={latest} title={title} compact={compact} onOpen={() => void openPdfInCurrentTab(latest)} /> : <div className="flex h-28 items-center justify-center rounded-lg border border-dashed border-slate-700 text-xs text-slate-500">Todavía no hay PDF asociado.</div>
  }

  const renderFileControls = (key: string, contractId: string, kind: ContractFileKind, addendumId?: string) => {
    const items = versionsByDocument.get(key) ?? []
    const latest = items[0]
    return <div>
      <div className="flex flex-wrap gap-2"><button type="button" onClick={() => { setUploadTarget({ contractId, kind, addendumId }); setVersionFile(null) }} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:border-teal-600">{latest ? 'Subir nueva versión' : 'Subir PDF'}</button>{latest && <button type="button" onClick={() => void downloadVersion(latest)} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200">Descargar</button>}</div>
      {items.length > 1 && <details className="mt-3"><summary className="cursor-pointer text-xs text-slate-400">Versiones anteriores ({items.length - 1})</summary><div className="mt-2 space-y-1">{items.map((item, index) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-slate-900 px-2 py-1.5 text-[11px]"><span className="truncate text-slate-300">{index === 0 ? 'Última · ' : `v${items.length - index} · `}{item.fileName} <span className="text-slate-500">({(item.sizeBytes / 1024).toFixed(0)} KiB)</span></span><button onClick={() => void downloadVersion(item)} className="text-teal-300">Descargar</button></div>)}</div></details>}
    </div>
  }

  const renderFiles = (key: string, title: string, contractId: string, kind: ContractFileKind, addendumId?: string) => <div className="mt-3 space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3">{renderFilePreview(key, title, kind === 'addendum')} {renderFileControls(key, contractId, kind, addendumId)}</div>

  return <div className="space-y-5 animate-in fade-in duration-150">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-base font-bold text-slate-100">Contratos y adendas</h3><p className="mt-1 text-xs text-slate-400">PDF privados en Firebase Storage, con versiones conservadas.</p></div><div className="flex flex-wrap gap-2">{versions.some((version) => !version.storagePath) && <button disabled={isMigrating} onClick={() => void migrateExistingPdfs()} className="rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-200 disabled:opacity-50">{isMigrating ? 'Migrando…' : `Migrar ${versions.filter((version) => !version.storagePath).length} PDF(s) antiguos`}</button>}<button onClick={() => setNewContractOpen(true)} className="rounded-xl bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-600">+ Añadir contrato PDF</button></div></div>
    <div className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-xs text-slate-300"><div className="flex flex-wrap gap-x-5 gap-y-1"><span>Storage de la app: <strong>{formatStorageBytes(storageUsage.pdfBytes + storageUsage.imageBytes + storageUsage.documentBytes)}</strong> / 5 GB-mes sin coste</span><span>PDF: {formatStorageBytes(storageUsage.pdfBytes)} ({storageUsage.pdfCount})</span><span>Fotos: {formatStorageBytes(storageUsage.imageBytes)} ({storageUsage.imageCount})</span><span>Docs inquilinos: {formatStorageBytes(storageUsage.documentBytes)} ({storageUsage.documentCount})</span><span>Margen estimado: {formatStorageBytes(Math.max(0, STORAGE_NO_COST_STORAGE_BYTES - storageUsage.pdfBytes - storageUsage.imageBytes - storageUsage.documentBytes))}</span></div><p className="mt-1 text-[10px] text-slate-500">Tamaños de archivos asociados a la app; no incluye objetos ajenos o huérfanos. El margen es de almacenamiento, no de descargas u operaciones. Los PDF antiguos se migran conservando su copia Firestore.</p></div>
    {migrationMessage && <div role="status" className="rounded-lg border border-teal-900 bg-teal-950/40 px-3 py-2 text-xs text-teal-200">{migrationMessage}<button className="ml-3 underline" onClick={() => setMigrationMessage('')}>Cerrar</button></div>}
    {uploadNotice && <div role="status" className="rounded-lg border border-teal-900 bg-teal-950/40 px-3 py-2 text-xs text-teal-200">{uploadNotice}<button className="ml-3 underline" onClick={() => setUploadNotice('')}>Cerrar</button></div>}
    {error && <div role="alert" className="rounded-lg border border-rose-900 bg-rose-950/60 px-3 py-2 text-xs text-rose-200">{error}<button className="ml-3 underline" onClick={() => setError('')}>Cerrar</button></div>}
    {contracts.length === 0 ? (
      <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900 p-10 text-center">
        <p className="font-semibold text-slate-200">No hay contratos archivados</p>
        <p className="mt-1 text-xs text-slate-400">Añade el PDF del contrato para iniciar el historial.</p>
        <button onClick={() => setNewContractOpen(true)} className="mt-4 rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white">Añadir contrato PDF</button>
      </div>
    ) : (
      <div className="space-y-4">
        {contracts.map((contract) => (
          <article key={contract.id} className={contract.isActive ? 'rounded-2xl border border-emerald-500 bg-slate-900 p-5 shadow-lg shadow-emerald-950/30 ring-1 ring-emerald-500/40' : 'rounded-2xl border border-slate-800 bg-slate-900 p-5'}>
            <div className="grid grid-cols-1 gap-x-5 gap-y-3 md:grid-cols-[minmax(250px,0.9fr)_minmax(0,1.5fr)]">
              <button type="button" onClick={() => beginEdit(contract)} className="block w-full rounded-xl text-left transition hover:bg-slate-800/40 focus:outline-none focus:ring-2 focus:ring-teal-500 md:col-start-1 md:row-start-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className={contract.isActive ? 'rounded-full border border-emerald-400/50 bg-emerald-400/15 px-3 py-1 text-[11px] font-extrabold tracking-wide text-emerald-300' : 'rounded-full bg-slate-800 px-3 py-1 text-[11px] font-bold text-slate-400'}>{contract.isActive ? 'VIGENTE' : contract.endDate ? 'FINALIZADO' : 'NO VIGENTE'}</span>
                  <span className="font-mono text-[11px] text-slate-500">{contract.startDate}{contract.endDate ? ' → ' + contract.endDate : ' · Sin fecha fin'}</span>
                </div>
                <h4 className="mt-3 text-base font-bold text-slate-100">{contract.tenantName}</h4>
                <div className="mt-2 space-y-1 text-xs text-slate-400">
                  {contract.tenantNif && <p>DNI/NIF: {contract.tenantNif}</p>}
                  {contract.tenantPhone && <p>Teléfono: {contract.tenantPhone}</p>}
                  {contract.tenantEmail && <p>{contract.tenantEmail}</p>}
                  <p className={contract.isActive ? 'font-bold text-emerald-300' : 'font-semibold text-teal-300'}>Renta pactada: {euro(contract.monthlyRent)}/mes</p>
                  {contract.depositAmount !== undefined && <p>Fianza: {euro(contract.depositAmount)}</p>}
                  {contract.avraReference && <p>Ref. AVRA: {contract.avraReference}</p>}
                  {contract.notes && <p className="italic">{contract.notes}</p>}
                </div>
                <p className="mt-2 text-[10px] text-slate-600">Pulsa para editar los datos y la vigencia</p>
              </button>
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 md:col-start-2 md:row-span-2 md:row-start-1">
                {renderFilePreview('contract:' + contract.id, 'Contrato')}
              </div>
              <div className="flex items-start rounded-xl border border-slate-800 bg-slate-950/60 p-3 md:col-start-1 md:row-start-2">
                {renderFileControls('contract:' + contract.id, contract.id, 'contract')}
              </div>
            </div>
            {addenda.filter((item) => item.contractId === contract.id).map((item) => (
              <section key={item.id} className="mt-4 border-l-2 border-teal-800 pl-4">
                <div className="flex flex-wrap justify-between gap-2"><h5 className="text-sm font-semibold text-slate-200">Adenda: {item.title}</h5><span className="text-xs text-slate-500">{item.date}</span></div>
                {item.notes && <p className="mt-1 text-xs text-slate-400">{item.notes}</p>}
                {item.rentChange !== undefined && <p className="mt-1 text-xs text-teal-300">Renta: {euro(item.rentChange)} desde {item.rentEffectiveFrom}</p>}
                {renderFiles('addendum:' + item.id, 'Adenda ' + item.title, item.contractId, 'addendum', item.id)}
              </section>
            ))}
            <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-slate-800 pt-3">
              <button onClick={() => beginEdit(contract)} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200">Editar datos</button>
              <button onClick={() => { setDeleteTarget(contract); setDeleteStep(1) }} className="rounded-lg border border-rose-900 px-3 py-1.5 text-xs text-rose-300">Borrar</button>
              <button onClick={() => { setNewAddendumFor(contract.id); setAddendumPdf(null) }} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:border-teal-700">+ Añadir adenda</button>
            </div>
          </article>
        ))}
      </div>
    )}

    {(newContractOpen || editingContract || uploadTarget || newAddendumFor) && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) { setNewContractOpen(false); setUploadTarget(null); setNewAddendumFor(null) } }}><div className={"max-h-[94vh] w-full overflow-y-auto rounded-2xl bg-slate-900 p-5 shadow-2xl " + (editingContract ? "max-w-6xl border-2 " + (editContractIsActive ? "border-emerald-500" : "border-slate-700") : "max-w-2xl border border-slate-700")}><div className="mb-4 flex items-start justify-between"><div><h3 className="text-lg font-bold text-slate-100">{editingContract ? 'Editar contrato' : newContractOpen ? 'Añadir contrato' : uploadTarget ? 'Subir versión de PDF' : 'Añadir adenda'}</h3><p className="mt-1 text-xs text-slate-400">Los archivos existentes se conservan y nunca se sustituyen.</p></div><button disabled={busy} onClick={() => { setNewContractOpen(false); setUploadTarget(null); setNewAddendumFor(null) }} className="text-xl text-slate-400">×</button></div>
      {(newContractOpen || editingContract) && <form onSubmit={(e) => editingContract ? void handleEditContract(e) : void handleNewContract(e)} className={editingContract ? "grid gap-5 lg:grid-cols-2" : "space-y-3"}><div className="space-y-3"><div className="grid gap-3 sm:grid-cols-2"><Field label="Nombre del inquilino *"><input required className={fieldClass} value={tenantName} onChange={(e) => setTenantName(e.target.value)}/></Field><Field label="DNI/NIF"><input className={fieldClass} value={tenantNif} onChange={(e) => setTenantNif(e.target.value)}/></Field><Field label="Teléfono"><input className={fieldClass} value={tenantPhone} onChange={(e) => setTenantPhone(e.target.value)}/></Field><Field label="Correo"><input type="email" className={fieldClass} value={tenantEmail} onChange={(e) => setTenantEmail(e.target.value)}/></Field><Field label="Fecha de inicio *"><input required type="date" className={fieldClass} value={startDate} onChange={(e) => setStartDate(e.target.value)}/></Field><Field label="Fecha de fin"><input type="date" className={fieldClass} value={endDate} onChange={(e) => setEndDate(e.target.value)}/></Field><Field label="Renta mensual (€) *"><input required type="number" min="0" step="0.01" className={fieldClass} value={rent} onChange={(e) => setRent(e.target.value)}/></Field><Field label="Fianza (€)"><input type="number" min="0" step="0.01" className={fieldClass} value={deposit} onChange={(e) => setDeposit(e.target.value)}/></Field><Field label="Referencia AVRA"><input className={fieldClass} value={avra} onChange={(e) => setAvra(e.target.value)}/></Field></div><Field label="Notas"><textarea rows={2} className={fieldClass} value={contractNotes} onChange={(e) => setContractNotes(e.target.value)}/></Field>{editingContract && <label className={"flex cursor-pointer items-center gap-4 rounded-2xl border-2 p-5 transition " + (editContractIsActive ? "border-emerald-400 bg-emerald-950/70 text-emerald-100 shadow-lg shadow-emerald-950/40 ring-2 ring-emerald-500/40" : "border-slate-600 bg-slate-950 text-slate-300 hover:border-slate-400")}><input type="checkbox" className="h-7 w-7 accent-emerald-500" checked={editContractIsActive} onChange={(e) => setEditContractIsActive(e.target.checked)}/><span><strong className="block text-base">{editContractIsActive ? "✓ CONTRATO VIGENTE" : "Marcar como contrato vigente"}</strong><span className="mt-1 block text-xs opacity-80">Solo puede haber un contrato vigente por inmueble.</span></span></label>}{!editingContract && <><Field label="PDF del contrato *">{filePicker(pdf, setPdf)}</Field><label className="flex gap-2 rounded-lg border border-slate-700 bg-slate-950/50 p-3 text-xs text-slate-300"><input type="checkbox" checked={applyContractData} onChange={(e) => setApplyContractData(e.target.checked)}/>Actualizar ficha del inmueble, inquilino, fianza y alquiler desde el mes de inicio. Los gastos no se modifican.</label></>}<ModalActions busy={busy} submit={editingContract ? "Guardar cambios" : "Guardar contrato y PDF"} onCancel={() => { setNewContractOpen(false); setEditingContract(null); setPendingContractId(null) }}/></div>{editingContract && <aside className="flex min-h-[560px] flex-col rounded-2xl border border-slate-700 bg-slate-950 p-3"><div className="mb-3 flex items-center justify-between gap-2"><div><h4 className="text-sm font-bold text-slate-100">Previsualización del contrato</h4><p className="mt-1 truncate text-[11px] text-slate-500">{editingContractPdf?.fileName || "Sin PDF adjunto"}</p></div></div>{editingContractPdf ? <EditorPdfPreview version={editingContractPdf}/> : <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-slate-700 text-center text-xs text-slate-500">Este contrato todavía no tiene un PDF.</div>}</aside>}</form>}
      {uploadTarget && <form onSubmit={(e) => void handleVersionUpload(e)} className="space-y-4"><p className="text-sm text-slate-300">Selecciona una nueva versión. La versión anterior seguirá disponible.</p><Field label="PDF *">{filePicker(versionFile, setVersionFile)}</Field><ModalActions busy={busy} submit="Guardar nueva versión" onCancel={() => setUploadTarget(null)}/></form>}
      {newAddendumFor && <form onSubmit={(e) => void handleAddendum(e)} className="space-y-3"><div className="grid gap-3 sm:grid-cols-2"><Field label="Título de la adenda *"><input required className={fieldClass} value={addendumTitle} onChange={(e) => setAddendumTitle(e.target.value)} placeholder="Actualización de renta"/></Field><Field label="Fecha *"><input required type="date" className={fieldClass} value={addendumDate} onChange={(e) => setAddendumDate(e.target.value)}/></Field><Field label="Nueva renta (€), si aplica"><input type="number" min="0" step="0.01" className={fieldClass} value={addendumRent} onChange={(e) => setAddendumRent(e.target.value)}/></Field><Field label="Aplicar desde"><input type="month" className={fieldClass} value={rentEffectiveFrom} onChange={(e) => setRentEffectiveFrom(e.target.value)}/></Field></div><Field label="Notas"><textarea rows={2} className={fieldClass} value={addendumNotes} onChange={(e) => setAddendumNotes(e.target.value)}/></Field><Field label="PDF de la adenda *">{filePicker(addendumPdf, setAddendumPdf)}</Field>{addendumRent && <label className="flex gap-2 rounded-lg border border-slate-700 bg-slate-950/50 p-3 text-xs text-slate-300"><input type="checkbox" checked={applyAddendumRent} onChange={(e) => setApplyAddendumRent(e.target.checked)}/>Actualizar el alquiler actual y su histórico desde el mes seleccionado; no modifica gastos.</label>}<ModalActions busy={busy} submit="Guardar adenda y PDF" onCancel={() => setNewAddendumFor(null)}/></form>}
    </div></div>}
    <ConfirmModal isOpen={deleteTarget !== null && deleteStep === 1} title="¿Borrar este contrato?" message={`Se ocultará el contrato de esta propiedad. Sus PDFs y versiones se conservarán en Firestore.`} confirmButtonText="Continuar" onConfirm={() => setDeleteStep(2)} onClose={() => { setDeleteTarget(null); setDeleteStep(0) }} />
    <ConfirmModal isOpen={deleteTarget !== null && deleteStep === 2} title="Confirmación final" message={`Vas a borrar el contrato de "${deleteTarget?.tenantName}". Esta acción no se puede deshacer desde la aplicación.`} confirmWord="BORRAR" confirmButtonText="Borrar contrato" isLoading={busy} onConfirm={() => void confirmDeleteContract()} onClose={() => { if (!busy) { setDeleteTarget(null); setDeleteStep(0) } }} />
  </div>
}

function PdfThumbnail({ version, title, compact = false, onOpen }: { version: ContractFileVersion; title: string; compact?: boolean; onOpen: () => void }) {
  const [url, setUrl] = useState('')
  const thumbnailRef = useRef<HTMLButtonElement | null>(null)
  useEffect(() => {
    let active = true
    let objectUrl = ''
    const loadPreview = () => {
      getContractPdfBlob(version.id).then((blob) => {
        if (!active) return
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      }).catch(() => undefined)
    }
    const element = thumbnailRef.current
    if (!element || !('IntersectionObserver' in window)) loadPreview()
    else {
      const observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) { observer.disconnect(); loadPreview() }
      }, { rootMargin: '120px' })
      observer.observe(element)
      return () => { active = false; observer.disconnect(); if (objectUrl) URL.revokeObjectURL(objectUrl) }
    }
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [version.id])
  return <button ref={thumbnailRef} type="button" onClick={onOpen} className="group block w-full overflow-hidden rounded-lg border border-slate-700 bg-slate-900 text-left" title={`Previsualizar ${title}`}>
    <div className={`relative w-full overflow-hidden bg-slate-800 ${compact ? 'h-[4.5rem]' : 'h-36'}`}>{url ? <iframe title={`Vista previa ${title}`} src={`${url}#zoom=175`} tabIndex={-1} className={`pointer-events-none absolute left-0 top-0 w-[200%] origin-top-left scale-50 ${compact ? 'h-[210px]' : 'h-[420px]'}`} /> : <div className="flex h-full items-center justify-center text-4xl text-teal-300">▤</div>}<span className="absolute inset-0 bg-transparent group-hover:bg-teal-400/5" /></div>
    <div className="truncate border-t border-slate-800 px-2 py-1.5 text-[10px] text-slate-300">Vista previa · {version.fileName}</div>
  </button>
}
function EditorPdfPreview({ version }: { version: ContractFileVersion }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    let active = true
    let objectUrl = ''
    getContractPdfBlob(version.id).then((blob) => {
      if (!active) return
      objectUrl = URL.createObjectURL(blob)
      setUrl(objectUrl)
    }).catch(() => undefined)
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [version.id])
  return url ? <iframe title={`Previsualización ${version.fileName}`} src={url} className="min-h-[500px] flex-1 rounded-xl bg-slate-800" /> : <div className="flex min-h-[500px] flex-1 items-center justify-center text-xs text-slate-500">Cargando previsualización…</div>
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className={labelClass}>{label}</span>{children}</label> }
function ModalActions({ busy, submit, onCancel }: { busy: boolean; submit: string; onCancel: () => void }) { return <div className="flex justify-end gap-2 border-t border-slate-800 pt-4"><button type="button" disabled={busy} onClick={onCancel} className="rounded-lg px-4 py-2 text-xs text-slate-300 hover:bg-slate-800">Cancelar</button><button disabled={busy} type="submit" className="rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{busy ? 'Guardando…' : submit}</button></div> }
function euro(value: number) { return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value) }
function timestamp(value: any) { if (typeof value?.toMillis === 'function') return value.toMillis(); if (value instanceof Date) return value.getTime(); return Date.parse(String(value || '')) || 0 }
