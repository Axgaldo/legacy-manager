import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import { AuthProvider } from '@/features/auth/AuthProvider'
import PrivateRoute       from '@/features/auth/PrivateRoute'
import AppLayout          from '@/components/layout/AppLayout'
import PageLoader         from '@/components/ui/PageLoader'
import { PrivacyProvider } from '@/features/privacy/PrivacyProvider'
import { ToastProvider } from '@/components/ui/ToastProvider'

// Cada pantalla se descarga bajo demanda: el primer render solo necesita el
// layout, la autenticación y la página que se abre.
const LoginPage          = lazy(() => import('@/features/auth/LoginPage'))
const PropertiesPage     = lazy(() => import('@/features/properties/PropertiesPage'))
const PropertyDetailPage = lazy(() => import('@/features/properties/PropertyDetailPage'))
const TenantDetailPage   = lazy(() => import('@/features/tenants/TenantDetailPage'))
const CollectionsPage    = lazy(() => import('@/features/collections/CollectionsPage'))
const HomePage           = lazy(() => import('@/features/home/HomePage'))
const TrashPage          = lazy(() => import('@/features/trash/TrashPage'))

/** Keeps old /inquilinos/:id links working after moving Inquilinos under Inmuebles. */
function LegacyTenantRedirect() {
  const { id } = useParams<{ id: string }>()
  return <Navigate to={`/inmuebles/inquilinos/${id ?? ''}`} replace />
}

export default function App() {
  return (
    <BrowserRouter basename="/legacy-manager">
      <AuthProvider>
        <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route
            element={
              <PrivateRoute>
                <PrivacyProvider>
                  <ToastProvider>
                    <AppLayout />
                  </ToastProvider>
                </PrivacyProvider>
              </PrivateRoute>
            }
          >
            <Route index element={<HomePage />} />

            {/* Inmuebles section: one URL per tab */}
            <Route path="/inmuebles" element={<PropertiesPage tab="properties" />} />
            <Route path="/inmuebles/alquileres" element={<PropertiesPage tab="rentals" />} />
            <Route path="/inmuebles/gastos" element={<PropertiesPage tab="expenses" />} />
            <Route path="/inmuebles/fiscal" element={<PropertiesPage tab="fiscal" />} />
            <Route path="/inmuebles/inquilinos" element={<PropertiesPage tab="tenants" />} />
            <Route path="/inmuebles/inquilinos/:id" element={<TenantDetailPage />} />
            <Route path="/inmuebles/:id" element={<PropertyDetailPage />} />

            {/* Legacy tenant URLs */}
            <Route path="/inquilinos" element={<Navigate to="/inmuebles/inquilinos" replace />} />
            <Route path="/inquilinos/:id" element={<LegacyTenantRedirect />} />

            <Route path="/bienes" element={<CollectionsPage />} />
            <Route path="/bienes/importar" element={<Navigate to="/bienes" replace />} />
            <Route path="/bienes/categoria/:collectionKey" element={<CollectionsPage />} />
            <Route path="/bienes/categoria/:collectionKey/:assetSlug" element={<CollectionsPage />} />
            <Route path="/bienes/:assetSlug" element={<CollectionsPage />} />

            <Route path="/papelera" element={<TrashPage />} />

            {/* Unknown URLs (old links, typos) fall back to the home panel instead of a blank page. */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  )
}
