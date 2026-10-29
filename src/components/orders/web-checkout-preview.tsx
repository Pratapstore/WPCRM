"use client";

import { useState } from "react";
import {
  ShieldCheck,
  Lock,
  ShoppingBag,
  MapPin,
  ChevronRight,
  Sparkles,
  Truck,
  CreditCard,
  QrCode,
  Banknote,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatIndianCurrency } from "@/lib/orders/upi-helper";

interface OrderItemPreview {
  name: string;
  variant?: string;
  price: number;
  quantity: number;
  subtotal: number;
}

interface WebCheckoutPreviewProps {
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
  shippingAddress: {
    street: string;
    landmark?: string;
    city: string;
    state: string;
    pincode: string;
  };
  storeName?: string;
}

export function WebCheckoutPreview({
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
  storeName = "Pratap Store",
}: WebCheckoutPreviewProps) {
  const [selectedPayMode, setSelectedPayMode] = useState<string>(
    paymentMethod === "cod" ? "cod" : "upi"
  );

  return (
    <div className="flex flex-col items-center">
      {/* Mobile Device Viewport */}
      <div className="w-full max-w-[380px] bg-card text-card-foreground rounded-[2rem] border border-border shadow-2xl overflow-hidden flex flex-col h-[610px]">
        {/* Top Header Bar */}
        <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-800 text-white p-4 pb-5 relative shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-white/20 backdrop-blur-md flex items-center justify-center font-bold text-xs shadow-inner">
                PS
              </div>
              <div>
                <h4 className="font-bold text-sm tracking-tight">{storeName}</h4>
                <div className="flex items-center gap-1 text-[10px] text-indigo-100">
                  <ShieldCheck className="h-3 w-3 text-emerald-300" />
                  <span>Razorpay Verified Checkout</span>
                </div>
              </div>
            </div>
            <Badge variant="secondary" className="bg-white/20 text-white border-0 text-[10px] font-mono">
              #{orderNumber || "ORD-2026"}
            </Badge>
          </div>

          <div className="mt-3 bg-black/20 rounded-xl p-2.5 backdrop-blur-sm flex items-center justify-between text-xs">
            <span className="text-indigo-200">Total Payable:</span>
            <span className="text-lg font-black text-white font-mono">
              {formatIndianCurrency(totalAmount)}
            </span>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/20 text-xs">
          {/* Order Items Accordion / Summary */}
          <div className="bg-card rounded-xl border border-border/80 p-3 shadow-xs">
            <div className="flex items-center justify-between font-semibold text-foreground mb-2 pb-1.5 border-b border-border/60">
              <span className="flex items-center gap-1.5">
                <ShoppingBag className="h-3.5 w-3.5 text-primary" />
                Order Summary ({items.length} {items.length === 1 ? "Item" : "Items"})
              </span>
              <span className="font-mono text-muted-foreground">{formatIndianCurrency(subtotal)}</span>
            </div>

            <div className="space-y-2">
              {items.map((it, idx) => (
                <div key={idx} className="flex justify-between items-start text-xs">
                  <div className="leading-tight">
                    <p className="font-medium text-foreground">{it.name || "Custom Item"}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {it.variant ? `Variant: ${it.variant} • ` : ""}Qty: {it.quantity}
                    </p>
                  </div>
                  <span className="font-mono font-medium text-foreground">
                    ₹{it.subtotal || it.price * it.quantity}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Delivery Details */}
          <div className="bg-card rounded-xl border border-border/80 p-3 shadow-xs">
            <div className="flex items-center justify-between font-semibold text-foreground mb-1.5">
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-emerald-500" />
                Delivery Address
              </span>
              <span className="text-[10px] text-primary font-normal">Standard Express</span>
            </div>
            <div className="text-[11px] text-muted-foreground leading-relaxed">
              <p className="font-medium text-foreground">{customerName || "Customer Name"}</p>
              <p>{shippingAddress.street || "Address Street / Flat"}</p>
              {shippingAddress.landmark && <p>Near {shippingAddress.landmark}</p>}
              <p>
                {shippingAddress.city || "New Delhi"}, {shippingAddress.state || "Delhi"} -{" "}
                <span className="font-mono">{shippingAddress.pincode || "110001"}</span>
              </p>
              <p className="text-[10px] mt-1 text-slate-400">Phone: {customerPhone || "+91 98765 43210"}</p>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div className="space-y-2">
            <span className="font-semibold text-foreground text-xs block">
              Choose Payment Method
            </span>

            {/* UPI Option */}
            <div
              onClick={() => setSelectedPayMode("upi")}
              className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                selectedPayMode === "upi"
                  ? "border-primary bg-primary/5 shadow-xs"
                  : "border-border bg-card hover:border-border/80"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-xs">
                  <QrCode className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-medium text-xs text-foreground flex items-center gap-1.5">
                    UPI Instant Payment
                    <Badge variant="outline" className="text-[9px] h-4 text-emerald-600 border-emerald-500/30 bg-emerald-500/10">
                      Recommended
                    </Badge>
                  </div>
                  <div className="text-[10px] text-muted-foreground">Google Pay, PhonePe, Paytm, BHIM</div>
                </div>
              </div>
              <div
                className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                  selectedPayMode === "upi" ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground"
                }`}
              >
                {selectedPayMode === "upi" && <div className="h-2 w-2 rounded-full bg-white" />}
              </div>
            </div>

            {/* Cards / NetBanking */}
            <div
              onClick={() => setSelectedPayMode("card")}
              className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                selectedPayMode === "card"
                  ? "border-primary bg-primary/5 shadow-xs"
                  : "border-border bg-card hover:border-border/80"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-sky-500/10 text-sky-600 flex items-center justify-center font-bold text-xs">
                  <CreditCard className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-medium text-xs text-foreground">Cards & NetBanking</div>
                  <div className="text-[10px] text-muted-foreground">Visa, Mastercard, RuPay, 50+ Banks</div>
                </div>
              </div>
              <div
                className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                  selectedPayMode === "card" ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground"
                }`}
              >
                {selectedPayMode === "card" && <div className="h-2 w-2 rounded-full bg-white" />}
              </div>
            </div>

            {/* COD Option */}
            <div
              onClick={() => setSelectedPayMode("cod")}
              className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                selectedPayMode === "cod"
                  ? "border-amber-500 bg-amber-500/5 shadow-xs"
                  : "border-border bg-card hover:border-border/80"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold text-xs">
                  <Banknote className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-medium text-xs text-foreground">Cash on Delivery (COD)</div>
                  <div className="text-[10px] text-muted-foreground">Pay with cash upon package arrival</div>
                </div>
              </div>
              <div
                className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                  selectedPayMode === "cod" ? "border-amber-500 bg-amber-500 text-white" : "border-muted-foreground"
                }`}
              >
                {selectedPayMode === "cod" && <div className="h-2 w-2 rounded-full bg-white" />}
              </div>
            </div>
          </div>

          {/* Pricing Breakdown Card */}
          <div className="p-3 rounded-xl bg-card border border-border/80 space-y-1.5 text-[11px]">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal:</span>
              <span>{formatIndianCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Delivery Fee:</span>
              <span>{shippingFee > 0 ? formatIndianCurrency(shippingFee) : "FREE"}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-emerald-600 font-medium">
                <span>Discount:</span>
                <span>-{formatIndianCurrency(discountAmount)}</span>
              </div>
            )}
            {taxAmount > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>GST (Tax):</span>
                <span>{formatIndianCurrency(taxAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-bold text-foreground pt-1.5 border-t border-border mt-1">
              <span>Total Payable:</span>
              <span className="text-primary font-mono">{formatIndianCurrency(totalAmount)}</span>
            </div>
          </div>
        </div>

        {/* Footer Checkout CTA */}
        <div className="p-3 bg-card border-t border-border flex flex-col gap-2 shadow-lg">
          <Button
            type="button"
            className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold py-2.5 text-xs h-10 shadow-md gap-2"
          >
            <Lock className="h-3.5 w-3.5" />
            {selectedPayMode === "cod" ? "Confirm COD Order" : `Pay ${formatIndianCurrency(totalAmount)} Securely`}
          </Button>

          <div className="flex items-center justify-center gap-2 text-[10px] text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            <span>256-Bit SSL Encrypted &bull; 100% Purchase Protection</span>
          </div>
        </div>
      </div>
    </div>
  );
}
