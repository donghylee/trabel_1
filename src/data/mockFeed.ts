import { buildSchedule } from '../lib/schedule'
import { toHHMM } from '../lib/time'
import type { NearbyPlace, Place, SavedDay, SavedTrip } from '../types'
import { findCountry, placesOf } from './catalog'

// 커뮤니티 화면을 서버 없이 먼저 보기 위한 가짜 게시물.
// 서버(Supabase)를 붙이면 이 파일 대신 서버에서 게시물을 받아 온다.

export type FeedAuthor = { nickname: string; icon: string }
/** authorId: 직접 단 댓글만 있음 (내 댓글에 삭제 메뉴를 보여 줄 때 사용) */
export type FeedComment = { id: string; authorId?: string; author: FeedAuthor; text: string; postedAt: string }
export type FeedPost = {
  id: string
  author: FeedAuthor
  trip: SavedTrip
  caption: string
  tags: string[]
  /** 글쓴이가 함께 올린 사진 (data URL 또는 주소) */
  photos?: string[]
  likeCount: number
  comments: FeedComment[]
  postedAt: string
}

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString()

function lodging(name: string, lat: number, lng: number): Place {
  return { id: `lodging-${name}`, name, category: 'sight', location: { lat, lng }, defaultStayMinutes: 0 }
}

function restaurant(name: string, lat: number, lng: number): NearbyPlace {
  return { id: `r-${name}`, name, kind: 'restaurant', location: { lat, lng }, rating: 4.5, reviewCount: 1200 }
}

function day(
  countryCode: string,
  dayNumber: number,
  placeIds: string[],
  opts: { lodging?: Place; lunch?: NearbyPlace; dinner?: NearbyPlace; start?: string; end?: string } = {},
): SavedDay {
  const country = findCountry(countryCode)
  const places = country ? placesOf(country) : []
  const start = opts.start ?? '09:00'
  const end = opts.end ?? '19:00'
  const saved: Omit<SavedDay, 'summary'> = {
    dayNumber,
    savedAt: minutesAgo(60 * 24),
    input: {
      countryCode,
      selections: placeIds.map((placeId) => ({
        placeId,
        stayMinutes: places.find((p) => p.id === placeId)?.defaultStayMinutes ?? 90,
      })),
      customPlaces: [],
      lodging: opts.lodging ?? null,
      startFromLodging: !!opts.lodging,
      returnToLodging: !!opts.lodging,
      startTime: start,
      endTime: end,
    },
    customOrder: placeIds,
    mealChoices: { ...(opts.lunch && { lunch: opts.lunch }), ...(opts.dinner && { dinner: opts.dinner }) },
  }
  // 목록 요약의 끝나는 시각은 실제로 저장할 때처럼 시간표를 계산해서
  const schedule = country && buildSchedule(saved.input, places, country.currency, placeIds, saved.mealChoices)
  return {
    ...saved,
    summary: {
      startTime: start,
      endTime: schedule ? toHHMM(schedule.endAt) : end,
      placeNames: placeIds.map((id) => places.find((p) => p.id === id)?.name ?? id),
      lodgingName: opts.lodging?.name ?? null,
    },
  }
}

function trip(id: string, name: string, countryCode: string, days: SavedDay[]): SavedTrip {
  const at = minutesAgo(60 * 24)
  return { id, name, countryCode, createdAt: at, updatedAt: at, days }
}

const users = {
  mina: { nickname: '미나의여행일지', icon: '🌸' },
  jun: { nickname: '준이네', icon: '🐻' },
  soo: { nickname: '수빈', icon: '🧳' },
  hoon: { nickname: '뚜벅이훈', icon: '🤠' },
  yuna: { nickname: 'yuna_trip', icon: '🦊' },
}

const shinjuku = lodging('신주쿠 호텔', 35.6938, 139.7034)
const namba = lodging('난바 호텔', 34.6659, 135.5013)
const myeongdongHotel = lodging('명동 호텔', 37.5609, 126.9856)
const haeundaeHotel = lodging('해운대 호텔', 35.1606, 129.1636)

