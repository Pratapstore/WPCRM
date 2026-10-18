import fs from 'fs';
import path from 'path';
import pino from 'pino';
import QRCode from 'qrcode';
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  Browsers,
  type WASocket,
  type ConnectionState,
  type WAMessage,
} from '@whiskeysockets/baileys';
import { supabaseAdmin } from '@/lib/flows/admin-client';
import { dispatchInboundToFlows } from '@/lib/flows/engine';

export interface BaileysSessionState {
  status: 'idle' | 'connecting' | 'qr_ready' | 'connected' | 'disconnected';
  qrCode: string | null;
  rawQr: string | null;
  pairingCode: string | null;
  phoneNumber: string | null;
  pushName: string | null;
  lastError: string | null;
  updatedAt: number;
}

interface ActiveSession {
  sock: WASocket | null;
  state: BaileysSessionState;
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

function getSessionDir(accountId: string): string {
  const baseDir = path.join(process.cwd(), 'data', 'baileys_auth');
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }
  const accountDir = path.join(baseDir, accountId);
  if (!fs.existsSync(accountDir)) {
    fs.mkdirSync(accountDir, { recursive: true });
  }
  return accountDir;
}

export function getBaileysSession(accountId: string): BaileysSessionState {
  const session = sessions.get(accountId);
  if (session) {
    return session.state;
  }

  // Check if session files already exist on disk
  const authDir = path.join(process.cwd(), 'data', 'baileys_auth', accountId);
  const credsFile = path.join(authDir, 'creds.json');
  if (fs.existsSync(credsFile)) {
    return {
      status: 'disconnected',
      qrCode: null,
      rawQr: null,
      pairingCode: null,
      phoneNumber: null,
      pushName: null,
      lastError: 'Session saved on disk. Click Connect to resume.',
      updatedAt: Date.now(),
    };
  }

  return {
    status: 'idle',
    qrCode: null,
    rawQr: null,
    pairingCode: null,
    phoneNumber: null,
    pushName: null,
    lastError: null,
    updatedAt: Date.now(),
  };
}

export async function startBaileysSession(
  accountId: string,
  options?: { phoneNumber?: string; usePairingCode?: boolean }
): Promise<BaileysSessionState> {
  const existing = sessions.get(accountId);
  if (existing?.sock && (existing.state.status === 'connected' || existing.state.status === 'connecting')) {
    return existing.state;
  }

  const sessionDir = getSessionDir(accountId);
  const { state: authState, saveCreds } = await useMultiFileAuthState(sessionDir);
  const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1015901307] as [number, number, number] }));

  const state: BaileysSessionState = {
    status: 'connecting',
    qrCode: null,
    rawQr: null,
    pairingCode: null,
    phoneNumber: null,
    pushName: null,
    lastError: null,
    updatedAt: Date.now(),
  };

  const sessionObj: ActiveSession = {
    sock: null,
    state,
  };
  sessions.set(accountId, sessionObj);

  const logger = pino({ level: 'silent' });

  const sock = makeWASocket({
    version,
    logger,
    auth: authState,
    printQRInTerminal: false,
    browser: Browsers.macOS('Desktop'),
    syncFullHistory: false,
  });

  sessionObj.sock = sock;

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update: Partial<ConnectionState>) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      state.rawQr = qr;
      try {
        state.qrCode = await QRCode.toDataURL(qr, {
          margin: 2,
          scale: 8,
          color: {
            dark: '#111827',
            light: '#ffffff',
          },
        });
        state.status = 'qr_ready';
        state.updatedAt = Date.now();
      } catch (err) {
        console.error('[Baileys] Error rendering QR code:', err);
      }
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as { output?: { statusCode?: number } })?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log(`[Baileys] Connection closed for ${accountId}, reason: ${statusCode}, shouldReconnect: ${shouldReconnect}`);

      if (statusCode === DisconnectReason.loggedOut) {
        state.status = 'disconnected';
        state.qrCode = null;
        state.rawQr = null;
        state.lastError = 'Logged out from device.';
        try {
          fs.rmSync(sessionDir, { recursive: true, force: true });
        } catch {}
      } else {
        state.status = 'disconnected';
        state.lastError = 'Disconnected. Reconnecting...';
        state.updatedAt = Date.now();
        // Automatically reconnect after a short delay
        setTimeout(() => {
          startBaileysSession(accountId).catch((err) => {
            console.error('[Baileys] Reconnect failed:', err);
          });
        }, 3000);
      }
    } else if (connection === 'open') {
      console.log(`[Baileys] Connected successfully for ${accountId}`);
      state.status = 'connected';
      state.qrCode = null;
      state.rawQr = null;
      state.pairingCode = null;
      state.lastError = null;

      const userJid = sock.user?.id || '';
      const rawPhone = userJid.split(':')[0] || userJid.split('@')[0] || '';
      state.phoneNumber = rawPhone ? (rawPhone.startsWith('+') ? rawPhone : `+${rawPhone}`) : null;
      state.pushName = sock.user?.name || null;
      state.updatedAt = Date.now();

      // Optionally update supabase whatsapp_config to keep status in sync
      try {
        const admin = supabaseAdmin();
        await admin
          .from('whatsapp_config')
          .update({
            status: 'connected',
            updated_at: new Date().toISOString(),
          })
          .eq('account_id', accountId);
      } catch (err) {
        console.error('[Baileys] Failed to update whatsapp_config status:', err);
      }
    }
  });

  // Handle Pairing code request (if user provided a phone number)
  if (options?.usePairingCode && options?.phoneNumber && !authState.creds.registered) {
    setTimeout(async () => {
      try {
        const cleanNumber = options.phoneNumber!.replace(/\D/g, '');
        const code = await sock.requestPairingCode(cleanNumber);
        state.pairingCode = code;
        state.status = 'qr_ready';
        state.updatedAt = Date.now();
      } catch (err) {
        console.error('[Baileys] Failed to request pairing code:', err);
        state.lastError = err instanceof Error ? err.message : 'Failed to request pairing code';
      }
    }, 2000);
  }

  // Handle Inbound messages
  sock.ev.on('messages.upsert', async ({ messages: newMessages, type }) => {
    if (type !== 'notify') return;

    for (const msg of newMessages) {
      try {
        await handleInboundMessage(accountId, msg);
      } catch (err) {
        console.error('[Baileys] Error handling inbound message:', err);
      }
    }
  });

  return state;
}

