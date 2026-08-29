/**
 * Shared persistence conventions for time and fixed-precision energy values
 * (port of platform_app.persistence.conventions).
 *
 * Competition and energy values use fixed-precision decimals — never binary
 * floating point — matching REQ-NFR-001. Prisma maps `Numeric` columns to
 * `Prisma.Decimal` (decimal.js under the hood).
 */
import { Prisma } from "@prisma/client";

/** Number of fractional digits retained for energy in kWh. */
export const ENERGY_SCALE = 6;

/** A timezone-aware "now" (JS Date instants are UTC). */
export function utcNow(): Date {
  return new Date();
}

/** Normalize an energy value to fixed precision with banker's rounding. */
export function quantizeEnergy(value: Prisma.Decimal.Value): Prisma.Decimal {
  return new Prisma.Decimal(value).toDecimalPlaces(
    ENERGY_SCALE,
    Prisma.Decimal.ROUND_HALF_EVEN,
  );
}
