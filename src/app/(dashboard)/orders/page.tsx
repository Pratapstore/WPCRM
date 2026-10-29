import { Metadata } from "next";
import { OrdersView } from "@/components/orders/orders-view";
import { ShoppingBag } from "lucide-react";

export const metadata: Metadata = {
  title: "Orders & Payments | WhatsApp CRM",
  description:
    "Manage WhatsApp orders, Razorpay payment collections, shipping tracking, and customer receipts.",
};

export default function OrdersPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
            <ShoppingBag className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              WhatsApp Orders & Payments
            </h1>
            <p className="text-xs text-muted-foreground">
              Collect orders, generate automated Razorpay payment links, and dispatch real-time WhatsApp updates.
            </p>
          </div>
        </div>
      </div>

      <OrdersView />
    </div>
  );
}
