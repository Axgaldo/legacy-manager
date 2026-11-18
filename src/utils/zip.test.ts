import { describe, expect, it } from 'vitest'
import { createZipBlob, safeZipName, uniqueZipName } from './zip'

const encoder = new TextEncoder()

async function readZip(files: Array<{ name: string; data: string }>) {
  const blob = createZipBlob(files.map((file) => ({ name: file.name, data: encoder.encode(file.data) })))
  const buffer = await blob.arrayBuffer()
  return { blob, view: new DataView(buffer), bytes: new Uint8Array(buffer) }
}

describe('createZipBlob', () => {
  it('empieza con la cabecera local de un ZIP', async () => {
    const { view } = await readZip([{ name: 'hola.txt', data: 'hello' }])
    expect(view.getUint32(0, true)).toBe(0x04034B50)
  })

  it('guarda el CRC32 correcto de cada archivo', async () => {
    const { view } = await readZip([{ name: 'hola.txt', data: 'hello' }])
    // CRC32 conocido de "hello".
    expect(view.getUint32(14, true)).toBe(0x3610A686)
  })

  it('termina con el registro de fin de directorio y el número de archivos', async () => {
    const { view, bytes } = await readZip([
      { name: 'a.txt', data: 'uno' },
      { name: 'b.txt', data: 'dos' },
    ])
    const eocd = bytes.length - 22
    expect(view.getUint32(eocd, true)).toBe(0x06054B50)
    expect(view.getUint16(eocd + 8, true)).toBe(2)
    expect(view.getUint16(eocd + 10, true)).toBe(2)
  })

  it('guarda los datos sin comprimir tal cual', async () => {
    const { bytes } = await readZip([{ name: 'nota.txt', data: 'contenido literal' }])
    expect(new TextDecoder().decode(bytes)).toContain('contenido literal')
  })
})

describe('safeZipName', () => {
  it('sustituye caracteres no válidos pero conserva las carpetas', () => {
    expect(safeZipName('factura:2026/junio?.pdf')).toBe('factura_2026/junio_.pdf')
  })

  it('bloquea rutas que intentan salir de la carpeta del ZIP', () => {
    expect(safeZipName('../../evil.txt')).toBe('evil.txt')
    expect(safeZipName('/etc/passwd')).toBe('etc/passwd')
  })

  it('evita nombres vacíos', () => {
    expect(safeZipName('   ')).toBe('archivo')
  })
})

describe('uniqueZipName', () => {
  it('añade un sufijo cuando el nombre ya existe', () => {
    const used = new Set<string>()
    expect(uniqueZipName('contrato.pdf', used)).toBe('contrato.pdf')
    expect(uniqueZipName('contrato.pdf', used)).toBe('contrato (2).pdf')
    expect(uniqueZipName('contrato.pdf', used)).toBe('contrato (3).pdf')
  })

  it('respeta las carpetas al añadir el sufijo', () => {
    const used = new Set<string>(['Contratos/contrato.pdf'])
    expect(uniqueZipName('Contratos/contrato.pdf', used)).toBe('Contratos/contrato (2).pdf')
    expect(uniqueZipName('Inquilinos/Ana.d/dni', used)).toBe('Inquilinos/Ana.d/dni')
  })
})
