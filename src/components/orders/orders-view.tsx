"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  OrderStatusBadge,
  PaymentStatusBadge,
  PaymentMethodBadge,
} from "./order-status-badge";
import { CreateOrderDialog } from "./create-order-dialog";
import { OrderDetailsDrawer } from "./order-details-drawer";
import { OrderCollectionFlow } from "./order-collection-flow";
import Link from "next/link";
import {
  Banknote,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  ExternalLink,
  IndianRupee,
  MessageSquare,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShoppingBag,
  Smartphone,
  Truck,
  Zap,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import type { Order } from "@/types/orders";

export function OrdersView() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"list" | "flow">("list");

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/orders");
      const data = await res.json();
      if (data.orders) {
        setOrders(data.orders);
      }
    } catch (err) {
      console.error("Error loading orders:", err);
      toast.error("Failed to load orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleOrderCreated = (newOrder: Order) => {
    setOrders((prev) => [newOrder, ...prev]);
    setSelectedOrder(newOrder);
    setDrawerOpen(true);
  };

  const handleOrderUpdated = (updatedOrder: Order) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o))
    );
    setSelectedOrder(updatedOrder);
  };

  const handleOrderDeleted = (deletedId: string) => {
    setOrders((prev) => prev.filter((o) => o.id !== deletedId));
    if (selectedOrder?.id === deletedId) {
      setSelectedOrder(null);
      setDrawerOpen(false);
    }
  };

  const handleDeleteOrder = async (orderId: string, orderNumber: string) => {
    if (!confirm(`Are you sure you want to delete order #${orderNumber}?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/orders/${orderId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete order");
      toast.success(`Order #${orderNumber} deleted`);
      handleOrderDeleted(orderId);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  // Filter orders based on active tab and search query
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      // Tab filter
      if (statusTab === "prepaid") {
        if (o.payment_method === "cod") return false;
      } else if (statusTab === "cod") {
        if (o.payment_method !== "cod") return false;
      } else if (statusTab === "pending") {
        if (o.payment_status !== "pending") return false;
      } else if (statusTab === "paid") {
        if (o.payment_status !== "paid") return false;
      } else if (statusTab !== "all") {
        if (o.order_status !== statusTab) return false;
      }

      // Search filter
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        o.order_number.toLowerCase().includes(q) ||
        o.customer_name.toLowerCase().includes(q) ||
        o.customer_phone.toLowerCase().includes(q) ||
        o.payment_method.toLowerCase().includes(q)
      );
    });
  }, [orders, statusTab, search]);

  // KPI Calculations
  const stats = useMemo(() => {
    const totalOrders = orders.length;

    // Prepaid calculations
    const prepaidOrders = orders.filter((o) => o.payment_method !== "cod");
    const prepaidPaid = prepaidOrders.filter((o) => o.payment_status === "paid");
    const prepaidRevenue = prepaidPaid.reduce((sum, o) => sum + Number(o.total_amount), 0);

    // COD calculations
    const codOrders = orders.filter((o) => o.payment_method === "cod");
    const codPendingValue = codOrders
      .filter((o) => o.payment_status !== "paid")
      .reduce((sum, o) => sum + Number(o.total_amount), 0);

    const pendingOrders = orders.filter((o) => o.payment_status === "pending");
    const shippedOrders = orders.filter((o) => o.order_status === "shipped");
    const deliveredOrders = orders.filter((o) => o.order_status === "delivered");

    return {
      totalOrders,
      prepaidCount: prepaidOrders.length,
      prepaidRevenue,
      codCount: codOrders.length,
      codPendingValue,
      pendingCount: pendingOrders.length,
      shippedCount: shippedOrders.length,
      deliveredCount: deliveredOrders.length,
    };
  }, [orders]);


  const copyPaymentLink = (link: string) => {
    navigator.clipboard.writeText(link);
    toast.success("Payment link copied to clipboard!");
  };

  return (
    <div className="space-y-6">
      {/* Top Mode Switcher between Orders List & Pro Flow */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-1.5 bg-muted/40 rounded-xl border border-border">
        <div className="flex items-center gap-1.5">
          <Button
            variant={viewMode === "list" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("list")}
            className={`h-8 text-xs gap-1.5 ${
              viewMode === "list"
                ? "bg-card text-foreground shadow-xs border border-border font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ShoppingBag className="h-3.5 w-3.5" />
            Orders &amp; Shipments ({orders.length})
          </Button>
          <Button
            variant={viewMode === "flow" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("flow")}
            className={`h-8 text-xs gap-1.5 ${
              viewMode === "flow"
                ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Zap className="h-3.5 w-3.5 text-amber-300" />
            ⚡ Pro Order Collection Flow
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/orders/flow">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[11px] gap-1 text-muted-foreground border-dashed hover:text-foreground"
            >
              <ExternalLink className="h-3 w-3" />
              Full Page Studio
            </Button>
          </Link>
        </div>
      </div>

      {viewMode === "flow" ? (
        <OrderCollectionFlow />
      ) : (
        <>
          {/* KPI Cards - Clear Distinction between Prepaid and COD */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Prepaid Revenue */}
        <Card className="bg-card border border-emerald-500/20 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-2 h-full bg-emerald-500" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
              <CreditCard className="h-4 w-4" />
              Prepaid Revenue (Online)
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <IndianRupee className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-emerald-400">
              ₹{stats.prepaidRevenue.toLocaleString("en-IN")}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.prepaidCount} prepaid orders (Razorpay/UPI)
            </p>
          </CardContent>
        </Card>

        {/* COD Amount */}
        <Card className="bg-card border border-amber-500/20 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-2 h-full bg-amber-500" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
              <Banknote className="h-4 w-4" />
              COD Pending (Cash)
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <IndianRupee className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-amber-400">
              ₹{stats.codPendingValue.toLocaleString("en-IN")}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.codCount} Cash on Delivery orders
            </p>
          </CardContent>
        </Card>

        {/* Total Orders */}
        <Card className="bg-card border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Total Orders
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <ShoppingBag className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{stats.totalOrders}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.pendingCount} pending payment
            </p>
          </CardContent>
        </Card>

        {/* Delivered / Dispatched */}
        <Card className="bg-card border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Dispatched / Delivered
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center">
              <Truck className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">
              {stats.shippedCount + stats.deliveredCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.deliveredCount} delivered, {stats.shippedCount} in-transit
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Control Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by order #, customer name, phone, prepaid, cod..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={fetchOrders}
            disabled={loading}
            className="h-9 w-9 shrink-0"
            title="Refresh Orders"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => setViewMode("flow")}
            className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-700 hover:from-indigo-500 hover:to-violet-600 text-white gap-1.5 h-9 text-xs shadow-sm font-medium"
          >
            <Zap className="h-3.5 w-3.5 text-amber-300" />
            ⚡ Launch Pro Flow
          </Button>

          <Button
            onClick={() => setCreateDialogOpen(true)}
            variant="outline"
            className="gap-1.5 h-9 text-xs"
          >
            <Plus className="h-4 w-4" />
            Quick Modal
          </Button>
        </div>
      </div>

      {/* Tabs Filter with dedicated PREPAID & COD tabs */}
      <Tabs value={statusTab} onValueChange={setStatusTab} className="w-full">
        <TabsList className="grid grid-cols-2 sm:grid-cols-7 h-auto p-1 gap-1">
          <TabsTrigger value="all" className="text-xs py-1.5">
            All ({orders.length})
          </TabsTrigger>
          <TabsTrigger value="prepaid" className="text-xs py-1.5 text-emerald-400 font-semibold">
            💳 Prepaid ({stats.prepaidCount})
          </TabsTrigger>
          <TabsTrigger value="cod" className="text-xs py-1.5 text-amber-400 font-semibold">
            💵 COD ({stats.codCount})
          </TabsTrigger>
          <TabsTrigger value="pending" className="text-xs py-1.5">
            Pending ({stats.pendingCount})
          </TabsTrigger>
          <TabsTrigger value="paid" className="text-xs py-1.5">
            Paid ({orders.filter((o) => o.payment_status === "paid").length})
          </TabsTrigger>
          <TabsTrigger value="shipped" className="text-xs py-1.5">
            Shipped ({stats.shippedCount})
          </TabsTrigger>
          <TabsTrigger value="delivered" className="text-xs py-1.5">
            Delivered ({stats.deliveredCount})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Orders Table */}
      <Card className="border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Amount & Type</TableHead>
              <TableHead>Payment Status</TableHead>
              <TableHead>Order Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground text-sm">
                  Loading orders...
                </TableCell>
              </TableRow>
            ) : filteredOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-40 text-center space-y-2">
                  <Package className="h-8 w-8 text-muted-foreground mx-auto" />
                  <p className="text-sm font-medium text-foreground">No orders found</p>
                  <p className="text-xs text-muted-foreground">
                    {search
                      ? "Try adjusting your search query."
                      : "Customer orders placed via WhatsApp or manual entry will appear here."}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              filteredOrders.map((order) => {
                const totalItemCount = order.items.reduce((s, it) => s + (it.quantity || 1), 0);
                const itemsSummary = order.items.map((it) => it.name).join(", ");

                return (
                  <TableRow
                    key={order.id}
                    className="cursor-pointer hover:bg-muted/40 transition-colors"
                    onClick={() => {
                      setSelectedOrder(order);
                      setDrawerOpen(true);
                    }}
                  >
                    {/* Order # and Date */}
                    <TableCell className="font-medium">
                      <div className="font-mono text-sm text-foreground">{order.order_number}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {new Date(order.created_at).toLocaleDateString("en-IN", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </TableCell>

                    {/* Customer */}
                    <TableCell>
                      <div className="font-medium text-sm text-foreground">{order.customer_name}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <MessageSquare className="h-3 w-3 text-emerald-400" />
                        <span className="font-mono">{order.customer_phone}</span>
                      </div>
                    </TableCell>

                    {/* Items */}
                    <TableCell className="max-w-[200px]">
                      <div className="text-xs font-medium text-foreground truncate" title={itemsSummary}>
                        {itemsSummary}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {totalItemCount} {totalItemCount === 1 ? "item" : "items"}
                      </div>
                    </TableCell>

                    {/* Amount & Clear Payment Method Badge (Prepaid vs COD) */}
                    <TableCell>
                      <div className="font-mono font-bold text-sm text-foreground">
                        ₹{order.total_amount}
                      </div>
                      <div className="mt-1">
                        <PaymentMethodBadge method={order.payment_method} />
                      </div>
                    </TableCell>

                    {/* Payment Status Badge */}
                    <TableCell>
                      <PaymentStatusBadge status={order.payment_status} />
                    </TableCell>

                    {/* Order Status Badge */}
                    <TableCell>
                      <OrderStatusBadge status={order.order_status} />
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        {order.razorpay_payment_link_url && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            title="Copy Razorpay Link"
                            onClick={() => copyPaymentLink(order.razorpay_payment_link_url!)}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs gap-1"
                          onClick={() => {
                            setSelectedOrder(order);
                            setDrawerOpen(true);
                          }}
                        >
                          View Details
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          title="Delete Order"
                          onClick={() => handleDeleteOrder(order.id, order.order_number)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>
      </>
      )}

      {/* Create Order Dialog */}
      <CreateOrderDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onOrderCreated={handleOrderCreated}
      />

      {/* Order Details Slide-Over Drawer */}
      <OrderDetailsDrawer
        order={selectedOrder}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onOrderUpdated={handleOrderUpdated}
        onOrderDeleted={handleOrderDeleted}
      />
    </div>
  );
}
