const mainNavItems = [
  { id: 'forecast', label: 'Forecast Map' },
  { id: 'sector', label: 'Sector Coupling' },
  { id: 'network', label: 'Resource Network' },
  { id: 'report', label: 'Scenario Report' },
]

function Header({ currentPage, onLogout, onPageChange }) {
  return (
    <header className="flex h-[82px] items-center justify-between px-6">
      <div className="flex items-center gap-7">
        <div>
          <p className="text-[12px] font-semibold tracking-[-0.01em] text-sky-700">
            Renewable Forecast Console
          </p>
          <h1 className="mt-1 text-[24px] font-bold leading-none tracking-[-0.04em] text-slate-950">
            SolarGrid AI
          </h1>
        </div>

        <nav className="main-nav" aria-label="Primary">
          {mainNavItems.map((item) => (
            <button
              className={`main-nav-button ${currentPage === item.id ? 'is-active' : ''}`}
              key={item.id}
              onClick={() => onPageChange(item.id)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </nav>

        <label className="relative block">
          <span className="sr-only">검색</span>
          <input
            className="h-11 w-[300px] rounded-full border border-slate-200 bg-white px-5 text-[13px] text-slate-700 shadow-sm outline-none placeholder:text-slate-400 focus:border-sky-400"
            placeholder="지역 또는 발전소 검색"
            type="text"
          />
        </label>
      </div>

      {onLogout && (
        <button className="logout-button" onClick={onLogout} type="button">
          Logout
        </button>
      )}
    </header>
  )
}

export default Header
