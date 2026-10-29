import { Metadata } from "next";
import { OrderCollectionFlow } from "@/components/orders/order-collection-flow";
import Link from "next/link";
import { ArrowLeft, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Order Collection Studio & Flow | WhatsApp CRM",
  description:
    "Pro-level WhatsApp Order Collection system with live interactive WhatsApp chat preview, Web Checkout preview, and GST Tax Invoice.",
};

export default function OrderFlowPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Back button and quick crumbs */}
      <div className="flex items-center justify-between pb-2 border-b">
        <div className="flex items-center gap-3">
          <Link href="/orders">
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Orders
            </Button>
          </Link>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
              <ShoppingBag className="h-4 w-4" />
            </div>
            <span className="text-sm font-semibold text-foreground">
              Order Collection Flow Studio
            </span>
          </div>
        </div>
      </div>

      <OrderCollectionFlow />
    </div>
  );
}
