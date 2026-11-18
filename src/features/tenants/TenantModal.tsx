import { FormEvent, useEffect, useState } from 'react'
import { Tenant } from '@/types'
import { createTenant, updateTenant } from './tenantsService'
import { useFocusTrap } from '@/hooks/useFocusTrap'

interface TenantModalProps {
  isOpen: boolean
  tenantToEdit: Tenant | null
  onClose: () => void
  onSaved: (tenantId: string) => void
}

const EMPTY_FORM = {
  name: '',
  nif: '',
  phone: '',
  email: '',
  birthDate: '',
  address: '',
  city: '',
  province: '',
  postalCode: '',
  iban: '',
  notes: '',
  isActive: true,
}

export default function TenantModal({ isOpen, tenantToEdit, onClose, onSaved }: TenantModalProps) {
  const trapRef = useFocusTrap<HTMLDivElement>(isOpen, onClose)
  const [form, setForm] = useState(EMPTY_FORM)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (tenantToEdit) {
      setForm({
        name: tenantToEdit.name,
        nif: tenantToEdit.nif ?? '',
        phone: tenantToEdit.phone ?? '',
        email: tenantToEdit.email ?? '',
        birthDate: tenantToEdit.birthDate ?? '',
        address: tenantToEdit.address ?? '',
        city: tenantToEdit.city ?? '',
        province: tenantToEdit.province ?? '',
        postalCode: tenantToEdit.postalCode ?? '',
        iban: tenantToEdit.iban ?? '',
        notes: tenantToEdit.notes ?? '',
        isActive: tenantToEdit.isActive !== false,
      })
    } else {
      setForm(EMPTY_FORM)
    }
    setError('')
  }, [tenantToEdit, isOpen])

  if (!isOpen) return null

  const update = (field: keyof typeof EMPTY_FORM, value: string | boolean) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!form.name.trim()) {
      setError('Indica al menos el nombre completo del inquilino.')
      return
    }
    setIsSaving(true)
    setError('')
    try {
      const payload = {
        name: form.name.trim(),
        nif: form.nif.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        birthDate: form.birthDate || undefined,
        address: form.address.trim() || undefined,
        city: form.city.trim() || undefined,
        province: form.province.trim() || undefined,
        postalCode: form.postalCode.trim() || undefined,
        iban: form.iban.trim() || undefined,
        notes: form.notes.trim() || undefined,
        isActive: form.isActive,
      }
      const tenantId = tenantToEdit ? tenantToEdit.id : await createTenant(payload)
      if (tenantToEdit) await updateTenant(tenantToEdit.id, payload)
      onSaved(tenantId)
      onClose()
    } catch (err: any) {
      console.error(err)
      setError(err?.message || 'No se pudo guardar el inquilino.')
    } finally {
      setIsSaving(false)
    }
  }

  const inputClass = 'w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-teal-500 focus:outline-none'
  const labelClass = 'mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400'

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-slate-950/80 p-3 backdrop-blur-xs sm:items-center sm:p-4">
      <div ref={trapRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={tenantToEdit ? 'Editar inquilino' : 'Nuevo inquilino'} className="my-auto w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl sm:p-7">
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-100">{tenantToEdit ? 'Editar inquilino' : 'Nuevo inquilino'}</h2>
            <p className="mt-1 text-xs text-slate-400">Los documentos se añaden después, desde la ficha del inquilino.</p>
          </div>
          <button type="button" aria-label="Cerrar" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200">✕</button>
        </div>

        {error && <div className="mt-4 rounded-xl border border-red-800 bg-red-950/60 p-3 text-sm text-red-200">{error}</div>}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <label className="block">
            <span className={labelClass}>Nombre completo *</span>
            <input autoFocus required value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="Nombre y apellidos" className={inputClass} />
          </label>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className={labelClass}>DNI / NIF</span>
              <input value={form.nif} onChange={(event) => update('nif', event.target.value)} placeholder="12345678A" className={inputClass} />
            </label>
            <label className="block">
              <span className={labelClass}>Teléfono</span>
              <input value={form.phone} onChange={(event) => update('phone', event.target.value)} placeholder="600 000 000" className={inputClass} />
            </label>
            <label className="block">
              <span className={labelClass}>Correo</span>
              <input type="email" value={form.email} onChange={(event) => update('email', event.target.value)} placeholder="correo@ejemplo.com" className={inputClass} />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={labelClass}>Fecha de nacimiento</span>
              <input type="date" value={form.birthDate} onChange={(event) => update('birthDate', event.target.value)} className={inputClass} />
            </label>
            <label className="block">
              <span className={labelClass}>IBAN</span>
              <input value={form.iban} onChange={(event) => update('iban', event.target.value)} placeholder="ES00 0000 0000 0000 0000 0000" className={`${inputClass} font-mono`} />
            </label>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-teal-300">Dirección</h3>
            <div className="space-y-3">
              <label className="block">
                <span className={labelClass}>Dirección</span>
                <input value={form.address} onChange={(event) => update('address', event.target.value)} placeholder="Calle, número, piso" className={inputClass} />
              </label>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block">
                  <span className={labelClass}>Municipio</span>
                  <input value={form.city} onChange={(event) => update('city', event.target.value)} className={inputClass} />
                </label>
                <label className="block">
                  <span className={labelClass}>Provincia</span>
                  <input value={form.province} onChange={(event) => update('province', event.target.value)} className={inputClass} />
                </label>
                <label className="block">
                  <span className={labelClass}>C.P.</span>
                  <input value={form.postalCode} onChange={(event) => update('postalCode', event.target.value)} className={inputClass} />
                </label>
              </div>
            </div>
          </div>

          <label className="block">
            <span className={labelClass}>Notas</span>
            <textarea value={form.notes} onChange={(event) => update('notes', event.target.value)} rows={3} placeholder="Observaciones, avalista, incidencias…" className={`${inputClass} resize-y`} />
          </label>

          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={form.isActive} onChange={(event) => update('isActive', event.target.checked)} className="accent-teal-500" />
            Inquilino activo
          </label>

          <div className="flex justify-end gap-2 border-t border-slate-800 pt-4">
            <button type="button" onClick={onClose} disabled={isSaving} className="rounded-lg px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">Cancelar</button>
            <button type="submit" disabled={isSaving} className="rounded-lg bg-teal-700 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-600 disabled:bg-slate-700">
              {isSaving ? 'Guardando…' : tenantToEdit ? 'Guardar cambios' : 'Crear inquilino'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
