import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/features/auth/AuthProvider'
import PrivateRoute       from '@/features/auth/PrivateRoute'
import LoginPage          from '@/features/auth/LoginPage'
import AppLayout          from '@/components/layout/AppLayout'
import PropertiesPage     from '@/features/properties/PropertiesPage'
import PropertyDetailPage from '@/features/properties/PropertyDetailPage'
import CollectionsPage    from '@/features/collections/CollectionsPage'

export default function App() {
  return (
    <BrowserRouter basename="/legacy-manager">
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route
            element={
              <PrivateRoute>
                <AppLayout />
              </PrivateRoute>
            }
          >
            <Route index element={<Navigate to="/inmuebles" replace />} />
            <Route path="/inmuebles" element={<PropertiesPage />} />
            <Route path="/inmuebles/:id" element={<PropertyDetailPage />} />
            <Route path="/bienes" element={<CollectionsPage />} />
            <Route path="/bienes/categoria/:collectionKey" element={<CollectionsPage />} />
            <Route path="/bienes/:assetSlug" element={<CollectionsPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
