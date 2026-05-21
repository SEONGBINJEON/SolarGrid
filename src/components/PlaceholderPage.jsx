function PlaceholderPage({ description, eyebrow, title }) {
  return (
    <section className="page-shell">
      <div className="empty-state-card">
        <p className="text-[12px] font-semibold text-sky-700">{eyebrow}</p>
        <h2 className="mt-2 text-[30px] font-semibold tracking-[-0.05em] text-slate-950">
          {title}
        </h2>
        <p className="mt-3 max-w-[680px] text-[14px] leading-7 text-slate-600">
          {description}
        </p>
        <div className="mt-6 rounded-[18px] border border-slate-200 bg-slate-50 p-4 text-[13px] font-medium text-slate-500">
          MVP 발표 이후 실제 데이터와 네트워크 시각화를 연결할 예정입니다.
        </div>
      </div>
    </section>
  )
}

export default PlaceholderPage
