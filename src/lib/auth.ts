// 회원·로그인. 이메일 + 비밀번호로 로그인한다.
// - 서버(Supabase) 키가 있으면 Supabase Auth — 비밀번호는 서버만 알고, 닉네임·아이콘은 profiles 테이블
// - 키가 없으면 지금처럼 이 브라우저(localStorage)에만 보관 (비밀번호는 SHA-256 해시로만 저장)
// 화면은 이 파일의 함수만 부르므로 어느 쪽이든 똑같이 동작한다.

import { t } from '../i18n'
import { supabase } from '../services/supabase'
import { deletePhotos, uploadPhoto } from './photos'

const USERS_KEY = 'trip-route-planner:users:v1'
const SESSION_KEY = 'trip-route-planner:session:v1'

// 프로필 아이콘: 이모지 한 글자, 또는 올린 사진(작게 줄인 data URL). 없으면 기본 아이콘
type LocalUser = { id: string; nickname: string; email: string; passwordHash: string; createdAt: string; icon?: string }
/** id는 계정 고유 번호 (서버: Supabase 사용자 uuid, 브라우저 저장: 가입할 때 만든 값) — 여행 주인·글쓴이 표시에 씀 */
export type SessionUser = { id: string; nickname: string; email: string; icon?: string }

export const DEFAULT_ICON = '🙂'

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

// ── 브라우저 저장 (서버가 없을 때) ──────────────────────────────

function loadUsers(): LocalUser[] {
  try {
    const raw = localStorage.getItem(USERS_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? (parsed as LocalUser[]) : []
  } catch {
    return []
  }
}

function saveUsers(users: LocalUser[]): boolean {
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(users))
    return true
  } catch {
    return false
  }
}

async function hash(password: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password))
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('')
}

/** 로그인 상태를 기억해 두는 곳 — 서버를 쓸 때도 새로고침 직후 바로 닉네임을 보여 주려고 함께 씀 */
function saveSession(session: SessionUser | null) {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    else localStorage.removeItem(SESSION_KEY)
  } catch {
    // 저장 못 해도 이번 방문 동안은 로그인 상태 유지
  }
}

// ── 서버(Supabase) ──────────────────────────────────────────────

type Profile = { id: string; nickname: string; icon: string | null }

async function loadProfile(userId: string, email: string): Promise<SessionUser | null> {
  if (!supabase) return null
  const { data } = await supabase.from('profiles').select('id, nickname, icon').eq('id', userId).maybeSingle<Profile>()
  return data ? { id: data.id, nickname: data.nickname, email, icon: data.icon ?? undefined } : null
}

/** LIKE 검색의 특수 문자(% _ \)를 글자 그대로 찾게 */
const escapeLike = (text: string) => text.replace(/[\\%_]/g, (c) => `\\${c}`)

// ── 화면에서 쓰는 함수 ──────────────────────────────────────────

/** exceptId: 닉네임을 바꿀 때 내 계정은 빼고 확인 */
export async function isNicknameTaken(nickname: string, exceptId?: string): Promise<boolean> {
  const value = nickname.trim()
  if (supabase) {
    let query = supabase.from('profiles').select('id', { count: 'exact', head: true }).ilike('nickname', escapeLike(value))
    if (exceptId) query = query.neq('id', exceptId)
    const { count, error } = await query
    // 확인을 못 하면 가입 단계에서 서버가 다시 막으므로 일단 사용 가능으로
    return !error && (count ?? 0) > 0
  }
  return loadUsers().some((u) => same(u.nickname, value) && u.id !== exceptId)
}

/** 가입에 성공하면 null, 실패하면 이유 */
export async function signUp(input: { email: string; nickname: string; password: string }): Promise<string | null> {
  const email = input.email.trim()
  const nickname = input.nickname.trim()
  if (supabase) {
    // profiles.username(고유)은 로그인에 쓰지 않으므로 겹치지 않는 값을 만들어 넣음
    const username = `u_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
    const { error } = await supabase.auth.signUp({
      email,
      password: input.password,
      options: { data: { nickname, username } },
    })
    // 가입하면 바로 로그인 상태가 되지만, 화면 흐름(가입 → 로그인)을 지금처럼 맞추려고 로그아웃
    if (!error) await supabase.auth.signOut()
    return error ? signUpErrorText(error.code, error.message) : null
  }
  if (loadUsers().some((u) => same(u.email, email))) return t('이미 가입된 E-mail입니다.')
  if (await isNicknameTaken(nickname)) return t('이미 사용 중인 닉네임입니다.')
  const user: LocalUser = {
    id: `u-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    nickname,
    email,
    passwordHash: await hash(input.password),
    createdAt: new Date().toISOString(),
  }
  return saveUsers([...loadUsers(), user])
    ? null
    : t('이 브라우저에 저장하지 못했습니다. 저장 공간이나 사생활 보호 설정을 확인해 주세요.')
}

