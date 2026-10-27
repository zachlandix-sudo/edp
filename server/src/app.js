import express from "express";
import cors from "cors";
import spotRoutes from "./routes/spotRoutes.js";
import itineraryRoutes from "./routes/itineraryRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";

const app = express();

// Only trust the proxy header when the host tells us we are behind one (for example on Render).
if (process.env.TRUST_PROXY === "1") {
  app.set("trust proxy", 1);
}

// bag-o nga gi-add
app.use((req, res, next) => {
  console.log(`[REQUEST] ${req.method} ${req.originalUrl}`);
  next();
});

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/", (_req, res) => {
  res.json({
    message: "Welcome to MAASIN TOUR GUIDE API",
    endpoints: {
      health: "/api/health",
      touristSpots: "/api/spots",
      touristSpotById: "/api/spots/:id",
    },
  });
});

app.get("/api/health", (_req, res) => {
  res.status(200).json({ status: "ok", service: "maasin-tour-guide-api" });
});

// temporary replacement app.use("/api/spots", spotRoutes);

app.use("/api/spots", spotRoutes);
app.use("/api/itineraries", itineraryRoutes);
app.use("/api/chat", chatRoutes);

// JSON response for unknown routes
app.use((_req, res) => {
  res.status(404).json({ message: "API route not found." });
});

// Central error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({
    message: err.status ? err.message : "Internal server error.",
  });
});

export default app;