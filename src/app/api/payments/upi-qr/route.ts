import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { supabaseAdmin } from '@/lib/flows/admin-client';

export const dynamic = 'force-dynamic';

/**
 * Dynamic UPI Payment QR Code Generator API
 *
 * Generates an NPCI-compliant UPI QR Code on the fly as a high-resolution PNG image.
 * WhatsApp Meta Cloud API and Baileys can directly fetch and send this image URL
 * to customers in conversations and automated flows.
 *
 * Query Parameters:
 *  - amount: Amount in INR (e.g., 50 for COD advance, 349 for prepaid, or custom)
 *  - upi_id: Merchant VPA (defaults to DB config or env or store default)
 *  - name: Payee business name (defaults to 'Pratap Store')
 *  - note: Transaction note/message (e.g. 'COD Advance Booking')
 *  - order_number: Optional order reference number
 *  - account_id: Optional account ID to pull custom UPI settings from DB
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const amountParam = searchParams.get('amount');
    const noteParam = searchParams.get('note') || 'Order Payment - Pratap Store';
    const nameParam = searchParams.get('name') || 'Pratap Store';
    const orderNumberParam = searchParams.get('order_number') || '';
    const accountIdParam = searchParams.get('account_id') || '';

    let upiId = searchParams.get('upi_id')?.trim() || '';

    // If UPI ID not explicitly provided, look up from payment_gateways or environment
    if (!upiId && accountIdParam) {
      try {
        const db = supabaseAdmin();
        const { data } = await db
          .from('payment_gateways')
          .select('*')
          .eq('account_id', accountIdParam)
          .maybeSingle();

        if (data && (data as any).upi_id) {
          upiId = (data as any).upi_id.trim();
        }
      } catch (err) {
        console.warn('[UPI-QR] Failed to read UPI ID from DB:', err);
      }
    }

    if (!upiId) {
      upiId = process.env.STORE_UPI_ID?.trim() || 'pratapstore.online@okaxis';
    }

    // Build standard NPCI UPI payment link
    const upiParams = new URLSearchParams({
      pa: upiId,
      pn: nameParam,
      cu: 'INR',
    });

    if (amountParam) {
      const numAmount = parseFloat(amountParam);
      if (!isNaN(numAmount) && numAmount > 0) {
        upiParams.set('am', numAmount.toFixed(2));
      }
    }

    if (noteParam) {
      upiParams.set('tn', noteParam.slice(0, 50));
    }

    if (orderNumberParam) {
      upiParams.set('tr', orderNumberParam.slice(0, 35));
    }

    const upiPayload = `upi://pay?${upiParams.toString()}`;

    // Generate high-resolution PNG QR buffer
    const qrBuffer = await QRCode.toBuffer(upiPayload, {
      type: 'png',
      width: 512,
      margin: 2,
      color: {
        dark: '#0f172a', // Slate 900
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    });

    return new NextResponse(new Uint8Array(qrBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
        'Content-Disposition': 'inline; filename="payment-qr.png"',
      },
    });
  } catch (error) {
    console.error('[UPI-QR] Failed to generate QR code:', error);
    return NextResponse.json(
      { error: 'Failed to generate UPI QR code' },
      { status: 500 }
    );
  }
}
