/**
 * Pantalla de carga para los trozos de código que se descargan bajo demanda
 * (code splitting). `compact` se usa dentro del layout, conservando la barra
 * lateral mientras carga la página.
 */
export default function PageLoader({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? 'py-24 text-center' : 'flex min-h-screen items-center justify-center bg-slate-950'}>
      <div className="text-center">
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-3 border-teal-700 border-t-transparent" />
        <p className="text-sm text-slate-400" role="status">Cargando…</p>
      </div>
    </div>
  )
}
