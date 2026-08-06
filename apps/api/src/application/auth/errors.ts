export class EmailAlreadyUsedError extends Error {}
export class InvalidCredentialsError extends Error {}
export class InvitationNotFoundError extends Error {}
export class InvitationInvalidError extends Error {}  // expirée / consommée / révoquée
export class ForbiddenOrgError extends Error {}       // action inter-organisation
export class EmailNotConfirmedError extends Error {}   // login d'un compte non confirmé
export class ConfirmationInvalidError extends Error {}  // token de confirmation introuvable/expiré
export class InvalidRoleForOrgError extends Error {
  constructor(public readonly role: string) { super(`Role ${role} not allowed for this organization`); this.name = 'InvalidRoleForOrgError'; }
}
export class OrganizationNotFoundError extends Error {
  constructor(public readonly organizationId: string) { super(`Organization ${organizationId} not found`); this.name = 'OrganizationNotFoundError'; }
}
