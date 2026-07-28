export interface ZonePestPresenceSnapshot {
  zoneId: string;
  pestId: string;
  frequency: string;
}

interface CreateProps {
  zoneId: string;
  pestId: string;
  frequency: string;
}

export class ZonePestPresence {
  private constructor(
    private readonly _zoneId: string,
    private readonly _pestId: string,
    private readonly _frequency: string,
  ) {}

  static create(props: CreateProps): ZonePestPresence {
    return new ZonePestPresence(props.zoneId, props.pestId, props.frequency);
  }

  get zoneId(): string { return this._zoneId; }
  get pestId(): string { return this._pestId; }
  get frequency(): string { return this._frequency; }

  toSnapshot(): ZonePestPresenceSnapshot {
    return { zoneId: this._zoneId, pestId: this._pestId, frequency: this._frequency };
  }

  static fromSnapshot(s: ZonePestPresenceSnapshot): ZonePestPresence {
    return new ZonePestPresence(s.zoneId, s.pestId, s.frequency);
  }
}
