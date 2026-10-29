import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/flows/admin-client';

export interface CreatePaymentLinkOptions {
  orderId: string;
  orderNumber: string;
  amount: number; // in INR rupees (e.g. 499.50)
  currency?: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  description?: string;
  callbackUrl?: string;
  accountId?: string;
}

export interface PaymentLinkResult {
  id: string;
  short_url: string;
  status: string;
  isMock?: boolean;
}

/**
 * Reads Razorpay credentials from DB payment_gateways or environment variables.
 */
export async function getRazorpayConfig(accountId?: string) {
  let keyId = process.env.RAZORPAY_KEY_ID?.trim() || '';
  let keySecret = process.env.RAZORPAY_KEY_SECRET?.trim() || '';
  let webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim() || '';
  let enableCod = true;
  let enablePrepaid = true;

  try {
    const db = supabaseAdmin();
    let query = db.from('payment_gateways').select('*');
    if (accountId) {
      query = query.eq('account_id', accountId);
    } else {
      query = query.eq('is_enabled', true).order('created_at', { ascending: false }).limit(1);
    }
    const { data } = await query.maybeSingle();

    if (data && data.is_enabled) {
      if (!keyId && data.key_id?.trim()) keyId = data.key_id.trim();
      if (!keySecret && data.key_secret?.trim()) keySecret = data.key_secret.trim();
      if (!webhookSecret && data.webhook_secret?.trim()) webhookSecret = data.webhook_secret.trim();
      if (typeof data.enable_cod === 'boolean') enableCod = data.enable_cod;
      if (typeof data.enable_prepaid === 'boolean') enablePrepaid = data.enable_prepaid;
    }
  } catch (err) {
    console.warn('[Razorpay] Failed to read payment_gateways from DB:', err);
  }

  const isConfigured = Boolean(keyId && keySecret);
  return {
    keyId,
    keySecret,
    webhookSecret,
    isConfigured,
    enableCod,
    enablePrepaid,
  };
}

/**
 * Creates a Razorpay Standard Payment Link.
 * If credentials are not configured, generates a local payment fallback link so the system
 * remains testable and functional immediately.
 */
export async function createRazorpayPaymentLink(
  options: CreatePaymentLinkOptions
): Promise<PaymentLinkResult> {
  const { keyId, keySecret, isConfigured } = await getRazorpayConfig(options.accountId);

  // If Razorpay keys are not provided yet, fallback to local pay checkout page
  if (!isConfigured) {
    let fallbackBase = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    if (fallbackBase.includes('example.com')) {
      fallbackBase = 'http://localhost:3000';
    }
    return {
      id: `plink_mock_${options.orderNumber}`,
      short_url: `${fallbackBase}/pay/${encodeURIComponent(options.orderNumber)}`,
      status: 'created',
      isMock: true,
    };
  }

  // Amount in paise (1 INR = 100 paise)
  const amountInPaise = Math.round(options.amount * 100);

  // Format customer phone: ensure international/E.164 digits
  let phoneDigits = options.customerPhone.replace(/\D/g, '');
  if (phoneDigits.length === 10) {
    phoneDigits = `+91${phoneDigits}`;
  } else if (!phoneDigits.startsWith('+')) {
    phoneDigits = `+${phoneDigits}`;
  }

  const payload: Record<string, unknown> = {
    amount: amountInPaise,
    currency: options.currency || 'INR',
    accept_partial: false,
    description: options.description || `Order #${options.orderNumber} - Pratap Store`,
    customer: {
      name: options.customerName,
      contact: phoneDigits,
      email: options.customerEmail || undefined,
    },
    notify: {
      sms: false,
      email: Boolean(options.customerEmail),
    },
    reminder_enable: true,
    notes: {
      order_id: options.orderId,
      order_number: options.orderNumber,
      account_id: options.accountId || undefined,
    },
  };

  if (options.callbackUrl) {
    payload.callback_url = options.callbackUrl;
    payload.callback_method = 'get';
  }

  const authHeader = Buffer.from(`${keyId}:${keySecret}`).toString('base64');

  try {
    const res = await fetch('https://api.razorpay.com/v1/payment_links', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${authHeader}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn('[Razorpay] Payment link creation failed, falling back to local pay page:', errText);
      let fallbackBase = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
      if (fallbackBase.includes('example.com')) {
        fallbackBase = 'http://localhost:3000';
      }
      return {
        id: `plink_fallback_${options.orderNumber}`,
        short_url: `${fallbackBase}/pay/${encodeURIComponent(options.orderNumber)}`,
        status: 'created',
        isMock: true,
      };
    }

    const data = await res.json();
    return {
      id: data.id,
      short_url: data.short_url,
      status: data.status,
      isMock: false,
    };
  } catch (error) {
    console.error('[Razorpay] Error invoking payment_links API:', error);
    let fallbackBase = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    if (fallbackBase.includes('example.com')) {
      fallbackBase = 'http://localhost:3000';
    }
    return {
      id: `plink_error_${options.orderNumber}`,
      short_url: `${fallbackBase}/pay/${encodeURIComponent(options.orderNumber)}`,
      status: 'created',
      isMock: true,
    };
  }
}

/**
 * Verifies Razorpay Webhook HMAC-SHA256 signature.
 */
export function verifyRazorpayWebhookSignature(
  rawBody: string,
  signature: string | null,
  secret?: string
): boolean {
  if (!signature) return false;
  const webhookSecret = secret || process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) return false;

  try {
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
    const signatureBuffer = Buffer.from(signature, 'utf8');

    if (expectedBuffer.length !== signatureBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
  } catch (error) {
    console.error('[Razorpay] Webhook verification error:', error);
    return false;
  }
}

/**
 * Checks whether a Razorpay Payment Link has been paid directly via Razorpay API.
 */
export async function checkRazorpayPaymentLinkStatus(
  paymentLinkId: string,
  accountId?: string
): Promise<{ paid: boolean; paymentId?: string; status?: string; amountPaid?: number }> {
  if (!paymentLinkId || paymentLinkId.startsWith('plink_mock_') || paymentLinkId.startsWith('plink_fallback_')) {
    return { paid: false };
  }

  const { keyId, keySecret, isConfigured } = await getRazorpayConfig(accountId);
  if (!isConfigured) return { paid: false };

  const authHeader = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  try {
    const res = await fetch(`https://api.razorpay.com/v1/payment_links/${paymentLinkId}`, {
      method: 'GET',
      headers: {
        Authorization: `Basic ${authHeader}`,
      },
    });

    if (!res.ok) {
      return { paid: false };
    }

    const data = await res.json();
    const isPaid = data.status === 'paid';
    const paymentId = data.payments?.[0]?.payment_id || null;
    return {
      paid: isPaid,
      paymentId: paymentId || undefined,
      status: data.status,
      amountPaid: data.amount_paid ? data.amount_paid / 100 : undefined,
    };
  } catch (error) {
    console.warn('[Razorpay] checkRazorpayPaymentLinkStatus error:', error);
    return { paid: false };
  }
}
