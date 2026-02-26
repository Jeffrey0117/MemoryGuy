import { useState, useRef, useEffect } from 'react';
import type { ProcessGroup } from '@shared/types';
import { ProcessRow } from './ProcessRow';

interface Props {
  group: ProcessGroup;
  onKill: (pid: number) => Promise<{ success: boolean; error?: string }>;
  onKillGroup: (name: string) => Promise<{ success: boolean; killed: number; error?: string }>;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function ProcessGroupRow({ group, onKill, onKillGroup }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [killing, setKilling] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleKillAll = async () => {
    if (!confirming) {
      setConfirming(true);
      timerRef.current = setTimeout(() => setConfirming(false), 3000);
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);
    setKilling(true);
    await onKillGroup(group.name);
    setKilling(false);
    setConfirming(false);
  };

  return (
    <>
      <tr
        className="border-b border-mg-border/30 hover:bg-white/5 cursor-pointer transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="py-2 pl-4 pr-2">
          <span className="text-mg-muted mr-2 text-xs">
            {expanded ? '\u25BC' : '\u25B6'}
          </span>
          <span className="text-sm text-white font-medium">{group.name}</span>
          <span className="text-xs text-mg-muted ml-2">
            ({group.count})
          </span>
        </td>
        <td className="py-2 px-2 text-sm text-mg-muted">-</td>
        <td className="py-2 px-2 text-sm text-white text-right font-mono">
          {formatBytes(group.totalRam)}
        </td>
        <td className="py-2 px-2 text-sm text-white text-right font-mono">
          {group.totalCpu.toFixed(1)}%
        </td>
        <td className="py-2 px-2" />
        <td className="py-2 px-2 pr-4 text-right">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleKillAll();
            }}
            disabled={killing}
            className={`text-xs px-2 py-1 rounded transition-colors ${
              confirming
                ? 'bg-red-600 text-white hover:bg-red-500'
                : 'bg-mg-border/50 text-mg-muted hover:text-white hover:bg-mg-border'
            } disabled:opacity-50`}
          >
            {killing ? '...' : confirming ? 'Kill All?' : 'Kill All'}
          </button>
        </td>
      </tr>
      {expanded &&
        group.processes.map((proc) => (
          <ProcessRow key={proc.pid} process={proc} onKill={onKill} indent />
        ))}
    </>
  );
}
