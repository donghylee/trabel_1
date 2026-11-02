import { t } from '../i18n'
import { supabase } from '../services/supabase'
import type { DmMessage, DmThread, DmUser, SavedTrip } from '../types'
import type { SessionUser } from './auth'

// 다이렉트 메시지(1:1 대화).
// - 서버(Supabase)를 쓰면 dm_* 테이블 + 비공개 사진 버킷 dm-photos + 실시간 (supabase/migrations/004_direct_messages.sql)
//   새 메시지를 보내면 상대 기기로 푸시 알림 (supabase/functions/dm-push)
// - 아니면 이 브라우저(localStorage)에 — 같은 브라우저의 다른 계정끼리만 주고받음 (서버 없이 화면을 확인하는 용도)
// 화면은 이 파일의 함수만 부르므로 어느 쪽이든 똑같이 동작한다.

export type NewDm = { body: string; photos: string[]; trip?: SavedTrip }

export const MAX_DM_PHOTOS = 4
export const MAX_DM_LENGTH = 2000

const meOf = (user: SessionUser): DmUser => ({ id: user.id, nickname: user.nickname, icon: user.icon ?? '' })

// ── 브라우저 저장 (서버가 없을 때) ──────────────────────────────

const STORAGE_KEY = 'trip-route-planner:dm:v1'
/** 같은 탭 안에서 바뀌었음을 알리는 이벤트 (다른 탭은 storage 이벤트) */
const LOCAL_EVENT = 'planj-dm-change'

type LocalMember = { user: DmUser; lastReadAt: string; hiddenBefore?: string }
type LocalStore = { conversations: { id: string; members: LocalMember[] }[]; messages: DmMessage[] }

function loadLocal(): LocalStore {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as LocalStore | null
    if (parsed && Array.isArray(parsed.conversations) && Array.isArray(parsed.messages)) return parsed
  } catch {
    // 읽지 못하면 빈 메시지함
  }
  return { conversations: [], messages: [] }
}

function saveLocal(store: LocalStore): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
    window.dispatchEvent(new Event(LOCAL_EVENT))
    return true
  } catch {
    return false
  }
}

const now = () => new Date().toISOString()
const visibleTo = (member: LocalMember) => (m: DmMessage) => !member.hiddenBefore || m.createdAt > member.hiddenBefore

// ── 서버(Supabase) ──────────────────────────────────────────────

type InboxRow = {
  conversation_id: string
  other_id: string
  other_nickname: string
  other_icon: string | null
  last_body: string
  last_photo_count: number
  last_has_trip: boolean
  last_deleted: boolean
  last_sender: string
  last_at: string
  unread: number
}

type MessageRow = {
  id: string
  conversation_id: string
  sender_id: string
  body: string
  photos: string[]
  trip: SavedTrip | null
  deleted: boolean
  created_at: string
}

const MESSAGE_COLUMNS = 'id, conversation_id, sender_id, body, photos, trip, deleted, created_at'

const toMessage = (r: MessageRow): DmMessage => ({
  id: r.id,
  conversationId: r.conversation_id,
  senderId: r.sender_id,
  body: r.body,
  photos: r.photos ?? [],
  trip: r.trip ?? undefined,
  deleted: r.deleted,
  createdAt: r.created_at,
})

const PHOTO_BUCKET = 'dm-photos'
/** 사진을 보여 줄 때 쓰는 잠깐 주소의 유효 시간 */
const PHOTO_URL_SECONDS = 60 * 60

async function uploadDmPhotos(conversationId: string, photos: string[]): Promise<string[] | null> {
  if (!supabase) return photos
  const client = supabase
  const paths = await Promise.all(
    photos.map(async (photo) => {
      const blob = await (await fetch(photo)).blob()
      const path = `${conversationId}/${crypto.randomUUID()}.${blob.type === 'image/png' ? 'png' : 'jpg'}`
      const { error } = await client.storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: blob.type })
      return error ? null : path
    }),
  )
  if (paths.every((p): p is string => p !== null)) return paths
  // 한 장이라도 실패하면 올린 것도 지우고 보내지 않음
  const uploaded = paths.filter((p): p is string => p !== null)
  if (uploaded.length) await client.storage.from(PHOTO_BUCKET).remove(uploaded)
  return null
}

// ── 화면에서 쓰는 함수 ──────────────────────────────────────────

