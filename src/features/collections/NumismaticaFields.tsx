const inputClass = 'w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20'

export const NUMISMATICA_DEFAULTS: Record<string, string[]> = {
  denomination: ['8 reales', '4 reales', '2 reales', '1 real', 'Peseta', 'Duro', 'Euro', 'Denario', 'Sestercio', 'Áureo', 'Doblón'],
  coin_type: ['Moneda', 'Billete', 'Medalla', 'Token', 'Ficha'],
  era: ['Romana', 'Visigoda', 'Medieval', 'Moderna', 'Contemporánea', 'Precolonial', 'Antigua'],
  empire_reign: ['Imperio Romano', 'Imperio Español', 'Monarquía Hispánica', 'Reyes Católicos', 'Austrias', 'Borbones', 'República'],
  material: ['Oro', 'Plata', 'Bronce', 'Cobre', 'Latón', 'Bimetálico', 'Aleación', 'Estaño', 'Hierro', 'Níquel', 'Platino'],
  conservationState: ['Excelente', 'Buen estado', 'Regular', 'Dañado', 'Desgastado', 'Muy desgastado'],
  mint: ['Roma', 'Sevilla', 'Madrid', 'Barcelona', 'Valencia', 'México', 'Potosí', 'Lima'],
  reference_book: ['Standard Catalog of World Coins', 'Krause', 'Moneda Española (Cayón)', 'Alcó Bueno', 'Spink'],
}

interface NumismaticaFieldsProps {
  values: Record<string, string>
  onChange: (field: string, value: string) => void
  suggestions?: Record<string, string[]>
}

interface SuggestionFieldProps {
  field: string
  label: string
  values: Record<string, string>
  onChange: (field: string, value: string) => void
  suggestions?: Record<string, string[]>
  placeholder?: string
  type?: 'text' | 'number' | 'date'
  hint?: string
  step?: string
}

function SuggestionField({ field, label, values, onChange, suggestions, placeholder, type = 'text', hint, step }: SuggestionFieldProps) {
  const inputId = `numismatica-${field}`
  const listId = `${inputId}-options`
  const options = Array.from(new Set([...(suggestions?.[field] ?? []), ...(NUMISMATICA_DEFAULTS[field] ?? [])]))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'es'))

  return (
    <div>
      <label htmlFor={inputId} className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</label>
      <input
        id={inputId}
        type={type}
        step={step}
        list={type === 'text' ? listId : undefined}
        value={values[field] ?? ''}
        onChange={(event) => onChange(field, event.target.value)}
        className={inputClass}
        placeholder={placeholder}
      />
      {type === 'text' && (
        <datalist id={listId}>
          {options.map((option) => <option key={option} value={option} />)}
        </datalist>
      )}
      {hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
    </div>
  )
}

export function NumismaticaFields({ values, onChange, suggestions }: NumismaticaFieldsProps) {
  return (
    <div className="space-y-5 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 sm:p-5">
      <div className="flex items-center gap-2 text-teal-300">
        <span className="text-xl">🪙</span>
        <div>
          <h3 className="text-base font-bold">Detalles de Numismática</h3>
          <p className="text-xs text-slate-500">Elige valores guardados o escribe uno nuevo en los campos reutilizables.</p>
        </div>
      </div>

      <section className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Identificación</h4>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SuggestionField field="denomination" label="Denominación" values={values} onChange={onChange} suggestions={suggestions} placeholder="Ej: 8 reales" />
          <SuggestionField field="coin_type" label="Tipo de moneda" values={values} onChange={onChange} suggestions={suggestions} placeholder="Ej: denario, medalla…" />
          <SuggestionField field="era" label="Época / Era" values={values} onChange={onChange} suggestions={suggestions} placeholder="Ej: Imperial Romana" />
          <SuggestionField field="creation_year_range" label="Intervalo de años" values={values} onChange={onChange} placeholder="Ej: 100-250 d.C." />
        </div>
      </section>

      <section className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Origen y fabricación</h4>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SuggestionField field="empire_reign" label="Imperio o reinado" values={values} onChange={onChange} suggestions={suggestions} placeholder="Ej: Imperio Romano" />
          <SuggestionField field="ruler" label="Gobernante" values={values} onChange={onChange} suggestions={suggestions} placeholder="Ej: Adriano, Carlos IV…" />
          <SuggestionField field="mint" label="Ceca" values={values} onChange={onChange} suggestions={suggestions} placeholder="Ej: Roma, Sevilla…" />
          <SuggestionField field="manufacturing_place" label="Lugar de fabricación / canto" values={values} onChange={onChange} suggestions={suggestions} placeholder="Ej: Roma, canto estriado…" />
        </div>
      </section>

      <section className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Material y conservación</h4>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SuggestionField field="material" label="Material" values={values} onChange={onChange} suggestions={suggestions} placeholder="Ej: oro, plata, bronce…" hint="Puedes seleccionar un material guardado o escribir uno nuevo." />
          <SuggestionField field="conservationState" label="Estado de conservación" values={values} onChange={onChange} suggestions={suggestions} placeholder="Ej: Excelente, Buen estado…" hint="Puedes seleccionar un estado guardado o escribir uno nuevo." />
        </div>
      </section>

      <section className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Anverso y reverso</h4>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Información del anverso</label>
            <textarea rows={3} value={values.obverse_info ?? ''} onChange={(event) => onChange('obverse_info', event.target.value)} className={inputClass} placeholder="Descripción del anverso…" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Información del reverso</label>
            <textarea rows={3} value={values.reverse_info ?? ''} onChange={(event) => onChange('reverse_info', event.target.value)} className={inputClass} placeholder="Descripción del reverso…" />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Valoración y referencias</h4>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SuggestionField field="value" label="Valor nominal (€)" type="number" step="0.01" values={values} onChange={onChange} placeholder="0,00" />
          <SuggestionField field="market_value" label="Valor de mercado (€)" type="number" step="0.01" values={values} onChange={onChange} placeholder="0,00" />
          <SuggestionField field="purchase_price" label="Precio de compra (€)" type="number" step="0.01" values={values} onChange={onChange} placeholder="0,00" />
          <SuggestionField field="purchase_year" label="Año de compra" type="number" values={values} onChange={onChange} placeholder="Ej: 2024" />
          <SuggestionField field="reference_book" label="Libro de referencia" values={values} onChange={onChange} suggestions={suggestions} placeholder="Ej: Cayón, Krause…" />
          <SuggestionField field="reference_book_value" label="Valoración en el libro (€)" type="number" step="0.01" values={values} onChange={onChange} placeholder="0,00" />
        </div>
      </section>

      <section className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Ubicación y registro</h4>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SuggestionField field="case_location" label="Archivador / estuche" values={values} onChange={onChange} suggestions={suggestions} placeholder="Ej: Estuche A, Carpeta 3…" />
          <SuggestionField field="case_number" label="Número de posición" values={values} onChange={onChange} placeholder="Ej: #12" />
          <SuggestionField field="added_date" label="Fecha de registro" type="date" values={values} onChange={onChange} />
        </div>
      </section>
    </div>
  )
}
