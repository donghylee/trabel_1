import { findCountry, placesOf } from '../data/catalog'
import { t } from '../i18n'
import { toMinutes } from '../lib/time'
import type { LatLng, TripInput } from '../types'
import CountryStep from '../components/steps/CountryStep'
import LodgingStep from '../components/steps/LodgingStep'
import PlaceStep from '../components/steps/PlaceStep'
import TimeStep from '../components/steps/TimeStep'

const steps = [
  { label: '국가', title: '어느 나라로 여행하나요?' },
  { label: '장소', title: '가고 싶은 장소를 검색해서 추가해 주세요' },
  { label: '숙소', title: '숙소가 있나요? (선택)' },
  { label: '시간', title: '하루 활동 시간을 정해 주세요' },
]

type Props = {
  input: TripInput
  /** 지금 단계 (0 국가 · 1 장소 · 2 숙소 · 3 시간) — App이 기억해서 뒤로가기로 이전 단계에 돌아감 */
  step: number
  onStepChange: (step: number) => void
  /** 만들던 도중 로고로 첫 단계에 왔으면 — 그 자리로 돌아가기 */
  onResume?: () => void
  onChange: (input: TripInput) => void
  onComplete: () => void
}

export default function Wizard({ input, step, onStepChange: setStep, onResume, onChange, onComplete }: Props) {
  const lastStep = steps.length - 1
  const country = findCountry(input.countryCode)
  const totalStay = input.selections.reduce((sum, s) => sum + s.stayMinutes, 0)

  // 고른 방문지들의 가운데 — 숙소 검색 때 이 근처를 우선
  const selectedPlaces = country
    ? [...placesOf(country), ...input.customPlaces].filter((p) =>
        input.selections.some((s) => s.placeId === p.id),
      )
    : []
  const selectedCenter: LatLng | null =
    selectedPlaces.length === 0
      ? null
      : {
          lat: selectedPlaces.reduce((sum, p) => sum + p.location.lat, 0) / selectedPlaces.length,
          lng: selectedPlaces.reduce((sum, p) => sum + p.location.lng, 0) / selectedPlaces.length,
        }

  const canProceed = [
    !!country,
    input.selections.length > 0,
    true, // 숙소는 선택 사항
    toMinutes(input.endTime) > toMinutes(input.startTime),
  ][step]

  const isLast = step === lastStep

  return (
    <div className="wizard">
      <ol className="stepper">
        {steps.map((s, i) => (
          <li key={s.label} className={i === step ? 'active' : i < step ? 'done' : ''}>
            {t(s.label)}
          </li>
        ))}
      </ol>

      <h2 className="wizard-title">{t(steps[step].title)}</h2>

      <div className="wizard-body">
        {step === 0 && (
          <CountryStep
            value={input.countryCode}
            onChange={(countryCode) => {
              // 국가가 바뀌면 장소 선택을 초기화
              if (countryCode !== input.countryCode) {
                onChange({ ...input, countryCode, selections: [], customPlaces: [], lodging: null, skippedMeals: [] })
              }
            }}
          />
        )}
        {step === 1 && country && (
          <PlaceStep
            country={country}
            customPlaces={input.customPlaces}
            selections={input.selections}
            orderFixed={!!input.orderFixed}
            onChange={(selections, customPlaces) => onChange({ ...input, selections, customPlaces })}
            onOrderChange={(selections, orderFixed) => onChange({ ...input, selections, orderFixed })}
          />
        )}
        {step === 2 && country && (
          <LodgingStep
            country={country}
            near={selectedCenter}
            lodging={input.lodging}
            startFromLodging={input.startFromLodging}
            returnToLodging={input.returnToLodging}
            onChange={(lodging, startFromLodging, returnToLodging) =>
              onChange({ ...input, lodging, startFromLodging, returnToLodging })
            }
          />
        )}
        {step === 3 && (
          <TimeStep
            startTime={input.startTime}
            endTime={input.endTime}
            totalStayMinutes={totalStay}
            moveCount={
              input.selections.length === 0
                ? 0
                : input.selections.length -
                  1 +
                  (input.lodging && input.startFromLodging ? 1 : 0) +
                  (input.lodging && input.returnToLodging ? 1 : 0)
            }
            skippedMeals={input.skippedMeals}
            mealMinutes={input.mealMinutes}
            moveBufferMinutes={input.moveBufferMinutes}
            onChange={(patch) => onChange({ ...input, ...patch })}
          />
        )}
      </div>

      <div className="wizard-nav">
        {/* 첫 단계(국가)에는 돌아갈 곳이 없으니 [이전]을 숨김 — [다음]은 오른쪽에 그대로 */}
        {step > 0 && (
          <button type="button" className="btn" onClick={() => setStep(step - 1)}>
            {t('이전')}
          </button>
        )}
        {onResume && (
          <button type="button" className="btn wizard-resume" onClick={onResume}>
            {t('진행중인 과정으로...')}
          </button>
        )}
        <button
          type="button"
          className="btn primary wizard-next"
          disabled={!canProceed}
          onClick={() => (isLast ? onComplete() : setStep(step + 1))}
        >
          {isLast ? t('일정 만들기') : t('다음')}
        </button>
      </div>
    </div>
  )
}
