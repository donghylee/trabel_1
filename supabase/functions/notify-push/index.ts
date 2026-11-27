// PLAN:J 활동 알림 (Supabase Edge Function, Deno) — dm-push와 같은 Web Push 방식
//   { kind: 'like', postId }       내 글에 좋아요 → 글쓴이 기기로 (앱이 좋아요를 누른 직후 부름)
//   { kind: 'comment', commentId } 내 글에 댓글 → 글쓴이 기기로 (앱이 댓글을 단 직후 부름)
//   { kind: 'reminders' }          보낼 때가 된 일정 10분 전 알림을 보냄 (pg_cron이 1분마다 부름)
// 배포·설정 방법: docs/PUSH_SETUP.md — 이 함수는 "Verify JWT"를 꺼야 함 (pg_cron은 로그인 없이 부름)
//
// 비밀 값은 dm-push와 같은 것을 씀 (Edge Functions → Secrets는 모든 함수가 함께 씀):
//   VAPID_PUBLIC_KEY · VAPID_PRIVATE_KEY · VAPID_SUBJECT(선택) · ALLOWED_ORIGINS

import webpush from 'npm:web-push@3.6.7'
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

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
/** 누른 지(단 지) 이만큼 지난 좋아요·댓글은 알리지 않음 */
const MAX_AGE_MS = 2 * 60 * 1000
/** 보낼 때보다 이만큼 늦어진 일정 알림은 버림 (서버가 잠시 멈췄다 돌아와도 엉뚱한 때 "10분 뒤" 알림이 가지 않게) */
const REMINDER_LATE_MS = 5 * 60 * 1000
const PREVIEW_LENGTH = 60

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

type Payload = { title: string; body: string; url: string; tag: string }

/** 그 사람의 모든 기기로 알림. ttl: 기기가 꺼져 있을 때 기다려 줄 시간(초) */
async function sendTo(admin: SupabaseClient, userId: string, payload: Payload, ttl: number): Promise<number> {
  const { data: subscriptions } = await admin.from('push_subscriptions').select('endpoint, p256dh, auth').eq('user_id', userId)
  let sent = 0
  await Promise.all(
    (subscriptions ?? []).map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), {
          TTL: ttl,
        })
        sent++
      } catch (err) {
        // 앱을 지웠거나 알림을 끈 기기 — 구독을 정리
        const status = (err as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) await admin.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
      }
    }),
  )
  return sent
}

/** 이 알림을 처음 보내는 거면 true (여러 번 불려도 한 번만) */
async function claim(admin: SupabaseClient, key: string): Promise<boolean> {
  const { data } = await admin.from('notify_log').upsert({ key }, { onConflict: 'key', ignoreDuplicates: true }).select('key')
  return !!data?.length
}

const fresh = (createdAt: string) => Date.now() - new Date(createdAt).getTime() <= MAX_AGE_MS

async function nickname(admin: SupabaseClient, userId: string): Promise<string> {
  const { data } = await admin.from('profiles').select('nickname').eq('id', userId).maybeSingle<{ nickname: string }>()
  return data?.nickname || '누군가'
}

/** 보낼 때가 된 일정 알림 — 지우면서 가져와서(한 줄은 한 번만) 보냄 */
async function sendReminders(admin: SupabaseClient): Promise<number> {
  const { data: due } = await admin
    .from('trip_reminders')
    .delete()
    .lte('fire_at', new Date().toISOString())
    .select('user_id, trip_id, fire_at, title, body, url')
  let sent = 0
  for (const r of due ?? []) {
    if (Date.now() - new Date(r.fire_at).getTime() > REMINDER_LATE_MS) continue
    // 같은 여행의 일정 알림은 하나로 겹쳐 보임 (새 알림이 이전 것을 바꿈)
    sent += await sendTo(admin, r.user_id, { title: r.title, body: r.body, url: r.url, tag: `trip-${r.trip_id}` }, 10 * 60)
  }
  return sent
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
  if (req.method !== 'POST') return reply({ error: 'POST only' }, 405)
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return reply({ error: 'VAPID keys not set' }, 503)

  let input: { kind?: unknown; postId?: unknown; commentId?: unknown }
  try {
    input = (await req.json()) ?? {}
  } catch {
    return reply({ error: 'invalid json' }, 400)
  }
  const admin = createClient(SUPABASE_URL, SERVICE_KEY)

  // pg_cron이 부름 (브라우저가 아니라 origin 없음). 누가 불러도 보낼 때가 된 알림만 나가므로 로그인 확인 없음
  if (input.kind === 'reminders') return reply({ sent: await sendReminders(admin) })

  if (!allowed) return reply({ error: 'origin not allowed' }, 403)
  // 부른 사람 확인 — 좋아요·댓글은 그 사람이 직접 남긴 것만
  const asCaller = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data: auth } = await asCaller.auth.getUser()
  const caller = auth.user
  if (!caller) return reply({ error: 'login required' }, 401)

  let postId: string
  let key: string
  let body: string
  if (input.kind === 'like' && typeof input.postId === 'string') {
    const { data: like } = await admin
      .from('likes')
      .select('post_id, created_at')
      .eq('post_id', input.postId)
      .eq('user_id', caller.id)
      .maybeSingle<{ post_id: string; created_at: string }>()
    if (!like) return reply({ error: 'not found' }, 404)
    if (!fresh(like.created_at)) return reply({ error: 'too old' }, 409)
    postId = like.post_id
    key = `like:${postId}:${caller.id}`
    body = `${await nickname(admin, caller.id)}님이 내 글에 좋아요를 눌렀어요 ❤️`
  } else if (input.kind === 'comment' && typeof input.commentId === 'string') {
    const { data: comment } = await admin
      .from('comments')
      .select('id, post_id, author_id, text, created_at')
      .eq('id', input.commentId)
      .maybeSingle<{ id: string; post_id: string; author_id: string; text: string; created_at: string }>()
    if (!comment || comment.author_id !== caller.id) return reply({ error: 'not found' }, 404)
    if (!fresh(comment.created_at)) return reply({ error: 'too old' }, 409)
    postId = comment.post_id
    key = `comment:${comment.id}`
    const text = comment.text.length > PREVIEW_LENGTH ? `${comment.text.slice(0, PREVIEW_LENGTH)}…` : comment.text
    body = `${await nickname(admin, caller.id)}님의 댓글: ${text}`
  } else {
    return reply({ error: 'kind must be like, comment or reminders' }, 400)
  }

  const { data: post } = await admin.from('posts').select('author_id').eq('id', postId).maybeSingle<{ author_id: string }>()
  // 내 글에 내가 남긴 건 알리지 않음
  if (!post || post.author_id === caller.id) return reply({ sent: 0 })
  if (!(await claim(admin, key))) return reply({ sent: 0, reason: 'already sent' })

  const sent = await sendTo(
    admin,
    post.author_id,
    // 같은 글의 알림은 하나로 겹쳐 보임. 누르면 마이페이지의 그 글로
    { title: 'PLAN:J', body, url: `/?post=${postId}`, tag: `post-${postId}` },
    24 * 60 * 60,
  )
  return reply({ sent })
})
