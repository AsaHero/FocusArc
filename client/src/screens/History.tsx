import { useEffect, useMemo, useState } from "react";
import { DateTime } from "luxon";
import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "../store";
import { api, type DaySummary } from "../api";
import { humanDuration } from "../format";
import "./shared.css";
import "./Settings.css";
import "./History.css";

const WEEKS = 26; // width of the visible heatmap window (~6 months)
const STEP = 8; // weeks moved per arrow click

export function History() {
  const { history, loadHistory, setPhase } = useStore();
  const tz = useStore((s) => s.settings?.timezone);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const byDate = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of history?.days ?? []) m.set(d.date, d.totalMs);
    return m;
  }, [history]);

  const sessionsByDate = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of history?.days ?? []) m.set(d.date, d.sessionCount);
    return m;
  }, [history]);

  // Build a WEEKS-wide grid, columns = weeks (Mon..Sun), ending at the current
  // window. Account timezone keeps "today" and future-masking aligned with the
  // server's focus-day labels. Paging shifts the window's end back in time.
  const realToday = (tz ? DateTime.now().setZone(tz) : DateTime.now()).startOf("day");
  const windowEnd = realToday.minus({ weeks: weekOffset * STEP });
  const start = windowEnd.minus({ weeks: WEEKS - 1 }).startOf("week"); // Monday
  const columns: { date: string; ms: number }[][] = [];
  for (let w = 0; w < WEEKS; w++) {
    const col: { date: string; ms: number }[] = [];
    for (let d = 0; d < 7; d++) {
      const day = start.plus({ weeks: w, days: d });
      const iso = day.toFormat("yyyy-MM-dd");
      col.push({ date: iso, ms: day <= realToday ? byDate.get(iso) ?? 0 : -1 });
    }
    columns.push(col);
  }

  // Month labels: show the month name above the first column that lands in it.
  const monthLabels = columns.map((col, i) => {
    const first = DateTime.fromISO(col[0].date);
    const prev = i > 0 ? DateTime.fromISO(columns[i - 1][0].date) : null;
    return !prev || first.month !== prev.month ? first.toFormat("LLL") : "";
  });

  const rangeLabel = `${start.toFormat("LLL d")} – ${windowEnd.toFormat("LLL d, yyyy")}`;

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

  const recent = (history?.days ?? []).slice(-14).reverse();

  return (
    <div className="screen history-screen">
      <div className="history-stack">
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

        <div className="hist-card">
          <div className="hist-card-head">
            <span className="hist-range mono">{rangeLabel}</span>
            <div className="hist-nav">
              <button
                className="hist-arrow"
                onClick={() => setWeekOffset((o) => o + 1)}
                aria-label="Earlier weeks"
              >
                ←
              </button>
              <button
                className="hist-arrow"
                onClick={() => setWeekOffset((o) => Math.max(0, o - 1))}
                disabled={weekOffset === 0}
                aria-label="Later weeks"
              >
                →
              </button>
            </div>
          </div>

          <div className="hist-grid">
            <div className="hist-weekdays">
              {["Mon", "", "Wed", "", "Fri", "", ""].map((d, i) => (
                <span key={i} className="hist-weekday">
                  {d}
                </span>
              ))}
            </div>
            <div className="hist-grid-main">
              <div className="hist-months">
                {monthLabels.map((m, i) => (
                  <span key={i} className="hist-month">
                    {m}
                  </span>
                ))}
              </div>
              <div className="hist-heatmap">
                {columns.map((col, i) => (
                  <div className="hist-col" key={i}>
                    {col.map((cell) => (
                      <button
                        key={cell.date}
                        className={`hist-cell hist-${level(cell.ms)}${
                          cell.ms >= 0 ? " hist-clickable" : ""
                        }`}
                        disabled={cell.ms < 0}
                        onClick={() => setSelected(cell.date)}
                        title={cell.ms >= 0 ? `${cell.date} · ${humanDuration(cell.ms)}` : ""}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
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
        </div>

        <div className="hist-list">
          <span className="eyebrow hist-list-title">Recent days</span>
          {recent.map((d) => (
            <button className="hist-row" key={d.date} onClick={() => setSelected(d.date)}>
              <span className="mono">{DateTime.fromISO(d.date).toFormat("ccc, LLL d")}</span>
              <span className="hist-row-right">
                <span className="subtle">
                  {sessionsByDate.get(d.date) ?? 0} session
                  {(sessionsByDate.get(d.date) ?? 0) === 1 ? "" : "s"}
                </span>
                <span className="mono accent">{humanDuration(d.totalMs)}</span>
              </span>
            </button>
          ))}
          {recent.length === 0 && (
            <p className="subtle">No focus days yet. Start a session to begin your streak.</p>
          )}
        </div>
      </div>

      <AnimatePresence>
        {selected && <DayPanel date={selected} onClose={() => setSelected(null)} />}
      </AnimatePresence>
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

/** "HH:mm" → minutes past midnight, or null if unparseable. */
function toMinutes(hm: string | null): number | null {
  if (!hm) return null;
  const [h, m] = hm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function DayPanel({ date, onClose }: { date: string; onClose: () => void }) {
  const [day, setDay] = useState<DaySummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api
      .historyDay(date)
      .then(({ day }) => alive && setDay(day))
      .catch(() => alive && setDay(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [date]);

  const sessions = day?.sessions ?? [];
  const title = DateTime.fromISO(date).toFormat("cccc, LLL d");

  // Day stats.
  const totalMs = sessions.reduce((s, x) => s + x.durationMs, 0);
  const longestMs = sessions.reduce((m, x) => Math.max(m, x.durationMs), 0);
  const firstStart = sessions[0]?.start ?? null;
  const lastEnd = sessions[sessions.length - 1]?.end ?? null;

  // Timeline range: pad to whole hours around the first start and last end.
  const spans = sessions.map((s) => {
    const from = toMinutes(s.start);
    const to = toMinutes(s.end) ?? (from != null ? from + s.durationMs / 60000 : null);
    return from != null && to != null ? { from, to, durationMs: s.durationMs } : null;
  });
  const valid = spans.filter((s): s is NonNullable<typeof s> => s != null);
  const rangeStart = valid.length ? Math.floor(Math.min(...valid.map((s) => s.from)) / 60) * 60 : 0;
  const rangeEnd = valid.length ? Math.ceil(Math.max(...valid.map((s) => s.to)) / 60) * 60 : 60;
  const span = Math.max(1, rangeEnd - rangeStart);

  const ticks: number[] = [];
  const tickStep = span > 6 * 60 ? 120 : 60;
  for (let t = rangeStart; t <= rangeEnd; t += tickStep) ticks.push(t);

  return (
    <motion.div
      className="hist-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={onClose}
    >
      <motion.div
        className="hist-panel"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 12 }}
        transition={{ duration: 0.2, ease: [0.2, 0.7, 0.2, 1] }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="hist-panel-head">
          <span className="hist-panel-title">{title}</span>
          <button className="hist-panel-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {loading ? (
          <p className="subtle">Loading…</p>
        ) : sessions.length === 0 ? (
          <p className="subtle">No focus sessions this day.</p>
        ) : (
          <>
            <div className="hist-day-stats">
              <DayStat label="Focused" value={humanDuration(totalMs)} />
              <DayStat label="Sessions" value={String(sessions.length)} />
              <DayStat label="Longest" value={humanDuration(longestMs)} />
              <DayStat label="Span" value={firstStart && lastEnd ? `${firstStart}–${lastEnd}` : "—"} />
            </div>

            {valid.length > 0 && (
              <div className="hist-timeline">
                <div className="hist-track">
                  {valid.map((s, i) => (
                    <div
                      key={i}
                      className="hist-block"
                      style={{
                        left: `${((s.from - rangeStart) / span) * 100}%`,
                        width: `${Math.max(1.5, ((s.to - s.from) / span) * 100)}%`,
                      }}
                      title={humanDuration(s.durationMs)}
                    />
                  ))}
                </div>
                <div className="hist-ticks">
                  {ticks.map((t) => (
                    <span
                      key={t}
                      className="hist-tick"
                      style={{ left: `${((t - rangeStart) / span) * 100}%` }}
                    >
                      {String(Math.floor(t / 60)).padStart(2, "0")}:00
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="hist-sessions">
              {sessions.map((s) => (
                <div className="hist-session" key={s.id}>
                  <span className="mono">
                    {s.start} → {s.end ?? "…"}
                  </span>
                  <span className="mono accent">{humanDuration(s.durationMs)}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

function DayStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="hist-day-stat">
      <span className="hist-day-stat-value mono">{value}</span>
      <span className="hist-day-stat-label">{label}</span>
    </div>
  );
}
