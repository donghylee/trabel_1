// 선 아이콘 (휴대폰 하단 탭바, 메시지 화면 버튼, 커뮤니티 사진 넘기기) — 색은 글자색(currentColor)을 따름

const svgProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const

export const TabIcons = {
  // 메시지: 뒤로가기 ←, 사진·일정 보내기 +
  back: (
    <svg {...svgProps} strokeWidth={2.2}>
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </svg>
  ),
  // 메시지 입력 중 키패드 숨기기 ⌄
  down: (
    <svg {...svgProps} strokeWidth={2.4}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  ),
  // 커뮤니티 사진 넘기기 ‹ ›
  prev: (
    <svg {...svgProps} strokeWidth={2.4}>
      <path d="M15 6l-6 6 6 6" />
    </svg>
  ),
  next: (
    <svg {...svgProps} strokeWidth={2.4}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  ),
  plus: (
    <svg {...svgProps} strokeWidth={2.2}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  // 지도 핀 + 경로
  planner: (
    <svg {...svgProps}>
      <path d="M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10z" />
      <circle cx="12" cy="11" r="2.2" />
    </svg>
  ),
  // 말풍선
  community: (
    <svg {...svgProps}>
      <path d="M4 5h16v11H9l-5 4z" />
      <path d="M8 9.5h8M8 12.5h5" />
    </svg>
  ),
  // 편지봉투 (메시지)
  messages: (
    <svg {...svgProps}>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  ),
  // 하트
  bookmarks: (
    <svg {...svgProps}>
      <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
    </svg>
  ),
  // 사람
  mypage: (
    <svg {...svgProps}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c1.2-3.6 3.8-5.5 7-5.5s5.8 1.9 7 5.5" />
    </svg>
  ),
}
