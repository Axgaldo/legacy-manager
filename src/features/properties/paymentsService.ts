import {
  collection,
  doc,
  setDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  Unsubscribe,
  DocumentData,
  QueryDocumentSnapshot,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { RentPayment, RentPaymentManualStatus } from '@/types'
import { cleanPayload } from '@/utils/cleanPayload'

const COLLECTION_NAME = 'rentPayments'

function isManualStatus(value: unknown): value is RentPaymentManualStatus {
  return value === 'auto' || value === 'paid' || value === 'partial' || value === 'overdue' || value === 'overpaid' || value === 'rent-change'
}

function mapRentPayment(docSnap: QueryDocumentSnapshot<DocumentData>): RentPayment {
  const data = docSnap.data()
  return {
    id: docSnap.id,
    propertyId: data.propertyId,
    year: Number(data.year),
    month: Number(data.month),
    amount: Number(data.amount) || 0,
    receivedAmount: data.receivedAmount === undefined ? undefined : Number(data.receivedAmount) || 0,
    isPaid: Boolean(data.isPaid),
    paidAt: data.paidAt ?? undefined,
    invoiceIssued: Boolean(data.invoiceIssued),
    invoiceReceivedDate: data.invoiceReceivedDate ?? undefined,
    notes: data.notes ?? '',
    updatedBy: data.updatedBy ?? '',
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
  const q = query(
    collection(db, COLLECTION_NAME),
    where('propertyId', '==', propertyId),
    where('year', '==', year),
  )

  return onSnapshot(
    q,
    (snapshot) => {
      onSuccess(snapshot.docs.filter((item) => !item.data().deletedAt).map(mapRentPayment))
    },
    (err) => {
      console.error('Error in rent payments subscription:', err)
      if (onError) onError(err)
    },
  )
}

export function subscribeToAllYearPayments(year: number, onSuccess: (payments: RentPayment[]) => void, onError?: (error: Error) => void): Unsubscribe {
  return onSnapshot(query(collection(db, COLLECTION_NAME), where('year', '==', year)), (snapshot) => {
    onSuccess(snapshot.docs.filter((item) => !item.data().deletedAt).map(mapRentPayment))
  }, (error) => { console.error('Error loading annual rent matrix:', error); onError?.(error) })
}

/** Listen to rent records through the selected year to identify accumulated arrears. */
export function subscribeToPaymentsThroughYear(
  year: number,
  onSuccess: (payments: RentPayment[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(collection(db, COLLECTION_NAME), where('year', '<=', year))
  return onSnapshot(q, (snapshot) => {
    onSuccess(snapshot.docs.filter((item) => !item.data().deletedAt).map(mapRentPayment))
  }, (error) => {
    console.error('Error fetching rent payment overview:', error)
    onError?.(error)
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
