import { AssetItem, Property } from '@/types'

export interface OwnerOption {
  name: string
  count: number
}

export function getOwnerOptions(properties: Property[], assets: AssetItem[]): OwnerOption[] {
  const counts = new Map<string, { name: string; count: number }>()
  const add = (value?: string) => {
    const name = value?.trim()
    if (!name) return
    const key = name.toLocaleLowerCase()
    const current = counts.get(key)
    if (current) current.count++
    else counts.set(key, { name, count: 1 })
  }

  properties.forEach((property) => add(property.owner))
  assets.forEach((asset) => add(asset.owner))

  return Array.from(counts.values()).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'es'))
}

export function getDefaultOwner(properties: Property[], assets: AssetItem[]): string {
  return getOwnerOptions(properties, assets)[0]?.name ?? 'Gabriel'
}

export function resolveOwnerName(value: string, owners: string[], defaultOwner: string): string {
  const candidate = value.trim() || defaultOwner
  return owners.find((owner) => owner.toLocaleLowerCase() === candidate.toLocaleLowerCase()) ?? candidate
}
