import { useEffect, useMemo, useState } from 'react'
import { AssetItem, Property } from '@/types'
import { subscribeToAssets } from '@/features/collections/assetsService'
import { subscribeToProperties } from '@/features/properties/propertiesService'
import { getDefaultOwner, getOwnerOptions } from '@/utils/owners'

export function useOwnerDirectory() {
  const [properties, setProperties] = useState<Property[]>([])
  const [assets, setAssets] = useState<AssetItem[]>([])

  useEffect(() => subscribeToProperties(setProperties), [])
  useEffect(() => subscribeToAssets(setAssets), [])

  const owners = useMemo(() => getOwnerOptions(properties, assets), [properties, assets])
  const defaultOwner = useMemo(() => getDefaultOwner(properties, assets), [properties, assets])
  return { owners: owners.map((owner) => owner.name), defaultOwner }
}
