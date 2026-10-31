import fs from 'fs';
import path from 'path';
import pino from 'pino';
import QRCode from 'qrcode';
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestWaWebVersion,
  Browsers,
  type WASocket,
  type ConnectionState,
  type WAMessage,
} from '@whiskeysockets/baileys';
import { supabaseAdmin } from '@/lib/flows/admin-client';
import { dispatchInboundToFlows } from '@/lib/flows/engine';
import { processCommerceInboundMessage, isProductAction } from '@/lib/orders/commerce-bot';

export interface BaileysSessionState {
  sessionId: string;
  sessionName: string;
  status: 'idle' | 'connecting' | 'qr_ready' | 'connected' | 'disconnected';
  qrCode: string | null;
  rawQr: string | null;
  pairingCode: string | null;
  phoneNumber: string | null;
  pushName: string | null;
  lastError: string | null;
  updatedAt: number;
  connectedAt: number | null;
  isDefault: boolean;
  platform: string;
}

export interface BaileysSessionSummary {
  sessionId: string;
  sessionName: string;
  status: 'idle' | 'connecting' | 'qr_ready' | 'connected' | 'disconnected';
  phoneNumber: string | null;
  pushName: string | null;
  isDefault: boolean;
  connectedAt: number | null;
  updatedAt: number;
  platform: string;
  hasSavedAuth: boolean;
}

interface ActiveSession {
  sock: WASocket | null;
  state: BaileysSessionState;
  reconnectTimer?: NodeJS.Timeout;
  isTerminated?: boolean;
  handshakeRetries?: number;
}

// Global registry for persistent sessions across route invocations
const globalSessions = (
  globalThis as unknown as {
    __wa_baileys_sessions?: Map<string, ActiveSession>;
  }
);
if (!globalSessions.__wa_baileys_sessions) {
  globalSessions.__wa_baileys_sessions = new Map<string, ActiveSession>();
}
const sessions = globalSessions.__wa_baileys_sessions;

export function getSessionKey(accountId: string, sessionId: string = 'primary'): string {
  const cleanId = sessionId === 'default' ? 'primary' : sessionId;
  return cleanId === 'primary' ? accountId : `${accountId}__${cleanId}`;
}

export function getSessionDir(accountId: string, sessionId: string = 'primary', autoCreate: boolean = true): string {
  const baseDir = path.join(process.cwd(), 'data', 'baileys_auth');
  if (autoCreate && !fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }
  const folderName = getSessionKey(accountId, sessionId);
  const accountDir = path.join(baseDir, folderName);
  if (autoCreate && !fs.existsSync(accountDir)) {
    fs.mkdirSync(accountDir, { recursive: true });
  }
  return accountDir;
}

function readSessionInfo(sessionDir: string): {
  phoneNumber: string | null;
  pushName: string | null;
  sessionName: string;
  connectedAt: number | null;
  isDefault: boolean;
  platform: string;
  hasRegisteredAuth: boolean;
} {
  const infoFile = path.join(sessionDir, 'session_info.json');
  let meta: any = {};
  if (fs.existsSync(infoFile)) {
    try {
      meta = JSON.parse(fs.readFileSync(infoFile, 'utf-8'));
    } catch {}
  }

  // Inspect creds.json
  const credsFile = path.join(sessionDir, 'creds.json');
  let phoneNumber: string | null = meta.phoneNumber || null;
  let pushName: string | null = meta.pushName || null;
  let hasRegisteredAuth = false;

  if (fs.existsSync(credsFile)) {
    try {
      const creds = JSON.parse(fs.readFileSync(credsFile, 'utf-8'));
      if (creds.registered) {
        hasRegisteredAuth = true;
      }
      if (creds.me?.id && !phoneNumber) {
        const raw = creds.me.id.split(':')[0].replace(/@.*/, '').replace(/\D/g, '');
        if (raw) phoneNumber = raw.startsWith('+') ? raw : `+${raw}`;
      }
      if (creds.me?.name && !pushName) {
        pushName = creds.me.name;
      }
    } catch {}
  }

  return {
    phoneNumber,
    pushName,
    sessionName: meta.sessionName || 'Primary WhatsApp',
    connectedAt: meta.connectedAt || null,
    isDefault: meta.isDefault ?? true,
    platform: meta.platform || 'WhatsApp Web (Chrome / Ubuntu)',
    hasRegisteredAuth,
  };
}

