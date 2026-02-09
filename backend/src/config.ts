import dotenv from "dotenv";
dotenv.config( { path: ".env" });

export interface Config {
  port: number;
  uploadDir: string;
  ocrServiceUrl: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpClientId: string;
  smtpClientSecret: string;
  smtpRefreshToken: string;
  appUrl: string;
  emailFrom?: string;
}

export const config: Config = {
  port: parseInt(process.env.PORT ?? "3001", 10),
  uploadDir: process.env.UPLOAD_DIR ?? "uploads",
  ocrServiceUrl: process.env.OCR_SERVICE_URL ?? "http://localhost:8000",
  jwtSecret: process.env.JWT_SECRET ?? "JWT_SECRET",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  smtpHost: process.env.SMTP_HOST ?? "",
  smtpPort: parseInt(process.env.SMTP_PORT ?? "587", 10),
  smtpUser: process.env.SMTP_USER ?? "",
  smtpClientId: process.env.SMTP_CLIENT_ID ?? "",
  smtpClientSecret: process.env.SMTP_CLIENT_SECRET ?? "",
  smtpRefreshToken: process.env.SMTP_REFRESH_TOKEN ?? "",
  appUrl: process.env.APP_URL ?? "http://localhost:4173",
  emailFrom: process.env.EMAIL_FROM,
};
