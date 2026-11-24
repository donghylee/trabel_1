import { isPhoto } from '../lib/photos'
import { DEFAULT_ICON } from '../lib/auth'

/** 프로필 아이콘 — 이모지면 글자로, 사진이면 동그랗게 잘라서 */
export function UserIcon({ icon, size = 'small' }: { icon?: string; size?: 'small' | 'medium' | 'large' }) {
  const value = icon || DEFAULT_ICON
  return isPhoto(value) ? (
    <img className={`user-icon ${size}`} src={value} alt="" />
  ) : (
    <span className={`user-icon ${size}`} aria-hidden="true">
      {value}
    </span>
  )
}
