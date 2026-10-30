// 회원 정보도 아직 서버가 없어서 이 브라우저(localStorage)에만 보관한다.
// 서버를 붙이면 이 파일의 함수 안쪽만 API 호출로 바꾸면 된다.
// 비밀번호는 그대로 두지 않고 SHA-256 해시로만 저장한다.

import { t } from '../i18n'

const USERS_KEY = 'trip-route-planner:users:v1'
const SESSION_KEY = 'trip-route-planner:session:v1'

// 프로필 아이콘: 이모지 한 글자, 또는 올린 사진(작게 줄인 data URL). 없으면 기본 아이콘
export type User = { id: string; nickname: string; email: string; passwordHash: string; createdAt: string; icon?: string }
export type SessionUser = { id: string; nickname: string; icon?: string }

export const DEFAULT_ICON = '🙂'

function loadUsers(): User[] {
  try {
    const raw = localStorage.getItem(USERS_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? (parsed as User[]) : []
  } catch {
    return []
  }
}

async function hash(password: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password))
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('')
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

export function isIdTaken(id: string): boolean {
  return loadUsers().some((u) => same(u.id, id))
}

/** exceptId: 닉네임을 바꿀 때 내 계정은 빼고 확인 */
export function isNicknameTaken(nickname: string, exceptId?: string): boolean {
  return loadUsers().some((u) => same(u.nickname, nickname) && !(exceptId && same(u.id, exceptId)))
}

/** 가입에 성공하면 null, 실패하면 이유 */
export async function signUp(input: { id: string; nickname: string; email: string; password: string }): Promise<string | null> {
  if (isIdTaken(input.id)) return t('이미 사용 중인 ID입니다.')
  if (isNicknameTaken(input.nickname)) return t('이미 사용 중인 닉네임입니다.')
  const user: User = {
    id: input.id.trim(),
    nickname: input.nickname.trim(),
    email: input.email.trim(),
    passwordHash: await hash(input.password),
    createdAt: new Date().toISOString(),
  }
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify([...loadUsers(), user]))
    return null
  } catch {
    return t('이 브라우저에 저장하지 못했습니다. 저장 공간이나 사생활 보호 설정을 확인해 주세요.')
  }
}

/** ID·비밀번호가 맞으면 로그인한 사용자, 아니면 null */
export async function logIn(id: string, password: string): Promise<SessionUser | null> {
  const user = loadUsers().find((u) => same(u.id, id))
  if (!user || user.passwordHash !== (await hash(password))) return null
  const session: SessionUser = { id: user.id, nickname: user.nickname, icon: user.icon }
  saveSession(session)
  return session
}

function saveSession(session: SessionUser) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
    // 저장 못 해도 이번 방문 동안은 로그인 상태 유지
  }
}

/** 내 계정 정보 일부(아이콘·닉네임)를 바꾸고 바뀐 로그인 정보를 돌려줌. 저장에 실패하면 null */
function updateProfile(session: SessionUser, change: Pick<User, 'icon'> | Pick<User, 'nickname'>): SessionUser | null {
  try {
    const users = loadUsers().map((u) => (same(u.id, session.id) ? { ...u, ...change } : u))
    localStorage.setItem(USERS_KEY, JSON.stringify(users))
  } catch {
    return null
  }
  const next = { ...session, ...change }
  saveSession(next)
  return next
}

export function updateIcon(session: SessionUser, icon: string): SessionUser | null {
  return updateProfile(session, { icon })
}

export function updateNickname(session: SessionUser, nickname: string): SessionUser | null {
  return updateProfile(session, { nickname: nickname.trim() })
}

export function logOut() {
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch {
    // 무시
  }
}

export function loadSession(): SessionUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as SessionUser) : null
  } catch {
    return null
  }
}
