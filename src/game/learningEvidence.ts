const APPS_SCRIPT_WEB_APP_URL =
  'https://script.google.com/macros/s/AKfycbwKNSR73WFB4k6cBouQobtVZUK-TCnYnG_HYU-f7RcBnkpvEkp_Kb3NtH6O59AaISG9zg/exec';

export type EvidenceAction =
  | 'clue_opened'
  | 'stamp_added'
  | 'emotion_answer'
  | 'evidence_answer'
  | 'emotion_order_submitted'
  | 'reflection_submitted'
  | 'session_completed';

export interface EvidenceEventInput {
  action: EvidenceAction;
  stageId?: string;
  clueId?: string;
  choiceId?: string;
  isCorrect?: boolean;
  attemptNo?: number;
  hintLevel?: string;
  responseText?: string;
}

interface SessionOptions {
  mode: string;
  sessionLength: string;
}

interface StoredEvent extends EvidenceEventInput {
  sessionId: string;
  eventId: string;
  eventIndex: number;
  occurredAt: string;
  elapsedMs: number;
}

/** Sends anonymous learning evidence to the deployed Apps Script web app. */
export class LearningEvidence {
  private sessionId = '';
  private startedAt = '';
  private startedAtMs = 0;
  private mode = '';
  private sessionLength = '';
  private eventIndex = 0;
  private pendingEvents: StoredEvent[] = [];
  private sendQueue: Promise<void> = Promise.resolve();

  start(options: SessionOptions): void {
    this.sessionId = createId('session');
    this.startedAt = new Date().toISOString();
    this.startedAtMs = Date.now();
    this.mode = options.mode;
    this.sessionLength = options.sessionLength;
    this.eventIndex = 0;
    this.pendingEvents = [];

    void this.enqueue({
      type: 'session',
      session: {
        sessionId: this.sessionId,
        gameId: 'qianchibi-fu',
        contentVersion: 'mvp-1',
        mode: this.mode,
        sessionLength: this.sessionLength,
        startedAt: this.startedAt,
        completed: false,
      },
    });
  }

  record(input: EvidenceEventInput): void {
    if (!this.sessionId) return;

    this.pendingEvents.push({
      ...input,
      sessionId: this.sessionId,
      eventId: `${this.sessionId}-e${this.eventIndex.toString(36)}`,
      eventIndex: this.eventIndex,
      occurredAt: new Date().toISOString(),
      elapsedMs: Math.max(0, Date.now() - this.startedAtMs),
    });
    this.eventIndex += 1;

    if (this.pendingEvents.length >= 12) this.flushEvents();
  }

  async complete(reflectionText: string): Promise<void> {
    if (!this.sessionId) return;

    const completedAt = new Date().toISOString();
    if (reflectionText.trim()) {
      this.record({
        action: 'reflection_submitted',
        responseText: reflectionText.trim(),
      });
    }
    this.record({ action: 'session_completed' });
    this.flushEvents();

    await this.enqueue({
      type: 'session',
      session: {
        sessionId: this.sessionId,
        gameId: 'qianchibi-fu',
        contentVersion: 'mvp-1',
        mode: this.mode,
        sessionLength: this.sessionLength,
        startedAt: this.startedAt,
        completedAt,
        completed: true,
      },
    });
  }

  private flushEvents(): void {
    if (!this.sessionId || this.pendingEvents.length === 0) return;
    const events = this.pendingEvents.splice(0);
    void this.enqueue({ type: 'responses', sessionId: this.sessionId, events });
  }

  private enqueue(payload: unknown): Promise<void> {
    this.sendQueue = this.sendQueue
      .then(() => this.post(payload))
      .catch((error: unknown) => {
        console.error('Learning evidence could not be sent.', error);
      });
    return this.sendQueue;
  }

  private async post(payload: unknown): Promise<void> {
    const body = JSON.stringify(payload);
    let lastError: unknown;

    // Apps Script's ContentService response is cross-origin. A text/plain,
    // no-cors POST avoids a preflight; the game only needs to submit, not read
    // the response body.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await fetch(APPS_SCRIPT_WEB_APP_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
          body,
          keepalive: true,
        });
        return;
      } catch (error) {
        lastError = error;
        if (attempt === 0) await new Promise((resolve) => window.setTimeout(resolve, 300));
      }
    }

    throw lastError;
  }
}

function createId(prefix: string): string {
  const randomPart = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return `${prefix}-${randomPart}`;
}
