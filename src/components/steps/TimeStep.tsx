import { t } from '../../i18n'
import { MEAL_MINUTES } from '../../lib/schedule'
import { formatDuration, toMinutes } from '../../lib/time'
import type { TripInput } from '../../types'

const MEAL_OPTIONS = [30, 60, 90, 120]
const BUFFER_OPTIONS = [0, 5, 10, 15, 20, 30]

type Props = {
  startTime: string
  endTime: string
  totalStayMinutes: number
  mealMinutes?: number
  moveBufferMinutes?: number
  onChange: (patch: Partial<Pick<TripInput, 'startTime' | 'endTime' | 'mealMinutes' | 'moveBufferMinutes'>>) => void
}

export default function TimeStep({
  startTime,
  endTime,
  totalStayMinutes,
  mealMinutes = MEAL_MINUTES,
  moveBufferMinutes = 0,
  onChange,
}: Props) {
  const available = toMinutes(endTime) - toMinutes(startTime)
  const spare = available - totalStayMinutes

  return (
    <div className="time-step">
      <div className="time-inputs">
        <label>
          {t('출발 시각')}
          <input type="time" value={startTime} onChange={(e) => onChange({ startTime: e.target.value })} />
        </label>
        <span className="time-sep">~</span>
        <label>
          {t('종료 시각')}
          <input type="time" value={endTime} onChange={(e) => onChange({ endTime: e.target.value })} />
        </label>
      </div>
      <div className="time-inputs">
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
          {t('이동 여유 (구간마다)')}
          <select value={moveBufferMinutes} onChange={(e) => onChange({ moveBufferMinutes: Number(e.target.value) })}>
            {BUFFER_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m === 0 ? t('없음') : `+${formatDuration(m)}`}
              </option>
            ))}
          </select>
        </label>
      </div>

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
              <dt>{t('이동·식사에 쓸 수 있는 시간')}</dt>
              <dd className={spare < 0 ? 'error' : ''}>
                {spare < 0 ? t('{d} 부족', { d: formatDuration(-spare) }) : formatDuration(spare)}
              </dd>
            </div>
          </dl>
          <p className="hint">
            {t('점심·저녁 시간대에 식사가 들어가고, 이동 시간에는 구간마다 여유 시간이 더해져 일정에 함께 계산돼요.')}
          </p>
          {spare < 0 && (
            <p className="hint error">{t('이대로 진행해도 되고, 일정을 만든 뒤 조정안을 제안해 드립니다.')}</p>
          )}
        </>
      )}
    </div>
  )
}
