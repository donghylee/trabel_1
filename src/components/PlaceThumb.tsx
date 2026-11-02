import { useEffect, useState } from 'react'
import { placePhoto } from '../services/placePhotos'
import type { Place, PlaceCategory } from '../types'

/** 사진이 없을 때 대신 보여 줄 장소 종류 아이콘 */
const categoryIcons: Record<PlaceCategory, string> = {
  sight: '🏛️',
  museum: '🖼️',
  shopping: '🛍️',
  nature: '🌳',
  food: '🍜',
  cafe: '☕',
  lodging: '🏨',
}

/** 시간표 방문지 옆 작은 사진 (Wanderlog처럼) */
export default function PlaceThumb({ place }: { place: Place }) {
  const [photo, setPhoto] = useState<{ id: string; url: string | null } | null>(null)

  useEffect(() => {
    let cancelled = false
    placePhoto(place).then((url) => {
      if (!cancelled) setPhoto({ id: place.id, url })
    })
    return () => {
      cancelled = true
    }
  }, [place])

  const url = photo?.id === place.id ? photo.url : null
  return url ? (
    <img className="stop-thumb" src={url} alt="" loading="lazy" />
  ) : (
    <span className="stop-thumb" aria-hidden="true">
      {categoryIcons[place.category]}
    </span>
  )
}
