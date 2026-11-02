// 일차별 색 — 지도 번호 마커·시간표 번호·마이페이지 일차 탭에 같이 쓴다.
// 1일차는 시그니처 주황, 그 뒤로는 주황 계열과 겹치지 않는 색. 7일을 넘으면 처음 색부터 다시.
const DAY_COLORS = ['#f86a07', '#2563eb', '#16a34a', '#c026d3', '#0d9488', '#4338ca', '#a16207']

export function dayColor(dayNumber: number): string {
  return DAY_COLORS[(Math.max(1, dayNumber) - 1) % DAY_COLORS.length]
}
