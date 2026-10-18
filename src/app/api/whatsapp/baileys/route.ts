import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/account';
import {
  getBaileysSession,
  startBaileysSession,
  disconnectBaileysSession,
} from '@/lib/whatsapp/baileys-service';

export async function GET() {
  try {
    const { accountId } = await requireRole('viewer');
    const state = getBaileysSession(accountId);
    return NextResponse.json(state);
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
    const { action, phoneNumber } = body;

    if (action === 'disconnect') {
      await disconnectBaileysSession(accountId);
      return NextResponse.json({ success: true, status: 'disconnected' });
    }

    if (action === 'pair_code') {
      if (!phoneNumber) {
        return NextResponse.json({ error: 'Phone number is required for pairing code' }, { status: 400 });
      }
      const state = await startBaileysSession(accountId, {
        usePairingCode: true,
        phoneNumber,
      });
      return NextResponse.json(state);
    }

    // Default action: start session and generate QR code
    const state = await startBaileysSession(accountId);
    return NextResponse.json(state);
  } catch (error) {
    console.error('Error in Baileys session action:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process request' },
      { status: 500 }
    );
  }
}
