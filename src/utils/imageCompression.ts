/**
 * Compresses an image file (JPEG, PNG, etc.) to WebP format directly in the browser
 * using HTML5 Canvas, reducing dimensions and file size before cloud upload.
 */
export interface CompressionResult {
  base64: string
  originalSizeKB: number
  compressedSizeKB: number
  width: number
  height: number
}

export async function compressImageToWebP(
  file: File,
  maxDimension = 1280,
  quality = 0.8,
): Promise<CompressionResult> {
  const originalSizeKB = Math.round(file.size / 1024)

  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (readerEvent) => {
      const img = new Image()

      img.onload = () => {
        let width = img.width
        let height = img.height

        // Calculate proportional scale if larger than maxDimension
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width)
            width = maxDimension
          } else {
            width = Math.round((width * maxDimension) / height)
            height = maxDimension
          }
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('No se pudo inicializar el contexto de imagen 2D.'))
          return
        }

        // Draw image onto canvas
        ctx.drawImage(img, 0, 0, width, height)

        // Convert to WebP format
        let webpDataUrl = canvas.toDataURL('image/webp', quality)

        // If browser does not support webp export, canvas falls back to png
        if (!webpDataUrl.startsWith('data:image/webp')) {
          webpDataUrl = canvas.toDataURL('image/jpeg', quality)
        }

        // Approximate size of base64 in KB
        const base64Length = webpDataUrl.length - (webpDataUrl.indexOf(',') + 1)
        const compressedSizeKB = Math.round((base64Length * 3) / 4 / 1024)

        resolve({
          base64: webpDataUrl,
          originalSizeKB,
          compressedSizeKB,
          width,
          height,
        })
      }

      img.onerror = () => {
        reject(new Error('El archivo seleccionado no es una imagen válida.'))
      }

      if (typeof readerEvent.target?.result === 'string') {
        img.src = readerEvent.target.result
      } else {
        reject(new Error('Error al leer el archivo de imagen.'))
      }
    }

    reader.onerror = () => reject(new Error('Error al cargar la imagen.'))
    reader.readAsDataURL(file)
  })
}
