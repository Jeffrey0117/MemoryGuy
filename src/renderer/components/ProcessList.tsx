import { useProcessList } from '../hooks/useProcessList';
import type { SortField } from '../hooks/useProcessList';
import { ProcessRow } from './ProcessRow';
import { ProcessGroupRow } from './ProcessGroupRow';

function SortHeader({
  label,
  field,
  currentSort,
  currentDir,
  onSort,
  align,
}: {
  label: string;
  field: SortField;
  currentSort: SortField;
  currentDir: 'asc' | 'desc';
  onSort: (f: SortField) => void;
  align?: string;
}) {
  const active = currentSort === field;
  const arrow = active ? (currentDir === 'asc' ? ' \u25B2' : ' \u25BC') : '';

  return (
    <th
      className={`py-2 px-2 text-xs font-medium cursor-pointer select-none transition-colors
        ${active ? 'text-white' : 'text-mg-muted hover:text-white'}
        ${align ?? 'text-left'}`}
      onClick={() => onSort(field)}
    >
      {label}
      {arrow}
    </th>
  );
}

export function ProcessList() {
  const {
    processes,
    groups,
    search,
    setSearch,
    sortBy,
    sortDir,
    toggleSort,
    grouped,
    setGrouped,
    isLoading,
    handleKill,
    handleKillGroup,
  } = useProcessList();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-mg-muted">
        Loading processes...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Search by name or PID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-mg-bg border border-mg-border rounded px-3 py-1.5 text-sm text-white
            placeholder:text-mg-muted focus:outline-none focus:border-mg-primary"
        />
        <label className="flex items-center gap-2 text-sm text-mg-muted cursor-pointer select-none">
          <input
            type="checkbox"
            checked={grouped}
            onChange={(e) => setGrouped(e.target.checked)}
            className="accent-mg-primary"
          />
          Group
        </label>
        <span className="text-xs text-mg-muted">
          {processes.length} processes
        </span>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-mg-bg/50 border-b border-mg-border">
            <tr>
              <SortHeader
                label="Name"
                field="name"
                currentSort={sortBy}
                currentDir={sortDir}
                onSort={toggleSort}
              />
              <th className="py-2 px-2 text-xs font-medium text-mg-muted text-left w-20">
                PID
              </th>
              <SortHeader
                label="RAM"
                field="ram"
                currentSort={sortBy}
                currentDir={sortDir}
                onSort={toggleSort}
                align="text-right"
              />
              <SortHeader
                label="CPU"
                field="cpu"
                currentSort={sortBy}
                currentDir={sortDir}
                onSort={toggleSort}
                align="text-right"
              />
              <th className="py-2 px-2 text-xs font-medium text-mg-muted text-center w-12">
                Trend
              </th>
              <th className="py-2 px-2 pr-4 text-xs font-medium text-mg-muted text-right w-24">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {groups
              ? groups.map((g) => (
                  <ProcessGroupRow
                    key={g.name}
                    group={g}
                    onKill={handleKill}
                    onKillGroup={handleKillGroup}
                  />
                ))
              : processes.map((p) => (
                  <ProcessRow key={p.pid} process={p} onKill={handleKill} />
                ))}
          </tbody>
        </table>

        {processes.length === 0 && (
          <div className="text-center text-mg-muted py-8 text-sm">
            No processes found
          </div>
        )}
      </div>
    </div>
  );
}
