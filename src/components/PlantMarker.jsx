import L from 'leaflet'
import { Marker } from 'react-leaflet'

function PlantMarker({ plant, onSelect, selected }) {
  const icon = L.divIcon({
    className: '',
    html: `
      <button class="plant-marker-shell ${selected ? 'is-selected' : ''}" type="button">
        <div class="plant-marker-title">${plant.plant_name}</div>
        <div class="plant-marker-meta">
          <span class="plant-marker-value">${plant.solar_generation} MWh</span>
          <span class="plant-marker-note">위험도 ${plant.risk_score}</span>
        </div>
      </button>
    `,
    iconAnchor: [82, 18],
    iconSize: [164, 48],
  })

  return (
    <Marker
      eventHandlers={{
        click: () => onSelect(plant),
      }}
      icon={icon}
      position={[plant.lat, plant.lng]}
    />
  )
}

export default PlantMarker
