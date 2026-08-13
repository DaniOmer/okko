import { NotificationLogRepository } from './notification-log.repository';
import { NotificationLogSnapshot } from '../../domain/notification/notification-log';

export class InMemoryNotificationLogRepository implements NotificationLogRepository {
  public readonly entries: NotificationLogSnapshot[] = [];
  async lastSentAt(dedupKey: string): Promise<string | null> {
    const e = this.entries.find((x) => x.dedupKey === dedupKey);
    return e ? e.sentAt : null;
  }
  async recordSent(entry: NotificationLogSnapshot): Promise<void> {
    const i = this.entries.findIndex((x) => x.dedupKey === entry.dedupKey);
    if (i >= 0) this.entries[i] = entry; else this.entries.push(entry);
  }
}
