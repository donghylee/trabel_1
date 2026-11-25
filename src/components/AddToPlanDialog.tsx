import { t } from '../i18n'
import { mealLabels } from '../lib/schedule'
import type { MealChoices, MealKind } from '../types'

type Props = {
  name: string
  mealChoices: MealChoices
  onMeal: (meal: MealKind) => void
  onPlace: () => void
  onCancel: () => void
}

/** [+ 일정에 추가] — 점심·저녁 식사 자리에 넣을지, 방문지로 넣을지 고르기 */
export default function AddToPlanDialog({ name, mealChoices, onMeal, onPlace, onCancel }: Props) {
  return (
    <div className="dialog-backdrop" onClick={onCancel}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-dialog-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === 'Escape' && onCancel()}
      >
        <h2 id="add-dialog-title" className="wizard-title">
          {name}
        </h2>
        <p className="hint">{t('어디에 넣을까요?')}</p>
        <div className="dialog-field">
          {(Object.keys(mealLabels) as MealKind[]).map((meal, i) => (
            <button key={meal} type="button" className="btn" autoFocus={i === 0} onClick={() => onMeal(meal)}>
              🍽️ {t('{meal} 식사', { meal: t(mealLabels[meal]) })}
              {mealChoices[meal] && (
                <div className="hint">{t('지금 고른 {name} 대신 들어갑니다', { name: mealChoices[meal].name })}</div>
              )}
            </button>
          ))}
          <button type="button" className="btn" onClick={onPlace}>
            📍 {t('일정으로 추가')}
          </button>
        </div>
        <div className="confirm-actions">
          <button type="button" className="btn small" onClick={onCancel}>
            {t('취소')}
          </button>
        </div>
      </div>
    </div>
  )
}
