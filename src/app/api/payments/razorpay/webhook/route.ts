import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/flows/admin-client';
import { verifyRazorpayWebhookSignature } from '@/lib/payments/razorpay';
import { sendOrderNotification } from '@/lib/orders/whatsapp-notifications';
import type { Order } from '@/types/orders';

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-razorpay-signature');

    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
    if (webhookSecret) {
      const isValid = verifyRazorpayWebhookSignature(rawBody, signature, webhookSecret);
      if (!isValid) {
        console.warn('[RazorpayWebhook] Invalid signature received');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
      }
    } else {
      console.warn('[RazorpayWebhook] RAZORPAY_WEBHOOK_SECRET unset; signature verification skipped');
    }

    const event = JSON.parse(rawBody);
    const eventType = event.event;
    console.log('[RazorpayWebhook] Received event:', eventType);

    if (eventType === 'payment_link.paid' || eventType === 'payment.captured') {
      const paymentLinkEntity = event.payload?.payment_link?.entity;
      const paymentEntity = event.payload?.payment?.entity;

      const orderId =
        paymentLinkEntity?.notes?.order_id ||
        paymentEntity?.notes?.order_id;

      const orderNumber =
        paymentLinkEntity?.notes?.order_number ||
        paymentEntity?.notes?.order_number;

      const paymentLinkId = paymentLinkEntity?.id;
      const paymentId = paymentEntity?.id;

      const db = supabaseAdmin();

      // Find order by ID, order_number, or payment_link_id
      let query = db.from('orders').select('*');
      if (orderId) {
        query = query.eq('id', orderId);
      } else if (orderNumber) {
        query = query.eq('order_number', orderNumber);
      } else if (paymentLinkId) {
        query = query.eq('razorpay_payment_link_id', paymentLinkId);
      } else {
        console.warn('[RazorpayWebhook] No identifier found in event payload');
        return NextResponse.json({ status: 'ignored', reason: 'No order identifier' });
      }

      const { data: order, error } = await query.maybeSingle();
      if (error || !order) {
        console.warn('[RazorpayWebhook] Order not found for webhook:', { orderId, orderNumber, paymentLinkId });
        return NextResponse.json({ status: 'ignored', reason: 'Order not found' });
      }

      const currentOrder = order as Order;

      // Update order to paid and confirmed
      const updatePayload: Record<string, unknown> = {
        payment_status: 'paid',
        payment_captured_at: new Date().toISOString(),
      };

      if (paymentId) {
        updatePayload.razorpay_payment_id = paymentId;
      }
      if (currentOrder.order_status === 'new') {
        updatePayload.order_status = 'confirmed';
      }

      const { data: updatedOrder, error: updateErr } = await db
        .from('orders')
        .update(updatePayload)
        .eq('id', currentOrder.id)
        .select('*')
        .single();

      if (updateErr || !updatedOrder) {
        console.error('[RazorpayWebhook] Error updating order:', updateErr);
        return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
      }

      // Automatically send WhatsApp Order Confirmed & Receipt alert
      const fullOrder = updatedOrder as Order;
      await sendOrderNotification({
        order: fullOrder,
        type: 'paid',
      });

      return NextResponse.json({
        status: 'ok',
        order_number: fullOrder.order_number,
        payment_status: 'paid',
      });
    }

    return NextResponse.json({ status: 'ignored', event: eventType });
  } catch (error) {
    const err = error as Error;
    console.error('[RazorpayWebhook] Exception processing webhook:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
