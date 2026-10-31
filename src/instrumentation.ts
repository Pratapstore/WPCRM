import dns from 'node:dns';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      dns.setDefaultResultOrder('ipv4first');
      console.log('[Instrumentation] DNS default result order set to ipv4first');
    } catch (e) {
      console.warn('[Instrumentation] Failed to set DNS result order:', e);
    }
  }
}

