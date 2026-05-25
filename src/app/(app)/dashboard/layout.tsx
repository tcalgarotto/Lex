import "@/styles/justos-dashboard.css";

export default function DashboardSegmentLayout({ children }: { children: React.ReactNode }) {
  return <div className="w-full min-w-0 max-w-none">{children}</div>;
}
