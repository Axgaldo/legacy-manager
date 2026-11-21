import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Suspense, useEffect, useState } from 'react'
import { useAuth } from '@/features/auth/AuthProvider'
import { usePrivacy } from '@/features/privacy/PrivacyProvider'
import GlobalSearch from '@/features/search/GlobalSearch'
import ErrorBoundary from '@/components/ui/ErrorBoundary'
import PageLoader from '@/components/ui/PageLoader'

const BUILD_DATE = new Date(__APP_BUILD_DATE__)
const BUILD_DATE_LABEL = BUILD_DATE.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
const BUILD_YEAR = BUILD_DATE.getFullYear()

const navItems = [
  {
    to: '/',
    label: 'Inicio',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3m10-11v10a1 1 0 01-1 1h-3m-6 0h6m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1" />
      </svg>
    ),
  },
  {
    to: '/inmuebles',
    label: 'Inmuebles',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  {
    to: '/bienes',
    label: 'Bienes y Activos',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
]

export default function AppLayout() {
  const { user, signOutUser } = useAuth()
  const { incognito, toggleIncognito } = usePrivacy()
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [photoFailed, setPhotoFailed] = useState(false)
  const location = useLocation()

  // La foto de Google puede fallar (bloqueo de terceros, sin red, URL caducada):
  // en ese caso se muestran las iniciales en lugar de un hueco roto.
  useEffect(() => {
    setPhotoFailed(false)
  }, [user?.photoURL])

  // Ctrl+K / ⌘K abre la búsqueda global desde cualquier pantalla.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const searchTrigger = (
    <button
      type="button"
      onClick={() => setSearchOpen(true)}
      className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-400 transition hover:border-teal-600 hover:text-slate-200"
    >
      <span className="flex items-center gap-2"><span aria-hidden="true">⌕</span> Buscar</span>
      <kbd className="rounded border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-500">Ctrl K</kbd>
    </button>
  )

  const incognitoToggle = (
    <button
      type="button"
      onClick={toggleIncognito}
      aria-pressed={incognito}
      title="Oculta todas las cifras de dinero de la app con caracteres aleatorios"
      className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left text-xs font-semibold transition ${
        incognito
          ? 'border-amber-700 bg-amber-950/40 text-amber-200 hover:bg-amber-950/60'
          : 'border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800'
      }`}
    >
      <span className="flex items-center gap-2">
        <span aria-hidden="true">{incognito ? '🙈' : '👁'}</span>
        <span>Modo incógnito</span>
      </span>
      <span className={`relative h-4 w-8 shrink-0 rounded-full transition ${incognito ? 'bg-amber-500' : 'bg-slate-700'}`}>
        <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${incognito ? 'left-4' : 'left-0.5'}`} />
      </span>
    </button>
  )

  const sidebar = (
    <aside className="w-64 bg-slate-900 border-r border-slate-700 flex flex-col shadow-xl text-slate-100 h-full">
      <div className="px-6 py-6 border-b border-slate-700 flex items-center gap-3">
        <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="w-9 h-9 rounded-xl" />
        <div><h1 className="text-base font-semibold leading-tight">Legacy Manager</h1><p className="text-xs text-slate-400">Patrimonio familiar</p></div>
      </div>
      <nav className="flex-1 px-4 py-6 space-y-1.5">
        {navItems.map(({ to, label, icon }) => <NavLink key={to} to={to} end={to === '/'} onClick={() => setMenuOpen(false)} className={({ isActive }) => `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${isActive ? 'bg-teal-950 text-teal-200 ring-1 ring-teal-900' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>{icon}{label}</NavLink>)}
      </nav>
      <div className="px-4 pb-3">
        {searchTrigger}
        <div className="mt-2">{incognitoToggle}</div>
        <p className="mt-1.5 px-1 text-[10px] leading-snug text-slate-500">Con el modo activo, los importes se muestran como «▓#%§ €».</p>
      </div>

      <div className="px-4 pb-2">
        <NavLink
          to="/papelera"
          onClick={() => setMenuOpen(false)}
          className={({ isActive }) => `flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition ${isActive ? 'bg-slate-800 text-teal-200 ring-1 ring-teal-900' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
        >
          <span aria-hidden="true">🗑</span>
          Papelera
        </NavLink>
      </div>

      <div className="border-t border-slate-800 px-4 py-3 text-[10px] leading-relaxed text-slate-500">
        <p className="flex flex-wrap items-center gap-x-1.5 font-mono text-slate-400">
          <span>v{__APP_VERSION__}</span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span title="Commit de esta build">{__APP_COMMIT__}</span>
        </p>
        <p>
          <a
            href="https://github.com/Axgaldo/legacy-manager"
            target="_blank"
            rel="noreferrer"
            title="Abrir el repositorio en GitHub"
            className="underline decoration-slate-700 underline-offset-2 transition hover:text-slate-300"
          >
            Build del {BUILD_DATE_LABEL}
          </a>
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1">
          <span>© {BUILD_YEAR}</span>
          <a
            href="https://github.com/Axgaldo"
            target="_blank"
            rel="noreferrer"
            aria-label="Perfil de GitHub de Axgaldo"
            title="github.com/Axgaldo"
            className="inline-flex items-center gap-1 font-semibold text-slate-400 transition hover:text-slate-200"
          >
            <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-current">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
            Axgaldo
          </a>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <a
            href="https://github.com/Axgaldo/legacy-manager/blob/main/LICENSE"
            target="_blank"
            rel="noreferrer"
            className="underline decoration-slate-700 underline-offset-2 hover:text-slate-300"
          >
            MIT
          </a>
        </p>
      </div>
      {user && <div className="p-4 border-t border-slate-700">
        <div className="flex items-center gap-3">{user.photoURL && !photoFailed ? <img src={user.photoURL} alt={user.displayName ?? 'Usuario'} referrerPolicy="no-referrer" onError={() => setPhotoFailed(true)} className="w-9 h-9 rounded-full" /> : <div aria-hidden="true" className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center">{user.displayName?.[0] ?? user.email?.[0] ?? 'U'}</div>}<div className="min-w-0"><p className="text-xs font-semibold truncate">{user.displayName ?? 'Usuario'}</p><p className="text-[11px] text-slate-400 truncate">{user.email}</p></div></div>
        <button onClick={signOutUser} className="mt-3 w-full py-2 rounded-lg text-xs text-slate-300 hover:bg-red-950 hover:text-red-300 border border-slate-700">Cerrar sesión</button>
      </div>}
    </aside>
  )

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100">
      <div className="hidden md:block">{sidebar}</div>
      {menuOpen && <div className="fixed inset-0 z-50 md:hidden"><button aria-label="Cerrar menú" className="absolute inset-0 bg-black/70" onClick={() => setMenuOpen(false)} /> <div className="relative h-full w-72 max-w-[85vw]">{sidebar}</div></div>}
      <main className="flex-1 overflow-y-auto min-w-0">
        <header className="md:hidden sticky top-0 z-30 flex items-center gap-3 px-4 py-3 bg-slate-900/95 border-b border-slate-800 backdrop-blur">
          <button onClick={() => setMenuOpen(true)} aria-label="Abrir menú" className="p-2 rounded-lg hover:bg-slate-800"><span className="text-xl">☰</span></button>
          <span className="min-w-0 flex-1 truncate font-semibold">{navItems.find((item) => item.to === '/' ? location.pathname === '/' : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`))?.label ?? 'Legacy Manager'}</span>
          <button onClick={() => setSearchOpen(true)} aria-label="Buscar" className="p-2 rounded-lg hover:bg-slate-800"><span className="text-lg">⌕</span></button>
        </header>
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-6 sm:py-8">
          {/* Keeps the sidebar alive if one screen fails; the global boundary is the last resort. */}
          <ErrorBoundary compact resetKey={location.pathname}>
            <Suspense fallback={<PageLoader compact />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </div>
      </main>

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  )
}
