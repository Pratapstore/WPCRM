"use client";

import { useState, useEffect } from "react";
import {
  Sparkles,
  UserPlus,
  Users,
  Copy,
  Check,
  MessageSquare,
  ExternalLink,
  RefreshCw,
  Search,
  Phone,
  MapPin,
  Package,
  Share2,
  CheckCircle2,
  ShoppingBag,
  ArrowRight,
  Send,
  Pencil,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import type { Order } from "@/types/orders";

interface ContactRow {
  id: string;
  name: string | null;
  phone: string;
  email: string | null;
  created_at: string;
}

export default function CustomersPage() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  // AI Extraction state
  const [rawText, setRawText] = useState("");
  const [extracting, setExtracting] = useState(false);

  // Form state
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [pincode, setPincode] = useState("");
  const [product, setProduct] = useState("Round Neck T-Shirt");
  const [size, setSize] = useState("XL - 42");
  const [price, setPrice] = useState("349");
  const [quantity, setQuantity] = useState("1");
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Edit Customer Dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [editCustomerName, setEditCustomerName] = useState("");
  const [editCustomerPhone, setEditCustomerPhone] = useState("");
  const [editStreet, setEditStreet] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editPincode, setEditPincode] = useState("");
  const [editItemName, setEditItemName] = useState("");
  const [editVariant, setEditVariant] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editPaymentStatus, setEditPaymentStatus] = useState("pending");
  const [editNotes, setEditNotes] = useState("");
  const [updatingCustomer, setUpdatingCustomer] = useState(false);

  const openEditCustomerDialog = (order: Order) => {
    setEditingOrder(order);
    setEditCustomerName(order.customer_name);
    setEditCustomerPhone(order.customer_phone);
    setEditStreet(order.shipping_address?.street || "");
    setEditCity(order.shipping_address?.city || "");
    setEditPincode(order.shipping_address?.pincode || "");
    const it = order.items?.[0] || {};
    setEditItemName(it.name || "Customized Item");
    setEditVariant(it.variant || "");
    setEditPrice(String(it.price || order.total_amount || ""));
    setEditPaymentStatus(order.payment_status || "pending");
    setEditNotes(order.notes || "");
    setEditDialogOpen(true);
  };

  const handleSaveCustomerEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder) return;

    setUpdatingCustomer(true);
    try {
      const numPrice = Number(editPrice) || editingOrder.total_amount;
      const updatedItems = [
        {
          ...(editingOrder.items?.[0] || {}),
          name: editItemName.trim() || "Customized Item",
          variant: editVariant.trim() || undefined,
          price: numPrice,
          subtotal: numPrice,
        },
      ];

      const payload = {
        customer_name: editCustomerName.trim(),
        customer_phone: editCustomerPhone.trim(),
        total_amount: numPrice,
        payment_status: editPaymentStatus,
        notes: editNotes.trim() || null,
        shipping_address: {
          ...(editingOrder.shipping_address || {}),
          street: editStreet.trim(),
          city: editCity.trim(),
          pincode: editPincode.trim(),
        },
        items: updatedItems,
      };

      const res = await fetch(`/api/orders/${editingOrder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update record");

      toast.success(`Record for "${editCustomerName}" updated!`);
      setOrders((prev) =>
        prev.map((o) => (o.id === editingOrder.id ? data.order : o))
      );
      setEditDialogOpen(false);
      setEditingOrder(null);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUpdatingCustomer(false);
    }
  };

  const handleDeleteCustomerOrder = async (orderId: string, name: string) => {
    if (!confirm(`Are you sure you want to delete the record for "${name}"?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/orders/${orderId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete record");
      toast.success(`Record for "${name}" deleted`);
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  // AI Draft Modal / Message
  const [aiDraftMessage, setAiDraftMessage] = useState<string | null>(null);
  const [draftingFor, setDraftingFor] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const publicLink = typeof window !== "undefined" ? `${window.location.origin}/collect` : "/collect";

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/customers");
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
        setContacts(data.contacts || []);
      }
    } catch (err) {
      console.error("Failed to load customers:", err);
      toast.error("Failed to load customer records");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Gemini AI Smart Extract
  const handleAiExtract = async () => {
    if (!rawText.trim()) {
      toast.error("Please paste customer text or chat first");
      return;
    }
    setExtracting(true);
    try {
      const res = await fetch("/api/ai/extract-customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText, mode: "extract" }),
      });
      const data = await res.json();
      if (!res.ok || !data.customer) {
        throw new Error(data.error || "Extraction failed");
      }
      const c = data.customer;
      if (c.fullName) setFullName(c.fullName);
      if (c.phone) setPhone(c.phone);
      if (c.address) setAddress(c.address);
      if (c.city) setCity(c.city);
      if (c.pincode) setPincode(c.pincode);
      if (c.product) setProduct(c.product);
      if (c.size) setSize(c.size);
      if (c.price) setPrice(String(c.price));
      if (c.notes) setNotes(c.notes);

      toast.success(
        data.provider === "gemini"
          ? "✨ Gemini AI successfully extracted customer details!"
          : "Details extracted successfully!"
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "AI extraction failed");
    } finally {
      setExtracting(false);
    }
  };

  // Save Customer & Create Order
  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) {
      toast.error("Mobile phone number is required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/customers/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          phone,
          address,
          city,
          pincode,
          product,
          size,
          price: Number(price) || 399,
          quantity: Number(quantity) || 1,
          paymentMethod,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save customer");
      }
      toast.success(`Customer saved! Order #${data.orderNumber} created.`);
      // Reset form fields
      setRawText("");
      setFullName("");
      setPhone("");
      setAddress("");
      setCity("");
      setPincode("");
      setNotes("");
      loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  // Generate Gemini AI WhatsApp Confirmation Draft
  const handleGenerateAiDraft = async (customer: {
    fullName: string;
    phone: string;
    address: string;
    pincode: string;
    product: string;
    size: string;
    price: number | string;
  }) => {
    setDraftingFor(customer.phone);
    try {
      const res = await fetch("/api/ai/extract-customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawText: "draft",
          mode: "draft_message",
          customer,
        }),
      });
      const data = await res.json();
      if (data.message) {
        setAiDraftMessage(data.message);
        navigator.clipboard.writeText(data.message);
        toast.success("✨ Gemini AI WhatsApp confirmation copied to clipboard!");
      }
    } catch (err) {
      toast.error("Failed to generate AI message");
    } finally {
      setDraftingFor(null);
    }
  };

  // Copy standard WhatsApp preview
  const copyStandardPreview = (item: {
    customer_name: string;
    customer_phone: string;
    shipping_address?: any;
    items?: any[];
    total_amount?: number;
  }) => {
    const it = item.items?.[0] || {};
    const street = item.shipping_address?.street || "";
    const pin = item.shipping_address?.postal_code || "";
    const preview = `📋 *ORDER SUMMARY & PREVIEW*
━━━━━━━━━━━━━━━━━━━━
Kripya apna order verify karein:

🛍️ *Item:* ${it.product_name || "Customized Item"}
👕 *Size:* ${it.size || "M - 38"}
💰 *Price:* ₹${it.price || item.total_amount || 399}

👤 *Customer:* ${item.customer_name}
📱 *Mobile:* ${item.customer_phone}
📍 *Delivery Address:*
${street || "Address provided"}
📮 *PIN Code:* ${pin || "N/A"}
━━━━━━━━━━━━━━━━━━━━
Kya upar di gayi saari details sahi hain?`;

    navigator.clipboard.writeText(preview);
    setCopiedId(item.customer_phone);
    toast.success("Copied WhatsApp Order Preview!");
    setTimeout(() => setCopiedId(null), 2500);
  };

  const filteredOrders = orders.filter((o) => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (
      o.customer_name?.toLowerCase().includes(s) ||
      o.customer_phone?.includes(s) ||
      o.order_number?.toLowerCase().includes(s) ||
      (o.shipping_address?.pincode && o.shipping_address.pincode.includes(s))
    );
  });

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 max-w-7xl mx-auto">
      {/* Top Banner / Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Users className="h-7 w-7 text-primary" />
              Customer Data Collection & AI
            </h1>
            <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/30 flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> Powered by Gemini AI
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            Collect, extract, and manage customer order details, shipping addresses, sizes, and send verified WhatsApp previews.
          </p>
        </div>

        {/* Public Form Quick Share */}
        <div className="flex items-center gap-2 bg-muted/60 p-2.5 rounded-xl border">
          <Share2 className="h-4 w-4 text-emerald-600 ml-1 shrink-0" />
          <div className="text-xs">
            <span className="font-semibold block text-foreground">Customer Self-Serve Link:</span>
            <span className="text-muted-foreground truncate max-w-[180px] sm:max-w-[220px] block font-mono text-[11px]">
              {publicLink}
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1 ml-auto text-xs"
            onClick={() => {
              navigator.clipboard.writeText(publicLink);
              toast.success("Customer Form Link copied! Share on WhatsApp.");
            }}
          >
            <Copy className="h-3.5 w-3.5" />
            Copy
          </Button>
          <Button
            size="sm"
            className="h-8 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
            onClick={() => window.open(publicLink, "_blank")}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open
          </Button>
        </div>
      </div>

      {/* Main Grid: Gemini AI Parser & Customer Collection Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Gemini AI Parser & Extraction (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="border-purple-500/30 shadow-md bg-gradient-to-b from-purple-500/5 via-background to-background">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-600" />
                  Gemini AI Quick Parser
                </CardTitle>
                <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                  Auto-Extract
                </Badge>
              </div>
              <CardDescription>
                Paste any unstructured customer WhatsApp message, chat transcript, or note. Gemini AI will instantly extract Name, Phone, Address, PIN, Item & Size!
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                placeholder="Example: Bhai mera naam Pratap Mishra hai, phone 8617324119, delivery address 12 Park Street, Kolkata, PIN 700016. Mujhe 1 Round Neck T-Shirt Size XL chahiye price 349..."
                rows={5}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                className="resize-none font-sans text-sm focus-visible:ring-purple-500"
              />

              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="text-[11px] text-muted-foreground self-center">Try sample:</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs px-2 py-0 text-muted-foreground hover:text-foreground"
                  onClick={() =>
                    setRawText(
                      "Namaste! Mera naam Pratap Mishra hai. Mobile 8617324119. Delivery address: Flat 4B, 12 Park Street, Kolkata, West Bengal PIN 700016. Mujhe Love Keychain (₹149) aur Round T-Shirt Size XL (₹349) bhejo. COD payment karunga."
                    )
                  }
                >
                  👕 T-Shirt & Keychain Sample
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs px-2 py-0 text-muted-foreground hover:text-foreground"
                  onClick={() =>
                    setRawText(
                      "Customer: Rahul Sharma\nPhone: 9876543210\nPata: Near SBI Bank, Main Road, Bokaro 827004\nItem: Collar T-Shirt Size L\nPrice: 399\nPayment: Paid via UPI"
                    )
                  }
                >
                  📋 Address Note Sample
                </Button>
              </div>
            </CardContent>
            <CardFooter className="pt-0">
              <Button
                type="button"
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white gap-2 font-medium shadow"
                onClick={handleAiExtract}
                disabled={extracting || !rawText.trim()}
              >
                {extracting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Gemini AI Extracting...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Extract with Gemini AI
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>

          {/* AI WhatsApp Draft Preview Card */}
          {aiDraftMessage && (
            <Card className="border-emerald-500/30 bg-emerald-500/5 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center justify-between text-emerald-700 dark:text-emerald-400">
                  <span className="flex items-center gap-1.5">
                    <MessageSquare className="h-4 w-4" />
                    Generated WhatsApp Confirmation
                  </span>
                  <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 text-[10px]">
                    Ready to Send
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs whitespace-pre-wrap font-sans bg-background/80 p-3 rounded-lg border text-foreground leading-relaxed">
                  {aiDraftMessage}
                </pre>
              </CardContent>
              <CardFooter className="pt-0 flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-xs gap-1.5"
                  onClick={() => {
                    navigator.clipboard.writeText(aiDraftMessage);
                    toast.success("Copied to clipboard!");
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy Text
                </Button>
                {phone && (
                  <Button
                    size="sm"
                    className="w-full text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() =>
                      window.open(
                        `https://wa.me/91${phone.replace(/\D/g, "").slice(-10)}?text=${encodeURIComponent(
                          aiDraftMessage
                        )}`,
                        "_blank"
                      )
                    }
                  >
                    <Send className="h-3.5 w-3.5" />
                    Send on WhatsApp
                  </Button>
                )}
              </CardFooter>
            </Card>
          )}
        </div>

        {/* Right Column: Customer Entry Form (7 cols) */}
        <div className="lg:col-span-7">
          <Card className="shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-primary" />
                Customer Data & Order Details
              </CardTitle>
              <CardDescription>
                Verify extracted customer information or manually enter details below to record customer orders into CRM.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSaveCustomer}>
              <CardContent className="space-y-4">
                {/* Name & Phone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="fullName" className="text-xs font-semibold">
                      Customer Full Name *
                    </Label>
                    <Input
                      id="fullName"
                      placeholder="e.g. Pratap Mishra"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="phone" className="text-xs font-semibold">
                      WhatsApp Mobile Number *
                    </Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="phone"
                        placeholder="e.g. 8617324119"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="pl-9"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Delivery Address */}
                <div className="space-y-1.5">
                  <Label htmlFor="address" className="text-xs font-semibold">
                    Delivery Address (House / Street / Landmark) *
                  </Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="address"
                      placeholder="e.g. Flat 4B, 12 Park Street, Near Metro Station"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="pl-9"
                      required
                    />
                  </div>
                </div>

                {/* City & PIN Code */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="city" className="text-xs font-semibold">
                      City / District
                    </Label>
                    <Input
                      id="city"
                      placeholder="e.g. Kolkata"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pincode" className="text-xs font-semibold">
                      6-Digit PIN Code *
                    </Label>
                    <Input
                      id="pincode"
                      placeholder="e.g. 700016"
                      value={pincode}
                      maxLength={6}
                      onChange={(e) => setPincode(e.target.value.replace(/\D/g, ""))}
                      required
                    />
                  </div>
                </div>

                {/* Item, Size, Price */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 border-t">
                  <div className="space-y-1.5">
                    <Label htmlFor="product" className="text-xs font-semibold">
                      🛍️ Item / Product
                    </Label>
                    <Input
                      id="product"
                      placeholder="e.g. Round Neck T-Shirt"
                      value={product}
                      onChange={(e) => setProduct(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="size" className="text-xs font-semibold">
                      👕 Size
                    </Label>
                    <Input
                      id="size"
                      placeholder="e.g. XL - 42"
                      value={size}
                      onChange={(e) => setSize(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="price" className="text-xs font-semibold">
                      💰 Price (₹)
                    </Label>
                    <Input
                      id="price"
                      type="number"
                      placeholder="e.g. 349"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                    />
                  </div>
                </div>

                {/* Payment Method & Notes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="paymentMethod" className="text-xs font-semibold">
                      Payment Mode
                    </Label>
                    <select
                      id="paymentMethod"
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value="cod">Cash on Delivery (COD)</option>
                      <option value="upi">UPI / Online Transfer</option>
                      <option value="paid">Prepaid / Already Paid</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="notes" className="text-xs font-semibold">
                      Notes / Customization Text
                    </Label>
                    <Input
                      id="notes"
                      placeholder="e.g. Print name 'Pratap' on chest"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>

              <CardFooter className="flex justify-between items-center border-t pt-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFullName("");
                    setPhone("");
                    setAddress("");
                    setCity("");
                    setPincode("");
                    setNotes("");
                  }}
                >
                  Clear Form
                </Button>
                <Button
                  type="submit"
                  disabled={saving}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-6"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                      Saving Order...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Save Customer & Create Order
                    </>
                  )}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      </div>

      {/* Bottom Section: Collected Customers Directory & Orders */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-emerald-600" />
                Collected Customer Orders & Leads ({filteredOrders.length})
              </CardTitle>
              <CardDescription>
                All captured customer details, items, sizes, addresses, and instant WhatsApp preview generators.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search name, phone, PIN..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 h-9 text-xs"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-1"
                onClick={loadData}
                disabled={loading}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 text-center text-muted-foreground">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
              Loading customer records...
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground border border-dashed rounded-xl">
              <Users className="h-10 w-10 mx-auto mb-2 opacity-40 text-muted-foreground" />
              <p className="font-medium text-foreground">No customer records found</p>
              <p className="text-xs text-muted-foreground mt-1">
                Use the Gemini AI Parser above or share the public collection link with customers.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 text-muted-foreground font-semibold border-b">
                  <tr>
                    <th className="py-2.5 px-3">Order #</th>
                    <th className="py-2.5 px-3">Customer & Phone</th>
                    <th className="py-2.5 px-3">Delivery Address</th>
                    <th className="py-2.5 px-3">Item & Size</th>
                    <th className="py-2.5 px-3">Amount</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredOrders.map((order) => {
                    const it = order.items?.[0] || {};
                    const street = order.shipping_address?.street || "";
                    const pin = order.shipping_address?.pincode || "";
                    const isCopied = copiedId === order.customer_phone;
                    const isDrafting = draftingFor === order.customer_phone;

                    return (
                      <tr key={order.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-3 font-mono font-medium text-foreground">
                          {order.order_number}
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-semibold text-foreground">{order.customer_name}</div>
                          <div className="text-muted-foreground font-mono flex items-center gap-1 text-[11px]">
                            <Phone className="h-3 w-3 text-emerald-600" />
                            {order.customer_phone}
                          </div>
                        </td>
                        <td className="py-3 px-3 max-w-[220px]">
                          <div className="truncate text-foreground" title={street}>
                            {street || "No street provided"}
                          </div>
                          <div className="text-muted-foreground text-[11px] font-mono">
                            📮 PIN: {pin || "N/A"}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-medium text-foreground flex items-center gap-1">
                            <Package className="h-3.5 w-3.5 text-primary" />
                            {it.name || "Customized Item"}
                          </div>
                          <div className="text-muted-foreground text-[11px]">
                            Size: <span className="font-semibold text-foreground">{it.variant || "M - 38"}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 font-semibold text-foreground font-mono">
                          ₹{it.price || order.total_amount || 399}
                        </td>
                        <td className="py-3 px-3">
                          <Badge
                            variant="outline"
                            className={
                              order.payment_status === "paid"
                                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                                : "bg-amber-500/10 text-amber-600 border-amber-500/30"
                            }
                          >
                            {order.payment_status === "paid" ? "Paid" : "Pending COD"}
                          </Badge>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Copy WhatsApp Preview */}
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs px-2 gap-1"
                              title="Copy WhatsApp Order Preview"
                              onClick={() => copyStandardPreview(order)}
                            >
                              {isCopied ? (
                                <>
                                  <Check className="h-3 w-3 text-emerald-600" />
                                  <span className="text-emerald-600">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3 w-3" />
                                  Preview
                                </>
                              )}
                            </Button>

                            {/* Draft AI Message */}
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-7 text-xs px-2 gap-1 text-purple-600 hover:text-purple-700 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40"
                              title="Draft with Gemini AI"
                              onClick={() =>
                                handleGenerateAiDraft({
                                  fullName: order.customer_name,
                                  phone: order.customer_phone,
                                  address: street,
                                  pincode: pin,
                                  product: it.name || "Customized Item",
                                  size: it.variant || "M - 38",
                                  price: it.price || order.total_amount || 399,
                                })
                              }
                              disabled={isDrafting}
                            >
                              {isDrafting ? (
                                <RefreshCw className="h-3 w-3 animate-spin" />
                              ) : (
                                <Sparkles className="h-3 w-3" />
                              )}
                              Gemini AI
                            </Button>

                            {/* Open Direct WhatsApp */}
                            <Button
                              size="sm"
                              className="h-7 text-xs px-2 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                              title="Chat on WhatsApp"
                              onClick={() => {
                                const phoneNum = order.customer_phone.replace(/\D/g, "").slice(-10);
                                window.open(`https://wa.me/91${phoneNum}`, "_blank");
                              }}
                            >
                              <MessageSquare className="h-3 w-3" />
                            </Button>

                            {/* Edit Customer Record */}
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs px-2 gap-1"
                              title="Edit Customer Details"
                              onClick={() => openEditCustomerDialog(order)}
                            >
                              <Pencil className="h-3 w-3" />
                              Edit
                            </Button>

                            {/* Delete Customer Record */}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs px-2 text-red-500 hover:text-red-400 hover:bg-red-500/10"
                              title="Delete Record"
                              onClick={() => handleDeleteCustomerOrder(order.id, order.customer_name)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Customer Order Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4 text-primary" />
              Edit Customer Record & Order
            </DialogTitle>
            <DialogDescription>
              Update customer contact details, address, product item, and payment status.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveCustomerEdit} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="edit_cust_name" className="text-xs">
                  Customer Name *
                </Label>
                <Input
                  id="edit_cust_name"
                  value={editCustomerName}
                  onChange={(e) => setEditCustomerName(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit_cust_phone" className="text-xs">
                  Phone Number *
                </Label>
                <Input
                  id="edit_cust_phone"
                  value={editCustomerPhone}
                  onChange={(e) => setEditCustomerPhone(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="edit_cust_addr" className="text-xs">
                Delivery Address / Street
              </Label>
              <Input
                id="edit_cust_addr"
                value={editStreet}
                onChange={(e) => setEditStreet(e.target.value)}
                placeholder="Flat / House / Street"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="edit_cust_city" className="text-xs">
                  City / District
                </Label>
                <Input
                  id="edit_cust_city"
                  value={editCity}
                  onChange={(e) => setEditCity(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="edit_cust_pin" className="text-xs">
                  PIN Code
                </Label>
                <Input
                  id="edit_cust_pin"
                  value={editPincode}
                  onChange={(e) => setEditPincode(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2 border-t">
              <div>
                <Label htmlFor="edit_item_name" className="text-xs">
                  Item / Product
                </Label>
                <Input
                  id="edit_item_name"
                  value={editItemName}
                  onChange={(e) => setEditItemName(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="edit_variant" className="text-xs">
                  Size / Variant
                </Label>
                <Input
                  id="edit_variant"
                  value={editVariant}
                  onChange={(e) => setEditVariant(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="edit_cust_price" className="text-xs">
                  Price (₹)
                </Label>
                <Input
                  id="edit_cust_price"
                  type="number"
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="edit_pay_status" className="text-xs">
                  Payment Status
                </Label>
                <select
                  id="edit_pay_status"
                  value={editPaymentStatus}
                  onChange={(e) => setEditPaymentStatus(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-sm"
                >
                  <option value="pending">Pending COD</option>
                  <option value="paid">Paid (Online/UPI)</option>
                  <option value="failed">Failed</option>
                  <option value="refunded">Refunded</option>
                </select>
              </div>
              <div>
                <Label htmlFor="edit_cust_notes" className="text-xs">
                  Notes
                </Label>
                <Input
                  id="edit_cust_notes"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Customization notes..."
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditDialogOpen(false)}
                disabled={updatingCustomer}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updatingCustomer}
                className="bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                {updatingCustomer ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
