import { describe, it, expect } from 'vitest';
import { getBaileysSession } from './baileys-service';

describe('Baileys WhatsApp Service', () => {
  it('returns default session state for an account', () => {
    const session = getBaileysSession('test-account-123');
    expect(session).toBeDefined();
    expect(['idle', 'disconnected']).toContain(session.status);
    expect(session.qrCode).toBeNull();
  });
});
