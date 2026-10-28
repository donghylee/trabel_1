// 앱 전체에서 쓰는 데이터 타입

export type LatLng = { lat: number; lng: number }

export type PlaceCategory = 'sight' | 'museum' | 'shopping' | 'nature' | 'food' | 'cafe' | 'lodging'

/** 지역 안의 방문 가능한 장소 */
export type Place = {
  id: string
  name: string
  category: PlaceCategory
  location: LatLng
  /** 검색으로 찾은 장소의 주소 */
  address?: string
  /** 보통 머무르는 시간(분) — 선택 시 기본값으로 사용 */
  defaultStayMinutes: number
}

export type Region = {
  id: string
  name: string
  center: LatLng
  places: Place[]
}

export type Currency = 'KRW' | 'JPY' | 'VND' | 'TWD' | 'THB' | 'IDR' | 'PHP' | 'SGD' | 'HKD' | 'MYR'

export type Country = {
  code: string
  /** 현지 시간 (UTC 기준 몇 시간 차이) — 대중교통 출발 시각 계산용 */
  utcOffsetHours: number
  name: string
  flag: string
  currency: Currency
  /** 지도 첫 화면 위치 */
  center: LatLng
  /** 장소 검색 범위 [서경, 남위, 동경, 북위] */
  bounds: [number, number, number, number]
  /** 추천 장소를 도시별로 묶어 둔 목록 */
  regions: Region[]
}

/** 사용자가 고른 장소와 머무를 시간 */
export type PlaceSelection = {
  placeId: string
  stayMinutes: number
}

/** 입력 단계에서 모으는 여행 조건 */
export type TripInput = {
  countryCode: string | null
  selections: PlaceSelection[]
  /** 검색이나 주변 추천으로 추가한 장소 (기본 추천 목록에 없는 곳) */
  customPlaces: Place[]
  /** 숙소 (없으면 첫 방문지에서 시작해 마지막 방문지에서 끝남) */
  lodging: Place | null
  /** 숙소에서 출발 */
  startFromLodging: boolean
  /** 마지막에 숙소로 돌아오기 */
  returnToLodging: boolean
  /** "HH:MM" */
  startTime: string
  endTime: string
}

export type TravelMode = 'walk' | 'transit' | 'taxi'

/** 한 구간(A→B)에서 이동수단 하나로 이동했을 때의 결과 */
export type TravelOption = {
  mode: TravelMode
  minutes: number
  meters: number
  fare?: number
  transfers?: number
  /** 경로 API 없이 거리로 계산한 값이면 true */
  estimated?: boolean
  /** 요금만 거리로 계산한 값이면 true (시간은 실제) */
  fareEstimated?: boolean
  /** 실제 경로 모양 (없으면 지도에 직선) */
  path?: LatLng[]
  /** 어디서 받은 값인지 (예: "TMAP", "ODsay", "Google") */
  source?: string
}

/** 두 방문지 사이의 구간 */
export type Leg = {
  from: Place
  to: Place
  options: TravelOption[]
  recommended: TravelMode
}

export type MealKind = 'lunch' | 'dinner'

/** 시간표의 한 줄. start/end는 자정부터 지난 분 */
export type ScheduleItem =
  | { kind: 'visit'; place: Place; order: number; start: number; end: number }
  | { kind: 'move'; leg: Leg; start: number; end: number }
  | {
      kind: 'meal'
      meal: MealKind
      near: Place
      start: number
      end: number
      /** 방문을 몇 곳 마친 뒤의 식사인지 (2 = 2번 다음) */
      slot: number
      /** 음식점을 골랐으면 경로에 들어가는 지점 */
      restaurant?: Place
    }
  | { kind: 'lodging'; place: Place; role: 'depart' | 'arrive'; start: number; end: number }

export type Schedule = {
  items: ScheduleItem[]
  /** 방문 순서 (placeId) */
  order: string[]
  startAt: number
  /** 마지막 일정이 끝나는 시각 */
  endAt: number
  /** 사용자가 정한 종료 시각 */
  limitAt: number
  overMinutes: number
  totalMoveMinutes: number
  totalWalkMeters: number
}

/** 시간이 초과됐을 때 제안하는 조정안 */
export type Adjustment =
  | { kind: 'reduceStay'; placeId: string; stayMinutes: number }
  | { kind: 'remove'; placeId: string }
  | { kind: 'extendEnd'; endTime: string }

export type NearbyKind = 'restaurant' | 'cafe' | 'attraction'

/** 주변 장소 검색 결과 (Google Places Nearby Search 결과에 대응) */
export type NearbyPlace = {
  id: string
  name: string
  kind: NearbyKind
  location: LatLng
  rating: number
  reviewCount: number
}

/** 순위가 매겨진 주변 추천 */
export type Recommendation = {
  poi: NearbyPlace
  /** 가장 가까운 방문지 */
  anchor: Place
  meters: number
  walkMinutes: number
  adjustedRating: number
  score: number
}

/** 식사 시간에 고른 음식점 */
export type MealChoices = Partial<Record<MealKind, NearbyPlace>>

/** 고른 음식점을 사용자가 끌어서 옮긴 자리 (몇 번 장소 다음인지, 0 = 첫 장소 전) */
export type MealSlots = Partial<Record<MealKind, number>>

/** 저장한 하루 일정 — 입력 조건을 저장해 두고 볼 때 다시 계산 */
export type SavedDay = {
  dayNumber: number
  savedAt: string
  input: TripInput
  customOrder: string[] | null
  mealChoices: MealChoices
  /** 예전에 저장한 일정에는 없을 수 있음 */
  mealSlots?: MealSlots
  /** 목록에서 바로 보여줄 요약 */
  summary: { startTime: string; endTime: string; placeNames: string[]; lodgingName: string | null }
}

/** 여러 날 일정을 묶은 여행 */
export type SavedTrip = {
  id: string
  name: string
  countryCode: string
  createdAt: string
  updatedAt: string
  /** dayNumber 오름차순 */
  days: SavedDay[]
}
