import { useState, useRef, useEffect } from 'react';
import type { ProcessInfo } from '@shared/types';

interface Props {
  process: ProcessInfo;
  onKill: (pid: number) => Promise<{ success: boolean; error?: string }>;
  indent?: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

const TREND_ICON: Record<string, string> = {
  up: '\u2191',
  down: '\u2193',
  stable: '\u2192',
};

const TREND_COLOR: Record<string, string> = {
  up: 'text-red-400',
  down: 'text-green-400',
  stable: 'text-mg-muted',
};

export function ProcessRow({ process: proc, onKill, indent }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [killing, setKilling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleKillClick = async () => {
    if (!confirming) {
      setConfirming(true);
      setError(null);
      timerRef.current = setTimeout(() => setConfirming(false), 3000);
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);
    setKilling(true);
    const result = await onKill(proc.pid);
    setKilling(false);
    setConfirming(false);

    if (!result.success) {
      setError(result.error ?? 'Kill failed');
      setTimeout(() => setError(null), 3000);
    }
  };

  return (
    <tr className="border-b border-mg-border/30 hover:bg-white/5 transition-colors">
      <td className={`py-2 ${indent ? 'pl-8' : 'pl-4'} pr-2`}>
        <span className="text-sm text-white">{proc.name}</span>
      </td>
      <td className="py-2 px-2 text-sm text-mg-muted font-mono">{proc.pid}</td>
      <td className="py-2 px-2 text-sm text-white text-right font-mono">
        {formatBytes(proc.ram)}
      </td>
      <td className="py-2 px-2 text-sm text-white text-right font-mono">
        {proc.cpu.toFixed(1)}%
      </td>
      <td className={`py-2 px-2 text-center ${TREND_COLOR[proc.trend]}`}>
        {TREND_ICON[proc.trend]}
      </td>
      <td className="py-2 px-2 pr-4 text-right">
        {error ? (
          <span className="text-xs text-red-400">{error}</span>
        ) : (
          <button
            onClick={handleKillClick}
            disabled={killing}
            className={`text-xs px-2 py-1 rounded transition-colors ${
              confirming
                ? 'bg-red-600 text-white hover:bg-red-500'
                : 'bg-mg-border/50 text-mg-muted hover:text-white hover:bg-mg-border'
            } disabled:opacity-50`}
          >
            {killing ? '...' : confirming ? 'Sure?' : 'Kill'}
          </button>
        )}
      </td>
    </tr>
  );
}
