import { useEffect, useRef } from 'react'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

/**
 * Pila de diálogos abiertos: si se abre un ConfirmModal sobre una ficha, solo
 * el último captura el tabulador. Sin esto, dos traps activos se pelearían por
 * el foco.
 */
const trapStack: symbol[] = []

/**
 * Encierra el foco del teclado dentro de un diálogo mientras está abierto y lo
 * devuelve al elemento que lo abrió al cerrarse. `onEscape` es opcional: los
 * componentes que ya gestionan `Escape` no deben pasarlo para no cerrar dos veces.
 */
export function useFocusTrap<T extends HTMLElement = HTMLDivElement>(active: boolean, onEscape?: () => void) {
  const containerRef = useRef<T | null>(null)
  const escapeRef = useRef(onEscape)
  escapeRef.current = onEscape

  useEffect(() => {
    if (!active) return
    const node = containerRef.current
    if (!node) return

    const token = Symbol('focus-trap')
    trapStack.push(token)
    const isTopTrap = () => trapStack[trapStack.length - 1] === token

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const focusables = () => Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE))
      .filter((element) => element.getClientRects().length > 0)

    // Respeta el `autoFocus` interno (por ejemplo, el campo de confirmación).
    if (!node.contains(document.activeElement)) {
      const first = node.querySelector<HTMLElement>('[autofocus]') ?? focusables()[0]
      ;(first ?? node).focus()
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (!isTopTrap()) return
      if (event.key === 'Escape' && escapeRef.current) {
        event.stopPropagation()
        escapeRef.current()
        return
      }
      if (event.key !== 'Tab') return

      const items = focusables()
      if (!items.length) {
        event.preventDefault()
        node.focus()
        return
      }

      const first = items[0]
      const last = items[items.length - 1]
      const current = document.activeElement as HTMLElement | null
      const outside = !current || !node.contains(current)

      if (current === node) {
        event.preventDefault()
        ;(event.shiftKey ? last : first).focus()
        return
      }
      if (event.shiftKey && (current === first || outside)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (current === last || outside)) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      const index = trapStack.indexOf(token)
      if (index >= 0) trapStack.splice(index, 1)
      previouslyFocused?.focus?.()
    }
  }, [active])

  return containerRef
}
