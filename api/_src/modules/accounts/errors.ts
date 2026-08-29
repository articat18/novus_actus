/**
 * Account errors. Login-facing messages never distinguish an unknown email
 * from a wrong password.
 */

export class AccountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** Registration input that cannot be accepted (email shape, password length). */
export class InvalidRegistrationError extends AccountError {}

/** The email is already registered. Only ever returned on registration. */
export class EmailAlreadyRegisteredError extends AccountError {}

/** Wrong password, unknown email, or a disabled account — deliberately merged. */
export class InvalidCredentialsError extends AccountError {}

/** The bearer token does not identify a credential-backed account. */
export class AccountSessionError extends AccountError {}
