import { GoogleGenAI } from "@google/genai";
import mongoose from "mongoose";
import Itinerary from "../models/Itinerary.js";
import TouristSpot from "../models/TouristSpot.js";

const allowedPaces = ["relaxed", "moderate", "packed"];

function validatePreferences(body = {}) {
  const travelers = Number(body.travelers);
  const startingBudgetPerPerson = Number(
    body.startingBudgetPerPerson
  );

  if (
    !Number.isInteger(travelers) ||
    travelers < 1 ||
    travelers > 50
  ) {
    throw new Error(
      "Travelers must be an integer between 1 and 50."
    );
  }

  if (
    !Number.isFinite(startingBudgetPerPerson) ||
    startingBudgetPerPerson < 0 ||
    startingBudgetPerPerson > 1000000
  ) {
    throw new Error(
      "Starting budget must be between PHP 0 and PHP 1,000,000 per person."
    );
  }

  const pace = body.pace || "moderate";

  if (!allowedPaces.includes(pace)) {
    throw new Error(
      "Pace must be relaxed, moderate, or packed."
    );
  }

  const interests = Array.isArray(body.interests)
    ? body.interests
        .filter(
          (interest) =>
            typeof interest === "string" &&
            interest.trim().length > 0
        )
        .slice(0, 10)
    : [];

  return {
    travelers,
    startingBudgetPerPerson,
    pace,
    interests,
  };
}

function parseJsonResponse(text) {
  const cleaned = String(text || "")
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  if (!cleaned) {
    throw new Error("Gemini returned an empty response.");
  }

  return JSON.parse(cleaned);
}

function calculateBudget(
  stops,
  travelers,
  startingBudgetPerPerson
) {
  const entranceFees = stops.reduce(
    (sum, stop) =>
      sum + stop.estimatedEntranceFeePerPerson * travelers,
    0
  );

  const transportation = stops.reduce(
    (sum, stop) =>
      sum + stop.estimatedTransportCostForGroup,
    0
  );

  const food = stops.reduce(
    (sum, stop) =>
      sum + stop.estimatedFoodCostPerPerson * travelers,
    0
  );

  const totalGroupCost =
    entranceFees + transportation + food;

  const totalPerPerson = totalGroupCost / travelers;
  const startingGroupBudget =
    startingBudgetPerPerson * travelers;

  return {
    entranceFees,
    transportation,
    food,
    other: 0,
    totalGroupCost,
    totalPerPerson:
      Math.round(totalPerPerson * 100) / 100,
    remainingGroupBudget:
      startingGroupBudget - totalGroupCost,
    remainingPerPersonBudget:
      startingBudgetPerPerson - totalPerPerson,
    currency: "PHP",
  };
}

function getErrorStatus(error) {
  return (
    error?.status ||
    error?.statusCode ||
    error?.response?.status ||
    error?.error?.status
  );
}