function writeSessionInfo(
  sessionDir: string,
  data: Partial<{
    phoneNumber: string | null;
    pushName: string | null;
    sessionName: string;
    connectedAt: number | null;
    isDefault: boolean;
    platform: string;
  }>
): void {
  try {
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }
    const infoFile = path.join(sessionDir, 'session_info.json');
    let existing: any = {};
    if (fs.existsSync(infoFile)) {
      try {
        existing = JSON.parse(fs.readFileSync(infoFile, 'utf-8'));
      } catch {}
    }
    fs.writeFileSync(infoFile, JSON.stringify({ ...existing, ...data }, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Baileys] Error writing session_info.json:', err);
  }
}

/**
 * Return ONLY registered and logged-in WhatsApp sessions for an account.
 */
export function getAllBaileysSessions(accountId: string): BaileysSessionSummary[] {
  const baseDir = path.join(process.cwd(), 'data', 'baileys_auth');
  const result: BaileysSessionSummary[] = [];
  const visited = new Set<string>();

  if (fs.existsSync(baseDir)) {
    try {
      const entries = fs.readdirSync(baseDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name === accountId || entry.name.startsWith(`${accountId}__`)) {
          const sessionId = entry.name === accountId ? 'primary' : entry.name.replace(`${accountId}__`, '');
          const sessionDir = path.join(baseDir, entry.name);
          const credsFile = path.join(sessionDir, 'creds.json');
          const hasSavedAuth = fs.existsSync(credsFile);
          const sessionKey = getSessionKey(accountId, sessionId);
          const active = sessions.get(sessionKey);
          const meta = readSessionInfo(sessionDir);

          // If not registered and no phone number, ignore it from the logged-in cards
          if (!meta.hasRegisteredAuth && (!active || active.state.status !== 'connected')) {
            continue;
          }

          visited.add(sessionId);

          let status: BaileysSessionState['status'] = 'disconnected';
          if (active) {
            status = active.state.status;
          } else if (meta.hasRegisteredAuth) {
            status = 'disconnected';
          }

          const phone = active?.state.phoneNumber || meta.phoneNumber;

          result.push({
            sessionId,
            sessionName: meta.sessionName || (sessionId === 'primary' ? 'Primary WhatsApp' : `WhatsApp (${sessionId})`),
            status,
            phoneNumber: phone,
            pushName: active?.state.pushName || meta.pushName,
            isDefault: sessionId === 'primary' || meta.isDefault,
            connectedAt: active?.state.connectedAt || meta.connectedAt,
            updatedAt: active?.state.updatedAt || Date.now(),
            platform: meta.platform,
            hasSavedAuth,
          });
        }
      }
    } catch (err) {
      console.error('[Baileys] Error scanning session folders:', err);
    }
  }

  // Also include in-memory connected sessions
  for (const [key, sess] of sessions.entries()) {
    if (key === accountId || key.startsWith(`${accountId}__`)) {
      const sessionId = key === accountId ? 'primary' : key.replace(`${accountId}__`, '');
      if (!visited.has(sessionId) && sess.state.status === 'connected' && sess.state.phoneNumber) {
        visited.add(sessionId);
        result.push({
          sessionId,
          sessionName: sess.state.sessionName || 'Primary WhatsApp',
          status: sess.state.status,
          phoneNumber: sess.state.phoneNumber,
          pushName: sess.state.pushName,
          isDefault: sessionId === 'primary' || sess.state.isDefault,
          connectedAt: sess.state.connectedAt,
          updatedAt: sess.state.updatedAt,
          platform: sess.state.platform,
          hasSavedAuth: true,
        });
      }
    }
  }

  return result;
}

/**
 * Check whether any Baileys multi-device session is currently connected and active for this account
 */
export function isBaileysConnected(accountId: string): boolean {
  for (const [key, sess] of sessions.entries()) {
    if (
      (key === accountId || key.startsWith(`${accountId}__`)) &&
      sess.state.status === 'connected' &&
      !sess.isTerminated
    ) {
      return true;
    }
  }

  const primaryKey = getSessionKey(accountId, 'primary');
  const primary = sessions.get(primaryKey);
  if (primary && primary.state.status === 'connected' && !primary.isTerminated) {
    return true;
  }

  return false;
}

/**
 * Check whether a Baileys session exists (either connected in memory or registered on disk)
 */
