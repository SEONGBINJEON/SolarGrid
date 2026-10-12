import { useEffect, useMemo, useRef, useState } from 'react'
import { hasValidPlantCoordinate } from '../utils/coordinateUtils'
import {
  DEMO_PLANT_NAME,
  matchesDemoPlantSearch,
  normalizeSearchText,
} from '../utils/sectorCouplingUtils'

const NAV_ITEMS = [
  { id: 'forecast', label: 'Forecast Map' },
  { id: 'plantDetail', label: 'Plant Detail' },
  { id: 'sector', label: 'Sector Coupling' },
  { id: 'analytics', label: 'Process Analytics' },
]

function ForecastIcon({ active }) {
  const c = active ? '#38bdf8' : '#64748b'
  return (
    <svg fill="none" height="15" viewBox="0 0 18 18" width="15">
      <rect fill={c} height="11" opacity="0.12" rx="2" width="11" x="3.5" y="3.5" />
      <path d="M3.5 9h11M9 3.5v11" opacity="0.5" stroke={c} strokeWidth="1.5" />
      <circle cx="9" cy="9" fill={c} r="2.2" />
    </svg>
  )
}

function PlantIcon({ active }) {
  const c = active ? '#38bdf8' : '#64748b'
  return (
    <svg fill="none" height="15" viewBox="0 0 18 18" width="15">
      <path d="M4.5 14V8.5M9 14V4M13.5 14v-5" stroke={c} strokeLinecap="round" strokeWidth="1.5" />
      <rect height="3.5" rx="1" stroke={c} strokeWidth="1.5" width="3.5" x="7.25" y="1.5" />
    </svg>
  )
}

function CouplingIcon({ active }) {
  const c = active ? '#38bdf8' : '#64748b'
  return (
    <svg fill="none" height="15" viewBox="0 0 18 18" width="15">
      <circle cx="4" cy="9" fill={c} opacity="0.85" r="2.5" />
      <circle cx="14" cy="4.5" fill={c} opacity="0.55" r="2" />
      <circle cx="14" cy="13.5" fill={c} opacity="0.55" r="2" />
      <path d="M6.3 8.2L12 5.5M6.3 9.8L12 12.5" stroke={c} strokeLinecap="round" strokeWidth="1.5" />
    </svg>
  )
}

function AnalyticsIcon({ active }) {
  const c = active ? '#38bdf8' : '#64748b'
  return (
    <svg fill="none" height="15" viewBox="0 0 18 18" width="15">
      <path d="M2.5 15.5h13" opacity="0.5" stroke={c} strokeLinecap="round" strokeWidth="1.5" />
      <path d="M3.5 12.5l3.5-4 3 2.5 4.5-6" stroke={c} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      <path d="M2.5 5.5h13" opacity="0.35" stroke={c} strokeDasharray="2 2" strokeWidth="1.2" />
    </svg>
  )
}

const ICONS = { forecast: ForecastIcon, plantDetail: PlantIcon, sector: CouplingIcon, analytics: AnalyticsIcon }

function SunLogo() {
  return (
    <svg fill="none" height="30" viewBox="0 0 30 30" width="30">
      <circle cx="15" cy="15" fill="#fbbf24" opacity="0.18" r="14" />
      <circle cx="15" cy="15" fill="#fbbf24" r="5.5" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
        <line
          key={deg}
          stroke="#fbbf24"
          strokeLinecap="round"
          strokeWidth="2"
          transform={`rotate(${deg}, 15, 15)`}
          x1="15"
          x2="15"
          y1="2"
          y2="6"
        />
      ))}
    </svg>
  )
}

function formatCapacity(plant) {
  const capacity = plant.permitted_capacity_kw ?? plant.solar_capacity
  const numberValue = Number(capacity)

  if (!Number.isFinite(numberValue)) {
    return ''
  }

  return `${numberValue.toLocaleString()} kW`
}

function getPlantLocation(plant) {
  return (
    plant.township ||
    plant.matched_township ||
    plant.installation_address ||
    plant.address ||
    plant.matched_address ||
    plant.original_address ||
    '신안군'
  )
}