function getSafeErrorMessage(error) {
  const status = getErrorStatus(error);
  const message = String(error?.message || "");

  if (status === 401 || status === 403) {
    return "Gemini authentication failed. Check the server API key and permissions.";
  }

  if (status === 429) {
    return "Gemini API quota or rate limit reached. Check your API quota and try again later.";
  }

  if (status === 503 || status === 504) {
    return "Gemini is temporarily unavailable. Please try again later.";
  }

  if (
    message.includes("Gemini returned invalid JSON") ||
    message.includes("Gemini returned an empty response")
  ) {
    return "The AI returned an invalid response. Please try again.";
  }

  return "Unable to generate itinerary. Check the server terminal for the detailed error.";
}
export async function generateItinerary(req, res) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || !apiKey.trim()) {
      return res.status(503).json({
        message:
          "Gemini API key is not configured on the server. Add GEMINI_API_KEY to server/.env and restart the server.",
      });
    }

    console.log("[ITINERARY] Validating visitor preferences...");
    const preferences = validatePreferences(req.body);

    console.log("[ITINERARY] Loading published tourist spots...");
    const touristSpots = await TouristSpot.find({
      status: "published",
    })
      .select(
        "name slug description shortDescription category address entranceFee estimatedTravelCost openingHours bestTimeToVisit travelTips"
      )
      .lean();

    if (!touristSpots.length) {
      return res.status(400).json({
        message:
          "No published tourist spots are available for itinerary generation.",
      });
    }

    console.log(
      `[ITINERARY] Loaded ${touristSpots.length} published tourist spots.`
    );

    const ai = new GoogleGenAI({ apiKey });
    const model =
      process.env.GEMINI_MODEL || "gemini-3.8-flash";

    console.log(
      `[ITINERARY] Starting Gemini request with model: ${model}`
    );

    const prompt = `
You are a tourism itinerary assistant for Maasin City,
Southern Leyte, Philippines.

Create a practical one-day itinerary using ONLY the supplied
published tourist spots. Do not invent destinations, entrance
fees, opening hours, or verified travel durations.

Visitor preferences:
${JSON.stringify(preferences)}

Available tourist spots:
${JSON.stringify(
  touristSpots.map((spot) => ({
    name: spot.name,
    slug: spot.slug,
    description: spot.description,
    shortDescription: spot.shortDescription,
    category: spot.category,
    address: spot.address,
    entranceFee: spot.entranceFee,
    estimatedTravelCost: spot.estimatedTravelCost,
    openingHours: spot.openingHours,
    bestTimeToVisit: spot.bestTimeToVisit,
    travelTips: spot.travelTips,
  }))
)}

Return ONLY valid JSON with this structure:
{
  "title": "string",
  "summary": "string",
  "stops": [
    {
      "slug": "existing tourist spot slug",
      "name": "existing tourist spot name",
      "startTime": "08:00 AM",
      "endTime": "09:00 AM",
      "activity": "string",
      "estimatedEntranceFeePerPerson": 0,
      "estimatedTransportCostForGroup": 0,
      "estimatedFoodCostPerPerson": 0
    }
  ],
  "travelTips": ["string"]
}

Rules:
- Include only supplied tourist spots and use their exact slugs.
- Aim for 3 to 5 different stops when enough suitable published tourist spots are available.
- Never repeat a tourist spot in the same itinerary.
- If fewer than 3 suitable published tourist spots exist, use only the available suitable spots. Never invent destinations to reach the target.
- Create a sensible one-day schedule with realistic time slots and travel breaks.
- Respect the visitor's interests and preferred pace.
- Use supplied entrance fees and transportation costs when available.
- Include reasonable food cost estimates only when supported by available data; otherwise use 0.
- Keep the total estimated group cost within the starting group budget whenever possible.
- If the budget is too low for the available destinations, choose the most affordable suitable itinerary and explain the limitation in the summary.
- Do not claim that unknown costs are verified prices.
- If a cost is unknown, use 0 instead of inventing a factual price.
- Cost fields must be non-negative numbers in Philippine pesos.
- estimatedTransportCostForGroup is the cost for the whole group.
- Keep activities and advice practical.
`;

    // Stop waiting indefinitely if Gemini does not respond.
    let timeoutId;
    let response;

    try {
      response = await Promise.race([
        ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseMimeType: "application/json",
          },
        }),
        new Promise((_, reject) => {
          timeoutId = setTimeout(() => {
            const error = new Error(
              "Gemini request timed out after 60 seconds."
            );
            error.status = 504;
            reject(error);
          }, 60000);
        }),
      ]);
    } finally {
      clearTimeout(timeoutId);
    }

    console.log(
      "[ITINERARY] Gemini response received; parsing JSON..."
    );

    const generated = parseJsonResponse(
      response.text || ""
    );

    if (
      !generated ||
      typeof generated.title !== "string" ||
      !Array.isArray(generated.stops)
    ) {
      throw new Error(
        "Gemini returned invalid JSON or an invalid itinerary structure."
      );
    }

    console.log(
      `[ITINERARY] AI returned ${generated.stops.length} stops.`
    );

    const spotsBySlug = new Map(
  touristSpots.map((spot) => [
    String(spot.slug).trim().toLowerCase(),
    spot,
  ])
);

    const nonNegativeNumber = (value) => {
      const number = Number(value);

      return Number.isFinite(number) && number >= 0
        ? number
        : 0;
    };


    const seenSlugs = new Set();

    const stops = generated.stops
      .filter((stop) => {
        const slug = String(stop.slug || "").trim();

        if (!slug || seenSlugs.has(slug)) {
          return false;
        }

        seenSlugs.add(slug);
        return true;
      })
      .map((stop) => {
        const spot = spotsBySlug.get(
  String(stop.slug || "").trim().toLowerCase()
);

        if (!spot) {
          throw new Error(
            "Gemini returned a destination that is not in the database."
          );
        }

        return {
          touristSpot: spot._id,
          name: spot.name,
          startTime: String(stop.startTime || ""),
          endTime: String(stop.endTime || ""),
          activity: String(stop.activity || ""),
          estimatedEntranceFeePerPerson:
            nonNegativeNumber(
              stop.estimatedEntranceFeePerPerson
            ),
          estimatedTransportCostForGroup:
            nonNegativeNumber(
              stop.estimatedTransportCostForGroup
            ),
          estimatedFoodCostPerPerson:
            nonNegativeNumber(
              stop.estimatedFoodCostPerPerson
            ),
        };
      });

    if (!stops.length) {
      return res.status(422).json({
        message:
          "The AI did not produce any itinerary stops. Please try again.",
      });
    }

    const budget = calculateBudget(
      stops,
      preferences.travelers,
      preferences.startingBudgetPerPerson
    );

    if (budget.totalGroupCost > preferences.startingBudgetPerPerson * preferences.travelers) {
  console.warn(
    "[ITINERARY] Generated itinerary exceeds the visitor's budget.",
    {
      estimatedGroupCost: budget.totalGroupCost,
      startingGroupBudget:
        preferences.startingBudgetPerPerson * preferences.travelers,
    }
  );
}

    console.log(
      "[ITINERARY] Saving generated itinerary to MongoDB..."
    );
        const itinerary = await Itinerary.create({
      title: generated.title.trim().slice(0, 150),
      duration: "one-day",
      interests: preferences.interests,
      travelers: preferences.travelers,
      startingBudgetPerPerson:
        preferences.startingBudgetPerPerson,
      pace: preferences.pace,
      stops,
      budget,
      summary: String(
        generated.summary || ""
      ).slice(0, 2000),
      travelTips: Array.isArray(generated.travelTips)
        ? generated.travelTips
            .filter((tip) => typeof tip === "string")
            .slice(0, 20)
        : [],
      status: "generated",
    });

    console.log(
      `[ITINERARY] Saved itinerary ${itinerary._id}.`
    );

    return res.status(201).json({
      message: "Itinerary generated and saved successfully.",
      itinerary,
    });
  } catch (error) {
    console.error("[ITINERARY] Generate itinerary error:", {
      message: error?.message,
      status: getErrorStatus(error),
      name: error?.name,
    });

    if (
      error.message?.includes("Travelers must") ||
      error.message?.includes("Starting budget must") ||
      error.message?.includes("Pace must")
    ) {
      return res.status(400).json({
        message: error.message,
      });
    }

    if (
      error instanceof SyntaxError ||
      error.message?.includes("Gemini returned an empty response")
    ) {
      return res.status(502).json({
        message:
          "The AI returned an invalid response. Please try again.",
      });
    }

    const status = getErrorStatus(error);

    if (status === 401 || status === 403) {
      return res.status(503).json({
        message:
          "Gemini authentication failed. Check the server API key and permissions.",
      });
    }

    if (status === 429) {
      return res.status(503).json({
        message:
          "Gemini API quota or rate limit reached. Check your API quota and try again later.",
      });
    }

    if (
      status === 504 ||
      String(error?.message || "").includes("timed out")
    ) {
      return res.status(504).json({
        message:
          "Gemini took too long to respond. Check GEMINI_MODEL and your Gemini API access, then try again.",
      });
    }

    if (status === 503) {
      return res.status(503).json({
        message:
          "Gemini is temporarily unavailable. Please try again later.",
      });
    }

    return res.status(500).json({
      message: getSafeErrorMessage(error),
    });
  }
}

export async function getItineraryById(req, res) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid itinerary ID.",
      });
    }

    const itinerary = await Itinerary.findById(
      req.params.id
    )
      .populate(
        "stops.touristSpot",
        "name slug category address imageUrl"
      )
      .lean();

    if (!itinerary) {
      return res.status(404).json({
        message: "Itinerary not found.",
      });
    }

    return res.json({ itinerary });
  } catch (error) {
    console.error("Get itinerary error:", {
      message: error?.message,
      name: error?.name,
    });

    return res.status(500).json({
      message: "Unable to retrieve itinerary.",
    });
  }
}