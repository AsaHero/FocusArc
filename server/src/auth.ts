import { randomBytes, scryptSync, timingSafeEqual, createHash } from "node:crypto";
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { db } from "./db.js";
import { ACCESS_TTL_SEC, JWT_SECRET, REFRESH_TTL_MS } from "./config.js";

/** Express request augmented with the authenticated user id. */
export interface AuthedRequest extends Request {
  userId?: number;
}

// ---- password hashing (scrypt, no native dep) -----------------------------

const SCRYPT_KEYLEN = 64;

export function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(plain, salt, SCRYPT_KEYLEN).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(plain, salt, SCRYPT_KEYLEN);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

// ---- access tokens (JWT) ---------------------------------------------------

export function signAccessToken(userId: number): string {
  return jwt.sign({ sub: String(userId) }, JWT_SECRET, { expiresIn: ACCESS_TTL_SEC });
}

function verifyAccessToken(token: string): number | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub?: string };
    const id = Number(payload.sub);
    return Number.isInteger(id) ? id : null;
  } catch {
    return null;
  }
}

// ---- refresh tokens (opaque, hashed at rest, rotated) ---------------------

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Mint a refresh token, persist its hash, and return the raw token. */
export function issueRefreshToken(userId: number, now: number = Date.now()): string {
  const raw = randomBytes(32).toString("hex");
  db.prepare(
    `INSERT INTO refresh_tokens (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)`
  ).run(hashToken(raw), userId, now + REFRESH_TTL_MS, now);
  return raw;
}

/** Validate a refresh token; returns its user id or null (and prunes if expired). */
export function userIdForRefresh(raw: string, now: number = Date.now()): number | null {
  const row = db
    .prepare(`SELECT user_id, expires_at FROM refresh_tokens WHERE token = ?`)
    .get(hashToken(raw)) as { user_id: number; expires_at: number } | undefined;
  if (!row) return null;
  if (row.expires_at < now) {
    revokeRefreshToken(raw);
    return null;
  }
  return row.user_id;
}

export function revokeRefreshToken(raw: string): void {
  db.prepare(`DELETE FROM refresh_tokens WHERE token = ?`).run(hashToken(raw));
}

/** Rotate: revoke the presented token and issue a fresh one for the same user. */
export function rotateRefreshToken(raw: string, now: number = Date.now()): string | null {
  const userId = userIdForRefresh(raw, now);
  if (userId == null) return null;
  revokeRefreshToken(raw);
  return issueRefreshToken(userId, now);
}

// ---- middleware ------------------------------------------------------------

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const userId = token ? verifyAccessToken(token) : null;
  if (userId == null) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  req.userId = userId;
  next();
}
