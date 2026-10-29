import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/flows/admin-client';
import { sendOrderNotification } from '@/lib/orders/whatsapp-notifications';
import type { Order } from '@/types/orders';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    const adminDb = supabaseAdmin();
    const { data: order, error } = await adminDb
      .from('orders')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const currentOrder = order as Order;
    if (currentOrder.payment_status === 'paid') {
      return NextResponse.json({ success: true, order: currentOrder });
    }

    const paymentId = `pay_sim_${Date.now()}`;
    const { data: updated, error: updateErr } = await adminDb
      .from('orders')
      .update({
        payment_status: 'paid',
        order_status: currentOrder.order_status === 'new' ? 'confirmed' : currentOrder.order_status,
        razorpay_payment_id: paymentId,
        payment_captured_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single();

    if (updateErr || !updated) {
      return NextResponse.json({ error: 'Failed to update order status' }, { status: 500 });
    }

    const fullOrder = updated as Order;

    // Send WhatsApp notification
    const whatsappResult = await sendOrderNotification({
      order: fullOrder,
      type: 'paid',
    });

    return NextResponse.json({
      success: true,
      order: fullOrder,
      whatsapp: whatsappResult,
    });
  } catch (error) {
    const err = error as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
