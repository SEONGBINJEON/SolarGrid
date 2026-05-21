import L from 'leaflet'
import { Marker } from 'react-leaflet'
import { getRiskClassName } from '../utils/riskUtils'

function RegionMarker({ region, onSelect }) {
  const icon = L.divIcon({
    className: '',
    html: `
      <button class="region-marker-shell" data-region="${region.region}" type="button">
        <div class="marker-name">${region.region}</div>
        <div class="marker-meta">
          <span>
            <span class="marker-value">${region.solar_generation}</span>
            <span class="marker-unit">MWh</span>
          </span>
          <span class="risk-chip ${getRiskClassName(region.risk_level)}">${region.risk_level}</span>
        </div>
      </button>
    `,
    iconAnchor: [75, 19],
    iconSize: [150, 50],
  })

  return (
    <Marker
      eventHandlers={{
        click: () => onSelect(region),
      }}
      icon={icon}
      position={[region.lat, region.lng]}
    />
  )
}

export default RegionMarker
