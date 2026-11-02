// PLAN:J 메시지 푸시 알림 (Supabase Edge Function, Deno)
// 앱이 메시지를 보낸 직후 { messageId } 로 부르면, 대화 상대의 기기들로 Web Push 알림을 보낸다.
// 배포·설정 방법: docs/PUSH_SETUP.md
//
// 비밀 값 (Supabase → Edge Functions → Secrets):
//   VAPID_PUBLIC_KEY   Web Push 공개 키 (앱의 VITE_VAPID_PUBLIC_KEY 와 같은 값)
//   VAPID_PRIVATE_KEY  Web Push 비밀 키 — 여기에만 둠
//   VAPID_SUBJECT      (선택) 연락처 — mailto:주소 또는 https://사이트 주소
//   ALLOWED_ORIGINS    route-proxy 와 같은 허용 주소 목록 (이미 설정돼 있으면 그대로 씀)
// SUPABASE_URL · SUPABASE_ANON_KEY · SUPABASE_SERVICE_ROLE_KEY 는 Supabase가 자동으로 넣어 줌

import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') ?? ''
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'https://trabel-1.vercel.app'
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
/** 보낸 지 이만큼 지난 메시지는 알림을 보내지 않음 */
const MAX_AGE_MS = 2 * 60 * 1000
const PREVIEW_LENGTH = 80

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

type Message = {
  id: string
  conversation_id: string
  sender_id: string
  body: string
  photos: string[]
  trip: unknown
  deleted: boolean
  created_at: string
}

function preview(m: Message): string {
  if (m.body) return m.body.length > PREVIEW_LENGTH ? `${m.body.slice(0, PREVIEW_LENGTH)}…` : m.body
  if (m.trip) return '🗺️ 여행 일정을 보냈어요'
  if (m.photos.length) return '📷 사진을 보냈어요'
  return '새 메시지'
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin') ?? ''
  const allowed = ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin)
  const cors = {
    'Access-Control-Allow-Origin': allowed ? origin || '*' : 'null',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
  const reply = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (!allowed) return reply({ error: 'origin not allowed' }, 403)
  if (req.method !== 'POST') return reply({ error: 'POST only' }, 405)
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return reply({ error: 'VAPID keys not set' }, 503)

  let messageId: unknown
  try {
    messageId = (await req.json())?.messageId
  } catch {
    return reply({ error: 'invalid json' }, 400)
  }
  if (typeof messageId !== 'string') return reply({ error: 'messageId required' }, 400)

  // 부른 사람 권한으로 메시지를 읽음 — 대화에 들어 있지 않으면 RLS 때문에 안 보임
  const asCaller = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data: auth } = await asCaller.auth.getUser()
  const caller = auth.user
  if (!caller) return reply({ error: 'login required' }, 401)
  const { data: message } = await asCaller
    .from('dm_messages')
    .select('id, conversation_id, sender_id, body, photos, trip, deleted, created_at')
    .eq('id', messageId)
    .maybeSingle<Message>()
  if (!message || message.sender_id !== caller.id || message.deleted) return reply({ error: 'not found' }, 404)
  if (Date.now() - new Date(message.created_at).getTime() > MAX_AGE_MS) return reply({ error: 'too old' }, 409)

  // 여기부터는 서버 권한 (상대의 알림 구독 정보는 본인만 읽을 수 있어서)
  const admin = createClient(SUPABASE_URL, SERVICE_KEY)
  // 한 메시지에 알림은 한 번만 — 여러 번 불러도 처음 한 번만 보냄
  const { data: claimed } = await admin
    .from('dm_messages')
    .update({ pushed_at: new Date().toISOString() })
    .eq('id', message.id)
    .is('pushed_at', null)
    .select('id')
  if (!claimed?.length) return reply({ sent: 0, reason: 'already sent' })

  const { data: members } = await admin
    .from('dm_members')
    .select('user_id')
    .eq('conversation_id', message.conversation_id)
    .neq('user_id', caller.id)
  const recipients = (members ?? []).map((m) => m.user_id as string)
  if (!recipients.length) return reply({ sent: 0 })

  const [{ data: sender }, { data: subscriptions }] = await Promise.all([
    admin.from('profiles').select('nickname').eq('id', caller.id).maybeSingle<{ nickname: string }>(),
    admin.from('push_subscriptions').select('endpoint, p256dh, auth').in('user_id', recipients),
  ])

  const payload = JSON.stringify({
    title: sender?.nickname ?? 'PLAN:J',
    body: preview(message),
    // 알림을 누르면 이 대화로 (같은 대화의 알림은 하나로 합쳐짐)
    url: `/?dm=${message.conversation_id}`,
    tag: `dm-${message.conversation_id}`,
  })

  let sent = 0
  await Promise.all(
    (subscriptions ?? []).map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, {
          TTL: 24 * 60 * 60,
        })
        sent++
      } catch (err) {
        // 앱을 지웠거나 알림을 끈 기기 — 구독을 정리
        const status = (err as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) await admin.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
      }
    }),
  )
  return reply({ sent })
})
