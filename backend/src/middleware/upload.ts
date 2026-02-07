import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { config } from "../config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(path.dirname(__dirname), "..", config.uploadDir);

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname) || "";
    cb(null, unique + ext);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed =
      /\.(pdf|png|jpg|jpeg|gif|webp)$/i.test(file.originalname) ||
      /^(image\/|application\/pdf)/.test(file.mimetype);
    if (allowed) cb(null, true);
    else cb(new Error("Only PDF and image files are allowed"));
  },
});

export function getUploadPath(filename: string): string {
  return path.join(uploadDir, filename);
}
