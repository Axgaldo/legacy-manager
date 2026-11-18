import {
  collection,
  onSnapshot,
  query,
  type QueryConstraint,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from './firebase'

export interface SubscribeCollectionOptions<T> {
  /** Nombre de la colección (o ruta de subcolección). */
  name: string
  /** Convierte un documento crudo al modelo de la app. */
  map: (id: string, data: Record<string, any>) => T
  onSuccess: (items: T[]) => void
  onError?: (error: Error) => void
  /** `where`, `orderBy`… que ya vienen del servicio. */
  constraints?: QueryConstraint[]
  /** Filtro en cliente para no repetir `if (data.deletedAt)` en cada mapper. */
  filter?: (data: Record<string, any>) => boolean
  /** Orden final en memoria (más barato que crear índices compuestos). */
  sort?: (a: T, b: T) => number
}

/**
 * Punto único de suscripción a Firestore: aplica el mapeo, el filtro de
 * papelera y el orden, y registra los errores con el nombre de la colección.
 * Evita repetir `onSnapshot` + `snapshot.docs.map` en cada servicio.
 */
export function subscribeToCollection<T>({
  name,
  map,
  onSuccess,
  onError,
  constraints = [],
  filter,
  sort,
}: SubscribeCollectionOptions<T>): Unsubscribe {
  const source = constraints.length
    ? query(collection(db, name), ...constraints)
    : collection(db, name)

  return onSnapshot(
    source,
    (snapshot) => {
      const items = snapshot.docs
        .filter((item) => !filter || filter(item.data()))
        .map((item) => map(item.id, item.data()))
      if (sort) items.sort(sort)
      onSuccess(items)
    },
    (error) => {
      console.error(`Error loading ${name}:`, error)
      onError?.(error)
    },
  )
}
