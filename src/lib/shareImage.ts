import { placesOf, tripTitle } from '../data/catalog'
import { t } from '../i18n'
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
  accent: '#f86a07',
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
        const text = `🍽 ${name ? `${t(mealLabels[item.meal])} · ${name}` : t('{meal} 식사', { meal: t(mealLabels[item.meal]) })}`
        return [{ time: range, text, color: COLORS.meal, bold: false }]
      }
      case 'lodging':
        return [
          {
            time: toHHMM(item.role === 'depart' ? item.start : item.end),
            text: `🏨 ${t(item.role === 'depart' ? '{name} 출발' : '{name} 도착', { name: item.place.name })}`,
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

/** 배경 사진 불러오기 — 저장소 사진도 canvas에서 쓸 수 있게 crossOrigin. 실패하면 null(기본 배경) */
function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

/** 사진을 비율 유지한 채 영역을 꽉 채우게 (넘치는 부분은 잘림) */
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, width: number, height: number) {
  const scale = Math.max(width / img.width, height / img.height)
  const w = img.width * scale
  const h = img.height * scale
  ctx.drawImage(img, (width - w) / 2, (height - h) / 2, w, h)
}

/**
 * 일정 요약 이미지. background(사진 주소)가 있으면 사진을 배경에 깔고,
 * 글자와 일차별 창(카드)은 그대로 위에 얹는다.
 */
export async function renderTripImage(trip: SavedTrip, country: Country | undefined, background?: string): Promise<Blob> {
  const photo = background ? await loadImage(background) : null
  // Pretendard 웹폰트는 화면에 나온 글자 묶음만 받아 오므로, 이미지에 쓸 글자를 굵기별로 미리 받아 둠
  const sample = [
    tripTitle(trip),
    country?.name ?? '',
    ...trip.days.flatMap((day) => rowsOf(day, country).rows.map((row) => row.text)),
    t('{n}일 일정', { n: trip.days.length }),
    t('계획하는 순간, 여행이 시작된다'),
    'PLAN:J 0123456789~·',
  ].join(' ')
  await Promise.all(
    [400, 500, 600, 700, 800].map((weight) => document.fonts?.load(`${weight} 28px Pretendard`, sample).catch(() => [])),
  )
  await document.fonts?.ready

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error(t('canvas를 쓸 수 없습니다.'))

  const textWidth = WIDTH - PAD * 2 - 48 - TIME_WIDTH // 일차 카드 안 장소 이름 칸 폭
  const days = trip.days.map((day) => {
    const { range, rows } = rowsOf(day, country)
    const lines: Line[] = [
      { time: '', text: `${t('{n}일차', { n: day.dayNumber })}   ${range}`, font: font(34, 700), color: COLORS.accent, height: 60 },
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
  if (photo) {
    // 사진 배경 — 흰 글자가 잘 보이게 위·아래를 어둡게
    drawCover(ctx, photo, WIDTH, height)
    const shade = ctx.createLinearGradient(0, 0, 0, height)
    shade.addColorStop(0, 'rgba(0,0,0,0.55)')
    shade.addColorStop(Math.min(0.5, headerHeight / height), 'rgba(0,0,0,0.25)')
    shade.addColorStop(1, 'rgba(0,0,0,0.5)')
    ctx.fillStyle = shade
    ctx.fillRect(0, 0, WIDTH, height)
  } else {
    ctx.fillStyle = COLORS.bg
    ctx.fillRect(0, 0, WIDTH, height)
    ctx.fillStyle = COLORS.accent
    ctx.fillRect(0, 0, WIDTH, headerHeight - 24)
  }
  ctx.textBaseline = 'top'
  if (photo) {
    ctx.shadowColor = 'rgba(0,0,0,0.45)'
    ctx.shadowBlur = 8
  }
  ctx.fillStyle = 'rgba(255,255,255,0.8)'
  ctx.font = font(26, 600)
  ctx.fillText('PLAN:J', PAD, 40)
  ctx.fillStyle = '#ffffff'
  ctx.font = font(52, 800)
  const title = tripTitle(trip)
  ctx.fillText(wrap(ctx, [title], WIDTH - PAD * 2)[0] ?? title, PAD, 78)
  ctx.font = font(28, 500)
  ctx.fillText(`${country?.name ?? trip.countryCode} · ${t('{n}일 일정', { n: trip.days.length })}`, PAD, 146)
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0

  // 일차별 카드
  let y = headerHeight
  for (const day of days) {
    // 사진 배경일 때는 살짝 비치는 흰 창
    ctx.fillStyle = photo ? 'rgba(255,255,255,0.92)' : COLORS.panel
    ctx.strokeStyle = photo ? 'rgba(255,255,255,0.7)' : COLORS.border
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

  ctx.fillStyle = photo ? 'rgba(255,255,255,0.9)' : COLORS.muted
  ctx.font = font(22)
  ctx.fillText(`PLAN:J · ${t('계획하는 순간, 여행이 시작된다')}`, PAD, height - footerHeight + 24)

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error(t('이미지를 만들지 못했습니다.')))), 'image/png'),
  )
}
