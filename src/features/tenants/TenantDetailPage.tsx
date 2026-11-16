import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Property, Tenant } from '@/types'
import { propertySlug } from '@/utils/slugs'
import { subscribeToProperties } from '@/features/properties/propertiesService'
import ConfirmModal from '@/components/ui/ConfirmModal'
import TenantModal from './TenantModal'
import TenantDocumentsPanel from './TenantDocumentsPanel'
import {
  deleteTenantCompletely,
  linkTenantToProperty,
  subscribeToTenants,
  unlinkTenantFromProperty,
} from './tenantsService'

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || '👤'
}

function formatAddress(tenant: Tenant): string {
  return [tenant.address, tenant.postalCode, tenant.city, tenant.province].filter(Boolean).join(', ')
}

export default function TenantDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [propertyToLink, setPropertyToLink] = useState('')
  const [busyPropertyId, setBusyPropertyId] = useState<string | null>(null)

  useEffect(() => subscribeToTenants((items) => {
    setTenants(items)
    setLoaded(true)
  }, (err) => {
    setError(err.message)
    setLoaded(true)
  }), [])
  useEffect(() => subscribeToProperties(setProperties, (err) => setError(err.message)), [])

  const tenant = useMemo(() => tenants.find((item) => item.id === id) ?? null, [tenants, id])
  const linkedProperties = useMemo(() => properties.filter((property) => (property.tenantIds ?? []).includes(id ?? '')), [properties, id])
  const availableProperties = useMemo(() => properties.filter((property) => !(property.tenantIds ?? []).includes(id ?? '')), [properties, id])

  const handleLink = async (event: FormEvent) => {
    event.preventDefault()
    if (!tenant || !propertyToLink) return
    const property = properties.find((item) => item.id === propertyToLink)
    if (!property) return
    setError('')
    try {
      await linkTenantToProperty(property, tenant.id)
      setPropertyToLink('')
    } catch (err: any) {
      setError(err?.message || 'No se pudo vincular el inmueble.')
    }
  }

  const handleUnlink = async (property: Property) => {
    if (!tenant) return
    setBusyPropertyId(property.id)
    setError('')
    try {
      await unlinkTenantFromProperty(property, tenant.id)
    } catch (err: any) {
      setError(err?.message || 'No se pudo desvincular el inmueble.')
    } finally {
      setBusyPropertyId(null)
    }
  }

  const handleDelete = async () => {
    if (!tenant) return
    setIsDeleting(true)
    setError('')
    try {
      await deleteTenantCompletely(tenant.id, properties)
      navigate('/inmuebles/inquilinos', { replace: true })
    } catch (err: any) {
      setError(err?.message || 'No se pudo eliminar el inquilino.')
      setIsDeleting(false)
      setIsDeleteOpen(false)
    }
  }

  if (!loaded) {
    return (
      <div className="py-20 text-center">
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-3 border-teal-700 border-t-transparent" />
        <p className="text-sm text-slate-400">Cargando la ficha del inquilino…</p>
      </div>
    )
  }

  if (!tenant) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-12 text-center">
        <p className="text-3xl">👤</p>
        <h3 className="mt-3 text-lg font-bold text-slate-100">Inquilino no encontrado</h3>
        <p className="mt-1 text-sm text-slate-400">Puede que se haya eliminado o que el enlace ya no sea válido.</p>
        <Link to="/inmuebles/inquilinos" className="mt-5 inline-block rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-600">← Volver a Inquilinos</Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Link to="/inmuebles/inquilinos" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-teal-200">← Volver a Inquilinos</Link>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setIsEditOpen(true)} className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-teal-600 hover:text-teal-200">Editar datos</button>
          <button onClick={() => setIsDeleteOpen(true)} className="rounded-lg border border-red-900 bg-red-950/40 px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-950/70">Eliminar inquilino</button>
        </div>
      </div>

      <header className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-6 sm:flex-row sm:items-center">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-teal-950 text-xl font-bold text-teal-200 ring-1 ring-teal-900">{initials(tenant.name)}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-100">{tenant.name}</h1>
            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${tenant.isActive === false ? 'border-slate-700 bg-slate-800 text-slate-400' : 'border-emerald-900 bg-emerald-950 text-emerald-200'}`}>
              {tenant.isActive === false ? 'Inactivo' : 'Activo'}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-400">{tenant.nif ? `DNI/NIF ${tenant.nif}` : 'Sin DNI/NIF'} · {linkedProperties.length} inmueble{linkedProperties.length === 1 ? '' : 's'} vinculado{linkedProperties.length === 1 ? '' : 's'}</p>
        </div>
      </header>

      {error && <div className="rounded-xl border border-red-900 bg-red-950/50 px-4 py-3 text-sm text-red-200">{error}</div>}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h3 className="text-base font-semibold text-slate-100">Datos personales y de contacto</h3>
          <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Teléfono</dt><dd className="mt-0.5 text-slate-200">{tenant.phone || '—'}</dd></div>
            <div><dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Correo</dt><dd className="mt-0.5 break-all text-slate-200">{tenant.email || '—'}</dd></div>
            <div><dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Fecha de nacimiento</dt><dd className="mt-0.5 text-slate-200">{tenant.birthDate || '—'}</dd></div>
            <div><dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">IBAN</dt><dd className="mt-0.5 break-all font-mono text-xs text-slate-200">{tenant.iban || '—'}</dd></div>
            <div className="sm:col-span-2"><dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Dirección</dt><dd className="mt-0.5 text-slate-200">{formatAddress(tenant) || '—'}</dd></div>
            <div className="sm:col-span-2"><dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Notas</dt><dd className="mt-0.5 whitespace-pre-wrap text-slate-300">{tenant.notes || '—'}</dd></div>
          </dl>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h3 className="text-base font-semibold text-slate-100">Inmuebles vinculados</h3>
          <p className="mt-1 text-xs text-slate-400">Un inquilino puede estar vinculado a más de un inmueble.</p>

          {linkedProperties.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-slate-700 p-4 text-xs text-slate-500">Todavía no está vinculado a ningún inmueble.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {linkedProperties.map((property) => (
                <li key={property.id} className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/50 p-2.5">
                  <Link to={`/inmuebles/${propertySlug(property, properties)}`} className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-100 hover:text-teal-200">🏠 {property.name}</p>
                    <p className="truncate text-[11px] text-slate-400">{[property.address, property.city].filter(Boolean).join(' · ') || 'Sin dirección'}</p>
                  </Link>
                  <button onClick={() => void handleUnlink(property)} disabled={busyPropertyId === property.id} className="shrink-0 rounded-lg border border-slate-700 px-2.5 py-1.5 text-[11px] font-semibold text-slate-300 hover:border-red-700 hover:text-red-300 disabled:opacity-50">
                    Desvincular
                  </button>
                </li>
              ))}
            </ul>
          )}

          {availableProperties.length > 0 && (
            <form onSubmit={handleLink} className="mt-4 flex flex-col gap-2 border-t border-slate-800 pt-4 sm:flex-row">
              <select value={propertyToLink} onChange={(event) => setPropertyToLink(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100">
                <option value="">Vincular a un inmueble…</option>
                {availableProperties.map((property) => <option key={property.id} value={property.id}>{property.name} · {property.city}</option>)}
              </select>
              <button type="submit" disabled={!propertyToLink} className="rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-600 disabled:bg-slate-700">Vincular</button>
            </form>
          )}
        </section>
      </div>

      <TenantDocumentsPanel tenantId={tenant.id} />

      <TenantModal isOpen={isEditOpen} tenantToEdit={tenant} onClose={() => setIsEditOpen(false)} onSaved={() => {}} />

      <ConfirmModal
        isOpen={isDeleteOpen}
        title={`¿Eliminar a ${tenant.name}?`}
        message={`Se eliminarán su ficha, sus documentos y los vínculos con ${linkedProperties.length} inmueble(s). Los inmuebles y sus datos no se tocan.`}
        confirmWord="BORRAR"
        confirmButtonText="Eliminar inquilino"
        isDestructive
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onClose={() => setIsDeleteOpen(false)}
      />
    </div>
  )
}
