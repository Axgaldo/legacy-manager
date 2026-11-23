import { describe, expect, it } from 'vitest'
import type { AssetItem } from '@/types'
import { albumWithAssets, buildAlbumIndex } from './containers'

function coin(overrides: Partial<AssetItem> = {}): AssetItem {
  return {
    id: 'a1',
    name: 'Denario',
    owner: 'Gabriel',
    category: 'numismatica',
    numismatica_type: 'moneda',
    case_location: 'Álbum 1 · Hoja 1',
    photos: [],
    ...overrides,
  }
}

describe('buildAlbumIndex', () => {
  it('agrupa todas las hojas de un mismo álbum y separa los homónimos por país', () => {
    const index = buildAlbumIndex([
      coin({ id: 'rep1', case_location: 'Álbum 1 · Hoja 1', country: 'República Romana', import_source: 'romanos/Denarios república' }),
      coin({ id: 'rep2', case_location: 'Álbum 1 · Hoja 2', country: 'República Romana', import_source: 'romanos/Denarios república' }),
      coin({ id: 'imp1', case_location: 'Álbum 1 · Hoja 1', country: 'Imperio Romano', import_source: 'romanos/Denarios imperio' }),
      coin({ id: 'imp2', case_location: 'Álbum 1 · Hoja 2', country: 'Imperio Romano', import_source: 'romanos/Denarios imperio' }),
    ])

    expect(index.albums.map((album) => album.label)).toEqual([
      'Álbum 1 · Imperio Romano',
      'Álbum 1 · República Romana',
    ])
    expect(index.albums[0].pages).toEqual(['Álbum 1 · Hoja 1', 'Álbum 1 · Hoja 2'])
    expect(index.albums[0].count).toBe(2)
    expect(index.albumKeyByAssetId.get('rep1')).not.toBe(index.albumKeyByAssetId.get('imp1'))
    expect(index.pageLabelByAssetId.get('rep1')).toBe('Álbum 1 · Hoja 1 · República Romana')
    expect(index.pageLabelByAssetId.get('imp2')).toBe('Álbum 1 · Hoja 2 · Imperio Romano')
  })

  it('distingue un álbum moderno sin hojas de un álbum romano con el mismo nombre', () => {
    const index = buildAlbumIndex([
      coin({ id: 'modern', case_location: 'Álbum 1', country: 'España', import_source: 'plata/Álbum 1' }),
      coin({ id: 'imp', case_location: 'Álbum 1 · Hoja 1', country: 'Imperio Romano', import_source: 'romanos/Denarios imperio' }),
    ])

    expect(index.albums.map((album) => album.label)).toEqual([
      'Álbum 1',
      'Álbum 1 · Imperio Romano',
    ])
    expect(index.albums.find((album) => album.label === 'Álbum 1')?.pages).toEqual([])
    expect(index.albums.find((album) => album.label === 'Álbum 1 · Imperio Romano')?.pageCount).toBe(1)
  })

  it('no parte un álbum con nombre propio aunque llegue en varios orígenes', () => {
    const index = buildAlbumIndex([
      coin({ id: 'uk', case_location: 'Varios países', country: 'Reino Unido', import_source: 'varios/Reino Unido' }),
      coin({ id: 'ch', case_location: 'Varios países', country: 'Suiza', import_source: 'varios/Suiza' }),
      coin({ id: 'es', case_location: 'Varios países', country: 'España', import_source: 'varios/España' }),
    ])
    expect(index.albums).toHaveLength(1)
    expect(index.albums[0].label).toBe('Varios países')
    expect(index.albums[0].count).toBe(3)
    expect(index.albums[0].pageCount).toBe(0)
  })

  it('recalcula las cifras conservando la identidad al filtrar', () => {
    const index = buildAlbumIndex([
      coin({ id: 'a', case_location: 'Álbum 1 · Hoja 1', country: 'Imperio Romano', import_source: 'romanos/Imperio', value: 100 }),
      coin({ id: 'b', case_location: 'Álbum 1 · Hoja 2', country: 'Imperio Romano', import_source: 'romanos/Imperio', value: 200 }),
    ])
    const album = index.albums[0]
    const filtered = albumWithAssets(album, [album.assets[0]])
    expect(filtered.key).toBe(album.key)
    expect(filtered.label).toBe(album.label)
    expect(filtered.count).toBe(1)
    expect(filtered.value).toBe(100)
    expect(filtered.pageCount).toBe(1)
  })
})
