import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/flows/admin-client';
import { getRazorpayConfig } from '@/lib/payments/razorpay';
import type { Order } from '@/types/orders';
import { PayClient } from './pay-client';

interface PageProps {
  params: Promise<{ orderNumber: string }>;
}

export const dynamic = 'force-dynamic';

export default async function PayPage({ params }: PageProps) {
  const { orderNumber } = await params;
  const decodedNumber = decodeURIComponent(orderNumber);

  const db = supabaseAdmin();
  const { data, error } = await db
    .from('orders')
    .select('*')
    .eq('order_number', decodedNumber)
    .maybeSingle();

  if (error || !data) {
    notFound();
  }

  const order = data as Order;
  const { keyId } = await getRazorpayConfig(order.account_id);

  return <PayClient initialOrder={order} razorpayKeyId={keyId || ''} />;
}
