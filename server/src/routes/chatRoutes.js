import express from "express";
import { chat } from "../controllers/chatController.js";

const router = express.Router();

// Simple in-memory rate limit: 20 requests per minute per IP.
const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 20;
const hits = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of hits) {
    if (now - entry.start > WINDOW_MS) hits.delete(ip);
  }
}, WINDOW_MS).unref();

function rateLimit(req, res, next) {
  const now = Date.now();
  const entry = hits.get(req.ip);

  if (!entry || now - entry.start > WINDOW_MS) {
    hits.set(req.ip, { start: now, count: 1 });
    return next();
  }

  entry.count += 1;

  if (entry.count > MAX_REQUESTS) {
    return res.status(429).json({
      message: "Too many messages. Please wait a minute and try again.",
    });
  }

  return next();
}

router.post("/", rateLimit, async (req, res, next) => {
  try {
    await chat(req, res);
  } catch (error) {
    next(error);
  }
});

export default router;