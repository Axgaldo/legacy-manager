import { RentPaymentManualStatus } from '@/types'

export type RentPaymentDisplayStatus =
  | 'paid'
  | 'partial'
  | 'overdue'
  | 'overpaid'
  | 'rent-change'
  | 'current'
  | 'future'
  | 'na'

export interface RentStatusMeta {
  label: string
  text: string
  badge: string
  dot: string
}

export const RENT_STATUS_META: Record<RentPaymentDisplayStatus, RentStatusMeta> = {
  paid: {
    label: 'Cobrado',
    text: 'text-emerald-600',
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    dot: 'bg-emerald-500',
  },
  partial: {
    label: 'Pago parcial',
    text: 'text-red-600',
    badge: 'border-red-200 bg-red-50 text-red-700',
    dot: 'bg-red-500',
  },
  overdue: {
    label: 'Retraso',
    text: 'text-red-600',
    badge: 'border-red-200 bg-red-50 text-red-700',
    dot: 'bg-red-500',
  },
  overpaid: {
    label: 'Sobre pago',
    text: 'text-amber-600',
    badge: 'border-amber-200 bg-amber-50 text-amber-700',
    dot: 'bg-amber-500',
  },
  'rent-change': {
    label: 'Cambio de renta',
    text: 'text-sky-600',
    badge: 'border-sky-200 bg-sky-50 text-sky-700',
    dot: 'bg-sky-500',
  },
  current: {
    label: 'En curso',
    text: 'text-amber-600',
    badge: 'border-amber-200 bg-amber-50 text-amber-700',
    dot: 'bg-amber-500',
  },
  future: {
    label: 'Próximo',
    text: 'text-slate-500',
    badge: 'border-slate-200 bg-slate-50 text-slate-600',
    dot: 'bg-slate-400',
  },
  na: {
    label: 'No aplica',
    text: 'text-slate-400',
    badge: 'border-slate-200 bg-slate-50 text-slate-500',
    dot: 'bg-slate-300',
  },
}

export const MANUAL_STATUS_OPTIONS: Array<{ value: RentPaymentManualStatus; label: string }> = [
  { value: 'auto', label: 'Automático' },
  { value: 'paid', label: 'Cobrado' },
  { value: 'partial', label: 'Pago parcial' },
  { value: 'overdue', label: 'Retraso' },
  { value: 'overpaid', label: 'Sobre pago' },
  { value: 'rent-change', label: 'Cambio de renta' },
]

export function resolveAutoRentStatus({
  rentApplicable,
  received,
  due,
  isFuture,
  isCurrent,
  rentChanged,
}: {
  rentApplicable: boolean
  received: number
  due: number
  isFuture: boolean
  isCurrent: boolean
  rentChanged: boolean
}): RentPaymentDisplayStatus {
  if (!rentApplicable || due <= 0) return 'na'
  if (rentChanged && received <= 0) return 'rent-change'
  if (received <= 0) return isFuture ? 'future' : isCurrent ? 'current' : 'overdue'
  if (received < due) return 'partial'
  if (received > due) return 'overpaid'
  return 'paid'
}

export function resolveRentStatus(manualStatus: RentPaymentManualStatus | undefined, autoStatus: RentPaymentDisplayStatus): RentPaymentDisplayStatus {
  const manual = manualStatus && manualStatus !== 'auto' ? manualStatus : undefined
  return manual ?? autoStatus
}
