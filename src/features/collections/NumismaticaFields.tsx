import {
  ACQUISITION_OPERATIONS,
  CURRENCIES,
  EMPIRE_NAMES,
  ERA_OPTIONS,
  MEDAL_MATERIALS,
  RULER_NAMES,
  convertToEuro,
  formatCurrencyRate,
  formatEuroAmount,
  getCurrency,
  orderConservationStates,
  parseAmountText,
} from './numismaticaMeta'

const fieldBase = 'rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20'
const inputClass = `w-full ${fieldBase}`
const selectClass = `w-full ${fieldBase}`
/** Year inputs share the row with the era select, so they must not claim 100% width. */
const yearInputClass = `min-w-0 flex-1 ${fieldBase}`
const yearSelectClass = `w-20 shrink-0 ${fieldBase} px-2.5`
const currencySelectClass = `w-24 shrink-0 ${fieldBase} px-2.5`
const labelClass = 'mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400'

export const NUMISMATICA_DEFAULTS: Record<string, string[]> = {
  denomination: ['Denario', 'Sestercio', 'Áureo', 'As', 'Dupondio', 'Antoniniano', 'Follis', '8 reales', '4 reales', '2 reales', '1 real', 'Doblón', 'Peseta', 'Duro', 'Euro'],
  era: [...ERA_OPTIONS],
  empire_reign: [...EMPIRE_NAMES],
  material: ['Oro', 'Plata', 'Bronce', 'Cobre', 'Latón', 'Bimetálico', 'Aleación', 'Estaño', 'Hierro', 'Níquel', 'Platino', ...MEDAL_MATERIALS],
  acquisition_operation: [...ACQUISITION_OPERATIONS],
  acquisition_source: ['Madrid Cayón', 'Málaga Díaz', 'Gonzalo Málaga', 'Campillo Granada', 'Jesús Vico', 'Gabinete numismático', 'Subasta', 'Particular'],
  value_source: ['Calicó 2019', 'Calicó 2008', 'Cayón 2019', 'Cayón 2008', 'Cayón 2001', 'Cayón 1984', 'Cayón 1985', 'Álvarez Burgos 1987', 'eBay', 'Ucoin', 'Jesús Vico', 'Numista', 'Subasta'],
  reference_book: [
    'Cayón 1984 (sextercios)',
    'Cayón 1985 (compendio)',
    'Cayón 2001',
    'Cayón 2008',
    'Cayón 2019',
    'Calicó 2008',
    'Calicó 2019',
    'Álvarez Burgos 1987',
    'Seaby',
    'Krause',
    'Standard Catalog of World Coins',
    'Spink',
    'Numista',
  ],
}

interface NumismaticaFieldsProps {
  values: Record<string, string>
  onChange: (field: string, value: string) => void
  suggestions?: Record<string, string[]>
  namePreview?: string
  onAutoFill?: () => void
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
  extraOptions?: string[]
  noSuggestions?: boolean
}

function SuggestionField({
  field,
  label,
  values,
  onChange,
  suggestions,
  placeholder,
  type = 'text',
  hint,
  step,
  extraOptions = [],
  noSuggestions = false,
}: SuggestionFieldProps) {
  const inputId = `numismatica-${field}`
  const listId = `${inputId}-options`
  const options = Array.from(new Set([
    ...(suggestions?.[field] ?? []),
    ...(NUMISMATICA_DEFAULTS[field] ?? []),
    ...extraOptions,
  ]))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'es'))

  return (
    <div>
      <label htmlFor={inputId} className={labelClass}>{label}</label>
      <input
        id={inputId}
        type={type}
        step={step}
        list={type === 'text' && !noSuggestions ? listId : undefined}
        value={values[field] ?? ''}
        onChange={(event) => onChange(field, event.target.value)}
        className={inputClass}
        placeholder={placeholder}
      />
      {type === 'text' && !noSuggestions && (
        <datalist id={listId}>
          {options.map((option) => <option key={option} value={option} />)}
        </datalist>
      )}
      {hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
    </div>
  )
}

function parseAmount(value?: string): number | undefined {
  return parseAmountText(value)
}

interface MoneyFieldProps {
  amountField: string
  currencyField: string
  label: string
  values: Record<string, string>
  onChange: (field: string, value: string) => void
  placeholder?: string
  hint?: string
}

/**
 * Amount + currency pair. The parent form converts the amount to euros and
 * writes it into the matching euro field, which stays editable.
 */