export function hasBaileysSession(accountId: string): boolean {
  if (isBaileysConnected(accountId)) return true;
  const baseDir = path.join(process.cwd(), 'data', 'baileys_auth');
  if (!fs.existsSync(baseDir)) return false;
  try {
    const entries = fs.readdirSync(baseDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name === accountId || entry.name.startsWith(`${accountId}__`)) {
        const credsFile = path.join(baseDir, entry.name, 'creds.json');
        if (fs.existsSync(credsFile)) return true;
      }
    }
  } catch {}
  return false;
}

/**
 * Get state for a specific session (or active / primary session)
 */
export function getBaileysSession(accountId: string, sessionId: string = 'primary'): BaileysSessionState {
  const sessionKey = getSessionKey(accountId, sessionId);
  const session = sessions.get(sessionKey);
  if (session && !session.isTerminated) {
    return session.state;
  }

  // If primary requested, check if any connected session exists
  if (sessionId === 'primary') {
    for (const [key, sess] of sessions.entries()) {
      if ((key === accountId || key.startsWith(`${accountId}__`)) && sess.state.status === 'connected' && !sess.isTerminated) {
        return sess.state;
      }
    }
  }

  const sessionDir = getSessionDir(accountId, sessionId, false);
  const credsFile = path.join(sessionDir, 'creds.json');

  if (fs.existsSync(credsFile)) {
    const meta = readSessionInfo(sessionDir);

    if (meta.hasRegisteredAuth && meta.phoneNumber) {
      setTimeout(() => {
        const cur = sessions.get(sessionKey);
        if (!cur?.sock && !cur?.isTerminated) {
          startBaileysSession(accountId, { sessionId, autoResume: true }).catch((err) => {
            console.warn(`[Baileys] Auto-resume for ${accountId}/${sessionId} failed:`, err);
          });
        }
      }, 500);

      return {
        sessionId,
        sessionName: meta.sessionName,
        status: 'connecting',
        qrCode: null,
        rawQr: null,
        pairingCode: null,
        phoneNumber: meta.phoneNumber,
        pushName: meta.pushName,
        lastError: 'Resuming saved session...',
        updatedAt: Date.now(),
        connectedAt: meta.connectedAt,
        isDefault: sessionId === 'primary' || meta.isDefault,
        platform: meta.platform,
      };
    }
  }

  return {
    sessionId,
    sessionName: sessionId === 'primary' ? 'Primary WhatsApp' : `WhatsApp (${sessionId})`,
    status: 'idle',
    qrCode: null,
    rawQr: null,
    pairingCode: null,
    phoneNumber: null,
    pushName: null,
    lastError: null,
    updatedAt: Date.now(),
    connectedAt: null,
    isDefault: sessionId === 'primary',
    platform: 'WhatsApp Web (Chrome / Ubuntu)',
  };
}

