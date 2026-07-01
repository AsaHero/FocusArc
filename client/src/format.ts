/** Split ms into zero-padded HH, MM, SS strings for the flip clock. */
export function hms(ms: number): { h: string; m: string; s: string } {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return { h: pad(h), m: pad(m), s: pad(s) };
}

/** "HH:MM:SS" — for the browser tab title while a session runs. */
export function hmsClock(ms: number): string {
  const { h, m, s } = hms(ms);
  return `${h}:${m}:${s}`;
}

/** "Xh Ym", "Ym", or "0m" — for today totals and session durations. */
export function humanDuration(ms: number): string {
  const totalMin = Math.floor(ms / 60000);
  if (totalMin === 0) return ms > 0 ? "<1m" : "0m";
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}
