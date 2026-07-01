import type { Response } from "express";

/**
 * In-memory Server-Sent-Events broadcaster, keyed by user id. Each user can
 * have several open connections (multiple devices/tabs); a state change is
 * fanned out to all of them so the active timer stays in sync everywhere.
 *
 * State is intentionally process-local: it is a live push channel, not a
 * durable queue. Clients always reconcile against the DB via /bootstrap on
 * (re)connect, so a dropped connection loses nothing.
 */
const connections = new Map<number, Set<Response>>();

const HEARTBEAT_MS = 25_000;

/** Register an SSE connection for a user and wire up cleanup on close. */
export function subscribe(userId: number, res: Response): void {
  let set = connections.get(userId);
  if (!set) {
    set = new Set();
    connections.set(userId, set);
  }
  set.add(res);

  // Keep the connection (and any proxies) alive between real events.
  const heartbeat = setInterval(() => {
    res.write(": ping\n\n");
  }, HEARTBEAT_MS);

  const cleanup = () => {
    clearInterval(heartbeat);
    const s = connections.get(userId);
    if (s) {
      s.delete(res);
      if (s.size === 0) connections.delete(userId);
    }
  };

  res.on("close", cleanup);
  res.on("error", cleanup);
}

/** Push a JSON payload to every open connection for a user. */
export function broadcast(userId: number, payload: unknown): void {
  const set = connections.get(userId);
  if (!set || set.size === 0) return;
  const frame = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of set) {
    res.write(frame);
  }
}
