// preload.mjs
import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Загружаем .env
dotenv.config({ path: path.join(__dirname, ".env") })

console.log("✅ .env variables loaded")
