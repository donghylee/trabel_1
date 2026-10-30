import { useRef, useState, type FormEvent } from 'react'
import { t } from '../i18n'
import {
  DEFAULT_ICON,
  isIdTaken,
  isNicknameTaken,
  logIn,
  signUp,
  updateIcon,
  updateNickname,
  type SessionUser,
} from '../lib/auth'

type Props = {
  user: SessionUser | null
  onLogin: (user: SessionUser) => void
  onUserChange: (user: SessionUser) => void
}

/** 프로필 아이콘 — 이모지면 글자로, 사진이면 동그랗게 잘라서 */
export function UserIcon({ icon, size = 'small' }: { icon?: string; size?: 'small' | 'medium' | 'large' }) {
  const value = icon || DEFAULT_ICON
  return value.startsWith('data:') ? (
    <img className={`user-icon ${size}`} src={value} alt="" />
  ) : (
    <span className={`user-icon ${size}`} aria-hidden="true">
      {value}
    </span>
  )
}

export default function AuthPage({ user, onLogin, onUserChange }: Props) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  // 가입 직후 로그인 화면에 ID를 채워 둠
  const [justSignedUp, setJustSignedUp] = useState<string | null>(null)

  if (user) return <AccountInfo user={user} onUserChange={onUserChange} />

  if (mode === 'signup') {
    return (
      <SignupForm
        onCancel={() => setMode('login')}
        onDone={(id) => {
          setJustSignedUp(id)
          setMode('login')
        }}
      />
    )
  }

  return <LoginForm initialId={justSignedUp ?? ''} justSignedUp={!!justSignedUp} onLogin={onLogin} onSignup={() => setMode('signup')} />
}

function LoginForm({
  initialId,
  justSignedUp,
  onLogin,
  onSignup,
}: {
  initialId: string
  justSignedUp: boolean
  onLogin: (user: SessionUser) => void
  onSignup: () => void
}) {
  const [id, setId] = useState(initialId)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const idRef = useRef<HTMLInputElement>(null)
  const pwRef = useRef<HTMLInputElement>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!id.trim()) {
      setError(t('ID를 입력해 주세요.'))
      idRef.current?.focus()
      return
    }
    if (!password) {
      setError(t('PW를 입력해 주세요.'))
      pwRef.current?.focus()
      return
    }
    const user = await logIn(id, password)
    if (!user) {
      setError(t('ID 또는 PW가 올바르지 않습니다.'))
      return
    }
    onLogin(user)
  }

  return (
    <section className="wizard auth-card">
      <h2 className="wizard-title">{t('로그인')}</h2>
      {justSignedUp && !error && <p className="notice success">{t('회원가입이 완료되었습니다. 로그인해 주세요.')}</p>}
      <form className="login-row" onSubmit={submit} noValidate>
        <div className="login-inputs">
          <input
            ref={idRef}
            className="auth-input"
            placeholder="ID"
            autoComplete="username"
            value={id}
            onChange={(e) => setId(e.target.value)}
            aria-label="ID"
          />
          <input
            ref={pwRef}
            className="auth-input"
            type="password"
            placeholder="PW"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-label="PW"
          />
        </div>
        <button type="submit" className="btn primary login-btn">
          Login
        </button>
      </form>
      {error && <p className="field-error">{error}</p>}
      <button type="button" className="link-btn signup-link" onClick={onSignup}>
        {t('회원가입')}
      </button>
    </section>
  )
}

type Field = 'id' | 'nickname' | 'password' | 'passwordConfirm' | 'email'

const FIELD_LABELS: Record<Field, string> = {
  id: 'ID',
  nickname: '닉네임',
  password: 'PW',
  passwordConfirm: 'PW 확인',
  email: 'E-mail',
}
const FIELD_ORDER: Field[] = ['id', 'nickname', 'password', 'passwordConfirm', 'email']

/** 중복 확인 결과 — 확인한 값과 함께 기억해서, 값을 고치면 다시 확인하게 함 */
type Check = { value: string; ok: boolean } | null

