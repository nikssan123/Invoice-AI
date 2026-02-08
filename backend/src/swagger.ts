import path from "path";
import { fileURLToPath } from "url";
import swaggerJsdoc from "swagger-jsdoc";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ext = __dirname.endsWith("dist") ? ".js" : ".ts";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Invoice intake and review API",
      version: "1.0.0",
      description: "API for uploading, extracting, and approving invoices",
    },
    servers: [{ url: "/" }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
  },
  apis: [
    path.join(__dirname, "routes", "auth" + ext),
    path.join(__dirname, "routes", "invoices" + ext),
    path.join(__dirname, "index" + ext),
  ],
};

export const swaggerSpec = swaggerJsdoc(options);
