import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import ErrorBoundary from '@/components/ui/ErrorBoundary'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)

// PWA: solo en producción. El service worker cachea el shell y los assets con
// hash para abrir la app sin cobertura; nunca intercepta peticiones a Firebase.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js?v=${__APP_VERSION__}`)
      .catch((error) => console.warn('No se pudo registrar el service worker:', error))
  })
}
