import { getRazorpayConfig } from '@/lib/payments/razorpay';
import { CheckoutClient } from './checkout-client';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{
    amount?: string;
    desc?: string;
    note?: string;
    order_number?: string;
    phone?: string;
    name?: string;
    account_id?: string;
  }>;
}

export default async function CheckoutPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const numAmount = parseFloat(params.amount || '50') || 50;
  const description = params.desc || (numAmount === 50 ? 'COD Advance Booking - Pratap Store' : 'Order Payment - Pratap Store');
  const note = params.note || 'Customized Gifts & Prints';
  const orderNumber = params.order_number || '';
  const phone = params.phone || '';
  const customerName = params.name || 'Valued Customer';
  const accountId = params.account_id || '';

  const { keyId, isConfigured } = await getRazorpayConfig(accountId);
  const upiId = process.env.STORE_UPI_ID || 'pratapstore@jio';

  return (
    <CheckoutClient
      amount={numAmount}
      description={description}
      note={note}
      orderNumber={orderNumber}
      customerPhone={phone}
      customerName={customerName}
      razorpayKeyId={keyId || ''}
      isConfigured={isConfigured}
      upiId={upiId}
      accountId={accountId}
    />
  );
}