/** 메시지함 목록 (최근 대화가 앞). 실패하면 null */
export async function fetchInbox(user: SessionUser): Promise<DmThread[] | null> {
  if (supabase) {
    const { data, error } = await supabase.rpc('dm_inbox')
    if (error || !data) return null
    return (data as InboxRow[]).map((r) => ({
      id: r.conversation_id,
      other: { id: r.other_id, nickname: r.other_nickname, icon: r.other_icon ?? '' },
      last: {
        body: r.last_body,
        photoCount: r.last_photo_count,
        hasTrip: r.last_has_trip,
        deleted: r.last_deleted,
        senderId: r.last_sender,
        at: r.last_at,
      },
      unread: Number(r.unread),
    }))
  }
  const store = loadLocal()
  return store.conversations
    .flatMap((c): DmThread[] => {
      const me = c.members.find((m) => m.user.id === user.id)
      const other = c.members.find((m) => m.user.id !== user.id)
      if (!me || !other) return []
      const messages = store.messages.filter((m) => m.conversationId === c.id).filter(visibleTo(me))
      const last = messages[messages.length - 1]
      if (!last) return []
      return [
        {
          id: c.id,
          other: other.user,
          last: {
            body: last.body,
            photoCount: last.photos.length,
            hasTrip: !!last.trip,
            deleted: last.deleted,
            senderId: last.senderId,
            at: last.createdAt,
          },
          unread: messages.filter((m) => m.senderId !== user.id && !m.deleted && m.createdAt > me.lastReadAt).length,
        },
      ]
    })
    .sort((a, b) => b.last.at.localeCompare(a.last.at))
}

/** 상대와의 대화방 id (없으면 만듦). 실패하면 null */
export async function openConversation(user: SessionUser, other: DmUser): Promise<string | null> {
  if (other.id === user.id) return null
  if (supabase) {
    const { data, error } = await supabase.rpc('dm_open', { other: other.id })
    return error ? null : (data as string)
  }
  const store = loadLocal()
  const found = store.conversations.find(
    (c) => c.members.some((m) => m.user.id === user.id) && c.members.some((m) => m.user.id === other.id),
  )
  if (found) return found.id
  const id = crypto.randomUUID()
  const at = now()
  store.conversations.push({ id, members: [{ user: meOf(user), lastReadAt: at }, { user: other, lastReadAt: at }] })
  return saveLocal(store) ? id : null
}

/** 대화 상대와 메시지 (오래된 것이 앞). 내가 [대화 삭제]한 전 메시지는 빠짐. 실패하면 null */
export async function fetchConversation(
  user: SessionUser,
  conversationId: string,
): Promise<{ other: DmUser; messages: DmMessage[] } | null> {
  if (supabase) {
    const { data: members, error } = await supabase
      .from('dm_members')
      .select('user_id, hidden_before, profiles(nickname, icon)')
      .eq('conversation_id', conversationId)
    if (error || !members) return null
    type MemberRow = { user_id: string; hidden_before: string | null; profiles: { nickname: string; icon: string | null } | null }
    const rows = members as unknown as MemberRow[]
    const me = rows.find((m) => m.user_id === user.id)
    const other = rows.find((m) => m.user_id !== user.id)
    if (!me || !other) return null
    let query = supabase
      .from('dm_messages')
      .select(MESSAGE_COLUMNS)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
    if (me.hidden_before) query = query.gt('created_at', me.hidden_before)
    const { data, error: messageError } = await query
    if (messageError || !data) return null
    return {
      other: { id: other.user_id, nickname: other.profiles?.nickname ?? '', icon: other.profiles?.icon ?? '' },
      messages: (data as MessageRow[]).map(toMessage),
    }
  }
  const store = loadLocal()
  const conversation = store.conversations.find((c) => c.id === conversationId)
  const me = conversation?.members.find((m) => m.user.id === user.id)
  const other = conversation?.members.find((m) => m.user.id !== user.id)
  if (!me || !other) return null
  return { other: other.user, messages: store.messages.filter((m) => m.conversationId === conversationId).filter(visibleTo(me)) }
}

/** 메시지 보내기 — 사진(data URL)은 먼저 올림. 실패하면 null */
export async function sendMessage(user: SessionUser, conversationId: string, message: NewDm): Promise<DmMessage | null> {
  const body = message.body.trim().slice(0, MAX_DM_LENGTH)
  const photos = message.photos.slice(0, MAX_DM_PHOTOS)
  if (!body && !photos.length && !message.trip) return null
  if (supabase) {
    const client = supabase
    const paths = await uploadDmPhotos(conversationId, photos)
    if (!paths) return null
    const { data, error } = await client
      .from('dm_messages')
      .insert({ conversation_id: conversationId, sender_id: user.id, body, photos: paths, trip: message.trip ?? null })
      .select(MESSAGE_COLUMNS)
      .single()
    if (error || !data) {
      if (paths.length) void client.storage.from(PHOTO_BUCKET).remove(paths)
      return null
    }
    const saved = toMessage(data as MessageRow)
    // 상대 기기로 푸시 알림 — 알림이 실패해도 메시지는 이미 보내짐
    void client.functions.invoke('dm-push', { body: { messageId: saved.id } }).catch(() => {})
    return saved
  }
  const store = loadLocal()
  const saved: DmMessage = {
    id: crypto.randomUUID(),
    conversationId,
    senderId: user.id,
    body,
    photos,
    trip: message.trip,
    deleted: false,
    createdAt: now(),
  }
  store.messages.push(saved)
  const me = store.conversations.find((c) => c.id === conversationId)?.members.find((m) => m.user.id === user.id)
  if (me) me.lastReadAt = saved.createdAt
  return saveLocal(store) ? saved : null
}

