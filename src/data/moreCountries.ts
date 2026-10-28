import type { Country, Place, PlaceCategory } from '../types'

// 한국 여행자가 많이 가는 동남아·중화권 나라들의 대표 도시와 추천 장소.
// 좌표는 장소 중심의 대략 위치 — 정확한 위치는 장소 검색(Google)으로 고를 수 있다.

function place(id: string, name: string, category: PlaceCategory, lat: number, lng: number, stay: number): Place {
  return { id, name, category, location: { lat, lng }, defaultStayMinutes: stay }
}

export const moreCountries: Country[] = [
  {
    code: 'VN',
    name: '베트남',
    flag: '🇻🇳',
    currency: 'VND',
    utcOffsetHours: 7,
    center: { lat: 16.0544, lng: 108.2022 },
    bounds: [102.1, 8.4, 109.5, 23.4],
    regions: [
      {
        id: 'danang',
        name: '다낭',
        center: { lat: 16.0544, lng: 108.2022 },
        places: [
          place('my-khe', '미케 해변', 'nature', 16.0544, 108.247, 90),
          place('han-market', '한 시장', 'shopping', 16.0681, 108.2244, 60),
          place('dragon-bridge', '용다리', 'sight', 16.0613, 108.2275, 30),
          place('danang-cathedral', '다낭 대성당', 'sight', 16.0668, 108.2232, 30),
          place('marble-mountains', '오행산(마블 마운틴)', 'nature', 16.0034, 108.2638, 90),
          place('linh-ung', '린응사(손짜 반도)', 'sight', 16.1003, 108.2775, 60),
          place('ba-na-hills', '바나힐', 'sight', 15.9977, 107.9963, 240),
        ],
      },
      {
        id: 'hoian',
        name: '호이안',
        center: { lat: 15.877, lng: 108.3261 },
        places: [
          place('hoian-old-town', '호이안 구시가지', 'sight', 15.877, 108.3261, 120),
          place('japanese-bridge', '내원교(일본 다리)', 'sight', 15.8772, 108.3262, 30),
          place('an-bang', '안방 해변', 'nature', 15.9133, 108.3417, 90),
        ],
      },
      {
        id: 'hanoi',
        name: '하노이',
        center: { lat: 21.0285, lng: 105.8542 },
        places: [
          place('hoan-kiem', '호안끼엠 호수', 'nature', 21.0288, 105.8525, 60),
          place('hanoi-old-quarter', '하노이 구시가지(36거리)', 'shopping', 21.034, 105.85, 90),
          place('ho-chi-minh-mausoleum', '호찌민 묘소', 'sight', 21.0369, 105.8347, 60),
          place('temple-of-literature', '문묘(반미에우)', 'sight', 21.0294, 105.8355, 60),
          place('train-street', '하노이 기찻길 마을', 'sight', 21.0282, 105.845, 30),
        ],
      },
      {
        id: 'hochiminh',
        name: '호찌민',
        center: { lat: 10.7769, lng: 106.7009 },
        places: [
          place('ben-thanh', '벤탄 시장', 'shopping', 10.7725, 106.698, 60),
          place('saigon-notre-dame', '사이공 노트르담 대성당', 'sight', 10.7798, 106.699, 30),
          place('saigon-post-office', '사이공 중앙우체국', 'sight', 10.7799, 106.6999, 30),
          place('independence-palace', '통일궁', 'museum', 10.777, 106.6953, 60),
          place('bui-vien', '부이비엔 거리', 'shopping', 10.7676, 106.6936, 60),
        ],
      },
      {
        id: 'nhatrang',
        name: '나트랑',
        center: { lat: 12.2388, lng: 109.1967 },
        places: [
          place('nhatrang-beach', '나트랑 해변', 'nature', 12.2388, 109.1967, 90),
          place('po-nagar', '포나가르 참탑', 'sight', 12.2655, 109.1953, 60),
          place('vinwonders-nhatrang', '빈원더스 나트랑', 'sight', 12.2162, 109.2427, 240),
        ],
      },
    ],
  },
  {
    code: 'TW',
    name: '대만',
    flag: '🇹🇼',
    currency: 'TWD',
    utcOffsetHours: 8,
    center: { lat: 25.033, lng: 121.5654 },
    bounds: [119.3, 21.8, 122.1, 25.4],
    regions: [
      {
        id: 'taipei',
        name: '타이베이',
        center: { lat: 25.033, lng: 121.5654 },
        places: [
          place('taipei-101', '타이베이 101', 'sight', 25.034, 121.5645, 90),
          place('cks-memorial', '중정기념당', 'sight', 25.0346, 121.5218, 60),
          place('national-palace-museum', '국립고궁박물원', 'museum', 25.1024, 121.5485, 150),
          place('shilin-night-market', '스린 야시장', 'shopping', 25.088, 121.5241, 90),
          place('ximending', '시먼딩', 'shopping', 25.0421, 121.5081, 90),
          place('longshan-temple', '룽산사', 'sight', 25.0372, 121.4999, 30),
        ],
      },
      {
        id: 'taipei-suburbs',
        name: '타이베이 근교',
        center: { lat: 25.1097, lng: 121.8448 },
        places: [
          place('jiufen', '지우펀', 'sight', 25.1097, 121.8448, 120),
          place('shifen', '스펀', 'sight', 25.0428, 121.779, 60),
          place('yehliu', '예류 지질공원', 'nature', 25.2061, 121.6905, 90),
        ],
      },
      {
        id: 'kaohsiung',
        name: '가오슝',
        center: { lat: 22.6273, lng: 120.3014 },
        places: [
          place('pier-2', '보얼 예술특구', 'museum', 22.6206, 120.2817, 90),
          place('lotus-pond', '롄츠탄(연지담)', 'nature', 22.6797, 120.2945, 60),
          place('liuhe-night-market', '류허 야시장', 'shopping', 22.6331, 120.302, 60),
        ],
      },
    ],
  },
  {
    code: 'TH',
    name: '태국',
    flag: '🇹🇭',
    currency: 'THB',
    utcOffsetHours: 7,
    center: { lat: 13.7563, lng: 100.5018 },
    bounds: [97.3, 5.6, 105.7, 20.5],
    regions: [
      {
        id: 'bangkok',
        name: '방콕',
        center: { lat: 13.7563, lng: 100.5018 },
        places: [
          place('grand-palace', '왕궁', 'sight', 13.75, 100.4913, 120),
          place('wat-pho', '왓 포', 'sight', 13.7465, 100.4927, 60),
          place('wat-arun', '왓 아룬', 'sight', 13.7437, 100.4888, 60),
          place('khao-san', '카오산 로드', 'shopping', 13.759, 100.4974, 60),
          place('chatuchak', '짜뚜짝 주말시장', 'shopping', 13.7999, 100.5505, 120),
          place('iconsiam', '아이콘시암', 'shopping', 13.7267, 100.5106, 90),
        ],
      },
      {
        id: 'chiangmai',
        name: '치앙마이',
        center: { lat: 18.7883, lng: 98.9853 },
        places: [
          place('doi-suthep', '도이수텝 사원', 'sight', 18.8048, 98.9216, 90),
          place('tha-phae-gate', '타패 게이트(올드시티)', 'sight', 18.7877, 98.9933, 30),
          place('nimman', '님만해민', 'shopping', 18.7997, 98.9677, 90),
          place('night-bazaar', '치앙마이 나이트 바자', 'shopping', 18.7853, 99.0006, 60),
        ],
      },
      {
        id: 'phuket',
        name: '푸켓',
        center: { lat: 7.8804, lng: 98.3923 },
        places: [
          place('patong', '빠통 비치', 'nature', 7.8961, 98.2966, 120),
          place('big-buddha', '빅 부다', 'sight', 7.8275, 98.3127, 60),
          place('phuket-old-town', '푸켓 올드타운', 'sight', 7.8842, 98.388, 90),
        ],
      },
    ],
  },
  {
    code: 'ID',
    name: '인도네시아',
    flag: '🇮🇩',
    currency: 'IDR',
    // 한국 여행자가 가장 많이 가는 발리 기준 (자카르타는 UTC+7)
    utcOffsetHours: 8,
    center: { lat: -8.6705, lng: 115.2126 },
    bounds: [95.0, -11.0, 141.0, 6.1],
    regions: [
      {
        id: 'bali',
        name: '발리',
        center: { lat: -8.6705, lng: 115.2126 },
        places: [
          place('uluwatu', '울루와뚜 사원', 'sight', -8.8291, 115.0849, 90),
          place('tanah-lot', '따나롯 사원', 'sight', -8.6212, 115.0868, 60),
          place('ubud-monkey-forest', '우붓 몽키 포레스트', 'nature', -8.5188, 115.2585, 60),
          place('tegallalang', '뜨갈랄랑 계단식 논', 'nature', -8.4325, 115.2786, 60),
          place('kuta-beach', '꾸따 해변', 'nature', -8.7182, 115.1686, 90),
          place('seminyak', '스미냑', 'shopping', -8.6913, 115.1683, 90),
        ],
      },
      {
        id: 'jakarta',
        name: '자카르타',
        center: { lat: -6.2088, lng: 106.8456 },
        places: [
          place('monas', '모나스(독립기념탑)', 'sight', -6.1754, 106.8272, 60),
          place('istiqlal', '이스티클랄 모스크', 'sight', -6.1702, 106.831, 30),
          place('kota-tua', '꼬따 뚜아(구시가지)', 'sight', -6.1352, 106.8133, 90),
        ],
      },
    ],
  },
  {
    code: 'PH',
    name: '필리핀',
    flag: '🇵🇭',
    currency: 'PHP',
    utcOffsetHours: 8,
    center: { lat: 10.3157, lng: 123.8854 },
    bounds: [116.9, 4.6, 126.6, 21.1],
    regions: [
      {
        id: 'cebu',
        name: '세부',
        center: { lat: 10.3157, lng: 123.8854 },
        places: [
          place('santo-nino', '산토니뇨 성당', 'sight', 10.2948, 123.902, 30),
          place('magellans-cross', '마젤란 십자가', 'sight', 10.2934, 123.9017, 30),
          place('tops-lookout', '탑스 전망대', 'nature', 10.3684, 123.8734, 60),
          place('mactan-shrine', '막탄 슈라인(라푸라푸 동상)', 'sight', 10.3108, 124.0153, 30),
        ],
      },
      {
        id: 'boracay',
        name: '보라카이',
        center: { lat: 11.9674, lng: 121.9248 },
        places: [
          place('white-beach', '화이트 비치', 'nature', 11.9643, 121.9241, 120),
          place('puka-beach', '푸카 셸 비치', 'nature', 11.999, 121.9172, 90),
        ],
      },
      {
        id: 'manila',
        name: '마닐라',
        center: { lat: 14.5995, lng: 120.9842 },
        places: [
          place('intramuros', '인트라무로스', 'sight', 14.5896, 120.9747, 90),
          place('rizal-park', '리잘 공원', 'nature', 14.5826, 120.9787, 60),
          place('manila-cathedral', '마닐라 대성당', 'sight', 14.5915, 120.9734, 30),
        ],
      },
    ],
  },
  {
    code: 'SG',
    name: '싱가포르',
    flag: '🇸🇬',
    currency: 'SGD',
    utcOffsetHours: 8,
    center: { lat: 1.2903, lng: 103.852 },
    bounds: [103.6, 1.15, 104.1, 1.48],
    regions: [
      {
        id: 'singapore',
        name: '싱가포르',
        center: { lat: 1.2903, lng: 103.852 },
        places: [
          place('marina-bay-sands', '마리나 베이 샌즈', 'sight', 1.2834, 103.8607, 90),
          place('gardens-by-the-bay', '가든스 바이 더 베이', 'nature', 1.2816, 103.8636, 120),
          place('merlion', '멀라이언 파크', 'sight', 1.2868, 103.8545, 30),
          place('sentosa', '센토사', 'sight', 1.2494, 103.8303, 240),
          place('sg-chinatown', '차이나타운', 'shopping', 1.2833, 103.8443, 60),
          place('little-india', '리틀 인디아', 'shopping', 1.3066, 103.8518, 60),
        ],
      },
    ],
  },
  {
    code: 'HK',
    name: '홍콩',
    flag: '🇭🇰',
    currency: 'HKD',
    utcOffsetHours: 8,
    center: { lat: 22.2855, lng: 114.1577 },
    bounds: [113.8, 22.15, 114.45, 22.57],
    regions: [
      {
        id: 'hongkong',
        name: '홍콩',
        center: { lat: 22.2855, lng: 114.1577 },
        places: [
          place('victoria-peak', '빅토리아 피크', 'nature', 22.2759, 114.1455, 90),
          place('avenue-of-stars', '침사추이 스타의 거리', 'sight', 22.2933, 114.1747, 60),
          place('temple-street', '템플 스트리트 야시장', 'shopping', 22.3081, 114.17, 60),
          place('ladies-market', '몽콕 여인가', 'shopping', 22.3192, 114.1709, 60),
          place('lan-kwai-fong', '란콰이퐁', 'shopping', 22.281, 114.1555, 60),
          place('hk-disneyland', '홍콩 디즈니랜드', 'sight', 22.313, 114.0413, 300),
        ],
      },
    ],
  },
  {
    code: 'MY',
    name: '말레이시아',
    flag: '🇲🇾',
    currency: 'MYR',
    utcOffsetHours: 8,
    center: { lat: 3.139, lng: 101.6869 },
    bounds: [99.6, 0.85, 119.3, 7.4],
    regions: [
      {
        id: 'kualalumpur',
        name: '쿠알라룸푸르',
        center: { lat: 3.139, lng: 101.6869 },
        places: [
          place('petronas', '페트로나스 트윈타워', 'sight', 3.1579, 101.7116, 60),
          place('batu-caves', '바투 동굴', 'sight', 3.2379, 101.684, 90),
          place('bukit-bintang', '부킷 빈탕', 'shopping', 3.1466, 101.711, 90),
          place('merdeka-square', '메르데카 광장', 'sight', 3.1478, 101.6953, 30),
        ],
      },
      {
        id: 'kotakinabalu',
        name: '코타키나발루',
        center: { lat: 5.9804, lng: 116.0735 },
        places: [
          place('tanjung-aru', '탄중아루 해변', 'nature', 5.9516, 116.049, 90),
          place('kk-city-mosque', '코타키나발루 시티 모스크', 'sight', 5.9928, 116.1069, 30),
          place('gaya-street', '가야 스트리트', 'shopping', 5.9822, 116.0753, 60),
        ],
      },
    ],
  },
]
