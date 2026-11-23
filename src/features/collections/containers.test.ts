import { describe, expect, it } from 'vitest'
import type { AssetItem } from '@/types'
import { buildContainerIndex } from './containers'

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

describe('buildContainerIndex', () => {
  it('separa dos álbumes con el mismo nombre usando el país dominante', () => {
    const index = buildContainerIndex([
      coin({ id: 'rep1', country: 'República Romana', import_source: 'romanos/Denarios república', year: -187 }),
      coin({ id: 'rep2', country: 'República Romana', import_source: 'romanos/Denarios república', year: -145 }),
      coin({ id: 'imp1', country: 'Imperio Romano', import_source: 'romanos/Denarios imperio', year: 14 }),
    ])

    expect(index.containers).toHaveLength(2)
    const labels = index.containers.map((container) => container.label)
    expect(labels).toEqual([
      'Álbum 1 · Hoja 1 · Imperio Romano',
      'Álbum 1 · Hoja 1 · República Romana',
    ])
    expect(index.keyByAssetId.get('rep1')).not.toBe(index.keyByAssetId.get('imp1'))
  })

  it('mantiene un solo álbum si solo hay un origen', () => {
    const index = buildContainerIndex([
      coin({ id: 'a', case_location: 'Álbum 2', import_source: 'plata/Álbum 2' }),
      coin({ id: 'b', case_location: 'Álbum 2', import_source: 'plata/Álbum 2' }),
    ])
    expect(index.containers).toHaveLength(1)
    expect(index.containers[0].label).toBe('Álbum 2')
    expect(index.containers[0].count).toBe(2)
  })

  it('no parte un álbum con nombre propio aunque llegue en varios orígenes', () => {
    const index = buildContainerIndex([
      coin({ id: 'uk', case_location: 'Varios países', country: 'Reino Unido', import_source: 'varios/Reino Unido' }),
      coin({ id: 'ch', case_location: 'Varios países', country: 'Suiza', import_source: 'varios/Suiza' }),
      coin({ id: 'es', case_location: 'Varios países', country: 'España', import_source: 'varios/España' }),
    ])
    expect(index.containers).toHaveLength(1)
    expect(index.containers[0].label).toBe('Varios países')
    expect(index.containers[0].count).toBe(3)
  })

  it('usa el origen si los países dominantes coinciden', () => {
    const index = buildContainerIndex([
      coin({ id: 'a', country: 'España', import_source: 'lote/Álbum 1 · Hoja 1' }),
      coin({ id: 'b', country: 'España', import_source: 'otro/Álbum 1 · Hoja 1' }),
    ])
    expect(index.containers.map((container) => container.label)).toEqual([
      'Álbum 1 · Hoja 1 · lote',
      'Álbum 1 · Hoja 1 · otro',
    ])
  })

  it('agrupa por ubicación de medallas y calcula recuentos', () => {
    const index = buildContainerIndex([
      coin({ id: 'm1', numismatica_type: 'medalla', medal_location: 'Cajón 2', case_location: undefined }),
      coin({ id: 'm2', numismatica_type: 'medalla', medal_location: 'Cajón 2', case_location: undefined }),
      coin({ id: 'c1', medal_location: undefined }),
    ])
    const medals = index.containers.find((container) => container.label === 'Cajón 2')
    expect(medals?.medals).toBe(2)
    expect(medals?.coins).toBe(0)
  })
})
