import { useState } from 'react'
import { CircleMarker } from 'react-leaflet'

function PlantPointMarker({ plant, onSelect, selected }) {
  const [hovered, setHovered] = useState(false)

  return (
    <CircleMarker
      center={[Number(plant.lat), Number(plant.lng)]}
      eventHandlers={{
        click: () => onSelect(plant),
        mouseout: () => setHovered(false),
        mouseover: () => setHovered(true),
      }}
      pathOptions={{
        color: selected ? '#0f766e' : '#ffffff',
        fillColor: selected ? '#0f766e' : '#ef4444',
        fillOpacity: selected ? 0.96 : hovered ? 0.96 : 0.84,
        opacity: 1,
        weight: selected ? 2 : hovered ? 2 : 1.5,
      }}
      radius={selected ? 7 : hovered ? 6 : 4}
    />
  )
}

export default PlantPointMarker