export async function startBaileysSession(
  accountId: string,
  options?: {
    sessionId?: string;
    sessionName?: string;
    phoneNumber?: string;
    usePairingCode?: boolean;
    forceNew?: boolean;
    autoResume?: boolean;
  }
): Promise<BaileysSessionState> {
  const sessionId = options?.sessionId || 'primary';
  const sessionKey = getSessionKey(accountId, sessionId);
  const existing = sessions.get(sessionKey);

  // If forceNew requested, cleanly wipe previous session
  if (options?.forceNew) {
    if (existing) {
      existing.isTerminated = true;
      if (existing.reconnectTimer) clearTimeout(existing.reconnectTimer);
      if (existing.sock) {
        try {
          existing.sock.ev.removeAllListeners('connection.update');
          existing.sock.ev.removeAllListeners('creds.update');
          existing.sock.ev.removeAllListeners('messages.upsert');
          existing.sock.end(undefined);
        } catch {}
      }
    }
    const sessionDir = getSessionDir(accountId, sessionId, false);
    try {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    } catch {}
    sessions.delete(sessionKey);
  } else if (
    existing?.sock &&
    !existing.isTerminated &&
    (existing.state.status === 'connected' ||
      (existing.state.status === 'qr_ready' && existing.state.qrCode))
  ) {
    return existing.state;
  }

  const sessionDir = getSessionDir(accountId, sessionId, true);
  const previousMeta = readSessionInfo(sessionDir);
  const sessionName = options?.sessionName || previousMeta.sessionName || (sessionId === 'primary' ? 'Primary WhatsApp' : `WhatsApp (${sessionId})`);

  const { state: authState, saveCreds } = await useMultiFileAuthState(sessionDir);
  
  // Use latest tested WhatsApp Web version
  const { version } = await fetchLatestWaWebVersion().catch(() => ({
    version: [2, 3000, 1050814928] as [number, number, number],
  }));

  const state: BaileysSessionState = {
    sessionId,
    sessionName,
    status: 'connecting',
    qrCode: null,
    rawQr: null,
    pairingCode: null,
    phoneNumber: previousMeta.phoneNumber,
    pushName: previousMeta.pushName,
    lastError: null,
    updatedAt: Date.now(),
    connectedAt: previousMeta.connectedAt,
    isDefault: sessionId === 'primary' || previousMeta.isDefault,
    platform: 'WhatsApp Web (Chrome / Ubuntu)',
  };

  const sessionObj: ActiveSession = {
    sock: null,
    state,
    isTerminated: false,
    handshakeRetries: existing ? (existing.handshakeRetries || 0) : 0,
  };
  sessions.set(sessionKey, sessionObj);

  const logger = pino({ level: 'silent' });

  const sock = makeWASocket({
    version,
    logger,
    auth: authState,
    browser: Browsers.ubuntu('Chrome'),
    syncFullHistory: false,
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 60000,
  });

  sessionObj.sock = sock;

  sock.ev.on('creds.update', () => {
    if (sessionObj.isTerminated) return;
    saveCreds();

    const userJid = sock.user?.id || authState.creds.me?.id;
    if (userJid) {
      const raw = userJid.split(':')[0].replace(/@.*/, '').replace(/\D/g, '');
      const cleanPhone = raw ? (raw.startsWith('+') ? raw : `+${raw}`) : null;
      const pushName = sock.user?.name || authState.creds.me?.name || state.pushName || null;
      if (cleanPhone) {
        state.phoneNumber = cleanPhone;
        state.pushName = pushName;
        writeSessionInfo(sessionDir, {
          phoneNumber: cleanPhone,
          pushName,
          sessionName,
          platform: state.platform,
        });
      }
    }
  });

  sock.ev.on('connection.update', async (update: Partial<ConnectionState>) => {
    if (sessionObj.isTerminated) return;

    const { connection, lastDisconnect, qr } = update;

    // QR Code emitted
    if (qr) {
      sessionObj.handshakeRetries = 0;
      state.rawQr = qr;
      try {
        state.qrCode = await QRCode.toDataURL(qr, {
          margin: 2,
          scale: 8,
          color: {
            dark: '#0f172a',
            light: '#ffffff',
          },
        });
        state.status = 'qr_ready';
        state.updatedAt = Date.now();
        console.log(`[Baileys] QR ready for ${sessionKey}`);
      } catch (err) {
        console.error('[Baileys] Error rendering QR code:', err);
      }

      // If user requested pairing code via phone number, request it now that socket is ready!
      if (options?.usePairingCode && options?.phoneNumber && !state.pairingCode) {
        try {
          const cleanNumber = options.phoneNumber.replace(/\D/g, '');
          const code = await sock.requestPairingCode(cleanNumber);
          state.pairingCode = code;
          state.status = 'qr_ready';
          state.updatedAt = Date.now();
          console.log(`[Baileys] Pairing code ready for ${sessionKey}:`, code);
        } catch (err) {
          console.error('[Baileys] Error requesting pairing code:', err);
          state.lastError = err instanceof Error ? err.message : 'Failed to generate pairing code';
        }
      }
    }

    if (connection === 'close') {
      if (sessionObj.isTerminated) return;

      const statusCode = (lastDisconnect?.error as { output?: { statusCode?: number } })?.output?.statusCode;
      const isRegistered = Boolean(sock.user?.id || authState.creds.registered);
      const isLoggedOut = statusCode === DisconnectReason.loggedOut;

      console.log(`[Baileys] Connection closed for ${sessionKey}, status: ${statusCode}, registered: ${isRegistered}`);

      if (isLoggedOut) {
        state.status = 'disconnected';
        state.qrCode = null;
        state.rawQr = null;
        state.pairingCode = null;
        state.lastError = 'Logged out from device.';
        try {
          fs.rmSync(sessionDir, { recursive: true, force: true });
        } catch {}
        sessions.delete(sessionKey);
        return;
      }

      if (!isRegistered) {
        state.status = 'disconnected';
        state.lastError = 'QR Code session ended. Click Refresh QR Code to try again.';
        state.updatedAt = Date.now();
        return;
      }

      // If registered device disconnected, auto-reconnect
      state.status = 'disconnected';
      state.lastError = 'Connection lost. Reconnecting...';
      state.updatedAt = Date.now();

      if (sessionObj.reconnectTimer) {
        clearTimeout(sessionObj.reconnectTimer);
      }

      sessionObj.reconnectTimer = setTimeout(() => {
        if (!sessionObj.isTerminated) {
          startBaileysSession(accountId, { sessionId, sessionName }).catch((err) => {
            console.error('[Baileys] Reconnect failed:', err);
          });
        }
      }, 5000);
    } else if (connection === 'open') {
      console.log(`[Baileys] Connected successfully for ${sessionKey}`);
      state.status = 'connected';
      state.qrCode = null;
      state.rawQr = null;
      state.pairingCode = null;
      state.lastError = null;
      state.connectedAt = Date.now();

      const userJid = sock.user?.id || authState.creds.me?.id || '';
      const rawPhone = userJid.split(':')[0].replace(/@.*/, '').replace(/\D/g, '');
      const cleanPhone = rawPhone ? (rawPhone.startsWith('+') ? rawPhone : `+${rawPhone}`) : null;

      state.phoneNumber = cleanPhone;
      state.pushName = sock.user?.name || authState.creds.me?.name || state.pushName || null;
      state.updatedAt = Date.now();

      writeSessionInfo(sessionDir, {
        phoneNumber: cleanPhone,
        pushName: state.pushName,
        sessionName,
        connectedAt: state.connectedAt,
        isDefault: state.isDefault,
        platform: state.platform,
      });

      // Update supabase whatsapp_config to keep status in sync
      try {
        const admin = supabaseAdmin();
        const { data: existingCfg } = await admin
          .from('whatsapp_config')
          .select('id')
          .eq('account_id', accountId)
          .maybeSingle();

        if (existingCfg) {
          await admin
            .from('whatsapp_config')
            .update({
              status: 'connected',
              connected_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('account_id', accountId);
        } else {
          const { data: profile } = await admin
            .from('profiles')
            .select('user_id')
            .eq('account_id', accountId)
            .maybeSingle();

          const ownerId = profile?.user_id;
          if (ownerId) {
            await admin.from('whatsapp_config').insert({
              account_id: accountId,
              user_id: ownerId,
              phone_number_id: cleanPhone || 'baileys',
              access_token: 'baileys_session',
              status: 'connected',
              connected_at: new Date().toISOString(),
            });
          }
        }
      } catch (err) {
        console.error('[Baileys] Failed to update whatsapp_config status:', err);
      }
    }
  });

  // Inbound messages handling
  sock.ev.on('messages.upsert', async ({ messages: newMessages, type }) => {
    if (type !== 'notify' || sessionObj.isTerminated) return;

    for (const msg of newMessages) {
      try {
        await handleInboundMessage(accountId, msg);
      } catch (err) {
        console.error('[Baileys] Error handling inbound message:', err);
      }
    }
  });

  // Await first QR code or connection event (up to 3 seconds) before returning!
  // This guarantees the frontend receives the QR code on the very first POST response!
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => resolve(), 3000);
    const interval = setInterval(() => {
      if (state.qrCode || state.status === 'connected' || state.pairingCode || state.status === 'disconnected') {
        clearInterval(interval);
        clearTimeout(timeout);
        resolve();
      }
    }, 100);
  });

  return state;
}

