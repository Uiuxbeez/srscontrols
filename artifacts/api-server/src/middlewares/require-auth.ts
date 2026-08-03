import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";

export const SESSION_COOKIE = "srs_session";

export interface SessionPayload {
  sub: number;
}

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET must be set");
  return secret;
}

export function signSession(payload: SessionPayload): string {
  return jwt.sign(payload, getSecret(), { expiresIn: "7d" });
}

export function verifySession(token: string): SessionPayload | null {
  try {
    return jwt.verify(token, getSecret()) as unknown as SessionPayload;
  } catch {
    return null;
  }
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionPayload;
    }
  }
}

export const requireAuth: RequestHandler = (req, res, next) => {
  const token = req.cookies?.[SESSION_COOKIE];
  const session = typeof token === "string" ? verifySession(token) : null;
  if (!session) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  req.user = session;
  next();
};
