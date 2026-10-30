import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react'

// 목록 항목을 꾹 눌러 끌어서 순서를 바꾸는 기능.
// 마우스는 누른 채 조금 움직이면 바로, 손가락(터치)은 꾹 누르고 있으면(LONG_PRESS_MS) 끌기가 시작된다.
// 터치에서 꾹 누르기 전에 움직이면 화면 스크롤로 본다.

const MOUSE_START_PX = 5
const TOUCH_CANCEL_PX = 8
const LONG_PRESS_MS = 350
/** 끄는 중 스크롤 영역 끝에 이만큼 가까워지면 자동으로 스크롤 */
const AUTO_SCROLL_EDGE = 60
const AUTO_SCROLL_STEP = 12

export type DragState = {
  id: string
  /** 끌고 있는 항목을 뺀 목록에서 놓일 위치 */
  overIndex: number
  /** 손가락·마우스 위치 (화면 기준) */
  x: number
  y: number
}

type Pending = {
  id: string
  pointerId: number
  pointerType: string
  startX: number
  startY: number
  timer: number | null
}

export function useDragReorder(ids: string[], onReorder: (order: string[]) => void) {
  const [drag, setDrag] = useState<DragState | null>(null)
  const rowRefs = useRef(new Map<string, HTMLElement>())
  const pending = useRef<Pending | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const latest = useRef({ ids, onReorder })
  latest.current = { ids, onReorder }

  function setDragState(next: DragState | null) {
    dragRef.current = next
    setDrag(next)
  }

  /** 포인터 y 위치가 (끄는 항목을 뺀) 목록의 몇 번째 자리인지 */
  function indexAt(draggedId: string, y: number): number {
    const others = latest.current.ids.filter((id) => id !== draggedId)
    let index = 0
    for (const id of others) {
      const el = rowRefs.current.get(id)
      if (!el) continue
      const rect = el.getBoundingClientRect()
      if (y > rect.top + rect.height / 2) index++
    }
    return index
  }

  function scrollContainerOf(el: HTMLElement | undefined): HTMLElement | null {
    let node = el?.parentElement ?? null
    while (node) {
      const style = getComputedStyle(node)
      if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight) return node
      node = node.parentElement
    }
    return null
  }

  function autoScroll(draggedId: string, y: number) {
    const container = scrollContainerOf(rowRefs.current.get(draggedId))
    const top = container ? container.getBoundingClientRect().top : 0
    const bottom = container ? container.getBoundingClientRect().bottom : window.innerHeight
    const step = y < top + AUTO_SCROLL_EDGE ? -AUTO_SCROLL_STEP : y > bottom - AUTO_SCROLL_EDGE ? AUTO_SCROLL_STEP : 0
    if (step === 0) return
    if (container) container.scrollTop += step
    else window.scrollBy(0, step)
  }

  function start(id: string, x: number, y: number) {
    setDragState({ id, overIndex: indexAt(id, y), x, y })
    navigator.vibrate?.(20)
  }

  function cancelPending() {
    if (pending.current?.timer) window.clearTimeout(pending.current.timer)
    pending.current = null
  }

  useEffect(() => {
    function onMove(e: PointerEvent) {
      const p = pending.current
      const d = dragRef.current
      if (d && p && e.pointerId === p.pointerId) {
        autoScroll(d.id, e.clientY)
        setDragState({ ...d, x: e.clientX, y: e.clientY, overIndex: indexAt(d.id, e.clientY) })
        return
      }
      if (!p || e.pointerId !== p.pointerId) return
      const moved = Math.hypot(e.clientX - p.startX, e.clientY - p.startY)
      if (p.pointerType === 'mouse') {
        if (moved > MOUSE_START_PX) start(p.id, e.clientX, e.clientY)
      } else if (moved > TOUCH_CANCEL_PX) {
        // 꾹 누르기 전에 움직였으면 스크롤하려는 것
        cancelPending()
      }
    }

    function onUp(e: PointerEvent) {
      const p = pending.current
      if (!p || e.pointerId !== p.pointerId) return
      const d = dragRef.current
      cancelPending()
      if (!d) return
      setDragState(null)
      // 끌기를 마친 직후 따라오는 클릭(이름 버튼 등)은 무시
      const suppress = (ev: MouseEvent) => ev.stopPropagation()
      window.addEventListener('click', suppress, { capture: true, once: true })
      setTimeout(() => window.removeEventListener('click', suppress, true), 0)
      const others = latest.current.ids.filter((id) => id !== d.id)
      const next = [...others.slice(0, d.overIndex), d.id, ...others.slice(d.overIndex)]
      if (next.join() !== latest.current.ids.join()) latest.current.onReorder(next)
    }

    function onCancel(e: PointerEvent) {
      if (pending.current?.pointerId !== e.pointerId) return
      cancelPending()
      setDragState(null)
    }

    // 끄는 중에는 터치 스크롤을 막음 (passive: false여야 막을 수 있음)
    function onTouchMove(e: TouchEvent) {
      if (dragRef.current) e.preventDefault()
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      window.removeEventListener('touchmove', onTouchMove)
      cancelPending()
    }
    // 핸들러는 ref로 최신 값을 읽으므로 한 번만 등록
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** 끌 수 있는 행에 붙일 속성 */
  function rowProps(id: string) {
    return {
      ref: (el: HTMLElement | null) => {
        if (el) rowRefs.current.set(id, el)
        else rowRefs.current.delete(id)
      },
      onPointerDown: (e: ReactPointerEvent) => {
        if (e.button !== 0) return
        // ▲▼ 버튼, 시간 선택 같은 입력칸은 끌기에서 제외
        if ((e.target as HTMLElement).closest('.reorder, select, input, .link-btn, .remove-btn')) return
        cancelPending()
        const p: Pending = {
          id,
          pointerId: e.pointerId,
          pointerType: e.pointerType,
          startX: e.clientX,
          startY: e.clientY,
          timer: null,
        }
        if (e.pointerType !== 'mouse') {
          p.timer = window.setTimeout(() => {
            if (pending.current === p) start(id, p.startX, p.startY)
          }, LONG_PRESS_MS)
        }
        pending.current = p
      },
      // 꾹 누를 때 뜨는 길게 누르기 메뉴·텍스트 선택 막기
      onContextMenu: (e: ReactMouseEvent) => {
        if (pending.current || dragRef.current) e.preventDefault()
      },
    }
  }

  return { drag, rowProps }
}