/**
 * Disconnect, log out and PERMANENTLY delete a Baileys session
 */
export async function disconnectBaileysSession(accountId: string, sessionId: string = 'primary'): Promise<void> {
  const sessionKey = getSessionKey(accountId, sessionId);
  const session = sessions.get(sessionKey);

  if (session) {
    session.isTerminated = true; // Prevents connection.update from auto-reconnecting
    if (session.reconnectTimer) {
      clearTimeout(session.reconnectTimer);
      session.reconnectTimer = undefined;
    }

    if (session.sock) {
      try {
        session.sock.ev.removeAllListeners('connection.update');
        session.sock.ev.removeAllListeners('creds.update');
        session.sock.ev.removeAllListeners('messages.upsert');
        await session.sock.logout().catch(() => {});
        session.sock.end(undefined);
      } catch {}
    }
  }

  sessions.delete(sessionKey);

  // Permanently delete session directory from disk
  const sessionDir = getSessionDir(accountId, sessionId, false);
  if (fs.existsSync(sessionDir)) {
    try {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    } catch (err) {
      console.error('[Baileys] rmSync error:', err);
      try {
        const files = fs.readdirSync(sessionDir);
        for (const file of files) {
          try {
            fs.rmSync(path.join(sessionDir, file), { recursive: true, force: true });
          } catch {}
        }
      } catch {}
    }
  }

  // If no Baileys sessions remain connected, only set disconnected if Meta Cloud API is not configured
  try {
    const remaining = getAllBaileysSessions(accountId);
    const hasAnyConnected = remaining.some((s) => s.status === 'connected');
    if (!hasAnyConnected) {
      const admin = supabaseAdmin();
      const { data: cfg } = await admin
        .from('whatsapp_config')
        .select('phone_number_id, access_token')
        .eq('account_id', accountId)
        .maybeSingle();

      if (!cfg || !cfg.phone_number_id || !cfg.access_token) {
        await admin
          .from('whatsapp_config')
          .update({ status: 'disconnected', updated_at: new Date().toISOString() })
          .eq('account_id', accountId);
      }
    }
  } catch {}
}

