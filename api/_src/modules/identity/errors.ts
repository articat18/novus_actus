/**
 * Safe authentication errors (port of the IdentityError hierarchy).
 *
 * Messages are deliberately generic so they can be returned to clients without
 * revealing whether an account or email exists.
 */

export class IdentityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class UniversityDomainError extends IdentityError {}
export class ChallengeRateLimitError extends IdentityError {}
export class InvalidChallengeError extends IdentityError {}
export class RosterIneligibleError extends IdentityError {}
export class UsernameUnavailableError extends IdentityError {}
export class InvalidSessionError extends IdentityError {}
