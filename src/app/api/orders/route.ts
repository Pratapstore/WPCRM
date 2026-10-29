import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { supabaseAdmin } from '@/lib/flows/admin-client';
import { createRazorpayPaymentLink } from '@/lib/payments/razorpay';
import { sendOrderNotification } from '@/lib/orders/whatsapp-notifications';
import type { Order, OrderItem, ShippingAddress } from '@/types/orders';

function generateOrderNumber(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `ORD-${dateStr}-${rand}`;
}

export async function GET(request: Request) {
  let ctx;
  try {
    ctx = await requireRole('viewer');
  } catch (err) {
    return toErrorResponse(err);
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('order_status');
  const paymentStatus = searchParams.get('payment_status');
  const search = searchParams.get('search')?.trim().toLowerCase();

  const contactId = searchParams.get('contact_id');

  let query = ctx.supabase
    .from('orders')
    .select('*')
    .eq('account_id', ctx.accountId)
    .order('created_at', { ascending: false });

  if (contactId) {
    query = query.eq('contact_id', contactId);
  }

  if (status && status !== 'all') {
    query = query.eq('order_status', status);
  }

  if (paymentStatus && paymentStatus !== 'all') {
    query = query.eq('payment_status', paymentStatus);
  }

  if (search) {
    query = query.or(
      `order_number.ilike.%${search}%,customer_name.ilike.%${search}%,customer_phone.ilike.%${search}%`
    );
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ orders: (data as Order[]) ?? [] });
}

export async function POST(request: Request) {
  let ctx;
  try {
    ctx = await requireRole('agent');
  } catch (err) {
    return toErrorResponse(err);
  }

  try {
    const body = await request.json();
    const {
      customer_name,
      customer_phone,
      customer_email,
      shipping_address,
      items,
      discount_amount = 0,
      shipping_fee = 0,
      tax_amount = 0,
      payment_method = 'razorpay',
      notes,
      send_whatsapp = true,
      contact_id,
      conversation_id,
    } = body;

    if (!customer_name?.trim()) {
      return NextResponse.json({ error: 'Customer name is required' }, { status: 400 });
    }
    if (!customer_phone?.trim()) {
      return NextResponse.json({ error: 'Customer phone number is required' }, { status: 400 });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'At least one item is required in the order' }, { status: 400 });
    }

    // Format and calculate items
    const formattedItems: OrderItem[] = items.map((it: Partial<OrderItem>) => {
      const price = Number(it.price) || 0;
      const quantity = Math.max(1, Number(it.quantity) || 1);
      return {
        product_id: it.product_id,
        name: it.name || 'Custom Product',
        price,
        quantity,
        variant: it.variant,
        image_url: it.image_url,
        subtotal: price * quantity,
      };
    });

    const subtotal = formattedItems.reduce((acc, curr) => acc + curr.subtotal, 0);
    const discount = Math.max(0, Number(discount_amount) || 0);
    const shipping = Math.max(0, Number(shipping_fee) || 0);
    const tax = Math.max(0, Number(tax_amount) || 0);
    const total_amount = Math.max(0, subtotal - discount + shipping + tax);

    const orderNumber = generateOrderNumber();

    // 1. Initial insert into orders table
    const orderPayload = {
      account_id: ctx.accountId,
      contact_id: contact_id || null,
      conversation_id: conversation_id || null,
      order_number: orderNumber,
      customer_name: customer_name.trim(),
      customer_phone: customer_phone.trim(),
      customer_email: customer_email?.trim() || null,
      shipping_address: (shipping_address || {}) as ShippingAddress,
      items: formattedItems,
      subtotal,
      discount_amount: discount,
      shipping_fee: shipping,
      tax_amount: tax,
      total_amount,
      currency: 'INR',
      payment_method,
      payment_status: 'pending',
      order_status: 'new',
      notes: notes || null,
    };

    const adminDb = supabaseAdmin();
    const { data: createdOrder, error: insertErr } = await adminDb
      .from('orders')
      .insert(orderPayload)
      .select('*')
      .single();

    if (insertErr || !createdOrder) {
      console.error('[CreateOrder] Insert error:', insertErr);
      return NextResponse.json({ error: insertErr?.message || 'Failed to create order' }, { status: 500 });
    }

    let updatedOrder = createdOrder as Order;

    // 2. Generate Razorpay Payment Link if payment method is razorpay
    if (payment_method === 'razorpay' && total_amount > 0) {
      const linkResult = await createRazorpayPaymentLink({
        orderId: updatedOrder.id,
        orderNumber: updatedOrder.order_number,
        amount: updatedOrder.total_amount,
        customerName: updatedOrder.customer_name,
        customerPhone: updatedOrder.customer_phone,
        customerEmail: updatedOrder.customer_email,
        description: `Order #${updatedOrder.order_number} - Pratap Store`,
      });

      const { data: withLink } = await adminDb
        .from('orders')
        .update({
          razorpay_payment_link_id: linkResult.id,
          razorpay_payment_link_url: linkResult.short_url,
        })
        .eq('id', updatedOrder.id)
        .select('*')
        .single();

      if (withLink) {
        updatedOrder = withLink as Order;
      }
    }

    // 3. Send WhatsApp confirmation message if requested
    let whatsappResult: { success: boolean; messageId?: string; error?: string } = {
      success: false,
      error: 'Not requested',
    };
    if (send_whatsapp) {
      whatsappResult = await sendOrderNotification({
        order: updatedOrder,
        type: 'created',
      });
    }

    return NextResponse.json({
      order: updatedOrder,
      payment_link: updatedOrder.razorpay_payment_link_url,
      whatsapp: whatsappResult,
    });
  } catch (error) {
    const err = error as Error;
    console.error('[CreateOrder] Unexpected error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
