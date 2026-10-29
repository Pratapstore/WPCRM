"use client";

import { useState } from "react";
import {
  CheckCheck,
  Phone,
  Video,
  MoreVertical,
  ArrowLeft,
  ShoppingBag,
  ExternalLink,
  ShieldCheck,
  CreditCard,
  MessageSquare,
  Sparkles,
  Truck,
  Copy,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatIndianCurrency } from "@/lib/orders/upi-helper";

interface OrderItemPreview {
  name: string;
  variant?: string;
  price: number;
  quantity: number;
  subtotal: number;
}

interface AddressPreview {
  street: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
}

interface WhatsAppChatPreviewProps {
  customerName: string;
  customerPhone: string;
  orderNumber: string;
  items: OrderItemPreview[];
  subtotal: number;
  shippingFee: number;
  discountAmount: number;
  taxAmount?: number;
  totalAmount: number;
  paymentMethod: "razorpay" | "cod" | "upi_manual";
  shippingAddress: AddressPreview;
  paymentLinkUrl?: string;
  storeName?: string;
}

export function WhatsAppChatPreview({
  customerName,
  customerPhone,
  orderNumber,
  items,
  subtotal,
  shippingFee,
  discountAmount,
  taxAmount = 0,
  totalAmount,
  paymentMethod,
  shippingAddress,
  paymentLinkUrl = "https://wacrm.app/pay/checkout",
  storeName = "Pratap Store",
}: WhatsAppChatPreviewProps) {
  const [copied, setCopied] = useState(false);
  const currentTime = new Date().toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const fullAddress = [
    shippingAddress.street,
    shippingAddress.landmark ? `Near ${shippingAddress.landmark}` : "",
    `${shippingAddress.city || "New Delhi"}, ${shippingAddress.state || "Delhi"} - ${shippingAddress.pincode || "110001"}`,
  ]
    .filter(Boolean)
    .join(", ");

  const generatedTextMessage = `🙏 *Namaste ${customerName || "Valued Customer"}!*
Thank you for your order with *${storeName}*.

📦 *Order #${orderNumber || "ORD-PENDING"}*
━━━━━━━━━━━━━━━━━━━━
🛍️ *Items Ordered:*
${items
  .filter((i) => i.name.trim().length > 0)
  .map(
    (i, idx) =>
      `${idx + 1}. *${i.name}* ${i.variant ? `(${i.variant})` : ""} x ${i.quantity} = ₹${i.subtotal || i.price * i.quantity}`
  )
  .join("\n") || "1. Custom Order Item x 1 = ₹" + totalAmount}

━━━━━━━━━━━━━━━━━━━━
💵 *Subtotal:* ${formatIndianCurrency(subtotal)}
🚚 *Delivery:* ${shippingFee > 0 ? formatIndianCurrency(shippingFee) : "FREE"}
${discountAmount > 0 ? `🏷️ *Discount:* -${formatIndianCurrency(discountAmount)}\n` : ""}${taxAmount > 0 ? `🧾 *GST:* ${formatIndianCurrency(taxAmount)}\n` : ""}💰 *Total Payable:* *${formatIndianCurrency(totalAmount)}*
━━━━━━━━━━━━━━━━━━━━
📍 *Delivery Address:*
${fullAddress}

${
  paymentMethod === "cod"
    ? `💵 *Payment Mode:* CASH ON DELIVERY (COD)\n✅ _Keep exact cash ready at the time of delivery!_`
    : `💳 *Payment Mode:* ONLINE PREPAID\n👉 *Click here to pay securely via UPI/Card:*\n${paymentLinkUrl}\n⚡ _Supports Google Pay, PhonePe, Paytm, Cards & UPI._`
}

If you need any changes, reply to this message directly!`;

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(generatedTextMessage);
    setCopied(true);
    toast.success("WhatsApp message formatted text copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col items-center">
      {/* Phone Mockup Frame */}
      <div className="w-full max-w-[380px] bg-slate-900 rounded-[2.5rem] p-3 shadow-2xl border-4 border-slate-700/60 relative overflow-hidden">
        {/* Dynamic Island / Notch */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 w-28 h-4 bg-black rounded-full z-30 flex items-center justify-center">
          <div className="w-2.5 h-2.5 rounded-full bg-slate-950/80 mr-3" />
          <div className="w-2 h-2 rounded-full bg-indigo-950/80" />
        </div>

        {/* Screen container */}
        <div className="rounded-[2rem] overflow-hidden bg-[#0c1317] text-white flex flex-col h-[610px] relative">
          {/* Status Bar */}
          <div className="h-8 bg-[#1f2c34] px-5 flex items-center justify-between text-[11px] text-slate-400 font-medium pt-1">
            <span>{currentTime}</span>
            <div className="flex items-center gap-1.5">
              <span>5G</span>
              <div className="w-4 h-2 rounded-sm border border-slate-400 p-0.5 flex items-center">
                <div className="h-full w-full bg-emerald-500 rounded-2xs" />
              </div>
            </div>
          </div>

          {/* WhatsApp Chat Header */}
          <div className="bg-[#1f2c34] px-3 py-2.5 flex items-center justify-between border-b border-[#2a3942] z-10">
            <div className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4 text-slate-300" />
              <div className="relative">
                <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white font-bold text-xs shadow">
                  PS
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-[#1f2c34] flex items-center justify-center">
                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                </div>
              </div>
              <div className="leading-tight">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-semibold text-slate-100 truncate max-w-[130px]">
                    {storeName}
                  </span>
                  <span className="inline-flex items-center justify-center w-3 h-3 rounded-full bg-emerald-500 text-[8px] text-black font-extrabold">
                    ✓
                  </span>
                </div>
                <span className="text-[10px] text-emerald-400 block">
                  Official Business Account
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 text-slate-300">
              <Video className="h-4 w-4 opacity-75" />
              <Phone className="h-4 w-4 opacity-75" />
              <MoreVertical className="h-4 w-4 opacity-75" />
            </div>
          </div>

          {/* Chat Canvas with WhatsApp Doodle Styling */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-[#0b141a] bg-opacity-95 text-slate-200 text-xs relative">
            {/* Background Texture Overlay */}
            <div
              className="absolute inset-0 opacity-[0.04] pointer-events-none bg-[radial-gradient(#22c55e_1px,transparent_1px)] [background-size:16px_16px]"
            />

            {/* Date Pill */}
            <div className="flex justify-center">
              <span className="bg-[#182229] text-[10px] text-slate-400 px-2.5 py-0.5 rounded-md shadow-xs">
                TODAY
              </span>
            </div>

            {/* Outgoing Message Bubble (from Pratap Store) */}
            <div className="flex flex-col items-end space-y-1">
              <div className="bg-[#005c4b] text-slate-100 rounded-2xl rounded-tr-xs p-3 shadow-md max-w-[92%] relative">
                {/* Greeting */}
                <p className="font-medium text-slate-100 mb-1">
                  🙏 Namaste <strong className="text-emerald-200">{customerName || "Customer"}</strong>!
                </p>
                <p className="text-[11px] text-slate-300 mb-2">
                  Thank you for placing your order with <strong>{storeName}</strong>.
                </p>

                {/* Order Badge */}
                <div className="bg-[#025142] px-2 py-1 rounded-md text-[11px] font-mono flex items-center justify-between mb-2 border border-emerald-600/30">
                  <span className="text-emerald-300 font-semibold">
                    #{orderNumber || "ORD-2026-X"}
                  </span>
                  <Badge variant="outline" className="text-[9px] h-4 bg-emerald-950/60 text-emerald-300 border-emerald-600/40">
                    Confirmed
                  </Badge>
                </div>

                {/* Items Summary */}
                <div className="border-t border-b border-[#12705e] py-1.5 my-1.5 space-y-1">
                  <div className="text-[10px] font-semibold text-emerald-200 uppercase tracking-wider flex items-center gap-1">
                    <ShoppingBag className="h-3 w-3" />
                    Items Ordered:
                  </div>
                  {items.map((it, idx) => (
                    <div key={idx} className="flex justify-between items-center text-[11px]">
                      <span className="truncate max-w-[170px]">
                        {idx + 1}. {it.name || "Item"} {it.variant ? `(${it.variant})` : ""} × {it.quantity}
                      </span>
                      <span className="font-medium">
                        ₹{it.subtotal || it.price * it.quantity}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Totals */}
                <div className="space-y-0.5 text-[11px]">
                  <div className="flex justify-between text-slate-300">
                    <span>Subtotal:</span>
                    <span>{formatIndianCurrency(subtotal)}</span>
                  </div>
                  {shippingFee > 0 && (
                    <div className="flex justify-between text-slate-300">
                      <span>Delivery:</span>
                      <span>{formatIndianCurrency(shippingFee)}</span>
                    </div>
                  )}
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-300 font-medium">
                      <span>Discount:</span>
                      <span>-{formatIndianCurrency(discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs font-bold text-white pt-1 border-t border-[#12705e] mt-1">
                    <span>Total Amount:</span>
                    <span className="text-emerald-200 text-sm">
                      {formatIndianCurrency(totalAmount)}
                    </span>
                  </div>
                </div>

                {/* Address preview */}
                <div className="mt-2 pt-1.5 border-t border-[#12705e] text-[10px] text-slate-300">
                  <span className="text-emerald-300 font-medium block">📍 Delivery To:</span>
                  <p className="line-clamp-2 text-slate-200">{fullAddress}</p>
                </div>

                {/* Payment Mode Note */}
                <div className="mt-2 p-1.5 rounded bg-[#024a3c] text-[10px] border border-emerald-500/20">
                  {paymentMethod === "cod" ? (
                    <span className="text-amber-200 font-medium flex items-center gap-1">
                      💵 Cash on Delivery (COD) - Keep cash ready
                    </span>
                  ) : (
                    <span className="text-emerald-200 font-medium flex items-center gap-1">
                      ⚡ Pay Online via UPI / Cards / NetBanking
                    </span>
                  )}
                </div>

                {/* Timestamp & double blue ticks */}
                <div className="flex items-center justify-end gap-1 text-[9px] text-slate-300 mt-1">
                  <span>{currentTime}</span>
                  <CheckCheck className="h-3.5 w-3.5 text-sky-400" />
                </div>
              </div>

              {/* WhatsApp Interactive Action Buttons (Below Bubble) */}
              {paymentMethod !== "cod" ? (
                <div className="w-[92%] space-y-1">
                  <div className="bg-[#1f2c34] text-sky-400 hover:bg-[#253641] transition-colors rounded-xl p-2.5 text-center font-medium text-xs flex items-center justify-center gap-2 border border-[#2e3e4a] shadow cursor-pointer">
                    <CreditCard className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Pay {formatIndianCurrency(totalAmount)} Online</span>
                    <ExternalLink className="h-3 w-3 opacity-70" />
                  </div>
                  <div className="bg-[#1f2c34] text-slate-200 hover:bg-[#253641] transition-colors rounded-xl p-2 text-center text-[11px] flex items-center justify-center gap-1.5 border border-[#2e3e4a] shadow cursor-pointer">
                    <Truck className="h-3.5 w-3.5 text-slate-400" />
                    <span>Track Order Status</span>
                  </div>
                </div>
              ) : (
                <div className="w-[92%] space-y-1">
                  <div className="bg-[#1f2c34] text-emerald-400 hover:bg-[#253641] transition-colors rounded-xl p-2.5 text-center font-medium text-xs flex items-center justify-center gap-2 border border-[#2e3e4a] shadow cursor-pointer">
                    <Check className="h-3.5 w-3.5" />
                    <span>Confirm Delivery Address</span>
                  </div>
                </div>
              )}
            </div>

            {/* Mock Incoming customer response */}
            <div className="flex flex-col items-start mt-2">
              <div className="bg-[#202c33] text-slate-200 rounded-2xl rounded-tl-xs p-2.5 shadow max-w-[80%] text-[11px]">
                <p>Thank you! Address is verified. Please ship soon 👍</p>
                <div className="flex items-center justify-end text-[9px] text-slate-400 mt-0.5">
                  <span>{currentTime}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Chat Input Bar */}
          <div className="h-12 bg-[#1f2c34] px-3 flex items-center gap-2 border-t border-[#2a3942]">
            <div className="flex-1 bg-[#2a3942] rounded-full px-3 py-1.5 text-slate-400 text-xs flex items-center justify-between">
              <span>Type a message...</span>
              <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
            </div>
            <div className="h-8 w-8 rounded-full bg-emerald-600 flex items-center justify-center text-white shadow">
              <MessageSquare className="h-4 w-4" />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Action below phone */}
      <div className="mt-4 flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleCopyMessage}
          className="text-xs gap-1.5 h-8 border-border"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied WhatsApp Text" : "Copy WhatsApp Text"}
        </Button>
      </div>
    </div>
  );
}