export const mockFeed: FeedPost[] = [
  {
    id: 'post-1',
    author: users.mina,
    trip: trip('mock-tokyo', '도쿄 2박 3일 첫 여행', 'JP', [
      day('JP', 1, ['sensoji', 'skytree', 'ueno'], {
        lodging: shinjuku,
        lunch: restaurant('아사쿠사 텐동', 35.7118, 139.7966),
      }),
      day('JP', 2, ['meiji', 'shibuya', 'ginza'], {
        lodging: shinjuku,
        dinner: restaurant('긴자 스시', 35.6717, 139.765),
      }),
    ]),
    caption: '첫 도쿄 여행 동선 공유해요! 아사쿠사는 아침 일찍 가야 사람이 적어요 ☺️',
    tags: ['도쿄', '2박3일', '첫해외여행'],
    likeCount: 128,
    comments: [
      { id: 'c1', author: users.jun, text: '동선 너무 깔끔하네요! 저장해 갑니다', postedAt: minutesAgo(40) },
      { id: 'c2', author: users.yuna, text: '스카이트리 예약 미리 하셨나요?', postedAt: minutesAgo(25) },
      { id: 'c3', author: users.mina, text: '@yuna_trip 네! 현장 줄이 길어서 미리 하는 걸 추천해요', postedAt: minutesAgo(12) },
    ],
    postedAt: minutesAgo(95),
  },
  {
    id: 'post-2',
    author: users.hoon,
    trip: trip('mock-seoul', '서울 하루 뚜벅이 코스', 'KR', [
      day('KR', 1, ['gyeongbokgung', 'bukchon', 'insadong', 'myeongdong', 'namsan'], {
        lodging: myeongdongHotel,
        lunch: restaurant('토속촌 삼계탕', 37.5778, 126.9706),
      }),
    ]),
    caption: '지하철 + 걷기만으로 하루에 서울 핵심 다 돌기. 신발은 편한 걸로!',
    tags: ['서울', '당일치기', '뚜벅이'],
    likeCount: 76,
    comments: [{ id: 'c4', author: users.soo, text: '북촌은 몇 시쯤 가는 게 좋아요?', postedAt: minutesAgo(200) }],
    postedAt: minutesAgo(60 * 5),
  },
  {
    id: 'post-3',
    author: users.soo,
    trip: trip('mock-osaka', '오사카 먹방 투어', 'JP', [
      day('JP', 1, ['osaka-castle', 'kuromon', 'dotonbori'], {
        lodging: namba,
        dinner: restaurant('도톤보리 오코노미야키', 34.6687, 135.5013),
      }),
      day('JP', 2, ['umeda-sky', 'tsutenkaku'], { lodging: namba, end: '17:00' }),
    ]),
    caption: '먹는 게 남는 거! 구로몬 시장은 점심 전에 가면 덜 붐벼요 🍣',
    tags: ['오사카', '먹방', '1박2일'],
    likeCount: 214,
    comments: [
      { id: 'c5', author: users.hoon, text: '츠텐카쿠 근처 쿠시카츠 꼭 드세요!', postedAt: minutesAgo(60 * 20) },
      { id: 'c6', author: users.mina, text: '저도 다음 달에 가요 참고할게요', postedAt: minutesAgo(60 * 18) },
    ],
    postedAt: minutesAgo(60 * 26),
  },
  {
    id: 'post-4',
    author: users.yuna,
    trip: trip('mock-busan', '부산 바다 따라 하루', 'KR', [
      day('KR', 1, ['haedong', 'haeundae', 'gwangalli'], {
        lodging: haeundaeHotel,
        lunch: restaurant('해운대 돼지국밥', 35.1631, 129.1597),
        start: '10:00',
        end: '20:00',
      }),
    ]),
    caption: '광안리 야경으로 마무리하는 코스 🌊 해동용궁사는 오전이 예뻐요',
    tags: ['부산', '바다', '야경'],
    likeCount: 92,
    comments: [],
    postedAt: minutesAgo(60 * 24 * 3),
  },
]
