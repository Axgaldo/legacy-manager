import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Property, Tenant } from '@/types'
import TenantModal from './TenantModal'
import { linkTenantToProperty, unlinkTenantFromProperty } from './tenantsService'

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || '👤'
}

interface PropertyTenantsPanelProps {
  property: Property
  tenants: Tenant[]
  documentCounts: Map<string, number>
}

export default function PropertyTenantsPanel({ property, tenants, documentCounts }: PropertyTenantsPanelProps) {
  const navigate = useNavigate()
  const [selectedTenantId, setSelectedTenantId] = useState('')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [error, setError] = useState('')
  const [busyTenantId, setBusyTenantId] = useState<string | null>(null)

  const linkedTenants = useMemo(() => {
    const ids = new Set(property.tenantIds ?? [])
    return tenants.filter((tenant) => ids.has(tenant.id))
  }, [property.tenantIds, tenants])
  const availableTenants = useMemo(() => {
    const ids = new Set(property.tenantIds ?? [])
    return tenants.filter((tenant) => !ids.has(tenant.id))
  }, [property.tenantIds, tenants])

  const handleLink = async () => {
    if (!selectedTenantId) return
    setError('')
    try {
      await linkTenantToProperty(property, selectedTenantId)
      setSelectedTenantId('')
    } catch (err: any) {
      setError(err?.message || 'No se pudo vincular el inquilino.')
    }
  }

  const handleUnlink = async (tenant: Tenant) => {
    setBusyTenantId(tenant.id)
    setError('')
    try {
      await unlinkTenantFromProperty(property, tenant.id)
    } catch (err: any) {
      setError(err?.message || 'No se pudo desvincular el inquilino.')
    } finally {
      setBusyTenantId(null)
    }
  }

  const handleCreated = async (tenantId: string) => {
    setError('')
    try {
      await linkTenantToProperty(property, tenantId)
    } catch (err: any) {
      setError(err?.message || 'El inquilino se creó, pero no se pudo vincular al inmueble. Hazlo desde su ficha.')
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-100">Inquilinos del inmueble</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Las fichas, documentos y datos personales se gestionan en la sección Inquilinos. Aquí solo se vinculan o desvinculan.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {availableTenants.length > 0 && (
            <>
              <select value={selectedTenantId} onChange={(event) => setSelectedTenantId(event.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200">
                <option value="">Elegir inquilino existente…</option>
                {availableTenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name}{tenant.nif ? ` · ${tenant.nif}` : ''}</option>)}
              </select>
              <button type="button" onClick={() => void handleLink()} disabled={!selectedTenantId} className="rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-600 disabled:bg-slate-700 disabled:text-slate-400">Vincular</button>
            </>
          )}
          <button type="button" onClick={() => setIsCreateOpen(true)} className="rounded-lg border border-teal-700 px-3 py-2 text-xs font-semibold text-teal-200 hover:bg-teal-950/40">＋ Nuevo inquilino</button>
        </div>
      </div>

      {error && <div className="rounded-xl border border-red-900 bg-red-950/50 px-4 py-3 text-sm text-red-300">{error}</div>}

      {property.tenants?.length && !property.tenantsMigrated ? (
        <p className="rounded-xl border border-amber-800 bg-amber-950/50 px-4 py-3 text-xs text-amber-200">Importando los inquilinos que estaban guardados dentro del inmueble…</p>
      ) : null}

      {linkedTenants.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900 p-10 text-center">
          <p className="text-3xl">👥</p>
          <h4 className="mt-2 text-sm font-bold text-slate-100">Sin inquilinos vinculados</h4>
          <p className="mx-auto mt-1 max-w-sm text-xs text-slate-500">Vincula una ficha existente o crea un inquilino nuevo. Después podrás añadir sus documentos desde su ficha.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {linkedTenants.map((tenant) => (
            <div
              key={tenant.id}
              role="link"
              tabIndex={0}
              onClick={() => navigate(`/inmuebles/inquilinos/${tenant.id}`)}
              onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); navigate(`/inmuebles/inquilinos/${tenant.id}`) } }}
              className="group flex cursor-pointer flex-col rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-xs transition hover:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-950/60 text-xs font-bold text-teal-300 ring-1 ring-teal-900">{initials(tenant.name)}</span>
                <div className="min-w-0 flex-1">
                  <p className="block truncate text-sm font-bold text-slate-100 group-hover:text-teal-300">{tenant.name}</p>
                  <p className="mt-0.5 truncate text-[11px] text-slate-500">{tenant.nif ? `DNI/NIF ${tenant.nif}` : 'Sin DNI/NIF'}</p>
                </div>
                {tenant.isActive === false && <span className="rounded-full border border-slate-700 bg-slate-950 px-2 py-0.5 text-[10px] font-semibold text-slate-400">Inactivo</span>}
              </div>

              <div className="mt-3 space-y-0.5 text-xs text-slate-400">
                {tenant.phone && <p>📞 {tenant.phone}</p>}
                {tenant.email && <p className="truncate">✉️ {tenant.email}</p>}
                {!tenant.phone && !tenant.email && <p className="text-slate-600">Sin datos de contacto</p>}
              </div>

              <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-800 pt-3">
                <span className="text-[11px] text-slate-500">📎 {documentCounts.get(tenant.id) ?? 0} documento(s)</span>
                <button
                  type="button"
                  onClick={(event) => { event.stopPropagation(); void handleUnlink(tenant) }}
                  disabled={busyTenantId === tenant.id}
                  className="rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-400 hover:bg-red-950/50 hover:text-red-400 disabled:opacity-50"
                  title="Quitar la vinculación con este inmueble"
                >
                  Desvincular
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <TenantModal
        isOpen={isCreateOpen}
        tenantToEdit={null}
        onClose={() => setIsCreateOpen(false)}
        onSaved={(tenantId) => { void handleCreated(tenantId) }}
      />

      <p className="text-[11px] text-slate-400">Los documentos de cada inquilino se suben desde su ficha, en la sección Inquilinos.</p>
    </section>
  )
}