function SignupForm({ onCancel, onDone }: { onCancel: () => void; onDone: (id: string) => void }) {
  const [values, setValues] = useState<Record<Field, string>>({
    id: '',
    nickname: '',
    password: '',
    passwordConfirm: '',
    email: '',
  })
  const [agreed, setAgreed] = useState(false)
  const [idCheck, setIdCheck] = useState<Check>(null)
  const [nicknameCheck, setNicknameCheck] = useState<Check>(null)
  const [errors, setErrors] = useState<Partial<Record<Field | 'agree', string>>>({})
  const [summary, setSummary] = useState<string | null>(null)
  const refs = useRef<Partial<Record<Field | 'agree', HTMLInputElement | null>>>({})

  function change(field: Field, value: string) {
    setValues((v) => ({ ...v, [field]: value }))
    setErrors((e) => ({ ...e, [field]: undefined }))
  }

  const idChecked = idCheck?.ok && idCheck.value === values.id.trim()
  const nicknameChecked = nicknameCheck?.ok && nicknameCheck.value === values.nickname.trim()

  function checkId() {
    const value = values.id.trim()
    if (!value) {
      setErrors((e) => ({ ...e, id: t('ID를 입력한 뒤 중복 확인을 눌러 주세요.') }))
      refs.current.id?.focus()
      return
    }
    setIdCheck({ value, ok: !isIdTaken(value) })
    setErrors((e) => ({ ...e, id: undefined }))
  }

  function checkNickname() {
    const value = values.nickname.trim()
    if (!value) {
      setErrors((e) => ({ ...e, nickname: t('닉네임을 입력한 뒤 중복 확인을 눌러 주세요.') }))
      refs.current.nickname?.focus()
      return
    }
    setNicknameCheck({ value, ok: !isNicknameTaken(value) })
    setErrors((e) => ({ ...e, nickname: undefined }))
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const next: typeof errors = {}

    // 1) 빈 칸부터 안내
    const empty = FIELD_ORDER.filter((f) => !values[f].trim())
    for (const f of empty) next[f] = t('{field} 칸이 비어 있습니다. 입력해 주세요.', { field: t(FIELD_LABELS[f]) })
    if (empty.length > 0) {
      setErrors(next)
      setSummary(t('비어 있는 칸이 있습니다: {fields}', { fields: empty.map((f) => t(FIELD_LABELS[f])).join(', ') }))
      refs.current[empty[0]]?.focus()
      return
    }

    // 2) 내용 확인
    if (!idChecked) next.id = idCheck?.value === values.id.trim() ? t('이미 사용 중인 ID입니다.') : t('ID 중복 확인을 해 주세요.')
    if (!nicknameChecked)
      next.nickname =
        nicknameCheck?.value === values.nickname.trim() ? t('이미 사용 중인 닉네임입니다.') : t('닉네임 중복 확인을 해 주세요.')
    if (values.password !== values.passwordConfirm) next.passwordConfirm = t('PW가 일치하지 않습니다.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) next.email = t('올바른 E-mail 주소를 입력해 주세요.')
    if (!agreed) next.agree = t('약관에 동의(체크)해야 회원가입이 가능합니다.')

    const first = ([...FIELD_ORDER, 'agree'] as const).find((f) => next[f])
    if (first) {
      setErrors(next)
      setSummary(t('입력한 내용을 확인해 주세요.'))
      refs.current[first]?.focus()
      return
    }

    const failure = await signUp({ id: values.id, nickname: values.nickname, email: values.email, password: values.password })
    if (failure) {
      setSummary(failure)
      return
    }
    onDone(values.id.trim())
  }

  function input(field: Field, props: { type?: string; autoComplete?: string; placeholder?: string }) {
    return (
      <input
        ref={(el) => {
          refs.current[field] = el
        }}
        id={`signup-${field}`}
        className={`auth-input ${errors[field] ? 'invalid' : ''}`}
        value={values[field]}
        onChange={(e) => change(field, e.target.value)}
        aria-invalid={!!errors[field]}
        {...props}
      />
    )
  }

  function feedback(field: 'id' | 'nickname', checked: boolean | undefined, check: Check, value: string) {
    if (errors[field]) return <p className="field-error">{errors[field]}</p>
    if (check && check.value === value.trim())
      return checked ? (
        <p className="field-ok">{t('사용할 수 있는 {field}입니다.', { field: t(FIELD_LABELS[field]) })}</p>
      ) : (
        <p className="field-error">{t('이미 사용 중인 {field}입니다.', { field: t(FIELD_LABELS[field]) })}</p>
      )
    return null
  }

  return (
    <section className="wizard auth-card">
      <h2 className="wizard-title">{t('회원가입')}</h2>
      {summary && <p className="notice error-notice">{summary}</p>}
      <form className="signup-form" onSubmit={submit} noValidate>
        <div className="signup-field">
          <label htmlFor="signup-id">ID</label>
          <div className="with-button">
            {input('id', { autoComplete: 'username', placeholder: 'ID' })}
            <button type="button" className="btn small" onClick={checkId}>
              {t('중복 확인')}
            </button>
          </div>
          {feedback('id', idChecked, idCheck, values.id)}
        </div>

        <div className="signup-field">
          <label htmlFor="signup-nickname">{t('닉네임')}</label>
          <div className="with-button">
            {input('nickname', { autoComplete: 'nickname', placeholder: t('닉네임') })}
            <button type="button" className="btn small" onClick={checkNickname}>
              {t('중복 확인')}
            </button>
          </div>
          {feedback('nickname', nicknameChecked, nicknameCheck, values.nickname)}
        </div>

        <div className="signup-field">
          <label htmlFor="signup-password">PW</label>
          {input('password', { type: 'password', autoComplete: 'new-password', placeholder: 'PW' })}
          {errors.password && <p className="field-error">{errors.password}</p>}
        </div>

        <div className="signup-field">
          <label htmlFor="signup-passwordConfirm">{t('PW 확인')}</label>
          {input('passwordConfirm', { type: 'password', autoComplete: 'new-password', placeholder: t('PW 다시 입력') })}
          {errors.passwordConfirm && <p className="field-error">{errors.passwordConfirm}</p>}
        </div>

        <div className="signup-field">
          <label htmlFor="signup-email">E-mail</label>
          {input('email', { type: 'email', autoComplete: 'email', placeholder: 'example@email.com' })}
          {errors.email && <p className="field-error">{errors.email}</p>}
        </div>

        <div className={`signup-agree ${errors.agree ? 'invalid' : ''}`}>
          <label>
            <input
              ref={(el) => {
                refs.current.agree = el
              }}
              type="checkbox"
              checked={agreed}
              onChange={(e) => {
                setAgreed(e.target.checked)
                setErrors((er) => ({ ...er, agree: undefined }))
              }}
            />
            {t('이용약관 및 개인정보 수집·이용에 동의합니다. (필수)')}
          </label>
          <p className={errors.agree ? 'field-error' : 'hint'}>
            {errors.agree ?? t('체크박스에 체크해야 회원가입이 가능합니다.')}
          </p>
        </div>

        <div className="wizard-nav">
          <button type="button" className="btn" onClick={onCancel}>
            {t('로그인으로 돌아가기')}
          </button>
          <button type="submit" className="btn primary">
            {t('회원가입')}
          </button>
        </div>
      </form>
    </section>
  )
}

const ICON_CHOICES = ['🙂', '😎', '🥰', '🤠', '🐶', '🐱', '🐻', '🐰', '🦊', '🐼', '✈️', '🧳', '🗺️', '🏖️', '⛰️', '🌸']

/** 올린 사진을 가운데 기준 정사각형 96px로 줄여 data URL로 (localStorage에 넣을 수 있게) */
function shrinkImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const size = 96
      const side = Math.min(img.width, img.height)
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      canvas.getContext('2d')?.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error(t('이미지를 읽지 못했습니다.')))
    }
    img.src = url
  })
}