export async function disconnectBaileysSession(accountId: string): Promise<void> {
  const session = sessions.get(accountId);
  if (session?.sock) {
    try {
      await session.sock.logout();
    } catch {}
    try {
      session.sock.end(undefined);
    } catch {}
  }

  const sessionDir = getSessionDir(accountId);
  try {
    fs.rmSync(sessionDir, { recursive: true, force: true });
  } catch {}

  sessions.delete(accountId);
}

export async function sendBaileysMessage(
  accountId: string,
  toPhone: string,
  content: { text?: string; mediaUrl?: string; caption?: string }
): Promise<{ messageId: string }> {
  const session = sessions.get(accountId);
  if (!session?.sock || session.state.status !== 'connected') {
    throw new Error('WhatsApp linked device is not connected.');
  }

  const cleanDigits = toPhone.replace(/\D/g, '');
  const jid = `${cleanDigits}@s.whatsapp.net`;

  let sentResult;
  if (content.mediaUrl) {
    sentResult = await session.sock.sendMessage(jid, {
      image: { url: content.mediaUrl },
      caption: content.caption || content.text || '',
    });
  } else {
    sentResult = await session.sock.sendMessage(jid, {
      text: content.text || '',
    });
  }

  return {
    messageId: sentResult?.key?.id || `baileys_${Date.now()}`,
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

  // 3. Insert Message
  const messageId = msg.key.id || `baileys_${Date.now()}`;
  await admin.from('messages').insert({
    conversation_id: conversationId,
    sender_type: 'customer',
    content_type: 'text',
    content_text: text || (messageContent.imageMessage ? '[Image]' : '[Media]'),
    message_id: messageId,
    status: 'delivered',
    created_at: nowIso,
  });

  // 4. Dispatch to Flows engine
  try {
    let interactiveReplyId: string | null = null;
    let replyTitle: string | null = null;
    const anyMsg = messageContent as Record<string, any>;
    if (anyMsg.buttonsResponseMessage?.selectedButtonId) {
      interactiveReplyId = anyMsg.buttonsResponseMessage.selectedButtonId;
      replyTitle = anyMsg.buttonsResponseMessage.selectedDisplayText || null;
    } else if (anyMsg.listResponseMessage?.singleSelectReply?.selectedRowId) {
      interactiveReplyId = anyMsg.listResponseMessage.singleSelectReply.selectedRowId;
      replyTitle = anyMsg.listResponseMessage.singleSelectReply.title || null;
    } else if (anyMsg.templateButtonReplyMessage?.selectedId) {
      interactiveReplyId = anyMsg.templateButtonReplyMessage.selectedId;
      replyTitle = anyMsg.templateButtonReplyMessage.selectedDisplayText || null;
    }

    const { data: config } = await admin
      .from('whatsapp_config')
      .select('user_id')
      .eq('account_id', accountId)
      .maybeSingle();

    const configOwnerUserId = config?.user_id || 'system';

    await dispatchInboundToFlows({
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
  } catch (err) {
    console.error('[baileys] dispatchInboundToFlows error:', err);
  }
}
