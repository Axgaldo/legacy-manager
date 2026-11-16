import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Property, Tenant, TenantDocument } from '@/types'
import { propertySlug } from '@/utils/slugs'
import { subscribeToProperties } from '@/features/properties/propertiesService'
import TenantModal from './TenantModal'
import {
  countDocumentsByTenant,
  migratePropertyTenants,
  subscribeToAllTenantDocuments,
  subscribeToTenants,
} from './tenantsService'

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || '👤'
}

export default function TenantsPage({ embedded = false }: { embedded?: boolean }) {
  const navigate = useNavigate()
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [documents, setDocuments] = useState<TenantDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [migrationNotice, setMigrationNotice] = useState('')

  useEffect(() => subscribeToTenants((items) => {
    setTenants(items)
    setLoading(false)
  }, (err) => {
    setError(err.message)
    setLoading(false)
  }), [])

  useEffect(() => subscribeToProperties(setProperties, (err) => setError(err.message)), [])
  useEffect(() => subscribeToAllTenantDocuments(setDocuments, (err) => console.error('No se pudo cargar el índice de documentos:', err)), [])

  // One-time import of tenants embedded in legacy property documents.
  useEffect(() => {
    if (!properties.length) return
    let active = true
    ;(async () => {
      let migrated = 0
      for (const property of properties) {
        if (!active) return
        migrated += await migratePropertyTenants(property)
      }
      if (active && migrated > 0) {
        setMigrationNotice(`Se ${migrated === 1 ? 'ha' : 'han'} importado ${migrated} inquilino${migrated === 1 ? '' : 's'} que estaba${migrated === 1 ? '' : 'n'} guardado${migrated === 1 ? '' : 's'} dentro de los inmuebles.`)
      }
    })()
    return () => { active = false }
  }, [properties])

  const documentCounts = useMemo(() => countDocumentsByTenant(documents), [documents])

  const propertiesByTenant = useMemo(() => {
    const map = new Map<string, Property[]>()
    properties.forEach((property) => {
      ;(property.tenantIds ?? []).forEach((tenantId) => {
        map.set(tenantId, [...(map.get(tenantId) ?? []), property])
      })
    })
    return map
  }, [properties])

  const filteredTenants = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase('es')
    if (!query) return tenants
    return tenants.filter((tenant) => {
      const propertyNames = (propertiesByTenant.get(tenant.id) ?? []).map((property) => `${property.name} ${property.address} ${property.city}`).join(' ')
      return [tenant.name, tenant.nif, tenant.phone, tenant.email, tenant.notes, propertyNames]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase('es').includes(query))
    })
  }, [tenants, searchQuery, propertiesByTenant])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          {!embedded && <h2 className="text-2xl font-bold tracking-tight text-slate-100">Inquilinos</h2>}
          <p className={`${embedded ? '' : 'mt-1 '}max-w-2xl text-sm text-slate-400`}>
            Fichas independientes con sus datos y documentos. Vincula cada inquilino a uno o varios inmuebles desde la ficha del inmueble o desde aquí.
          </p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-teal-600">
          <span className="text-lg">＋</span>Nuevo inquilino
        </button>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-xs text-slate-400">
        <strong className="text-slate-200">Flujo recomendado:</strong> crea primero el inmueble sin inquilinos y después crea aquí la ficha del inquilino. En la ficha del inmueble, pestaña «Inquilinos», podrás vincularlo en un clic.
      </div>

      {migrationNotice && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-emerald-900 bg-emerald-950/50 px-4 py-3 text-xs text-emerald-200">
          <span>✨ {migrationNotice}</span>
          <button onClick={() => setMigrationNotice('')} className="text-emerald-300 hover:text-white">✕</button>
        </div>
      )}

      {error && <div className="rounded-xl border border-red-900 bg-red-950/50 px-4 py-3 text-sm text-red-200">{error}</div>}

      <div className="relative max-w-md">
        <input
          type="text"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Buscar por nombre, DNI, contacto o inmueble…"
          className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 pl-9 text-sm text-slate-100 placeholder:text-slate-500 focus:border-teal-500 focus:outline-none"
        />
        <span className="absolute left-3 top-2.5 text-slate-500">🔍</span>
      </div>

      {loading ? (
        <div className="py-16 text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-3 border-teal-700 border-t-transparent" />
          <p className="text-sm text-slate-400">Cargando inquilinos…</p>
        </div>
      ) : filteredTenants.length === 0 ? (
        <div className="mx-auto max-w-lg rounded-2xl border border-dashed border-slate-700 bg-slate-900 p-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-800 text-2xl">👥</div>
          <h3 className="text-base font-bold text-slate-100">{tenants.length === 0 ? 'Todavía no hay inquilinos' : 'Sin resultados'}</h3>
          <p className="mx-auto mt-1.5 max-w-xs text-xs text-slate-400">
            {tenants.length === 0 ? 'Crea una ficha de inquilino para guardar sus datos, documentos y los inmuebles vinculados.' : 'Prueba con otro nombre, DNI o inmueble.'}
          </p>
          {tenants.length === 0 && (
            <button onClick={() => setIsModalOpen(true)} className="mt-5 rounded-xl bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-600">+ Crear primer inquilino</button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredTenants.map((tenant) => {
            const linkedProperties = propertiesByTenant.get(tenant.id) ?? []
            const docCount = documentCounts.get(tenant.id) ?? 0
            return (
              <div
                key={tenant.id}
                role="link"
                tabIndex={0}
                onClick={() => navigate(`/inmuebles/inquilinos/${tenant.id}`)}
                onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); navigate(`/inmuebles/inquilinos/${tenant.id}`) } }}
                className="group flex cursor-pointer flex-col rounded-2xl border border-slate-800 bg-slate-900 p-5 text-left transition hover:border-teal-700 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-950 text-sm font-bold text-teal-200 ring-1 ring-teal-900">{initials(tenant.name)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-semibold text-slate-100 group-hover:text-teal-200">{tenant.name}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-400">{tenant.nif ? `DNI/NIF: ${tenant.nif}` : 'Sin DNI/NIF'}</p>
                  </div>
                  {tenant.isActive === false && <span className="rounded-full border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-400">Inactivo</span>}
                </div>

                <div className="mt-3 space-y-1 text-xs text-slate-300">
                  {tenant.phone && <p>📞 {tenant.phone}</p>}
                  {tenant.email && <p className="truncate">✉️ {tenant.email}</p>}
                  {!tenant.phone && !tenant.email && <p className="text-slate-500">Sin datos de contacto</p>}
                </div>

                <div className="mt-4 flex flex-wrap gap-1.5 border-t border-slate-800 pt-3">
                  {linkedProperties.length === 0 ? (
                    <span className="rounded-full border border-dashed border-slate-700 px-2 py-0.5 text-[10px] text-slate-500">Sin inmueble vinculado</span>
                  ) : linkedProperties.map((property) => (
                    <Link
                      key={property.id}
                      to={`/inmuebles/${propertySlug(property, properties)}`}
                      onClick={(event) => event.stopPropagation()}
                      className="truncate rounded-full border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-teal-200 hover:border-teal-600"
                    >
                      🏠 {property.name}
                    </Link>
                  ))}
                  <span className="ml-auto rounded-full border border-slate-700 px-2 py-0.5 text-[10px] text-slate-400">📎 {docCount}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <TenantModal isOpen={isModalOpen} tenantToEdit={null} onClose={() => setIsModalOpen(false)} onSaved={() => {}} />
    </div>
  )
}
