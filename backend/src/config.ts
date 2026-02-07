export interface Config {
  port: number;
  uploadDir: string;
}

export const config: Config = {
  port: parseInt(process.env.PORT ?? "3001", 10),
  uploadDir: process.env.UPLOAD_DIR ?? "uploads",
};
