import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/flows/admin-client';
import { getRazorpayConfig } from '@/lib/payments/razorpay';
import { sendMessageToConversation } from '@/lib/whatsapp/send-message';
import type { Order } from '@/types/orders';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      amount,
      order_number,
      customer_phone,
      customer_name,
      note,
      account_id,
    } = body;

    if (!razorpay_payment_id) {
      return NextResponse.json({ error: 'Missing razorpay_payment_id' }, { status: 400 });
    }

    const { keyId, keySecret, isConfigured } = await getRazorpayConfig(account_id);

    // Verify payment with Razorpay API if keys configured
    let verified = false;
    let paymentAmount = amount || 50;

    if (isConfigured && keyId && keySecret) {
      try {
        const authHeader = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
        const rzpRes = await fetch(`https://api.razorpay.com/v1/payments/${razorpay_payment_id}`, {
          headers: { Authorization: `Basic ${authHeader}` },
        });

        if (rzpRes.ok) {
          const rzpData = await rzpRes.json();
          if (rzpData.status === 'captured' || rzpData.status === 'authorized') {
            verified = true;
            paymentAmount = rzpData.amount / 100;
          }
        }
      } catch (err) {
        console.warn('[RazorpayCapture] Verification via API failed, checking signature:', err);
      }

      if (!verified && razorpay_order_id && razorpay_signature) {
        const expectedSig = crypto
          .createHmac('sha256', keySecret)
          .update(`${razorpay_order_id}|${razorpay_payment_id}`)
          .digest('hex');

        if (expectedSig === razorpay_signature) {
          verified = true;
        }
      }
    } else {
      // Test/Simulated mode
      verified = true;
    }

    if (!verified) {
      return NextResponse.json(
        { error: 'Payment signature could not be verified by Razorpay' },
        { status: 400 }
      );
    }

    const db = supabaseAdmin();

    // If linked to an existing order, update it
    if (order_number) {
      const { data: order } = await db
        .from('orders')
        .select('*')
        .eq('order_number', order_number)
        .maybeSingle();

      if (order) {
        await db
          .from('orders')
          .update({
            payment_status: 'paid',
            order_status: 'confirmed',
            razorpay_payment_id,
            payment_captured_at: new Date().toISOString(),
          })
          .eq('id', (order as Order).id);
      }
    }

    // If customer phone is provided, send automated WhatsApp confirmation receipt
    if (customer_phone) {
      try {
        const cleanPhone = customer_phone.replace(/\D/g, '');
        const phoneFormatted = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

        const { data: contact } = await db
          .from('contacts')
          .select('id, account_id')
          .or(`phone.eq.${cleanPhone},phone.eq.+${cleanPhone},phone.eq.${phoneFormatted}`)
          .limit(1)
          .maybeSingle();

        if (contact) {
          const { data: convo } = await db
            .from('conversations')
            .select('id')
            .eq('contact_id', contact.id)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (convo) {
            const receiptMsg = `✅ *PAYMENT CONFIRMED & VERIFIED!*
━━━━━━━━━━━━━━━━━━━━
Namaste *${customer_name || 'Customer'}*, aapka payment successfully verify ho gaya hai!

💰 *Amount Paid:* *₹${paymentAmount}*
⚡ *Payment Method:* Online via Razorpay
🆔 *Transaction Ref:* \`${razorpay_payment_id}\`
${order_number ? `📦 *Order Number:* *${order_number}*` : ''}
━━━━━━━━━━━━━━━━━━━━
🎉 Aapka order confirm ho chuka hai aur printing queue me bhej diya gaya hai!
❤️ Thank you for choosing *Pratap Store*!`;

            await sendMessageToConversation(db, contact.account_id, {
              conversationId: convo.id,
              messageType: 'text',
              contentText: receiptMsg,
            });
          }
        }
      } catch (notifyErr) {
        console.warn('[RazorpayCapture] WhatsApp notification skipped:', notifyErr);
      }
    }

    return NextResponse.json({
      success: true,
      verified: true,
      payment_id: razorpay_payment_id,
      amount: paymentAmount,
    });
  } catch (error) {
    const err = error as Error;
    console.error('[RazorpayCapture] Error capturing payment:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
