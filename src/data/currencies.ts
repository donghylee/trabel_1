import type { Currency } from '../types'

// 나라별 돈 단위와, 실제 요금을 못 받을 때 쓰는 대략적인 요금표.
// 요금은 2025~2026년 기준 대략값이라 화면에 "(추정)"으로 표시된다.

type CurrencyInfo = {
  /** 금액 표시: 앞에 붙는 기호 또는 뒤에 붙는 단위 */
  prefix?: string
  suffix?: string
  /** 소수점 자리 (싱가포르 달러·링깃처럼 작은 단위) */
  decimals: number
  /** 이동수단 추천 점수 계산용 원화 환산 (대략) */
  toKRW: number
  /** 지하철·버스 1회 대략 요금 */
  transitFare: number
  /** 택시: 기본요금(기본거리까지) + 일정 거리마다 추가 */
  taxi: { base: number; baseMeters: number; stepMeters: number; stepFare: number }
}

export const currencies: Record<Currency, CurrencyInfo> = {
  KRW: { suffix: '원', decimals: 0, toKRW: 1, transitFare: 1500, taxi: { base: 4800, baseMeters: 1600, stepMeters: 131, stepFare: 100 } },
  JPY: { prefix: '¥', decimals: 0, toKRW: 9, transitFare: 210, taxi: { base: 500, baseMeters: 1096, stepMeters: 255, stepFare: 100 } },
  VND: { prefix: '₫', decimals: 0, toKRW: 0.055, transitFare: 10000, taxi: { base: 12000, baseMeters: 500, stepMeters: 1000, stepFare: 16000 } },
  TWD: { prefix: 'NT$', decimals: 0, toKRW: 43, transitFare: 25, taxi: { base: 85, baseMeters: 1250, stepMeters: 200, stepFare: 5 } },
  THB: { prefix: '฿', decimals: 0, toKRW: 40, transitFare: 40, taxi: { base: 35, baseMeters: 1000, stepMeters: 1000, stepFare: 7 } },
  IDR: { prefix: 'Rp', decimals: 0, toKRW: 0.085, transitFare: 5000, taxi: { base: 7500, baseMeters: 0, stepMeters: 1000, stepFare: 6500 } },
  PHP: { prefix: '₱', decimals: 0, toKRW: 24, transitFare: 20, taxi: { base: 40, baseMeters: 500, stepMeters: 1000, stepFare: 14 } },
  SGD: { prefix: 'S$', decimals: 1, toKRW: 1050, transitFare: 1.5, taxi: { base: 4.4, baseMeters: 1000, stepMeters: 400, stepFare: 0.26 } },
  HKD: { prefix: 'HK$', decimals: 0, toKRW: 175, transitFare: 10, taxi: { base: 29, baseMeters: 2000, stepMeters: 200, stepFare: 2.1 } },
  MYR: { prefix: 'RM', decimals: 1, toKRW: 310, transitFare: 2.5, taxi: { base: 3, baseMeters: 0, stepMeters: 1000, stepFare: 1.25 } },
}

export function formatMoney(amount: number, currency: Currency): string {
  const info = currencies[currency]
  const text = amount.toLocaleString('ko-KR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: info.decimals,
  })
  return `${info.prefix ?? ''}${text}${info.suffix ?? ''}`
}
