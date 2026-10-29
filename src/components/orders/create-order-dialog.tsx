"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Trash2,
  ShoppingBag,
  MessageSquare,
  Sparkles,
  CreditCard,
  MapPin,
  User,
  Package,
} from "lucide-react";
import { toast } from "sonner";
import type { Order, OrderItem, Product } from "@/types/orders";

interface CreateOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOrderCreated: (order: Order) => void;
  defaultCustomerPhone?: string;
  defaultCustomerName?: string;
  contactId?: string;
  conversationId?: string;
}

export function CreateOrderDialog({
  open,
  onOpenChange,
  onOrderCreated,
  defaultCustomerPhone = "",
  defaultCustomerName = "",
  contactId,
  conversationId,
}: CreateOrderDialogProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [customerName, setCustomerName] = useState(defaultCustomerName);
  const [customerPhone, setCustomerPhone] = useState(defaultCustomerPhone);
  const [customerEmail, setCustomerEmail] = useState("");

  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [landmark, setLandmark] = useState("");

  const [items, setItems] = useState<OrderItem[]>([
    { name: "", price: 199, quantity: 1, subtotal: 199, variant: "" },
  ]);

  const [shippingFee, setShippingFee] = useState<number>(0);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<"razorpay" | "cod">("razorpay");
  const [notes, setNotes] = useState("");
  const [sendWhatsApp, setSendWhatsApp] = useState(true);

  // Fetch product catalog on open
  useEffect(() => {
    if (open) {
      if (defaultCustomerPhone && !customerPhone) setCustomerPhone(defaultCustomerPhone);
      if (defaultCustomerName && !customerName) setCustomerName(defaultCustomerName);

      setLoadingProducts(true);
      fetch("/api/products")
        .then((res) => res.json())
        .then((data) => {
          if (data.products) setProducts(data.products);
        })
        .catch((err) => console.error("Error loading products:", err))
        .finally(() => setLoadingProducts(false));
    }
  }, [open, defaultCustomerName, defaultCustomerPhone]);

  // Pricing calculations
  const subtotal = items.reduce((acc, curr) => acc + (Number(curr.subtotal) || 0), 0);
  const totalAmount = Math.max(0, subtotal - (Number(discountAmount) || 0) + (Number(shippingFee) || 0));

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      { name: "", price: 299, quantity: 1, subtotal: 299, variant: "" },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleItemChange = (index: number, field: keyof OrderItem, value: unknown) => {
    setItems((prev) => {
      const next = [...prev];
      const target = { ...next[index], [field]: value };
      if (field === "price" || field === "quantity") {
        const p = Number(field === "price" ? value : target.price) || 0;
        const q = Number(field === "quantity" ? value : target.quantity) || 1;
        target.subtotal = p * q;
      }
      next[index] = target;
      return next;
    });
  };

  const handleSelectProduct = (index: number, productId: string) => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;

    setItems((prev) => {
      const next = [...prev];
      const defaultVariant = prod.variants?.[0]?.options?.[0] || "";
      next[index] = {
        ...next[index],
        product_id: prod.id,
        name: prod.name,
        price: Number(prod.price),
        image_url: prod.image_url || undefined,
        variant: defaultVariant,
        subtotal: Number(prod.price) * (Number(next[index].quantity) || 1),
      };
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      toast.error("Please enter the customer name");
      return;
    }
    if (!customerPhone.trim()) {
      toast.error("Please enter the customer WhatsApp phone number");
      return;
    }

    const validItems = items.filter((it) => it.name.trim().length > 0);
    if (validItems.length === 0) {
      toast.error("Please add at least one product to the order");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        customer_email: customerEmail.trim() || undefined,
        shipping_address: {
          recipient_name: customerName.trim(),
          phone: customerPhone.trim(),
          street: street.trim(),
          city: city.trim(),
          state: state.trim(),
          pincode: pincode.trim(),
          landmark: landmark.trim() || undefined,
        },
        items: validItems,
        shipping_fee: Number(shippingFee) || 0,
        discount_amount: Number(discountAmount) || 0,
        payment_method: paymentMethod,
        notes: notes.trim() || undefined,
        send_whatsapp: sendWhatsApp,
        contact_id: contactId,
        conversation_id: conversationId,
      };

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create order");
      }

      toast.success(
        `Order #${data.order.order_number} created successfully! ${
          data.whatsapp?.success ? "WhatsApp notification sent." : ""
        }`
      );
      onOrderCreated(data.order);
      onOpenChange(false);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!w-[95vw] !max-w-3xl sm:!max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl">Create WhatsApp Order</DialogTitle>
              <DialogDescription>
                Collect customer items, generate automated Razorpay link, and send WhatsApp confirmation.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 pt-2">
          {/* Customer Details */}
          <div className="space-y-3 p-4 rounded-xl bg-card border">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <User className="h-4 w-4 text-indigo-400" />
              <span>Customer Information</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label htmlFor="cust_name" className="text-xs">
                  Customer Name *
                </Label>
                <Input
                  id="cust_name"
                  placeholder="e.g. Amit Kumar"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="cust_phone" className="text-xs">
                  WhatsApp Phone Number *
                </Label>
                <Input
                  id="cust_phone"
                  placeholder="+919876543210"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="cust_email" className="text-xs">
                  Email (Optional)
                </Label>
                <Input
                  id="cust_email"
                  type="email"
                  placeholder="amit@example.com"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Delivery Address */}
          <div className="space-y-3 p-4 rounded-xl bg-card border">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <MapPin className="h-4 w-4 text-emerald-400" />
              <span>Shipping & Delivery Address</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <Label htmlFor="addr_street" className="text-xs">
                  Street Address / House No. / Flat
                </Label>
                <Input
                  id="addr_street"
                  placeholder="Flat 302, Green Valley Apts, Station Road"
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="addr_city" className="text-xs">
                  City
                </Label>
                <Input
                  id="addr_city"
                  placeholder="e.g. Mumbai"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="addr_state" className="text-xs">
                  State
                </Label>
                <Input
                  id="addr_state"
                  placeholder="e.g. Maharashtra"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="addr_pincode" className="text-xs">
                  PIN Code
                </Label>
                <Input
                  id="addr_pincode"
                  placeholder="400001"
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="addr_landmark" className="text-xs">
                  Landmark (Optional)
                </Label>
                <Input
                  id="addr_landmark"
                  placeholder="Near Hanuman Temple"
                  value={landmark}
                  onChange={(e) => setLandmark(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Items Selector */}
          <div className="space-y-3 p-4 rounded-xl bg-card border">
            <div className="flex items-center justify-between text-sm font-semibold text-foreground">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-violet-400" />
                <span>Order Products ({items.length})</span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddItem}
                className="gap-1 h-8 text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Item
              </Button>
            </div>

            <div className="space-y-3">
              {items.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg border bg-muted/40 space-y-3 relative group"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                    {/* Quick Pick from Catalog */}
                    <div className="sm:col-span-5">
                      <Label className="text-xs text-muted-foreground">Pick from Catalog</Label>
                      <Select
                        onValueChange={(val) => val && handleSelectProduct(idx, String(val))}
                        disabled={loadingProducts || products.length === 0}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Select a product..." />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name} - ₹{p.price}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Custom Product Name */}
                    <div className="sm:col-span-4">
                      <Label className="text-xs text-muted-foreground">Item Name *</Label>
                      <Input
                        className="h-9"
                        placeholder="Product name"
                        value={item.name}
                        onChange={(e) => handleItemChange(idx, "name", e.target.value)}
                        required
                      />
                    </div>

                    {/* Variant / Custom Note */}
                    <div className="sm:col-span-3">
                      <Label className="text-xs text-muted-foreground">Variant / Note</Label>
                      <Input
                        className="h-9"
                        placeholder="Size/Color/Shape"
                        value={item.variant || ""}
                        onChange={(e) => handleItemChange(idx, "variant", e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4 pt-1">
                    <div className="flex items-center gap-3">
                      <div className="w-28">
                        <Label className="text-xs text-muted-foreground">Unit Price (₹)</Label>
                        <Input
                          type="number"
                          className="h-8 font-mono"
                          value={item.price}
                          onChange={(e) => handleItemChange(idx, "price", Number(e.target.value))}
                          min={0}
                          required
                        />
                      </div>
                      <div className="w-20">
                        <Label className="text-xs text-muted-foreground">Quantity</Label>
                        <Input
                          type="number"
                          className="h-8 font-mono"
                          value={item.quantity}
                          onChange={(e) =>
                            handleItemChange(idx, "quantity", Math.max(1, Number(e.target.value)))
                          }
                          min={1}
                          required
                        />
                      </div>
                      <div className="pt-4 text-xs text-muted-foreground">
                        Total: <span className="font-mono font-semibold text-foreground">₹{item.subtotal}</span>
                      </div>
                    </div>

                    {items.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-rose-400"
                        onClick={() => handleRemoveItem(idx)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Calculations & Summary */}
            <div className="pt-2 border-t grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label htmlFor="ord_shipping" className="text-xs">
                  Shipping Fee (₹)
                </Label>
                <Input
                  id="ord_shipping"
                  type="number"
                  min={0}
                  value={shippingFee}
                  onChange={(e) => setShippingFee(Number(e.target.value) || 0)}
                  className="font-mono"
                />
              </div>
              <div>
                <Label htmlFor="ord_discount" className="text-xs">
                  Discount (₹)
                </Label>
                <Input
                  id="ord_discount"
                  type="number"
                  min={0}
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(Number(e.target.value) || 0)}
                  className="font-mono"
                />
              </div>
              <div className="flex flex-col justify-end text-right">
                <span className="text-xs text-muted-foreground">Final Payable Amount</span>
                <span className="text-2xl font-bold font-mono text-emerald-400">
                  ₹{totalAmount}
                </span>
              </div>
            </div>
          </div>

          {/* Payment & Automation Options */}
          <div className="space-y-4 p-4 rounded-xl bg-card border">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs flex items-center gap-1.5 mb-1.5">
                  <CreditCard className="h-3.5 w-3.5 text-indigo-400" />
                  Payment Method
                </Label>
                <Select
                  value={paymentMethod}
                  onValueChange={(val) => setPaymentMethod(val as "razorpay" | "cod")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="razorpay">Razorpay (Automated Payment Link & UPI)</SelectItem>
                    <SelectItem value="cod">Cash on Delivery (COD)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="ord_notes" className="text-xs">
                  Special Notes / Photo Details
                </Label>
                <Textarea
                  id="ord_notes"
                  placeholder="e.g. Customer will send photos on WhatsApp"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="h-10 min-h-[40px] resize-none"
                />
              </div>
            </div>

            {/* Toggle WhatsApp message */}
            <div className="pt-2 border-t flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-emerald-400" />
                <div>
                  <p className="text-xs font-medium text-foreground">
                    Send WhatsApp Order Confirmation with Razorpay Link
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Instantly messages customer with order breakdown and secure UPI link.
                  </p>
                </div>
              </div>
              <Switch checked={sendWhatsApp} onCheckedChange={setSendWhatsApp} />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-indigo-600 hover:bg-indigo-500 text-white gap-1.5"
            >
              <Sparkles className="h-4 w-4" />
              {submitting ? "Creating Order..." : "Create Order & Generate Link"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
