/**
 * Replaceable outbound identity interfaces (port of identity.ports).
 */

export interface EmailCodeSender {
  /** Deliver a single-use university-email verification code. */
  sendCode(email: string, code: string, expiresAt: Date): void | Promise<void>;
}

/**
 * Demo adapter that retains codes in process without logging them. Also backs
 * the optional development inbox so the browser demo can display the code
 * (there is no real email integration in the demo).
 */
export class InMemoryEmailCodeSender implements EmailCodeSender {
  private readonly outbox = new Map<string, { code: string; expiresAt: Date }>();

  sendCode(email: string, code: string, expiresAt: Date): void {
    this.outbox.set(email, { code, expiresAt });
  }

  /** The most recent code for an address. Throws if none was issued. */
  codeFor(email: string): string {
    const entry = this.outbox.get(email);
    if (entry === undefined) {
      throw new Error(`no verification code issued for ${email}`);
    }
    return entry.code;
  }

  /** The most recent code for an address, or null. */
  peek(email: string): { code: string; expiresAt: Date } | null {
    return this.outbox.get(email) ?? null;
  }
}
