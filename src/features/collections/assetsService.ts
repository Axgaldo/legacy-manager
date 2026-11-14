import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { AssetItem } from '@/types'
import { cleanPayload } from '@/utils/cleanPayload'

const COLLECTION_NAME = 'assets'

export function subscribeToAssets(
  onSuccess: (assets: AssetItem[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'))

  return onSnapshot(
    q,
    (snapshot) => {
      const items: AssetItem[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data()
        return {
          id: docSnap.id,
          name: data.name ?? '',
          owner: data.owner ?? 'Gabriel',
          category: data.category ?? 'other',
          tags: Array.isArray(data.tags) ? data.tags : [data.brandOrAuthor, data.material, data.historicalEra, data.country, data.ruler, data.mint, data.denomination, data.conservationState].filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0),
          location: data.location ?? '',
          description: data.description ?? '',
          year: data.year !== undefined && data.year !== null ? Number(data.year) : undefined,
          historicalEra: data.historicalEra ?? '',
          country: data.country ?? '',
          placeOfOrigin: data.placeOfOrigin ?? data.country ?? '',
          brandOrAuthor: data.brandOrAuthor ?? '',
          ruler: data.ruler ?? '',
          mint: data.mint ?? '',
          denomination: data.denomination ?? '',
          conservationState: data.conservationState ?? '',
          material: data.material ?? '',
          acquisitionYear: data.acquisitionYear ? Number(data.acquisitionYear) : undefined,
          acquisitionPrice: data.acquisitionPrice ? Number(data.acquisitionPrice) : undefined,
          currentValue: data.currentValue ? Number(data.currentValue) : undefined,
          notes: data.notes ?? '',
          photos: Array.isArray(data.photos) ? data.photos : [],
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        }
      })
      onSuccess(items)
    },
    (err) => {
      console.error('Error fetching assets from Firestore:', err)
      if (onError) onError(err)
    },
  )
}

export async function createAsset(
  asset: Omit<AssetItem, 'id' | 'createdAt' | 'updatedAt'>,
) {
  const colRef = collection(db, COLLECTION_NAME)
  const cleaned = cleanPayload(asset)
  return await addDoc(colRef, {
    ...cleaned,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function updateAsset(
  id: string,
  asset: Partial<Omit<AssetItem, 'id' | 'createdAt' | 'updatedAt'>>,
) {
  const docRef = doc(db, COLLECTION_NAME, id)
  const cleaned = cleanPayload(asset)
  return await updateDoc(docRef, {
    ...cleaned,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteAsset(id: string) {
  const docRef = doc(db, COLLECTION_NAME, id)
  return await deleteDoc(docRef)
}
