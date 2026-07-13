import { Injectable } from '@nestjs/common';
import { Notification, NotificationPort } from '../../application/notification/notification-port';

@Injectable()
export class FakeNotificationSender implements NotificationPort {
  public readonly sent: Notification[] = [];
  async send(n: Notification): Promise<void> { this.sent.push(n); }
}