type Message = { ok: boolean; text: string } | null

const SAVE_FAILED = '저장하지 못했습니다. 저장 공간이나 사생활 보호 설정을 확인해 주세요.'

/** 로그아웃은 헤더의 닉네임 메뉴에서 */
function AccountInfo({ user, onUserChange }: { user: SessionUser; onUserChange: (user: SessionUser) => void }) {
  // 골랐지만 아직 [확인]을 누르지 않은 아이콘 — 위쪽 프로필 아이콘 자리에 바로 보여 줌
  const [pendingIcon, setPendingIcon] = useState<string | null>(null)
  return (
    <section className="wizard auth-card">
      <h2 className="wizard-title">{t('계정 설정')}</h2>
      <NicknameEditor user={user} shownIcon={pendingIcon ?? user.icon} onUserChange={onUserChange} />
      <IconEditor user={user} pending={pendingIcon} onPendingChange={setPendingIcon} onUserChange={onUserChange} />
    </section>
  )
}

/** 닉네임 옆 [수정] → 입력·중복 확인 → [확인]으로 저장, [취소]로 되돌림 */
function NicknameEditor({
  user,
  shownIcon,
  onUserChange,
}: {
  user: SessionUser
  shownIcon?: string
  onUserChange: (user: SessionUser) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const [check, setCheck] = useState<Check>(null)
  const [message, setMessage] = useState<Message>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const value = draft?.trim() ?? ''
  const unchanged = value === user.nickname
  const checked = check?.ok && check.value === value

  function checkDuplicate() {
    if (!value) {
      setMessage({ ok: false, text: t('닉네임을 입력해 주세요.') })
      inputRef.current?.focus()
      return
    }
    if (unchanged) {
      setMessage({ ok: false, text: t('지금 쓰고 있는 닉네임과 같습니다.') })
      return
    }
    const ok = !isNicknameTaken(value, user.id)
    setCheck({ value, ok })
    setMessage(ok ? { ok: true, text: t('사용할 수 있는 닉네임입니다.') } : { ok: false, text: t('이미 사용 중인 닉네임입니다.') })
  }

  function confirm() {
    if (!value) {
      setMessage({ ok: false, text: t('닉네임을 입력해 주세요.') })
      inputRef.current?.focus()
      return
    }
    if (unchanged) {
      setDraft(null)
      setMessage(null)
      return
    }
    if (!checked) {
      setMessage({
        ok: false,
        text: check?.value === value ? t('이미 사용 중인 닉네임입니다.') : t('닉네임 중복 확인을 해 주세요.'),
      })
      return
    }
    const next = updateNickname(user, value)
    if (!next) {
      setMessage({ ok: false, text: t(SAVE_FAILED) })
      return
    }
    onUserChange(next)
    setDraft(null)
    setCheck(null)
    setMessage({ ok: true, text: t('닉네임을 바꿨습니다.') })
  }

  function cancel() {
    setDraft(null)
    setCheck(null)
    setMessage(null)
  }

  return (
    <div className="account-profile">
      <UserIcon icon={shownIcon} size="large" />
      <div className="account-main">
        {draft === null ? (
          <div className="account-nickname-row">
            <span className="account-nickname">{user.nickname}</span>
            <button
              type="button"
              className="btn small"
              onClick={() => {
                setDraft(user.nickname)
                setMessage(null)
              }}
            >
              {t('수정')}
            </button>
          </div>
        ) : (
          <div className="with-button">
            <input
              ref={inputRef}
              className={`auth-input ${message && !message.ok ? 'invalid' : ''}`}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value)
                setMessage(null)
              }}
              aria-label={t('새 닉네임')}
              autoFocus
            />
            <button type="button" className="btn small" onClick={checkDuplicate}>
              {t('중복 확인')}
            </button>
          </div>
        )}
        <div className="hint">ID: {user.id}</div>
        {message && <p className={message.ok ? 'field-ok' : 'field-error'}>{message.text}</p>}
        {draft !== null && (
          <div className="confirm-row">
            <button type="button" className="btn small primary" onClick={confirm}>
              {t('확인')}
            </button>
            <button type="button" className="btn small" onClick={cancel}>
              {t('취소')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/** 아이콘을 고르면 위쪽 아이콘 자리가 먼저 바뀌고, [확인]을 눌러야 저장. [취소]면 되돌림 */
function IconEditor({
  user,
  pending,
  onPendingChange: setPending,
  onUserChange,
}: {
  user: SessionUser
  pending: string | null
  onPendingChange: (icon: string | null) => void
  onUserChange: (user: SessionUser) => void
}) {
  const current = user.icon || DEFAULT_ICON
  const [message, setMessage] = useState<Message>(null)
  const shown = pending ?? current

  async function upload(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setMessage({ ok: false, text: t('이미지 파일만 올릴 수 있습니다.') })
      return
    }
    try {
      setPending(await shrinkImage(file))
      setMessage(null)
    } catch {
      setMessage({ ok: false, text: t('이미지를 읽지 못했습니다. 다른 파일로 시도해 주세요.') })
    }
  }

  function confirm() {
    if (!pending) return
    const next = updateIcon(user, pending)
    if (!next) {
      setMessage({ ok: false, text: t(SAVE_FAILED) })
      return
    }
    onUserChange(next)
    setPending(null)
    setMessage({ ok: true, text: t('아이콘을 바꿨습니다.') })
  }

  return (
    <div className="signup-field">
      <label>{t('프로필 아이콘')}</label>
      <div className="icon-grid" role="radiogroup" aria-label={t('프로필 아이콘')}>
        {ICON_CHOICES.map((icon) => (
          <button
            key={icon}
            type="button"
            role="radio"
            aria-checked={shown === icon}
            className={`icon-choice ${shown === icon ? 'selected' : ''}`}
            onClick={() => {
              setPending(icon === current ? null : icon)
              setMessage(null)
            }}
          >
            {icon}
          </button>
        ))}
      </div>
      <label className="btn small icon-upload">
        📷 {t('사진 올리기')}
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            upload(e.target.files?.[0])
            // 같은 파일을 다시 골라도 반영되게
            e.target.value = ''
          }}
          hidden
        />
      </label>
      {message && <p className={message.ok ? 'field-ok' : 'field-error'}>{message.text}</p>}
      {pending && (
        <div className="confirm-row">
          <button type="button" className="btn small primary" onClick={confirm}>
            {t('확인')}
          </button>
          <button
            type="button"
            className="btn small"
            onClick={() => {
              setPending(null)
              setMessage(null)
            }}
          >
            {t('취소')}
          </button>
        </div>
      )}
    </div>
  )
}
