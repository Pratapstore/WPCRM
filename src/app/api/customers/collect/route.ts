import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/flows/admin-client';
import { getCurrentAccount } from '@/lib/auth/account';

function generateOrderNumber(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `ORD-${dateStr}-${rand}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON request' }, { status: 400 });
    }

    const {
      fullName,
      phone,
      email,
      address,
      city,
      state,
      pincode,
      product,
      size,
      price,
      quantity,
      paymentMethod,
      notes,
    } = body;

    const cleanPhone = String(phone || '').replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      return NextResponse.json({ error: 'Valid 10-digit mobile number is required' }, { status: 400 });
    }
    const tenDigitPhone = cleanPhone.length === 12 && cleanPhone.startsWith('91') ? cleanPhone.slice(2) : cleanPhone.slice(-10);

    const cleanName = String(fullName || '').trim() || 'Valued Customer';
    const cleanAddress = String(address || '').trim();
    const cleanPin = String(pincode || '').replace(/\D/g, '').slice(0, 6);
    const cleanProduct = String(product || 'Customized Item').trim();
    const cleanSize = String(size || 'M - 38').trim();
    const numPrice = Number(price) || 399;
    const numQty = Math.max(1, Number(quantity) || 1);
    const totalAmount = numPrice * numQty;

    const db = supabaseAdmin();

    // Resolve Account ID
    let accountId = body.accountId;
    if (!accountId) {
      const accountCtx = await getCurrentAccount().catch(() => null);
      if (accountCtx?.accountId) {
        accountId = accountCtx.accountId;
      } else {
        // Fallback: lookup the primary account from accounts table
        const { data: firstAccount } = await db
          .from('accounts')
          .select('id')
          .limit(1)
          .maybeSingle();
        accountId = firstAccount?.id;
      }
    }

    if (!accountId) {
      return NextResponse.json({ error: 'Account not found' }, { status: 400 });
    }

    // 1. Upsert or find Contact in contacts table
    // Try to find existing contact by phone & account_id
    let contactId: string | null = null;
    const { data: existingContact } = await db
      .from('contacts')
      .select('id, name')
      .eq('account_id', accountId)
      .eq('phone', tenDigitPhone)
      .maybeSingle();

    if (existingContact) {
      contactId = existingContact.id;
      // Update name or metadata if changed
      await db
        .from('contacts')
        .update({
          name: cleanName,
          email: email || undefined,
          updated_at: new Date().toISOString(),
        })
        .eq('id', contactId);
    } else {
      // Find user_id from profiles to satisfy contacts FK constraint
      const { data: profile } = await db
        .from('profiles')
        .select('user_id')
        .eq('account_id', accountId)
        .limit(1)
        .maybeSingle();

      const ownerUserId = profile?.user_id;
      if (ownerUserId) {
        const { data: newContact, error: contactErr } = await db
          .from('contacts')
          .insert({
            account_id: accountId,
            user_id: ownerUserId,
            phone: tenDigitPhone,
            name: cleanName,
            email: email || null,
          })
          .select('id')
          .single();

        if (contactErr) {
          console.error('[customers/collect] contact insert error:', contactErr.message);
        } else if (newContact) {
          contactId = newContact.id;
        }
      }
    }

    // 2. Create Order if delivery address or product provided
    let orderNumber = generateOrderNumber();
    let orderId: string | null = null;

    const shippingAddress = {
      recipient_name: cleanName,
      phone: tenDigitPhone,
      street: cleanAddress,
      city: String(city || '').trim(),
      state: String(state || '').trim(),
      postal_code: cleanPin,
      country: 'India',
    };

    const items = [
      {
        product_name: cleanProduct,
        size: cleanSize,
        price: numPrice,
        quantity: numQty,
        total: totalAmount,
      },
    ];

    const { data: order, error: orderErr } = await db
      .from('orders')
      .insert({
        account_id: accountId,
        contact_id: contactId,
        order_number: orderNumber,
        customer_name: cleanName,
        customer_phone: tenDigitPhone,
        customer_email: email || null,
        shipping_address: shippingAddress,
        items,
        subtotal: totalAmount,
        total_amount: totalAmount,
        payment_method: paymentMethod || 'cod',
        payment_status: paymentMethod === 'paid' ? 'paid' : 'pending',
        order_status: 'new',
        notes: notes ? String(notes).trim() : null,
        metadata: {
          source: 'customer_collection_portal',
          captured_at: new Date().toISOString(),
        },
      })
      .select('id, order_number')
      .single();

    if (orderErr) {
      console.error('[customers/collect] order insert error:', orderErr.message);
    } else if (order) {
      orderId = order.id;
      orderNumber = order.order_number;
    }

    return NextResponse.json({
      ok: true,
      contactId,
      orderId,
      orderNumber,
      customer: {
        fullName: cleanName,
        phone: tenDigitPhone,
        address: cleanAddress,
        pincode: cleanPin,
        product: cleanProduct,
        size: cleanSize,
        price: numPrice,
      },
    });
  } catch (err) {
    console.error('[customers/collect] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
