import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef } from 'react'
import { pathStyles } from '../lib/travel'
import { isAnchorMarker, type MapViewProps } from './mapTypes'

// 무료 지도(Leaflet + OpenStreetMap). Google 키가 없을 때 쓰인다.

export default function LeafletMapView({
  center,
  markers,
  paths,
  focus,
  onMarkerClick,
  onMapClick,
  initialZoom = 13,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)
  const markerRefs = useRef(new Map<string, L.Marker>())
  // 마커 클릭 핸들러가 바뀌어도 지도를 다시 그리지 않도록 ref로 보관
  const onMarkerClickRef = useRef(onMarkerClick)
  onMarkerClickRef.current = onMarkerClick
  const onMapClickRef = useRef(onMapClick)
  onMapClickRef.current = onMapClick

  // 지도는 한 번만 생성
  useEffect(() => {
    const map = L.map(containerRef.current!, { zoomControl: true }).setView([center.lat, center.lng], initialZoom)
    map.on('click', (e: L.LeafletMouseEvent) => onMapClickRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng }))
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map)
    mapRef.current = map
    layerRef.current = L.layerGroup().addTo(map)
    // 창 크기·화면 회전으로 지도 영역 크기가 바뀌면 다시 그리기
    const resizeObserver = new ResizeObserver(() => map.invalidateSize())
    resizeObserver.observe(containerRef.current!)
    return () => {
      resizeObserver.disconnect()
      map.remove()
      mapRef.current = null
    }
    // center·initialZoom은 첫 화면 위치로만 사용
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 마커와 경로선 다시 그리기
  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current
    if (!map || !layer) return
    layer.clearLayers()
    markerRefs.current.clear()

    for (const path of paths) {
      const style = pathStyles[path.mode]
      L.polyline(
        path.points.map((p) => [p.lat, p.lng] as [number, number]),
        { color: style.color, dashArray: style.dashArray, weight: 5, opacity: 0.85 },
      ).addTo(layer)
    }

    for (const m of markers) {
      const variant = m.variant ?? 'stop'
      const isPoi = variant === 'poi'
      const size = isPoi ? 26 : variant === 'candidate' ? 36 : variant === 'meal' ? 20 : 32
      const marker = L.marker([m.position.lat, m.position.lng], {
        icon: L.divIcon({
          className: `map-pin ${variant}`,
          html: `<span>${m.label}</span>`,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        }),
        zIndexOffset: isPoi ? 0 : variant === 'candidate' ? 2000 : 1000,
      })
        .bindPopup(`<strong>${m.title}</strong><br>${m.subtitle}`)
        .on('click', () => onMarkerClickRef.current(m.id))
        .addTo(layer)
      markerRefs.current.set(m.id, marker)
    }
  }, [markers, paths])

  // 방문지가 바뀔 때만 지도 범위를 다시 맞춤 (추천 탭을 바꿀 때는 그대로)
  const stopMarkers = markers.filter(isAnchorMarker)
  const stopKey = stopMarkers.map((m) => `${m.id}@${m.position.lat},${m.position.lng}`).join('|')
  useEffect(() => {
    const map = mapRef.current
    if (!map || stopMarkers.length === 0) return
    const bounds = L.latLngBounds(stopMarkers.map((m) => [m.position.lat, m.position.lng] as [number, number]))
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 16 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopKey])

  useEffect(() => {
    if (!focus) return
    const marker = markerRefs.current.get(focus.id)
    if (!marker || !mapRef.current) return
    mapRef.current.flyTo(marker.getLatLng(), Math.max(mapRef.current.getZoom(), 15), { duration: 0.6 })
    marker.openPopup()
  }, [focus])

  return <div ref={containerRef} className="map-canvas" />
}
