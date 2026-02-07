import express from "express";
import cors from "cors";
import { config } from "./config.js";
import invoiceRoutes from "./routes/invoices.js";

const app = express();

app.use(cors({ origin: true }));
app.use(express.json());
app.use("/api/invoices", invoiceRoutes);

app.get("/health", (_req, res) => res.json({ ok: true }));

app.listen(config.port, () => {
  console.log(`Invoice API running at http://localhost:${config.port}`);
});

export default app;
