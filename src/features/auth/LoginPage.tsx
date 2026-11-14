import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthProvider'

/**
 * Full-screen login page shown to unauthenticated or unauthorised users.
 */
export default function LoginPage() {
  const { user, isAllowed, loading, signIn, signOutUser } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Cargando…</p>
      </div>
    )
  }

  // Auto redirect if already logged in and authorised
  if (user && isAllowed) {
    return <Navigate to={location.state?.from || '/inmuebles'} replace />
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-lg p-10 max-w-sm w-full text-center space-y-6">
        <h1 className="text-2xl font-bold text-slate-100">Legacy Manager</h1>
        <p className="text-slate-400 text-sm">Gestión de patrimonio personal y familiar</p>

        {user && !isAllowed ? (
          <>
            <p className="text-red-600 text-sm">
              Tu cuenta <strong>{user.email}</strong> no tiene acceso autorizado.
              Contacta con el administrador.
            </p>
            <button
              onClick={signOutUser}
              className="text-sm text-gray-400 hover:underline"
            >
              Cerrar sesión
            </button>
          </>
        ) : (
          <button
            onClick={signIn}
              className="w-full flex items-center justify-center gap-3 border border-slate-700 rounded-lg px-4 py-3 text-sm font-medium text-slate-200 hover:bg-slate-800 transition"
          >
            <GoogleIcon />
            Iniciar sesión con Google
          </button>
        )}
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" fill="currentColor" className="text-slate-300">
      <path d="M43.6 20H24v8h11.3C33.6 33.1 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 20-9 20-20 0-1.3-.1-2.7-.4-4z"/>
      <path d="M6.3 14.7l6.6 4.8C14.6 15.1 18.9 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
      <path d="M24 44c5.2 0 9.9-1.9 13.5-5l-6.2-5.2C29.4 35.5 26.8 36 24 36c-5.2 0-9.6-2.9-11.3-7.1l-6.6 5.1C9.7 39.6 16.3 44 24 44z"/>
      <path d="M43.6 20H24v8h11.3c-.9 2.5-2.6 4.5-4.8 5.9l6.2 5.2C40.5 36.2 44 30.5 44 24c0-1.3-.1-2.7-.4-4z"/>
    </svg>
  )
}
