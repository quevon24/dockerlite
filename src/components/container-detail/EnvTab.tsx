import { useEffect, useState } from "react";
import { Copy, Check } from "lucide-react";
import { inspectContainer } from "../../lib/tauri";

interface EnvTabProps {
  containerId: string;
}

interface EnvVar {
  key: string;
  value: string;
}

function parseEnv(raw: string[]): EnvVar[] {
  return raw
    .map((entry) => {
      const idx = entry.indexOf("=");
      if (idx === -1) return { key: entry, value: "" };
      return { key: entry.slice(0, idx), value: entry.slice(idx + 1) };
    })
    .sort((a, b) => a.key.localeCompare(b.key));
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      })
      .catch(() => {});
  };

  return (
    <button
      onClick={copy}
      className="p-1 rounded hover:bg-surface-overlay text-text-muted hover:text-text-primary transition-colors"
      aria-label="Copy value"
    >
      {copied ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

export default function EnvTab({ containerId }: EnvTabProps) {
  const [envVars, setEnvVars] = useState<EnvVar[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    inspectContainer(containerId)
      .then((data) => {
        if (cancelled) return;
        const inspect = data as Record<string, unknown>;
        const config = inspect?.Config as Record<string, unknown> | undefined;
        const env = (config?.Env as string[]) ?? [];
        setEnvVars(parseEnv(env));
        setError(null);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [containerId]);

  if (loading) {
    return <div className="text-text-muted text-sm">Loading environment...</div>;
  }

  if (error) {
    return (
      <div className="bg-danger/10 border border-danger/30 rounded px-3 py-2 text-sm text-danger">
        {error}
      </div>
    );
  }

  if (envVars.length === 0) {
    return <div className="text-text-muted text-sm">No environment variables set.</div>;
  }

  return (
    <div className="bg-surface-raised border border-border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-surface-overlay text-text-secondary text-xs uppercase tracking-wide">
            <th className="px-4 py-2 text-left font-medium">Variable</th>
            <th className="px-4 py-2 text-left font-medium">Value</th>
            <th className="px-4 py-2 w-10"></th>
          </tr>
        </thead>
        <tbody>
          {envVars.map((env) => (
            <tr key={env.key} className="border-t border-border">
              <td className="px-4 py-2 font-mono text-xs text-accent whitespace-nowrap">
                {env.key}
              </td>
              <td className="px-4 py-2 font-mono text-xs text-text-primary break-all">
                {env.value}
              </td>
              <td className="px-4 py-2">
                <CopyButton text={`${env.key}=${env.value}`} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
