import { AssetItem } from '@/types'
import { useMoney } from '@/features/privacy/money'
import { coinValue, detailLabel, locationLabel, yearLabel } from './numismaticaUi'

/**
 * Tabla que solo existe para imprimir. En pantalla está oculta; las reglas de
 * `index.css` la muestran en blanco y negro al imprimir.
 */
export default function AssetPrintTable({
  title,
  assets,
  subtitle,
}: {
  title: string
  assets: AssetItem[]
  subtitle?: string
}) {
  const money = useMoney()
  const total = assets.reduce((sum, asset) => sum + coinValue(asset), 0)
  const date = new Intl.DateTimeFormat('es-ES', { dateStyle: 'long' }).format(new Date())

  return (
    <div id="asset-print-sheet">
      <header className="mb-3 flex flex-wrap items-end justify-between gap-2 border-b border-slate-400 pb-2">
        <div className="min-w-0">
          <h1 className="text-lg font-bold">{title}</h1>
          <p className="text-[10px]">
            {subtitle ? `${subtitle} · ` : ''}{assets.length} pieza(s) · {date}
          </p>
        </div>
        <p className="shrink-0 text-sm font-bold">Valoración: {money.formatEuro(total)}</p>
      </header>

      <table className="w-full table-fixed border-collapse text-[9px]">
        <colgroup>
          <col style={{ width: '5%' }} />
          <col style={{ width: '28%' }} />
          <col style={{ width: '9%' }} />
          <col style={{ width: '9%' }} />
          <col style={{ width: '16%' }} />
          <col style={{ width: '11%' }} />
          <col style={{ width: '13%' }} />
          <col style={{ width: '9%' }} />
        </colgroup>
        <thead>
          <tr>
            {['Nº', 'Pieza', 'Año', 'Material', 'Marca / Ceca', 'Conservación', 'Ubicación', 'Valor'].map((label) => (
              <th key={label} className="border border-slate-400 px-1.5 py-1 text-left font-bold uppercase tracking-wide">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {assets.map((asset) => (
            <tr key={asset.id} className="break-inside-avoid">
              <td className="border border-slate-300 px-1.5 py-0.5 whitespace-nowrap">
                {asset.inventory_number || asset.case_number || '—'}
              </td>
              <td className="border border-slate-300 px-1.5 py-0.5">
                {asset.name}
                {asset.catalog_reference ? ` · ${asset.catalog_reference}` : ''}
              </td>
              <td className="border border-slate-300 px-1.5 py-0.5 whitespace-nowrap">{yearLabel(asset)}</td>
              <td className="border border-slate-300 px-1.5 py-0.5">{asset.material || '—'}</td>
              <td className="border border-slate-300 px-1.5 py-0.5">{detailLabel(asset)}</td>
              <td className="border border-slate-300 px-1.5 py-0.5 whitespace-nowrap">{asset.conservationState || '—'}</td>
              <td className="border border-slate-300 px-1.5 py-0.5">{locationLabel(asset)}</td>
              <td className="border border-slate-300 px-1.5 py-0.5">
                {coinValue(asset) ? money.formatEuro(coinValue(asset)) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
