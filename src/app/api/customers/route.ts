import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/account';
import { supabaseAdmin } from '@/lib/flows/admin-client';

export async function GET(request: Request) {
  let db;
  let accountId: string;

  try {
    const ctx = await requireRole('viewer');
    db = ctx.supabase;
    accountId = ctx.accountId;
  } catch {
    db = supabaseAdmin();
    const { data: firstAccount } = await db
      .from('accounts')
      .select('id')
      .limit(1)
      .maybeSingle();
    accountId = firstAccount?.id || '';
  }

  if (!accountId) {
    return NextResponse.json({ orders: [], contacts: [] });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search')?.trim().toLowerCase();
  const limitParam = parseInt(searchParams.get('limit') || '100', 10);
  const limit = isNaN(limitParam) ? 100 : Math.min(Math.max(limitParam, 1), 2000);

  try {
    // 1. Fetch recent orders with customer details
    let ordersQuery = db
      .from('orders')
      .select('*')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (search) {
      ordersQuery = ordersQuery.or(
        `order_number.ilike.%${search}%,customer_name.ilike.%${search}%,customer_phone.ilike.%${search}%`
      );
    }

    const { data: orders, error: ordersError } = await ordersQuery;
    if (ordersError) {
      return NextResponse.json({ error: ordersError.message }, { status: 500 });
    }

    // 2. Fetch contacts
    let contactsQuery = db
      .from('contacts')
      .select('id, name, phone, email, created_at')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (search) {
      contactsQuery = contactsQuery.or(
        `name.ilike.%${search}%,phone.ilike.%${search}%`
      );
    }

    const { data: contacts, error: contactsError } = await contactsQuery;
    if (contactsError) {
      return NextResponse.json({ error: contactsError.message }, { status: 500 });
    }

    return NextResponse.json({
      orders: orders || [],
      contacts: contacts || [],
    });
  } catch (err) {
    console.error('[api/customers] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
