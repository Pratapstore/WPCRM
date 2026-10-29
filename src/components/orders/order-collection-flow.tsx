"use client";

import { useEffect, useState, useMemo } from "react";
import {
  ShoppingBag,
  Sparkles,
  CreditCard,
  Truck,
  User,
  Phone,
  Mail,
  MapPin,
  Plus,
  Trash2,
  RefreshCw,
  QrCode,
  FileText,
  MessageSquare,
  CheckCircle2,
  ExternalLink,
  Copy,
  Check,
  Send,
  Zap,
  ArrowRight,
  ShieldCheck,
  Tag,
  Search,
  Eye,
  IndianRupee,
  Bot,
  Wand2,
  Share2,
  Link2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { WhatsAppChatPreview } from "./whatsapp-chat-preview";
import { WebCheckoutPreview } from "./web-checkout-preview";
import { InvoicePreview } from "./invoice-preview";
import { UpiQrPreview } from "./upi-qr-preview";
import {
  INDIAN_PIN_CODE_DIRECTORY,
  INDIAN_STATES,
  formatIndianCurrency,
} from "@/lib/orders/upi-helper";
import type { Order, OrderItem, Product } from "@/types/orders";

interface ContactSuggestion {
  id: string;
  name: string;
  phone: string;
  email?: string;
}

export function OrderCollectionFlow() {
  // Step / Active Tab for mobile or flow modes
  const [previewTab, setPreviewTab] = useState<"whatsapp" | "checkout" | "invoice" | "upi">("whatsapp");
  const [submitting, setSubmitting] = useState(false);

  // Success Dialog state
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // 1. Customer State
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerTag, setCustomerTag] = useState("New Customer");
  const [contactId, setContactId] = useState<string | null>(null);

  // CRM Contacts Search
  const [contacts, setContacts] = useState<ContactSuggestion[]>([]);
  const [contactSearch, setContactSearch] = useState("");
  const [showContactDropdown, setShowContactDropdown] = useState(false);

  // 2. Product Catalog State
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [catalogModalOpen, setCatalogModalOpen] = useState(false);

  // Items in current order
  const [items, setItems] = useState<OrderItem[]>([
    {
      name: "Custom Acrylic Photo Keychain",
      price: 199,
      quantity: 1,
      variant: "Spotify Code • Heart",
      subtotal: 199,
    },
  ]);

  // 3. Pan-India Shipping & Delivery Address State
  const [street, setStreet] = useState("");
  const [landmark, setLandmark] = useState("");
  const [city, setCity] = useState("New Delhi");
  const [state, setState] = useState("Delhi");
  const [pincode, setPincode] = useState("110001");
  const [deliveryPartner, setDeliveryPartner] = useState("Delhivery Express");
  const [deliverySpeed, setDeliverySpeed] = useState<"standard" | "express" | "free">("free");

  // 4. Pricing, Discount, Shipping & Tax Engine
  const [discountType, setDiscountType] = useState<"flat" | "percent">("flat");
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [shippingFee, setShippingFee] = useState<number>(0);
  const [taxRate, setTaxRate] = useState<number>(0); // 0, 5, 12, 18%

  // 5. Payment Collection Mode
  const [paymentMethod, setPaymentMethod] = useState<"razorpay" | "upi_manual" | "cod">("razorpay");
  const [upiId, setUpiId] = useState("pratapstore@jio");
  const [codAdvanceDeposit, setCodAdvanceDeposit] = useState<number>(0); // Optional token to confirm COD
  const [orderNotes, setOrderNotes] = useState("");
  const [sendWhatsAppAuto, setSendWhatsAppAuto] = useState(true);

  // Automated System State (AI Extract & Self-Collection)
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [aiExtractOpen, setAiExtractOpen] = useState(false);
  const [aiRawText, setAiRawText] = useState("");
  const [aiExtracting, setAiExtracting] = useState(false);
  const [collectLinkOpen, setCollectLinkOpen] = useState(false);
  const [copiedCollectUrl, setCopiedCollectUrl] = useState(false);

  // Generated Mock Order ID for live preview
  const previewOrderNumber = useMemo(() => {
    return `ORD-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;
  }, []);

  // Fetch Catalog & Contacts on mount
  useEffect(() => {
    setLoadingCatalog(true);
    fetch("/api/products")
      .then((res) => res.json())
      .then((data) => {
        if (data.products && Array.isArray(data.products)) {
          setCatalogProducts(data.products);
        }
      })
      .catch((err) => console.error("Catalog load error:", err))
      .finally(() => setLoadingCatalog(false));

    // Fetch store UPI ID from payment settings
    fetch("/api/settings/payments")
      .then((res) => res.json())
      .then((data) => {
        if (data.config?.upi_id) {
          setUpiId(data.config.upi_id);
        }
      })
      .catch((err) => console.error("Payment settings load error:", err));

    fetch("/api/customers?search=")
      .then((res) => res.json())
      .then((data) => {
        if (data.contacts && Array.isArray(data.contacts)) {
          setContacts(data.contacts);
        }
        if (data.orders && Array.isArray(data.orders)) {
          setRecentOrders(data.orders);
        }
      })
      .catch((err) => console.error("Contacts load error:", err));
  }, []);

  // Auto-fill City & State on Indian PIN Code change
  const handlePincodeChange = (pin: string) => {
    const cleanPin = pin.replace(/\D/g, "").slice(0, 6);
    setPincode(cleanPin);

    if (cleanPin.length === 6 && INDIAN_PIN_CODE_DIRECTORY[cleanPin]) {
      const match = INDIAN_PIN_CODE_DIRECTORY[cleanPin];
      setCity(match.city);
      setState(match.state);
      toast.success(`PIN ${cleanPin} detected: ${match.city}, ${match.state}`);
    }
  };

  // Calculations
  const subtotal = useMemo(() => {
    return items.reduce((acc, curr) => acc + (Number(curr.subtotal) || Number(curr.price) * Number(curr.quantity) || 0), 0);
  }, [items]);

  const discountAmount = useMemo(() => {
    if (discountType === "percent") {
      return Math.round((subtotal * Math.min(100, Math.max(0, discountValue))) / 100);
    }
    return Math.min(subtotal, Math.max(0, discountValue));
  }, [subtotal, discountType, discountValue]);

  const taxAmount = useMemo(() => {
    if (taxRate <= 0) return 0;
    const taxable = Math.max(0, subtotal - discountAmount);
    return Math.round((taxable * taxRate) / 100);
  }, [subtotal, discountAmount, taxRate]);

  const totalAmount = useMemo(() => {
    return Math.max(0, subtotal - discountAmount + shippingFee + taxAmount);
  }, [subtotal, discountAmount, shippingFee, taxAmount]);

  // Items manipulation
  const updateItem = (index: number, field: keyof OrderItem, value: unknown) => {
    setItems((prev) => {
      const copy = [...prev];
      const item = { ...copy[index], [field]: value };
      if (field === "price" || field === "quantity") {
        item.subtotal = Number(item.price || 0) * Number(item.quantity || 1);
      }
      copy[index] = item;
      return copy;
    });
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) {
      toast.error("Order must have at least one product item.");
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const addCustomItem = () => {
    setItems((prev) => [
      ...prev,
      {
        name: "Custom Product Item",
        price: 299,
        quantity: 1,
        variant: "Standard",
        subtotal: 299,
      },
    ]);
  };

  const addCatalogProduct = (product: Product, variantChoice?: string) => {
    setItems((prev) => [
      ...prev,
      {
        product_id: product.id,
        name: product.name,
        price: product.price,
        quantity: 1,
        variant: variantChoice || (product.variants?.[0]?.options?.[0] ? `${product.variants[0].name}: ${product.variants[0].options[0]}` : undefined),
        image_url: product.image_url || undefined,
        subtotal: product.price,
      },
    ]);
    toast.success(`Added ${product.name} to order collection!`);
    setCatalogModalOpen(false);
  };

  // Demo Data Loader (for fast one-click WOW testing)
  const loadDemoData = () => {
    setCustomerName("Rahul Sharma");
    setCustomerPhone("9876543210");
    setCustomerEmail("rahul.sharma@example.com");
    setCustomerTag("Repeat VIP");
    setStreet("Flat 402, Royal Palms Heights, Link Road");
    setLandmark("Opposite Metro Station");
    setCity("Mumbai (Andheri West)");
    setState("Maharashtra");
    setPincode("400053");
    setDeliveryPartner("Delhivery Air");
    setDiscountType("flat");
    setDiscountValue(50);
    setShippingFee(49);
    setTaxRate(0);
    setPaymentMethod("razorpay");
    setOrderNotes("Gift wrap requested with birthday ribbon.");
    setItems([
      {
        name: "Personalized Magic Heat-Sensitive Mug",
        price: 399,
        quantity: 1,
        variant: "325 ml • Black Ceramic",
        subtotal: 399,
      },
      {
        name: "Custom Acrylic Photo Keychain",
        price: 199,
        quantity: 2,
        variant: "Heart Shape • Double Sided",
        subtotal: 398,
      },
    ]);
    toast.success("Loaded demo customer order with live preview!");
  };

  const resetForm = () => {
    setCustomerName("");
    setCustomerPhone("");
    setCustomerEmail("");
    setStreet("");
    setLandmark("");
    setCity("New Delhi");
    setState("Delhi");
    setPincode("110001");
    setDiscountValue(0);
    setShippingFee(0);
    setTaxRate(0);
    setPaymentMethod("razorpay");
    setItems([
      {
        name: "Custom Acrylic Photo Keychain",
        price: 199,
        quantity: 1,
        variant: "Standard",
        subtotal: 199,
      },
    ]);
    toast.info("Form reset to blank state.");
  };
  // Auto-Select Contact & Auto-Fill Past Shipping Address
  const handleSelectContact = (c: ContactSuggestion) => {
    setCustomerName(c.name);
    setCustomerPhone(c.phone);
    if (c.email) setCustomerEmail(c.email);
    setContactId(c.id);
    setShowContactDropdown(false);

    // Automatically find previous address from past orders
    const pastOrder = recentOrders.find(
      (o) => o.customer_phone === c.phone || o.contact_id === c.id
    );
    if (pastOrder?.shipping_address?.street) {
      const a = pastOrder.shipping_address;
      setStreet(a.street || "");
      if (a.landmark) setLandmark(a.landmark);
      if (a.city) setCity(a.city);
      if (a.state) setState(a.state);
      if (a.pincode) setPincode(a.pincode);
      toast.success(`✨ Past address auto-filled for ${c.name}: ${a.city}, ${a.pincode}`);
    } else {
      toast.success(`Selected customer ${c.name}`);
    }
  };

  // AI 1-Click Customer Detail Extraction from WhatsApp Chat Text
  const handleAiExtract = async () => {
    if (!aiRawText.trim()) {
      toast.error("Please enter or paste customer chat text");
      return;
    }
    setAiExtracting(true);
    try {
      const res = await fetch("/api/ai/extract-customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText: aiRawText.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Extraction failed");

      const cust = data.customer;
      if (cust) {
        if (cust.fullName && cust.fullName !== "Customer") setCustomerName(cust.fullName);
        if (cust.phone) setCustomerPhone(cust.phone.replace(/\D/g, "").slice(0, 10));
        if (cust.address) setStreet(cust.address);
        if (cust.city) setCity(cust.city);
        if (cust.state) setState(cust.state);
        if (cust.pincode) {
          handlePincodeChange(cust.pincode);
        }
        if (cust.notes) setOrderNotes(cust.notes);

        if (cust.product) {
          const matched = catalogProducts.find(
            (p) =>
              p.name.toLowerCase().includes(cust.product.toLowerCase()) ||
              cust.product.toLowerCase().includes(p.name.toLowerCase())
          );
          if (matched) {
            setItems([
              {
                product_id: matched.id,
                name: matched.name,
                price: cust.price || matched.price,
                quantity: 1,
                variant: cust.size || undefined,
                image_url: matched.image_url || undefined,
                subtotal: cust.price || matched.price,
              },
            ]);
          } else {
            setItems([
              {
                name: cust.product,
                price: Number(cust.price) || 399,
                quantity: 1,
                variant: cust.size || "Standard",
                subtotal: Number(cust.price) || 399,
              },
            ]);
          }
        }

        toast.success("🤖✨ AI extracted all customer details & product items!");
        setAiExtractOpen(false);
      }
    } catch (err) {
      toast.error((err as Error).message || "AI extraction failed");
    } finally {
      setAiExtracting(false);
    }
  };

  // Submit Order Creation
  const handleCreateOrder = async () => {
    if (!customerName.trim()) {
      toast.error("Please enter Customer Full Name");
      return;
    }
    const cleanPhone = customerPhone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      toast.error("Please enter a valid 10-digit mobile number");
      return;
    }
    if (items.length === 0 || !items[0].name.trim()) {
      toast.error("Please add at least one valid product item");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        customer_name: customerName.trim(),
        customer_phone: cleanPhone,
        customer_email: customerEmail.trim() || undefined,
        contact_id: contactId || undefined,
        shipping_address: {
          recipient_name: customerName.trim(),
          phone: cleanPhone,
          street: street.trim() || "Address not provided",
          landmark: landmark.trim() || undefined,
          city: city.trim() || "New Delhi",
          state: state.trim() || "Delhi",
          pincode: pincode.trim() || "110001",
        },
        items: items.map((it) => ({
          product_id: it.product_id,
          name: it.name,
          price: Number(it.price) || 0,
          quantity: Number(it.quantity) || 1,
          variant: it.variant,
          image_url: it.image_url,
          subtotal: (Number(it.price) || 0) * (Number(it.quantity) || 1),
        })),
        subtotal,
        discount_amount: discountAmount,
        shipping_fee: shippingFee,
        tax_amount: taxAmount,
        payment_method: paymentMethod,
        notes: orderNotes.trim() || undefined,
        send_whatsapp: sendWhatsAppAuto,
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

      setCreatedOrder(data.order);
      setSuccessDialogOpen(true);
      toast.success(
        `Order #${data.order.order_number} created successfully! ${
          data.whatsapp?.success ? "WhatsApp dispatched." : ""
        }`
      );
    } catch (err) {
      const error = err as Error;
      console.error("Order creation error:", error);
      toast.error(error.message || "Something went wrong creating order");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Control Bar */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-950 via-slate-900 to-violet-950 border border-indigo-500/30 p-5 sm:p-6 shadow-xl text-white">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <Badge className="bg-gradient-to-r from-indigo-500 to-violet-500 text-white border-0 text-[11px] font-semibold px-2.5 py-0.5 shadow-sm">
                ⚡ Pro Order Collection Flow
              </Badge>
              <Badge variant="outline" className="text-indigo-200 border-indigo-500/30 text-[11px]">
                A to Z Live Preview Studio
              </Badge>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              WhatsApp Order Collection Studio
            </h2>
            <p className="text-xs sm:text-sm text-indigo-200/80 max-w-2xl mt-1">
              Create orders with live interactive previews — WhatsApp chat bubble, instant UPI QR code, mobile web checkout &amp; GST tax invoice.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={loadDemoData}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs gap-1.5 h-9"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
              Load Demo Order
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={resetForm}
              className="text-white/70 hover:text-white hover:bg-white/10 text-xs gap-1.5 h-9"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Reset
            </Button>
          </div>
        </div>
      </div>

      {/* Main 2-Column Split Workspace */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: A to Z Order Flow Builder (7 Cols) */}
        <div className="xl:col-span-7 space-y-5">
          {/* Section 1: Customer Details */}
          <Card className="border shadow-xs">
            <CardHeader className="pb-3 border-b border-border/60">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-bold text-xs">
                    <User className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-semibold">1. Customer &amp; WhatsApp Channel</CardTitle>
                    <CardDescription className="text-[11px]">Select CRM contact, auto-extract with AI, or enter manually</CardDescription>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setAiExtractOpen(true)}
                    className="h-7 text-xs gap-1 border-violet-500/30 text-violet-600 hover:bg-violet-500/10 bg-violet-500/5 font-medium shadow-xs"
                  >
                    <Bot className="h-3.5 w-3.5 text-violet-500" />
                    🤖 Auto-Extract (AI)
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setCollectLinkOpen(true)}
                    className="h-7 text-xs gap-1 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 bg-emerald-500/5 font-medium shadow-xs"
                  >
                    <Link2 className="h-3.5 w-3.5 text-emerald-500" />
                    📲 Request Address
                  </Button>
                  <Badge variant="outline" className="text-[10px] text-muted-foreground hidden sm:inline-flex">
                    Step 1 of 5
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4 text-xs">
              {/* Quick Contact Search */}
              <div className="relative">
                <Label className="text-xs text-muted-foreground flex items-center justify-between mb-1">
                  <span>Quick Search from CRM Contacts / Past Customers:</span>
                  <span className="text-[10px] text-primary cursor-pointer hover:underline" onClick={() => setShowContactDropdown(!showContactDropdown)}>
                    {showContactDropdown ? "Close List" : "Browse Contacts"}
                  </span>
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search past contacts by name or phone..."
                    value={contactSearch}
                    onChange={(e) => {
                      setContactSearch(e.target.value);
                      setShowContactDropdown(true);
                    }}
                    onFocus={() => setShowContactDropdown(true)}
                    className="pl-8 h-8 text-xs"
                  />
                </div>

                {showContactDropdown && contacts.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-popover border border-border rounded-xl shadow-lg z-20 divide-y divide-border/60">
                    {contacts
                      .filter(
                        (c) =>
                          !contactSearch ||
                          c.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
                          c.phone.includes(contactSearch)
                      )
                      .slice(0, 5)
                      .map((c) => (
                        <div
                          key={c.id}
                          onClick={() => handleSelectContact(c)}
                          className="p-2 hover:bg-muted cursor-pointer flex items-center justify-between text-xs transition-colors"
                        >
                          <div>
                            <p className="font-medium text-foreground">{c.name}</p>
                            <p className="text-[10px] text-muted-foreground">{c.phone}</p>
                          </div>
                          <Badge variant="secondary" className="text-[10px] h-4">
                            Select &amp; Auto-fill
                          </Badge>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">
                    Customer Full Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    placeholder="e.g. Rahul Sharma"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs flex items-center justify-between">
                    <span>
                      WhatsApp Mobile Number <span className="text-destructive">*</span>
                    </span>
                    {customerPhone.length >= 10 && (
                      <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-0.5">
                        <CheckCircle2 className="h-3 w-3" /> Valid
                      </span>
                    )}
                  </Label>
                  <div className="flex">
                    <span className="inline-flex items-center px-2.5 rounded-l-md border border-r-0 border-input bg-muted text-[11px] text-muted-foreground">
                      🇮🇳 +91
                    </span>
                    <Input
                      placeholder="9876543210"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      className="rounded-l-none h-8 text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Customer Email (Optional)</Label>
                  <Input
                    type="email"
                    placeholder="rahul@example.com"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Customer Tag / Segment</Label>
                  <Select value={customerTag} onValueChange={(val) => { if (val) setCustomerTag(val); }}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="New Customer">New Customer</SelectItem>
                      <SelectItem value="Repeat VIP">Repeat VIP Customer</SelectItem>
                      <SelectItem value="Wholesale">Wholesale / B2B</SelectItem>
                      <SelectItem value="Urgent Dispatch">Urgent Dispatch</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Product Catalog & Smart Items */}
          <Card className="border shadow-xs">
            <CardHeader className="pb-3 border-b border-border/60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-xs">
                    <ShoppingBag className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-semibold">2. Product Catalog & Order Items</CardTitle>
                    <CardDescription className="text-[11px]">Pick items from Pratap Store catalog or enter custom products</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCatalogModalOpen(true)}
                    className="h-7 text-xs gap-1 border-primary/40 text-primary hover:bg-primary/5"
                  >
                    <Plus className="h-3 w-3" />
                    Catalog Picker
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={addCustomItem}
                    className="h-7 text-xs gap-1 text-muted-foreground"
                  >
                    Custom Row
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              {items.map((item, index) => (
                <div
                  key={index}
                  className="p-3 rounded-xl border border-border/70 bg-muted/10 space-y-2 relative group hover:border-border transition-colors"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                    <div className="sm:col-span-5 space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Product Item Name</Label>
                      <Input
                        placeholder="e.g. Acrylic Keychain"
                        value={item.name}
                        onChange={(e) => updateItem(index, "name", e.target.value)}
                        className="h-8 text-xs font-medium"
                      />
                    </div>

                    <div className="sm:col-span-3 space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Variant / Options</Label>
                      <Input
                        placeholder="Size, Finish, Color"
                        value={item.variant || ""}
                        onChange={(e) => updateItem(index, "variant", e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>

                    <div className="sm:col-span-2 space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Unit Price (₹)</Label>
                      <Input
                        type="number"
                        min="0"
                        value={item.price}
                        onChange={(e) => updateItem(index, "price", Number(e.target.value))}
                        className="h-8 text-xs font-mono"
                      />
                    </div>

                    <div className="sm:col-span-2 space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Quantity</Label>
                      <div className="flex items-center">
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, "quantity", Math.max(1, Number(e.target.value)))}
                          className="h-8 text-xs font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] pt-1 border-t border-border/40 text-muted-foreground">
                    <span>
                      Subtotal: <strong className="text-foreground font-mono">₹{item.subtotal || item.price * item.quantity}</strong>
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(index)}
                      className="h-6 text-[10px] text-destructive hover:bg-destructive/10 px-2"
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Section 3: Pan-India Shipping & Delivery */}
          <Card className="border shadow-xs">
            <CardHeader className="pb-3 border-b border-border/60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-sky-500/10 text-sky-600 flex items-center justify-center font-bold text-xs">
                    <Truck className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-semibold">3. Pan-India Delivery &amp; Address</CardTitle>
                    <CardDescription className="text-[11px]">Pin code lookup auto-fills city &amp; state</CardDescription>
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px] text-muted-foreground">
                  Step 3 of 5
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1 space-y-1">
                  <Label className="text-xs flex items-center justify-between">
                    <span>PIN Code (6-digit)</span>
                    <span className="text-[10px] text-primary">Auto-Lookup</span>
                  </Label>
                  <Input
                    placeholder="110001"
                    value={pincode}
                    onChange={(e) => handlePincodeChange(e.target.value)}
                    className="h-8 text-xs font-mono"
                  />
                </div>

                <div className="sm:col-span-1 space-y-1">
                  <Label className="text-xs">City</Label>
                  <Input
                    placeholder="e.g. New Delhi"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>

                <div className="sm:col-span-1 space-y-1">
                  <Label className="text-xs">State</Label>
                  <Select value={state} onValueChange={(val) => { if (val) setState(val); }}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      {INDIAN_STATES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Flat / House / Street Address</Label>
                  <Input
                    placeholder="e.g. Flat 301, Sector 15"
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Landmark (Optional)</Label>
                  <Input
                    placeholder="Near Shiv Mandir / Metro Station"
                    value={landmark}
                    onChange={(e) => setLandmark(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Courier Partner Preference</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {["Delhivery Express", "BlueDart Air", "DTDC Surface", "India Post Speed"].map((partner) => (
                    <div
                      key={partner}
                      onClick={() => setDeliveryPartner(partner)}
                      className={`p-2 rounded-lg border text-center cursor-pointer transition-colors ${
                        deliveryPartner === partner
                          ? "border-primary bg-primary/10 text-primary font-semibold"
                          : "border-border text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      <p className="text-[11px] truncate">{partner}</p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 4: Pricing, Discounts & GST */}
          <Card className="border shadow-xs">
            <CardHeader className="pb-3 border-b border-border/60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold text-xs">
                    <Tag className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-semibold">4. Discounts, Delivery Charges &amp; Taxes</CardTitle>
                    <CardDescription className="text-[11px]">Apply coupons, shipping rates, and GST percentage</CardDescription>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold text-primary">
                  Total: {formatIndianCurrency(totalAmount)}
                </span>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Discount */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs">Discount Offer</Label>
                    <div className="flex items-center gap-1 text-[10px]">
                      <button
                        type="button"
                        onClick={() => setDiscountType("flat")}
                        className={`px-1.5 py-0.5 rounded ${discountType === "flat" ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground"}`}
                      >
                        ₹ Flat
                      </button>
                      <button
                        type="button"
                        onClick={() => setDiscountType("percent")}
                        className={`px-1.5 py-0.5 rounded ${discountType === "percent" ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground"}`}
                      >
                        % Off
                      </button>
                    </div>
                  </div>
                  <Input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(Number(e.target.value))}
                    className="h-8 text-xs font-mono"
                  />
                  <div className="flex gap-1">
                    {[
                      { code: "FLAT50", val: 50, type: "flat" as const },
                      { code: "FLAT100", val: 100, type: "flat" as const },
                      { code: "10% OFF", val: 10, type: "percent" as const },
                    ].map((c) => (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => {
                          setDiscountType(c.type);
                          setDiscountValue(c.val);
                        }}
                        className="text-[9px] px-1.5 py-0.5 rounded bg-muted hover:bg-muted/80 text-muted-foreground"
                      >
                        {c.code}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Delivery Fee */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Delivery / Shipping</Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={shippingFee}
                    onChange={(e) => setShippingFee(Number(e.target.value))}
                    className="h-8 text-xs font-mono"
                  />
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setShippingFee(0)}
                      className={`text-[9px] px-1.5 py-0.5 rounded ${shippingFee === 0 ? "bg-emerald-500/10 text-emerald-600 font-semibold border border-emerald-500/20" : "bg-muted text-muted-foreground"}`}
                    >
                      Free (₹0)
                    </button>
                    <button
                      type="button"
                      onClick={() => setShippingFee(49)}
                      className={`text-[9px] px-1.5 py-0.5 rounded ${shippingFee === 49 ? "bg-primary/10 text-primary font-semibold" : "bg-muted text-muted-foreground"}`}
                    >
                      Std (₹49)
                    </button>
                    <button
                      type="button"
                      onClick={() => setShippingFee(99)}
                      className={`text-[9px] px-1.5 py-0.5 rounded ${shippingFee === 99 ? "bg-primary/10 text-primary font-semibold" : "bg-muted text-muted-foreground"}`}
                    >
                      Express (₹99)
                    </button>
                  </div>
                </div>

                {/* GST Tax Rate */}
                <div className="space-y-1.5">
                  <Label className="text-xs">GST Tax Rate</Label>
                  <Select value={String(taxRate)} onValueChange={(val) => { if (val !== null) setTaxRate(Number(val)); }}>
                    <SelectTrigger className="h-8 text-xs font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0% (Inclusive / None)</SelectItem>
                      <SelectItem value="5">5% GST (Apparel / Essentials)</SelectItem>
                      <SelectItem value="12">12% GST (Standard)</SelectItem>
                      <SelectItem value="18">18% GST (Services / Gifts)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground">
                    Tax Amount: <strong className="font-mono">₹{taxAmount}</strong>
                  </p>
                </div>
              </div>

              {/* Summary Bar */}
              <div className="p-3 bg-muted/30 rounded-xl flex flex-wrap items-center justify-between gap-2 border border-border/60">
                <div className="flex items-center gap-4 text-xs">
                  <span>Subtotal: <strong className="font-mono">{formatIndianCurrency(subtotal)}</strong></span>
                  {discountAmount > 0 && (
                    <span className="text-emerald-600">Discount: <strong className="font-mono">-{formatIndianCurrency(discountAmount)}</strong></span>
                  )}
                  <span>Shipping: <strong className="font-mono">{shippingFee > 0 ? formatIndianCurrency(shippingFee) : "FREE"}</strong></span>
                  {taxAmount > 0 && (
                    <span>GST: <strong className="font-mono">{formatIndianCurrency(taxAmount)}</strong></span>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-xs text-muted-foreground mr-1.5">Grand Total:</span>
                  <span className="text-base font-bold text-foreground font-mono">
                    {formatIndianCurrency(totalAmount)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 5: Payment Collection Engine & WhatsApp Automation */}
          <Card className="border shadow-xs">
            <CardHeader className="pb-3 border-b border-border/60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-violet-500/10 text-violet-600 flex items-center justify-center font-bold text-xs">
                    <CreditCard className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-semibold">5. Payment Mode &amp; WhatsApp Automation</CardTitle>
                    <CardDescription className="text-[11px]">Razorpay link, Direct UPI QR or Cash on Delivery</CardDescription>
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px] text-muted-foreground">
                  Step 5 of 5
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Razorpay */}
                <div
                  onClick={() => setPaymentMethod("razorpay")}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    paymentMethod === "razorpay"
                      ? "border-primary bg-primary/5 shadow-xs"
                      : "border-border hover:bg-muted/20"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                      <CreditCard className="h-3.5 w-3.5 text-primary" />
                      Razorpay Link
                    </span>
                    <Badge variant="outline" className="text-[9px] h-4 bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                      Auto-Link
                    </Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Generates official payment link. Supports UPI, Cards, NetBanking.
                  </p>
                </div>

                {/* Direct UPI QR */}
                <div
                  onClick={() => setPaymentMethod("upi_manual")}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    paymentMethod === "upi_manual"
                      ? "border-emerald-500 bg-emerald-500/5 shadow-xs"
                      : "border-border hover:bg-muted/20"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                      <QrCode className="h-3.5 w-3.5 text-emerald-600" />
                      Direct UPI QR
                    </span>
                    <Badge variant="outline" className="text-[9px] h-4 text-emerald-600 border-emerald-500/30">
                      Zero Fees
                    </Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Instant scan &amp; pay via Google Pay, PhonePe, Paytm with custom VPA.
                  </p>
                </div>

                {/* Cash on Delivery (COD) */}
                <div
                  onClick={() => setPaymentMethod("cod")}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    paymentMethod === "cod"
                      ? "border-amber-500 bg-amber-500/5 shadow-xs"
                      : "border-border hover:bg-muted/20"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                      <Truck className="h-3.5 w-3.5 text-amber-600" />
                      Cash on Delivery
                    </span>
                    <Badge variant="outline" className="text-[9px] h-4 text-amber-600 border-amber-500/30">
                      COD
                    </Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Pay upon package delivery. Option to charge advance token.
                  </p>
                </div>
              </div>

              {paymentMethod === "upi_manual" && (
                <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-foreground font-medium">Merchant UPI VPA (UPI ID):</Label>
                    <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Active Store VPA ({upiId})
                    </span>
                  </div>
                  <Input
                    placeholder="e.g. pratapstore@jio"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    className="h-8 text-xs font-mono"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    This UPI ID is encoded into the QR code and payment URI sent to the customer.
                  </p>
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-xs">Order Notes / Custom Instructions</Label>
                <Textarea
                  placeholder="e.g. Gift packaging requested. Double wrap photo mugs with bubble sheet."
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  className="h-16 text-xs resize-none"
                />
              </div>

              {/* WhatsApp Automation & Buttons Toggle */}
              <div className="p-3.5 rounded-xl bg-card border border-border space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                      <MessageSquare className="h-4 w-4" />
                    </div>
                    <div>
                      <h5 className="font-semibold text-xs text-foreground">
                        Dispatch Real-time WhatsApp Notification
                      </h5>
                      <p className="text-[10px] text-muted-foreground">
                        Sends interactive buttons message directly to customer&apos;s WhatsApp
                      </p>
                    </div>
                  </div>
                  <Switch checked={sendWhatsAppAuto} onCheckedChange={setSendWhatsAppAuto} />
                </div>

                {sendWhatsAppAuto && (
                  <div className="pt-2 border-t border-border/60 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <span className="text-muted-foreground">Buttons Dispatched:</span>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="text-[10px] h-5 bg-primary/5 text-primary border-primary/30">
                        💳 Pay Online
                      </Badge>
                      <Badge variant="outline" className="text-[10px] h-5 bg-emerald-500/5 text-emerald-600 border-emerald-500/30">
                        ✅ Confirm Address
                      </Badge>
                      <Badge variant="outline" className="text-[10px] h-5 bg-sky-500/5 text-sky-600 border-sky-500/30">
                        📦 Track Order
                      </Badge>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Action Execution Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <div className="text-xs text-muted-foreground">
              Total Order Value: <strong className="text-foreground font-mono text-sm">{formatIndianCurrency(totalAmount)}</strong>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={resetForm}
                className="flex-1 sm:flex-none text-xs h-9"
              >
                Clear
              </Button>
              <Button
                type="button"
                onClick={handleCreateOrder}
                disabled={submitting}
                className="flex-1 sm:flex-none bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-700 hover:from-indigo-500 hover:to-violet-600 text-white font-semibold text-xs h-9 gap-2 shadow-md"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Creating Order...
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    Create Order &amp; Dispatch WhatsApp
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Ultra-Rich Live Multi-Preview Workspace (5 Cols) */}
        <div className="xl:col-span-5 space-y-4 sticky top-6">
          <Card className="border shadow-lg overflow-hidden bg-card/60 backdrop-blur-sm">
            <CardHeader className="p-3 bg-muted/40 border-b border-border/80">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                    Live Reactive Previews
                  </span>
                </div>
                <Badge variant="outline" className="text-[9px] text-muted-foreground bg-background">
                  Keystroke Synced
                </Badge>
              </div>

              {/* Tabs Switcher for Previews */}
              <Tabs
                value={previewTab}
                onValueChange={(val) => setPreviewTab(val as typeof previewTab)}
                className="w-full mt-2"
              >
                <TabsList className="grid grid-cols-4 h-8 p-0.5 gap-0.5 bg-muted">
                  <TabsTrigger value="whatsapp" className="text-[11px] gap-1 px-1 py-1">
                    <MessageSquare className="h-3 w-3 text-emerald-500" />
                    WhatsApp
                  </TabsTrigger>
                  <TabsTrigger value="checkout" className="text-[11px] gap-1 px-1 py-1">
                    <CreditCard className="h-3 w-3 text-sky-500" />
                    Checkout
                  </TabsTrigger>
                  <TabsTrigger value="invoice" className="text-[11px] gap-1 px-1 py-1">
                    <FileText className="h-3 w-3 text-amber-500" />
                    Invoice
                  </TabsTrigger>
                  <TabsTrigger value="upi" className="text-[11px] gap-1 px-1 py-1">
                    <QrCode className="h-3 w-3 text-violet-500" />
                    UPI QR
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>

            <CardContent className="p-4 bg-background/50 flex flex-col items-center justify-center min-h-[580px]">
              {previewTab === "whatsapp" && (
                <WhatsAppChatPreview
                  customerName={customerName || "Customer Name"}
                  customerPhone={customerPhone || "9876543210"}
                  orderNumber={previewOrderNumber}
                  items={items}
                  subtotal={subtotal}
                  shippingFee={shippingFee}
                  discountAmount={discountAmount}
                  taxAmount={taxAmount}
                  totalAmount={totalAmount}
                  paymentMethod={paymentMethod}
                  shippingAddress={{
                    street: street || "Flat / House Address",
                    landmark: landmark || undefined,
                    city: city || "New Delhi",
                    state: state || "Delhi",
                    pincode: pincode || "110001",
                  }}
                  paymentLinkUrl="https://wacrm.app/pay/checkout?ord=ORD-PREVIEW"
                  storeName="Pratap Store"
                />
              )}

              {previewTab === "checkout" && (
                <WebCheckoutPreview
                  customerName={customerName || "Customer Name"}
                  customerPhone={customerPhone || "9876543210"}
                  orderNumber={previewOrderNumber}
                  items={items}
                  subtotal={subtotal}
                  shippingFee={shippingFee}
                  discountAmount={discountAmount}
                  taxAmount={taxAmount}
                  totalAmount={totalAmount}
                  paymentMethod={paymentMethod}
                  shippingAddress={{
                    street: street || "Flat / House Address",
                    landmark: landmark || undefined,
                    city: city || "New Delhi",
                    state: state || "Delhi",
                    pincode: pincode || "110001",
                  }}
                  storeName="Pratap Store"
                />
              )}

              {previewTab === "invoice" && (
                <div className="w-full max-h-[600px] overflow-y-auto pr-1">
                  <InvoicePreview
                    orderNumber={previewOrderNumber}
                    customerName={customerName || "Customer Name"}
                    customerPhone={customerPhone || "+91 98765 43210"}
                    customerEmail={customerEmail || undefined}
                    items={items}
                    subtotal={subtotal}
                    shippingFee={shippingFee}
                    discountAmount={discountAmount}
                    taxAmount={taxAmount}
                    totalAmount={totalAmount}
                    paymentMethod={paymentMethod}
                    paymentStatus="pending"
                    shippingAddress={{
                      street: street || "Flat / Street Address",
                      landmark: landmark || undefined,
                      city: city || "New Delhi",
                      state: state || "Delhi",
                      pincode: pincode || "110001",
                    }}
                    sellerName="Pratap Store Pvt Ltd"
                    sellerGstin="07AAACP1928F1Z4"
                  />
                </div>
              )}

              {previewTab === "upi" && (
                <div className="w-full">
                  <UpiQrPreview
                    amount={totalAmount}
                    orderNumber={previewOrderNumber}
                    customerName={customerName || "Valued Customer"}
                    upiId={upiId}
                    storeName="Pratap Store"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Catalog Picker Dialog */}
      <Dialog open={catalogModalOpen} onOpenChange={setCatalogModalOpen}>
        <DialogContent className="!w-[95vw] !max-w-2xl sm:!max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-primary" />
              Select Products from Catalog
            </DialogTitle>
            <DialogDescription className="text-xs">
              Click any product to instantly add it to your order collection items
            </DialogDescription>
          </DialogHeader>

          {loadingCatalog ? (
            <div className="py-12 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
              <RefreshCw className="h-5 w-5 animate-spin" />
              Loading product catalog...
            </div>
          ) : catalogProducts.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No products found in catalog.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {catalogProducts.map((p) => (
                <div
                  key={p.id}
                  className="p-3 rounded-xl border border-border bg-card hover:border-primary/50 transition-all flex flex-col justify-between gap-2 shadow-xs group"
                >
                  <div className="flex gap-2.5 items-start">
                    {p.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.image_url}
                        alt={p.name}
                        className="w-14 h-14 rounded-lg object-cover border shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                        <ShoppingBag className="h-5 w-5" />
                      </div>
                    )}
                    <div className="leading-tight">
                      <p className="font-semibold text-xs text-foreground line-clamp-1">{p.name}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">
                        {p.description || p.category}
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-primary">₹{p.price}</span>
                        {p.compare_at_price && (
                          <span className="font-mono text-[10px] line-through text-muted-foreground">
                            ₹{p.compare_at_price}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    onClick={() => addCatalogProduct(p)}
                    className="w-full h-7 text-xs bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground font-medium transition-colors"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add to Order
                  </Button>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Post-Creation Success Celebration Dialog */}
      <Dialog open={successDialogOpen} onOpenChange={setSuccessDialogOpen}>
        <DialogContent className="!w-[95vw] !max-w-md sm:!max-w-md">
          <DialogHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mb-2 shadow-sm">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <DialogTitle className="text-lg">Order Created Successfully!</DialogTitle>
            <DialogDescription className="text-xs">
              Order #{createdOrder?.order_number} has been recorded into Pratap Store CRM.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2 text-xs">
            <div className="p-3 rounded-xl bg-muted/40 border border-border/80 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Customer:</span>
                <span className="font-semibold text-foreground">{createdOrder?.customer_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mobile:</span>
                <span className="font-mono text-foreground">{createdOrder?.customer_phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount:</span>
                <span className="font-mono font-bold text-emerald-600">
                  {formatIndianCurrency(createdOrder?.total_amount || 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payment Mode:</span>
                <span className="uppercase font-medium text-foreground">
                  {createdOrder?.payment_method}
                </span>
              </div>
            </div>

            {createdOrder?.razorpay_payment_link_url && (
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Razorpay Payment Link:</Label>
                <div className="flex items-center gap-1.5">
                  <Input
                    readOnly
                    value={createdOrder.razorpay_payment_link_url}
                    className="h-8 text-xs font-mono select-all bg-muted/20"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (createdOrder?.razorpay_payment_link_url) {
                        navigator.clipboard.writeText(createdOrder.razorpay_payment_link_url);
                        setCopiedLink(true);
                        toast.success("Payment link copied!");
                        setTimeout(() => setCopiedLink(false), 2000);
                      }
                    }}
                    className="h-8 px-2.5 shrink-0"
                  >
                    {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
            )}

            <div className="pt-2 flex flex-col gap-2">
              <Button
                type="button"
                onClick={() => {
                  const phone = createdOrder?.customer_phone.replace(/\D/g, "");
                  const text = encodeURIComponent(
                    `Namaste ${createdOrder?.customer_name}! Your Order #${createdOrder?.order_number} for ₹${createdOrder?.total_amount} is confirmed. ${
                      createdOrder?.razorpay_payment_link_url ? `Pay securely: ${createdOrder.razorpay_payment_link_url}` : ""
                    }`
                  );
                  window.open(`https://wa.me/91${phone}?text=${text}`, "_blank");
                }}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white gap-2 h-9 text-xs font-medium"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Open WhatsApp Chat with Customer
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => setSuccessDialogOpen(false)}
                className="w-full h-8 text-xs"
              >
                Create Another Order
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* AI Customer Detail Auto-Extract Dialog */}
      <Dialog open={aiExtractOpen} onOpenChange={setAiExtractOpen}>
        <DialogContent className="!w-[95vw] !max-w-lg sm:!max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Bot className="h-4 w-4 text-violet-500" />
              1-Click AI WhatsApp Customer Detail Extractor
            </DialogTitle>
            <DialogDescription className="text-xs">
              Paste customer WhatsApp chat text or address — AI automatically extracts Name, Mobile, Address, PIN Code, City, Product &amp; Price!
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-1 text-xs">
            <div className="space-y-1.5">
              <Label className="text-xs">Paste WhatsApp Message / Chat Transcript:</Label>
              <Textarea
                placeholder="e.g. Namaste bhaiya, mera naam Rahul Verma hai, phone 9876543210. Delivery address: Flat 402, Royal Palms, Link Road Andheri West Mumbai, PIN: 400053. Mujhe 1 Magic Photo Mug chahiye price 399."
                value={aiRawText}
                onChange={(e) => setAiRawText(e.target.value)}
                className="h-28 text-xs resize-none"
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">Quick Example:</span>
              <button
                type="button"
                onClick={() =>
                  setAiRawText(
                    "Namaste, mera naam Amit Patel hai, phone 9825012345. Pata: B-204, Shivalik Residency, Satellite Ahmedabad Gujarat 380015. Mujhe 2 Acrylic Photo Keychain Spotify Code chahiye."
                  )
                }
                className="text-[10px] text-primary hover:underline"
              >
                Insert Sample Message
              </button>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAiExtractOpen(false)}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleAiExtract}
                disabled={aiExtracting}
                className="h-8 text-xs bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white gap-1.5 font-medium shadow-sm"
              >
                {aiExtracting ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Extracting Details...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-3.5 w-3.5" />
                    Extract &amp; Auto-Fill Form
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Send Customer Self-Collection Form Link Dialog */}
      <Dialog open={collectLinkOpen} onOpenChange={setCollectLinkOpen}>
        <DialogContent className="!w-[95vw] !max-w-md sm:!max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Link2 className="h-4 w-4 text-emerald-600" />
              Automated Customer Self-Collection Link
            </DialogTitle>
            <DialogDescription className="text-xs">
              Send this 1-tap link to the customer on WhatsApp so they can fill their delivery address directly from their phone!
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2 text-xs">
            <div className="p-3 rounded-xl bg-muted/40 border border-border/80 space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Customer Self-Collection URL:</Label>
              <div className="flex items-center gap-1.5">
                <Input
                  readOnly
                  value={`http://localhost:3000/collect?phone=${customerPhone}&product=${encodeURIComponent(
                    items[0]?.name || "Custom Item"
                  )}`}
                  className="h-8 text-xs font-mono bg-background select-all"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const url = `http://localhost:3000/collect?phone=${customerPhone}&product=${encodeURIComponent(
                      items[0]?.name || "Custom Item"
                    )}`;
                    navigator.clipboard.writeText(url);
                    setCopiedCollectUrl(true);
                    toast.success("Self-collection link copied!");
                    setTimeout(() => setCopiedCollectUrl(false), 2000);
                  }}
                  className="h-8 px-2.5 shrink-0"
                >
                  {copiedCollectUrl ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>

            <div className="p-2.5 bg-emerald-500/5 rounded-lg border border-emerald-500/20 text-[11px] text-slate-700 dark:text-slate-300">
              <p className="font-semibold text-emerald-600 mb-1">⚡ Fully Automated Process:</p>
              <p>1. Customer clicks the link on WhatsApp and enters their delivery address.</p>
              <p>2. Order is automatically created in Pratap Store CRM with 0 manual typing!</p>
              <p>3. WhatsApp receipt with Pay Online buttons is dispatched instantly.</p>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <Button
                type="button"
                onClick={() => {
                  const cleanPhone = customerPhone.replace(/\D/g, "");
                  const url = `http://localhost:3000/collect?phone=${cleanPhone}&product=${encodeURIComponent(
                    items[0]?.name || "Custom Item"
                  )}`;
                  const msg = encodeURIComponent(
                    `🙏 Namaste ${customerName || "ji"}! Pratap Store par order ke liye kripya niche diye gaye link par click karke apna delivery address enter karein:\n\n👉 ${url}\n\nAddress enter karte hi aapka parcel dispatch schedule ho jayega!`
                  );
                  window.open(`https://wa.me/91${cleanPhone}?text=${msg}`, "_blank");
                }}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white gap-2 h-9 text-xs font-medium"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Send Address Link via WhatsApp
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
