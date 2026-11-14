import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthProvider'

/**
 * Wraps any route that requires authentication and whitelist membership.
 * Shows a loading state while Firebase resolves the session.
 */
export default function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, isAllowed, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-400 text-sm">Cargando…</p>
      </div>
    )
  }

  if (!user || !isAllowed) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <>{children}</>
}
