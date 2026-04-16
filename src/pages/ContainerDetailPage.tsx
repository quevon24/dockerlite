import { useParams } from "react-router-dom";
import DetailView from "../components/container-detail/DetailView";

export default function ContainerDetailPage() {
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return <div className="text-danger">No container ID provided.</div>;
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <DetailView containerId={id} />
    </div>
  );
}