/** 내가 보낸 메시지 지우기 ("삭제된 메시지입니다"로 바뀜, 사진 파일도 지움). 성공하면 true */
export async function deleteMessage(user: SessionUser, message: DmMessage): Promise<boolean> {
  if (message.senderId !== user.id) return false
  if (supabase) {
    const { data, error } = await supabase.rpc('dm_delete_message', { message: message.id })
    if (error || data === null) return false
    const removed = (data as string[] | null) ?? []
    if (removed.length) void supabase.storage.from(PHOTO_BUCKET).remove(removed)
    return true
  }
  const store = loadLocal()
  const target = store.messages.find((m) => m.id === message.id)
  if (!target) return false
  Object.assign(target, { deleted: true, body: '', photos: [], trip: undefined })
  return saveLocal(store)
}

/** 이 대화를 다 읽음으로 */
export async function markRead(user: SessionUser, conversationId: string): Promise<void> {
  if (supabase) {
    await supabase.rpc('dm_mark_read', { conversation: conversationId })
    return
  }
  const store = loadLocal()
  const me = store.conversations.find((c) => c.id === conversationId)?.members.find((m) => m.user.id === user.id)
  // 새로 읽을 것이 없으면 저장하지 않음 (저장하면 바뀜 알림 → 다시 읽음 표시로 계속 도는 것을 막음)
  const unread = store.messages.some((m) => m.conversationId === conversationId && m.senderId !== user.id && m.createdAt > (me?.lastReadAt ?? ''))
  if (!me || !unread) return
  me.lastReadAt = now()
  saveLocal(store)
}

/** 대화 삭제 — 나에게서만 지금까지의 메시지를 숨김 (상대 쪽은 그대로, 새 메시지가 오면 다시 나타남) */
export async function hideConversation(user: SessionUser, conversationId: string): Promise<boolean> {
  if (supabase) {
    const { error } = await supabase.rpc('dm_hide', { conversation: conversationId })
    return !error
  }
  const store = loadLocal()
  const me = store.conversations.find((c) => c.id === conversationId)?.members.find((m) => m.user.id === user.id)
  if (!me) return false
  me.hiddenBefore = me.lastReadAt = now()
  return saveLocal(store)
}

/**
 * 메시지가 오거나 지워지면 알려 줌 (어느 대화인지). 돌려준 함수를 부르면 그만 지켜봄.
 * 서버: 실시간(Realtime) — RLS가 적용돼 내 대화의 메시지만 옴
 */
export function watchMessages(user: SessionUser, onChange: (conversationId: string | null) => void): () => void {
  if (supabase) {
    const client = supabase
    const channel = client
      .channel(`dm:${user.id}:${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dm_messages' }, (payload) => {
        const row = (payload.new ?? payload.old) as Partial<MessageRow> | undefined
        onChange(row?.conversation_id ?? null)
      })
      .subscribe()
    return () => void client.removeChannel(channel)
  }
  const notify = () => onChange(null)
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) notify()
  }
  window.addEventListener(LOCAL_EVENT, notify)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(LOCAL_EVENT, notify)
    window.removeEventListener('storage', onStorage)
  }
}

/** 메시지 사진을 화면에 보여 줄 주소로 (서버: 1시간짜리 서명 주소). 못 바꾼 사진은 빠짐 */
export async function photoUrls(paths: string[]): Promise<Record<string, string>> {
  if (!supabase || !paths.length) return Object.fromEntries(paths.map((p) => [p, p]))
  const { data } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(paths, PHOTO_URL_SECONDS)
  return Object.fromEntries((data ?? []).flatMap((d) => (d.path && d.signedUrl ? [[d.path, d.signedUrl]] : [])))
}

/** 목록·알림에 보일 한 줄 요약 */
export function previewOf(last: { body: string; photoCount: number; hasTrip: boolean; deleted: boolean }): string {
  if (last.deleted) return t('삭제된 메시지입니다.')
  if (last.body) return last.body
  if (last.hasTrip) return t('🗺️ 여행 일정')
  if (last.photoCount) return t('📷 사진')
  return ''
}
