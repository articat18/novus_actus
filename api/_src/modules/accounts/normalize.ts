/**
 * Input normalization and validation for credential-based accounts.
 *
 * Deliberately independent of the university identity rules: an account email
 * here is any well-formed address, not one restricted to a verified domain.
 */
import { InvalidRegistrationError } from "./errors.js";

const MAX_EMAIL_LENGTH = 320;
const MIN_PASSWORD_LENGTH = 10;
const MAX_PASSWORD_LENGTH = 200;
const MAX_DISPLAY_NAME_LENGTH = 80;

/** Lower-case and trim an address, rejecting anything not `local@domain`. */
export function normalizeAccountEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (normalized.length > MAX_EMAIL_LENGTH) {
    throw new InvalidRegistrationError("email is not a valid address");
  }
  const separator = normalized.lastIndexOf("@");
  const domain = normalized.slice(separator + 1);
  if (
    separator <= 0 ||
    separator !== normalized.indexOf("@") ||
    domain.length === 0 ||
    !domain.includes(".") ||
    domain.startsWith(".") ||
    domain.endsWith(".") ||
    /\s/.test(normalized)
  ) {
    throw new InvalidRegistrationError("email is not a valid address");
  }
  return normalized;
}

/**
 * Enforce password length only. Length is the property that actually resists
 * guessing; composition rules mostly push people toward predictable patterns.
 */
export function assertUsablePassword(password: string): string {
  if (
    password.length < MIN_PASSWORD_LENGTH ||
    password.length > MAX_PASSWORD_LENGTH
  ) {
    throw new InvalidRegistrationError(
      `password must be between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} characters`,
    );
  }
  return password;
}

/** Collapse whitespace in a display name and bound its length. */
export function normalizeDisplayName(displayName: string): string {
  const collapsed = displayName.trim().replace(/\s+/g, " ");
  if (collapsed.length === 0 || collapsed.length > MAX_DISPLAY_NAME_LENGTH) {
    throw new InvalidRegistrationError(
      `display name must be between 1 and ${MAX_DISPLAY_NAME_LENGTH} characters`,
    );
  }
  return collapsed;
}