function signUpErrorText(code: string | undefined, message: string): string {
  if (code === 'user_already_exists' || /already registered/i.test(message)) return t('이미 가입된 E-mail입니다.')
  if (code === 'weak_password' || /password/i.test(message)) return t('PW는 6자 이상으로 입력해 주세요.')
  if (code === 'email_address_invalid' || /email/i.test(message)) return t('올바른 E-mail 주소를 입력해 주세요.')
  // 닉네임이 겹치면 profiles를 만드는 단계에서 막힘
  if (/database error/i.test(message)) return t('이미 사용 중인 닉네임입니다.')
  if (code === 'over_email_send_rate_limit' || /rate limit/i.test(message))
    return t('잠시 후 다시 시도해 주세요. (가입 요청이 너무 많습니다)')
  return t('회원가입에 실패했습니다. 잠시 후 다시 시도해 주세요.')
}

/** E-mail·비밀번호가 맞으면 로그인한 사용자, 아니면 null */
export async function logIn(email: string, password: string): Promise<SessionUser | null> {
  if (supabase) {
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error || !data.user) return null
    const session = await loadProfile(data.user.id, data.user.email ?? email.trim())
    saveSession(session)
    return session
  }
  const user = loadUsers().find((u) => same(u.email, email))
  if (!user || user.passwordHash !== (await hash(password))) return null
  const session: SessionUser = { id: user.id, nickname: user.nickname, email: user.email, icon: user.icon }
  saveSession(session)
  return session
}

/** 내 계정 정보 일부(아이콘·닉네임)를 바꾸고 바뀐 로그인 정보를 돌려줌. 저장에 실패하면 null */
async function updateProfile(
  session: SessionUser,
  change: { icon: string } | { nickname: string },
): Promise<SessionUser | null> {
  if (supabase) {
    const { error } = await supabase.from('profiles').update(change).eq('id', session.id)
    if (error) return null
  } else if (!saveUsers(loadUsers().map((u) => (u.id === session.id ? { ...u, ...change } : u)))) {
    return null
  }
  const next = { ...session, ...change }
  saveSession(next)
  return next
}

export async function updateIcon(session: SessionUser, icon: string): Promise<SessionUser | null> {
  // 서버를 쓰면 올린 사진은 저장소(avatars)에 올리고 주소만 저장, 예전 사진은 지움
  const stored = await uploadPhoto('avatars', session.id, icon)
  if (!stored) return null
  const next = await updateProfile(session, { icon: stored })
  if (next && session.icon && session.icon !== stored) void deletePhotos('avatars', [session.icon])
  return next
}

export function updateNickname(session: SessionUser, nickname: string): Promise<SessionUser | null> {
  return updateProfile(session, { nickname: nickname.trim() })
}

export async function logOut() {
  saveSession(null)
  await supabase?.auth.signOut()
}

/** 새로고침 직후 바로 쓰는 마지막 로그인 정보 (서버를 쓰면 watchSession이 곧 확인해서 바로잡음) */
export function loadSession(): SessionUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    const parsed = raw ? (JSON.parse(raw) as Partial<SessionUser>) : null
    // 예전 형식(email 없음)이거나 서버 계정이 아닌 기억은 버림
    if (!parsed?.id || !parsed.nickname || typeof parsed.email !== 'string') return null
    return parsed as SessionUser
  } catch {
    return null
  }
}

/**
 * 서버를 쓸 때: 저장된 로그인이 아직 유효한지 확인하고, 다른 탭에서 로그아웃하거나 만료되면 알려 줌.
 * 돌려준 함수를 부르면 그만 지켜봄. 서버가 없으면 아무것도 하지 않음.
 */
export function watchSession(onChange: (user: SessionUser | null) => void): () => void {
  if (!supabase) return () => {}
  const client = supabase
  const sync = async (userId: string | undefined, email: string | undefined) => {
    const session = userId ? await loadProfile(userId, email ?? '') : null
    saveSession(session)
    onChange(session)
  }
  client.auth.getSession().then(({ data }) => sync(data.session?.user.id, data.session?.user.email))
  const { data } = client.auth.onAuthStateChange((event, session) => {
    // 로그인 직후는 logIn이 이미 처리 — 로그아웃·만료·다른 탭에서 바뀐 경우만.
    // 이 콜백 안에서 바로 서버를 부르면 멈출 수 있어(Supabase 안내) 한 박자 뒤에
    if (event === 'SIGNED_OUT') setTimeout(() => sync(undefined, undefined))
    else if (event === 'USER_UPDATED') setTimeout(() => sync(session?.user.id, session?.user.email))
  })
  return () => data.subscription.unsubscribe()
}
