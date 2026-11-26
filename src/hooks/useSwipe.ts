import { useRef, useState, type CSSProperties, type DragEvent, type PointerEvent } from 'react'

/** 이만큼 옆으로 끌어야 넘김 (px) */
const SWIPE_PX = 50
/** 넘어가는 시간 (ms) */
const SLIDE_MS = 300
const EASE = 'cubic-bezier(0.22, 0.61, 0.36, 1)'

/**
 * 가로로 이어 붙인 칸(사진·페이지)을 끌어서(마우스) 또는 밀어서(손가락) 넘기기.
 * - handlers: 보이는 창(swipe-area)에, trackStyle: 칸들을 가로로 늘어놓은 줄(swipe-track)에
 * - 끄는 동안 옆 칸이 바로 이어서 따라오고, 놓거나 버튼·점으로 index를 바꾸면 그 칸까지 부드럽게 미끄러짐
 * - 처음·마지막 칸 바깥으로는 고무줄처럼 조금만 끌림
 */
export function useSwipe(index: number, count: number, go: (next: number) => void) {
  const start = useRef<{ x: number; y: number; id: number } | null>(null)
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const inRange = (next: number) => next >= 0 && next < count

  function finish(e: PointerEvent) {
    const s = start.current
    start.current = null
    setDragging(false)
    setDragX(0)
    if (!s || s.id !== e.pointerId) return
    const dx = e.clientX - s.x
    const dy = e.clientY - s.y
    const next = index + (dx < 0 ? 1 : -1)
    // 위아래로 굴렸거나 덜 끌었거나 더 갈 곳이 없으면 제자리로 (트랙이 알아서 미끄러져 돌아감)
    if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(dy) * 1.5 || !inRange(next)) return
    // 끌기를 마친 뒤 따라오는 클릭(카드 버튼·사진 링크)은 무시
    const suppress = (ev: MouseEvent) => {
      ev.stopPropagation()
      ev.preventDefault()
    }
    window.addEventListener('click', suppress, { capture: true, once: true })
    setTimeout(() => window.removeEventListener('click', suppress, true), 0)
    go(next)
  }

  const handlers = {
    onPointerDown: (e: PointerEvent) => {
      if (e.button !== 0) return
      start.current = { x: e.clientX, y: e.clientY, id: e.pointerId }
    },
    onPointerMove: (e: PointerEvent) => {
      const s = start.current
      if (!s || s.id !== e.pointerId) return
      const dx = e.clientX - s.x
      // 옆으로 움직일 때만 따라 움직임 (위아래 스크롤 중에는 그대로)
      if (Math.abs(dx) <= Math.abs(e.clientY - s.y)) return
      setDragging(true)
      setDragX(inRange(index + (dx < 0 ? 1 : -1)) ? dx : dx * 0.25)
    },
    onPointerUp: finish,
    // 마우스가 영역 밖으로 나가면 거기서 놓은 것으로
    onPointerLeave: finish,
    onPointerCancel: () => {
      start.current = null
      setDragging(false)
      setDragX(0)
    },
    // 사진을 끌 때 브라우저가 이미지를 통째로 끌어가지 않게
    onDragStart: (e: DragEvent) => e.preventDefault(),
  }
  const trackStyle: CSSProperties = {
    transform: `translateX(calc(${-index * 100}% + ${dragX}px))`,
    transition: dragging ? 'none' : `transform ${SLIDE_MS}ms ${EASE}`,
  }
  return { handlers, trackStyle }
}
