import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { supabaseAdmin } from '@/lib/flows/admin-client';
import type { Product } from '@/types/orders';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  let ctx;
  try {
    ctx = await requireRole('viewer');
  } catch (err) {
    return toErrorResponse(err);
  }

  const { id } = await context.params;
  const { data, error } = await ctx.supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .eq('account_id', ctx.accountId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  return NextResponse.json({ product: data as Product });
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  let ctx;
  try {
    ctx = await requireRole('agent');
  } catch (err) {
    return toErrorResponse(err);
  }

  const { id } = await context.params;

  try {
    const body = await request.json();
    const {
      name,
      description,
      category,
      price,
      compare_at_price,
      image_url,
      sku,
      in_stock,
      variants,
    } = body;

    const updates: Record<string, unknown> = {};
    if (name !== undefined) {
      if (!name.trim()) {
        return NextResponse.json({ error: 'Product name cannot be empty' }, { status: 400 });
      }
      updates.name = name.trim();
    }
    if (description !== undefined) updates.description = description ? description.trim() : null;
    if (category !== undefined) updates.category = category.trim() || 'General';
    if (price !== undefined) {
      const numPrice = Number(price);
      if (isNaN(numPrice) || numPrice < 0) {
        return NextResponse.json({ error: 'Valid price is required' }, { status: 400 });
      }
      updates.price = numPrice;
    }
    if (compare_at_price !== undefined) {
      updates.compare_at_price = compare_at_price ? Number(compare_at_price) : null;
    }
    if (image_url !== undefined) updates.image_url = image_url?.trim() || null;
    if (sku !== undefined) updates.sku = sku?.trim() || null;
    if (in_stock !== undefined) updates.in_stock = Boolean(in_stock);
    if (variants !== undefined) updates.variants = variants || [];

    const adminDb = supabaseAdmin();
    const { data, error } = await adminDb
      .from('products')
      .update(updates)
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ product: data as Product });
  } catch (error) {
    const err = error as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  let ctx;
  try {
    ctx = await requireRole('agent');
  } catch (err) {
    return toErrorResponse(err);
  }

  const { id } = await context.params;
  const adminDb = supabaseAdmin();
  const { error } = await adminDb
    .from('products')
    .delete()
    .eq('id', id)
    .eq('account_id', ctx.accountId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, id });
}
