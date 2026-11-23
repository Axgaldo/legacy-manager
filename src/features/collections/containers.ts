import type { AssetItem } from '@/types'
import { assetValue, containerLabel, isMedal } from './numismaticaUi'

/**
 * Jerarquía de álbumes y páginas.
 *
 * - **Página/ubicación**: el texto de `case_location`/`medal_location`
 *   («Álbum 1 · Hoja 1»). Se usa para agrupar la lista.
 * - **Álbum**: el contenedor físico. Las páginas «… · Hoja N» se agrupan en su
 *   álbum padre («Álbum 1»), y si dos álbumes físicos comparten nombre se
 *   separan por el origen de importación y el país dominante.
 *
 * Así «Álbum 1 · Hoja 1» del imperio y de la república no se mezclan, pero las
 * hojas 1..N de cada uno forman una sola tarjeta/álbum. No se modifica ninguna
 * ficha.
 */

export interface AssetAlbum {
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
  /** Páginas/hojas que componen el álbum (vacío en contenedores sin hojas). */
  pages: string[]
  pageCount: number
  isPaged: boolean
}

export interface AlbumIndex {
  albums: AssetAlbum[]
  albumKeyByAssetId: Map<string, string>
  albumLabelByKey: Map<string, string>
  /** Etiqueta de la página/ubicación, ya desambiguada para la lista. */
  pageLabelByAssetId: Map<string, string>
}

const PAGE_SUFFIX = /\s*·\s*hoja\s+\d+\.?(?:\s*·\s*#?\s*\d+)?\s*$/i

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

function pageInfo(asset: AssetItem): { pageLabel: string; albumBase: string; isPage: boolean } {
  const pageLabel = containerLabel(asset)
  const match = pageLabel.match(PAGE_SUFFIX)
  if (!match) return { pageLabel, albumBase: pageLabel, isPage: false }
  return {
    pageLabel,
    albumBase: pageLabel.replace(PAGE_SUFFIX, '').trim() || pageLabel,
    isPage: true,
  }
}

/**
 * Tramo útil de `import_source`: normalmente el último («romanos/Denarios
 * imperio» → «Denarios imperio»). Si repite el nombre del álbum, el primero.
 */
function sourceSuffix(source: string, baseLabel: string): string | undefined {
  const parts = source.split('/').map((part) => part.trim()).filter(Boolean)
  const last = parts[parts.length - 1]
  if (last && normalize(last) !== normalize(baseLabel)) return last
  const first = parts[0]
  if (first && normalize(first) !== normalize(baseLabel)) return first
  return undefined
}

function makeAlbum(
  key: string,
  label: string,
  baseLabel: string,
  disambiguator: string | undefined,
  assets: AssetItem[],
  isPaged: boolean,
): AssetAlbum {
  const pages = isPaged
    ? Array.from(new Set(assets.map((asset) => containerLabel(asset)))).sort((a, b) => a.localeCompare(b, 'es', { numeric: true }))
    : []
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
    pages,
    pageCount: pages.length,
    isPaged,
  }
}

/** Recalcula las cifras de un álbum conservando su identidad (clave y etiqueta). */
export function albumWithAssets(album: AssetAlbum, assets: AssetItem[]): AssetAlbum {
  return makeAlbum(album.key, album.label, album.baseLabel, album.disambiguator, assets, album.isPaged)
}

export function buildAlbumIndex(assets: AssetItem[]): AlbumIndex {
  const simple: AssetItem[] = []
  const paged: AssetItem[] = []
  const pageByAssetId = new Map<string, ReturnType<typeof pageInfo>>()

  assets.forEach((asset) => {
    const info = pageInfo(asset)
    pageByAssetId.set(asset.id, info)
    if (info.isPage) paged.push(asset)
    else simple.push(asset)
  })

  const simpleLabels = new Set(simple.map((asset) => containerLabel(asset)))
  const albums: AssetAlbum[] = []
  const albumKeyByAssetId = new Map<string, string>()
  const pageLabelByAssetId = new Map<string, string>()

  // Contenedores sin hojas: el propio contenedor es el álbum.
  const simpleGroups = new Map<string, AssetItem[]>()
  simple.forEach((asset) => {
    const label = containerLabel(asset)
    const list = simpleGroups.get(label) ?? []
    list.push(asset)
    simpleGroups.set(label, list)
  })
  simpleGroups.forEach((items, label) => {
    const album = makeAlbum(`simple:${label}`, label, label, undefined, items, false)
    albums.push(album)
    items.forEach((asset) => {
      albumKeyByAssetId.set(asset.id, album.key)
      pageLabelByAssetId.set(asset.id, label)
    })
  })

  // Páginas: se agrupan por álbum padre y, si hay colisión, por origen.
  const byBase = new Map<string, AssetItem[]>()
  paged.forEach((asset) => {
    const base = pageByAssetId.get(asset.id)!.albumBase
    const list = byBase.get(base) ?? []
    list.push(asset)
    byBase.set(base, list)
  })

  byBase.forEach((items, baseLabel) => {
    const bySource = new Map<string, AssetItem[]>()
    items.forEach((asset) => {
      const source = (asset.import_source ?? '').trim()
      const list = bySource.get(source) ?? []
      list.push(asset)
      bySource.set(source, list)
    })

    const entries = Array.from(bySource.entries())
    let disambiguators: Array<string | undefined>

    if (entries.length === 1) {
      const [source, list] = entries[0]
      // Si un álbum con hojas comparte nombre con uno simple, se desambigua.
      disambiguators = simpleLabels.has(baseLabel)
        ? [dominantCountry(list) ?? sourceSuffix(source, baseLabel) ?? 'Hojas']
        : [undefined]
    } else {
      const countries = entries.map(([, list]) => dominantCountry(list))
      const countriesAreDistinct = countries.every(Boolean)
        && new Set(countries.map((country) => normalize(country ?? ''))).size === entries.length
      disambiguators = entries.map(([source], index) => (
        (countriesAreDistinct ? countries[index] : undefined)
        ?? sourceSuffix(source, baseLabel)
        ?? countries[index]
        ?? source
        ?? 'Sin origen'
      ))
    }

    entries.forEach(([source, list], index) => {
      const disambiguator = disambiguators[index]
      const label = disambiguator ? `${baseLabel} · ${disambiguator}` : baseLabel
      const album = makeAlbum(`page:${baseLabel}||${source}`, label, baseLabel, disambiguator, list, true)
      albums.push(album)
      list.forEach((asset) => {
        albumKeyByAssetId.set(asset.id, album.key)
        const pageLabel = pageByAssetId.get(asset.id)!.pageLabel
        pageLabelByAssetId.set(asset.id, disambiguator ? `${pageLabel} · ${disambiguator}` : pageLabel)
      })
    })
  })

  // Etiquetas únicas (raro, pero dos orígenes podrían llamarse igual).
  const labelCounts = new Map<string, number>()
  albums.forEach((album) => {
    const normalized = normalize(album.label)
    const count = (labelCounts.get(normalized) ?? 0) + 1
    labelCounts.set(normalized, count)
    if (count > 1) album.label = `${album.label} (${count})`
  })

  albums.sort((a, b) => a.label.localeCompare(b.label, 'es', { numeric: true }))

  const albumLabelByKey = new Map<string, string>()
  albums.forEach((album) => albumLabelByKey.set(album.key, album.label))

  return { albums, albumKeyByAssetId, albumLabelByKey, pageLabelByAssetId }
}
