import { useMemo } from 'react'
import { getCurrency } from '@/features/collections/numismaticaMeta'
import { usePrivacy } from './PrivacyProvider'

/**
 * Formato central de las cifras de dinero de la app. Todos los componentes
 * muestran importes a través de `useMoney()` para que el modo incógnito los
 * enmascare en todas las páginas a la vez.
 */

const euroFormatters = {
  0: new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }),
  2: new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }),
} as const

/** Importes en euros sin enmascarar. `undefined`/NaN se muestran como «—». */
export function formatEuroValue(value?: number, decimals: 0 | 2 = 0): string {
  if (value === undefined || Number.isNaN(value)) return '—'
  return euroFormatters[decimals].format(value)
}

/** Importe original con su divisa (3.500 ptas, 12,50 CHF…). */
export function formatOriginalValue(amount?: number, currency?: string): string {
  if (amount === undefined || Number.isNaN(amount)) return ''
  const info = getCurrency(currency)
  const formatted = amount.toLocaleString('es-ES', { maximumFractionDigits: 2 })
  return currency ? `${formatted} ${info.code === 'ESP' ? 'ptas' : info.symbol}` : formatted
}

// Caracteres usados para censurar los importes en modo incógnito.
const MASK_CHARACTERS = ['#', '%', '&', '$', '@', '§', '£', '¥', '*', '?', '•', '▓'] as const

function randomMask(): string {
  const length = 5 + Math.floor(Math.random() * 3)
  let mask = ''
  for (let index = 0; index < length; index++) {
    mask += MASK_CHARACTERS[Math.floor(Math.random() * MASK_CHARACTERS.length)]
  }
  return mask
}

/** Cifra en euros censurada: «€ ▓#%$&•». */
export function maskedEuro(): string {
  return `€ ${randomMask()}`
}

/** Cifra con divisa original censurada: «▓#%$&•». */
export function maskedAmount(): string {
  return randomMask()
}

export type MoneyFormatter = {
  /** En modo incógnito devuelve siempre una máscara aleatoria. */
  formatEuro: (value?: number, decimals?: 0 | 2) => string
  /** Importe original + divisa; vacío si no hay importe. */
  formatOriginal: (amount?: number, currency?: string) => string
}

/** Acceso a los formateadores de dinero conscientes del modo incógnito. */
export function useMoney(): MoneyFormatter {
  const { incognito } = usePrivacy()
  return useMemo(() => ({
    formatEuro: (value?: number, decimals: 0 | 2 = 0) => (incognito ? maskedEuro() : formatEuroValue(value, decimals)),
    formatOriginal: (amount?: number, currency?: string) => {
      if (amount === undefined) return ''
      return incognito ? maskedAmount() : formatOriginalValue(amount, currency)
    },
  }), [incognito])
}
