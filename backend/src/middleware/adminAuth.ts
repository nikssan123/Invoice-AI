import type { Request, Response, NextFunction } from "express";

/**
 * Redirect to admin login if session is not authenticated for admin.
 * Use on all admin routes except GET/POST /login.
 */
export function requireAdminAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.session?.admin === true) {
    next();
    return;
  }
  res.redirect("/api/admin/login");
}
