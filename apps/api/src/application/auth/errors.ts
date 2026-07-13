export class EmailAlreadyUsedError extends Error {}
export class InvalidCredentialsError extends Error {}
export class InvitationNotFoundError extends Error {}
export class InvitationInvalidError extends Error {}  // expirée / consommée / révoquée
export class ForbiddenOrgError extends Error {}       // action inter-organisation
