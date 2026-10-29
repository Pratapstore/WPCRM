import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { supabaseAdmin } from '@/lib/flows/admin-client';
import { sendOrderNotification } from '@/lib/orders/whatsapp-notifications';
import type { Order } from '@/types/orders';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  let ctx;
  try {
    ctx = await requireRole('viewer');
  } catch (err) {
    return toErrorResponse(err);
  }

  const { id } = await context.params;

  const { data, error } = await ctx.supabase
    .from('orders')
    .select('*')
    .eq('id', id)
    .eq('account_id', ctx.accountId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message || 'Order not found' }, { status: 404 });
  }

  return NextResponse.json({ order: data as Order });
}

export async function PATCH(request: Request, context: RouteContext) {
  let ctx;
  try {
    ctx = await requireRole('agent');
  } catch (err) {
    return toErrorResponse(err);
  }

  const { id } = await context.params;

  try {
    const body = await request.json();
    const adminDb = supabaseAdmin();

    // 1. Fetch current order
    const { data: existing, error: fetchErr } = await adminDb
      .from('orders')
      .select('*')
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .single();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const previousOrder = existing as Order;

    // Fields allowed to update
    const updatePayload: Record<string, unknown> = {};

    if (body.order_status !== undefined) updatePayload.order_status = body.order_status;
    if (body.customer_name !== undefined) updatePayload.customer_name = body.customer_name?.trim();
    if (body.customer_phone !== undefined) updatePayload.customer_phone = body.customer_phone?.trim();
    if (body.customer_email !== undefined) updatePayload.customer_email = body.customer_email?.trim() || null;
    if (body.items !== undefined) updatePayload.items = body.items;
    if (body.total_amount !== undefined) updatePayload.total_amount = Number(body.total_amount);
    if (body.payment_method !== undefined) updatePayload.payment_method = body.payment_method;
    if (body.payment_status !== undefined) {
      updatePayload.payment_status = body.payment_status;
      if (body.payment_status === 'paid' && !previousOrder.payment_captured_at) {
        updatePayload.payment_captured_at = new Date().toISOString();
      }
    }
    if (body.tracking_carrier !== undefined) updatePayload.tracking_carrier = body.tracking_carrier;
    if (body.tracking_number !== undefined) updatePayload.tracking_number = body.tracking_number;
    if (body.tracking_url !== undefined) updatePayload.tracking_url = body.tracking_url;
    if (body.notes !== undefined) updatePayload.notes = body.notes;
    if (body.shipping_address !== undefined) updatePayload.shipping_address = body.shipping_address;

    const { data: updated, error: updateErr } = await adminDb
      .from('orders')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single();

    if (updateErr || !updated) {
      return NextResponse.json({ error: updateErr?.message || 'Update failed' }, { status: 500 });
    }

    const currentOrder = updated as Order;

    // Trigger WhatsApp notification if requested
    let whatsappResult = null;
    const sendWhatsapp = body.send_whatsapp !== false;

    if (sendWhatsapp) {
      if (
        body.order_status === 'shipped' ||
        (body.tracking_number && body.tracking_number !== previousOrder.tracking_number)
      ) {
        whatsappResult = await sendOrderNotification({
          order: currentOrder,
          type: 'shipped',
        });
      } else if (body.order_status === 'delivered') {
        whatsappResult = await sendOrderNotification({
          order: currentOrder,
          type: 'delivered',
        });
      } else if (body.order_status === 'confirmed' || body.order_status === 'processing') {
        whatsappResult = await sendOrderNotification({
          order: currentOrder,
          type: 'confirmed',
        });
      } else if (body.payment_status === 'paid' && previousOrder.payment_status !== 'paid') {
        whatsappResult = await sendOrderNotification({
          order: currentOrder,
          type: 'paid',
        });
      } else if (body.order_status === 'cancelled') {
        whatsappResult = await sendOrderNotification({
          order: currentOrder,
          type: 'cancelled',
        });
      }
    }

    return NextResponse.json({
      order: currentOrder,
      whatsapp: whatsappResult,
    });
  } catch (error) {
    const err = error as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  let ctx;
  try {
    ctx = await requireRole('agent');
  } catch (err) {
    return toErrorResponse(err);
  }

  const { id } = await context.params;
  const adminDb = supabaseAdmin();

  const { error } = await adminDb
    .from('orders')
    .delete()
    .eq('id', id)
    .eq('account_id', ctx.accountId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, id });
}