function MoneyField({ amountField, currencyField, label, values, onChange, placeholder, hint }: MoneyFieldProps) {
  const inputId = `numismatica-${amountField}`
  const amount = parseAmount(values[amountField])
  const currency = getCurrency(values[currencyField])
  const euro = amount === undefined ? undefined : convertToEuro(amount, currency.code)

  return (
    <div>
      <label htmlFor={inputId} className={labelClass}>{label}</label>
      <div className="flex gap-2">
        <input
          id={inputId}
          type="text"
          inputMode="decimal"
          value={values[amountField] ?? ''}
          onChange={(event) => onChange(amountField, event.target.value)}
          className={yearInputClass}
          placeholder={placeholder}
        />
        <select
          value={currency.code}
          onChange={(event) => onChange(currencyField, event.target.value)}
          className={currencySelectClass}
          aria-label="Moneda del importe"
        >
          {CURRENCIES.map((item) => (
            <option key={item.code} value={item.code} title={item.label}>{item.code}</option>
          ))}
        </select>
      </div>
      <p className="mt-1 text-[11px] text-slate-500">
        {currency.code === 'EUR'
          ? 'Importe en euros.'
          : euro === undefined
            ? `${currency.label}: ${formatCurrencyRate(currency.code)}. El importe en euros se calcula solo.`
            : `≈ ${formatEuroAmount(euro)} · ${formatCurrencyRate(currency.code)}${currency.fixed ? '' : ' (orientativo)'}`}
        {hint ? ` ${hint}` : ''}
      </p>
    </div>
  )
}

interface ConservationFieldProps {
  values: Record<string, string>
  onChange: (field: string, value: string) => void
  options: string[]
}

function ConservationField({ values, onChange, options }: ConservationFieldProps) {
  return (
    <div>
      <label htmlFor="numismatica-conservation" className={labelClass}>Estado de conservación</label>
      <select
        id="numismatica-conservation"
        value={values.conservationState ?? ''}
        onChange={(event) => onChange('conservationState', event.target.value)}
        className={selectClass}
      >
        <option value="">Sin especificar</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
      <p className="mt-1 text-[11px] text-slate-500">Ordenado de mejor a peor. Los defectos concretos van en etiquetas o notas.</p>
    </div>
  )
}

function NameField({ field, values, onChange, namePreview }: Pick<NumismaticaFieldsProps, 'values' | 'onChange' | 'namePreview'> & { field: string }) {
  const inputId = `numismatica-name-${field}`
  return (
    <section className="space-y-3 border-t border-slate-800 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Nombre de la ficha</h4>
        {values[field]?.trim() && (
          <button
            type="button"
            onClick={() => onChange(field, '')}
            className="text-[11px] font-semibold text-teal-300 hover:text-teal-200"
          >
            Usar nombre automático
          </button>
        )}
      </div>
      <div>
        <label htmlFor={inputId} className={labelClass}>Nombre visible (opcional)</label>
        <input
          id={inputId}
          value={values[field] ?? ''}
          onChange={(event) => onChange(field, event.target.value)}
          placeholder={namePreview?.trim() || 'Se genera automáticamente'}
          className={inputClass}
        />
        <p className="mt-1 text-[11px] text-slate-500">Se rellena solo a partir de los datos de la ficha. Escríbelo aquí solo si quieres un nombre distinto.</p>
      </div>
    </section>
  )
}