/**
 * Clean all unlinked / orphan session folders for an account
 */
export function cleanOrphanSessions(accountId: string): void {
  const baseDir = path.join(process.cwd(), 'data', 'baileys_auth');
  if (!fs.existsSync(baseDir)) return;

  try {
    const entries = fs.readdirSync(baseDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name === accountId || entry.name.startsWith(`${accountId}__`)) {
        const sessionDir = path.join(baseDir, entry.name);
        const meta = readSessionInfo(sessionDir);
        if (!meta.hasRegisteredAuth) {
          const sessionId = entry.name === accountId ? 'primary' : entry.name.replace(`${accountId}__`, '');
          const sessionKey = getSessionKey(accountId, sessionId);
          const active = sessions.get(sessionKey);
          if (active) {
            active.isTerminated = true;
            if (active.reconnectTimer) clearTimeout(active.reconnectTimer);
            if (active.sock) {
              try {
                active.sock.ev.removeAllListeners('connection.update');
                active.sock.end(undefined);
              } catch {}
            }
            sessions.delete(sessionKey);
          }
          try {
            fs.rmSync(sessionDir, { recursive: true, force: true });
          } catch {}
        }
      }
    }
  } catch (err) {
    console.error('[Baileys] Error cleaning orphan sessions:', err);
  }
}

/**
 * Send a message using the active Baileys session
 */
export async function sendBaileysMessage(
  accountId: string,
  toPhone: string,
  content: { text?: string; mediaUrl?: string; caption?: string; fileName?: string; mimetype?: string },
  sessionId?: string
): Promise<{ messageId: string }> {
  let sessionKey = sessionId ? getSessionKey(accountId, sessionId) : null;
  let session = sessionKey ? sessions.get(sessionKey) : null;

  // Search for ANY connected session for this account
  if (!session || session.state.status !== 'connected' || session.isTerminated) {
    for (const [key, sess] of sessions.entries()) {
      if ((key === accountId || key.startsWith(`${accountId}__`)) && sess.state.status === 'connected' && !sess.isTerminated) {
        session = sess;
        break;
      }
    }
  }

  if (!session?.sock || session.state.status !== 'connected') {
    throw new Error('WhatsApp linked device is not connected.');
  }

  const cleanDigits = toPhone.replace(/\D/g, '');
  const jid = `${cleanDigits}@s.whatsapp.net`;

  let sentResult;
  if (content.mediaUrl) {
    const urlLower = content.mediaUrl.toLowerCase();
    const isPdf = urlLower.includes('.pdf') || content.mimetype === 'application/pdf';
    const isVideo = urlLower.match(/\.(mp4|mov|avi|mkv|webm)$/i) || content.mimetype?.startsWith('video/');

    if (isPdf) {
      const fileName = content.fileName || content.mediaUrl.split('/').pop()?.split('?')[0] || 'document.pdf';
      sentResult = await session.sock.sendMessage(jid, {
        document: { url: content.mediaUrl },
        mimetype: 'application/pdf',
        fileName,
        caption: content.caption || content.text || '',
      });
    } else if (isVideo) {
      sentResult = await session.sock.sendMessage(jid, {
        video: { url: content.mediaUrl },
        caption: content.caption || content.text || '',
      });
    } else {
      sentResult = await session.sock.sendMessage(jid, {
        image: { url: content.mediaUrl },
        caption: content.caption || content.text || '',
      });
    }
  } else {
    sentResult = await session.sock.sendMessage(jid, {
      text: content.text || '',
    });
  }

  return {
    messageId: sentResult?.key?.id || `baileys_${Date.now()}`,
  };
}

