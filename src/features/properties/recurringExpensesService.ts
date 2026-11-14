import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  Unsubscribe,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { ExpenseCategory, RecurringExpenseOccurrence, RecurringExpenseSchedule } from '@/types'
import { cleanPayload } from '@/utils/cleanPayload'

const SCHEDULES = 'recurringExpenseSchedules'
const OCCURRENCES = 'recurringExpenseOccurrences'

function mapSchedule(id: string, data: Record<string, any>): RecurringExpenseSchedule {
  const utilityCategory = ['agua', 'luz', 'gas', 'suministros'].includes(data.category)
  return { id, ...data, amount: Number(data.amount) || 0, intervalMonths: Math.max(1, Number(data.intervalMonths) || 1), isActive: data.isActive !== false, requiresInvoice: data.requiresInvoice !== false, autoPayOnInvoiceReceived: data.autoPayOnInvoiceReceived ?? utilityCategory, isDeductible: data.isDeductible !== false } as RecurringExpenseSchedule
}

function mapOccurrence(id: string, data: Record<string, any>): RecurringExpenseOccurrence {
  return { id, ...data, amount: Number(data.amount) || 0, invoiceReceived: Boolean(data.invoiceReceived), isPaid: Boolean(data.isPaid) } as RecurringExpenseOccurrence
}

export function subscribeToRecurringExpenseSchedules(propertyId: string, onSuccess: (items: RecurringExpenseSchedule[]) => void, onError?: (error: Error) => void): Unsubscribe {
  return onSnapshot(query(collection(db, SCHEDULES), where('propertyId', '==', propertyId)), (snapshot) => {
    onSuccess(snapshot.docs.map((item) => mapSchedule(item.id, item.data())).sort((a, b) => a.description.localeCompare(b.description)))
  }, (error) => onError?.(error))
}

export function subscribeToAllRecurringExpenseSchedules(onSuccess: (items: RecurringExpenseSchedule[]) => void, onError?: (error: Error) => void): Unsubscribe {
  return onSnapshot(collection(db, SCHEDULES), (snapshot) => onSuccess(snapshot.docs.map((item) => mapSchedule(item.id, item.data()))), (error) => onError?.(error))
}

export function subscribeToRecurringExpenseOccurrences(propertyId: string, onSuccess: (items: RecurringExpenseOccurrence[]) => void, onError?: (error: Error) => void): Unsubscribe {
  return onSnapshot(query(collection(db, OCCURRENCES), where('propertyId', '==', propertyId)), (snapshot) => onSuccess(snapshot.docs.map((item) => mapOccurrence(item.id, item.data()))), (error) => onError?.(error))
}

export function subscribeToAllRecurringExpenseOccurrences(year: number, onSuccess: (items: RecurringExpenseOccurrence[]) => void, onError?: (error: Error) => void): Unsubscribe {
  return onSnapshot(query(collection(db, OCCURRENCES), where('year', '==', year)), (snapshot) => onSuccess(snapshot.docs.map((item) => mapOccurrence(item.id, item.data()))), (error) => onError?.(error))
}

