import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import { config } from "./config.js";
import { requireAuth } from "./middleware/auth.js";
import authRoutes from "./routes/auth.js";
import invoiceRoutes from "./routes/invoices.js";
import { swaggerSpec } from "./swagger.js";

const app = express();

app.use(cors({ origin: true }));
app.use(express.json());
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use("/api/auth", authRoutes);
app.use("/api/invoices", requireAuth, invoiceRoutes);

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
 *                 ok:
 *                   type: boolean
 *                   example: true
 */
app.get("/health", (_req, res) => res.json({ ok: true }));

app.listen(config.port, () => {
  console.log(`Invoice API running at http://localhost:${config.port}`);
});

export default app;
