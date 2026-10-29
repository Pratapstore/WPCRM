"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Package,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  Pencil,
  Trash2,
  Upload,
  Image as ImageIcon,
  Loader2,
  AlertTriangle,
  X,
  Send,
  Users,
  Zap,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { uploadAccountMedia, MEDIA_MAX_BYTES } from "@/lib/storage/upload-media";
import { SendProductDialog } from "./send-product-dialog";
import type { Product } from "@/types/orders";

export function ProductsView() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Dialog states
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Active product for edit / delete / send
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productToSend, setProductToSend] = useState<Product | null>(null);

  // Form states (shared for add & edit)
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Keychains");
  const [price, setPrice] = useState("");
  const [comparePrice, setComparePrice] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [sku, setSku] = useState("");
  const [inStock, setInStock] = useState(true);
  const [description, setDescription] = useState("");

  const addFileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/products");
      const data = await res.json();
      if (data.products) {
        setProducts(data.products);
      }
    } catch (err) {
      console.error("Error loading products:", err);
      toast.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const categories = Array.from(
    new Set(products.map((p) => p.category).filter(Boolean))
  );

  const filteredProducts = products.filter((p) => {
    if (categoryFilter !== "all" && p.category !== categoryFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.description && p.description.toLowerCase().includes(q)) ||
      (p.sku && p.sku.toLowerCase().includes(q))
    );
  });

  // Handle direct file upload
  const handleFileUpload = async (file: File) => {
    if (file.size > MEDIA_MAX_BYTES) {
      toast.error(
        `File too large. Max size is ${(MEDIA_MAX_BYTES / 1024 / 1024).toFixed(0)}MB`
      );
      return;
    }
    setUploadingImage(true);
    try {
      const { publicUrl } = await uploadAccountMedia("chat-media", file);
      setImageUrl(publicUrl);
      toast.success("Photo uploaded successfully!");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to upload image";
      toast.error(msg);
    } finally {
      setUploadingImage(false);
    }
  };

  const [sendDialogInitialTab, setSendDialogInitialTab] = useState<"contact" | "direct" | "bulk">("contact");

  // Multi-Product Selection State
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [selectedProductsForDialog, setSelectedProductsForDialog] = useState<Product[]>([]);

  const toggleProductSelection = (id: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectAllProducts = () => {
    const ids = filteredProducts.map((p) => p.id);
    setSelectedProductIds(ids);
    toast.success(`Selected all ${ids.length} products!`);
  };

  const clearProductSelection = () => {
    setSelectedProductIds([]);
  };

  const selectedProductsList = useMemo(() => {
    return products.filter((p) => selectedProductIds.includes(p.id));
  }, [products, selectedProductIds]);

  // Open Send Dialog supporting single or multiple products
  const openSendDialog = (
    p?: Product | null,
    tab: "contact" | "direct" | "bulk" = "contact",
    customProds?: Product[]
  ) => {
    if (customProds && customProds.length > 0) {
      setSelectedProductsForDialog(customProds);
      setProductToSend(customProds[0]);
    } else if (p) {
      setSelectedProductsForDialog([p]);
      setProductToSend(p);
    } else if (selectedProductsList.length > 0) {
      setSelectedProductsForDialog(selectedProductsList);
      setProductToSend(selectedProductsList[0]);
    } else if (products.length > 0) {
      setSelectedProductsForDialog([products[0]]);
      setProductToSend(products[0]);
    }
    setSendDialogInitialTab(tab);
    setSendDialogOpen(true);
  };

  // Open Edit Dialog prefilled
  const openEditDialog = (p: Product) => {
    setSelectedProduct(p);
    setName(p.name);
    setCategory(p.category || "General");
    setPrice(String(p.price));
    setComparePrice(p.compare_at_price ? String(p.compare_at_price) : "");
    setImageUrl(p.image_url || "");
    setSku(p.sku || "");
    setInStock(p.in_stock);
    setDescription(p.description || "");
    setEditDialogOpen(true);
  };

  // Open Delete Dialog
  const openDeleteDialog = (p: Product) => {
    setSelectedProduct(p);
    setDeleteDialogOpen(true);
  };

  // Handle Create Product
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Product name is required");
      return;
    }
    const numPrice = Number(price);
    if (isNaN(numPrice) || numPrice < 0) {
      toast.error("Please enter a valid selling price");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        category: category.trim() || "General",
        price: numPrice,
        compare_at_price: comparePrice ? Number(comparePrice) : null,
        image_url: imageUrl.trim() || null,
        sku: sku.trim() || null,
        description: description.trim() || null,
        in_stock: inStock,
      };

      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create product");
      }

      toast.success("Product added to catalog!");
      setProducts((prev) => [data.product, ...prev]);
      setAddDialogOpen(false);
      resetForm();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Update Product
  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    if (!name.trim()) {
      toast.error("Product name is required");
      return;
    }
    const numPrice = Number(price);
    if (isNaN(numPrice) || numPrice < 0) {
      toast.error("Please enter a valid price");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        id: selectedProduct.id,
        name: name.trim(),
        category: category.trim() || "General",
        price: numPrice,
        compare_at_price: comparePrice ? Number(comparePrice) : null,
        image_url: imageUrl.trim() || null,
        sku: sku.trim() || null,
        description: description.trim() || null,
        in_stock: inStock,
      };

      const res = await fetch(`/api/products/${selectedProduct.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update product");
      }

      toast.success(`Product "${data.product.name}" updated!`);
      setProducts((prev) =>
        prev.map((item) => (item.id === selectedProduct.id ? data.product : item))
      );
      setEditDialogOpen(false);
      setSelectedProduct(null);
      resetForm();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Delete Product
  const handleDeleteProduct = async () => {
    if (!selectedProduct) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/products/${selectedProduct.id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete product");
      }

      toast.success(`Product "${selectedProduct.name}" deleted!`);
      setProducts((prev) => prev.filter((p) => p.id !== selectedProduct.id));
      setDeleteDialogOpen(false);
      setSelectedProduct(null);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  // Quick toggle in_stock status
  const handleToggleStock = async (p: Product, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextStatus = !p.in_stock;

    try {
      const res = await fetch(`/api/products/${p.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ in_stock: nextStatus }),
      });

      if (!res.ok) {
        throw new Error("Failed to update stock status");
      }

      setProducts((prev) =>
        prev.map((item) =>
          item.id === p.id ? { ...item, in_stock: nextStatus } : item
        )
      );
      toast.success(
        nextStatus
          ? `"${p.name}" marked as In Stock`
          : `"${p.name}" marked as Out of Stock`
      );
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const resetForm = () => {
    setName("");
    setCategory("Keychains");
    setPrice("");
    setComparePrice("");
    setImageUrl("");
    setSku("");
    setInStock(true);
    setDescription("");
  };

  return (
    <div className="space-y-6">
      {/* Search and Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products by name or SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={fetchProducts}
            disabled={loading}
            className="h-9 w-9 shrink-0"
            title="Refresh Catalog"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => {
              if (selectedProductIds.length > 0) {
                openSendDialog(null, "bulk", selectedProductsList);
              } else if (products.length > 0) {
                openSendDialog(products[0], "bulk");
              } else {
                toast.error("No products available in catalog to send");
              }
            }}
            className="bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 h-9 font-medium text-xs shadow-sm shadow-emerald-600/20"
          >
            <Users className="h-3.5 w-3.5" />
            {selectedProductIds.length > 1
              ? `🚀 Bulk Share (${selectedProductIds.length} Selected)`
              : "🚀 Bulk Share (1000 Numbers)"}
          </Button>

          <Button
            variant="outline"
            onClick={() => {
              if (selectedProductIds.length > 0) {
                openSendDialog(null, "contact", selectedProductsList);
              } else if (products.length > 0) {
                openSendDialog(products[0], "contact");
              } else {
                toast.error("No products available in catalog to send");
              }
            }}
            className="border-border text-foreground hover:bg-muted gap-1.5 h-9 font-medium text-xs"
          >
            <Send className="h-3.5 w-3.5 text-emerald-400" />
            {selectedProductIds.length > 1
              ? `Send Selected (${selectedProductIds.length})`
              : "Send 1-on-1"}
          </Button>

          <Button
            onClick={() => {
              resetForm();
              setAddDialogOpen(true);
            }}
            className="bg-indigo-600 hover:bg-indigo-500 text-white gap-1.5 h-9 font-medium"
          >
            <Plus className="h-4 w-4" />
            Add Product
          </Button>
        </div>
      </div>

      {/* Category Pills & Selection Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {categories.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCategoryFilter("all")}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                categoryFilter === "all"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              All ({products.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  categoryFilter === cat
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {cat} ({products.filter((p) => p.category === cat).length})
              </button>
            ))}
          </div>
        )}

        {/* Quick Select All / Clear Selection Button */}
        <div className="flex items-center gap-2 ml-auto">
          {selectedProductIds.length > 0 ? (
            <button
              type="button"
              onClick={clearProductSelection}
              className="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30 flex items-center gap-1 transition-colors"
            >
              <X className="h-3 w-3" />
              Deselect ({selectedProductIds.length})
            </button>
          ) : (
            <button
              type="button"
              onClick={selectAllProducts}
              className="px-2.5 py-1 rounded-full text-xs font-medium bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground border border-border flex items-center gap-1 transition-colors"
              title="Select all products for bulk WhatsApp share"
            >
              <Check className="h-3 w-3 text-emerald-400" />
              Select All ({filteredProducts.length})
            </button>
          )}
        </div>
      </div>

      {/* Products Grid */}
      {loading && products.length === 0 ? (
        <div className="py-20 text-center text-sm text-muted-foreground">
          Loading catalog...
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="py-20 text-center space-y-2 border rounded-xl bg-card">
          <Package className="h-10 w-10 text-muted-foreground mx-auto" />
          <p className="text-sm font-semibold text-foreground">No products found</p>
          <p className="text-xs text-muted-foreground">
            {search
              ? "Try searching for something else."
              : "Add products to start selling via WhatsApp."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredProducts.map((p) => {
            const isSelected = selectedProductIds.includes(p.id);
            return (
              <Card
                key={p.id}
                onClick={() => toggleProductSelection(p.id)}
                className={cn(
                  "overflow-hidden border shadow-sm flex flex-col justify-between group transition-all duration-200 bg-card cursor-pointer relative",
                  isSelected
                    ? "border-emerald-500 ring-2 ring-emerald-500/50 bg-emerald-500/[0.03] shadow-lg shadow-emerald-500/10"
                    : "hover:border-primary/50 hover:shadow-md"
                )}
              >
                {/* Product Image & Badges */}
                <div className="relative aspect-[4/3] bg-muted overflow-hidden">
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.image_url}
                      alt={p.name}
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                      <Package className="h-10 w-10" />
                    </div>
                  )}

                  {/* Multi-Select Checkbox & Category */}
                  <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleProductSelection(p.id);
                      }}
                      className={cn(
                        "h-7 w-7 rounded-lg flex items-center justify-center transition-all duration-150 backdrop-blur-md shadow-sm border",
                        isSelected
                          ? "bg-emerald-600 text-white border-emerald-500 scale-105 shadow-emerald-600/30 font-bold"
                          : "bg-background/85 hover:bg-background text-transparent hover:text-muted-foreground border-border/80 hover:scale-105"
                      )}
                      title={isSelected ? "Deselect Product" : "Select Product for Multi-Share"}
                    >
                      <Check
                        className={cn(
                          "h-4 w-4 stroke-[3] transition-opacity",
                          isSelected ? "text-white opacity-100" : "opacity-0 group-hover:opacity-70 text-foreground"
                        )}
                      />
                    </button>

                    <Badge
                      variant="outline"
                      className={cn(
                        "backdrop-blur-md text-[11px] font-medium border-border/80 transition-colors",
                        isSelected
                          ? "bg-emerald-600 text-white border-emerald-500 font-semibold shadow-sm"
                          : "bg-background/85"
                      )}
                    >
                      {isSelected ? "✓ Selected" : p.category}
                    </Badge>
                  </div>

                  {/* Quick Edit & Delete Hover Actions */}
                  <div
                    className="absolute top-2 right-2 flex items-center gap-1.5 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      type="button"
                      size="icon"
                      variant="secondary"
                      className="h-7 w-7 rounded-lg bg-emerald-600/90 hover:bg-emerald-500 text-white shadow-sm"
                      title="Send Product to WhatsApp"
                      onClick={() => {
                        if (isSelected && selectedProductIds.length > 1) {
                          openSendDialog(null, "contact", selectedProductsList);
                        } else {
                          openSendDialog(p, "contact");
                        }
                      }}
                    >
                      <Send className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="secondary"
                      className="h-7 w-7 rounded-lg bg-background/90 backdrop-blur-md text-foreground hover:bg-background hover:text-primary shadow-sm"
                      title="Edit Product"
                      onClick={() => openEditDialog(p)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="secondary"
                      className="h-7 w-7 rounded-lg bg-background/90 backdrop-blur-md text-red-500 hover:bg-red-500/20 hover:text-red-400 shadow-sm"
                      title="Delete Product"
                      onClick={() => openDeleteDialog(p)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Title & Description */}
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle
                      className="text-sm font-semibold line-clamp-1 text-foreground hover:text-primary transition-colors cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditDialog(p);
                      }}
                      title={p.name}
                    >
                      {p.name}
                    </CardTitle>
                  </div>
                  {p.description && (
                    <CardDescription className="text-xs line-clamp-2 mt-1">
                      {p.description}
                    </CardDescription>
                  )}
                  {p.sku && (
                    <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
                      SKU: {p.sku}
                    </div>
                  )}
                </CardHeader>

                {/* Price & Stock Status */}
                <CardContent className="p-4 pt-0">
                  <div className="flex items-center justify-between pt-2.5 border-t mt-2">
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-mono text-base font-bold text-foreground">
                        ₹{p.price}
                      </span>
                      {p.compare_at_price && p.compare_at_price > p.price && (
                        <span className="font-mono text-xs line-through text-muted-foreground">
                          ₹{p.compare_at_price}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleToggleStock(p, e)}
                      className={`flex items-center gap-1 text-[11px] font-medium transition-colors hover:underline ${
                        p.in_stock
                          ? "text-emerald-400 hover:text-emerald-300"
                          : "text-amber-400 hover:text-amber-300"
                      }`}
                      title="Click to toggle stock status"
                    >
                      {p.in_stock ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>In Stock</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-3.5 w-3.5" />
                          <span>Out of Stock</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Card footer buttons for easy mobile/desktop access */}
                  <div
                    className="mt-3 pt-2.5 border-t space-y-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="grid grid-cols-2 gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white gap-1 shadow-sm shadow-emerald-600/20"
                        onClick={() => {
                          if (isSelected && selectedProductIds.length > 1) {
                            openSendDialog(null, "contact", selectedProductsList);
                          } else {
                            openSendDialog(p, "contact");
                          }
                        }}
                      >
                        <Send className="h-3 w-3" />
                        {isSelected && selectedProductIds.length > 1
                          ? `Send (${selectedProductIds.length})`
                          : "Send 1-on-1"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs font-semibold border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 gap-1"
                        onClick={() => {
                          if (isSelected && selectedProductIds.length > 1) {
                            openSendDialog(null, "bulk", selectedProductsList);
                          } else {
                            openSendDialog(p, "bulk");
                          }
                        }}
                      >
                        <Users className="h-3 w-3" />
                        {isSelected && selectedProductIds.length > 1
                          ? `Blast (${selectedProductIds.length})`
                          : "🚀 1000 Blast"}
                      </Button>
                    </div>

                  <div className="flex items-center justify-between gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs flex-1 gap-1"
                      onClick={() => openEditDialog(p)}
                    >
                      <Pencil className="h-3 w-3" />
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 px-2.5"
                      onClick={() => openDeleteDialog(p)}
                      title="Delete product"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}

      {/* ============================================================ */}
      {/* Edit Product Dialog */}
      {/* ============================================================ */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="!w-[95vw] !max-w-xl sm:!max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4 text-primary" />
              Edit Product
            </DialogTitle>
            <DialogDescription>
              Update product details, pricing, photo, and inventory.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpdateProduct} className="space-y-4 pt-2">
            <div>
              <Label htmlFor="edit_p_name" className="text-xs">
                Product Name *
              </Label>
              <Input
                id="edit_p_name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Personalized Spotify Keychain"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="edit_p_cat" className="text-xs">
                  Category
                </Label>
                <Input
                  id="edit_p_cat"
                  placeholder="Keychains, Mugs, T-Shirts..."
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="edit_p_sku" className="text-xs">
                  SKU (Optional)
                </Label>
                <Input
                  id="edit_p_sku"
                  placeholder="e.g. KC-ACR-01"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="edit_p_price" className="text-xs">
                  Selling Price (₹) *
                </Label>
                <Input
                  id="edit_p_price"
                  type="number"
                  placeholder="249"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  min={0}
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit_p_compare" className="text-xs">
                  MRP / Compare Price (₹)
                </Label>
                <Input
                  id="edit_p_compare"
                  type="number"
                  placeholder="399"
                  value={comparePrice}
                  onChange={(e) => setComparePrice(e.target.value)}
                  min={0}
                />
              </div>
            </div>

            {/* Photo / Image Section with Direct Upload & URL */}
            <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
              <Label className="text-xs font-semibold flex items-center justify-between">
                <span>Product Photo / Image</span>
                {imageUrl && (
                  <button
                    type="button"
                    onClick={() => setImageUrl("")}
                    className="text-[11px] text-red-400 hover:text-red-300 flex items-center gap-1"
                  >
                    <X className="h-3 w-3" /> Remove Photo
                  </button>
                )}
              </Label>

              {imageUrl ? (
                <div className="relative aspect-video w-full max-h-44 rounded-md overflow-hidden bg-background border flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageUrl}
                    alt="Preview"
                    className="h-full w-full object-contain"
                  />
                </div>
              ) : (
                <div className="border border-dashed border-border rounded-md p-4 text-center text-muted-foreground bg-card">
                  <ImageIcon className="h-8 w-8 mx-auto mb-1 opacity-50" />
                  <p className="text-xs">No image selected</p>
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => editFileInputRef.current?.click()}
                  disabled={uploadingImage}
                  className="text-xs gap-1.5 h-8 shrink-0"
                >
                  {uploadingImage ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-3.5 w-3.5" />
                      Upload from Device
                    </>
                  )}
                </Button>
                <Input
                  placeholder="Or paste image URL (https://...)"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="text-xs h-8 flex-1"
                />
              </div>

              <input
                ref={editFileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFileUpload(file);
                  e.target.value = "";
                }}
              />
            </div>

            {/* Inventory Status Toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20">
              <div>
                <Label htmlFor="edit_stock" className="text-xs font-medium cursor-pointer">
                  Availability / Stock Status
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  {inStock
                    ? "Product is active and customers can order it via WhatsApp."
                    : "Product is out of stock and cannot be ordered."}
                </p>
              </div>
              <Button
                type="button"
                variant={inStock ? "default" : "secondary"}
                size="sm"
                onClick={() => setInStock((v) => !v)}
                className={`h-7 text-xs ${
                  inStock ? "bg-emerald-600 hover:bg-emerald-500 text-white" : ""
                }`}
              >
                {inStock ? "In Stock" : "Out of Stock"}
              </Button>
            </div>

            {/* Description */}
            <div>
              <Label htmlFor="edit_p_desc" className="text-xs">
                Description
              </Label>
              <Textarea
                id="edit_p_desc"
                placeholder="Details, materials, print quality, size..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="h-20 resize-none text-xs"
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditDialogOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting || uploadingImage}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
              >
                {submitting ? "Saving Changes..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* Add Product Dialog */}
      {/* ============================================================ */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="!w-[95vw] !max-w-xl sm:!max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              Add Product to Catalog
            </DialogTitle>
            <DialogDescription>
              Create a new item for your WhatsApp Store catalog.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateProduct} className="space-y-4 pt-2">
            <div>
              <Label htmlFor="add_p_name" className="text-xs">
                Product Name *
              </Label>
              <Input
                id="add_p_name"
                placeholder="e.g. Personalized Spotify Keychain"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="add_p_cat" className="text-xs">
                  Category
                </Label>
                <Input
                  id="add_p_cat"
                  placeholder="Keychains, Mugs, etc."
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="add_p_sku" className="text-xs">
                  SKU (Optional)
                </Label>
                <Input
                  id="add_p_sku"
                  placeholder="e.g. KC-01"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="add_p_price" className="text-xs">
                  Selling Price (₹) *
                </Label>
                <Input
                  id="add_p_price"
                  type="number"
                  placeholder="249"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  min={0}
                  required
                />
              </div>
              <div>
                <Label htmlFor="add_p_compare" className="text-xs">
                  MRP / Compare Price (₹)
                </Label>
                <Input
                  id="add_p_compare"
                  type="number"
                  placeholder="399"
                  value={comparePrice}
                  onChange={(e) => setComparePrice(e.target.value)}
                  min={0}
                />
              </div>
            </div>

            {/* Photo Upload & Preview */}
            <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
              <Label className="text-xs font-semibold flex items-center justify-between">
                <span>Product Photo / Image</span>
                {imageUrl && (
                  <button
                    type="button"
                    onClick={() => setImageUrl("")}
                    className="text-[11px] text-red-400 hover:text-red-300 flex items-center gap-1"
                  >
                    <X className="h-3 w-3" /> Remove Photo
                  </button>
                )}
              </Label>

              {imageUrl && (
                <div className="relative aspect-video w-full max-h-40 rounded-md overflow-hidden bg-background border flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageUrl}
                    alt="Preview"
                    className="h-full w-full object-contain"
                  />
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addFileInputRef.current?.click()}
                  disabled={uploadingImage}
                  className="text-xs gap-1.5 h-8 shrink-0"
                >
                  {uploadingImage ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-3.5 w-3.5" />
                      Upload from Device
                    </>
                  )}
                </Button>
                <Input
                  placeholder="Or paste image URL (https://...)"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="text-xs h-8 flex-1"
                />
              </div>

              <input
                ref={addFileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFileUpload(file);
                  e.target.value = "";
                }}
              />
            </div>

            <div>
              <Label htmlFor="add_p_desc" className="text-xs">
                Description
              </Label>
              <Textarea
                id="add_p_desc"
                placeholder="Details, materials, print quality, size..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="h-16 resize-none text-xs"
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddDialogOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting || uploadingImage}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
              >
                {submitting ? "Adding..." : "Add Product"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* Delete Product Confirmation Dialog */}
      {/* ============================================================ */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="!w-[95vw] !max-w-md sm:!max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-500">
              <AlertTriangle className="h-5 w-5" />
              Delete Product?
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this product? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>

          {selectedProduct && (
            <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
              <div className="h-14 w-14 rounded-md overflow-hidden bg-muted shrink-0 flex items-center justify-center">
                {selectedProduct.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selectedProduct.image_url}
                    alt={selectedProduct.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Package className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm text-foreground truncate">
                  {selectedProduct.name}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                  <span className="font-mono font-medium text-foreground">
                    ₹{selectedProduct.price}
                  </span>
                  <span>•</span>
                  <span>{selectedProduct.category}</span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteProduct}
              disabled={submitting}
              className="bg-red-600 hover:bg-red-500 font-medium"
            >
              {submitting ? "Deleting..." : "Delete Product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* Floating Multi-Product Selection Action Bar */}
      {/* ============================================================ */}
      {selectedProductIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[94%] max-w-2xl bg-card/95 backdrop-blur-xl border-2 border-emerald-500/50 shadow-2xl shadow-emerald-500/25 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-5 duration-200">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm border border-emerald-500/30">
              {selectedProductIds.length}
            </div>
            <div>
              <p className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-1.5">
                <span>{selectedProductIds.length} Products Selected</span>
                <span className="text-[11px] font-mono text-emerald-400 font-bold">
                  (Combo: ₹{selectedProductsList.reduce((acc, p) => acc + Number(p.price || 0), 0)})
                </span>
              </p>
              <p className="text-[10px] text-muted-foreground hidden sm:block">
                Share these {selectedProductIds.length} products together in 1 WhatsApp message
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearProductSelection}
              className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => openSendDialog(null, "contact", selectedProductsList)}
              className="h-8 px-3 text-xs border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 font-semibold gap-1.5"
            >
              <Send className="h-3 w-3" />
              Send 1-on-1 ({selectedProductIds.length})
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={() => openSendDialog(null, "bulk", selectedProductsList)}
              className="h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold gap-1.5 shadow-md shadow-emerald-600/20"
            >
              <Users className="h-3 w-3" />
              🚀 Bulk Share ({selectedProductIds.length})
            </Button>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* Send Product via WhatsApp Dialog */}
      {/* ============================================================ */}
      <SendProductDialog
        open={sendDialogOpen}
        onOpenChange={setSendDialogOpen}
        product={productToSend}
        selectedProducts={selectedProductsForDialog}
        allProducts={products}
        initialTab={sendDialogInitialTab}
      />
    </div>
  );
}
