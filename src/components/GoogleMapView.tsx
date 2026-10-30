import { useEffect, useRef, useState } from 'react'
import { t } from '../i18n'
import { pathStyles } from '../lib/travel'
import { GOOGLE_MAP_ID, loadMaps, loadMarker } from '../services/google'
import { isAnchorMarker, type MapViewProps } from './mapTypes'

// Google 지도. .env.local 에 키가 있을 때 쓰인다. 마커 모양은 무료 지도와 같은 CSS(.map-pin)를 쓴다.

type Libs = {
  maps: google.maps.MapsLibrary
  marker: google.maps.MarkerLibrary
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

export default function GoogleMapView({
  center,
  markers,
  paths,
  focus,
  onMarkerClick,
  onMapClick,
  initialZoom = 13,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const libsRef = useRef<Libs | null>(null)
  const infoRef = useRef<google.maps.InfoWindow | null>(null)
  const drawnRef = useRef<{ markers: google.maps.marker.AdvancedMarkerElement[]; lines: google.maps.Polyline[] }>({
    markers: [],
    lines: [],
  })
  const markerById = useRef(new Map<string, { marker: google.maps.marker.AdvancedMarkerElement; html: string }>())
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // 핸들러가 바뀌어도 지도를 다시 만들지 않도록 ref로 보관
  const onMarkerClickRef = useRef(onMarkerClick)
  onMarkerClickRef.current = onMarkerClick
  const onMapClickRef = useRef(onMapClick)
  onMapClickRef.current = onMapClick

  // 지도는 한 번만 생성
  useEffect(() => {
    let cancelled = false
    Promise.all([loadMaps(), loadMarker()])
      .then(([maps, marker]) => {
        if (cancelled || !containerRef.current) return
        libsRef.current = { maps, marker }
        const map = new maps.Map(containerRef.current, {
          center,
          zoom: initialZoom,
          mapId: GOOGLE_MAP_ID,
          clickableIcons: true,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
        })
        map.addListener('click', (e: google.maps.MapMouseEvent | google.maps.IconMouseEvent) => {
          // Google 지도에 원래 있는 가게 아이콘을 눌렀을 때 기본 말풍선 대신 우리 동작
          if ('placeId' in e && e.placeId) e.stop()
          if (e.latLng) onMapClickRef.current?.({ lat: e.latLng.lat(), lng: e.latLng.lng() })
        })
        infoRef.current = new maps.InfoWindow()
        mapRef.current = map
        setReady(true)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : t('Google 지도를 불러오지 못했습니다.'))
      })
    return () => {
      cancelled = true
    }
    // center·initialZoom은 첫 화면 위치로만 사용
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 마커와 경로선 다시 그리기
  useEffect(() => {
    const map = mapRef.current
    const libs = libsRef.current
    if (!ready || !map || !libs) return
    for (const m of drawnRef.current.markers) m.map = null
    for (const l of drawnRef.current.lines) l.setMap(null)
    markerById.current.clear()

    const lines = paths.map((path) => {
      const style = pathStyles[path.mode]
      return new libs.maps.Polyline({
        map,
        path: path.points,
        strokeColor: style.color,
        strokeWeight: 5,
        // 점선은 선 자체를 숨기고 짧은 선분 아이콘을 반복해서 그림
        strokeOpacity: style.dashArray ? 0 : 0.85,
        icons: style.dashArray
          ? [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.9, strokeColor: style.color, scale: 3 }, offset: '0', repeat: '14px' }]
          : undefined,
      })
    })

    const drawn = markers.map((m) => {
      const variant = m.variant ?? 'stop'
      const content = document.createElement('div')
      content.className = `map-pin ${variant}`
      // 원 가운데가 좌표에 오도록 (기본은 아래쪽 가운데가 좌표)
      content.style.transform = 'translateY(50%)'
      const label = document.createElement('span')
      label.textContent = m.label
      content.appendChild(label)

      const marker = new libs.marker.AdvancedMarkerElement({
        map,
        position: m.position,
        content,
        title: m.title,
        zIndex: variant === 'candidate' ? 2000 : variant === 'poi' ? 0 : 1000,
        gmpClickable: true,
      })
      const html = `<strong>${escapeHtml(m.title)}</strong><br>${escapeHtml(m.subtitle)}`
      marker.addEventListener('gmp-click', () => {
        infoRef.current?.setContent(html)
        infoRef.current?.open({ map, anchor: marker })
        onMarkerClickRef.current(m.id)
      })
      markerById.current.set(m.id, { marker, html })
      return marker
    })

    drawnRef.current = { markers: drawn, lines }
  }, [ready, markers, paths])

  // 방문지가 바뀔 때만 지도 범위를 다시 맞춤
  const anchors = markers.filter(isAnchorMarker)
  const anchorKey = anchors.map((m) => `${m.id}@${m.position.lat},${m.position.lng}`).join('|')
  useEffect(() => {
    const map = mapRef.current
    const libs = libsRef.current
    if (!ready || !map || !libs || anchors.length === 0) return
    if (anchors.length === 1) {
      map.setCenter(anchors[0].position)
      map.setZoom(15)
      return
    }
    const lats = anchors.map((m) => m.position.lat)
    const lngs = anchors.map((m) => m.position.lng)
    map.fitBounds(
      { south: Math.min(...lats), north: Math.max(...lats), west: Math.min(...lngs), east: Math.max(...lngs) },
      48,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, anchorKey])

  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map || !focus) return
    const target = markerById.current.get(focus.id)
    if (!target?.marker.position) return
    map.panTo(target.marker.position)
    if ((map.getZoom() ?? 0) < 15) map.setZoom(15)
    infoRef.current?.setContent(target.html)
    infoRef.current?.open({ map, anchor: target.marker })
  }, [ready, focus])

  return (
    <div ref={containerRef} className="map-canvas">
      {error && <p className="map-error">{error}</p>}
    </div>
  )
}
