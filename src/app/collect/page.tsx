"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  Package,
  MapPin,
  Phone,
  User,
  ShoppingBag,
  Send,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

function CollectFormContent() {
  const searchParams = useSearchParams();

  const initialProduct = searchParams.get("product") || searchParams.get("item") || "Round Neck T-Shirt";
  const initialSize = searchParams.get("size") || "XL - 42";
  const initialPrice = searchParams.get("price") || "349";

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [product, setProduct] = useState(initialProduct);
  const [size, setSize] = useState(initialSize);
  const [price, setPrice] = useState(initialPrice);
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cod");

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [orderData, setOrderData] = useState<{
    orderNumber: string;
    customer: {
      fullName: string;
      phone: string;
      address: string;
      pincode: string;
      product: string;
      size: string;
      price: number;
    };
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanPin = pincode.replace(/\D/g, "");
    if (cleanPin.length !== 6) {
      toast.error("Kripya 6-digit PIN Code enter karein");
      return;
    }

    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      toast.error("Kripya valid 10-digit mobile number enter karein");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/customers/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          phone: cleanPhone,
          address,
          city,
          state,
          pincode: cleanPin,
          product,
          size,
          price: Number(price) || 399,
          quantity: 1,
          paymentMethod,
          notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Order submit failed");
      }

      setOrderData({
        orderNumber: data.orderNumber,
        customer: data.customer,
      });
      setSubmitted(true);
      toast.success("Order details submitted successfully!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setLoading(false);
    }
  };

  if (submitted && orderData) {
    const c = orderData.customer;
    const whatsappText = `Namaste! Maine apna order submit kar diya hai.
Order #${orderData.orderNumber}
Item: ${c.product}
Size: ${c.size}
Price: ₹${c.price}
Address: ${c.address}, PIN: ${c.pincode}
Kripya order confirm karke dispatch karein!`;

    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50/50 via-background to-background py-8 px-4 flex items-center justify-center">
        <Card className="max-w-md w-full border-emerald-500/30 shadow-xl">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-14 h-14 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 rounded-full flex items-center justify-center mb-2">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <CardTitle className="text-xl font-bold text-foreground">
              Order Details Verified!
            </CardTitle>
            <CardDescription className="text-emerald-700 dark:text-emerald-400 font-medium text-xs">
              Order #{orderData.orderNumber} has been received
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <div className="bg-muted/60 p-4 rounded-xl border text-xs space-y-2.5 font-sans">
              <div className="font-bold text-sm border-b pb-1.5 flex justify-between">
                <span>📋 Order Preview</span>
                <span className="text-emerald-600 font-mono">₹{c.price}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">🛍️ Item:</span>
                <span className="font-semibold text-foreground">{c.product}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">👕 Size:</span>
                <span className="font-semibold text-foreground">{c.size}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">👤 Customer:</span>
                <span className="font-semibold text-foreground">{c.fullName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">📱 Mobile:</span>
                <span className="font-mono text-foreground">{c.phone}</span>
              </div>
              <div className="border-t pt-1.5">
                <span className="text-muted-foreground block mb-0.5">📍 Delivery Address:</span>
                <span className="font-medium text-foreground block">{c.address}</span>
                <span className="text-muted-foreground font-mono block mt-0.5">📮 PIN: {c.pincode}</span>
              </div>
            </div>

            <p className="text-xs text-center text-muted-foreground">
              Aapka parcel jald se jald verify karke pack kiya jayega. WhatsApp par confirm karne ke liye niche button dabayein:
            </p>
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-semibold"
              onClick={() => {
                const url = `https://wa.me/91${c.phone}?text=${encodeURIComponent(whatsappText)}`;
                window.open(url, "_blank");
              }}
            >
              <Send className="h-4 w-4" />
              Confirm on WhatsApp
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={() => {
                setSubmitted(false);
                setFullName("");
                setPhone("");
                setAddress("");
                setPincode("");
              }}
            >
              Submit Another Response
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 via-background to-background py-6 px-4 flex items-center justify-center">
      <Card className="max-w-lg w-full shadow-2xl border-primary/20">
        <CardHeader className="text-center pb-4 border-b">
          <div className="mx-auto w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-1 shadow-inner">
            <ShoppingBag className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            Customer Delivery & Order Form
          </CardTitle>
          <CardDescription className="text-xs">
            Kripya apna poora delivery address aur details enter karein taaki parcel sahi samay par deliver ho sake.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4 pt-5">
            {/* Selected Item & Size Banner */}
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-primary block">Selected Item:</span>
                <span className="font-bold text-sm text-foreground">{product}</span>
                <span className="text-xs text-muted-foreground block">
                  Size: <strong className="text-foreground">{size}</strong>
                </span>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-muted-foreground block">Total Price</span>
                <span className="text-lg font-bold text-emerald-600 font-mono">₹{price}</span>
              </div>
            </div>

            {/* Customer Name */}
            <div className="space-y-1.5">
              <Label htmlFor="c-name" className="text-xs font-semibold">
                👤 Full Name (Aapka Poora Naam) *
              </Label>
              <Input
                id="c-name"
                placeholder="e.g. Pratap Mishra"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>

            {/* WhatsApp Mobile */}
            <div className="space-y-1.5">
              <Label htmlFor="c-phone" className="text-xs font-semibold">
                📱 WhatsApp Mobile Number (10 Digits) *
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs font-semibold text-muted-foreground">
                  +91
                </span>
                <Input
                  id="c-phone"
                  placeholder="9876543210"
                  value={phone}
                  maxLength={10}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                  className="pl-12 font-mono"
                  required
                />
              </div>
            </div>

            {/* Delivery Address */}
            <div className="space-y-1.5">
              <Label htmlFor="c-address" className="text-xs font-semibold">
                📍 Delivery Address (Makan No., Gali, Landmark) *
              </Label>
              <Input
                id="c-address"
                placeholder="e.g. Flat 4B, 12 Park Street, Near Metro Gate No. 2"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                required
              />
            </div>

            {/* City & PIN */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="c-city" className="text-xs font-semibold">
                  City / District *
                </Label>
                <Input
                  id="c-city"
                  placeholder="e.g. Kolkata"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-pin" className="text-xs font-semibold">
                  📮 6-Digit PIN Code *
                </Label>
                <Input
                  id="c-pin"
                  placeholder="e.g. 700016"
                  maxLength={6}
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value.replace(/\D/g, ""))}
                  className="font-mono"
                  required
                />
              </div>
            </div>

            {/* Payment Mode Selection */}
            <div className="space-y-1.5 pt-1">
              <Label htmlFor="c-pay" className="text-xs font-semibold">
                💳 Payment Mode (Bhugtan ka Tarika)
              </Label>
              <select
                id="c-pay"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="cod">Cash on Delivery (COD)</option>
                <option value="upi">UPI / Online Payment</option>
              </select>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="c-notes" className="text-xs font-semibold">
                📝 Customization / Special Note (Optional)
              </Label>
              <Input
                id="c-notes"
                placeholder="e.g. Please deliver after 5 PM / Custom name print"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </CardContent>

          <CardFooter className="pt-2 border-t mt-3 flex flex-col gap-2">
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-11 text-sm shadow-lg gap-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Submitting Order...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Submit Order Details
                </>
              )}
            </Button>
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground pt-1">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              100% Safe & Secure WhatsApp Verification
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

export default function CollectPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-muted-foreground">
          <RefreshCw className="h-6 w-6 animate-spin text-primary mr-2" />
          Loading Order Form...
        </div>
      }
    >
      <CollectFormContent />
    </Suspense>
  );
}
