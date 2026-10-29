"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  OrderStatusBadge,
  PaymentStatusBadge,
  PaymentMethodBadge,
} from "./order-status-badge";
import {
  Copy,
  ExternalLink,
  MapPin,
  MessageSquare,
  Package,
  Printer,
  Send,
  Truck,
  User,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import type { Order, OrderStatus, PaymentStatus } from "@/types/orders";

interface OrderDetailsDrawerProps {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOrderUpdated: (updated: Order) => void;
  onOrderDeleted?: (orderId: string) => void;
}

export function OrderDetailsDrawer({
  order,
  open,
  onOpenChange,
  onOrderUpdated,
  onOrderDeleted,
}: OrderDetailsDrawerProps) {
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sendingWa, setSendingWa] = useState(false);

  // Status & tracking fields
  const [orderStatus, setOrderStatus] = useState<OrderStatus>(order?.order_status || "new");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(order?.payment_status || "pending");
  const [carrier, setCarrier] = useState(order?.tracking_carrier || "Delhivery");
  const [trackingNumber, setTrackingNumber] = useState(order?.tracking_number || "");
  const [trackingUrl, setTrackingUrl] = useState(order?.tracking_url || "");

  if (!order) return null;

  const addr = order.shipping_address;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  const handleUpdateStatus = async () => {
    setUpdating(true);
    try {
      const payload: Record<string, unknown> = {
        order_status: orderStatus,
        payment_status: paymentStatus,
        tracking_carrier: carrier.trim() || undefined,
        tracking_number: trackingNumber.trim() || undefined,
        tracking_url: trackingUrl.trim() || undefined,
        send_whatsapp: true,
      };

      const res = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Update failed");
      }

      toast.success(
        `Order updated! ${data.whatsapp?.success ? "WhatsApp update sent to customer." : ""}`
      );
      onOrderUpdated(data.order);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUpdating(false);
    }
  };

  const handleSendWhatsApp = async (type: "created" | "paid" | "shipped" | "delivered") => {
    setSendingWa(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/send-whatsapp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to send WhatsApp message");
      }
      toast.success(`WhatsApp ${type} alert sent to ${order.customer_phone}!`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSendingWa(false);
    }
  };

  const handleSimulatePayment = async () => {
    setUpdating(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/pay-simulated`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Simulated payment failed");
      }
      toast.success("Payment marked as PAID! WhatsApp confirmation dispatched.");
      onOrderUpdated(data.order);
      setPaymentStatus("paid");
      setOrderStatus("confirmed");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUpdating(false);
    }
  };

  const openWhatsAppWeb = () => {
    const cleanPhone = order.customer_phone.replace(/\D/g, "");
    window.open(`https://wa.me/${cleanPhone}`, "_blank");
  };

  const printReceipt = () => {
    window.print();
  };

  const handleDeleteOrder = async () => {
    if (!confirm(`Are you sure you want to permanently delete order #${order.order_number}?`)) {
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete order");
      }
      toast.success(`Order #${order.order_number} deleted successfully!`);
      onOrderDeleted?.(order.id);
      onOpenChange(false);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl w-full overflow-y-auto space-y-6">
        <SheetHeader className="border-b pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-mono text-lg font-bold text-foreground">
                {order.order_number}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground"
                onClick={() => copyToClipboard(order.order_number, "Order number")}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <OrderStatusBadge status={order.order_status} />
              <PaymentStatusBadge status={order.payment_status} />
            </div>
          </div>
          <SheetDescription className="text-xs">
            Created on {new Date(order.created_at).toLocaleString()}
          </SheetDescription>
        </SheetHeader>

        {/* Action Toolbar */}
        <div className="flex flex-wrap gap-2 pb-2 border-b">
          <Button
            variant="outline"
            size="sm"
            onClick={openWhatsAppWeb}
            className="gap-1.5 text-xs text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Chat on WhatsApp
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleSendWhatsApp("created")}
            disabled={sendingWa}
            className="gap-1.5 text-xs text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/10"
          >
            <Send className="h-3.5 w-3.5" />
            Send Payment Link
          </Button>

          {order.payment_status === "pending" && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSimulatePayment}
              disabled={updating}
              className="gap-1.5 text-xs text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Test Pay
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={printReceipt}
            className="gap-1.5 text-xs"
          >
            <Printer className="h-3.5 w-3.5" />
            Print Receipt
          </Button>
        </div>

        {/* Prominent Payment Type & Instructions Card */}
        {order.payment_method === "cod" ? (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                💵 Cash on Delivery (COD)
              </span>
              <span className="font-mono font-extrabold text-sm text-amber-400">
                Collect: ₹{order.total_amount}
              </span>
            </div>
            <p className="text-[11px] text-amber-200/80">
              ⚠️ <strong>Instructions for Delivery / Dispatch:</strong> Collect ₹{order.total_amount} in cash upon handing over the package to the customer.
            </p>
          </div>
        ) : (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                💳 Prepaid Order (Razorpay / UPI)
              </span>
              <span className="font-mono font-extrabold text-sm text-emerald-400">
                Amount: ₹{order.total_amount}
              </span>
            </div>
            <p className="text-[11px] text-emerald-200/80">
              ✅ <strong>Instructions for Delivery / Dispatch:</strong> Do NOT collect any cash on delivery. Customer pays online via Razorpay. Payment status: <strong>{order.payment_status.toUpperCase()}</strong>.
            </p>
          </div>
        )}

        {/* Prominent Customer UTR & Manual Payment Verification Card */}
        {(() => {
          const utr =
            (order.metadata as any)?.utr ||
            order.notes?.match(/UTR:\s*([A-Za-z0-9]{8,20})/i)?.[1] ||
            (order.notes?.includes("UTR:") ? order.notes.split("UTR:")[1]?.trim()?.split(" ")[0]?.replace(/[|\]]/g, '') : null);

          return (
            <div className="p-4 rounded-xl border border-indigo-500/30 bg-indigo-500/5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-indigo-400" />
                  <span className="font-semibold text-xs text-foreground">
                    UPI Payment & UTR Verification
                  </span>
                </div>
                {order.payment_status === "paid" ? (
                  <span className="text-emerald-400 text-xs font-semibold flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Verified & Confirmed
                  </span>
                ) : (
                  <span className="text-amber-400 text-xs font-semibold flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" /> Awaiting Verification
                  </span>
                )}
              </div>

              {utr ? (
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                  <div>
                    <span className="text-[10px] text-muted-foreground block">CUSTOMER SUBMITTED UTR NUMBER</span>
                    <span className="font-mono text-sm font-bold text-indigo-300 tracking-wider">
                      {utr}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs border-slate-700 hover:bg-slate-800"
                    onClick={() => copyToClipboard(utr, "UTR Number")}
                  >
                    <Copy className="h-3 w-3 mr-1" /> Copy UTR
                  </Button>
                </div>
              ) : (
                <div className="p-2.5 rounded-lg bg-muted/40 border border-border text-xs text-muted-foreground">
                  No UTR number submitted yet. Customer was prompted in WhatsApp.
                </div>
              )}

              {order.payment_status !== "paid" && (
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    size="sm"
                    disabled={updating}
                    onClick={async () => {
                      setUpdating(true);
                      try {
                        const res = await fetch(`/api/orders/${order.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            payment_status: "paid",
                            order_status: "confirmed",
                            send_whatsapp: true,
                          }),
                        });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error || "Verification failed");
                        toast.success("Payment verified! Order confirmed & WhatsApp receipt sent to customer.");
                        setPaymentStatus("paid");
                        setOrderStatus("confirmed");
                        onOrderUpdated(data.order);
                      } catch (err) {
                        toast.error((err as Error).message);
                      } finally {
                        setUpdating(false);
                      }
                    }}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold h-8"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Verify & Confirm Payment
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    disabled={updating}
                    onClick={async () => {
                      if (!confirm("Are you sure you want to reject this payment and cancel the order?")) return;
                      setUpdating(true);
                      try {
                        const res = await fetch(`/api/orders/${order.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            payment_status: "failed",
                            order_status: "cancelled",
                            send_whatsapp: true,
                          }),
                        });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error || "Cancellation failed");
                        toast.success("Order cancelled & WhatsApp rejection alert sent.");
                        setPaymentStatus("failed");
                        setOrderStatus("cancelled");
                        onOrderUpdated(data.order);
                      } catch (err) {
                        toast.error((err as Error).message);
                      } finally {
                        setUpdating(false);
                      }
                    }}
                    className="border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs h-8"
                  >
                    Reject UTR
                  </Button>
                </div>
              )}
            </div>
          );
        })()}
        <div className="space-y-4 p-4 rounded-xl border bg-card/60">
          <div className="flex items-center justify-between text-xs font-semibold text-foreground border-b pb-2">
            <span className="flex items-center gap-1.5">
              <User className="h-4 w-4 text-indigo-400" />
              Customer Details
            </span>
            <span className="font-mono text-muted-foreground">{order.customer_phone}</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground block">Name</span>
              <span className="font-medium text-foreground">{order.customer_name}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Email</span>
              <span className="font-medium text-foreground">{order.customer_email || "N/A"}</span>
            </div>
          </div>

          <div className="pt-2 border-t text-xs space-y-1">
            <span className="text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-emerald-400" />
              Shipping Address:
            </span>
            <p className="font-medium text-foreground">
              {addr.street || "No street specified"}
              {addr.landmark ? `, Near ${addr.landmark}` : ""}
            </p>
            <p className="text-muted-foreground">
              {addr.city}, {addr.state} - {addr.pincode}
            </p>
          </div>
        </div>

        {/* Razorpay Payment Details */}
        <div className="p-4 rounded-xl border bg-card/60 space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-foreground">
            <span>Razorpay Payment Link</span>
            {order.payment_status === "paid" ? (
              <span className="text-emerald-400 flex items-center gap-1 text-[11px]">
                <CheckCircle2 className="h-3 w-3" /> Paid
              </span>
            ) : (
              <span className="text-amber-400 flex items-center gap-1 text-[11px]">
                <AlertCircle className="h-3 w-3" /> Pending Payment
              </span>
            )}
          </div>

          {order.razorpay_payment_link_url ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={order.razorpay_payment_link_url}
                  className="font-mono text-xs h-8 bg-muted"
                />
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 shrink-0"
                  onClick={() =>
                    copyToClipboard(order.razorpay_payment_link_url!, "Payment link")
                  }
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <a
                  href={order.razorpay_payment_link_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>

              {order.razorpay_payment_id && (
                <p className="text-[11px] font-mono text-muted-foreground">
                  Transaction Ref: {order.razorpay_payment_id}
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No payment link generated.</p>
          )}
        </div>

        {/* Items Breakdown */}
        <div className="p-4 rounded-xl border bg-card/60 space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground border-b pb-2">
            <Package className="h-4 w-4 text-violet-400" />
            <span>Items Ordered ({order.items.length})</span>
          </div>

          <div className="divide-y text-xs">
            {order.items.map((item, idx) => (
              <div key={idx} className="py-2.5 flex items-center justify-between gap-3">
                <div>
                  <h5 className="font-medium text-foreground">{item.name}</h5>
                  <p className="text-[11px] text-muted-foreground">
                    {item.variant ? `Variant: ${item.variant} • ` : ""}
                    Qty: {item.quantity} × ₹{item.price}
                  </p>
                </div>
                <div className="font-mono font-semibold text-foreground">
                  ₹{item.subtotal || item.price * item.quantity}
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t text-xs space-y-1 text-muted-foreground">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="font-mono text-foreground">₹{order.subtotal}</span>
            </div>
            {order.discount_amount > 0 && (
              <div className="flex justify-between text-emerald-400">
                <span>Discount</span>
                <span className="font-mono">-₹{order.discount_amount}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Shipping</span>
              <span className="font-mono text-foreground">
                {order.shipping_fee > 0 ? `₹${order.shipping_fee}` : "FREE"}
              </span>
            </div>
            <div className="flex justify-between font-bold text-sm text-foreground pt-1 border-t">
              <span>Total</span>
              <span className="font-mono text-emerald-400">₹{order.total_amount}</span>
            </div>
          </div>
        </div>

        {/* Order Status & Tracking Manager */}
        <div className="p-4 rounded-xl border bg-card/60 space-y-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Truck className="h-4 w-4 text-amber-400" />
            <span>Update Order Status & Dispatch Tracking</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Order Status</Label>
              <Select
                value={orderStatus}
                onValueChange={(val) => setOrderStatus(val as OrderStatus)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="shipped">Shipped</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Payment Status</Label>
              <Select
                value={paymentStatus}
                onValueChange={(val) => setPaymentStatus(val as PaymentStatus)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="refunded">Refunded</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Always show Dispatch Tracking so merchant can enter courier partner & AWB tracking anytime */}
          <div className="pt-2 border-t space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Truck className="h-3.5 w-3.5 text-amber-400" />
                Dispatch & Courier Tracking
              </Label>
              <span className="text-[10px] text-muted-foreground">Sent to customer on WhatsApp</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[11px] text-muted-foreground">Courier Partner</Label>
                <Input
                  className="h-8 text-xs"
                  placeholder="Delhivery / BlueDart / DTDC"
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">AWB / Tracking Number</Label>
                <Input
                  className="h-8 text-xs font-mono"
                  placeholder="e.g. 1284910284"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Tracking URL (Optional)</Label>
              <Input
                className="h-8 text-xs"
                placeholder="https://delhivery.com/track/..."
                value={trackingUrl}
                onChange={(e) => setTrackingUrl(e.target.value)}
              />
            </div>
          </div>

          <Button
            className="w-full h-9 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs gap-1.5"
            onClick={handleUpdateStatus}
            disabled={updating || deleting}
          >
            <Truck className="h-3.5 w-3.5" />
            {updating ? "Saving..." : "Save Status & Trigger WhatsApp Alert"}
          </Button>

          <div className="pt-3 border-t flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Manage Order</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 border-red-500/20 gap-1.5 h-8"
              onClick={handleDeleteOrder}
              disabled={deleting}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {deleting ? "Deleting..." : "Delete Order"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
