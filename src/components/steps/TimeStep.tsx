import { t } from '../../i18n'
import { formatDuration, toMinutes } from '../../lib/time'

type Props = {
  startTime: string
  endTime: string
  totalStayMinutes: number
  onChange: (startTime: string, endTime: string) => void
}

export default function TimeStep({ startTime, endTime, totalStayMinutes, onChange }: Props) {
  const available = toMinutes(endTime) - toMinutes(startTime)
  const spare = available - totalStayMinutes

  return (
    <div className="time-step">
      <div className="time-inputs">
        <label>
          {t('출발 시각')}
          <input type="time" value={startTime} onChange={(e) => onChange(e.target.value, endTime)} />
        </label>
        <span className="time-sep">~</span>
        <label>
          {t('종료 시각')}
          <input type="time" value={endTime} onChange={(e) => onChange(startTime, e.target.value)} />
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
              <dt>{t('머무를 시간 합계')}</dt>
              <dd>{formatDuration(totalStayMinutes)}</dd>
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
