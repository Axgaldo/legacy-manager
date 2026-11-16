import React, { useState, useEffect } from 'react'
import { Property, PropertyType, PropertyStatus } from '@/types'
import { createProperty, updateProperty } from './propertiesService'
import { resolveOwnerName } from '@/utils/owners'

const SPANISH_PROVINCES = ['A Coruña', 'Álava', 'Albacete', 'Alicante', 'Almería', 'Asturias', 'Ávila', 'Badajoz', 'Barcelona', 'Bizkaia', 'Burgos', 'Cáceres', 'Cádiz', 'Cantabria', 'Castellón', 'Ciudad Real', 'Córdoba', 'Cuenca', 'Girona', 'Granada', 'Guadalajara', 'Gipuzkoa', 'Huelva', 'Huesca', 'Illes Balears', 'Jaén', 'La Rioja', 'Las Palmas', 'León', 'Lleida', 'Lugo', 'Madrid', 'Málaga', 'Murcia', 'Navarra', 'Ourense', 'Palencia', 'Pontevedra', 'Salamanca', 'Santa Cruz de Tenerife', 'Segovia', 'Sevilla', 'Soria', 'Tarragona', 'Teruel', 'Toledo', 'Valencia', 'Valladolid', 'Zamora', 'Zaragoza', 'Ceuta', 'Melilla']

const PROPERTY_TYPES: { value: PropertyType; label: string; icon: string }[] = [
  { value: 'apartment', label: 'Piso / Apartamento', icon: '🏢' },
  { value: 'commercial', label: 'Local Comercial', icon: '🏪' },
  { value: 'garage', label: 'Plaza de Garaje', icon: '🚗' },
  { value: 'storage', label: 'Trastero', icon: '📦' },
  { value: 'house', label: 'Casa / Chalet', icon: '🏡' },
  { value: 'rural', label: 'Finca / Terreno Rústico', icon: '🌳' },
]

const PROPERTY_STATUSES: { value: PropertyStatus; label: string; color: string }[] = [
  { value: 'rented', label: 'Alquilado', color: 'bg-emerald-50 text-emerald-700 border-slate-700' },
  { value: 'vacant', label: 'Vacío / Disponible', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: 'owner-use', label: 'Uso propio', color: 'bg-slate-800 text-teal-200 border-slate-700' },
]

interface PropertyModalProps {
  isOpen: boolean
  propertyToEdit: Property | null
  owners: string[]
  defaultOwner: string
  onClose: () => void
  onSaved: () => void
}

