function SectorCouplingMapPanel({ plant, recommendations }) {
  return (
    <section className="sector-network-panel">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold text-slate-500">Coupling Flow</p>
          <h2 className="mt-1 text-[22px] font-semibold tracking-[-0.04em] text-slate-950">
            잉여 전력 활용 추천 네트워크
          </h2>
        </div>
        <span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[12px] font-semibold text-emerald-700">
          Priority scoring
        </span>
      </div>

      <div className="sector-network-canvas">
        <div className="network-line network-line-ess" />
        <div className="network-line network-line-ev" />
        <div className="network-line network-line-p2h" />

        <div className="network-node plant-node">
          <span className="network-node-kicker">Solar Plant</span>
          <strong>{plant.plant_name}</strong>
          <small>{plant.township || plant.matched_township || '신안군'}</small>
        </div>

        {recommendations.map((item) => (
          <div
            className={`network-node resource-node resource-node-${item.id}`}
            key={item.id}
            style={{ '--node-color': item.color }}
          >
            <span className="network-node-kicker">{item.nodeLabel}</span>
            <strong>{item.score}점</strong>
            <small>{item.role}</small>
          </div>
        ))}
      </div>
    </section>
  )
}

export default SectorCouplingMapPanel
