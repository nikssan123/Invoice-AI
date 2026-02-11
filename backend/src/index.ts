import express from "express";
import cors from "cors";
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
import { swaggerSpec } from "./swagger.js";

const app = express();

app.use(cors({ origin: true }));
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
