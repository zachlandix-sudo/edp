
import express from "express";
import {
  generateItinerary,
  getItineraryById,
} from "../controllers/itineraryController.js";

const router = express.Router();

// Generate and save a new itinerary
router.post("/generate", async (req, res, next) => {
  try {
    await generateItinerary(req, res);
  } catch (error) {
    next(error);
  }
});

// Retrieve a saved itinerary by ID
router.get("/:id", async (req, res, next) => {
  try {
    await getItineraryById(req, res);
  } catch (error) {
    next(error);
  }
});

export default router;
