import { supabase } from '../services/supabase'

// 사진을 서버 저장소(Supabase Storage)에 올리고 공개 주소로 바꾼다.
// 글 사진은 'post-photos', 프로필 사진은 'avatars' 버킷. 파일은 {사용자 uuid}/ 폴더에만 올릴 수 있다 (supabase/schema.sql).
// 서버가 없으면 지금처럼 data URL을 그대로 쓴다.

export type PhotoBucket = 'post-photos' | 'avatars'

const isDataUrl = (value: string) => value.startsWith('data:')

/** data URL → 파일 내용 */
async function toBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob()
}

/** data URL 사진을 올리고 공개 주소를 돌려줌. 이미 주소이거나 서버가 없으면 그대로. 실패하면 null */
export async function uploadPhoto(bucket: PhotoBucket, userId: string, photo: string): Promise<string | null> {
  if (!supabase || !isDataUrl(photo)) return photo
  const blob = await toBlob(photo)
  const ext = blob.type === 'image/png' ? 'png' : 'jpg'
  const path = `${userId}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from(bucket).upload(path, blob, { contentType: blob.type, cacheControl: '31536000' })
  if (error) return null
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
}

/** 여러 장을 올림 — 한 장이라도 실패하면 null (이미 올린 것은 지움) */
export async function uploadPhotos(bucket: PhotoBucket, userId: string, photos: string[]): Promise<string[] | null> {
  const urls = await Promise.all(photos.map((photo) => uploadPhoto(bucket, userId, photo)))
  if (urls.every((url): url is string => url !== null)) return urls
  await deletePhotos(
    bucket,
    urls.filter((url): url is string => url !== null && !isDataUrl(url)),
  )
  return null
}

/** 공개 주소 → 버킷 안 경로 (우리 버킷 주소가 아니면 null) */
function pathOf(bucket: PhotoBucket, url: string): string | null {
  const marker = `/storage/v1/object/public/${bucket}/`
  const i = url.indexOf(marker)
  return i < 0 ? null : decodeURIComponent(url.slice(i + marker.length))
}

/** 올렸던 사진 지우기 (글을 지울 때·프로필 사진을 바꿀 때). 실패해도 화면 동작에는 영향 없음 */
export async function deletePhotos(bucket: PhotoBucket, urls: string[]): Promise<void> {
  if (!supabase) return
  const paths = urls.map((url) => pathOf(bucket, url)).filter((p): p is string => p !== null)
  if (paths.length) await supabase.storage.from(bucket).remove(paths)
}

/** 사진(이미지 주소)인지 — 아니면 이모지 아이콘 */
export const isPhoto = (icon: string) => isDataUrl(icon) || /^https?:\/\//.test(icon)
