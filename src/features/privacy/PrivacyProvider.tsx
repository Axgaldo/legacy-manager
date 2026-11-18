import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

const STORAGE_KEY = 'legacy-manager:modo-incognito'

export interface PrivacyContextValue {
  /** When true, every money figure is shown masked with random symbols. */
  incognito: boolean
  setIncognito: (value: boolean) => void
  toggleIncognito: () => void
}

const PrivacyContext = createContext<PrivacyContextValue | null>(null)

/**
 * Modo incógnito: oculta todas las cifras de dinero de la app (estilo Trade
 * Republic) mientras se sigue trabajando con normalidad. Se activa desde la
 * barra lateral y se recuerda entre sesiones en localStorage.
 */
export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [incognito, setIncognito] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(STORAGE_KEY) === '1'
    } catch {
      return false
    }
  })

  useEffect(() => {
    try {
      if (incognito) window.localStorage.setItem(STORAGE_KEY, '1')
      else window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Sin localStorage (modo privado del navegador): solo dura la sesión.
    }
  }, [incognito])

  const value = useMemo<PrivacyContextValue>(() => ({
    incognito,
    setIncognito,
    toggleIncognito: () => setIncognito((current) => !current),
  }), [incognito])

  return <PrivacyContext.Provider value={value}>{children}</PrivacyContext.Provider>
}

export function usePrivacy(): PrivacyContextValue {
  const context = useContext(PrivacyContext)
  if (!context) throw new Error('usePrivacy debe usarse dentro de <PrivacyProvider>')
  return context
}
