import SystemSummary from "../components/system/SystemSummary";

export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Containers</h1>
      <SystemSummary />
      <div className="bg-surface-raised border border-border rounded-lg p-8 text-center text-text-secondary">
        <p>Container list will be displayed here.</p>
      </div>
    </div>
  );
}
