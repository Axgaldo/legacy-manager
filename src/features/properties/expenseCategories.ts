import { ExpenseCategory } from '@/types'

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string; icon: string }[] = [
  { value: 'comunidad', label: 'Comunidad', icon: '🏢' },
  { value: 'ibi', label: 'IBI', icon: '🏛️' },
  { value: 'basura', label: 'Tasa de basura / residuos', icon: '♻️' },
  { value: 'tasa_municipal', label: 'Otros impuestos y tasas', icon: '🧾' },
  { value: 'seguro', label: 'Seguro', icon: '🛡️' },
  { value: 'agua', label: 'Agua', icon: '💧' },
  { value: 'luz', label: 'Electricidad', icon: '💡' },
  { value: 'gas', label: 'Gas', icon: '🔥' },
  { value: 'suministros', label: 'Suministros varios (antiguo)', icon: '🔌' },
  { value: 'reparacion', label: 'Reparación y mantenimiento', icon: '🔧' },
  { value: 'administracion', label: 'Administración / agencia', icon: '📋' },
  { value: 'otro', label: 'Otros', icon: '📦' },
]

export const EXPENSE_KIND_LABELS = {
  'one-off': 'Puntual',
  recurring: 'Periódico',
} as const

export const EXPENSE_FREQUENCY_LABELS = {
  monthly: 'Mensual',
  bimonthly: 'Bimestral (cada 2 meses)',
  quarterly: 'Trimestral',
  annual: 'Anual',
} as const
