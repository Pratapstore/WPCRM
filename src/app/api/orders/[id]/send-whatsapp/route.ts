import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { supabaseAdmin } from '@/lib/flows/admin-client';
import { sendOrderNotification, type NotificationType } from '@/lib/orders/whatsapp-notifications';
import type { Order } from '@/types/orders';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  let ctx;
  try {
    ctx = await requireRole('agent');
  } catch (err) {
    return toErrorResponse(err);
  }

  const { id } = await context.params;

  try {
    const body = await request.json();
    const type: NotificationType = body.type || 'created';
    const customMessage = body.custom_message;

    const adminDb = supabaseAdmin();
    const { data: order, error } = await adminDb
      .from('orders')
      .select('*')
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .single();

    if (error || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const result = await sendOrderNotification({
      order: order as Order,
      type,
      customMessage,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to send WhatsApp message' },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true, messageId: result.messageId });
  } catch (error) {
    const err = error as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
