import { config } from '../config'
import { isIos, isStandalone } from '../hooks/useInstallPrompt'
import { supabase } from '../services/supabase'

// 메시지 푸시 알림 (Web Push). 앱이 꺼져 있어도 폰 알림으로 "OO님이 메시지를 보냈어요".
// - 이 기기의 구독 정보를 push_subscriptions 테이블에 저장 → 메시지를 보내면 서버 함수(dm-push)가 알림을 보냄
// - 알림을 받아 띄우는 곳은 서비스 워커 (public/push-sw.js)
// - 아이폰은 홈 화면에 설치한 앱(iOS 16.4 이상)에서만 됨
// 설정 방법: docs/PUSH_SETUP.md

export type PushStatus =
  /** 서버·키가 없거나 이 브라우저가 알림을 지원하지 않음 */
  | 'unsupported'
  /** 아이폰 Safari — 홈 화면에 설치해야 알림을 받을 수 있음 */
  | 'needs-install'
  /** 알림을 막아 둠 (브라우저·폰 설정에서 풀어야 함) */
  | 'denied'
  | 'off'
  | 'on'

function supported(): boolean {
  return (
    !!supabase &&
    !!config.vapidPublicKey &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

/** VAPID 공개 키(base64url) → 구독에 넘길 바이트 */
function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration()
  return (await registration?.pushManager.getSubscription()) ?? null
}

/** 구독 정보를 지금 로그인한 계정으로 서버에 저장 */
async function saveSubscription(subscription: PushSubscription): Promise<boolean> {
  if (!supabase) return false
  const json = subscription.toJSON()
  const { error } = await supabase.rpc('dm_save_push', {
    p_endpoint: subscription.endpoint,
    p_p256dh: json.keys?.p256dh ?? '',
    p_auth: json.keys?.auth ?? '',
  })
  return !error
}

export async function pushStatus(): Promise<PushStatus> {
  if (isIos() && !isStandalone() && !!supabase && !!config.vapidPublicKey) return 'needs-install'
  if (!supported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  if (Notification.permission !== 'granted') return 'off'
  return (await currentSubscription()) ? 'on' : 'off'
}

/** [알림 켜기] — 권한을 묻고 이 기기를 구독. 결과 상태를 돌려줌 */
export async function enablePush(): Promise<PushStatus> {
  if (!supported()) return pushStatus()
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return pushStatus()
  try {
    const registration = await navigator.serviceWorker.ready
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(config.vapidPublicKey!) }))
    if (!(await saveSubscription(subscription))) return 'off'
  } catch {
    return 'off'
  }
  return 'on'
}

/** [알림 끄기] / 로그아웃 — 이 기기로 더는 알림이 오지 않게 (로그인한 동안에 불러야 서버에서 지워짐) */
export async function disablePush(): Promise<void> {
  if (!supported()) return
  const subscription = await currentSubscription()
  if (!subscription) return
  await supabase?.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint)
  await subscription.unsubscribe().catch(() => false)
}

/** 로그인할 때 — 이 기기가 이미 알림을 켜 두었으면 지금 계정으로 다시 연결 */
export async function syncPush(): Promise<void> {
  if (!supported() || Notification.permission !== 'granted') return
  const subscription = await currentSubscription()
  if (subscription) await saveSubscription(subscription)
}
