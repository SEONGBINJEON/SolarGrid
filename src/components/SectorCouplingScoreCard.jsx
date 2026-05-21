function SectorCouplingScoreCard({ item }) {
  return (
    <article className="sector-score-card">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold text-slate-500">추천 {item.rank}순위</p>
          <h3 className="mt-1 text-[20px] font-semibold tracking-[-0.03em] text-slate-950">
            {item.label}
          </h3>
        </div>
        <div className="sector-score-badge" style={{ '--score-color': item.color }}>
          {item.score}
        </div>
      </div>

      <div className="mt-5 space-y-3">
        <div>
          <p className="text-[12px] font-semibold text-slate-500">예상 역할</p>
          <p className="mt-1 text-[15px] font-semibold text-slate-950">{item.role}</p>
        </div>
        <div>
          <p className="text-[12px] font-semibold text-slate-500">추천 이유</p>
          <p className="mt-1 text-[13px] leading-6 text-slate-600">{item.description}</p>
        </div>
      </div>
    </article>
  )
}

export default SectorCouplingScoreCard
