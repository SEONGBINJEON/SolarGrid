import { useEffect, useMemo, useRef, useState } from 'react'
import DashboardMap from './components/DashboardMap'
import PlantDetailPage from './components/PlantDetailPage'
import RiskBadge from './components/RiskBadge'
import SectorCouplingPage from './components/SectorCouplingPage'
import Sidebar from './components/Sidebar'
import SidePanel from './components/SidePanel'
import useSolarData from './hooks/useSolarData'
import LoginPage from './pages/LoginPage'
import {
  buildJeonnamAggregateRows,
  buildJeonnamCityRows,
  getCityRows,
} from './utils/jeonnamTimeUtils'

const AUTH_STORAGE_KEY = 'solargrid-authenticated'

const stageControls = [
  { id: 'national', label: '전국' },
  { id: 'jeonnam', label: '지역' },
  { id: 'sinan', label: '도시' },
]

const playbackStepMs = 900

function TimeControl({ dataHourRange, hourSequence, onHourChange, selectedHour }) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackHour, setPlaybackHour] = useState(selectedHour)
  const selectedHourRef = useRef(selectedHour)

  useEffect(() => {
    selectedHourRef.current = selectedHour
  }, [selectedHour])

  useEffect(() => {
    if (!isPlaying || hourSequence.length === 0) {
      return undefined
    }

    const startHour = selectedHourRef.current
    const startIndex = Math.max(0, hourSequence.indexOf(startHour))
    let frameId = 0
    let lastPublishedHour = hourSequence[startIndex]
    const startTime = window.performance.now()

    setPlaybackHour(lastPublishedHour)
    onHourChange(lastPublishedHour)

    const animate = (timestamp) => {
      const position = startIndex + (timestamp - startTime) / playbackStepMs

      if (position >= hourSequence.length - 1) {
        const finalHour = hourSequence[hourSequence.length - 1]
        setPlaybackHour(finalHour)
        onHourChange(finalHour)
        setIsPlaying(false)
        return
      }

      const lowerIndex = Math.floor(position)
      const upperIndex = Math.min(lowerIndex + 1, hourSequence.length - 1)
      const lowerHour = hourSequence[lowerIndex]
      const upperHour = hourSequence[upperIndex]
      const progressToNextHour = position - lowerIndex
      const nextPlaybackHour = lowerHour + (upperHour - lowerHour) * progressToNextHour

      setPlaybackHour(nextPlaybackHour)

      if (lowerHour !== lastPublishedHour) {
        lastPublishedHour = lowerHour
        onHourChange(lowerHour)
      }

      frameId = window.requestAnimationFrame(animate)
    }

    frameId = window.requestAnimationFrame(animate)

    return () => window.cancelAnimationFrame(frameId)
  }, [hourSequence, isPlaying, onHourChange])

  const handlePlaybackToggle = () => {
    if (!isPlaying && selectedHour >= hourSequence[hourSequence.length - 1]) {
      const firstHour = hourSequence[0]
      onHourChange(firstHour)
      setPlaybackHour(firstHour)
    }
    setIsPlaying((playing) => !playing)
  }

  const handleHourChange = (event) => {
    const nextHour = Math.round(Number(event.target.value))
    setIsPlaying(false)
    onHourChange(nextHour)
    setPlaybackHour(nextHour)
  }

  return (
    <div className="control-group control-group-wide">
      <button
        aria-label={isPlaying ? '시간 자동 재생 정지' : '시간 자동 재생'}
        className={`play-button ${isPlaying ? 'is-active' : ''}`}
        onClick={handlePlaybackToggle}
        type="button"
      >
        {isPlaying ? 'Ⅱ' : '▶'}
      </button>
      <input
        className="time-slider"
        max={hourSequence[hourSequence.length - 1] ?? 24}
        min={hourSequence[0] ?? 1}
        onChange={handleHourChange}
        step="0.01"
        type="range"
        value={isPlaying ? playbackHour : selectedHour}
      />
      <div className="flex flex-col items-end gap-0.5">
        <span className="text-[19px] font-semibold leading-none tracking-[-0.03em] text-slate-950">
          {String(selectedHour).padStart(2, '0')}:00
        </span>
        <span className="text-[10px] font-medium text-slate-400">
          {dataHourRange}h
        </span>
      </div>
    </div>
  )
}

