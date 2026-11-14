import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '@/features/auth/AuthProvider'

const navItems = [
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
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  const sidebar = (
    <aside className="w-64 bg-slate-900 border-r border-slate-700 flex flex-col shadow-xl text-slate-100 h-full">
      <div className="px-6 py-6 border-b border-slate-700 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-teal-700 flex items-center justify-center text-white font-bold text-lg">L</div>
        <div><h1 className="text-base font-semibold leading-tight">Legacy Manager</h1><p className="text-xs text-slate-400">Patrimonio familiar</p></div>
      </div>
      <nav className="flex-1 px-4 py-6 space-y-1.5">
        {navItems.map(({ to, label, icon }) => <NavLink key={to} to={to} onClick={() => setMenuOpen(false)} className={({ isActive }) => `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${isActive ? 'bg-teal-950 text-teal-200 ring-1 ring-teal-900' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>{icon}{label}</NavLink>)}
      </nav>
      {user && <div className="p-4 border-t border-slate-700">
        <div className="flex items-center gap-3">{user.photoURL ? <img src={user.photoURL} alt={user.displayName ?? 'Usuario'} className="w-9 h-9 rounded-full" /> : <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center">{user.displayName?.[0] ?? user.email?.[0] ?? 'U'}</div>}<div className="min-w-0"><p className="text-xs font-semibold truncate">{user.displayName ?? 'Usuario'}</p><p className="text-[11px] text-slate-400 truncate">{user.email}</p></div></div>
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
          <button onClick={() => setMenuOpen(true)} aria-label="Abrir menú" className="p-2 rounded-lg hover:bg-slate-800"><span className="text-xl">☰</span></button><span className="font-semibold">{navItems.find((item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`))?.label ?? 'Legacy Manager'}</span>
        </header>
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-6 sm:py-8"><Outlet /></div>
      </main>
    </div>
  )
}
