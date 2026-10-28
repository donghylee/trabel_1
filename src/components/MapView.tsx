import { googleEnabled } from '../services/google'
import GoogleMapView from './GoogleMapView'
import LeafletMapView from './LeafletMapView'
import type { MapViewProps } from './mapTypes'

export type { MapMarker, MapPath } from './mapTypes'

/** Google 키가 있으면 Google 지도, 없으면 무료 지도(OpenStreetMap) */
export default function MapView(props: MapViewProps) {
  return googleEnabled ? <GoogleMapView {...props} /> : <LeafletMapView {...props} />
}
