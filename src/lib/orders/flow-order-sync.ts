import type { SupabaseClient } from '@supabase/supabase-js';
import type { Order, OrderItem, ShippingAddress } from '@/types/orders';

function generateOrderNumber(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `ORD-${dateStr}-${rand}`;
}

export interface SyncFlowRunOrderArgs {
  accountId: string;
  contactId?: string | null;
  conversationId?: string | null;
  flowRunId: string;
  vars: Record<string, unknown>;
}

/**
 * Synchronizes a customer's WhatsApp Flow run into the `orders` table.
 * Ensures the merchant can view the order, collected inputs, customer address,
 * size, and submitted UTR directly in the /orders dashboard!
 */
export async function syncFlowRunToOrders(
  db: SupabaseClient,
  args: SyncFlowRunOrderArgs
): Promise<Order | null> {
  const { accountId, contactId, conversationId, flowRunId, vars } = args;

  const customerName = String(vars.customer_name || vars.name || vars.full_name || '').trim();
  const customerPhone = String(vars.customer_phone || vars.phone || vars.mobile || '').trim();
  const addressText = String(vars.shipping_address || vars.address || vars.delivery_address || '').trim();
  const pincode = String(vars.pincode || vars.pin || vars.postal_code || '').trim();
  const utrNumber = String(vars.cod_payment_utr || vars.prepaid_payment_utr || vars.utr || '').trim();
  const selectedSize = String(vars.selected_size || vars.product_size || vars.size || vars.variant || 'Standard').trim();
  const productName = String(vars.selected_product_name || vars.product_name || vars.product || vars.item || 'Customized Item').trim();
  const rawPrice = Number(vars.product_price || vars.price || vars.amount) || 399;

  // We need at least customer name or phone to create a meaningful order
  if (!customerName && !customerPhone && !addressText) {
    return null;
  }

  try {
    // 1. Check if an order already exists for this flow_run_id
    const { data: existing } = await db
      .from('orders')
      .select('*')
      .eq('account_id', accountId)
      .filter('metadata->>flow_run_id', 'eq', flowRunId)
      .maybeSingle();

    const paymentMethod = vars.cod_payment_utr || vars.payment_method === 'cod' ? 'cod' : 'upi_manual';
    const fullStreet = addressText;

    const shippingAddress: ShippingAddress = {
      recipient_name: customerName || 'Valued Customer',
      phone: customerPhone || undefined,
      street: fullStreet,
      city: '',
      state: '',
      pincode: pincode || '',
    };

    const items: OrderItem[] = [
      {
        name: productName,
        variant: selectedSize !== 'Standard' ? selectedSize : undefined,
        price: rawPrice,
        quantity: 1,
        subtotal: rawPrice,
      },
    ];

    const notesSummary = [
      `[WhatsApp Flow Order]`,
      `Product: ${productName}`,
      selectedSize ? `Size: ${selectedSize}` : '',
      utrNumber ? `Submitted UTR: ${utrNumber}` : 'UTR: Pending',
      `Address: ${fullStreet} (PIN: ${pincode})`,
    ]
      .filter(Boolean)
      .join(' | ');

    if (existing) {
      // Update existing order with latest inputs
      const updatePayload: Record<string, unknown> = {
        customer_name: customerName || existing.customer_name,
        customer_phone: customerPhone || existing.customer_phone,
        shipping_address: shippingAddress,
        items,
        total_amount: rawPrice,
        subtotal: rawPrice,
        payment_method: paymentMethod,
        notes: notesSummary,
        metadata: {
          ...(existing.metadata || {}),
          flow_run_id: flowRunId,
          utr: utrNumber || (existing.metadata as any)?.utr,
          size: selectedSize,
          product_name: productName,
          pincode: pincode,
        },
      };

      const { data: updated } = await db
        .from('orders')
        .update(updatePayload)
        .eq('id', existing.id)
        .select('*')
        .single();

      return (updated as Order) || (existing as Order);
    }

    // 2. Insert new order
    const orderNumber = generateOrderNumber();

    const { data: created, error } = await db
      .from('orders')
      .insert({
        account_id: accountId,
        contact_id: contactId || null,
        conversation_id: conversationId || null,
        order_number: orderNumber,
        customer_name: customerName || 'WhatsApp Customer',
        customer_phone: customerPhone || '',
        shipping_address: shippingAddress,
        items,
        subtotal: rawPrice,
        total_amount: rawPrice,
        currency: 'INR',
        payment_method: paymentMethod,
        payment_status: 'pending',
        order_status: 'new',
        notes: notesSummary,
        metadata: {
          flow_run_id: flowRunId,
          utr: utrNumber || null,
          size: selectedSize,
          product_name: productName,
          pincode: pincode,
        },
      })
      .select('*')
      .single();

    if (error) {
      console.error('[FlowOrderSync] Error inserting order:', error);
      return null;
    }

    return created as Order;
  } catch (err) {
    console.error('[FlowOrderSync] Exception in syncFlowRunToOrders:', err);
    return null;
  }
}
