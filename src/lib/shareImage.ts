import { placesOf } from '../data/catalog'
import type { Country, SavedDay, SavedTrip } from '../types'
import { buildSchedule, mealLabels } from './schedule'
import { toHHMM } from './time'

// 공유용 일정 요약 이미지를 canvas로 직접 그린다 (화면 캡처 라이브러리 없이).
// 일차마다 시간표(몇 시에 어디)를 간략하게 담는다. 이동 구간은 빼고 머무는 곳만.

const WIDTH = 1080
const PAD = 64
const FONT = "'Pretendard', 'Apple SD Gothic Neo', 'Malgun Gothic', system-ui, sans-serif"
const COLORS = {
  bg: '#f6f7f9',
  panel: '#ffffff',
  text: '#1d2330',
  muted: '#6b7280',
  border: '#e5e7eb',
  accent: '#2563eb',
  meal: '#c2410c',
}

type Line = { time: string; text: string; font: string; color: string; height: number }

type Row = { time: string; text: string; color: string; bold: boolean }

const TIME_WIDTH = 230

/** 저장된 하루 일정을 다시 계산해서 시간표 줄과 하루 시간대로. 계산이 안 되면 요약의 장소 이름만 */
function rowsOf(day: SavedDay, country: Country | undefined): { range: string; rows: Row[] } {
  if (!country) {
    return {
      range: `${day.summary.startTime} ~ ${day.summary.endTime}`,
      rows: day.summary.placeNames.map((name, i) => ({ time: '', text: `${i + 1}. ${name}`, color: COLORS.text, bold: false })),
    }
  }
  const places = [...placesOf(country), ...day.input.customPlaces]
  const schedule = buildSchedule(
    day.input,
    places,
    country.currency,
    day.customOrder ?? undefined,
    day.mealChoices,
    day.mealSlots ?? {},
  )
  const rows = schedule.items.flatMap((item): Row[] => {
    const range = `${toHHMM(item.start)} ~ ${toHHMM(item.end)}`
    switch (item.kind) {
      case 'visit':
        return [{ time: range, text: `${item.order}. ${item.place.name}`, color: COLORS.text, bold: true }]
      case 'meal': {
        const name = item.restaurant?.name ?? day.mealChoices[item.meal]?.name
        const text = `🍽 ${mealLabels[item.meal]}${name ? ` · ${name}` : ' 식사'}`
        return [{ time: range, text, color: COLORS.meal, bold: false }]
      }
      case 'lodging':
        return [
          {
            time: toHHMM(item.role === 'depart' ? item.start : item.end),
            text: `🏨 ${item.place.name} ${item.role === 'depart' ? '출발' : '도착'}`,
            color: COLORS.muted,
            bold: false,
          },
        ]
      default:
        return []
    }
  })
  // 머리 줄 시간대도 아래 시간표와 같은 계산으로 맞춤
  return { range: `${toHHMM(schedule.startAt)} ~ ${toHHMM(schedule.endAt)}`, rows }
}

const font = (size: number, weight = 400) => `${weight} ${size}px ${FONT}`

/** 폭에 맞게 줄바꿈 — "→"로 이어진 장소 이름이 중간에서 끊기지 않게 토막 단위로 */
function wrap(ctx: CanvasRenderingContext2D, parts: string[], maxWidth: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const part of parts) {
    const next = line ? `${line}${part}` : part.trimStart()
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line)
      line = part.trimStart()
    } else {
      line = next
    }
  }
  if (line) lines.push(line)
  return lines
}

export async function renderTripImage(trip: SavedTrip, country: Country | undefined): Promise<Blob> {
  // 웹폰트를 쓰는 경우 글자 모양이 바뀌지 않게 먼저 준비
  await document.fonts?.ready

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas를 쓸 수 없습니다.')

  const textWidth = WIDTH - PAD * 2 - 48 - TIME_WIDTH // 일차 카드 안 장소 이름 칸 폭
  const days = trip.days.map((day) => {
    const { range, rows } = rowsOf(day, country)
    const lines: Line[] = [
      { time: '', text: `${day.dayNumber}일차   ${range}`, font: font(34, 700), color: COLORS.accent, height: 60 },
    ]
    for (const row of rows) {
      const rowFont = font(28, row.bold ? 600 : 400)
      ctx.font = rowFont
      // 긴 이름은 글자 단위로 줄바꿈 (시간은 첫 줄에만)
      wrap(ctx, [...row.text], textWidth).forEach((text, i) =>
        lines.push({ time: i === 0 ? row.time : '', text, font: rowFont, color: row.color, height: 44 }),
      )
    }
    return { lines, height: lines.reduce((sum, l) => sum + l.height, 0) + 48 }
  })

  const headerHeight = 220
  const footerHeight = 90
  const height = headerHeight + days.reduce((sum, d) => sum + d.height + 24, 0) + footerHeight
  canvas.width = WIDTH
  canvas.height = height

  // 배경 + 머리글
  ctx.fillStyle = COLORS.bg
  ctx.fillRect(0, 0, WIDTH, height)
  ctx.fillStyle = COLORS.accent
  ctx.fillRect(0, 0, WIDTH, headerHeight - 24)
  ctx.textBaseline = 'top'
  ctx.fillStyle = 'rgba(255,255,255,0.8)'
  ctx.font = font(26, 600)
  ctx.fillText('여행 동선 플래너', PAD, 40)
  ctx.fillStyle = '#ffffff'
  ctx.font = font(52, 800)
  ctx.fillText(wrap(ctx, [trip.name], WIDTH - PAD * 2)[0] ?? trip.name, PAD, 78)
  ctx.font = font(28, 500)
  ctx.fillText(`${country?.name ?? trip.countryCode} · ${trip.days.length}일 일정`, PAD, 146)

  // 일차별 카드
  let y = headerHeight
  for (const day of days) {
    ctx.fillStyle = COLORS.panel
    ctx.strokeStyle = COLORS.border
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.roundRect(PAD, y, WIDTH - PAD * 2, day.height, 20)
    ctx.fill()
    ctx.stroke()
    let ly = y + 24
    day.lines.forEach((line, i) => {
      const top = ly + (line.height - parseInt(line.font.split(' ')[1])) / 2
      if (line.time) {
        ctx.font = font(26, 600)
        ctx.fillStyle = COLORS.muted
        ctx.fillText(line.time, PAD + 24, top + 2)
      }
      ctx.font = line.font
      ctx.fillStyle = line.color
      // 머리 줄(일차·시간대)은 왼쪽 끝부터, 시간표 줄은 시간 칸 오른쪽부터
      ctx.fillText(line.text, PAD + 24 + (i === 0 ? 0 : TIME_WIDTH), top)
      ly += line.height
    })
    y += day.height + 24
  }

  ctx.fillStyle = COLORS.muted
  ctx.font = font(22)
  ctx.fillText('여행 동선 플래너로 만든 일정', PAD, height - footerHeight + 24)

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('이미지를 만들지 못했습니다.'))), 'image/png'),
  )
}
