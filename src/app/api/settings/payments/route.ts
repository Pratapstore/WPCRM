import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { supabaseAdmin } from '@/lib/flows/admin-client';
import { getRazorpayConfig } from '@/lib/payments/razorpay';

export async function GET(request: Request) {
  let ctx;
  try {
    ctx = await requireRole('agent');
  } catch (err) {
    return toErrorResponse(err);
  }

  try {
    const adminDb = supabaseAdmin();
    const { data: dbConfig } = await adminDb
      .from('payment_gateways')
      .select('*')
      .eq('account_id', ctx.accountId)
      .maybeSingle();

    const envConfig = await getRazorpayConfig();

    const origin = new URL(request.url).origin;
    const webhookUrl = `${origin}/api/payments/razorpay/webhook`;

    const storeUpiId =
      dbConfig?.upi_id ||
      process.env.STORE_UPI_ID ||
      'pratapstore@jio';

    return NextResponse.json({
      config: {
        key_id: dbConfig?.key_id || envConfig.keyId || '',
        key_secret: dbConfig?.key_secret || envConfig.keySecret || '',
        webhook_secret: dbConfig?.webhook_secret || envConfig.webhookSecret || '',
        is_enabled: dbConfig?.is_enabled ?? true,
        enable_cod: dbConfig?.enable_cod ?? true,
        enable_prepaid: dbConfig?.enable_prepaid ?? true,
        upi_id: storeUpiId,
      },
      env_configured: envConfig.isConfigured,
      webhook_url: webhookUrl,
    });
  } catch (error) {
    const err = error as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let ctx;
  try {
    ctx = await requireRole('admin');
  } catch (err) {
    return toErrorResponse(err);
  }

  try {
    const body = await request.json();
    const {
      key_id,
      key_secret,
      webhook_secret,
      is_enabled = true,
      enable_cod = true,
      enable_prepaid = true,
    } = body;

    const adminDb = supabaseAdmin();
    const { data: updated, error } = await adminDb
      .from('payment_gateways')
      .upsert(
        {
          account_id: ctx.accountId,
          provider: 'razorpay',
          key_id: key_id?.trim() || null,
          key_secret: key_secret?.trim() || null,
          webhook_secret: webhook_secret?.trim() || null,
          is_enabled: Boolean(is_enabled),
          enable_cod: Boolean(enable_cod),
          enable_prepaid: Boolean(enable_prepaid),
        },
        { onConflict: 'account_id' }
      )
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, config: updated });
  } catch (error) {
    const err = error as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
