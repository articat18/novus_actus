/** Organization and membership errors. */

export class OrganizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** The caller's membership does not permit the operation, or there is none. */
export class OrganizationAccessDeniedError extends OrganizationError {
  constructor(message = "operation is not authorized") {
    super(message);
  }
}

export class OrganizationNotFoundError extends OrganizationError {}
export class MemberNotFoundError extends OrganizationError {}
export class AlreadyMemberError extends OrganizationError {}
/** Removing or demoting the subject would leave the organization ownerless. */
export class LastOwnerError extends OrganizationError {}
export class InvalidOrganizationError extends OrganizationError {}
