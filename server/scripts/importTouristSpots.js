
import "dotenv/config";
import mongoose from "mongoose";
import { parse } from "csv-parse/sync";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import connectDB from "../src/config/database.js";
import TouristSpot from "../src/models/TouristSpot.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const csvPath = path.join(__dirname, "tourist-spots.csv");

const allowedCategories = [
  "Nature",
  "Beach",
  "Religious",
  "Historical",
  "Adventure",
  "Cultural",
  "Other",
];

function makeSlug(value) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function main() {
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found: ${csvPath}`);
  }

  await connectDB();

  const csvText = fs.readFileSync(csvPath, "utf8");

  const rows = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  });

  let imported = 0;
  let skipped = 0;

  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 2;

    if (!row.name || !row.description || !row.address) {
      console.warn(`Row ${rowNumber}: missing required fields; skipped.`);
      skipped++;
      continue;
    }

    if (!allowedCategories.includes(row.category)) {
      console.warn(`Row ${rowNumber}: invalid category; skipped.`);
      skipped++;
      continue;
    }

    const slug = makeSlug(row.slug || row.name);

    if (!slug) {
      console.warn(`Row ${rowNumber}: invalid slug; skipped.`);
      skipped++;
      continue;
    }

    const existing = await TouristSpot.findOne({ slug });

    if (existing) {
      console.warn(`Row ${rowNumber}: "${row.name}" already exists; skipped.`);
      skipped++;
      continue;
    }

    const entranceFee = Number(row.entranceFee || 0);
    const estimatedTravelCost = Number(row.estimatedTravelCost || 0);

    if (
      !Number.isFinite(entranceFee) ||
      entranceFee < 0 ||
      !Number.isFinite(estimatedTravelCost) ||
      estimatedTravelCost < 0
    ) {
      console.warn(`Row ${rowNumber}: invalid cost; skipped.`);
      skipped++;
      continue;
    }

    const latitude = row.latitude === "" || row.latitude == null
      ? undefined
      : Number(row.latitude);

    const longitude = row.longitude === "" || row.longitude == null
      ? undefined
      : Number(row.longitude);

    if (
      (latitude !== undefined &&
        (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) ||
      (longitude !== undefined &&
        (!Number.isFinite(longitude) || longitude < -180 || longitude > 180))
    ) {
      console.warn(`Row ${rowNumber}: invalid coordinates; skipped.`);
      skipped++;
      continue;
    }

    await TouristSpot.create({
      name: row.name,
      slug,
      description: row.description,
      category: row.category,
      address: row.address,
      coordinates: {
        ...(latitude !== undefined ? { latitude } : {}),
        ...(longitude !== undefined ? { longitude } : {}),
      },
      entranceFee,
      estimatedTravelCost,
      openingHours: row.openingHours || "",
      contactDetails: row.contactDetails || "",
      imageUrl: row.imageUrl || "",
      gallery: row.gallery
        ? row.gallery.split("|").map((url) => url.trim()).filter(Boolean)
        : [],
      status: ["draft", "published", "inactive"].includes(row.status)
        ? row.status
        : "published",
    });

    console.log(`Imported: ${row.name}`);
    imported++;
  }

  console.log(`\nImport finished. Imported: ${imported}; skipped: ${skipped}.`);
}

main()
  .catch((error) => {
    console.error("Import failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
