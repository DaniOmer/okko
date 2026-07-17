export type Notification =
  | { kind: 'invitation'; to: string; organizationName: string; inviteUrl: string; expiresAt: Date }
  | { kind: 'email_confirmation'; to: string; confirmUrl: string; expiresAt: Date };
export const NOTIFICATION_PORT = Symbol('NOTIFICATION_PORT');
export interface NotificationPort { send(n: Notification): Promise<void>; }
