import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db, usersTable } from "@workspace/db";
import { SESSION_COOKIE, signSession, verifySession } from "../middlewares/require-auth";

const router: IRouter = Router();

const isProd = process.env.NODE_ENV === "production";

const cookieOptions = {
  httpOnly: true,
  // "none" is required for a cross-site frontend (e.g. Cloudflare Pages) calling a
  // separately hosted API (e.g. Railway) to receive the cookie at all; browsers
  // silently drop "lax"/"strict" cookies on cross-site requests. "none" requires
  // secure:true, which is already the case in production.
  sameSite: isProd ? ("none" as const) : ("lax" as const),
  secure: isProd,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const LoginBody = z.object({
  password: z.string().min(1),
});

// POST /auth/login — single shared admin login, password only.
router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Password is required" });
    return;
  }

  const [user] = await db.select().from(usersTable).limit(1);

  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    res.status(401).json({ error: "Incorrect password" });
    return;
  }

  const token = signSession({ sub: user.id });
  res.cookie(SESSION_COOKIE, token, cookieOptions);
  res.json({ ok: true });
});

// POST /auth/logout
router.post("/auth/logout", (_req, res): void => {
  res.clearCookie(SESSION_COOKIE, { httpOnly: cookieOptions.httpOnly, sameSite: cookieOptions.sameSite, secure: cookieOptions.secure });
  res.json({ success: true });
});

// GET /auth/me
router.get("/auth/me", (req, res): void => {
  const token = req.cookies?.[SESSION_COOKIE];
  const session = typeof token === "string" ? verifySession(token) : null;
  if (!session) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  res.json({ ok: true });
});

export default router;
