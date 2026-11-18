import {
  doc,
  setDoc,
  where,
  serverTimestamp,
  Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { subscribeToCollection } from '@/lib/firestoreSubscriptions'
import { RentPayment, RentPaymentManualStatus } from '@/types'
import { cleanPayload } from '@/utils/cleanPayload'
import { asBoolean, asNumber, asNumberOr, asString } from '@/utils/coerce'

const COLLECTION_NAME = 'rentPayments'

function isManualStatus(value: unknown): value is RentPaymentManualStatus {
  return value === 'auto' || value === 'paid' || value === 'partial' || value === 'overdue' || value === 'overpaid' || value === 'rent-change'
}

function mapRentPayment(id: string, data: Record<string, any>): RentPayment {
  return {
    id,
    propertyId: asString(data.propertyId),
    year: asNumberOr(data.year, 0),
    month: asNumberOr(data.month, 0),
    amount: asNumberOr(data.amount, 0),
    receivedAmount: asNumber(data.receivedAmount),
    isPaid: asBoolean(data.isPaid),
    paidAt: asString(data.paidAt) || undefined,
    invoiceIssued: asBoolean(data.invoiceIssued),
    invoiceReceivedDate: asString(data.invoiceReceivedDate) || undefined,
    notes: asString(data.notes),
    updatedBy: asString(data.updatedBy),
    manualStatus: isManualStatus(data.manualStatus) ? data.manualStatus : 'auto',
    showWarning: data.showWarning !== false,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  }
}

export function subscribeToYearPayments(
  propertyId: string,
  year: number,
  onSuccess: (payments: RentPayment[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return subscribeToCollection<RentPayment>({
    name: COLLECTION_NAME,
    constraints: [where('propertyId', '==', propertyId), where('year', '==', year)],
    filter: (data) => !data.deletedAt,
    map: mapRentPayment,
    onSuccess,
    onError,
  })
}

/** Todos los cobros de un inmueble, para la comparativa anual. */
export function subscribeToPropertyPayments(
  propertyId: string,
  onSuccess: (payments: RentPayment[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return subscribeToCollection<RentPayment>({
    name: COLLECTION_NAME,
    constraints: [where('propertyId', '==', propertyId)],
    filter: (data) => !data.deletedAt,
    map: mapRentPayment,
    onSuccess,
    onError,
  })
}

export function subscribeToAllYearPayments(year: number, onSuccess: (payments: RentPayment[]) => void, onError?: (error: Error) => void): Unsubscribe {
  return subscribeToCollection<RentPayment>({
    name: COLLECTION_NAME,
    constraints: [where('year', '==', year)],
    filter: (data) => !data.deletedAt,
    map: mapRentPayment,
    onSuccess,
    onError,
  })
}

/** Listen to rent records through the selected year to identify accumulated arrears. */
export function subscribeToPaymentsThroughYear(
  year: number,
  onSuccess: (payments: RentPayment[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return subscribeToCollection<RentPayment>({
    name: COLLECTION_NAME,
    constraints: [where('year', '<=', year)],
    filter: (data) => !data.deletedAt,
    map: mapRentPayment,
    onSuccess,
    onError,
  })
}

export async function toggleRentPayment(
  propertyId: string,
  year: number,
  month: number,
  amount: number,
  isPaid: boolean,
  userName?: string,
) {
  const docId = `${propertyId}_${year}_${month}`
  const docRef = doc(db, COLLECTION_NAME, docId)

  const payload = cleanPayload({
    propertyId,
    year,
    month,
    amount,
    receivedAmount: isPaid ? amount : 0,
    isPaid,
    paidAt: isPaid ? new Date().toISOString().split('T')[0] : null,
    updatedBy: userName || 'Usuario',
    updatedAt: serverTimestamp(),
  })

  return await setDoc(docRef, payload, { merge: true })
}

export async function recordRentReceipt(propertyId: string, year: number, month: number, expectedAmount: number, receivedAmount: number, userName?: string) {
  const docId = `${propertyId}_${year}_${month}`
  const isPaid = receivedAmount >= expectedAmount
  return setDoc(doc(db, COLLECTION_NAME, docId), cleanPayload({
    propertyId,
    year,
    month,
    amount: expectedAmount,
    receivedAmount,
    isPaid,
    paidAt: receivedAmount > 0 ? new Date().toISOString().split('T')[0] : null,
    updatedBy: userName || 'Usuario',
    updatedAt: serverTimestamp(),
  }), { merge: true })
}

export async function toggleInvoiceIssued(
  propertyId: string,
  year: number,
  month: number,
  amount: number,
  invoiceIssued: boolean,
) {
  const docId = `${propertyId}_${year}_${month}`
  const docRef = doc(db, COLLECTION_NAME, docId)

  const payload = cleanPayload({
    propertyId,
    year,
    month,
    amount,
    invoiceIssued,
    updatedAt: serverTimestamp(),
  })

  return await setDoc(docRef, payload, { merge: true })
}

export async function updateRentNotes(
  propertyId: string,
  year: number,
  month: number,
  amount: number,
  notes: string,
) {
  const docId = `${propertyId}_${year}_${month}`
  const docRef = doc(db, COLLECTION_NAME, docId)

  const payload = cleanPayload({
    propertyId,
    year,
    month,
    amount,
    notes,
    updatedAt: serverTimestamp(),
  })

  return await setDoc(docRef, payload, { merge: true })
}

/** Persist the visual status and warning visibility selected for one month. */
export async function updateRentPaymentMeta(
  propertyId: string,
  year: number,
  month: number,
  amount: number,
  updates: { manualStatus?: RentPaymentManualStatus; showWarning?: boolean },
) {
  const docId = `${propertyId}_${year}_${month}`
  const docRef = doc(db, COLLECTION_NAME, docId)

  const payload = cleanPayload({
    propertyId,
    year,
    month,
    amount,
    manualStatus: updates.manualStatus,
    showWarning: updates.showWarning,
    updatedAt: serverTimestamp(),
  })

  return await setDoc(docRef, payload, { merge: true })
}
