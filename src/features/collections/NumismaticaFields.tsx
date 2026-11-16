import React from 'react'
import { AssetCategory } from '@/types'
import { NUMISMATICA_DEFAULTS } from './AssetModal'

interface NumismaticaFieldsProps {
  values: Record<string, string>
  onChange: (field: string, value: string) => void
}

export function NumismaticaFields({ values, onChange }: NumismaticaFieldsProps) {
  const inputClass = 'w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20'
 
  const renderSelector = (label: string, field: string, defaults: string[]) => (
    <div className="flex-1">
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</label>
      <input
        type="text"
        value={values[field]}
        onChange={(e) => onChange(field, e.target.value)}
        placeholder={Seleccionar }
        className={inputClass}
        list={list-}
      />
      <datalist id={list-}>
        {defaults.map(opt => <option key={opt} value={opt} />)}
      </datalist>
    </div>
  )
 
  return (
    <div className="space-y-4 border-t border-slate-700 pt-6">
      <div className="flex items-center gap-2 text-teal-400">
        <span className="text-xl">??</span>
        <h3 className="text-lg font-bold">Detalles de Numismática</h3>
      </div>
      
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {renderSelector('Valor estimado', 'value', [])}
        {renderSelector('Valor de mercado', 'market_value', [])}
        {renderSelector('Año de compra', 'purchase_year', [])}
        {renderSelector('Estado de conservación', 'conservationState', NUMISMATICA_DEFAULTS.conservationState)}
        {renderSelector('Tipo de moneda', 'coin_type', NUMISMATICA_DEFAULTS.coin_type)}
        {renderSelector('Era', 'era', NUMISMATICA_DEFAULTS.era)}
        {renderSelector('Libro de referencia', 'reference_book', NUMISMATICA_DEFAULTS.reference_book)}
      </div>
 
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex-1">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Anverso</label>
          <textarea
            rows={2}
            value={values.obverse_info}
            onChange={(e) => onChange('obverse_info', e.target.value)}
            className={inputClass}
            placeholder="Descripción del anverso..."
          />
        </div>
        <div className="flex-1">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Reverso</label>
          <textarea
            rows={2}
            value={values.reverse_info}
            onChange={(e) => onChange('reverse_info', e.target.value)}
            className={inputClass}
            placeholder="Descripción del reverso..."
          />
        </div>
      </div>
 
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex-1">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Rango de año creación</label>
          <input
            type="text"
            value={values.creation_year_range}
            onChange={(e) => onChange('creation_year_range', e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="flex-1">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Reino/Gobernante</label>
          <input
            type="text"
            value={values.empire_reign}
            onChange={(e) => onChange('empire_reign', e.target.value)}
            className={inputClass}
            placeholder="Ej. Carlos IV"
          />
        </div>
        <div className="flex-1">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Lugar de fabricación</label>
          <input
            type="text"
            value={values.manufacturing_place}
            onChange={(e) => onChange('manufacturing_place', e.target.value)}
            className={inputClass}
          />
        </div>
      </div>
 
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex-1">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Ubicación del estuche</label>
          <input
            type="text"
            value={values.case_location}
            onChange={(e) => onChange('case_location', e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="flex-1">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Número de estuche</label>
          <input
            type="text"
            value={values.case_number}
            onChange={(e) => onChange('case_number', e.target.value)}
            className={inputClass}
          />
        </div>
      </div>
    </div>
  )
}