export default function PropertyModal({
  isOpen,
  propertyToEdit,
  owners,
  defaultOwner,
  onClose,
  onSaved,
}: PropertyModalProps) {
  const [name, setName] = useState('')
  const [owner, setOwner] = useState('')
  const [type, setType] = useState<PropertyType>('apartment')
  const [status, setStatus] = useState<PropertyStatus>('rented')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('Sevilla')
  const [province, setProvince] = useState('Sevilla')
  const [postalCode, setPostalCode] = useState('')
  const [cadastralReference, setCadastralReference] = useState('')
  const [monthlyRent, setMonthlyRent] = useState('')
  const [rentRequiresInvoice, setRentRequiresInvoice] = useState(false)
  const [rentStartMonth, setRentStartMonth] = useState('')
  const [depositAmount, setDepositAmount] = useState('')
  const [avraReference, setAvraReference] = useState('')
  const [fixedExpensesMonthly, setFixedExpensesMonthly] = useState('')
  const [currentValue, setCurrentValue] = useState('')
  const [notes, setNotes] = useState('')

  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (propertyToEdit) {
      setName(propertyToEdit.name)
      setOwner(propertyToEdit.owner || '')
      setType(propertyToEdit.type)
      setStatus(propertyToEdit.status)
      setAddress(propertyToEdit.address)
      setCity(propertyToEdit.city)
      setProvince(propertyToEdit.province || 'Sevilla')
      setPostalCode(propertyToEdit.postalCode || '')
      setCadastralReference(propertyToEdit.cadastralReference || '')
      setMonthlyRent('')
      setRentRequiresInvoice(propertyToEdit.rentRequiresInvoice ?? false)
      setRentStartMonth(propertyToEdit.rentStartMonth || '')
      setDepositAmount(propertyToEdit.depositAmount ? String(propertyToEdit.depositAmount) : '')
      setAvraReference(propertyToEdit.avraReference || '')
      setFixedExpensesMonthly(
        propertyToEdit.fixedExpensesMonthly ? String(propertyToEdit.fixedExpensesMonthly) : '',
      )
      setCurrentValue(propertyToEdit.currentValue ? String(propertyToEdit.currentValue) : '')
      setNotes(propertyToEdit.notes || '')
    } else {
      setName('')
      setOwner('')
      setType('apartment')
      setStatus('rented')
      setAddress('')
      setCity('Sevilla')
      setProvince('Sevilla')
      setPostalCode('')
      setCadastralReference('')
      setMonthlyRent('')
      setRentRequiresInvoice(false)
      setRentStartMonth(new Date().toLocaleDateString('sv-SE').slice(0, 7))
      setDepositAmount('')
      setAvraReference('')
      setFixedExpensesMonthly('')
      setCurrentValue('')
      setNotes('')
    }
    setErrorMsg('')
  }, [propertyToEdit, isOpen])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setErrorMsg('Por favor, indica un nombre o alias para el inmueble.')
      return
    }

    setIsLoading(true)
    setErrorMsg('')

    try {
      const parsedRent = monthlyRent ? parseFloat(monthlyRent) : undefined
      const legacyBaselineMonth = new Date().toLocaleDateString('sv-SE').slice(0, 7)
      const rentHistory = propertyToEdit?.rentHistory ?? (parsedRent !== undefined ? [{ effectiveFrom: legacyBaselineMonth, amount: parsedRent }] : [])
      const payload = {
        name: name.trim(),
        owner: resolveOwnerName(owner, owners, defaultOwner),
        type,
        status,
        address: address.trim(),
        city: city.trim(),
        province,
        postalCode: postalCode.trim() || undefined,
        cadastralReference: cadastralReference.trim() || undefined,
        ...(propertyToEdit ? {} : { monthlyRent: parsedRent, rentHistory }),
        rentRequiresInvoice,
        rentStartMonth,
        ...(propertyToEdit?.rentHistory ? { rentHistory: propertyToEdit.rentHistory } : {}),
        depositAmount: depositAmount ? parseFloat(depositAmount) : undefined,
        avraReference: avraReference.trim() || undefined,
        fixedExpensesMonthly: fixedExpensesMonthly ? parseFloat(fixedExpensesMonthly) : undefined,
        currentValue: currentValue ? parseFloat(currentValue) : undefined,
        notes: notes.trim() || undefined,
      }

      if (propertyToEdit) {
        await updateProperty(propertyToEdit.id, payload)
      } else {
        await createProperty(payload)
      }

      setIsLoading(false)
      onSaved()
      onClose()
    } catch (err: any) {
      console.error(err)
      setErrorMsg('Hubo un error al guardar en Firestore: ' + (err.message || 'Error desconocido'))
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/80 p-3 backdrop-blur-xs sm:items-center sm:p-4">
      <div className="my-auto max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:p-8">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {propertyToEdit ? 'Editar Inmueble' : 'Añadir Nuevo Inmueble'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Completa los datos del inmueble para el control patrimonial.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 rounded-lg p-1.5 transition"
          >
            ✕
          </button>
        </div>

        {errorMsg && (
          <div className="mt-4 p-3 rounded-xl bg-red-50 text-red-700 text-sm font-medium border border-red-200">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          {/* Propietario / Titular */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Propietario / Titular
            </label>
            <input
              type="text"
              list="property-owner-suggestions"
              value={owner}
              onChange={(event) => setOwner(event.target.value)}
              placeholder={defaultOwner}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-teal-500 focus:outline-none"
            />
            <datalist id="property-owner-suggestions">{owners.map((item) => <option key={item} value={item} />)}</datalist>
            <p className="mt-1 text-[11px] text-slate-500">Elige un propietario existente o escribe uno nuevo. Si lo dejas vacío se usará {defaultOwner}.</p>
          </div>

          {/* Nombre y Tipo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Nombre / Alias *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Piso Triana 2ºB o Garaje Centro"
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Tipo de Inmueble
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as PropertyType)}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:outline-hidden bg-slate-950"
              >
                {PROPERTY_TYPES.map((pt) => (
                  <option key={pt.value} value={pt.value}>
                    {pt.icon} {pt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Estado actual */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Estado actual
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {PROPERTY_STATUSES.map((ps) => {
                const isSelected = status === ps.value
                return (
                  <button
                    key={ps.value}
                    type="button"
                    onClick={() => setStatus(ps.value)}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition text-center ${
                      isSelected
                        ? `${ps.color} ring-2 ring-teal-500 shadow-xs font-bold`
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {ps.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Ubicación: Dirección, Ciudad, Provincia */}
          <div className="p-4 bg-slate-50 rounded-xl space-y-3.5 border border-slate-200/60">
            <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">
              Inmueble en España
            </h4>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Dirección completa (Calle, nº, piso)
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Ej. C/ Betis 14, 2º Izquierda"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Municipio</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Ej. Sevilla"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Provincia</label>
                <select
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                >
                  {SPANISH_PROVINCES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Código Postal</label>
                <input
                  type="text"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="41010"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Rental data is kept separate from the physical property details. */}
          <div className="space-y-4">
              <section className="rounded-xl border border-slate-700 bg-slate-900 p-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-teal-300">Inquilinos</h4>
                <p className="mt-2 text-xs text-slate-400">
                  {propertyToEdit
                    ? 'Los inquilinos se gestionan desde la pestaña «Inquilinos» de la ficha del inmueble. Allí puedes crear fichas, vincularlas y subir sus documentos.'
                    : 'Primero guarda el inmueble. Después podrás crear inquilinos y vincularlos desde su ficha, en la pestaña «Inquilinos».'}
                </p>
                {propertyToEdit && (
                  <p className="mt-2 text-xs font-semibold text-slate-200">
                    Vinculados actualmente: {propertyToEdit.tenantIds?.length ?? 0}
                  </p>
                )}
              </section>
              {status === 'rented' && <section className="rounded-xl border border-slate-700 bg-slate-900 p-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-teal-300">Condiciones del alquiler</h4>
                {propertyToEdit ? <p className="mt-2 text-xs text-slate-400">La renta se cambia desde el control mensual, con el botón «Cambio de renta» del mes a partir del que se aplique.</p> : <label className="mt-3 block text-xs text-slate-300">Renta mensual inicial (€)<input type="number" min="0" step="0.01" value={monthlyRent} onChange={(e) => setMonthlyRent(e.target.value)} placeholder="750" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-semibold text-slate-100"/></label>}
                <label className="mt-3 block text-xs text-slate-300">Inicio del alquiler<input type="month" value={rentStartMonth} onChange={(e) => setRentStartMonth(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"/><span className="mt-1 block text-[11px] text-slate-500">Los meses anteriores no generarán alquiler pendiente ni aparecerán como atrasos. En inmuebles antiguos, deja el campo vacío si quieres conservar su cálculo histórico actual.</span></label>
                <label className="mt-3 flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={rentRequiresInvoice} onChange={(e) => setRentRequiresInvoice(e.target.checked)} className="accent-teal-500"/>El alquiler requiere factura / recibo</label>
                <div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-xs text-slate-300">Fianza (€)<input type="number" min="0" step="0.01" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} placeholder="Importe depositado" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"/></label><label className="text-xs text-slate-300">Referencia del depósito de fianza<input value={avraReference} onChange={(e) => setAvraReference(e.target.value)} placeholder="Referencia autonómica (opcional)" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-mono text-slate-100"/></label></div>
              </section>}
          </div>

          {/* Finanzas: Gastos fijos y Valor estimado */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Gastos fijos estimados al mes (€)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={fixedExpensesMonthly}
                onChange={(e) => setFixedExpensesMonthly(e.target.value)}
                placeholder="Ej. 65 (comunidad + IBI/12)"
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
              />
              <span className="text-[11px] text-slate-400">Comunidad, seguros, IBI prorrateado</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Valor estimado del inmueble (€)
              </label>
              <input
                type="number"
                step="1000"
                min="0"
                value={currentValue}
                onChange={(e) => setCurrentValue(e.target.value)}
                placeholder="Ej. 180000"
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
              />
              <span className="text-[11px] text-slate-400">Valor de tasación o mercado aproximado</span>
            </div>
          </div>

          {/* Referencia Catastral y Notas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Referencia Catastral (opcional)
              </label>
              <input
                type="text"
                value={cadastralReference}
                onChange={(e) => setCadastralReference(e.target.value)}
                placeholder="20 caracteres (Sede Catastro)"
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Notas adicionales
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Cualquier apunte relevante..."
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex items-center justify-end gap-3 pt-5 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-2.5 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-600 active:scale-98 rounded-xl shadow-md transition disabled:bg-slate-300"
            >
              {isLoading ? 'Guardando en Firebase…' : propertyToEdit ? 'Guardar Cambios' : 'Crear Inmueble'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