function YearFields({ values, onChange, onAutoFill }: Pick<NumismaticaFieldsProps, 'values' | 'onChange' | 'onAutoFill'>) {
  const mode = values.year_mode === 'range' ? 'range' : 'single'

  return (
    <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Fecha de la moneda</h4>
          <p className="mt-0.5 text-[11px] text-slate-500">La época y el gobernante se rellenan solos a partir del año; puedes cambiarlos.</p>
        </div>
        <div className="inline-flex overflow-hidden rounded-xl border border-slate-700">
          <button
            type="button"
            onClick={() => onChange('year_mode', 'single')}
            className={`px-3 py-1.5 text-xs font-semibold transition ${mode === 'single' ? 'bg-teal-700 text-white' : 'bg-slate-950 text-slate-300 hover:bg-slate-800'}`}
          >
            Año concreto
          </button>
          <button
            type="button"
            onClick={() => onChange('year_mode', 'range')}
            className={`px-3 py-1.5 text-xs font-semibold transition ${mode === 'range' ? 'bg-teal-700 text-white' : 'bg-slate-950 text-slate-300 hover:bg-slate-800'}`}
          >
            Intervalo
          </button>
        </div>
      </div>

      {mode === 'single' ? (
        <div className="flex max-w-sm items-center gap-2">
          <input
            type="number"
            min="0"
            inputMode="numeric"
            value={values.year_value ?? ''}
            onChange={(event) => onChange('year_value', event.target.value)}
            placeholder="Ej: 1780"
            className={yearInputClass}
            aria-label="Año concreto"
          />
          <select
            value={values.year_era ?? 'ad'}
            onChange={(event) => onChange('year_era', event.target.value)}
            className={yearSelectClass}
            aria-label="Era del año"
          >
            <option value="ad">d.C.</option>
            <option value="bc">a.C.</option>
          </select>
        </div>
      ) : (
        <div className="grid max-w-2xl gap-3 sm:grid-cols-2">
          <div>
            <span className="mb-1 block text-[11px] text-slate-500">Desde</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                inputMode="numeric"
                value={values.range_start ?? ''}
                onChange={(event) => onChange('range_start', event.target.value)}
                placeholder="Ej: 117"
                className={yearInputClass}
                aria-label="Año inicial"
              />
              <select
                value={values.range_start_era ?? 'ad'}
                onChange={(event) => onChange('range_start_era', event.target.value)}
                className={yearSelectClass}
                aria-label="Era del año inicial"
              >
                <option value="ad">d.C.</option>
                <option value="bc">a.C.</option>
              </select>
            </div>
          </div>
          <div>
            <span className="mb-1 block text-[11px] text-slate-500">Hasta</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                inputMode="numeric"
                value={values.range_end ?? ''}
                onChange={(event) => onChange('range_end', event.target.value)}
                placeholder="Ej: 138"
                className={yearInputClass}
                aria-label="Año final"
              />
              <select
                value={values.range_end_era ?? 'ad'}
                onChange={(event) => onChange('range_end_era', event.target.value)}
                className={yearSelectClass}
                aria-label="Era del año final"
              >
                <option value="ad">d.C.</option>
                <option value="bc">a.C.</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {values.range_legacy_text && (
        <p className="rounded-lg border border-amber-900 bg-amber-950/40 px-3 py-2 text-[11px] text-amber-200">
          Intervalo guardado: «{values.range_legacy_text}». Vuelve a introducirlo arriba si quieres modificarlo.
        </p>
      )}

      {onAutoFill && (
        <button
          type="button"
          onClick={onAutoFill}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-[11px] font-semibold text-slate-300 hover:border-teal-600 hover:text-teal-200"
        >
          Recalcular época y gobernante
        </button>
      )}
    </div>
  )
}

export function NumismaticaFields({ values, onChange, suggestions, namePreview, onAutoFill }: NumismaticaFieldsProps) {
  const isMedal = values.numismatica_type === 'medalla'
  const conservationOptions = orderConservationStates([
    ...(suggestions?.conservationState ?? []),
    ...(values.conservationState ? [values.conservationState] : []),
  ])

  return (
    <div className="space-y-5 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-teal-300">
          <span className="text-xl">{isMedal ? '🏅' : '🪙'}</span>
          <div>
            <h3 className="text-base font-bold">{isMedal ? 'Ficha de medalla' : 'Ficha de moneda'}</h3>
            <p className="text-xs text-slate-500">
              {isMedal
                ? 'Ficha simplificada de medalla. El nombre se rellena solo con el motivo.'
                : 'Solo los datos propios de numismática. El nombre y los campos genéricos se rellenan automáticamente.'}
            </p>
          </div>
        </div>
        <div className="inline-flex overflow-hidden rounded-xl border border-slate-700">
          <button
            type="button"
            onClick={() => onChange('numismatica_type', 'moneda')}
            className={`px-3 py-1.5 text-xs font-semibold transition ${!isMedal ? 'bg-teal-700 text-white' : 'bg-slate-950 text-slate-300 hover:bg-slate-800'}`}
            aria-pressed={!isMedal}
          >
            Moneda
          </button>
          <button
            type="button"
            onClick={() => onChange('numismatica_type', 'medalla')}
            className={`px-3 py-1.5 text-xs font-semibold transition ${isMedal ? 'bg-teal-700 text-white' : 'bg-slate-950 text-slate-300 hover:bg-slate-800'}`}
            aria-pressed={isMedal}
          >
            Medalla
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-teal-900 bg-teal-950/40 px-3 py-2 text-xs text-teal-200">
        <span className="text-slate-400">Se guardará como:</span>{' '}
        <strong className="text-teal-100">{namePreview?.trim() || (isMedal ? 'Motivo de la medalla' : 'Denominación de la moneda')}</strong>
        <span className="ml-1 text-slate-500">(editable más abajo)</span>
      </div>

      {isMedal ? (
        <>
          <section className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Datos de la medalla</h4>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <SuggestionField field="medal_motive" label="Motivo *" values={values} onChange={onChange} suggestions={suggestions} placeholder="Ej: Coronación de Alfonso XIII…" />
              <SuggestionField field="medal_year" label="Año" type="number" values={values} onChange={onChange} placeholder="Ej: 1898" />
              <SuggestionField field="material" label="Material" values={values} onChange={onChange} suggestions={suggestions} placeholder="Ej: bronce, plata…" />
              <SuggestionField field="medal_size_mm" label="Tamaño (texto libre)" values={values} onChange={onChange} placeholder="Ej: 60, 50x30, varios…" hint="Admite milímetros, formas rectangulares o «varios tamaños»." />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <ConservationField values={values} onChange={onChange} options={conservationOptions} />
              <SuggestionField field="inventory_number" label="Nº de inventario" values={values} onChange={onChange} noSuggestions placeholder="Ej: 78" hint="Número local del álbum, estuche o cajón." />
              <SuggestionField field="catalog_reference" label="Código de catálogo" values={values} onChange={onChange} noSuggestions placeholder="Ej: CS-5, AB-442…" />
              <SuggestionField field="weight_grams" label="Peso" values={values} onChange={onChange} noSuggestions placeholder="Ej: 53 g" />
            </div>
          </section>

          <section className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Anverso y reverso</h4>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Anverso</label>
                <textarea rows={3} value={values.obverse_info ?? ''} onChange={(event) => onChange('obverse_info', event.target.value)} className={inputClass} placeholder="Descripción del anverso…" />
              </div>
              <div>
                <label className={labelClass}>Reverso</label>
                <textarea rows={3} value={values.reverse_info ?? ''} onChange={(event) => onChange('reverse_info', event.target.value)} className={inputClass} placeholder="Descripción del reverso…" />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Adquisición y ubicación</h4>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <MoneyField amountField="purchase_price_original" currencyField="purchase_currency" label="Precio de compra (importe original)" values={values} onChange={onChange} placeholder="Ej: 3.500" />
              <SuggestionField field="purchase_price" label="Precio de compra en € (editable)" type="number" step="0.01" values={values} onChange={onChange} placeholder="0,00" hint="Se calcula con el importe y la moneda de la izquierda." />
              <SuggestionField field="acquisition_operation" label="Operación de adquisición" values={values} onChange={onChange} suggestions={suggestions} placeholder="Ej: compra, herencia, regalo…" extraOptions={[...ACQUISITION_OPERATIONS]} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <SuggestionField field="acquisition_source" label="Proveedor o procedencia" values={values} onChange={onChange} suggestions={suggestions} placeholder="Ej: Madrid Cayón 3/82" />
              <SuggestionField field="purchase_year" label="Año de compra" type="number" values={values} onChange={onChange} placeholder="Ej: 1982" />
              <SuggestionField field="medal_location" label="Ubicación" values={values} onChange={onChange} suggestions={suggestions} placeholder="Ej: mueble del despacho, cajón 2…" />
            </div>
          </section>

          <NameField field="medal_name_override" values={values} onChange={onChange} namePreview={namePreview} />
        </>
      ) : (
        <>
          <YearFields values={values} onChange={onChange} onAutoFill={onAutoFill} />

          <section className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Identificación</h4>
            <p className="text-[11px] text-slate-500">El gobernante, el imperio y la época se rellenan con la fecha; puedes corregirlos cuando quieras.</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <SuggestionField field="denomination" label="Denominación *" values={values} onChange={onChange} suggestions={suggestions} placeholder="Ej: denario, 8 reales, peseta…" />
              <SuggestionField field="ruler" label="Gobernante" values={values} onChange={onChange} suggestions={suggestions} placeholder="Ej: Adriano, Carlos IV…" extraOptions={RULER_NAMES} />
              <SuggestionField field="empire_reign" label="Imperio o reinado" values={values} onChange={onChange} suggestions={suggestions} placeholder="Ej: Imperio Romano" extraOptions={EMPIRE_NAMES} />
              <SuggestionField field="era" label="Época" values={values} onChange={onChange} suggestions={suggestions} placeholder="Ej: Romana" />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <SuggestionField field="inventory_number" label="Nº de inventario" values={values} onChange={onChange} noSuggestions placeholder="Ej: 78" hint="Número local del álbum, estuche o bandeja." />
              <SuggestionField field="catalog_reference" label="Código de catálogo" values={values} onChange={onChange} noSuggestions placeholder="Ej: CS-5, CC-154, AB-442…" />
              <SuggestionField field="weight_grams" label="Peso" values={values} onChange={onChange} noSuggestions placeholder="Ej: 3,5 g" />
              <SuggestionField field="diameter_mm" label="Diámetro" values={values} onChange={onChange} noSuggestions placeholder="Ej: 27 mm" />
            </div>
          </section>

          <section className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Material, conservación y ceca</h4>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <SuggestionField field="material" label="Material" values={values} onChange={onChange} suggestions={suggestions} placeholder="Ej: oro, plata, bronce…" />
              <ConservationField values={values} onChange={onChange} options={conservationOptions} />
              <SuggestionField
                field="mint"
                label="Ceca (ciudad o taller)"
                values={values}
                onChange={onChange}
                suggestions={suggestions}
                placeholder="Ej: Roma, Sevilla, México, Potosí…"
                hint="Lugar donde se acuñó la moneda. Si no lo sabes, déjalo vacío."
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <SuggestionField
                field="mint_mark"
                label="Marca de ceca / ensayador"
                values={values}
                onChange={onChange}
                suggestions={suggestions}
                placeholder="Ej: M-FM, IJ, PP, S…"
                hint="Siglas o símbolos que aparecen dentro de la moneda; no es la ciudad."
              />
            </div>
          </section>

          <NameField field="name_override" values={values} onChange={onChange} namePreview={namePreview} />

          <details className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <summary className="cursor-pointer text-sm font-semibold text-slate-200">Detalles avanzados (opcional)</summary>

            <div className="mt-4 space-y-5">
              <section className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Anverso y reverso</h4>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelClass}>Información del anverso</label>
                    <textarea rows={3} value={values.obverse_info ?? ''} onChange={(event) => onChange('obverse_info', event.target.value)} className={inputClass} placeholder="Descripción del anverso…" />
                  </div>
                  <div>
                    <label className={labelClass}>Información del reverso</label>
                    <textarea rows={3} value={values.reverse_info ?? ''} onChange={(event) => onChange('reverse_info', event.target.value)} className={inputClass} placeholder="Descripción del reverso…" />
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Valoración y referencias</h4>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <SuggestionField field="value" label="Valor nominal (€)" type="number" step="0.01" values={values} onChange={onChange} placeholder="0,00" />
                  <SuggestionField field="market_value" label="Valor de mercado (€)" type="number" step="0.01" values={values} onChange={onChange} placeholder="0,00" hint="Rangos: usa el punto medio y deja el rango literal en notas." />
                  <SuggestionField field="value_source" label="Fuente de la valoración" values={values} onChange={onChange} suggestions={suggestions} placeholder="Ej: Calicó 2019, eBay…" />
                  <SuggestionField field="purchase_price" label="Precio de compra en € (editable)" type="number" step="0.01" values={values} onChange={onChange} placeholder="0,00" />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <MoneyField amountField="purchase_price_original" currencyField="purchase_currency" label="Precio de compra (importe original)" values={values} onChange={onChange} placeholder="Ej: 3.500" />
                  <SuggestionField field="purchase_year" label="Año de compra" type="number" values={values} onChange={onChange} placeholder="Ej: 1982" />
                  <SuggestionField field="acquisition_source" label="Proveedor o procedencia" values={values} onChange={onChange} suggestions={suggestions} placeholder="Ej: Madrid Cayón 3/82" />
                  <SuggestionField field="acquisition_operation" label="Operación de adquisición" values={values} onChange={onChange} suggestions={suggestions} placeholder="Ej: compra, herencia…" extraOptions={[...ACQUISITION_OPERATIONS]} />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <SuggestionField field="reference_book" label="Libro de referencia" values={values} onChange={onChange} suggestions={suggestions} placeholder="Ej: Cayón 2001, Calicó 2019…" />
                  <SuggestionField field="reference_book_value" label="Valoración del libro en € (editable)" type="number" step="0.01" values={values} onChange={onChange} placeholder="0,00" />
                  <MoneyField amountField="reference_book_value_original" currencyField="reference_book_currency" label="Valoración del libro (importe original)" values={values} onChange={onChange} placeholder="Ej: 10.000" hint="Si el catálogo está en pesetas, elige ESP." />
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
          </details>
        </>
      )}
    </div>
  )
}
