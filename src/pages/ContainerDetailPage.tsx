import { useParams } from "react-router-dom";

export default function ContainerDetailPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Container Detail</h1>
      <div className="bg-surface-raised border border-border rounded-lg p-8 text-center text-text-secondary">
        <p>Details for container <code className="text-accent">{id}</code> will be displayed here.</p>
      </div>
    </div>
  );
}
