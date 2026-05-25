export default function DashboardLoading() {
  return (
    <div className="justos-dashboard animate-pulse" aria-busy="true" aria-label="Carregando cockpit">
      <div className="h-10 w-64 rounded-lg bg-[color:var(--surface-overlay)]" />
      <div className="justos-dashboard__metrics">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-16 rounded-xl bg-[color:var(--surface-overlay)]" />
        ))}
      </div>
      <div className="h-80 rounded-2xl bg-[color:var(--surface-overlay)]" />
    </div>
  );
}
