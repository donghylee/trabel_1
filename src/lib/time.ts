import { t } from '../i18n'

/** 머무를 시간 선택지: 30분 ~ 12시간, 30분 단위 */
export const STAY_OPTIONS = Array.from({ length: 24 }, (_, i) => (i + 1) * 30)

/** "09:30" → 570 */
export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** 570 → "09:30" */
export function toHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** 90 → "1시간 30분" (영어: "1h 30m") */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return t('{m}분', { m })
  if (m === 0) return t('{h}시간', { h })
  return t('{h}시간 {m}분', { h, m })
}
