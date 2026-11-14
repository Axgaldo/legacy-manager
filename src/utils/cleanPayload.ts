/**
 * Removes all undefined properties from an object so Firestore addDoc / updateDoc
 * does not throw "Unsupported field value: undefined".
 */
export function cleanPayload<T extends Record<string, any>>(data: T): Record<string, any> {
  const cleaned: Record<string, any> = {}
  for (const [key, val] of Object.entries(data)) {
    if (val !== undefined) {
      cleaned[key] = val
    }
  }
  return cleaned
}
