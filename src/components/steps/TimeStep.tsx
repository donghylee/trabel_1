import { t } from '../../i18n'
import { MEAL_MINUTES, mealsBetween } from '../../lib/schedule'
import { formatDuration, toMinutes } from '../../lib/time'
import type { TripInput } from '../../types'

const MEAL_OPTIONS = [30, 60, 90, 120]
const BUFFER_OPTIONS = [0, 5, 10, 15, 20, 30]

type PacePatch = Partial<Pick<TripInput, 'mealMinutes' | 'moveBufferMinutes'>>

/** 식사 시간(한 끼)·이동 시간(구간마다 더하는 여유) — 시간 단계와 결과 화면에서 같이 씀 */
export function PaceFields({
  mealMinutes = MEAL_MINUTES,
  moveBufferMinutes = 0,
  onChange,
  className = 'time-inputs',
}: {
  mealMinutes?: number
  moveBufferMinutes?: number
  onChange: (patch: PacePatch) => void
  className?: string
}) {
  return (
    <div className={className}>
      <label>
        {t('식사 시간 (한 끼)')}
        <select value={mealMinutes} onChange={(e) => onChange({ mealMinutes: Number(e.target.value) })}>
          {MEAL_OPTIONS.map((m) => (
            <option key={m} value={m}>
              {formatDuration(m)}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t('이동 시간 (구간마다)')}
        <select value={moveBufferMinutes} onChange={(e) => onChange({ moveBufferMinutes: Number(e.target.value) })}>
          {BUFFER_OPTIONS.map((m) => (
            <option key={m} value={m}>
              {m === 0 ? t('없음') : `+${formatDuration(m)}`}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}

type Props = {
  startTime: string
  endTime: string
  totalStayMinutes: number
  /** 이동 구간 수 (장소 사이 + 숙소 출발·복귀) */
  moveCount: number
  mealMinutes?: number
  moveBufferMinutes?: number
  onChange: (patch: Partial<Pick<TripInput, 'startTime' | 'endTime'>> & PacePatch) => void
}

export default function TimeStep({
  startTime,
  endTime,
  totalStayMinutes,
  moveCount,
  mealMinutes = MEAL_MINUTES,
  moveBufferMinutes = 0,
  onChange,
}: Props) {
  const available = toMinutes(endTime) - toMinutes(startTime)
  // 고른 식사 시간·이동 시간을 바로 빼서 보여 줌 (식사 수는 활동 시간에 걸친 점심·저녁)
  const meals = mealsBetween(startTime, endTime)
  const mealTotal = meals * mealMinutes
  const bufferTotal = moveCount * moveBufferMinutes
  const spare = available - totalStayMinutes - mealTotal - bufferTotal

  return (
    <div className="time-step">
      <div className="time-inputs">
        <label>
          {t('출발 시각')}
          <input type="time" value={startTime} onChange={(e) => onChange({ startTime: e.target.value })} />
        </label>
        <label>
          {t('종료 시각')}
          <input type="time" value={endTime} onChange={(e) => onChange({ endTime: e.target.value })} />
        </label>
      </div>
      <PaceFields mealMinutes={mealMinutes} moveBufferMinutes={moveBufferMinutes} onChange={onChange} />

      {available <= 0 ? (
        <p className="hint error">{t('종료 시각은 출발 시각보다 늦어야 합니다.')}</p>
      ) : (
        <>
          <dl className="time-summary">
            <div>
              <dt>{t('활동 가능 시간')}</dt>
              <dd>{formatDuration(available)}</dd>
            </div>
            <div>
              <dt>{t('보낼 시간 합계')}</dt>
              <dd>{formatDuration(totalStayMinutes)}</dd>
            </div>
            <div>
              <dt>{t('식사 {n}끼', { n: meals })}</dt>
              <dd>{formatDuration(mealTotal)}</dd>
            </div>
            <div>
              <dt>{t('이동 시간 {n}구간 추가', { n: moveCount })}</dt>
              <dd>{formatDuration(bufferTotal)}</dd>
            </div>
            <div>
              <dt>{t('이동·식사에 쓸 수 있는 시간')}</dt>
              <dd className={spare < 0 ? 'error' : ''}>
                {spare < 0 ? t('{d} 부족', { d: formatDuration(-spare) }) : formatDuration(spare)}
              </dd>
            </div>
          </dl>
          {spare < 0 && (
            <p className="hint error">{t('이대로 진행해도 되고, 일정을 만든 뒤 조정안을 제안해 드립니다.')}</p>
          )}
        </>
      )}
    </div>
  )
}
