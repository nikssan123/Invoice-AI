import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import session from "express-session";
import swaggerUi from "swagger-ui-express";
import { config } from "./config.js";
import { requireAuth } from "./middleware/auth.js";
import authRoutes from "./routes/auth.js";
import activityRoutes from "./routes/activities.js";
import folderRoutes from "./routes/folders.js";
import invoiceRoutes from "./routes/invoices.js";
import organizationRoutes from "./routes/organizations.js";
import profileRoutes from "./routes/profile.js";
import billingRoutes from "./routes/billing.js";
import billingWebhookRoutes from "./routes/billingWebhook.js";
import billingSummaryRoutes from "./routes/billingSummary.js";
import contactRoutes from "./routes/contact.js";
import adminRoutes from "./routes/admin.js";
import { swaggerSpec } from "./swagger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

app.set("trust proxy", 1);
app.use(cors({ origin: true }));
app.use(cookieParser());
// Only set secure cookie when app is served over HTTPS (by URL or explicit env).
// NODE_ENV=production over HTTP would otherwise block the session cookie and break admin login.
const sessionSecure =
  process.env.SESSION_SECURE_COOKIE === "true" || config.appUrl.startsWith("https");
app.use(
  session({
    secret: config.jwtSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: sessionSecure,
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);
app.use(express.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "..", "views"));
// Skip JSON body parsing for Stripe webhook so the route can use raw body for signature verification
app.use((req, _res, next) => {
  if (req.originalUrl === "/api/billing/webhook" && req.method === "POST") return next();
  express.json()(req, _res as any, next);
});
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use("/api/auth", authRoutes);
app.use("/api/activities", requireAuth, activityRoutes);
app.use("/api/folders", requireAuth, folderRoutes);
app.use("/api/invoices", requireAuth, invoiceRoutes);
app.use("/api/organizations", requireAuth, organizationRoutes);
app.use("/api/profile", requireAuth, profileRoutes);
// Webhook must be first: no auth (Stripe verifies via signature), and must receive raw body
app.use("/api/billing", billingWebhookRoutes);
app.use("/api/billing", requireAuth, billingRoutes);
app.use("/api/billing", requireAuth, billingSummaryRoutes);
app.use("/api/contact", requireAuth, contactRoutes);
app.use("/api/admin", adminRoutes);

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Health check
 *     tags:
 *       - Health
 *     security: []
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 */
app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.listen(config.port, () => {
  console.log(`Invoice API running at http://localhost:${config.port}`);
});

export default app;
