/** Organization name and slug normalization. */
import { InvalidOrganizationError } from "./errors.js";

const MAX_NAME_LENGTH = 120;

/** Collapse whitespace in an organization name and bound its length. */
export function normalizeOrganizationName(name: string): string {
  const collapsed = name.trim().replace(/\s+/g, " ");
  if (collapsed.length === 0 || collapsed.length > MAX_NAME_LENGTH) {
    throw new InvalidOrganizationError(
      `name must be between 1 and ${MAX_NAME_LENGTH} characters`,
    );
  }
  return collapsed;
}

/**
 * Derive a url-safe slug from a name. Names that reduce to nothing (for
 * example emoji only) fall back to a stable prefix so a slug always exists.
 */
export function slugify(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
  return slug.length === 0 ? "org" : slug;
}
