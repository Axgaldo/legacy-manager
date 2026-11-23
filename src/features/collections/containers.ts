import type { AssetItem } from '@/types'
import { assetValue, containerLabel, isMedal } from './numismaticaUi'

/**
 * Índice de álbumes/contenedores derivado de los bienes.
 *
 * El nombre del contenedor (`case_location` o `medal_location`) no siempre es
 * único: dos álbumes físicos pueden llamarse «Álbum 1 · Hoja 1». Cuando eso
 * ocurre, se separan por el origen de importación (`import_source`) y, para la
 * etiqueta, por el país dominante de cada parte. Así no hay que modificar
 * ninguna ficha y dos álbumes homónimos siguen siendo dos tarjetas distintas.
 */

export interface AssetContainer {
  key: string
  label: string
  baseLabel: string
  disambiguator?: string
  assets: AssetItem[]
  count: number
  value: number
  coins: number
  medals: number
  countries: string[]
  eras: string[]
}

export interface ContainerIndex {
  containers: AssetContainer[]
  keyByAssetId: Map<string, string>
  labelByKey: Map<string, string>
}

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es')
}

function countryOf(asset: AssetItem): string {
  return asset.country?.trim() || asset.placeOfOrigin?.trim() || ''
}

function topValues(values: string[], limit: number): string[] {
  const counts = new Map<string, { label: string; count: number }>()
  values.forEach((value) => {
    const label = value.trim()
    if (!label) return
    const key = normalize(label)
    const current = counts.get(key)
    if (current) current.count++
    else counts.set(key, { label, count: 1 })
  })
  return Array.from(counts.values())
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'es', { numeric: true }))
    .slice(0, limit)
    .map((item) => item.label)
}

function dominantCountry(assets: AssetItem[]): string | undefined {
  return topValues(assets.map(countryOf), 1)[0]
}

/**
 * Solo las páginas con nombre genérico («Álbum 1 · Hoja 1») se separan por
 * origen. Un contenedor con nombre propio («Varios países», «Maleta 1 ·
 * Bandeja 2») puede haber llegado en varios archivos y sigue siendo uno solo.
 */
function isGenericAlbumPage(label: string): boolean {
  return /^album\s+\d+\s*·\s*hoja\s+\d+\.?$/.test(normalize(label))
}

/**
 * Tramo útil de `import_source`: normalmente el último («romanos/Denarios
 * imperio» → «Denarios imperio»). Si repite el nombre del álbum, se usa el
 * primero («lote/Álbum 1» → «lote») para no dejar dos etiquetas iguales.
 */
function sourceSuffix(source: string, baseLabel: string): string | undefined {
  const parts = source.split('/').map((part) => part.trim()).filter(Boolean)
  const last = parts[parts.length - 1]
  if (last && normalize(last) !== normalize(baseLabel)) return last
  const first = parts[0]
  if (first && normalize(first) !== normalize(baseLabel)) return first
  return undefined
}

function makeContainer(
  key: string,
  label: string,
  baseLabel: string,
  disambiguator: string | undefined,
  assets: AssetItem[],
): AssetContainer {
  return {
    key,
    label,
    baseLabel,
    disambiguator,
    assets,
    count: assets.length,
    value: assets.reduce((total, asset) => total + assetValue(asset), 0),
    coins: assets.filter((asset) => !isMedal(asset)).length,
    medals: assets.filter((asset) => isMedal(asset)).length,
    countries: topValues(assets.map(countryOf), 3),
    eras: topValues(assets.map((asset) => asset.era || asset.historicalEra || ''), 2),
  }
}

/** Recalcula las cifras de un contenedor conservando su clave y etiqueta. */
export function containerWithAssets(container: AssetContainer, assets: AssetItem[]): AssetContainer {
  return makeContainer(container.key, container.label, container.baseLabel, container.disambiguator, assets)
}

export function buildContainerIndex(assets: AssetItem[]): ContainerIndex {
  const baseGroups = new Map<string, AssetItem[]>()
  assets.forEach((asset) => {
    const base = containerLabel(asset)
    const list = baseGroups.get(base) ?? []
    list.push(asset)
    baseGroups.set(base, list)
  })

  const containers: AssetContainer[] = []

  baseGroups.forEach((items, baseLabel) => {
    const bySource = new Map<string, AssetItem[]>()
    items.forEach((asset) => {
      const source = (asset.import_source ?? '').trim()
      const list = bySource.get(source) ?? []
      list.push(asset)
      bySource.set(source, list)
    })

    if (bySource.size <= 1 || !isGenericAlbumPage(baseLabel)) {
      containers.push(makeContainer(baseLabel, baseLabel, baseLabel, undefined, items))
      return
    }

    const entries = Array.from(bySource.entries())
    const countries = entries.map(([, list]) => dominantCountry(list))
    const countriesAreDistinct = countries.every(Boolean)
      && new Set(countries.map((country) => normalize(country ?? ''))).size === entries.length

    entries.forEach(([source, list], index) => {
      const country = countries[index]
      // Si cada álbum tiene un país dominante distinto, es la etiqueta más útil
      // («Álbum 1 · Hoja 1 · República Romana»). Si no, se usa el origen.
      const disambiguator = (countriesAreDistinct ? country : undefined)
        ?? sourceSuffix(source, baseLabel)
        ?? country
        ?? 'Sin origen'
      containers.push(makeContainer(
        `${baseLabel}||${source}`,
        `${baseLabel} · ${disambiguator}`,
        baseLabel,
        disambiguator,
        list,
      ))
    })
  })

  // Dos orígenes distintos podrían producir la misma etiqueta; se numeran.
  const labelCounts = new Map<string, number>()
  containers.forEach((container) => {
    const normalized = normalize(container.label)
    const count = (labelCounts.get(normalized) ?? 0) + 1
    labelCounts.set(normalized, count)
    if (count > 1) container.label = `${container.label} (${count})`
  })

  containers.sort((a, b) => a.label.localeCompare(b.label, 'es', { numeric: true }))

  const keyByAssetId = new Map<string, string>()
  const labelByKey = new Map<string, string>()
  containers.forEach((container) => {
    labelByKey.set(container.key, container.label)
    container.assets.forEach((asset) => keyByAssetId.set(asset.id, container.key))
  })

  return { containers, keyByAssetId, labelByKey }
}
