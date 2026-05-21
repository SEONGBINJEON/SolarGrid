import { useState } from 'react'

const NAV_ITEMS = [
  { id: 'forecast', label: 'Forecast Map' },
  { id: 'plantDetail', label: 'Plant Detail' },
  { id: 'sector', label: 'Sector Coupling' },
]

function ForecastIcon({ active }) {
  const c = active ? '#38bdf8' : '#64748b'
  return (
    <svg fill="none" height="18" viewBox="0 0 18 18" width="18">
      <rect fill={c} height="11" opacity="0.12" rx="2" width="11" x="3.5" y="3.5" />
      <path d="M3.5 9h11M9 3.5v11" opacity="0.5" stroke={c} strokeWidth="1.3" />
      <circle cx="9" cy="9" fill={c} r="2.2" />
    </svg>
  )
}

function PlantIcon({ active }) {
  const c = active ? '#38bdf8' : '#64748b'
  return (
    <svg fill="none" height="18" viewBox="0 0 18 18" width="18">
      <path d="M4.5 14V8.5M9 14V4M13.5 14v-5" stroke={c} strokeLinecap="round" strokeWidth="1.8" />
      <rect height="3.5" rx="1" stroke={c} strokeWidth="1.3" width="3.5" x="7.25" y="1.5" />
    </svg>
  )
}

function CouplingIcon({ active }) {
  const c = active ? '#38bdf8' : '#64748b'
  return (
    <svg fill="none" height="18" viewBox="0 0 18 18" width="18">
      <circle cx="4" cy="9" fill={c} opacity="0.85" r="2.5" />
      <circle cx="14" cy="4.5" fill={c} opacity="0.55" r="2" />
      <circle cx="14" cy="13.5" fill={c} opacity="0.55" r="2" />
      <path d="M6.3 8.2L12 5.5M6.3 9.8L12 12.5" stroke={c} strokeLinecap="round" strokeWidth="1.4" />
    </svg>
  )
}

const ICONS = { forecast: ForecastIcon, plantDetail: PlantIcon, sector: CouplingIcon }

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

function Sidebar({ currentPage, onLogout, onPageChange }) {
  const [search, setSearch] = useState('')

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

      <div className="sidebar-search-wrap">
        <input
          className="sidebar-search"
          onChange={(e) => setSearch(e.target.value)}
          placeholder="지역 또는 발전소 검색"
          type="text"
          value={search}
        />
      </div>

      <nav className="sidebar-nav">
        <p className="sidebar-nav-section">메뉴</p>
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
          로그아웃
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
