'use client';

import { useState } from 'react';
import Script from 'next/script';
import Image from 'next/image';
import {
  ShieldCheck,
  CheckCircle2,
  Smartphone,
  CreditCard,
  QrCode,
  Copy,
  ExternalLink,
  ArrowRight,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';

interface CheckoutClientProps {
  amount: number;
  description: string;
  note: string;
  orderNumber: string;
  customerPhone: string;
  customerName: string;
  razorpayKeyId: string;
  isConfigured: boolean;
  upiId: string;
  accountId?: string;
}

export function CheckoutClient({
  amount,
  description,
  note,
  orderNumber,
  customerPhone,
  customerName,
  razorpayKeyId,
  isConfigured,
  upiId,
  accountId,
}: CheckoutClientProps) {
  const [loading, setLoading] = useState(false);
  const [paidSuccess, setPaidSuccess] = useState(false);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const qrUrl = `/api/payments/upi-qr?amount=${amount}&upi_id=${encodeURIComponent(
    upiId
  )}&note=${encodeURIComponent(description)}&name=${encodeURIComponent('Pratap Store')}`;

  const handleRazorpayPayment = () => {
    if (!razorpayKeyId) {
      setErrorMsg('Razorpay Key ID is not configured. Please enter your Razorpay keys in Settings or .env.local.');
      return;
    }

    if (typeof window === 'undefined' || !(window as any).Razorpay) {
      setErrorMsg('Razorpay payment gateway is loading. Please try again in 2 seconds.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const options = {
      key: razorpayKeyId,
      amount: Math.round(amount * 100),
      currency: 'INR',
      name: 'Pratap Store',
      description: description,
      image: '/logo.png',
      prefill: {
        name: customerName !== 'Valued Customer' ? customerName : '',
        contact: customerPhone ? customerPhone.replace(/\D/g, '') : '',
      },
      theme: {
        color: '#4f46e5',
      },
      notes: {
        order_number: orderNumber || 'Direct Payment',
        note: note,
      },
      handler: async function (response: {
        razorpay_payment_id: string;
        razorpay_order_id?: string;
        razorpay_signature?: string;
      }) {
        try {
          const res = await fetch('/api/payments/razorpay/capture', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
              amount: amount,
              order_number: orderNumber,
              customer_phone: customerPhone,
              customer_name: customerName,
              note: note,
              account_id: accountId,
            }),
          });

          const data = await res.json();
          if (res.ok && data.success) {
            setPaymentId(response.razorpay_payment_id);
            setPaidSuccess(true);
            toast.success('Payment verified and confirmed successfully!');
          } else {
            setErrorMsg(data.error || 'Payment verification failed');
          }
        } catch (err) {
          setErrorMsg((err as Error).message);
        } finally {
          setLoading(false);
        }
      },
      modal: {
        ondismiss: function () {
          setLoading(false);
        },
      },
    };

    try {
      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', function (resp: any) {
        setErrorMsg(resp.error?.description || 'Payment failed');
        setLoading(false);
      });
      rzp.open();
    } catch (err) {
      setErrorMsg((err as Error).message);
      setLoading(false);
    }
  };

  const copyUpiId = () => {
    navigator.clipboard.writeText(upiId);
    toast.success('UPI ID copied to clipboard!');
  };

  if (paidSuccess) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-slate-900 border-emerald-500/30 shadow-2xl text-center p-6 space-y-5">
          <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Payment Confirmed!</h2>
            <p className="text-sm text-slate-400 mt-1">
              Your payment has been automatically verified & captured via Razorpay.
            </p>
          </div>

          <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800 text-left space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Amount Paid:</span>
              <span className="font-bold text-emerald-400">₹{amount}</span>
            </div>
            {paymentId && (
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Payment ID:</span>
                <span className="font-mono text-xs text-indigo-300">{paymentId}</span>
              </div>
            )}
            {orderNumber && (
              <div className="flex justify-between">
                <span className="text-slate-400">Order Number:</span>
                <span className="font-medium text-slate-200">{orderNumber}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-400">Status:</span>
              <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold text-xs">
                <ShieldCheck className="w-3.5 h-3.5" /> 100% Verified
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-400">
            A confirmation receipt has been sent to your WhatsApp. You can close this window now.
          </p>

          <Button
            onClick={() => window.close()}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
          >
            Done / Close Window
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />

      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4">
        <div className="max-w-md w-full space-y-4">
          {/* Header */}
          <div className="text-center space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium">
              <Sparkles className="w-3.5 h-3.5" /> Official Pratap Store Payment Gateway
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white mt-2">
              Secure Checkout
            </h1>
            <p className="text-xs text-slate-400">{description}</p>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Amount Card */}
          <Card className="bg-slate-900/90 border-slate-800 shadow-xl overflow-hidden">
            <CardHeader className="bg-indigo-950/30 border-b border-indigo-900/30 py-4 text-center">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-300">
                Amount to Pay
              </span>
              <div className="text-4xl font-black text-white mt-1">₹{amount}</div>
              <span className="text-[11px] text-slate-400">
                {amount === 50 ? 'Advance Booking Fee (Balance COD on delivery)' : 'Full Order Payment'}
              </span>
            </CardHeader>

            <CardContent className="p-5 space-y-5">
              {/* Option 1: Razorpay Instant Auto-Pay */}
              <div className="space-y-2">
                <Button
                  onClick={handleRazorpayPayment}
                  disabled={loading}
                  className="w-full h-12 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2"
                >
                  <CreditCard className="w-4 h-4" />
                  {loading ? 'Processing...' : 'Pay with UPI / Cards / Razorpay'}
                  <ArrowRight className="w-4 h-4" />
                </Button>
                <div className="flex items-center justify-center gap-3 text-[11px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Instant Auto-Verification
                  </span>
                  <span>•</span>
                  <span>Google Pay, PhonePe, Paytm, Cards</span>
                </div>
              </div>

              <div className="relative flex items-center justify-center">
                <div className="border-t border-slate-800 w-full" />
                <span className="bg-slate-900 px-3 text-[11px] text-slate-500 font-medium uppercase tracking-wider">
                  OR SCAN & PAY VIA UPI APP
                </span>
                <div className="border-t border-slate-800 w-full" />
              </div>

              {/* Option 2: UPI QR Code */}
              <div className="flex flex-col items-center justify-center space-y-3">
                <div className="p-2.5 bg-white rounded-2xl shadow-md border-2 border-slate-200">
                  <Image
                    src={qrUrl}
                    alt="Pratap Store UPI QR Code"
                    width={220}
                    height={220}
                    className="rounded-lg"
                    unoptimized
                  />
                </div>

                <div className="w-full bg-slate-950/80 rounded-xl p-3 border border-slate-800 flex items-center justify-between text-xs">
                  <div className="truncate mr-2">
                    <span className="text-[10px] text-slate-400 block">STORE UPI ID</span>
                    <span className="font-mono font-semibold text-indigo-300">{upiId}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={copyUpiId}
                    className="shrink-0 h-8 border-slate-700 hover:bg-slate-800 text-xs text-slate-300 flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" /> Copy
                  </Button>
                </div>

                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-left space-y-1">
                  <span className="text-amber-400 font-semibold text-xs flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    Important Instructions:
                  </span>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    1. QR scan karke exact <strong>₹{amount}</strong> pay karein.
                    <br />
                    2. Payment ke baad apne app me se <strong>12-digit UPI Reference / UTR Number</strong> note karein aur WhatsApp par send karein.
                    <br />
                    3. Hamari team bank statement me verify karke hi order confirm karegi.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
