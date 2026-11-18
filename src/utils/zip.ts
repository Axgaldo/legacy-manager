/**
 * Generador ZIP mínimo (método «store», sin comprimir) para exportar documentos
 * y fotos desde el navegador sin añadir dependencias. Sirve para los PDFs e
 * imágenes que ya están comprimidos: volver a comprimirlos no aporta nada.
 *
 * Formato: cabecera local + datos por archivo, directorio central y EOCD.
 * Nombres en UTF-8 (flag 0x0800) para que Windows y macOS los lean bien.
 */

export interface ZipFileInput {
  name: string
  data: Uint8Array
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let index = 0; index < 256; index++) {
    let value = index
    for (let bit = 0; bit < 8; bit++) {
      value = value & 1 ? 0xEDB88320 ^ (value >>> 1) : value >>> 1
    }
    table[index] = value >>> 0
  }
  return table
})()

function crc32(data: Uint8Array): number {
  let crc = 0xFFFFFFFF
  for (let index = 0; index < data.length; index++) {
    crc = CRC_TABLE[(crc ^ data[index]) & 0xFF] ^ (crc >>> 8)
  }
  return (crc ^ 0xFFFFFFFF) >>> 0
}

function dosDateTime(date: Date): { time: number; date: number } {
  const time = ((date.getHours() & 0x1F) << 11)
    | ((date.getMinutes() & 0x3F) << 5)
    | (Math.floor(date.getSeconds() / 2) & 0x1F)
  const day = (((date.getFullYear() - 1980) & 0x7F) << 9)
    | (((date.getMonth() + 1) & 0x0F) << 5)
    | (date.getDate() & 0x1F)
  return { time, date: day }
}

function writeHeader(
  size: number,
  fields: Array<[offset: number, value: number, bytes: 2 | 4]>,
  signature: number,
  name: Uint8Array,
): Uint8Array {
  const header = new Uint8Array(size)
  const view = new DataView(header.buffer)
  view.setUint32(0, signature, true)
  for (const [offset, value, bytes] of fields) {
    if (bytes === 2) view.setUint16(offset, value, true)
    else view.setUint32(offset, value >>> 0, true)
  }
  header.set(name, size - name.length)
  return header
}

/**
 * Quita caracteres problemáticos de cada segmento pero conserva las carpetas
 * (`Contratos/contrato.pdf`). Elimina `.` y `..` para que el ZIP no pueda
 * escribir fuera de su carpeta al descomprimirlo.
 */
export function safeZipName(name: string): string {
  const cleaned = name
    .split('/')
    .map((segment) => Array.from(segment)
      .filter((character) => character.charCodeAt(0) >= 32)
      .join('')
      .replace(/[<>:"\\|?*]/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/[. ]+$/g, ''))
    .filter((segment) => segment && segment !== '.' && segment !== '..')
    .join('/')
  return cleaned.slice(0, 180) || 'archivo'
}

/** Evita que dos archivos del ZIP compartan nombre (`informe.pdf`, `informe (2).pdf`…). */
export function uniqueZipName(name: string, used: Set<string>): string {
  if (!used.has(name)) {
    used.add(name)
    return name
  }
  const slash = name.lastIndexOf('/')
  const directory = slash >= 0 ? name.slice(0, slash + 1) : ''
  const file = slash >= 0 ? name.slice(slash + 1) : name
  const dot = file.lastIndexOf('.')
  const base = dot > 0 ? file.slice(0, dot) : file
  const extension = dot > 0 ? file.slice(dot) : ''
  let counter = 2
  let candidate = `${directory}${base} (${counter})${extension}`
  while (used.has(candidate)) {
    counter++
    candidate = `${directory}${base} (${counter})${extension}`
  }
  used.add(candidate)
  return candidate
}

export function createZipBlob(files: ZipFileInput[], modifiedAt = new Date()): Blob {
  const { time, date } = dosDateTime(modifiedAt)
  const encoder = new TextEncoder()
  const parts: BlobPart[] = []
  const central: Uint8Array[] = []
  let offset = 0

  for (const file of files) {
    const name = encoder.encode(safeZipName(file.name))
    const checksum = crc32(file.data)
    const local = writeHeader(30 + name.length, [
      [4, 20, 2],          // versión necesaria
      [6, 0x0800, 2],      // nombres UTF-8
      [8, 0, 2],           // método: store
      [10, time, 2],
      [12, date, 2],
      [14, checksum, 4],
      [18, file.data.length, 4],
      [22, file.data.length, 4],
      [26, name.length, 2],
      [28, 0, 2],          // extra
    ], 0x04034B50, name)

    central.push(writeHeader(46 + name.length, [
      [4, 20, 2],          // versión que lo creó
      [6, 20, 2],          // versión necesaria
      [8, 0x0800, 2],
      [10, 0, 2],
      [12, time, 2],
      [14, date, 2],
      [16, checksum, 4],
      [20, file.data.length, 4],
      [24, file.data.length, 4],
      [28, name.length, 2],
      [30, 0, 2],          // extra
      [32, 0, 2],          // comentario
      [34, 0, 2],          // disco
      [36, 0, 2],          // atributos internos
      [38, 0, 4],          // atributos externos
      [42, offset, 4],     // offset de la cabecera local
    ], 0x02014B50, name))

    parts.push(local, file.data)
    offset += local.length + file.data.length
  }

  const centralSize = central.reduce((total, entry) => total + entry.length, 0)
  const end = writeHeader(22, [
    [4, 0, 2],             // disco
    [6, 0, 2],             // disco del directorio
    [8, files.length, 2],
    [10, files.length, 2],
    [12, centralSize, 4],
    [16, offset, 4],
    [20, 0, 2],
  ], 0x06054B50, new Uint8Array(0))

  return new Blob([...parts, ...central, end], { type: 'application/zip' })
}
