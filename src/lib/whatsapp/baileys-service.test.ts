import { describe, it, expect } from 'vitest';
import {
  getBaileysSession,
  isBaileysConnected,
  hasBaileysSession,
  cleanOrphanSessions,
} from './baileys-service';

describe('Baileys WhatsApp Service', () => {
  it('returns default session state for an account', () => {
    const session = getBaileysSession('test-account-123');
    expect(session).toBeDefined();
    expect(['idle', 'disconnected']).toContain(session.status);
    expect(session.qrCode).toBeNull();
  });

  it('correctly reports connection status for unlinked account', () => {
    expect(isBaileysConnected('non-existent-account')).toBe(false);
    expect(hasBaileysSession('non-existent-account')).toBe(false);
  });

  it('handles cleanOrphanSessions safely without errors', () => {
    expect(() => cleanOrphanSessions('test-account-123')).not.toThrow();
  });
});

