import { useEffect, useMemo, useRef, useState } from 'react'
import logo from './assets/logo.png'
import AuthPage, { UserIcon } from './components/AuthPage'
import CommunityPage from './components/CommunityPage'
import MyPage, { type MyPageSelection } from './components/MyPage'
import SaveDialog from './components/SaveDialog'
import ScheduleView from './components/ScheduleView'
import WelcomeNotice from './components/WelcomeNotice'
import Wizard from './components/Wizard'
import { findCountry, placesOf } from './data/catalog'
import { useFetchRealLegs, useRealLegStore } from './hooks/useRealLegs'
import { useBookmarks } from './hooks/useBookmarks'
import { useTrips } from './hooks/useTrips'
import { toPlace } from './lib/recommend'
import { applyAdjustment, buildSchedule, suggestAdjustments } from './lib/schedule'
import { loadSession, logOut, type SessionUser } from './lib/auth'
import { deleteDay, deleteTrip, nextDayNumber, renameTrip, upsertDay, type SaveTarget } from './lib/storage'
import { toHHMM } from './lib/time'
import { routeNote } from './services/routes'
import type {
  Adjustment,
  MealChoices,
  MealKind,
  MealSlots,
  NearbyPlace,
  Recommendation,
  SavedDay,
  SavedTrip,
  TripInput,
} from './types'

const initialInput: TripInput = {
  countryCode: null,
  selections: [],
  customPlaces: [],
  lodging: null,
  startFromLodging: true,
  returnToLodging: true,
  startTime: '09:00',
  endTime: '18:00',
}

/** 지금 만들고 있는 일정이 어느 여행의 몇 일차인지 (저장 대화상자 기본값) */
type Editing = { tripId: string; dayNumber: number }

