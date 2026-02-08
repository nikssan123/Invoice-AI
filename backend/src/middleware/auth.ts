import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid token" });
    return;
  }
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, config.jwtSecret) as {
      userId: string;
      email: string;
      role?: string;
      organizationId?: string;
    };
    req.user = {
      id: payload.userId,
      email: payload.email,
      role: payload.role ?? "member",
      organizationId: payload.organizationId ?? "",
    };
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
}
