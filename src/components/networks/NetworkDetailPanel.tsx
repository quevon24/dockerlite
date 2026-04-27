import { useEffect } from "react";
import { X } from "lucide-react";
import type { NetworkInfo } from "../../lib/types";

interface Props {
  network: NetworkInfo | null;
  onClose: () => void;
}

function Badge({ children, variant = "default" }: { children: React.ReactNode; variant?: "default" | "warning" | "success" }) {
  const cls = {
    default: "bg-surface-overlay text-text-secondary border-border",
    warning: "bg-warning/20 text-warning border-warning/30",
    success: "bg-success/20 text-success border-success/30",
  }[variant];
  return (
    <span className={`px-2 py-0.5 rounded border text-xs font-medium ${cls}`}>
      {children}
    </span>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-4 px-3 py-2">
      <span className="text-xs text-text-muted w-[100px] shrink-0 pt-0.5">{label}</span>
      <span className={`text-xs text-text-primary break-all ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

function BoolRow({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="flex items-center gap-4 px-3 py-2">
      <span className="text-xs text-text-muted w-[100px] shrink-0">{label}</span>
      <span className={`text-xs font-medium ${value ? "text-success" : "text-text-muted"}`}>
        {value ? "yes" : "no"}
      </span>
    </div>
  );
}

export default function NetworkDetailPanel({ network, onClose }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const open = network !== null;
  const labels = network ? Object.entries(network.labels) : [];
  const options = network ? Object.entries(network.options) : [];

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-20 bg-black/30" onClick={onClose} />
      )}
      <div
        className={`fixed top-0 right-0 bottom-0 w-[520px] bg-surface border-l border-border shadow-2xl flex flex-col z-30 transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        {network && (
          <>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
              <div className="min-w-0 flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-semibold text-text-primary">{network.name}</h2>
                <Badge>{network.driver}</Badge>
                <span className="text-xs text-text-muted">{network.scope}</span>
                {network.internal && <Badge variant="warning">internal</Badge>}
                {network.ingress && <Badge variant="warning">ingress</Badge>}
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded hover:bg-surface-overlay text-text-muted hover:text-text-primary transition-colors ml-3 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
              <section>
                <h3 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">Details</h3>
                <div className="bg-surface-raised border border-border rounded-lg divide-y divide-border">
                  <Row label="ID" value={network.id} mono />
                  <Row label="Name" value={network.name} />
                  <Row label="Driver" value={network.driver} />
                  <Row label="Scope" value={network.scope} />
                  <BoolRow label="IPv6" value={network.enableIpv6} />
                  <BoolRow label="Internal" value={network.internal} />
                  <BoolRow label="Attachable" value={network.attachable} />
                  <BoolRow label="Ingress" value={network.ingress} />
                </div>
              </section>

              <section>
                <h3 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">
                  Containers ({network.containers.length})
                </h3>
                {network.containers.length === 0 ? (
                  <p className="text-xs text-text-muted italic">No containers connected</p>
                ) : (
                  <div className="bg-surface-raised border border-border rounded-lg divide-y divide-border">
                    {network.containers.map((c) => (
                      <div key={c.containerId} className="px-3 py-2 flex items-center gap-3">
                        <span className="text-xs font-medium text-text-primary min-w-0 truncate">
                          {c.name || c.containerId.slice(0, 12)}
                        </span>
                        <span className="text-xs font-mono text-text-muted shrink-0">
                          {c.containerId.slice(0, 12)}
                        </span>
                        {c.ipv4Address && (
                          <span className="text-xs font-mono text-text-muted ml-auto shrink-0">
                            {c.ipv4Address}
                          </span>
                        )}
                        {c.ipv6Address && (
                          <span className="text-xs font-mono text-text-muted shrink-0">
                            {c.ipv6Address}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {labels.length > 0 && (
                <section>
                  <h3 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">Labels</h3>
                  <div className="bg-surface-raised border border-border rounded-lg divide-y divide-border">
                    {labels.map(([k, v]) => (
                      <div key={k} className="px-3 py-2 flex items-start gap-3">
                        <span className="text-xs font-mono text-text-secondary shrink-0 break-all">{k}</span>
                        <span className="text-xs font-mono text-text-muted break-all ml-auto text-right">{v}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {options.length > 0 && (
                <section>
                  <h3 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">Options</h3>
                  <div className="bg-surface-raised border border-border rounded-lg divide-y divide-border">
                    {options.map(([k, v]) => (
                      <div key={k} className="px-3 py-2 flex items-start gap-3">
                        <span className="text-xs font-mono text-text-secondary shrink-0 break-all">{k}</span>
                        <span className="text-xs font-mono text-text-muted break-all ml-auto text-right">{v}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
