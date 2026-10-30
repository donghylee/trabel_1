import { useState } from 'react'
import { findCountry, placesOf } from '../data/catalog'
import { t } from '../i18n'
import { toMinutes } from '../lib/time'
import type { LatLng, TripInput } from '../types'
import CountryStep from './steps/CountryStep'
import LodgingStep from './steps/LodgingStep'
import PlaceStep from './steps/PlaceStep'
import TimeStep from './steps/TimeStep'

const steps = [
  { label: '국가', title: '어느 나라로 여행하나요?' },
  { label: '장소', title: '가고 싶은 장소를 검색해서 추가해 주세요' },
  { label: '숙소', title: '숙소가 있나요? (선택)' },
  { label: '시간', title: '하루 활동 시간을 정해 주세요' },
]

type Props = {
  input: TripInput
  /**
   * 처음 보여줄 단계.
   * time = 결과 화면에서 "조건 수정"으로 돌아올 때, places = "다음 날 일정 만들기"로 나라는 그대로 두고 시작할 때
   */
  startAt?: 'country' | 'places' | 'time'
  onChange: (input: TripInput) => void
  onComplete: () => void
}

export default function Wizard({ input, startAt = 'country', onChange, onComplete }: Props) {
  const lastStep = steps.length - 1
  const [step, setStep] = useState({ country: 0, places: 1, time: lastStep }[startAt])
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
            <span className="stepper-dot">{i < step ? '✓' : i + 1}</span>
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
                onChange({ ...input, countryCode, selections: [], customPlaces: [], lodging: null })
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
            onChange={(startTime, endTime) => onChange({ ...input, startTime, endTime })}
          />
        )}
      </div>

      <div className="wizard-nav">
        <button type="button" className="btn" disabled={step === 0} onClick={() => setStep(step - 1)}>
          {t('이전')}
        </button>
        <button
          type="button"
          className="btn primary"
          disabled={!canProceed}
          onClick={() => (isLast ? onComplete() : setStep(step + 1))}
        >
          {isLast ? t('일정 만들기') : t('다음')}
        </button>
      </div>
    </div>
  )
}
