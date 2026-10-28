import type { LatLng } from '../types'

/** Google 인코딩 폴리라인 → 좌표 목록 (https://developers.google.com/maps/documentation/utilities/polylinealgorithm) */
export function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = []
  let index = 0
  let lat = 0
  let lng = 0
  while (index < encoded.length) {
    for (const axis of ['lat', 'lng'] as const) {
      let shift = 0
      let result = 0
      let byte: number
      do {
        byte = encoded.charCodeAt(index++) - 63
        result |= (byte & 0x1f) << shift
        shift += 5
      } while (byte >= 0x20)
      const delta = result & 1 ? ~(result >> 1) : result >> 1
      if (axis === 'lat') lat += delta
      else lng += delta
    }
    points.push({ lat: lat / 1e5, lng: lng / 1e5 })
  }
  return points
}
