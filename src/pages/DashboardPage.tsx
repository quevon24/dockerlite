import SystemSummary from "../components/system/SystemSummary";
import ContainerTable from "../components/containers/ContainerTable";

export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Containers</h1>
      <SystemSummary />
      <ContainerTable />
    </div>
  );
}
