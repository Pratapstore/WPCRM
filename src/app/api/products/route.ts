import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { supabaseAdmin } from '@/lib/flows/admin-client';
import type { Product } from '@/types/orders';

const PRATAP_STORE_DEFAULT_PRODUCTS = [
  {
    name: 'Custom Acrylic Photo Keychain',
    description: 'High-definition 3mm clear acrylic photo keychain with double-sided waterproof print.',
    category: 'Keychains',
    price: 199,
    compare_at_price: 299,
    image_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop&q=80',
    sku: 'KC-ACR-01',
    variants: [{ name: 'Shape', options: ['Square', 'Circle', 'Heart', 'Spotify Code'] }],
    in_stock: true,
  },
  {
    name: 'Premium Metal Photo Keychain',
    description: 'Durable laser-engraved metal alloy photo keychain with gift box packaging.',
    category: 'Keychains',
    price: 249,
    compare_at_price: 399,
    image_url: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=500&auto=format&fit=crop&q=80',
    sku: 'KC-MET-02',
    variants: [{ name: 'Finish', options: ['Glossy Chrome', 'Matte Black', 'Gold'] }],
    in_stock: true,
  },
  {
    name: 'Personalized Magic Heat-Sensitive Mug',
    description: 'Black ceramic mug that reveals your custom photo and message when hot liquid is poured.',
    category: 'Mugs',
    price: 399,
    compare_at_price: 599,
    image_url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=500&auto=format&fit=crop&q=80',
    sku: 'MUG-MAG-01',
    variants: [{ name: 'Capacity', options: ['325 ml', '450 ml'] }],
    in_stock: true,
  },
  {
    name: 'Custom White Ceramic Photo Mug',
    description: 'High-gloss microwave-safe ceramic coffee mug with vibrant 360-degree wrap print.',
    category: 'Mugs',
    price: 299,
    compare_at_price: 449,
    image_url: 'https://images.unsplash.com/photo-1577937927133-66ef06acdf18?w=500&auto=format&fit=crop&q=80',
    sku: 'MUG-CER-02',
    variants: [{ name: 'Inside Color', options: ['White', 'Red', 'Black', 'Yellow'] }],
    in_stock: true,
  },
  {
    name: 'Custom Photo Printed T-Shirt',
    description: '100% bio-washed breathable combed cotton t-shirt with vivid DTF printing.',
    category: 'Apparel',
    price: 499,
    compare_at_price: 799,
    image_url: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=500&auto=format&fit=crop&q=80',
    sku: 'TSH-CTN-01',
    variants: [
      { name: 'Size', options: ['S', 'M', 'L', 'XL', 'XXL'] },
      { name: 'Color', options: ['Black', 'White', 'Navy Blue', 'Maroon'] },
    ],
    in_stock: true,
  },
  {
    name: 'Reversible Magic Sequin Photo Cushion',
    description: 'Heart/Square shaped sequin pillow that reveals hidden photo with a gentle swipe of hand.',
    category: 'Cushions',
    price: 549,
    compare_at_price: 899,
    image_url: 'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?w=500&auto=format&fit=crop&q=80',
    sku: 'CSH-SEQ-01',
    variants: [{ name: 'Shape', options: ['Heart 16x16', 'Square 16x16'] }],
    in_stock: true,
  },
  {
    name: 'Custom LED Acrylic Night Lamp Frame',
    description: 'Warm LED wooden base with engraved clear acrylic photo sheet. Perfect anniversary or birthday gift.',
    category: 'Photo Frames',
    price: 699,
    compare_at_price: 1199,
    image_url: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=500&auto=format&fit=crop&q=80',
    sku: 'LMP-LED-01',
    variants: [{ name: 'Light Color', options: ['Warm White', 'RGB Multi-Color'] }],
    in_stock: true,
  },
];

export async function GET(request: Request) {
  let ctx;
  try {
    ctx = await requireRole('viewer');
  } catch (err) {
    return toErrorResponse(err);
  }

  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');
  const search = searchParams.get('search')?.trim().toLowerCase();

  let query = ctx.supabase
    .from('products')
    .select('*')
    .eq('account_id', ctx.accountId)
    .order('created_at', { ascending: false });

  if (category && category !== 'all') {
    query = query.eq('category', category);
  }

  if (search) {
    query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%,sku.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // If table is completely empty, auto-seed default products for this account
  if (!data || data.length === 0) {
    const adminDb = supabaseAdmin();
    const rows = PRATAP_STORE_DEFAULT_PRODUCTS.map((p) => ({
      ...p,
      account_id: ctx.accountId,
    }));
    const { data: seeded } = await adminDb.from('products').insert(rows).select('*');
    return NextResponse.json({ products: (seeded as Product[]) ?? [] });
  }

  return NextResponse.json({ products: (data as Product[]) ?? [] });
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

    // Check if user requested to re-seed defaults
    if (body.seed === true) {
      const adminDb = supabaseAdmin();
      const rows = PRATAP_STORE_DEFAULT_PRODUCTS.map((p) => ({
        ...p,
        account_id: ctx.accountId,
      }));
      const { data: seeded, error: seedErr } = await adminDb.from('products').insert(rows).select('*');
      if (seedErr) {
        return NextResponse.json({ error: seedErr.message }, { status: 500 });
      }
      return NextResponse.json({ products: (seeded as Product[]) ?? [] });
    }

    const {
      name,
      description,
      category = 'Gifts',
      price,
      compare_at_price,
      image_url,
      sku,
      in_stock = true,
      variants = [],
    } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Product name is required' }, { status: 400 });
    }

    const numericPrice = Number(price);
    if (isNaN(numericPrice) || numericPrice < 0) {
      return NextResponse.json({ error: 'Valid price is required' }, { status: 400 });
    }

    const { data, error } = await ctx.supabase
      .from('products')
      .insert({
        account_id: ctx.accountId,
        name: name.trim(),
        description: description?.trim() || null,
        category: category.trim(),
        price: numericPrice,
        compare_at_price: compare_at_price ? Number(compare_at_price) : null,
        image_url: image_url || null,
        sku: sku?.trim() || null,
        in_stock: Boolean(in_stock),
        variants: variants || [],
      })
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

export async function PUT(request: Request) {
  let ctx;
  try {
    ctx = await requireRole('agent');
  } catch (err) {
    return toErrorResponse(err);
  }

  try {
    const body = await request.json();
    const {
      id,
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

    if (!id) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

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

export async function DELETE(request: Request) {
  let ctx;
  try {
    ctx = await requireRole('agent');
  } catch (err) {
    return toErrorResponse(err);
  }

  try {
    const { searchParams } = new URL(request.url);
    let id = searchParams.get('id');

    if (!id) {
      const body = await request.json().catch(() => ({}));
      id = body?.id;
    }

    if (!id) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

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
  } catch (error) {
    const err = error as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
