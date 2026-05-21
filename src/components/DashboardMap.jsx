import { useEffect } from 'react'
import { divIcon } from 'leaflet'
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet'
import PlantPointMarker from './PlantPointMarker'
import RegionMarker from './RegionMarker'

const mapViews = {
  national: {
    center: [36.2, 127.9],
    zoom: 7,
  },
  jeonnam: {
    center: [34.73, 126.63],
    zoom: 8,
  },
  sinan: {
    center: [34.82, 126.08],
    zoom: 9,
  },
}

function hasValidPlantCoordinate(plant) {
  return Number.isFinite(Number(plant.lat)) && Number.isFinite(Number(plant.lng))
}

const neighboringCityLabels = [
  { name: '베이징', lat: 39.9042, lng: 116.4074 },
  { name: '다롄', lat: 38.914, lng: 121.6147 },
  { name: '칭다오', lat: 36.0671, lng: 120.3826 },
  { name: '상하이', lat: 31.2304, lng: 121.4737 },
  { name: '블라디보스토크', lat: 43.1155, lng: 131.8855 },
  { name: '후쿠오카', lat: 33.5902, lng: 130.4017 },
  { name: '히로시마', lat: 34.3853, lng: 132.4553 },
  { name: '오사카', lat: 34.6937, lng: 135.5023 },
  { name: '도쿄', lat: 35.6762, lng: 139.6503 },
]

function NeighboringCityLabels() {
  return neighboringCityLabels.map((city) => (
    <Marker
      key={city.name}
      icon={divIcon({
        className: 'neighbor-city-icon',
        html: `<span class="neighbor-city-label">${city.name}</span>`,
      })}
      interactive={false}
      position={[city.lat, city.lng]}
    />
  ))
}

function ViewController({ viewLevel }) {
  const map = useMap()
  const nextView = mapViews[viewLevel]

  useEffect(() => {
    map.setView(nextView.center, nextView.zoom, { animate: true })
  }, [map, nextView.center, nextView.zoom])

  return null
}

function DashboardMap({
  forecastRows,
  jeonnamDemo,
  onPlantSelect,
  onRegionSelect,
  shinanPlants,
  selectedDate,
  selectedHour,
  selectedPlant,
  viewLevel,
}) {
  const currentView = mapViews[viewLevel]
  const nationalItems = forecastRows.filter(
    (region) => region.date === selectedDate && region.hour === selectedHour,
  )
  const items =
    viewLevel === 'national'
      ? nationalItems
      : viewLevel === 'jeonnam'
        ? jeonnamDemo
        : shinanPlants.filter(hasValidPlantCoordinate)

  return (
    <MapContainer
      center={currentView.center}
      preferCanvas
      scrollWheelZoom
      zoom={currentView.zoom}
      zoomControl={false}
    >
      <TileLayer
        attribution="Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community"
        maxZoom={18}
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
      />
      <TileLayer
        attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png"
      />
      <ViewController viewLevel={viewLevel} />
      {viewLevel === 'national' ? <NeighboringCityLabels /> : null}

      {viewLevel === 'sinan'
        ? items.map((plant) => (
            <PlantPointMarker
              key={plant.plant_id}
              onSelect={onPlantSelect}
              plant={plant}
              selected={selectedPlant?.plant_id === plant.plant_id}
            />
          ))
        : items.map((region) => (
            <RegionMarker key={region.id} onSelect={onRegionSelect} region={region} />
          ))}
    </MapContainer>
  )
}

export default DashboardMap
