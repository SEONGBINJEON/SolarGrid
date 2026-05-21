import { getRiskClassName } from '../utils/riskUtils'

function RiskBadge({ level }) {
  return (
    <span
      className={`risk-chip inline-flex items-center rounded-full border px-3 py-1 text-[12px] font-semibold leading-none ${getRiskClassName(level)}`}
    >
      {level}
    </span>
  )
}

export default RiskBadge