export default function App() {
  const [view, setView] = useState<'planner' | 'mypage' | 'community' | 'login'>('planner')
  // 마이페이지 탭 옆 ▾ 메뉴 (마이페이지 / 커뮤니티)
  // 헤더의 펼침 메뉴: 'pages' = 커뮤니티 ▾ (커뮤니티 / 마이페이지), 'account' = 닉네임 (계정 설정 / 로그아웃)
  const [openMenu, setOpenMenu] = useState<'pages' | 'account' | null>(null)
  const pagesMenuRef = useRef<HTMLDivElement>(null)
  const accountMenuRef = useRef<HTMLDivElement>(null)
  const [user, setUser] = useState<SessionUser | null>(loadSession)
  const [input, setInput] = useState<TripInput>(initialInput)
  const [phase, setPhase] = useState<'input' | 'result'>('input')
  const [wizardStart, setWizardStart] = useState<'country' | 'places' | 'time'>('country')
  // 사용자가 ▲▼로 바꾼 방문 순서. null이면 앱이 정한 최적 순서
  const [customOrder, setCustomOrder] = useState<string[] | null>(null)
  // 식사 시간에 고른 음식점
  const [mealChoices, setMealChoices] = useState<MealChoices>({})
  // 고른 음식점을 끌어서 옮긴 자리 (없으면 식사 시간대에 맞춰 자동)
  const [mealSlots, setMealSlots] = useState<MealSlots>({})

  const { trips, setTrips, saveFailed } = useTrips()
  const bookmarks = useBookmarks(user)
  const [editing, setEditing] = useState<Editing | null>(null)
  const [saveOpen, setSaveOpen] = useState(false)
  // 방금 저장했으면 결과 화면에 안내를 띄움 (일정을 고치면 사라짐)
  const [justSaved, setJustSaved] = useState(false)
  // 로그인하지 않고 저장을 누르면 안내 (로그인하면 만들던 일정으로 돌아옴)
  const [loginNeeded, setLoginNeeded] = useState(false)
  const [myPageSelection, setMyPageSelection] = useState<MyPageSelection>(null)

  useEffect(() => {
    if (!openMenu) return
    const ref = openMenu === 'pages' ? pagesMenuRef : accountMenuRef
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpenMenu(null)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [openMenu])

  function logout() {
    logOut()
    setUser(null)
  }

  const country = findCountry(input.countryCode)
  const editingTrip = trips.find((t) => t.id === editing?.tripId)

  // 실제 길찾기로 받아 둔 구간 (받는 대로 시간표를 다시 계산)
  const realLegs = useRealLegStore()

  const result = useMemo(() => {
    if (phase !== 'result' || !country) return null
    // 선택한 id를 찾을 장소 목록: 기본 추천 장소 + 검색·주변 추천으로 추가한 곳
    const places = [...placesOf(country), ...input.customPlaces]
    const order = customOrder ?? undefined
    const schedule = buildSchedule(input, places, country.currency, order, mealChoices, mealSlots, realLegs.legs)
    const adjustments = suggestAdjustments(
      input,
      places,
      country.currency,
      schedule,
      customOrder,
      mealChoices,
      mealSlots,
      realLegs.legs,
    )
    return { places, schedule, adjustments }
  }, [phase, input, country, customOrder, mealChoices, mealSlots, realLegs.legs])

  const routeFetch = useFetchRealLegs(country, result?.schedule, realLegs.legs, realLegs.add)

  function move(placeId: string, direction: -1 | 1) {
    if (!result) return
    const order = [...result.schedule.order]
    const i = order.indexOf(placeId)
    ;[order[i], order[i + direction]] = [order[i + direction], order[i]]
    setCustomOrder(order)
    setJustSaved(false)
  }

  function apply(adjustment: Adjustment) {
    const next = applyAdjustment(input, customOrder, adjustment)
    setInput(next.input)
    setCustomOrder(next.order)
    setJustSaved(false)
  }

  function addPlace(rec: Recommendation) {
    const place = toPlace(rec.poi)
    setInput({
      ...input,
      customPlaces: [...input.customPlaces.filter((p) => p.id !== place.id), place],
      selections: [...input.selections, { placeId: place.id, stayMinutes: place.defaultStayMinutes }],
    })
    // 직접 바꾼 순서가 있으면 끝에 붙이고, 아니면 최적 순서를 다시 계산
    setCustomOrder(customOrder && [...customOrder, place.id])
    setJustSaved(false)
  }

  function chooseMeal(meal: MealKind, poi: NearbyPlace | null) {
    setMealChoices((prev) => {
      const next = { ...prev }
      if (poi) next[meal] = poi
      else delete next[meal]
      return next
    })
    // 음식점을 새로 고르거나 지우면 자리는 다시 자동으로
    setMealSlots((prev) => {
      const next = { ...prev }
      delete next[meal]
      return next
    })
    setJustSaved(false)
  }

  function changeStay(placeId: string, stayMinutes: number) {
    setInput({
      ...input,
      selections: input.selections.map((s) => (s.placeId === placeId ? { ...s, stayMinutes } : s)),
    })
    setJustSaved(false)
  }

  function changeTimes(startTime: string, endTime: string) {
    setInput({ ...input, startTime, endTime })
    setJustSaved(false)
  }

  function save(target: SaveTarget, dayNumber: number) {
    if (!result) return
    const day: SavedDay = {
      dayNumber,
      savedAt: new Date().toISOString(),
      input,
      customOrder,
      mealChoices,
      mealSlots,
      summary: {
        startTime: input.startTime,
        endTime: toHHMM(result.schedule.endAt),
        placeNames: result.schedule.order.map((id) => result.places.find((p) => p.id === id)?.name ?? id),
        lodgingName: input.lodging?.name ?? null,
      },
    }
    const saved = upsertDay(trips, target, day)
    setTrips(saved.trips)
    setEditing({ tripId: saved.tripId, dayNumber })
    setSaveOpen(false)
    setJustSaved(true)
  }

  /** 같은 나라·숙소·활동 시간으로 다음 일차 일정을 새로 시작 */
  function startDay(trip: SavedTrip | undefined, base: TripInput) {
    setInput({ ...base, selections: [], customPlaces: [] })
    setCustomOrder(null)
    setMealChoices({})
    setMealSlots({})
    setEditing(trip ? { tripId: trip.id, dayNumber: nextDayNumber(trip) } : null)
    setJustSaved(false)
    setWizardStart('places')
    setPhase('input')
    setView('planner')
  }

  function editDay(trip: SavedTrip, day: SavedDay) {
    setInput(day.input)
    setCustomOrder(day.customOrder)
    setMealChoices(day.mealChoices)
    setMealSlots(day.mealSlots ?? {})
    setEditing({ tripId: trip.id, dayNumber: day.dayNumber })
    setJustSaved(false)
    setPhase('result')
    setView('planner')
  }

  function newPlan() {
    setInput(initialInput)
    setCustomOrder(null)
    setMealChoices({})
    setMealSlots({})
    setEditing(null)
    setJustSaved(false)
    setWizardStart('country')
    setPhase('input')
    setView('planner')
  }

  const scheduleTitle =
    editingTrip && editing ? `${editingTrip.name} · ${editing.dayNumber}일차` : `${country?.name ?? ''} 하루 일정`
  // 지도가 나오는 화면은 창 전체 폭, 나머지는 가운데 카드 폭
  const wide = view === 'login' || view === 'community' ? false : view === 'mypage' ? !!myPageSelection : phase === 'result'

  return (
    <div className="app">
      <header className="app-header">
        <div className={`app-header-inner ${wide ? 'wide' : ''}`}>
          {/* 로고를 누르면 메인(일정 만들기) 화면으로 */}
          <button
            type="button"
            className="brand"
            onClick={() => {
              setView('planner')
              setOpenMenu(null)
            }}
          >
            <img src={logo} alt="PLAN:J 메인으로" />
          </button>
          <nav className="header-tabs">
            <button type="button" className={view === 'planner' ? 'active' : ''} onClick={() => setView('planner')}>
              일정 만들기
            </button>
            <div ref={pagesMenuRef} className={`tab-menu ${view === 'mypage' || view === 'community' ? 'active' : ''}`}>
              <button type="button" onClick={() => setView('community')}>
                {view === 'mypage' ? '마이페이지' : '커뮤니티'}
                {view === 'mypage' && trips.length > 0 && <span className="count">{trips.length}</span>}
              </button>
              <button
                type="button"
                className="tab-menu-toggle"
                aria-label="커뮤니티 메뉴 열기"
                aria-expanded={openMenu === 'pages'}
                onClick={() => setOpenMenu(openMenu === 'pages' ? null : 'pages')}
              >
                ▾
              </button>
              {openMenu === 'pages' && (
                <ul className="tab-menu-list" role="menu">
                  {(
                    [
                      ['community', '커뮤니티'],
                      ['mypage', '마이페이지'],
                    ] as const
                  ).map(([key, label]) => (
                    <li key={key}>
                      <button
                        type="button"
                        role="menuitem"
                        className={view === key ? 'current' : ''}
                        onClick={() => {
                          setView(key)
                          setOpenMenu(null)
                        }}
                      >
                        {label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {user ? (
              <div ref={accountMenuRef} className={`tab-menu ${view === 'login' ? 'active' : ''}`}>
                <button
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={openMenu === 'account'}
                  onClick={() => setOpenMenu(openMenu === 'account' ? null : 'account')}
                >
                  <UserIcon icon={user.icon} />
                  {user.nickname}님<span className="tab-menu-caret">▾</span>
                </button>
                {openMenu === 'account' && (
                  <ul className="tab-menu-list" role="menu">
                    <li>
                      <button
                        type="button"
                        role="menuitem"
                        className={view === 'login' ? 'current' : ''}
                        onClick={() => {
                          setView('login')
                          setOpenMenu(null)
                        }}
                      >
                        계정 설정
                      </button>
                    </li>
                    <li>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          logout()
                          setOpenMenu(null)
                        }}
                      >
                        로그아웃
                      </button>
                    </li>
                  </ul>
                )}
              </div>
            ) : (
              <button type="button" className={view === 'login' ? 'active' : ''} onClick={() => setView('login')}>
                로그인
              </button>
            )}
          </nav>
        </div>
      </header>

      {view === 'community' ? (
        <main className="app-main">
          <CommunityPage
            user={user}
            trips={trips}
            onRequireLogin={() => setView('login')}
            onNewPlan={newPlan}
            isBookmarked={bookmarks.isBookmarked}
            onToggleBookmark={bookmarks.toggle}
          />
        </main>
      ) : view === 'login' ? (
        <main className="app-main">
          <AuthPage
            user={user}
            onUserChange={setUser}
            onLogin={(u) => {
              setUser(u)
              if (loginNeeded) {
                setLoginNeeded(false)
                setView('planner')
              }
            }}
          />
        </main>
      ) : view === 'mypage' ? (
        <main className={`app-main ${wide ? 'wide' : ''}`}>
          <MyPage
            trips={trips}
            bookmarks={user ? bookmarks.bookmarks : null}
            onRemoveBookmark={bookmarks.remove}
            onOpenCommunity={() => setView('community')}
            selection={myPageSelection}
            onSelect={setMyPageSelection}
            onEditDay={editDay}
            onAddDay={(trip) => {
              const last = trip.days[trip.days.length - 1]
              startDay(trip, last ? last.input : { ...initialInput, countryCode: trip.countryCode })
            }}
            onDeleteDay={(trip, dayNumber) => setTrips(deleteDay(trips, trip.id, dayNumber))}
            onDeleteTrip={(trip) => {
              setTrips(deleteTrip(trips, trip.id))
              setMyPageSelection(null)
              if (editing?.tripId === trip.id) setEditing(null)
            }}
            onRenameTrip={(trip, name) => setTrips(renameTrip(trips, trip.id, name))}
            onNewPlan={newPlan}
          />
        </main>
      ) : (
        <main className={`app-main ${wide ? 'wide' : ''}`}>
          {phase === 'result' && result && country ? (
            <ScheduleView
              country={country}
              places={result.places}
              schedule={result.schedule}
              adjustments={result.adjustments}
              isCustomOrder={customOrder !== null}
              mealChoices={mealChoices}
              title={scheduleTitle}
              actions={
                <>
                  <button
                    type="button"
                    className="btn small"
                    onClick={() => {
                      setWizardStart('time')
                      setPhase('input')
                    }}
                  >
                    조건 수정
                  </button>
                  <button type="button" className="btn small primary" onClick={() => (user ? setSaveOpen(true) : setLoginNeeded(true))}>
                    💾 저장
                  </button>
                </>
              }
              banner={
                loginNeeded && !user ? (
                  <p className="notice error-notice">
                    로그인 후 사용 가능한 기능입니다.{' '}
                    <button type="button" className="link-btn" onClick={() => setView('login')}>
                      로그인하기
                    </button>
                  </p>
                ) : saveFailed ? (
                  <p className="notice error-notice">
                    이 브라우저에 저장하지 못했습니다. 저장 공간이나 사생활 보호 설정을 확인해 주세요.
                  </p>
                ) : justSaved && editingTrip && editing ? (
                  <div className="notice success">
                    <span>
                      ✓ <strong>{editingTrip.name}</strong> {editing.dayNumber}일차로 저장했습니다.
                    </span>
                    <span className="notice-actions">
                      <button
                        type="button"
                        className="link-btn"
                        onClick={() => {
                          setMyPageSelection({ tripId: editingTrip.id, dayNumber: editing.dayNumber })
                          setView('mypage')
                        }}
                      >
                        마이페이지에서 보기
                      </button>
                      <button type="button" className="btn small primary" onClick={() => startDay(editingTrip, input)}>
                        다음 날({nextDayNumber(editingTrip)}일차) 일정 만들기
                      </button>
                    </span>
                  </div>
                ) : null
              }
              routeStatus={country && { ...routeFetch, note: routeNote(country) }}
              editor={{
                onMove: move,
                onReorder: (order, slots) => {
                  setCustomOrder(order)
                  setMealSlots((prev) => ({ ...prev, ...slots }))
                  setJustSaved(false)
                },
                onChangeStay: changeStay,
                onChangeTimes: changeTimes,
                onResetOrder: () => {
                  setCustomOrder(null)
                  setJustSaved(false)
                },
                onApply: apply,
                onAddPlace: addPlace,
                onChooseMeal: chooseMeal,
              }}
            />
          ) : (
            <>
              {editingTrip && editing && (
                <p className="notice editing-notice">
                  📁 {editingTrip.name} · {editing.dayNumber}일차 일정을 만드는 중
                </p>
              )}
              <Wizard
                input={input}
                startAt={wizardStart}
                onChange={setInput}
                onComplete={() => {
                  // 조건이 바뀌었을 수 있으므로 순서는 다시 최적화
                  setCustomOrder(null)
                  setJustSaved(false)
                  setPhase('result')
                }}
              />
            </>
          )}
        </main>
      )}

      <WelcomeNotice />

      {saveOpen && country && (
        <SaveDialog
          country={country}
          trips={trips.filter((t) => t.countryCode === country.code)}
          defaultTripId={editing?.tripId ?? null}
          defaultDayNumber={editing?.dayNumber ?? null}
          onCancel={() => setSaveOpen(false)}
          onSave={save}
        />
      )}
    </div>
  )
}
