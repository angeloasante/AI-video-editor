import cors from "cors";
import { env } from "./env.js";

export const corsOptions: cors.CorsOptions = {
  origin: [
    env.FRONTEND_URL,
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    "http://localhost:3003",
    "http://localhost:3004",
    "http://localhost:3005",
    /\.vercel\.app$/,
    /\.kluxta\.com$/,
    "https://kluxta.com",
    "https://studio.kluxta.com",
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Request-ID"],
};
