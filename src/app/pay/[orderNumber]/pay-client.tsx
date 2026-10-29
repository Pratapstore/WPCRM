"use client";

import { useState } from "react";
import type { Order } from "@/types/orders";
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  MapPin,
  Package,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Smartphone,
  CreditCard,
  Building2,
  AlertCircle,
  Truck,
} from "lucide-react";

import Script from "next/script";

interface PayClientProps {
  initialOrder: Order;
  razorpayKeyId?: string;
}

export function PayClient({ initialOrder, razorpayKeyId }: PayClientProps) {
  const [order, setOrder] = useState<Order>(initialOrder);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isPaid = order.payment_status === "paid";
  const address = order.shipping_address;

  const handleRazorpayCheckout = () => {
    if (!razorpayKeyId) {
      setErrorMsg("Razorpay Key ID is not configured. Please use Simulate Payment or set keys in Settings.");
      return;
    }

    if (typeof window === "undefined" || !(window as any).Razorpay) {
      setErrorMsg("Razorpay checkout is still loading. Please try again in a moment.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const options = {
      key: razorpayKeyId,
      amount: Math.round(Number(order.total_amount) * 100),
      currency: order.currency || "INR",
      name: "Pratap Store",
      description: `Order #${order.order_number}`,
      prefill: {
        name: order.customer_name,
        contact: order.customer_phone,
        email: order.customer_email || undefined,
      },
      theme: {
        color: "#4f46e5",
      },
      handler: async function (response: any) {
        try {
          const res = await fetch(`/api/orders/${order.id}/pay-simulated`, {
            method: "POST",
          });
          const data = await res.json();
          if (data.order) {
            setOrder(data.order);
          }
        } catch (err) {
          console.error("Error updating paid order:", err);
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
      rzp.open();
    } catch (err) {
      setErrorMsg((err as Error).message);
      setLoading(false);
    }
  };

  const handleSimulatePayment = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/orders/${order.id}/pay-simulated`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Payment failed");
      }
      setOrder(data.order);
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <header className="max-w-2xl mx-auto w-full flex items-center justify-between pb-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
            <ShoppingBag className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-white tracking-tight flex items-center gap-1.5">
              Pratap Store
              <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400 border border-emerald-500/20">
                Verified Store
              </span>
            </h1>
            <p className="text-xs text-slate-400">Personalized Gifts & Custom Printing</p>
          </div>
        </div>

        <div className="text-right">
          <span className="text-xs text-slate-400 block">Order Number</span>
          <span className="font-mono text-sm font-semibold text-slate-200">{order.order_number}</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto w-full my-6 space-y-6">
        {/* Status Banner */}
        {isPaid ? (
          <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-6 text-center shadow-xl shadow-emerald-950/50 backdrop-blur-sm animate-in fade-in duration-500">
            <div className="h-16 w-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-3 border border-emerald-500/30 shadow-inner">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Payment Received!</h2>
            <p className="text-slate-300 text-sm mt-1 max-w-md mx-auto">
              Namaste {order.customer_name}, your order #{order.order_number} is successfully confirmed. We have dispatched a confirmation WhatsApp receipt to your number.
            </p>
            {order.razorpay_payment_id && (
              <div className="mt-4 inline-block bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-700 text-xs font-mono text-emerald-400">
                Ref ID: {order.razorpay_payment_id}
              </div>
            )}
            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-400">
              <Clock className="h-4 w-4 text-emerald-400" />
              <span>Status: <strong className="text-slate-200 capitalize">{order.order_status}</strong></span>
            </div>
          </div>
        ) : (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <span className="text-xs uppercase tracking-wider text-amber-400 font-semibold flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Payment Pending
                </span>
                <h2 className="text-2xl font-bold text-white mt-1">Complete Your Payment</h2>
                <p className="text-xs text-slate-400">
                  Pay securely using Razorpay (UPI, Google Pay, PhonePe, Cards, NetBanking).
                </p>
              </div>
              <div className="text-left sm:text-right">
                <span className="text-xs text-slate-400 block">Total Payable</span>
                <span className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300 font-mono">
                  ₹{order.total_amount}
                </span>
              </div>
            </div>

            {/* Payment Actions */}
            <div className="mt-6 space-y-3">
              <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />

              {/* Direct Razorpay Checkout Modal Button */}
              {razorpayKeyId ? (
                <button
                  type="button"
                  onClick={handleRazorpayCheckout}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2.5 px-6 py-4 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-500 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-bold text-base shadow-xl shadow-emerald-600/30 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                >
                  <ShieldCheck className="h-5 w-5" />
                  <span>{loading ? "Processing..." : "Pay ₹" + order.total_amount + " via Razorpay (UPI / Cards)"}</span>
                </button>
              ) : null}

              {/* External Razorpay Link if created */}
              {order.razorpay_payment_link_url && !order.razorpay_payment_link_url.includes('/pay/') && (
                <a
                  href={order.razorpay_payment_link_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.01] active:scale-[0.99]"
                >
                  <CreditCard className="h-5 w-5" />
                  <span>Open Razorpay Standard Page</span>
                  <ExternalLink className="h-4 w-4 opacity-80" />
                </a>
              )}

              {/* Instant Sandbox / Demo Simulation Button */}
              <button
                type="button"
                onClick={handleSimulatePayment}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-slate-800/90 hover:bg-slate-700/80 border border-slate-700 text-slate-200 font-medium text-sm transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4 text-amber-400" />
                <span>{loading ? "Confirming..." : "Simulate Instant Payment (UPI / Test Mode)"}</span>
              </button>

              {errorMsg && (
                <div className="p-3 bg-red-950/40 border border-red-800/50 rounded-lg text-red-300 text-xs flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Supported payment badges */}
              <div className="pt-2 flex flex-wrap items-center justify-center gap-3 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <Smartphone className="h-3.5 w-3.5 text-indigo-400" /> UPI / GPay / PhonePe
                </span>
                <span className="text-slate-700">•</span>
                <span className="flex items-center gap-1">
                  <CreditCard className="h-3.5 w-3.5 text-emerald-400" /> Debit / Credit Cards
                </span>
                <span className="text-slate-700">•</span>
                <span className="flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5 text-cyan-400" /> NetBanking
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Order Items Summary */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-200 border-b border-slate-800/80 pb-3">
            <Package className="h-4 w-4 text-indigo-400" />
            <span>Order Items ({order.items.length})</span>
          </div>

          <div className="divide-y divide-slate-800/60">
            {order.items.map((item, idx) => (
              <div key={idx} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-lg bg-slate-800 border border-slate-700/60 overflow-hidden flex items-center justify-center shrink-0">
                    {item.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
                    ) : (
                      <Package className="h-5 w-5 text-slate-500" />
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-white">{item.name}</h4>
                    <p className="text-xs text-slate-400">
                      {item.variant ? `Variant: ${item.variant} • ` : ""}
                      Qty: {item.quantity} × ₹{item.price}
                    </p>
                  </div>
                </div>
                <div className="text-sm font-semibold text-slate-200 font-mono">
                  ₹{item.subtotal || item.price * item.quantity}
                </div>
              </div>
            ))}
          </div>

          {/* Pricing calculations */}
          <div className="pt-3 border-t border-slate-800/80 space-y-1.5 text-xs text-slate-400">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="text-slate-200 font-mono">₹{order.subtotal}</span>
            </div>
            {order.discount_amount > 0 && (
              <div className="flex justify-between text-emerald-400">
                <span>Discount</span>
                <span className="font-mono">-₹{order.discount_amount}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Shipping Fee</span>
              <span className="text-slate-200 font-mono">
                {order.shipping_fee > 0 ? `₹${order.shipping_fee}` : "FREE"}
              </span>
            </div>
            <div className="flex justify-between text-sm font-bold text-white pt-2 border-t border-slate-800">
              <span>Total Amount</span>
              <span className="text-emerald-400 font-mono text-base">₹{order.total_amount}</span>
            </div>
          </div>
        </div>

        {/* Shipping Address */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-200 border-b border-slate-800/80 pb-3">
            <MapPin className="h-4 w-4 text-emerald-400" />
            <span>Delivery Address</span>
          </div>
          <div className="text-xs text-slate-300 space-y-1">
            <p className="font-semibold text-white text-sm">
              {address.recipient_name || order.customer_name}
            </p>
            <p>{address.street}</p>
            {address.landmark && <p className="text-slate-400">Landmark: {address.landmark}</p>}
            <p>
              {address.city}, {address.state} - {address.pincode}
            </p>
            <p className="text-slate-400 pt-1">Phone: {address.phone || order.customer_phone}</p>
          </div>
        </div>

        {/* Tracking info if dispatched */}
        {order.tracking_number && (
          <div className="bg-indigo-950/40 border border-indigo-500/30 rounded-2xl p-5 shadow-lg space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-indigo-300">
              <Truck className="h-4 w-4 text-indigo-400" />
              <span>Shipment Tracking</span>
            </div>
            <div className="text-xs text-slate-300 space-y-1.5">
              <p>Carrier: <strong className="text-white">{order.tracking_carrier || "Express Courier"}</strong></p>
              <p>AWB Tracking Number: <strong className="font-mono text-indigo-300">{order.tracking_number}</strong></p>
              {order.tracking_url && (
                <a
                  href={order.tracking_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 underline font-medium mt-1"
                >
                  Track on courier website <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-2xl mx-auto w-full pt-6 border-t border-slate-800 text-center text-xs text-slate-500">
        <p>© {new Date().getFullYear()} Pratap Store. Powered by WhatsApp CRM & Razorpay Secure.</p>
        <p className="mt-1">For support or queries, reply directly on WhatsApp.</p>
      </footer>
    </div>
  );
}
