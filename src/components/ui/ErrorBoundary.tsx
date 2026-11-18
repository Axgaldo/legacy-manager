import React from 'react'

type Props = {
  children: React.ReactNode
  /**
   * `panel` se usa dentro del layout: la barra lateral sigue visible y solo se
   * sustituye el contenido de la pantalla que ha fallado.
   */
  compact?: boolean
  /**
   * Al cambiar, el boundary se recupera solo sin desmontar a sus hijos (por
   * ejemplo, al navegar a otra ruta). No usar `key`: eso remontaría la página
   * entera y perdería su estado.
   */
  resetKey?: string
}

type State = { error: Error | null }

/**
 * Red de seguridad de la interfaz: si un componente lanza una excepción durante
 * el render, React desmonta todo el árbol y deja la página en blanco. Este
 * boundary captura el error, lo registra en consola y muestra una pantalla de
 * recuperación. No sustituye al 404: las rutas desconocidas se resuelven en
 * App.tsx con una ruta comodín.
 */
export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Error no controlado en la interfaz:', error, info.componentStack)
  }

  componentDidUpdate(previousProps: Props) {
    if (this.state.error && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null })
    }
  }

  private retry = () => this.setState({ error: null })

  private reload = () => window.location.reload()

  render() {
    const { error } = this.state
    if (!error) return <>{this.props.children}</>

    const homeUrl = import.meta.env.BASE_URL

    return (
      <div
        role="alert"
        className={this.props.compact
          ? 'rounded-2xl border border-red-900/60 bg-slate-900 p-6 text-slate-200'
          : 'flex min-h-screen items-center justify-center bg-slate-950 p-6 text-slate-200'}
      >
        <div className={this.props.compact ? '' : 'w-full max-w-lg rounded-2xl border border-red-900/60 bg-slate-900 p-8 shadow-2xl'}>
          <p className="text-3xl" aria-hidden="true">⚠️</p>
          <h1 className="mt-3 text-lg font-bold text-slate-100">Algo ha fallado en esta pantalla</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            Los datos guardados no se han modificado: el error es de la interfaz. Puedes reintentar la
            pantalla o recargar la aplicación.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {this.props.compact && (
              <button
                type="button"
                onClick={this.retry}
                className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-600"
              >
                Reintentar
              </button>
            )}
            <button
              type="button"
              onClick={this.reload}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
            >
              Recargar la página
            </button>
            <a
              href={homeUrl}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white"
            >
              Volver al inicio
            </a>
          </div>

          <details className="mt-5 text-xs text-slate-500">
            <summary className="cursor-pointer select-none text-slate-400">Detalles técnicos</summary>
            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-950 p-3 font-mono text-[11px] leading-relaxed text-slate-400">
              {error.name}: {error.message}
              {error.stack ? `\n\n${error.stack}` : ''}
            </pre>
          </details>
        </div>
      </div>
    )
  }
}
