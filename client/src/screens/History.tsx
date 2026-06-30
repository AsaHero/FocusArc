import { useEffect, useMemo } from "react";
import { DateTime } from "luxon";
import { useStore } from "../store";
import { humanDuration } from "../format";
import "./shared.css";
import "./Settings.css";
import "./History.css";

const WEEKS = 12; // ~3 months of heatmap

export function History() {
  const { history, loadHistory, setPhase } = useStore();

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const byDate = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of history?.days ?? []) m.set(d.date, d.totalMs);
    return m;
  }, [history]);

  // Build a WEEKS-wide grid ending today, columns = weeks, rows = Mon..Sun.
  const today = DateTime.now().startOf("day");
  const start = today.minus({ weeks: WEEKS - 1 }).startOf("week"); // Monday
  const columns: { date: string; ms: number }[][] = [];
  for (let w = 0; w < WEEKS; w++) {
    const col: { date: string; ms: number }[] = [];
    for (let d = 0; d < 7; d++) {
      const day = start.plus({ weeks: w, days: d });
      const iso = day.toFormat("yyyy-MM-dd");
      col.push({ date: iso, ms: day <= today ? byDate.get(iso) ?? 0 : -1 });
    }
    columns.push(col);
  }

  const max = Math.max(1, ...[...byDate.values()]);
  const level = (ms: number) => {
    if (ms < 0) return "future";
    if (ms === 0) return "l0";
    const r = ms / max;
    if (r < 0.25) return "l1";
    if (r < 0.5) return "l2";
    if (r < 0.75) return "l3";
    return "l4";
  };

  return (
    <div className="screen settings-screen">
      <div className="settings-stack">
        <div className="settings-top">
          <button className="settings-back" onClick={() => setPhase("timer")}>
            ← Back
          </button>
          <span className="eyebrow">History</span>
          <span style={{ width: 48 }} />
        </div>

        <div className="hist-stats">
          <Stat label="Current streak" value={`${history?.currentStreak ?? 0}d`} />
          <Stat label="Longest streak" value={`${history?.longestStreak ?? 0}d`} />
          <Stat label="Total focused" value={humanDuration(history?.totalMs ?? 0)} />
        </div>

        <div className="hist-heatmap">
          {columns.map((col, i) => (
            <div className="hist-col" key={i}>
              {col.map((cell) => (
                <div
                  key={cell.date}
                  className={`hist-cell hist-${level(cell.ms)}`}
                  title={cell.ms >= 0 ? `${cell.date} · ${humanDuration(cell.ms)}` : ""}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="hist-legend">
          <span className="subtle">less</span>
          <div className="hist-cell hist-l0" />
          <div className="hist-cell hist-l1" />
          <div className="hist-cell hist-l2" />
          <div className="hist-cell hist-l3" />
          <div className="hist-cell hist-l4" />
          <span className="subtle">more</span>
        </div>

        <div className="settings-divider" />
        <div className="hist-list">
          {(history?.days ?? []).slice(-14).reverse().map((d) => (
            <div className="hist-row" key={d.date}>
              <span className="mono">{DateTime.fromISO(d.date).toFormat("LLL d")}</span>
              <span className="mono accent">{humanDuration(d.totalMs)}</span>
            </div>
          ))}
          {(history?.days?.length ?? 0) === 0 && (
            <p className="subtle">No focus days yet. Start a session to begin your streak.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="hist-stat">
      <span className="hist-stat-value mono">{value}</span>
      <span className="hist-stat-label">{label}</span>
    </div>
  );
}
