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
        color: selected ? '#f8fafc' : '#ffffff',
        fillColor: selected ? '#0f2f4f' : '#ef4444',
        fillOpacity: selected ? 1 : hovered ? 0.96 : 0.84,
        opacity: 1,
        weight: selected ? 3 : hovered ? 2 : 1.5,
      }}
      radius={selected ? 8 : hovered ? 6 : 4}
    />
  )
}

export default PlantPointMarker
