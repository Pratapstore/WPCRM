import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/account';
import {
  getBaileysSession,
  getAllBaileysSessions,
  startBaileysSession,
  disconnectBaileysSession,
  sendBaileysTestMessage,
  cleanOrphanSessions,
} from '@/lib/whatsapp/baileys-service';

export async function GET(request: Request) {
  try {
    const { accountId } = await requireRole('viewer');
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId') || undefined;

    const current = getBaileysSession(accountId, sessionId);
    const sessionsList = getAllBaileysSessions(accountId);

    return NextResponse.json({
      ...current,
      current,
      sessions: sessionsList,
      totalCount: sessionsList.length,
      activeCount: sessionsList.filter((s) => s.status === 'connected').length,
    });
  } catch (error) {
    console.error('Error fetching Baileys session:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch session' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { accountId } = await requireRole('admin');
    const body = await request.json().catch(() => ({}));
    const { action, phoneNumber, sessionId, sessionName, forceNew, toPhone, messageText } = body;

    // 1. Clean orphan/unlinked sessions
    if (action === 'clean_orphans') {
      cleanOrphanSessions(accountId);
      const updatedSessions = getAllBaileysSessions(accountId);
      return NextResponse.json({
        success: true,
        sessions: updatedSessions,
        totalCount: updatedSessions.length,
        activeCount: updatedSessions.filter((s) => s.status === 'connected').length,
      });
    }

    // 2. Disconnect / Logout / Delete Session
    if (action === 'disconnect' || action === 'logout' || action === 'delete') {
      await disconnectBaileysSession(accountId, sessionId || 'primary');
      cleanOrphanSessions(accountId);
      const updatedSessions = getAllBaileysSessions(accountId);
      return NextResponse.json({
        success: true,
        status: 'disconnected',
        sessions: updatedSessions,
        totalCount: updatedSessions.length,
        activeCount: updatedSessions.filter((s) => s.status === 'connected').length,
      });
    }

    // 3. Send Test Message Ping
    if (action === 'test_message') {
      const targetPhone = toPhone || phoneNumber;
      if (!targetPhone) {
        return NextResponse.json(
          { error: 'Recipient phone number is required (e.g. 919876543210)' },
          { status: 400 }
        );
      }
      const testResult = await sendBaileysTestMessage(
        accountId,
        targetPhone,
        messageText,
        sessionId
      );
      return NextResponse.json({
        success: true,
        messageId: testResult.messageId,
      });
    }

    // 4. Request 8-Digit Pairing Code
    if (action === 'pair_code') {
      if (!phoneNumber) {
        return NextResponse.json(
          { error: 'Phone number is required for pairing code' },
          { status: 400 }
        );
      }
      const state = await startBaileysSession(accountId, {
        sessionId: sessionId || 'primary',
        sessionName: sessionName || undefined,
        usePairingCode: true,
        phoneNumber,
        forceNew: Boolean(forceNew),
      });
      const sessionsList = getAllBaileysSessions(accountId);
      return NextResponse.json({
        ...state,
        current: state,
        sessions: sessionsList,
      });
    }

    // 5. Force Reconnect existing saved session
    if (action === 'reconnect') {
      const state = await startBaileysSession(accountId, {
        sessionId: sessionId || 'primary',
        sessionName: sessionName || undefined,
        forceNew: false,
      });
      const sessionsList = getAllBaileysSessions(accountId);
      return NextResponse.json({
        ...state,
        current: state,
        sessions: sessionsList,
      });
    }

    // 6. Default action: Start/Generate QR Code session
    const state = await startBaileysSession(accountId, {
      sessionId: sessionId || 'primary',
      sessionName: sessionName || undefined,
      forceNew: Boolean(forceNew),
    });
    const sessionsList = getAllBaileysSessions(accountId);

    return NextResponse.json({
      ...state,
      current: state,
      sessions: sessionsList,
      totalCount: sessionsList.length,
      activeCount: sessionsList.filter((s) => s.status === 'connected').length,
    });
  } catch (error) {
    console.error('Error in Baileys session action:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process request' },
      { status: 500 }
    );
  }
}
