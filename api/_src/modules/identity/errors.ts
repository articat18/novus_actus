/**
 * Safe authentication errors.
 *
 * Sign-in messages are deliberately generic so they never reveal whether an
 * account exists or which field was wrong.
 */

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** Sign-up with an email that already has an account (409). */
export class EmailAlreadyRegisteredError extends AuthError {}

/** Sign-up with a username that is already taken (409). */
export class UsernameAlreadyTakenError extends AuthError {}

/** Wrong email/password, or malformed sign-in input (401). */
export class InvalidCredentialsError extends AuthError {}

/** Missing, expired, or revoked session token (401). */
export class InvalidSessionError extends AuthError {}

/**
 * A route whose persistence is not wired yet (501). The MongoDB collections and
 * schemas for identity are defined in a later change; until then the auth
 * endpoints validate input and then report that they are not implemented.
 */
export class NotImplementedError extends AuthError {}
