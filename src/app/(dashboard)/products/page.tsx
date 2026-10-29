import { Metadata } from "next";
import { ProductsView } from "@/components/products/products-view";
import { Package } from "lucide-react";

export const metadata: Metadata = {
  title: "Products Catalog | WhatsApp CRM",
  description: "Manage product catalog for WhatsApp Store orders and auto-replies.",
};

export default function ProductsPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-violet-500 to-indigo-500 text-white flex items-center justify-center shadow-md shadow-violet-500/20">
            <Package className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Products Catalog
            </h1>
            <p className="text-xs text-muted-foreground">
              Manage your store products, pricing, categories, and inventory for WhatsApp orders.
            </p>
          </div>
        </div>
      </div>

      <ProductsView />
    </div>
  );
}
