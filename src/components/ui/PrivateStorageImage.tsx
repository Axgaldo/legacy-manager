import { useEffect, useRef, useState, type ImgHTMLAttributes } from 'react'
import { getPrivateStorageBlob, isStoragePath } from '@/lib/storageFiles'

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & { source: string }

/** Renders legacy data URLs directly and Storage paths through authenticated SDK reads. */
export default function PrivateStorageImage({ source, ...imageProps }: Props) {
  const [resolvedSource, setResolvedSource] = useState('')
  const [inView, setInView] = useState(false)
  const imageRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isStoragePath(source)) {
      setResolvedSource(source)
      setInView(true)
      return
    }
    setResolvedSource('')
    setInView(false)
    const node = imageRef.current
    if (!node || !('IntersectionObserver' in window)) { setInView(true); return }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) { setInView(true); observer.disconnect() }
    }, { rootMargin: '200px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [source])

  useEffect(() => {
    if (!isStoragePath(source) || !inView) return
    let active = true
    let objectUrl = ''
    getPrivateStorageBlob(source).then((blob) => {
      if (!active) return
      objectUrl = URL.createObjectURL(blob)
      setResolvedSource(objectUrl)
    }).catch(() => { if (active) setResolvedSource('') })
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [inView, source])

  const { className, alt, ...otherImageProps } = imageProps
  return resolvedSource
    ? <img {...otherImageProps} src={resolvedSource} alt={alt} className={className} />
    : <div ref={imageRef} className={`${className || ''} flex items-center justify-center bg-slate-900 text-slate-600`} aria-label={alt || 'Cargando imagen'}>▧</div>
}