export async function addRecurringExpenseSchedule(schedule: Omit<RecurringExpenseSchedule, 'id' | 'createdAt' | 'updatedAt'>) {
  return addDoc(collection(db, SCHEDULES), { ...cleanPayload(schedule), createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
}

export async function updateRecurringExpenseSchedule(id: string, updates: Partial<RecurringExpenseSchedule>) {
  return updateDoc(doc(db, SCHEDULES, id), { ...cleanPayload(updates), updatedAt: serverTimestamp() })
}

export async function createRecurringExpenseScheduleVersion(
  previousId: string,
  previousEndDate: string,
  schedule: Omit<RecurringExpenseSchedule, 'id' | 'createdAt' | 'updatedAt'>,
  moveOccurrencesFromMonth?: string,
) {
  const batch = writeBatch(db)
  const previousRef = doc(db, SCHEDULES, previousId)
  const nextRef = doc(collection(db, SCHEDULES))
  batch.update(previousRef, { endDate: previousEndDate, isActive: false, updatedAt: serverTimestamp() })
  batch.set(nextRef, { ...cleanPayload(schedule), createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
  const migrations: Array<{ oldRef: any; newRef: any; data: Record<string, any> }> = []
  if (moveOccurrencesFromMonth) {
    const snapshots = await getDocs(query(collection(db, OCCURRENCES), where('scheduleId', '==', previousId)))
    snapshots.docs.forEach((occurrenceDoc) => {
      const data = occurrenceDoc.data()
      const period = `${data.year}-${String(data.month).padStart(2, '0')}`
      if (period < moveOccurrencesFromMonth) return
      const nextOccurrenceRef = doc(db, OCCURRENCES, `${nextRef.id}_${period}`)
      migrations.push({ oldRef: occurrenceDoc.ref, newRef: nextOccurrenceRef, data: { ...data, scheduleId: nextRef.id, updatedAt: serverTimestamp() } })
    })
  }
  await batch.commit()
  for (let offset = 0; offset < migrations.length; offset += 200) {
    const migrationBatch = writeBatch(db)
    migrations.slice(offset, offset + 200).forEach(({ oldRef, newRef, data }) => {
      migrationBatch.set(newRef, data)
      migrationBatch.delete(oldRef)
    })
    await migrationBatch.commit()
  }
}

export async function deleteRecurringExpenseSchedule(id: string) {
  return deleteDoc(doc(db, SCHEDULES, id))
}

export async function endRecurringExpenseSchedule(id: string, endDate: string) {
  return updateDoc(doc(db, SCHEDULES, id), { isActive: false, endDate, updatedAt: serverTimestamp() })
}

/** Ends this property's versions of a category from a selected month onward, leaving earlier records intact. */
export async function endRecurringExpensesFromMonth(schedules: RecurringExpenseSchedule[], propertyId: string, category: ExpenseCategory, fromMonth: string) {
  const [year, month] = fromMonth.split('-').map(Number)
  const previousMonth = new Date(year, month - 2, 1)
  const endDate = `${previousMonth.getFullYear()}-${String(previousMonth.getMonth() + 1).padStart(2, '0')}-01`
  const affected = schedules.filter((schedule) => {
    if (schedule.propertyId !== propertyId || schedule.category !== category) return false
    const start = schedule.startDate.slice(0, 7)
    const end = schedule.endDate?.slice(0, 7)
    return start >= fromMonth || !end || end >= fromMonth
  })
  await Promise.all(affected.map((schedule) => endRecurringExpenseSchedule(schedule.id, endDate)))
  const scheduleIds = new Set(affected.map((schedule) => schedule.id))
  const propertyOccurrences = await getDocs(query(collection(db, OCCURRENCES), where('propertyId', '==', propertyId)))
  const futureOccurrences = propertyOccurrences.docs.filter((occurrenceDoc) => {
    const data = occurrenceDoc.data()
    return scheduleIds.has(data.scheduleId) && `${data.year}-${String(data.month).padStart(2, '0')}` >= fromMonth
  })
  for (let offset = 0; offset < futureOccurrences.length; offset += 400) {
    const batch = writeBatch(db)
    futureOccurrences.slice(offset, offset + 400).forEach((occurrenceDoc) => batch.delete(occurrenceDoc.ref))
    await batch.commit()
  }
}

export async function updateRecurringOccurrence(
  schedule: RecurringExpenseSchedule,
  year: number,
  month: number,
  updates: Partial<Pick<RecurringExpenseOccurrence, 'amount' | 'invoiceReceived' | 'invoiceReceivedDate' | 'isPaid' | 'paidAt' | 'tenantInvoiceIssued' | 'tenantInvoiceIssuedDate' | 'tenantPaid' | 'tenantPaidAt'>>,
) {
  const occurrenceId = `${schedule.id}_${year}-${String(month).padStart(2, '0')}`
  const occurrenceRef = doc(db, OCCURRENCES, occurrenceId)
  const existing = await getDoc(occurrenceRef)
  if (existing.exists()) {
    await updateDoc(occurrenceRef, { ...cleanPayload(updates), updatedAt: serverTimestamp() })
    return
  }
  await setDoc(occurrenceRef, {
    scheduleId: schedule.id,
    propertyId: schedule.propertyId,
    year,
    month,
    amount: schedule.amount,
    invoiceReceived: false,
    isPaid: false,
    ...cleanPayload(updates),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}
