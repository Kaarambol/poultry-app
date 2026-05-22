#!/usr/bin/env node
/**
 * Safe migration deploy script.
 * Marks migrations that were applied via `db push` (outside of migrate)
 * as resolved, then runs `migrate deploy` for any truly new migrations.
 */

const { execSync } = require("child_process");

// These migrations were applied to production via `db push` and are already
// present in the DB schema but NOT recorded in _prisma_migrations.
// Mark them as applied so migrate deploy doesn't try to re-run them.
const alreadyApplied = [
  "20260330000001_fix_missing_fields",
  "20260330000002_add_forum",
  "20260403000001_fix_thinbirds",
  "20260403000002_daily_litter_ammonia",
  "20260409000001_add_sale_accept_weight",
  "20260509000001_add_allow_multiple_to_farm_document",
  "20260513000001_add_darkness_checktime",
  "20260513000002_add_superadmin",
  "20260513000003_add_thin_clear_weights",
  "20260522000001_add_feed_bins",
];

for (const name of alreadyApplied) {
  try {
    execSync(`npx prisma migrate resolve --applied ${name}`, { stdio: "inherit" });
  } catch {
    // Already recorded — ignore
  }
}

// Now deploy any genuinely new migrations (e.g. add_feed_bins)
execSync("npx prisma migrate deploy", { stdio: "inherit" });
