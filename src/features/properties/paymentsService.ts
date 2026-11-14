import {
  collection,
  doc,
  setDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { RentPayment } from '@/types'
import { cleanPayload } from '@/utils/cleanPayload'

const COLLECTION_NAME = 'rentPayments'

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
      const items: RentPayment[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data()
        return {
          id: docSnap.id,
          propertyId: d.propertyId,
          year: d.year,
          month: d.month,
          amount: Number(d.amount) || 0,
          isPaid: Boolean(d.isPaid),
          paidAt: d.paidAt ?? undefined,
          invoiceIssued: Boolean(d.invoiceIssued),
          notes: d.notes ?? '',
          updatedBy: d.updatedBy ?? '',
          createdAt: d.createdAt,
          updatedAt: d.updatedAt,
        }
      })
      onSuccess(items)
    },
    (err) => {
      console.error('Error in rent payments subscription:', err)
      if (onError) onError(err)
    },
  )
}

/** Listen to rent records through the selected year to identify accumulated arrears. */
export function subscribeToPaymentsThroughYear(
  year: number,
  onSuccess: (payments: RentPayment[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(collection(db, COLLECTION_NAME), where('year', '<=', year))
  return onSnapshot(q, (snapshot) => {
    const items: RentPayment[] = snapshot.docs.map((docSnap) => {
      const d = docSnap.data()
      return {
        id: docSnap.id,
        propertyId: d.propertyId,
        year: Number(d.year),
        month: Number(d.month),
        amount: Number(d.amount) || 0,
        isPaid: Boolean(d.isPaid),
        paidAt: d.paidAt ?? undefined,
        invoiceIssued: Boolean(d.invoiceIssued),
        notes: d.notes ?? '',
        updatedBy: d.updatedBy ?? '',
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      }
    })
    onSuccess(items)
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
    isPaid,
    paidAt: isPaid ? new Date().toISOString().split('T')[0] : null,
    updatedBy: userName || 'Usuario',
    updatedAt: serverTimestamp(),
  })

  return await setDoc(docRef, payload, { merge: true })
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