/**
 * Send a quick test ping to verify sending capabilities
 */
export async function sendBaileysTestMessage(
  accountId: string,
  toPhone: string,
  customText?: string,
  sessionId?: string
): Promise<{ success: boolean; messageId: string }> {
  const cleanPhone = toPhone.replace(/\D/g, '');
  if (!cleanPhone || cleanPhone.length < 8) {
    throw new Error('Invalid phone number. Please enter a valid number with country code (e.g. 919876543210)');
  }

  const messageText =
    customText ||
    `✅ *WACRM WhatsApp Connection Test*\n\nYour WhatsApp linked device is active and communicating in real-time with your CRM inbox!\n\n🕒 *Timestamp:* ${new Date().toLocaleString()}\n⚡ *Engine:* Baileys Multi-Device Socket\n🔒 *Security:* End-to-End Encrypted`;

  const res = await sendBaileysMessage(accountId, cleanPhone, { text: messageText }, sessionId);
  return {
    success: true,
    messageId: res.messageId,
  };
}

async function handleInboundMessage(accountId: string, msg: WAMessage): Promise<void> {
  if (!msg.message || msg.key.fromMe) return;

  const remoteJid = msg.key.remoteJid;
  if (!remoteJid || remoteJid.endsWith('@g.us') || remoteJid === 'status@broadcast') {
    return;
  }

  const rawPhone = remoteJid.replace('@s.whatsapp.net', '');
  const cleanPhone = rawPhone.startsWith('+') ? rawPhone : `+${rawPhone}`;
  const pushName = msg.pushName || 'WhatsApp Customer';

  const messageContent = msg.message;
  const text =
    messageContent.conversation ||
    messageContent.extendedTextMessage?.text ||
    messageContent.imageMessage?.caption ||
    messageContent.videoMessage?.caption ||
    '';

  const nowIso = new Date().toISOString();
  const admin = supabaseAdmin();

  // 1. Contact lookup / creation
  let contactId: string | null = null;
  const { data: existingContact } = await admin
    .from('contacts')
    .select('id, name')
    .eq('account_id', accountId)
    .eq('phone', cleanPhone)
    .maybeSingle();

  if (existingContact) {
    contactId = existingContact.id;
  } else {
    const { data: createdContact, error: contactErr } = await admin
      .from('contacts')
      .insert({
        account_id: accountId,
        name: pushName,
        phone: cleanPhone,
        created_at: nowIso,
      })
      .select('id')
      .single();

    if (!contactErr && createdContact) {
      contactId = createdContact.id;
    }
  }

  if (!contactId) return;

  // 2. Conversation lookup / creation
  let conversationId: string | null = null;
  let unreadCount = 0;
  const { data: existingConv } = await admin
    .from('conversations')
    .select('id, unread_count')
    .eq('account_id', accountId)
    .eq('contact_id', contactId)
    .maybeSingle();

  if (existingConv) {
    conversationId = existingConv.id;
    unreadCount = existingConv.unread_count || 0;

    await admin
      .from('conversations')
      .update({
        last_message_text: text || 'Media message',
        last_message_at: nowIso,
        last_inbound_at: nowIso,
        unread_count: unreadCount + 1,
        updated_at: nowIso,
      })
      .eq('id', conversationId);
  } else {
    const { data: createdConv, error: convErr } = await admin
      .from('conversations')
      .insert({
        account_id: accountId,
        contact_id: contactId,
        status: 'pending',
        last_message_text: text || 'Media message',
        last_message_at: nowIso,
        unread_count: 1,
        created_at: nowIso,
        updated_at: nowIso,
        first_inbound_at: nowIso,
        last_inbound_at: nowIso,
      })
      .select('id')
      .single();

    if (!convErr && createdConv) {
      conversationId = createdConv.id;
    }
  }

  if (!conversationId) return;

  // 4. Extract interactive replies (buttons, list, template buttons)
  let interactiveReplyId: string | null = null;
  let replyTitle: string | null = null;
  const anyMsg = messageContent as Record<string, any>;
  if (anyMsg.buttonsResponseMessage?.selectedButtonId) {
    interactiveReplyId = anyMsg.buttonsResponseMessage.selectedButtonId;
    replyTitle = anyMsg.buttonsResponseMessage.selectedDisplayText || null;
  } else if (anyMsg.listResponseMessage?.singleSelectReply?.selectedRowId) {
    interactiveReplyId = anyMsg.listResponseMessage.singleSelectReply.selectedRowId;
    replyTitle = anyMsg.listResponseMessage.singleSelectReply.title || anyMsg.listResponseMessage.title || null;
  } else if (anyMsg.templateButtonReplyMessage?.selectedId) {
    interactiveReplyId = anyMsg.templateButtonReplyMessage.selectedId;
    replyTitle = anyMsg.templateButtonReplyMessage.selectedDisplayText || null;
  }

  // 3. Insert Message
  const messageId = msg.key.id || `baileys_${Date.now()}`;
  await admin.from('messages').insert({
    conversation_id: conversationId,
    sender_type: 'customer',
    content_type: 'text',
    content_text: text || replyTitle || (messageContent.imageMessage ? '[Image]' : '[Media]'),
    message_id: messageId,
    status: 'delivered',
    created_at: nowIso,
  });

  // 5. Check if this is a Product Action (Order Now, All Products, Chat with Us)
  //    or an active order session (customer is currently in checkout)
  const isProdAction = isProductAction(interactiveReplyId, replyTitle, text);

  if (isProdAction) {
    await admin
      .from('flow_runs')
      .update({
        status: 'cancelled',
        end_reason: 'product_action_override',
        ended_at: new Date().toISOString(),
      })
      .eq('account_id', accountId)
      .eq('contact_id', contactId)
      .eq('status', 'active');
  }

  const { data: activeOrderSession } = await admin
    .from('order_sessions')
    .select('state')
    .eq('account_id', accountId)
    .eq('contact_id', contactId)
    .maybeSingle();

  const inActiveOrderCheckout =
    activeOrderSession?.state &&
    activeOrderSession.state !== 'IDLE' &&
    activeOrderSession.state !== 'COMPLETED';

  let commerceConsumed = false;
  if (isProdAction || inActiveOrderCheckout) {
    try {
      const commerceRes = await processCommerceInboundMessage({
        accountId,
        contactId,
        conversationId,
        messageText: text,
        interactiveReplyId,
        interactiveReplyTitle: replyTitle || text,
        customerName: pushName,
        customerPhone: cleanPhone,
      });
      commerceConsumed = Boolean(commerceRes?.handled);
    } catch (commerceErr) {
      console.error('[Baileys] Commerce bot execution error:', commerceErr);
    }
  }

  if (commerceConsumed) {
    return;
  }

  // 6. Dispatch to Flows engine if not consumed by Commerce Bot
  let flowConsumed = false;
  try {
    const { data: config } = await admin
      .from('whatsapp_config')
      .select('user_id')
      .eq('account_id', accountId)
      .maybeSingle();

    const configOwnerUserId = config?.user_id || 'system';

    const flowRes = await dispatchInboundToFlows({
      accountId,
      userId: configOwnerUserId,
      contactId,
      conversationId,
      message: interactiveReplyId
        ? {
            kind: 'interactive_reply',
            reply_id: interactiveReplyId,
            reply_title: replyTitle || text || '',
            meta_message_id: messageId,
          }
        : {
            kind: 'text',
            text: text,
            meta_message_id: messageId,
          },
      isFirstInboundMessage: existingConv === null,
    });
    flowConsumed = Boolean(flowRes?.consumed);
  } catch (err) {
    console.error('[baileys] dispatchInboundToFlows error:', err);
  }

  if (flowConsumed) {
    return;
  }

  // 7. Run Commerce general intent check if flow didn't consume
  try {
    await processCommerceInboundMessage({
      accountId,
      contactId,
      conversationId,
      messageText: text,
      interactiveReplyId,
      interactiveReplyTitle: replyTitle || text,
      customerName: pushName,
      customerPhone: cleanPhone,
    });
  } catch (commerceErr) {
    console.error('[Baileys] Commerce bot execution error:', commerceErr);
  }
}