function DashboardApp({ onLogout }) {
  const [currentPage, setCurrentPage] = useState('forecast')
  const [viewLevel, setViewLevel] = useState('national')
  const [selectedRegion, setSelectedRegion] = useState(null)
  const [selectedPlant, setSelectedPlant] = useState(null)
  const [selectedDate] = useState('')
  const [selectedHour, setSelectedHour] = useState(13)
  const mapShellRef = useRef(null)
  const infoPanelRef = useRef(null)
  const controlPanelRef = useRef(null)
  const [infoPanelPosition, setInfoPanelPosition] = useState(null)
  const [controlPanelPosition, setControlPanelPosition] = useState(null)
  const [draggingPanel, setDraggingPanel] = useState(null)

  const {
    availableDates,
    availableHours,
    error,
    forecastRows,
    jeonnamDemo,
    jeonnamTimeData,
    loading,
    plants,
    regionRiskSummary,
    sectorCouplingCases,
    shinanPlants,
  } = useSolarData()

  const effectiveDate =
    selectedDate && availableDates.includes(selectedDate)
      ? selectedDate
      : availableDates[0] ?? ''

  const jeonnamHourSequence = useMemo(
    () =>
      jeonnamTimeData.length > 0
        ? [...new Set(jeonnamTimeData.map((row) => row.hour))].sort((a, b) => a - b)
        : Array.from({ length: 24 }, (_, index) => index),
    [jeonnamTimeData],
  )
  const nationalHourSequence = useMemo(
    () =>
      availableHours.length > 0
        ? [...availableHours].sort((a, b) => a - b)
        : Array.from({ length: 24 }, (_, index) => index + 1),
    [availableHours],
  )
  const hourSequence = viewLevel === 'national' ? nationalHourSequence : jeonnamHourSequence
  const effectiveSelectedHour =
    hourSequence.length === 0 || hourSequence.includes(selectedHour)
      ? selectedHour
      : hourSequence.reduce((nearest, hour) =>
          Math.abs(hour - selectedHour) < Math.abs(nearest - selectedHour) ? hour : nearest,
        )
  const dataHourRange = `${hourSequence[0]}~${hourSequence[hourSequence.length - 1]}`
  const jeonnamDisplayRows = useMemo(
    () => buildJeonnamCityRows(jeonnamDemo, jeonnamTimeData, effectiveSelectedHour),
    [jeonnamDemo, jeonnamTimeData, effectiveSelectedHour],
  )
  const jeonnamChartRows = useMemo(
    () => buildJeonnamAggregateRows(jeonnamTimeData),
    [jeonnamTimeData],
  )
  const sinanChartRows = useMemo(
    () => getCityRows(jeonnamTimeData, '신안군'),
    [jeonnamTimeData],
  )

  const currentNationalRows = useMemo(
    () =>
      forecastRows.filter(
        (row) => row.date === effectiveDate && row.hour === effectiveSelectedHour,
      ),
    [forecastRows, effectiveDate, effectiveSelectedHour],
  )

  const effectiveSelectedRegion =
    viewLevel === 'national' && selectedRegion
      ? currentNationalRows.find((row) => row.region === selectedRegion.region) ??
        selectedRegion
      : selectedRegion

  const handleRegionSelect = (region) => {
    setSelectedRegion(region)
    setSelectedPlant(null)

    if (viewLevel === 'national' && region.region === '전라남도') {
      setViewLevel('jeonnam')
    }
    if (viewLevel === 'jeonnam' && region.region === '신안군') {
      setViewLevel('sinan')
    }
  }

  const handleSelectPlant = (plant) => {
    setSelectedPlant(plant)
  }

  const handlePlantSearchSelect = (plant) => {
    setCurrentPage('forecast')
    setViewLevel('sinan')
    setSelectedRegion(null)
    setSelectedPlant(plant)
  }

  const handleStageChange = (nextLevel) => {
    setViewLevel(nextLevel)
    setSelectedPlant(null)

    if (nextLevel === 'national') {
      setSelectedRegion(null)
    }
    if (nextLevel === 'jeonnam') {
      setSelectedRegion(
        currentNationalRows.find((region) => region.region === '전라남도') ?? null,
      )
    }
    if (nextLevel === 'sinan') {
      setSelectedRegion(jeonnamDemo.find((region) => region.region === '신안군') ?? null)
    }
  }

  const handlePageChange = (page) => {
    setCurrentPage(page)
  }

  const openPlantDetail = () => setCurrentPage('plantDetail')
  const openSectorCoupling = () => setCurrentPage('sector')
  const openForecastMap = () => setCurrentPage('forecast')

  const clampPanelPosition = (x, y, panelElement) => {
    const shellElement = mapShellRef.current

    if (!shellElement || !panelElement) {
      return { x, y }
    }

    const shellRect = shellElement.getBoundingClientRect()
    const panelRect = panelElement.getBoundingClientRect()
    const padding = 8
    const maxX = Math.max(padding, shellRect.width - panelRect.width - padding)
    const maxY = Math.max(padding, shellRect.height - panelRect.height - padding)

    return {
      x: Math.min(Math.max(x, padding), maxX),
      y: Math.min(Math.max(y, padding), maxY),
    }
  }

  const startPanelDrag = (event, panelName) => {
    if (event.button !== 0) {
      return
    }

    const panelElement =
      panelName === 'info' ? infoPanelRef.current : controlPanelRef.current
    const shellElement = mapShellRef.current

    if (!panelElement || !shellElement) {
      return
    }

    const shellRect = shellElement.getBoundingClientRect()
    const panelRect = panelElement.getBoundingClientRect()
    const startX = panelRect.left - shellRect.left
    const startY = panelRect.top - shellRect.top
    const pointerStartX = event.clientX
    const pointerStartY = event.clientY
    const setPosition =
      panelName === 'info' ? setInfoPanelPosition : setControlPanelPosition

    event.preventDefault()
    setDraggingPanel(panelName)

    const handlePointerMove = (moveEvent) => {
      const nextPosition = clampPanelPosition(
        startX + moveEvent.clientX - pointerStartX,
        startY + moveEvent.clientY - pointerStartY,
        panelElement,
      )

      setPosition(nextPosition)
    }

    const handlePointerUp = () => {
      setDraggingPanel(null)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
  }

  return (
    <div className="app-layout">
      <Sidebar
        currentPage={currentPage}
        onLogout={onLogout}
        onPageChange={handlePageChange}
        onPlantSearchSelect={handlePlantSearchSelect}
        searchPlants={shinanPlants}
      />

      <div className="app-main">
        {/* ---- Forecast Map page ---- */}
        {currentPage === 'forecast' && (
          <div className="forecast-map-shell" ref={mapShellRef}>
            <DashboardMap
              forecastRows={forecastRows}
              jeonnamDemo={jeonnamDisplayRows}
              onPlantSelect={handleSelectPlant}
              onRegionSelect={handleRegionSelect}
              selectedDate={effectiveDate}
              selectedHour={effectiveSelectedHour}
              selectedPlant={selectedPlant}
              shinanPlants={shinanPlants}
              viewLevel={viewLevel}
            />

            {/* Right side info panel */}
            <div
              className={`map-overlay-panel ${
                draggingPanel === 'info' ? 'is-dragging' : ''
              }`}
              ref={infoPanelRef}
              style={
                infoPanelPosition
                  ? {
                      left: `${infoPanelPosition.x}px`,
                      right: 'auto',
                      top: `${infoPanelPosition.y}px`,
                    }
                  : undefined
              }
              onPointerDown={(event) => {
                if (event.target.closest('.panel-overview-header')) {
                  startPanelDrag(event, 'info')
                }
              }}
            >
              <SidePanel
                error={error}
                forecastRows={forecastRows}
                jeonnamChartRows={jeonnamChartRows}
                jeonnamDemo={jeonnamDisplayRows}
                jeonnamTimeData={jeonnamTimeData}
                loading={loading}
                onPlantDetailOpen={openPlantDetail}
                plants={plants}
                regionRiskSummary={regionRiskSummary}
                selectedDate={effectiveDate}
                selectedHour={effectiveSelectedHour}
                selectedPlant={selectedPlant}
                selectedRegion={effectiveSelectedRegion}
                sectorCouplingCases={sectorCouplingCases}
                shinanPlants={shinanPlants}
                sinanChartRows={sinanChartRows}
                viewLevel={viewLevel}
              />
            </div>

            {/* Bottom floating glass control bar */}
            <footer
              className={`map-overlay-controls ${
                draggingPanel === 'controls' ? 'is-dragging' : ''
              }`}
              ref={controlPanelRef}
              style={
                controlPanelPosition
                  ? {
                      bottom: 'auto',
                      left: `${controlPanelPosition.x}px`,
                      right: 'auto',
                      top: `${controlPanelPosition.y}px`,
                    }
                  : undefined
              }
            >
              <button
                aria-label="하단 기능 패널 이동"
                className="control-drag-handle"
                onPointerDown={(event) => startPanelDrag(event, 'controls')}
                type="button"
              />

              <TimeControl
                dataHourRange={dataHourRange}
                hourSequence={hourSequence}
                onHourChange={setSelectedHour}
                selectedHour={effectiveSelectedHour}
              />

              <div className="ctrl-divider" />

              <div className="stage-control-group">
                <span className="stage-label">단계</span>
                {stageControls.map((stage) => (
                  <button
                    className={`control-button stage-button ${
                      viewLevel === stage.id ? 'is-active' : ''
                    }`}
                    key={stage.id}
                    onClick={() => handleStageChange(stage.id)}
                    type="button"
                  >
                    {stage.label}
                  </button>
                ))}
              </div>

              <div className="ctrl-divider" />

              <div className="legend-wrap">
                <span className="text-[11px] font-medium text-slate-400">범례</span>
                <RiskBadge level="정상" />
                <RiskBadge level="주의" />
                <RiskBadge level="위험" />
              </div>
            </footer>
          </div>
        )}

        {/* ---- Plant Detail page ---- */}
        {currentPage === 'plantDetail' && (
          <PlantDetailPage
            forecastRows={forecastRows}
            onForecastOpen={openForecastMap}
            onSectorCouplingOpen={openSectorCoupling}
            selectedDate={effectiveDate}
            selectedHour={effectiveSelectedHour}
            selectedPlant={selectedPlant}
            sectorCouplingCases={sectorCouplingCases}
          />
        )}

        {/* ---- Sector Coupling page ---- */}
        {currentPage === 'sector' && (
          <SectorCouplingPage
            onForecastOpen={openForecastMap}
            selectedPlant={selectedPlant}
          />
        )}
      </div>
    </div>
  )
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => window.localStorage.getItem(AUTH_STORAGE_KEY) === 'true',
  )

  const handleLoginSuccess = () => {
    window.localStorage.setItem(AUTH_STORAGE_KEY, 'true')
    setIsAuthenticated(true)
  }

  const handleLogout = () => {
    window.localStorage.removeItem(AUTH_STORAGE_KEY)
    setIsAuthenticated(false)
  }

  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />
  }

  return <DashboardApp onLogout={handleLogout} />
}

export default App
