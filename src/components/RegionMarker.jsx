import L from 'leaflet'
import { Marker } from 'react-leaflet'
import { getRiskClassName } from '../utils/riskUtils'

function formatMarkerNumber(value) {
  const numberValue = Number(value)

  if (!Number.isFinite(numberValue)) {
    return value ?? '-'
  }

  return Number.isInteger(numberValue) ? numberValue.toLocaleString() : numberValue.toFixed(1)
}

function RegionMarker({ region, onSelect }) {
  const tempHtml =
    region.temperature != null
      ? `<span class="marker-temp">&nbsp;·&nbsp;${formatMarkerNumber(region.temperature)}°C</span>`
      : ''
  const generationUnit = region.generation_unit ?? 'MWh'

  const icon = L.divIcon({
    className: '',
    html: `
      <button class="region-marker-shell" data-region="${region.region}" type="button">
        <div class="marker-header">
          <span class="marker-name">${region.region}</span>
          <span class="risk-chip ${getRiskClassName(region.risk_level)}">${region.risk_level}</span>
        </div>
        <div class="marker-bottom">
          <span class="marker-value">${formatMarkerNumber(region.solar_generation)}</span>
          <span class="marker-unit">${generationUnit}</span>
          ${tempHtml}
        </div>
      </button>
    `,
    iconAnchor: [69, 16],
    iconSize: [138, 46],
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