function Sidebar({
  currentPage,
  onLogout,
  onPageChange,
  onPlantSearchSelect,
  searchPlants = [],
}) {
  const [search, setSearch] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const searchWrapRef = useRef(null)
  const normalizedSearch = normalizeSearchText(search)
  const searchResults = useMemo(() => {
    if (normalizedSearch.length === 0) {
      return []
    }

    return searchPlants
      .filter(
        (plant) =>
          hasValidPlantCoordinate(plant) &&
          normalizeSearchText(plant.plant_name).includes(normalizedSearch),
      )
      .sort((a, b) => {
        if (matchesDemoPlantSearch(search)) {
          if (a.plant_name === DEMO_PLANT_NAME) return -1
          if (b.plant_name === DEMO_PLANT_NAME) return 1
        }

        return 0
      })
      .slice(0, 8)
  }, [normalizedSearch, search, searchPlants])
  const showNoResults =
    isSearchOpen && normalizedSearch.length > 0 && searchResults.length === 0
  const selectedResultIndex =
    searchResults.length === 0 ? 0 : Math.min(activeIndex, searchResults.length - 1)

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!searchWrapRef.current?.contains(event.target)) {
        setIsSearchOpen(false)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)

    return () => window.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  const selectPlant = (plant) => {
    setSearch(plant.plant_name ?? '')
    setIsSearchOpen(false)
    onPlantSearchSelect?.(plant)
  }

  const handleSearchKeyDown = (event) => {
    if (event.key === 'Escape') {
      setIsSearchOpen(false)
      return
    }

    if (!isSearchOpen && (event.key === 'ArrowDown' || event.key === 'Enter')) {
      setIsSearchOpen(true)
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((index) =>
        searchResults.length === 0 ? 0 : Math.min(index + 1, searchResults.length - 1),
      )
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => Math.max(index - 1, 0))
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()

      if (searchResults[selectedResultIndex]) {
        selectPlant(searchResults[selectedResultIndex])
      } else {
        setIsSearchOpen(true)
      }
    }
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <SunLogo />
        </div>
        <div>
          <p className="sidebar-logo-sub">Renewable Forecast</p>
          <h1 className="sidebar-logo-title">SolarGrid</h1>
        </div>
      </div>

      <div className="sidebar-user">
        <div className="sidebar-avatar">J</div>
        <div>
          <p className="sidebar-username">jeonseongbin</p>
          <p className="sidebar-user-role">관리자</p>
        </div>
      </div>

      <div className="sidebar-search-wrap" ref={searchWrapRef}>
        <input
          className="sidebar-search"
          onChange={(event) => {
            setSearch(event.target.value)
            setActiveIndex(0)
            setIsSearchOpen(true)
          }}
          onFocus={() => setIsSearchOpen(true)}
          onKeyDown={handleSearchKeyDown}
          placeholder="지역 또는 발전소 검색"
          type="text"
          value={search}
        />

        {isSearchOpen && normalizedSearch.length > 0 && (
          <div className="sidebar-search-dropdown">
            {searchResults.map((plant, index) => (
              <button
                className={`sidebar-search-result ${
                  selectedResultIndex === index ? 'is-active' : ''
                }`}
                key={plant.plant_id ?? `${plant.plant_name}-${index}`}
                onClick={() => selectPlant(plant)}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                type="button"
              >
                <span className="sidebar-result-name">{plant.plant_name}</span>
                <span className="sidebar-result-meta">
                  {getPlantLocation(plant)}
                  {formatCapacity(plant) ? ` · ${formatCapacity(plant)}` : ''}
                </span>
              </button>
            ))}

            {showNoResults && (
              <div className="sidebar-search-empty">일치하는 발전소가 없습니다.</div>
            )}
          </div>
        )}
      </div>

      <nav className="sidebar-nav">
        <p className="sidebar-nav-section">MENU</p>
        {NAV_ITEMS.map((item) => {
          const Icon = ICONS[item.id]
          const active = currentPage === item.id
          return (
            <button
              className={`sidebar-nav-item ${active ? 'is-active' : ''}`}
              key={item.id}
              onClick={() => onPageChange(item.id)}
              type="button"
            >
              <span className="nav-icon">
                <Icon active={active} />
              </span>
              {item.label}
            </button>
          )
        })}
      </nav>

      <div className="sidebar-footer">
        <button className="sidebar-logout" onClick={onLogout} type="button">
          Logout
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
