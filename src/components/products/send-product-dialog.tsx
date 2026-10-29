"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Send,
  MessageSquare,
  Sparkles,
  Phone,
  User,
  Search,
  ExternalLink,
  Copy,
  Check,
  CheckCheck,
  Package,
  ShoppingBag,
  Loader2,
  CheckCircle2,
  PhoneCall,
  Video,
  MoreVertical,
  ChevronLeft,
  Maximize2,
  Minimize2,
  Plus,
  Trash2,
  Edit3,
  RotateCcw,
  Type,
  Smile,
  SlidersHorizontal,
  Users,
  Upload,
  FileSpreadsheet,
  Play,
  Pause,
  StopCircle,
  Download,
  Zap,
  Clock,
  Flame,
  FileText,
  XCircle,
  X,
  CheckSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  formatProductWhatsAppMessage,
  formatMultiProductWhatsAppMessage,
  HEADLINE_PRESETS,
} from "@/lib/products/format-product-message";
import type { Product } from "@/types/orders";

interface ContactItem {
  id: string;
  name?: string | null;
  phone: string;
  email?: string | null;
}

export interface ActionButtonItem {
  id: string;
  title: string;
  actionType: "order" | "catalog" | "chat" | "custom";
}

export interface BulkRecipient {
  phone: string;
  name?: string;
  contactId?: string;
}

interface SendProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product | null;
  selectedProducts?: Product[];
  allProducts?: Product[];
  prefilledContact?: {
    id?: string;
    name?: string;
    phone?: string;
    conversationId?: string;
  } | null;
  initialTab?: "contact" | "direct" | "bulk";
  onSuccess?: () => void;
}

/**
 * Intelligent parser for bulk phone numbers (CSV, pasted newlines, commas, tab separated)
 * Auto-cleans, attaches Indian country code (+91) if 10-digit, and deduplicates.
 */
function parseBulkPhoneNumbers(rawInput: string): BulkRecipient[] {
  if (!rawInput.trim()) return [];

  const items = rawInput.split(/[\n,;\t]+/);
  const seen = new Set<string>();
  const results: BulkRecipient[] = [];

  for (const item of items) {
    const trimmed = item.trim();
    if (!trimmed) continue;

    let name: string | undefined;
    let phoneStr = trimmed;

    if (trimmed.includes(":")) {
      const parts = trimmed.split(":");
      name = parts[0]?.trim();
      phoneStr = parts.slice(1).join(":").trim();
    } else if (trimmed.includes("-") && trimmed.match(/^[a-zA-Z]/)) {
      const parts = trimmed.split("-");
      name = parts[0]?.trim();
      phoneStr = parts.slice(1).join("-").trim();
    }

    const digits = phoneStr.replace(/\D/g, "");
    if (!digits) continue;

    let cleanPhone = digits;
    if (digits.length === 10) {
      cleanPhone = `91${digits}`;
    } else if (digits.length === 11 && digits.startsWith("0")) {
      cleanPhone = `91${digits.slice(1)}`;
    }

    if (cleanPhone.length >= 10 && cleanPhone.length <= 15 && !seen.has(cleanPhone)) {
      seen.add(cleanPhone);
      results.push({ phone: cleanPhone, name });
    }
  }

  return results;
}

/**
 * Render WhatsApp formatted text (*bold*, _italic_, ~strike~, links, newlines)
 */
function renderWhatsAppFormattedText(rawText: string) {
  if (!rawText) return null;
  const lines = rawText.split("\n");

  return (
    <div className="space-y-1 text-zinc-100 text-xs leading-relaxed font-sans">
      {lines.map((line, lineIdx) => {
        if (!line.trim()) {
          return <div key={lineIdx} className="h-2" />;
        }

        const parts: React.ReactNode[] = [];
        const regex = /(\*[^*]+\*|_[^_]+_|~[^~]+~|https?:\/\/[^\s]+|www\.[^\s]+)/g;
        let lastIndex = 0;
        let match: RegExpExecArray | null;
        let partIdx = 0;

        while ((match = regex.exec(line)) !== null) {
          if (match.index > lastIndex) {
            parts.push(
              <span key={`${lineIdx}-${partIdx++}`}>
                {line.substring(lastIndex, match.index)}
              </span>
            );
          }

          const matchedStr = match[0];
          if (matchedStr.startsWith("*") && matchedStr.endsWith("*")) {
            parts.push(
              <strong key={`${lineIdx}-${partIdx++}`} className="font-bold text-white">
                {matchedStr.slice(1, -1)}
              </strong>
            );
          } else if (matchedStr.startsWith("_") && matchedStr.endsWith("_")) {
            parts.push(
              <em key={`${lineIdx}-${partIdx++}`} className="italic text-zinc-300">
                {matchedStr.slice(1, -1)}
              </em>
            );
          } else if (matchedStr.startsWith("~") && matchedStr.endsWith("~")) {
            parts.push(
              <del key={`${lineIdx}-${partIdx++}`} className="line-through text-zinc-400">
                {matchedStr.slice(1, -1)}
              </del>
            );
          } else if (matchedStr.startsWith("http") || matchedStr.startsWith("www.")) {
            parts.push(
              <span key={`${lineIdx}-${partIdx++}`} className="text-emerald-300 underline font-mono">
                {matchedStr}
              </span>
            );
          }

          lastIndex = regex.lastIndex;
        }

        if (lastIndex < line.length) {
          parts.push(
            <span key={`${lineIdx}-${partIdx++}`}>
              {line.substring(lastIndex)}
            </span>
          );
        }

        return (
          <p key={lineIdx} className="break-words">
            {parts.length > 0 ? parts : line}
          </p>
        );
      })}
    </div>
  );
}

export function SendProductDialog({
  open,
  onOpenChange,
  product: initialProduct = null,
  selectedProducts: initialSelectedProducts = [],
  allProducts = [],
  prefilledContact,
  initialTab = "contact",
  onSuccess,
}: SendProductDialogProps) {
  const [productsList, setProductsList] = useState<Product[]>(allProducts);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(initialProduct);
  const [selectedProductsState, setSelectedProductsState] = useState<Product[]>([]);
  const [isProductPickerOpen, setIsProductPickerOpen] = useState(false);
  const [productPickerFilter, setProductPickerFilter] = useState("");
  const [recipientTab, setRecipientTab] = useState<"contact" | "direct" | "bulk">(initialTab);

  // Contacts lookup
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const [selectedContact, setSelectedContact] = useState<ContactItem | null>(null);

  // Direct phone input
  const [directPhone, setDirectPhone] = useState("");
  const [customerName, setCustomerName] = useState("");

  // ============================================================
  // BULK 1000 BROADCAST STATE
  // ============================================================
  const [bulkSubTab, setBulkSubTab] = useState<"crm" | "paste" | "upload">("paste");
  const [bulkRawInput, setBulkRawInput] = useState<string>("");
  const [bulkDelayMs, setBulkDelayMs] = useState<number>(500);
  const [loadingAllContacts, setLoadingAllContacts] = useState<boolean>(false);

  // Bulk Progress Tracker Overlay State
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isBulkSending, setIsBulkSending] = useState(false);
  const [isBulkPaused, setIsBulkPaused] = useState(false);
  const [isBulkCancelled, setIsBulkCancelled] = useState(false);
  const [bulkStats, setBulkStats] = useState({
    total: 0,
    sent: 0,
    failed: 0,
    currentBatch: 0,
  });
  const [bulkLogs, setBulkLogs] = useState<
    Array<{ phone: string; name?: string; status: "sent" | "failed"; time: string; error?: string }>
  >([]);

  const bulkPausedRef = useRef(false);
  const bulkCancelledRef = useRef(false);

  // Template Mode vs Direct Custom Message Mode
  const [messageMode, setMessageMode] = useState<"template" | "custom">("template");
  const [customMessageText, setCustomMessageText] = useState("");
  const [isCustomDirty, setIsCustomDirty] = useState(false);

  // Template customizations
  const [headlineStyle, setHeadlineStyle] = useState<
    "deal_alert" | "special_offer" | "inquiry" | "festival_sale" | "custom"
  >("special_offer");
  const [customHeadline, setCustomHeadline] = useState("");
  const [customNote, setCustomNote] = useState("");
  const [includePerks, setIncludePerks] = useState(true);
  const [includeDiscount, setIncludeDiscount] = useState(true);

  // Action Buttons Customization
  const [includeButtons, setIncludeButtons] = useState(true);
  const [actionButtons, setActionButtons] = useState<ActionButtonItem[]>([
    { id: "order_product", title: "🛍️ Order Now", actionType: "order" },
    { id: "catalog_all", title: "📋 All Products", actionType: "catalog" },
    { id: "chat_support", title: "💬 Chat with Us", actionType: "chat" },
  ]);

  // Status
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Load products catalog if none passed
  useEffect(() => {
    if (!open) return;
    if (allProducts.length > 0) {
      setProductsList(allProducts);
    } else {
      void fetch("/api/products")
        .then((r) => r.json())
        .then((d) => {
          if (d.products && d.products.length > 0) {
            setProductsList(d.products);
          }
        })
        .catch((err) => console.error("Error fetching catalog for modal:", err));
    }
  }, [open, allProducts]);

  // Sync selected products when modal opens or selection props change
  useEffect(() => {
    if (!open) return;
    if (initialSelectedProducts && initialSelectedProducts.length > 0) {
      setSelectedProductsState(initialSelectedProducts);
      setSelectedProduct(initialSelectedProducts[0]);
    } else if (initialProduct) {
      setSelectedProductsState([initialProduct]);
      setSelectedProduct(initialProduct);
    } else if (allProducts.length > 0) {
      setSelectedProductsState([allProducts[0]]);
      setSelectedProduct(allProducts[0]);
    }
  }, [open, initialSelectedProducts, initialProduct, allProducts]);

  // Selection toggle helper
  const toggleProductInSelection = (prod: Product) => {
    setSelectedProductsState((prev) => {
      const exists = prev.some((p) => p.id === prod.id);
      if (exists) {
        if (prev.length <= 1) {
          toast.warning("At least 1 product must be selected to share.");
          return prev;
        }
        const next = prev.filter((p) => p.id !== prod.id);
        setSelectedProduct(next[0] || null);
        return next;
      } else {
        const next = [...prev, prod];
        if (!selectedProduct) setSelectedProduct(prod);
        return next;
      }
    });
  };

  const handleSelectAllProducts = () => {
    if (productsList.length > 0) {
      setSelectedProductsState(productsList);
      setSelectedProduct(productsList[0]);
      toast.success(`Selected all ${productsList.length} products!`);
    }
  };

  const handleClearSelectionToSingle = (prod?: Product) => {
    const target = prod || selectedProductsState[0] || productsList[0];
    if (target) {
      setSelectedProductsState([target]);
      setSelectedProduct(target);
    }
  };

  // Sync recipient tab when opening
  useEffect(() => {
    if (open && initialTab) {
      setRecipientTab(initialTab);
    }
  }, [open, initialTab]);

  // Sync action buttons when selected products change
  useEffect(() => {
    if (selectedProductsState.length > 1) {
      setActionButtons([
        {
          id: "order_selected_bundle",
          title: `🛍️ Order All (${selectedProductsState.length} Items)`,
          actionType: "order",
        },
        { id: "catalog_all", title: "📋 All Products", actionType: "catalog" },
        { id: "chat_support", title: "💬 Chat with Us", actionType: "chat" },
      ]);
    } else if (selectedProductsState.length === 1) {
      const p = selectedProductsState[0];
      setActionButtons([
        { id: `order_${p.id}`, title: "🛍️ Order Now", actionType: "order" },
        { id: "catalog_all", title: "📋 All Products", actionType: "catalog" },
        { id: "chat_support", title: "💬 Chat with Us", actionType: "chat" },
      ]);
    }
  }, [selectedProductsState.length]);

  // Handle prefilled contact
  useEffect(() => {
    if (prefilledContact) {
      if (prefilledContact.phone) {
        setDirectPhone(prefilledContact.phone);
      }
      if (prefilledContact.name) {
        setCustomerName(prefilledContact.name);
      }
      if (prefilledContact.id) {
        setSelectedContact({
          id: prefilledContact.id,
          name: prefilledContact.name,
          phone: prefilledContact.phone || "",
        });
      }
    }
  }, [prefilledContact]);

  // Load contacts list when dialog opens
  useEffect(() => {
    if (!open) return;
    let active = true;

    async function loadContacts() {
      setContactsLoading(true);
      try {
        const res = await fetch("/api/customers?limit=1000");
        const data = await res.json();
        if (active && data.contacts) {
          setContacts(data.contacts);
        }
      } catch (err) {
        console.error("Error loading contacts for product send:", err);
      } finally {
        if (active) setContactsLoading(false);
      }
    }

    void loadContacts();
    return () => {
      active = false;
    };
  }, [open]);

  // Filtered contacts list for single select
  const filteredContacts = useMemo(() => {
    if (!contactSearch.trim()) return contacts.slice(0, 8);
    const q = contactSearch.toLowerCase();
    return contacts.filter(
      (c) =>
        c.phone.toLowerCase().includes(q) ||
        (c.name && c.name.toLowerCase().includes(q))
    ).slice(0, 10);
  }, [contacts, contactSearch]);

  // Bulk recipients parsed automatically
  const parsedBulkRecipients = useMemo(() => {
    return parseBulkPhoneNumbers(bulkRawInput);
  }, [bulkRawInput]);

  // Generate live preview text from template options
  const previewText = useMemo(() => {
    if (selectedProductsState.length === 0) {
      if (!selectedProduct) return "";
      return formatProductWhatsAppMessage(selectedProduct, {
        headlineStyle,
        customHeadline,
        customNote,
        storeDomain: "www.pratapstore.in",
        storeName: "Pratap Store",
        includePerks,
        includeDiscount,
      });
    }

    if (selectedProductsState.length === 1) {
      return formatProductWhatsAppMessage(selectedProductsState[0], {
        headlineStyle,
        customHeadline,
        customNote,
        storeDomain: "www.pratapstore.in",
        storeName: "Pratap Store",
        includePerks,
        includeDiscount,
      });
    }

    return formatMultiProductWhatsAppMessage(selectedProductsState, {
      headlineStyle,
      customHeadline,
      customNote,
      storeDomain: "www.pratapstore.in",
      storeName: "Pratap Store",
      includePerks,
      includeDiscount,
    });
  }, [
    selectedProductsState,
    selectedProduct,
    headlineStyle,
    customHeadline,
    customNote,
    includePerks,
    includeDiscount,
  ]);

  // Auto-sync custom message text with template if user hasn't explicitly edited it
  useEffect(() => {
    if (!isCustomDirty && previewText) {
      setCustomMessageText(previewText);
    }
  }, [previewText, isCustomDirty]);

  // Effective message to display in preview and send
  const effectiveMessageText = useMemo(() => {
    if (messageMode === "custom") {
      return customMessageText;
    }
    return previewText;
  }, [messageMode, customMessageText, previewText]);

  // Target phone number resolution for single send
  const resolvedPhone = useMemo(() => {
    if (recipientTab === "bulk") {
      return `🚀 ${parsedBulkRecipients.length} Bulk WhatsApp Numbers`;
    }
    if (recipientTab === "contact" && selectedContact) {
      return selectedContact.phone;
    }
    return directPhone.trim();
  }, [recipientTab, selectedContact, directPhone, parsedBulkRecipients.length]);

  // Direct WhatsApp Web URL for fallback/manual sharing
  const waWebUrl = useMemo(() => {
    const cleanPhone =
      recipientTab === "bulk" && parsedBulkRecipients.length > 0
        ? parsedBulkRecipients[0].phone
        : resolvedPhone.replace(/\D/g, "");
    const primaryImg =
      selectedProductsState.find((p) => p.image_url)?.image_url ||
      selectedProduct?.image_url;
    const encoded = encodeURIComponent(
      primaryImg
        ? `${effectiveMessageText}\n\n📸 Photo: ${primaryImg}`
        : effectiveMessageText
    );
    return cleanPhone
      ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encoded}`
      : `https://api.whatsapp.com/send?text=${encoded}`;
  }, [
    selectedProductsState,
    selectedProduct,
    effectiveMessageText,
    resolvedPhone,
    recipientTab,
    parsedBulkRecipients,
  ]);

  // Copy formatted message
  const handleCopy = () => {
    if (!effectiveMessageText) return;
    navigator.clipboard.writeText(effectiveMessageText);
    setCopied(true);
    toast.success("WhatsApp message text copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  // Button handlers
  const handleUpdateButtonTitle = (index: number, title: string) => {
    setActionButtons((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], title: title.slice(0, 20) };
      return copy;
    });
  };

  const handleUpdateButtonAction = (
    index: number,
    actionType: ActionButtonItem["actionType"]
  ) => {
    setActionButtons((prev) => {
      const copy = [...prev];
      let id = copy[index].id;
      if (actionType === "order") id = `order_${selectedProduct?.id || "product"}`;
      else if (actionType === "catalog") id = "catalog_all";
      else if (actionType === "chat") id = "chat_support";
      else if (actionType === "custom") id = `btn_${Date.now()}`;
      copy[index] = { ...copy[index], actionType, id };
      return copy;
    });
  };

  const handleDeleteButton = (index: number) => {
    if (actionButtons.length <= 1) {
      toast.warning("WhatsApp interactive buttons require at least 1 button.");
      return;
    }
    setActionButtons((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddButton = (
    customTitle?: string,
    customAction?: ActionButtonItem["actionType"]
  ) => {
    if (actionButtons.length >= 3) {
      toast.warning("WhatsApp allows a maximum of 3 action buttons.");
      return;
    }
    const title = customTitle || "✨ View Details";
    const actionType = customAction || "catalog";
    const id =
      actionType === "order"
        ? `order_${selectedProduct?.id || "product"}`
        : actionType === "chat"
          ? "chat_support"
          : `btn_${Date.now()}`;

    setActionButtons((prev) => [
      ...prev,
      { id, title: title.slice(0, 20), actionType },
    ]);
  };

  const handleResetButtons = () => {
    if (selectedProduct) {
      setActionButtons([
        { id: `order_${selectedProduct.id}`, title: "🛍️ Order Now", actionType: "order" },
        { id: "catalog_all", title: "📋 All Products", actionType: "catalog" },
        { id: "chat_support", title: "💬 Chat with Us", actionType: "chat" },
      ]);
      toast.info("Action buttons reset to default");
    }
  };

  // Textarea helpers
  const insertTextAround = (prefix: string, suffix: string = prefix) => {
    const textarea = document.getElementById(
      "editable_msg_textarea"
    ) as HTMLTextAreaElement | null;
    if (!textarea) {
      setCustomMessageText((prev) => `${prev} ${prefix}text${suffix}`);
      setIsCustomDirty(true);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = customMessageText.substring(start, end);
    const replacement = selected ? `${prefix}${selected}${suffix}` : `${prefix}text${suffix}`;
    const nextVal =
      customMessageText.substring(0, start) + replacement + customMessageText.substring(end);
    setCustomMessageText(nextVal);
    setIsCustomDirty(true);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + prefix.length,
        start + replacement.length - suffix.length
      );
    }, 50);
  };

  const insertEmoji = (emoji: string) => {
    const textarea = document.getElementById(
      "editable_msg_textarea"
    ) as HTMLTextAreaElement | null;
    if (!textarea) {
      setCustomMessageText((prev) => `${prev} ${emoji}`);
      setIsCustomDirty(true);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const nextVal =
      customMessageText.substring(0, start) + emoji + customMessageText.substring(end);
    setCustomMessageText(nextVal);
    setIsCustomDirty(true);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + emoji.length, start + emoji.length);
    }, 50);
  };

  const handleResetCustomMessage = () => {
    setCustomMessageText(previewText);
    setIsCustomDirty(false);
    toast.info("Message reset to auto-generated product template");
  };

  // ============================================================
  // BULK RECIPIENTS HELPERS
  // ============================================================
  const handleLoadAllCrmContacts = async () => {
    setLoadingAllContacts(true);
    try {
      const res = await fetch("/api/customers?limit=1000");
      const data = await res.json();
      if (data.contacts && data.contacts.length > 0) {
        const contactLines = data.contacts
          .filter((c: ContactItem) => c.phone)
          .map((c: ContactItem) => (c.name ? `${c.name}: ${c.phone}` : c.phone))
          .join("\n");
        setBulkRawInput(contactLines);
        toast.success(`Loaded ${data.contacts.length} contacts from your CRM! 🚀`);
      } else {
        toast.info("No contacts found in CRM. You can paste numbers directly.");
      }
    } catch {
      toast.error("Failed to fetch CRM contacts");
    } finally {
      setLoadingAllContacts(false);
    }
  };

  const handleLoadSampleNumbers = (count: number = 100) => {
    const sampleList = Array.from({ length: count }, (_, i) => {
      const num = 9800000000 + i + 1;
      return `Customer ${i + 1}: ${num}`;
    }).join("\n");
    setBulkRawInput(sampleList);
    toast.success(`Loaded ${count} test phone numbers! 🚀`);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        const parsed = parseBulkPhoneNumbers(text);
        if (parsed.length > 0) {
          setBulkRawInput((prev) => (prev ? `${prev}\n${text}` : text));
          toast.success(`Imported ${parsed.length} numbers from ${file.name}!`);
        } else {
          toast.error("No valid phone numbers found in file");
        }
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleCopyAllBulkNumbers = () => {
    if (parsedBulkRecipients.length === 0) {
      toast.error("No phone numbers to copy");
      return;
    }
    const text = parsedBulkRecipients.map((r) => r.phone).join(", ");
    navigator.clipboard.writeText(text);
    toast.success(`Copied ${parsedBulkRecipients.length} numbers to clipboard!`);
  };

  // ============================================================
  // BULK 1000 SEND EXECUTION ENGINE
  // ============================================================
  const runBulkSend = async () => {
    if (parsedBulkRecipients.length === 0) {
      toast.error("Please add at least 1 phone number to send.");
      return;
    }

    if (!selectedProduct) {
      toast.error("Please select a product");
      return;
    }

    setIsBulkModalOpen(true);
    setIsBulkSending(true);
    setIsBulkPaused(false);
    setIsBulkCancelled(false);
    bulkPausedRef.current = false;
    bulkCancelledRef.current = false;

    setBulkStats({
      total: parsedBulkRecipients.length,
      sent: 0,
      failed: 0,
      currentBatch: 0,
    });
    setBulkLogs([]);

    const batchSize = 25;
    const delay = bulkDelayMs;
    const total = parsedBulkRecipients.length;
    let sentCount = 0;
    let failedCount = 0;

    for (let i = 0; i < total; i += batchSize) {
      if (bulkCancelledRef.current) {
        toast.info("Bulk send cancelled by user.");
        break;
      }

      while (bulkPausedRef.current && !bulkCancelledRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      const batch = parsedBulkRecipients.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;

      setBulkStats((prev) => ({
        ...prev,
        currentBatch: batchNum,
      }));

      try {
        const effectiveProd = selectedProduct || selectedProductsState[0];
        const payload = {
          productId: effectiveProd?.id,
          productIds: selectedProductsState.map((p) => p.id),
          recipients: batch,
          customMessage: effectiveMessageText.trim() || undefined,
          headlineStyle,
          customHeadline: headlineStyle === "custom" ? customHeadline : undefined,
          customNote: customNote.trim() || undefined,
          includeButtons,
          buttons: includeButtons
            ? actionButtons.map((b) => ({ id: b.id, title: b.title.slice(0, 20) }))
            : [],
          storeDomain: "www.pratapstore.in",
        };

        const res = await fetch("/api/products/send-bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json();

        if (res.ok && data.results) {
          const batchSent = data.results.filter((r: { status: string }) => r.status === "sent").length;
          const batchFailed = data.results.filter((r: { status: string }) => r.status === "failed").length;
          sentCount += batchSent;
          failedCount += batchFailed;

          const newLogs = data.results.map((r: { phone: string; name?: string; status: "sent" | "failed"; error?: string }) => ({
            phone: r.phone,
            name: r.name,
            status: r.status,
            time: new Date().toLocaleTimeString(),
            error: r.error,
          }));

          setBulkStats((prev) => ({
            ...prev,
            sent: sentCount,
            failed: failedCount,
          }));

          setBulkLogs((prev) => [...newLogs, ...prev].slice(0, 150));
        } else {
          failedCount += batch.length;
          setBulkStats((prev) => ({ ...prev, failed: failedCount }));
          setBulkLogs((prev) => [
            {
              phone: `Batch ${batchNum}`,
              status: "failed",
              time: new Date().toLocaleTimeString(),
              error: data.error || "Batch request failed",
            },
            ...prev,
          ]);
        }
      } catch (err) {
        failedCount += batch.length;
        setBulkStats((prev) => ({ ...prev, failed: failedCount }));
      }

      // Throttling delay between batches
      if (i + batchSize < total && delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    setIsBulkSending(false);
    toast.success(`Bulk broadcast completed! ${sentCount} sent, ${failedCount} failed.`);
    onSuccess?.();
  };

  const handleToggleBulkPause = () => {
    const nextState = !isBulkPaused;
    setIsBulkPaused(nextState);
    bulkPausedRef.current = nextState;
    toast.info(nextState ? "Campaign paused ⏸️" : "Campaign resumed ▶️");
  };

  const handleCancelBulk = () => {
    setIsBulkCancelled(true);
    bulkCancelledRef.current = true;
    setIsBulkSending(false);
  };

  const exportBulkReportCsv = () => {
    if (bulkLogs.length === 0) return;
    const header = "Phone,Name,Status,Time,Error\n";
    const rows = bulkLogs
      .map((l) => `"${l.phone}","${l.name || ""}","${l.status}","${l.time}","${l.error || ""}"`)
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `product-bulk-broadcast-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Single recipient Send message via API
  const handleSend = async () => {
    if (recipientTab === "bulk") {
      void runBulkSend();
      return;
    }

    const effectiveProd = selectedProduct || selectedProductsState[0];
    if (!effectiveProd) {
      toast.error("Please select at least 1 product");
      return;
    }

    if (recipientTab === "contact" && !selectedContact && !prefilledContact?.conversationId) {
      toast.error("Please select a customer or switch to Direct Phone");
      return;
    }

    if (recipientTab === "direct" && !directPhone.trim()) {
      toast.error("Please enter customer's WhatsApp phone number");
      return;
    }

    setSending(true);
    try {
      const payload = {
        productId: effectiveProd.id,
        productIds: selectedProductsState.map((p) => p.id),
        phone: recipientTab === "direct" ? directPhone.trim() : selectedContact?.phone,
        contactId: recipientTab === "contact" ? selectedContact?.id : undefined,
        conversationId: prefilledContact?.conversationId || undefined,
        customerName:
          recipientTab === "direct"
            ? customerName.trim() || undefined
            : selectedContact?.name || undefined,
        headlineStyle,
        customHeadline: headlineStyle === "custom" ? customHeadline : undefined,
        customNote: customNote.trim() || undefined,
        customMessage: effectiveMessageText.trim() || undefined,
        includeButtons,
        buttons: includeButtons
          ? actionButtons.map((b) => ({
            id: b.id,
            title: b.title.slice(0, 20),
          }))
          : [],
        storeDomain: "www.pratapstore.in",
      };

      const res = await fetch("/api/products/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to send product message");
      }

      if (data.sessionExpired) {
        toast.warning(
          "Customer 24-hour WhatsApp window has expired. Opening WhatsApp Web to deliver message directly!",
          {
            duration: 8000,
            action: {
              label: "Open WhatsApp Web",
              onClick: () => window.open(data.waMeUrl || waWebUrl, "_blank"),
            },
          }
        );
        window.open(data.waMeUrl || waWebUrl, "_blank");
      } else if (data.offline) {
        toast.info(
          "WhatsApp bot is currently offline. You can open WhatsApp Web to send directly!",
          {
            action: {
              label: "Open WhatsApp",
              onClick: () => window.open(data.waMeUrl || waWebUrl, "_blank"),
            },
          }
        );
      } else {
        const pCount = selectedProductsState.length;
        toast.success(
          pCount > 1
            ? `${pCount} products shared with customer successfully! 🚀`
            : `Product "${effectiveProd.name}" sent to customer successfully! 🚀`
        );
      }

      onSuccess?.();
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error sending product";
      toast.error(msg);
    } finally {
      setSending(false);
    }
  };

  const effectiveProduct = selectedProduct || selectedProductsState[0];
  if (!effectiveProduct && selectedProductsState.length === 0) return null;
  const currentProduct = effectiveProduct || productsList[0];
  if (!currentProduct) return null;

  const isMultiProduct = selectedProductsState.length > 1;
  const totalSellingPrice = selectedProductsState.reduce(
    (acc, p) => acc + (Number(p.price) || 0),
    0
  );
  const totalComparePrice = selectedProductsState.reduce(
    (acc, p) => acc + (p.compare_at_price ? Number(p.compare_at_price) : Number(p.price) || 0),
    0
  );
  const totalSavings = Math.max(0, totalComparePrice - totalSellingPrice);
  const totalSavingsPercent =
    totalComparePrice > 0 ? Math.round((totalSavings / totalComparePrice) * 100) : 0;

  const comparePrice = currentProduct.compare_at_price;
  const currentPrice = currentProduct.price;
  const hasDiscount = comparePrice && comparePrice > currentPrice;
  const discountPercent = hasDiscount
    ? Math.round(((comparePrice - currentPrice) / comparePrice) * 100)
    : 0;

  const bulkProgressPercent = bulkStats.total > 0
    ? Math.min(100, Math.round(((bulkStats.sent + bulkStats.failed) / bulkStats.total) * 100))
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "overflow-hidden p-0 gap-0 border-border bg-card flex flex-col transition-all duration-200",
          isFullscreen
            ? "!fixed !inset-0 !top-0 !left-0 !translate-x-0 !translate-y-0 !w-screen !h-screen !max-w-none !max-h-none !rounded-none z-[100]"
            : "!w-[96vw] !max-w-6xl sm:!max-w-6xl md:!max-w-6xl lg:!max-w-7xl h-[92vh] max-h-[94vh] rounded-2xl shadow-2xl"
        )}
      >
        {/* Modal Header */}
        <DialogHeader className="p-4 sm:p-5 border-b border-border bg-muted/20 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center border border-emerald-500/20">
                <Send className="h-4 w-4" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                  <span>Send Product via WhatsApp</span>
                  {isMultiProduct ? (
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] font-mono py-0 font-bold">
                      🔥 {selectedProductsState.length} Products Combo
                    </Badge>
                  ) : (
                    <Badge
                      variant="secondary"
                      className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px] font-mono py-0"
                    >
                      Amazon Style
                    </Badge>
                  )}
                  {recipientTab === "bulk" && (
                    <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/20 text-[10px] font-mono py-0">
                      🚀 1000 Bulk Mode
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  {isMultiProduct
                    ? `Sharing ${selectedProductsState.length} selected products in a combined catalog showcase message.`
                    : "Send product catalog card with photo, pricing, deal alert, and instant order buttons."}
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Product Quick Picker Button */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsProductPickerOpen((prev) => !prev)}
                className="h-8 px-2.5 text-xs text-foreground gap-1.5 border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20"
                title="Select multiple products to share"
              >
                <Package className="h-3.5 w-3.5 text-emerald-400" />
                <span className="hidden sm:inline">
                  {isMultiProduct
                    ? `${selectedProductsState.length} Items (₹${totalSellingPrice})`
                    : currentProduct.name.slice(0, 16) + "..."}
                </span>
                <span className="text-[10px] font-bold bg-emerald-600 text-white rounded-full px-1.5 py-0.2">
                  {selectedProductsState.length}
                </span>
              </Button>

              {/* Fullscreen Toggle */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsFullscreen((prev) => !prev)}
                className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1.5 border-border shrink-0"
                title={isFullscreen ? "Exit Fullscreen" : "Fullscreen View"}
              >
                {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">{isFullscreen ? "Exit Fullscreen" : "Fullscreen"}</span>
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Modal Body */}
        <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-y-auto min-h-0 overflow-x-hidden relative">
          {/* ========================================================= */}
          {/* LEFT COLUMN: Customer Selection, Message Editor & Buttons */}
          {/* ========================================================= */}
          <div className="lg:col-span-7 p-4 sm:p-6 space-y-4 border-r border-border overflow-y-auto overflow-x-hidden">
            {/* Multi-Product Selection Showcase Bar */}
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.04] p-3 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Package className="h-4 w-4 text-emerald-400" />
                    <span>Selected Products ({selectedProductsState.length})</span>
                  </span>
                  {isMultiProduct ? (
                    <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono py-0 font-bold">
                      Combo ₹{totalSellingPrice} {totalSavings > 0 && `(Save ₹${totalSavings} • ${totalSavingsPercent}% OFF)`}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] font-mono py-0 text-muted-foreground">
                      1 Item
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsProductPickerOpen((prev) => !prev)}
                    className={cn(
                      "h-7 text-xs gap-1 border-emerald-500/40 font-medium transition-colors",
                      isProductPickerOpen
                        ? "bg-emerald-600 text-white hover:bg-emerald-500"
                        : "text-emerald-400 hover:bg-emerald-500/10"
                    )}
                  >
                    <Plus className="h-3 w-3" />
                    {isProductPickerOpen ? "Hide Catalog" : "+ Select / Add Products"}
                  </Button>

                  {selectedProductsState.length < productsList.length ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleSelectAllProducts}
                      className="h-7 text-xs text-muted-foreground hover:text-foreground px-2"
                      title="Select all products from catalog"
                    >
                      Select All ({productsList.length})
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleClearSelectionToSingle(selectedProductsState[0])}
                      className="h-7 text-xs text-muted-foreground hover:text-foreground px-2"
                    >
                      Reset to 1
                    </Button>
                  )}
                </div>
              </div>

              {/* Selected Products Chips */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 scrollbar-thin">
                {selectedProductsState.map((prod, pIdx) => (
                  <div
                    key={prod.id}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-border/80 bg-background/80 shadow-sm shrink-0 max-w-[240px] group hover:border-emerald-500/50 transition-colors"
                  >
                    <div className="h-8 w-8 rounded-md bg-muted overflow-hidden shrink-0 flex items-center justify-center border border-border">
                      {prod.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={prod.image_url}
                          alt={prod.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Package className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold text-foreground truncate" title={prod.name}>
                        {pIdx + 1}. {prod.name}
                      </p>
                      <p className="text-[10px] font-mono text-emerald-400 font-bold">
                        ₹{prod.price}
                      </p>
                    </div>
                    {selectedProductsState.length > 1 && (
                      <button
                        type="button"
                        onClick={() => toggleProductInSelection(prod)}
                        className="h-5 w-5 rounded hover:bg-muted text-muted-foreground hover:text-red-400 flex items-center justify-center shrink-0 transition-colors"
                        title="Remove product"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Expandable Product Picker Drawer */}
              {isProductPickerOpen && (
                <div className="rounded-xl border border-border bg-background p-3 space-y-3 mt-2 shadow-lg animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-foreground">
                      Check products to include (e.g. 2, 4 or more):
                    </span>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      {selectedProductsState.length} of {productsList.length} selected
                    </span>
                  </div>

                  {/* Search within catalog */}
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search catalog by name or category..."
                      value={productPickerFilter}
                      onChange={(e) => setProductPickerFilter(e.target.value)}
                      className="h-8 pl-8 text-xs bg-muted/30"
                    />
                  </div>

                  {/* Catalog items grid with checkboxes */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
                    {productsList
                      .filter((p) => {
                        if (!productPickerFilter.trim()) return true;
                        const q = productPickerFilter.toLowerCase();
                        return (
                          p.name.toLowerCase().includes(q) ||
                          (p.category && p.category.toLowerCase().includes(q))
                        );
                      })
                      .map((p) => {
                        const isChecked = selectedProductsState.some((item) => item.id === p.id);
                        return (
                          <div
                            key={p.id}
                            onClick={() => toggleProductInSelection(p)}
                            className={cn(
                              "flex items-center gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition-all",
                              isChecked
                                ? "border-emerald-500 bg-emerald-500/10 text-foreground font-medium shadow-sm"
                                : "border-border hover:bg-muted/40 text-muted-foreground"
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => { }} // handled by parent onClick
                              className="rounded border-border accent-emerald-500 cursor-pointer h-4 w-4 shrink-0"
                            />
                            <div className="h-9 w-9 rounded-md bg-muted overflow-hidden shrink-0 border border-border flex items-center justify-center">
                              {p.image_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={p.image_url}
                                  alt={p.name}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <Package className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-semibold text-foreground">{p.name}</p>
                              <div className="flex items-center gap-1.5 text-[10px] mt-0.5">
                                <span className="font-mono text-emerald-400 font-bold">₹{p.price}</span>
                                {p.compare_at_price && p.compare_at_price > p.price && (
                                  <span className="line-through text-muted-foreground font-mono">
                                    ₹{p.compare_at_price}
                                  </span>
                                )}
                                <span>•</span>
                                <span className="text-muted-foreground">{p.category}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-border">
                    <p className="text-[10px] text-muted-foreground">
                      💡 Check multiple products to share them together in 1 WhatsApp message.
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setIsProductPickerOpen(false)}
                      className="h-7 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
                    >
                      Done ({selectedProductsState.length} Selected)
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Recipient Tabs (3 modes: Saved Contacts, Direct Phone, 🚀 Bulk 1000) */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold flex items-center justify-between">
                <span>Select Recipient Target</span>
                <span className="text-[10px] text-muted-foreground">
                  Send 1-on-1 or blast up to 1000 numbers in 1 click
                </span>
              </Label>

              <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-muted/40 border border-border">
                <button
                  type="button"
                  onClick={() => setRecipientTab("contact")}
                  className={`text-xs font-medium py-1.5 px-2 rounded-md transition-all flex items-center justify-center gap-1.5 ${recipientTab === "contact"
                      ? "bg-card text-foreground shadow-sm font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                  <User className="h-3.5 w-3.5" />
                  <span className="truncate">Saved Contacts</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRecipientTab("direct")}
                  className={`text-xs font-medium py-1.5 px-2 rounded-md transition-all flex items-center justify-center gap-1.5 ${recipientTab === "direct"
                      ? "bg-card text-foreground shadow-sm font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                  <Phone className="h-3.5 w-3.5" />
                  <span className="truncate">Direct Phone</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRecipientTab("bulk")}
                  className={`text-xs font-medium py-1.5 px-2 rounded-md transition-all flex items-center justify-center gap-1.5 ${recipientTab === "bulk"
                      ? "bg-card text-emerald-400 border border-emerald-500/30 shadow-sm font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                  <Users className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="truncate">🚀 1000 Bulk Blast</span>
                </button>
              </div>

              {/* Mode 1: Saved Contacts */}
              {recipientTab === "contact" && (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search contacts by name or phone..."
                      value={contactSearch}
                      onChange={(e) => setContactSearch(e.target.value)}
                      className="pl-8 h-8 text-xs"
                    />
                  </div>

                  {selectedContact ? (
                    <div className="flex items-center justify-between p-2 rounded-lg border border-emerald-500/40 bg-emerald-500/5">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold">
                          {(selectedContact.name || selectedContact.phone)[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-foreground">
                            {selectedContact.name || "Customer"}
                          </p>
                          <p className="text-[10px] font-mono text-muted-foreground">
                            {selectedContact.phone}
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedContact(null)}
                        className="h-6 text-[10px] text-muted-foreground hover:text-foreground"
                      >
                        Change
                      </Button>
                    </div>
                  ) : (
                    <div className="max-h-36 overflow-y-auto space-y-1 rounded-lg border border-border p-1 bg-background/50">
                      {contactsLoading ? (
                        <div className="p-3 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Loading contacts...
                        </div>
                      ) : filteredContacts.length === 0 ? (
                        <div className="p-3 text-center text-xs text-muted-foreground">
                          No matching contact found. Enter phone in "Direct Phone No." tab.
                        </div>
                      ) : (
                        filteredContacts.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setSelectedContact(c)}
                            className="w-full flex items-center justify-between p-1.5 px-2 rounded-md hover:bg-muted text-left transition-colors"
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-foreground truncate">
                                {c.name || "Customer"}
                              </p>
                              <p className="text-[10px] font-mono text-muted-foreground">
                                {c.phone}
                              </p>
                            </div>
                            <span className="text-[10px] text-emerald-400 font-medium">
                              Select
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Mode 2: Direct Phone Number */}
              {recipientTab === "direct" && (
                <div className="space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="phone_in" className="text-[11px]">
                        WhatsApp Phone *
                      </Label>
                      <Input
                        id="phone_in"
                        placeholder="e.g. 9876543210 or 919876543210"
                        value={directPhone}
                        onChange={(e) => setDirectPhone(e.target.value)}
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <Label htmlFor="c_name" className="text-[11px]">
                        Customer Name (Optional)
                      </Label>
                      <Input
                        id="c_name"
                        placeholder="e.g. Rahul Sharma"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Tip: Enter 10-digit Indian phone number. +91 country code is auto-attached.
                  </p>
                </div>
              )}

              {/* Mode 3: 🚀 BULK 1000 WHATSAPP BROADCAST */}
              {recipientTab === "bulk" && (
                <div className="space-y-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3.5">
                  {/* Bulk Input Selector Sub-Tabs */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1 p-0.5 rounded-lg bg-background border border-border">
                      <button
                        type="button"
                        onClick={() => setBulkSubTab("paste")}
                        className={`text-[11px] font-medium py-1 px-2.5 rounded-md transition-all flex items-center gap-1 ${bulkSubTab === "paste"
                            ? "bg-muted text-foreground shadow-sm font-semibold"
                            : "text-muted-foreground hover:text-foreground"
                          }`}
                      >
                        <FileText className="h-3 w-3" />
                        Paste 1000 Numbers
                      </button>
                      <button
                        type="button"
                        onClick={() => setBulkSubTab("crm")}
                        className={`text-[11px] font-medium py-1 px-2.5 rounded-md transition-all flex items-center gap-1 ${bulkSubTab === "crm"
                            ? "bg-muted text-foreground shadow-sm font-semibold"
                            : "text-muted-foreground hover:text-foreground"
                          }`}
                      >
                        <Users className="h-3 w-3" />
                        All CRM Contacts
                      </button>
                      <button
                        type="button"
                        onClick={() => setBulkSubTab("upload")}
                        className={`text-[11px] font-medium py-1 px-2.5 rounded-md transition-all flex items-center gap-1 ${bulkSubTab === "upload"
                            ? "bg-muted text-foreground shadow-sm font-semibold"
                            : "text-muted-foreground hover:text-foreground"
                          }`}
                      >
                        <Upload className="h-3 w-3" />
                        CSV / TXT File
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleLoadSampleNumbers(100)}
                        className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground border-border"
                        title="Load 100 sample phone numbers for testing"
                      >
                        <Zap className="h-2.5 w-2.5 text-amber-400 mr-0.5" />
                        Test 100
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setBulkRawInput("")}
                        className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
                      >
                        Clear
                      </Button>
                    </div>
                  </div>

                  {/* Sub-tab 1: Paste Textarea */}
                  {bulkSubTab === "paste" && (
                    <div className="space-y-1.5">
                      <Textarea
                        value={bulkRawInput}
                        onChange={(e) => setBulkRawInput(e.target.value)}
                        placeholder={`Paste up to 1000 WhatsApp numbers here (separated by commas or newlines)...\n\nExample:\n9876543210\n919876543211\nRahul: 9876543212`}
                        className="min-h-[110px] text-xs font-mono resize-y bg-background border-border"
                      />
                    </div>
                  )}

                  {/* Sub-tab 2: CRM All Contacts */}
                  {bulkSubTab === "crm" && (
                    <div className="p-3 rounded-lg border border-border bg-background space-y-2 text-center">
                      <p className="text-xs text-muted-foreground">
                        Instantly load all customer contacts saved in your CRM.
                      </p>
                      <Button
                        type="button"
                        variant="default"
                        size="sm"
                        onClick={handleLoadAllCrmContacts}
                        disabled={loadingAllContacts}
                        className="h-8 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5"
                      >
                        {loadingAllContacts ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Users className="h-3 w-3" />
                        )}
                        Load All Saved Contacts (1 Click)
                      </Button>
                    </div>
                  )}

                  {/* Sub-tab 3: Upload CSV / TXT */}
                  {bulkSubTab === "upload" && (
                    <div className="p-4 rounded-lg border-2 border-dashed border-border hover:border-emerald-500/50 bg-background text-center space-y-2 transition-colors">
                      <FileSpreadsheet className="h-7 w-7 text-emerald-400 mx-auto" />
                      <div>
                        <label
                          htmlFor="bulk_file_in"
                          className="text-xs font-semibold text-emerald-400 hover:underline cursor-pointer block"
                        >
                          Click to upload CSV or TXT file
                        </label>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Numbers will be extracted and auto-formatted to +91 automatically.
                        </p>
                        <input
                          id="bulk_file_in"
                          type="file"
                          accept=".csv,.txt"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                      </div>
                    </div>
                  )}

                  {/* Valid Numbers Badge & Preview Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-lg bg-background border border-border/80">
                    <div className="flex items-center gap-1.5">
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-[11px] font-mono font-bold px-2 py-0.5",
                          parsedBulkRecipients.length > 0
                            ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        ⚡ {parsedBulkRecipients.length} Numbers Ready
                      </Badge>
                      <span className="text-[10px] text-muted-foreground hidden sm:inline">
                        (Duplicates auto-cleaned)
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleCopyAllBulkNumbers}
                        disabled={parsedBulkRecipients.length === 0}
                        className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground gap-1 border-border"
                        title="Copy all numbers to clipboard"
                      >
                        <Copy className="h-2.5 w-2.5" />
                        Copy Numbers
                      </Button>
                    </div>
                  </div>

                  {/* Anti-Ban Throttle Setting */}
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-border/60">
                    <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
                      <Clock className="h-3 w-3 text-amber-400" />
                      Anti-Ban Message Delay:
                    </span>
                    <select
                      value={bulkDelayMs}
                      onChange={(e) => setBulkDelayMs(Number(e.target.value))}
                      className="text-xs rounded border border-border bg-background px-2 py-0.5 font-mono text-foreground"
                    >
                      <option value="300">Fast (300ms)</option>
                      <option value="500">Recommended (500ms)</option>
                      <option value="1000">Safe (1000ms)</option>
                      <option value="2000">Ultra Safe (2000ms)</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* ========================================================= */}
            {/* MESSAGE CONTENT EDITOR SECTION */}
            {/* ========================================================= */}
            <div className="space-y-3 pt-2 border-t border-border">
              {/* Header with Mode Switcher */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/40 border border-border">
                  <button
                    type="button"
                    onClick={() => setMessageMode("template")}
                    className={`text-xs font-medium py-1 px-3 rounded-md transition-all flex items-center gap-1.5 ${messageMode === "template"
                        ? "bg-card text-foreground shadow-sm font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                      }`}
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5 text-emerald-400" />
                    Smart Template
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMessageMode("custom");
                      if (!customMessageText) setCustomMessageText(previewText);
                    }}
                    className={`text-xs font-medium py-1 px-3 rounded-md transition-all flex items-center gap-1.5 ${messageMode === "custom"
                        ? "bg-card text-foreground shadow-sm font-semibold text-emerald-400 border border-emerald-500/30"
                        : "text-muted-foreground hover:text-foreground"
                      }`}
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    Edit Full Message
                  </button>
                </div>

                {messageMode === "custom" ? (
                  <Badge
                    variant="outline"
                    className="border-emerald-500/40 text-emerald-400 bg-emerald-500/10 text-[10px] font-mono py-0.5"
                  >
                    ✏️ Custom Text Active
                  </Badge>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setMessageMode("custom");
                      if (!customMessageText) setCustomMessageText(previewText);
                    }}
                    className="text-[11px] text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 underline underline-offset-2"
                  >
                    <Edit3 className="h-3 w-3" />
                    Edit text directly
                  </button>
                )}
              </div>

              {/* Mode A: Smart Template Controls */}
              {messageMode === "template" ? (
                <div className="space-y-3">
                  {/* Style Presets */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Message Style & Headline</Label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {Object.entries(HEADLINE_PRESETS).map(([key, item]) => {
                        const isSelected = headlineStyle === key;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setHeadlineStyle(key as typeof headlineStyle)}
                            className={`p-2 rounded-lg border text-left transition-all ${isSelected
                                ? "border-emerald-500 bg-emerald-500/10 text-foreground shadow-sm"
                                : "border-border hover:bg-muted/40 text-muted-foreground"
                              }`}
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm">{item.icon}</span>
                              <span className="text-xs font-semibold text-foreground">
                                {item.label}
                              </span>
                            </div>
                            <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                              {item.subtitle}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Personalized Merchant Note */}
                  <div className="space-y-1.5">
                    <Label htmlFor="custom_note" className="text-xs font-semibold">
                      Personalized Note (Optional)
                    </Label>
                    <Textarea
                      id="custom_note"
                      placeholder="e.g. Namaste ji, yeh raha aapka requested product details with special price!"
                      value={customNote}
                      onChange={(e) => setCustomNote(e.target.value)}
                      className="h-14 text-xs resize-none"
                    />
                  </div>

                  {/* Feature Toggles */}
                  <div className="space-y-2 pt-1 border-t border-border">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Include MRP & Savings %</span>
                      <input
                        type="checkbox"
                        checked={includeDiscount}
                        onChange={(e) => setIncludeDiscount(e.target.checked)}
                        className="rounded border-border accent-emerald-500 cursor-pointer h-4 w-4"
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        Include Pratap Store Perks / What's More
                      </span>
                      <input
                        type="checkbox"
                        checked={includePerks}
                        onChange={(e) => setIncludePerks(e.target.checked)}
                        className="rounded border-border accent-emerald-500 cursor-pointer h-4 w-4"
                      />
                    </div>
                  </div>

                  {/* Prompt to edit full text */}
                  <div className="p-2.5 rounded-lg border border-dashed border-emerald-500/40 bg-emerald-500/5 flex items-center justify-between gap-2">
                    <div className="text-[11px] text-muted-foreground">
                      <span>Need to modify the text or offer lines?</span>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setMessageMode("custom");
                        if (!customMessageText) setCustomMessageText(previewText);
                      }}
                      className="h-7 text-xs border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 gap-1.5"
                    >
                      <Edit3 className="h-3 w-3" />
                      Edit Message Text
                    </Button>
                  </div>
                </div>
              ) : (
                /* Mode B: Direct Custom Message Text Editor */
                <div className="space-y-2 rounded-xl border border-emerald-500/30 bg-background/60 p-3 shadow-inner">
                  {/* Editor Toolbar */}
                  <div className="flex flex-wrap items-center justify-between gap-1.5 pb-2 border-b border-border">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-semibold text-muted-foreground mr-1 flex items-center gap-1">
                        <Type className="h-3 w-3" /> Format:
                      </span>
                      <button
                        type="button"
                        onClick={() => insertTextAround("*")}
                        className="h-6 px-2 rounded bg-muted hover:bg-muted/80 text-[11px] font-bold text-foreground border border-border"
                        title="Bold (*text*)"
                      >
                        *B*
                      </button>
                      <button
                        type="button"
                        onClick={() => insertTextAround("_")}
                        className="h-6 px-2 rounded bg-muted hover:bg-muted/80 text-[11px] italic text-foreground border border-border"
                        title="Italic (_text_)"
                      >
                        _I_
                      </button>
                      <button
                        type="button"
                        onClick={() => insertTextAround("~")}
                        className="h-6 px-2 rounded bg-muted hover:bg-muted/80 text-[11px] line-through text-foreground border border-border"
                        title="Strikethrough (~text~)"
                      >
                        ~S~
                      </button>
                    </div>

                    {/* Quick Emojis */}
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-semibold text-muted-foreground mr-1 flex items-center gap-1">
                        <Smile className="h-3 w-3" /> Emojis:
                      </span>
                      {["🔥", "🛍️", "✨", "👕", "💵", "🎉", "🚚", "📦", "🪔"].map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => insertEmoji(emoji)}
                          className="h-6 w-6 rounded hover:bg-muted flex items-center justify-center text-xs transition-transform active:scale-90"
                          title={`Insert ${emoji}`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleResetCustomMessage}
                      className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground gap-1 ml-auto"
                      title="Reset text to default auto-generated template"
                    >
                      <RotateCcw className="h-2.5 w-2.5" />
                      Reset to Template
                    </Button>
                  </div>

                  {/* Main Editable Textarea */}
                  <div className="space-y-1">
                    <Textarea
                      id="editable_msg_textarea"
                      value={customMessageText}
                      onChange={(e) => {
                        setCustomMessageText(e.target.value);
                        setIsCustomDirty(true);
                      }}
                      placeholder="Type WhatsApp message here..."
                      className="min-h-[220px] font-mono text-xs leading-relaxed resize-y bg-background border-border"
                    />
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground px-0.5">
                      <span className="text-zinc-400">
                        ✨ Live WhatsApp preview on right reflects changes automatically.
                      </span>
                      <span
                        className={cn(
                          "font-mono font-medium",
                          customMessageText.length > 1024
                            ? "text-amber-400 font-bold"
                            : "text-muted-foreground"
                        )}
                      >
                        {customMessageText.length} chars {customMessageText.length > 1024 && "(>1024 for buttons)"}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ========================================================= */}
            {/* WHATSAPP ACTION BUTTONS CUSTOMIZATION SECTION */}
            {/* ========================================================= */}
            <div className="space-y-3 pt-3 border-t border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <input
                    id="incl_buttons"
                    type="checkbox"
                    checked={includeButtons}
                    onChange={(e) => setIncludeButtons(e.target.checked)}
                    className="rounded border-border accent-emerald-500 cursor-pointer h-4 w-4"
                  />
                  <Label htmlFor="incl_buttons" className="text-xs font-semibold cursor-pointer flex items-center gap-1.5">
                    <span>Include WhatsApp Action Buttons</span>
                    <Badge variant="outline" className="text-[9px] py-0 border-border text-muted-foreground">
                      Max 3 buttons
                    </Badge>
                  </Label>
                </div>
                {includeButtons && (
                  <span className="text-[10px] font-mono text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded border border-border">
                    {actionButtons.length}/3 buttons
                  </span>
                )}
              </div>

              {includeButtons && (
                <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-foreground">
                      Customize Button Labels & Actions
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleResetButtons}
                      className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground gap-1"
                    >
                      <RotateCcw className="h-2.5 w-2.5" />
                      Reset Buttons
                    </Button>
                  </div>

                  {/* Buttons List */}
                  <div className="space-y-2">
                    {actionButtons.map((btn, idx) => (
                      <div
                        key={btn.id || idx}
                        className="flex items-center gap-2 p-2 rounded-lg border border-border/80 bg-background shadow-sm"
                      >
                        <div className="h-6 w-6 rounded-md bg-muted text-[10px] font-bold flex items-center justify-center text-muted-foreground shrink-0 border border-border">
                          #{idx + 1}
                        </div>

                        {/* Button Title Input */}
                        <div className="flex-1 relative">
                          <Input
                            value={btn.title}
                            maxLength={20}
                            onChange={(e) => handleUpdateButtonTitle(idx, e.target.value)}
                            placeholder="Button Label (Max 20 chars)"
                            className="h-8 text-xs pr-12 font-medium"
                          />
                          <span className="absolute right-2 top-2 text-[9px] font-mono text-muted-foreground">
                            {btn.title.length}/20
                          </span>
                        </div>

                        {/* Action Type Select */}
                        <select
                          value={btn.actionType}
                          onChange={(e) =>
                            handleUpdateButtonAction(
                              idx,
                              e.target.value as ActionButtonItem["actionType"]
                            )
                          }
                          className="h-8 text-xs rounded-md border border-border bg-background px-2 text-foreground max-w-[125px]"
                        >
                          <option value="order">🛍️ Order</option>
                          <option value="catalog">📋 Catalog</option>
                          <option value="chat">💬 Chat</option>
                          <option value="custom">⚙️ Custom</option>
                        </select>

                        {/* Delete Button */}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteButton(idx)}
                          disabled={actionButtons.length <= 1}
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-red-400 disabled:opacity-30"
                          title="Remove Button"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  {/* Add Button Row */}
                  {actionButtons.length < 3 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddButton()}
                      className="w-full h-8 text-xs border-dashed border-border gap-1.5 text-muted-foreground hover:text-foreground hover:border-emerald-500/50"
                    >
                      <Plus className="h-3.5 w-3.5 text-emerald-400" />
                      Add Button ({actionButtons.length}/3)
                    </Button>
                  )}

                  {/* Quick Preset Suggestions */}
                  <div className="space-y-1.5 pt-1 border-t border-border/60">
                    <p className="text-[10px] text-muted-foreground">
                      Quick Suggestions (click to add or replace):
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { label: "🛍️ Order Now", action: "order" as const },
                        { label: `⚡ Buy ₹${currentProduct.price}`, action: "order" as const },
                        { label: "📋 All Products", action: "catalog" as const },
                        { label: "💬 Chat with Us", action: "chat" as const },
                        {
                          label: hasDiscount ? `🔥 Save ${discountPercent}%` : "🔥 Special Deal",
                          action: "order" as const,
                        },
                        { label: "📞 Call Store", action: "custom" as const },
                      ].map((chip, chipIdx) => (
                        <button
                          key={chipIdx}
                          type="button"
                          onClick={() => {
                            if (actionButtons.length < 3) {
                              handleAddButton(chip.label, chip.action);
                            } else {
                              handleUpdateButtonTitle(actionButtons.length - 1, chip.label);
                              handleUpdateButtonAction(actionButtons.length - 1, chip.action);
                            }
                          }}
                          className="text-[10px] px-2 py-0.5 rounded-full border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        >
                          + {chip.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ========================================================= */}
          {/* RIGHT COLUMN: Realistic WhatsApp Phone Mockup */}
          {/* ========================================================= */}
          <div className="lg:col-span-5 bg-zinc-950/80 p-4 sm:p-6 flex flex-col justify-between border-t lg:border-t-0 overflow-y-auto overflow-x-hidden">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3 text-emerald-400" />
                  Live Customer WhatsApp Preview
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setMessageMode("custom");
                    if (!customMessageText) setCustomMessageText(previewText);
                  }}
                  className="text-[10px] text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20"
                >
                  <Edit3 className="h-3 w-3" />
                  Edit Text
                </button>
              </div>

              {/* Phone Container */}
              <div className="rounded-2xl border border-zinc-800 bg-[#0B141A] shadow-2xl overflow-hidden w-full max-w-[360px] mx-auto">
                {/* WhatsApp Chat Top Bar */}
                <div className="bg-[#1F2C34] text-white px-3 py-2 flex items-center justify-between border-b border-zinc-800">
                  <div className="flex items-center gap-2">
                    <ChevronLeft className="h-4 w-4 text-zinc-400" />
                    <div className="relative">
                      <div className="h-8 w-8 rounded-full bg-emerald-600 flex items-center justify-center font-bold text-xs shadow-inner">
                        P
                      </div>
                      <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-emerald-400 border border-[#1F2C34]" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-semibold leading-tight">
                          Pratap Store
                        </span>
                        <CheckCircle2 className="h-3.5 w-3.5 text-[#00A884] fill-[#00A884]/20" />
                      </div>
                      <span className="text-[9px] text-[#00A884] block leading-tight">
                        Official Business Account
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-zinc-300">
                    <Video className="h-4 w-4 opacity-75" />
                    <PhoneCall className="h-3.5 w-3.5 opacity-75" />
                    <MoreVertical className="h-4 w-4 opacity-75" />
                  </div>
                </div>

                {/* WhatsApp Chat Area */}
                <div className="p-3 space-y-3 bg-[#0B141A] min-h-[360px] max-h-[480px] overflow-y-auto relative">
                  {/* Date badge */}
                  <div className="text-center">
                    <span className="bg-[#182229] text-zinc-400 text-[10px] px-2 py-0.5 rounded-md font-medium shadow-sm">
                      TODAY
                    </span>
                  </div>

                  {/* Outgoing WhatsApp Product Bubble */}
                  <div className="ml-auto max-w-[92%] bg-[#005C4B] text-zinc-100 rounded-xl rounded-tr-none shadow-md overflow-hidden text-xs border border-emerald-600/20">
                    {/* Top Image Preview */}
                    {isMultiProduct ? (
                      <div className="bg-zinc-900 border-b border-zinc-800">
                        {/* Primary Image with Multi-badge */}
                        <div className="relative aspect-[16/9] w-full overflow-hidden">
                          {selectedProductsState[0]?.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={selectedProductsState[0].image_url}
                              alt={selectedProductsState[0].name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-zinc-500">
                              <Package className="h-10 w-10" />
                            </div>
                          )}
                          <div className="absolute top-2 left-2">
                            <span className="bg-emerald-600/90 backdrop-blur-md text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                              🔥 {selectedProductsState.length} Products Combo
                            </span>
                          </div>
                          <div className="absolute bottom-2 right-2">
                            <span className="bg-black/75 backdrop-blur-md text-zinc-200 text-[10px] px-2 py-0.5 rounded-md font-mono">
                              ₹{totalSellingPrice} total
                            </span>
                          </div>
                        </div>

                        {/* Thumbnails of all selected products */}
                        <div className="flex items-center gap-1.5 p-2 overflow-x-auto bg-[#0a1217]">
                          {selectedProductsState.map((sp, idx) => (
                            <div
                              key={sp.id}
                              className="h-10 w-10 rounded-md overflow-hidden bg-zinc-800 shrink-0 border border-zinc-700 relative"
                              title={`${idx + 1}. ${sp.name}`}
                            >
                              {sp.image_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={sp.image_url}
                                  alt={sp.name}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="h-full w-full flex items-center justify-center text-zinc-500 text-[10px]">
                                  #{idx + 1}
                                </div>
                              )}
                              <span className="absolute bottom-0 right-0 bg-black/80 text-[8px] font-bold text-white px-1 leading-tight rounded-tl">
                                {idx + 1}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (selectedProduct?.image_url || selectedProductsState[0]?.image_url) ? (
                      <div className="relative aspect-[4/3] bg-zinc-900 w-full overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={selectedProduct?.image_url || selectedProductsState[0]?.image_url || ""}
                          alt={selectedProduct?.name || selectedProductsState[0]?.name || ""}
                          className="h-full w-full object-cover"
                        />
                        <div className="absolute top-2 left-2">
                          <span className="bg-black/60 backdrop-blur-md text-white text-[10px] px-2 py-0.5 rounded-full font-medium">
                            {selectedProduct?.category || selectedProductsState[0]?.category}
                          </span>
                        </div>
                      </div>
                    ) : null}

                    {/* Content Section rendered live */}
                    <div className="p-3 space-y-2">
                      {renderWhatsAppFormattedText(effectiveMessageText)}

                      {/* Timestamp & double ticks */}
                      <div className="flex items-center justify-end gap-1 text-[9px] text-zinc-400 pt-1">
                        <span>11:24 AM</span>
                        <CheckCheck className="h-3 w-3 text-sky-400" />
                      </div>
                    </div>

                    {/* WhatsApp Action Buttons (Bottom Cards) */}
                    {includeButtons && actionButtons.length > 0 && (
                      <div className="border-t border-[#02493C] bg-[#014D3F] divide-y divide-[#02493C]">
                        {actionButtons.map((btn, idx) => (
                          <div
                            key={btn.id || idx}
                            className="p-2 text-center text-[#00A884] font-medium text-xs hover:bg-[#025646] cursor-pointer flex items-center justify-center gap-1.5 transition-colors"
                          >
                            {btn.actionType === "order" ? (
                              <ShoppingBag className="h-3 w-3" />
                            ) : btn.actionType === "chat" ? (
                              <MessageSquare className="h-3 w-3" />
                            ) : (
                              <ExternalLink className="h-3 w-3" />
                            )}
                            <span className="truncate max-w-[280px]">
                              {btn.title || `Button ${idx + 1}`}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Quick Actions inside preview column */}
            <div className="flex items-center justify-between gap-2 pt-3 mt-3 border-t border-zinc-800">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="h-8 text-xs border-zinc-800 text-zinc-300 hover:bg-zinc-800 gap-1.5 flex-1"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy Text"}
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => window.open(waWebUrl, "_blank")}
                className="h-8 text-xs border-zinc-800 text-zinc-300 hover:bg-zinc-800 gap-1.5 flex-1"
                title="Open WhatsApp Web directly with this product"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                WhatsApp Web
              </Button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 border-t border-border bg-card flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className={cn(
              "h-2 w-2 rounded-full animate-pulse",
              recipientTab === "bulk" ? "bg-amber-400" : "bg-emerald-500"
            )} />
            <span>
              Target:{" "}
              <strong className="text-foreground">
                {recipientTab === "bulk"
                  ? `🚀 ${parsedBulkRecipients.length} Bulk Numbers Selected`
                  : resolvedPhone || "No customer selected"}
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={sending || isBulkSending}
              className="text-xs flex-1 sm:flex-initial"
            >
              Cancel
            </Button>

            {recipientTab === "bulk" ? (
              <Button
                type="button"
                onClick={handleSend}
                disabled={sending || isBulkSending || parsedBulkRecipients.length === 0}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs gap-2 flex-1 sm:flex-initial shadow-md shadow-emerald-600/20"
              >
                {isBulkSending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Sending to {bulkStats.total} Numbers...
                  </>
                ) : (
                  <>
                    <Zap className="h-3.5 w-3.5 text-amber-300" />
                    🚀 Launch Bulk Send ({isMultiProduct ? `${selectedProductsState.length} Items to ` : ""}{parsedBulkRecipients.length} Numbers)
                  </>
                )}
              </Button>
            ) : (
              <div className="flex flex-wrap items-center gap-2 flex-1 sm:flex-initial">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => window.open(waWebUrl, "_blank")}
                  className="border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 text-xs gap-1.5 h-9"
                  title="Send via WhatsApp Web directly (bypasses 24-hour limit)"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Send via WhatsApp Web
                </Button>
                <Button
                  type="button"
                  onClick={handleSend}
                  disabled={sending}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs gap-2 shadow-md shadow-emerald-600/20 h-9"
                >
                  {sending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Sending to Customer...
                    </>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" />
                      {isMultiProduct
                        ? `Send ${selectedProductsState.length} Products via WhatsApp`
                        : "Send via WhatsApp"}
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* ============================================================ */}
        {/* INTERACTIVE LIVE BULK BROADCAST TRACKER OVERLAY */}
        {/* ============================================================ */}
        {isBulkModalOpen && (
          <div className="absolute inset-0 bg-background/95 backdrop-blur-md z-50 flex flex-col p-4 sm:p-6 justify-between animate-in fade-in-0 duration-200">
            {/* Overlay Header */}
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                  <Zap className="h-5 w-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                    <span>1-Click Bulk Product Broadcast</span>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-[10px] font-mono",
                        isBulkSending
                          ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                          : "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                      )}
                    >
                      {isBulkSending
                        ? isBulkPaused
                          ? "⏸️ Paused"
                          : "🚀 Broadcasting Live"
                        : "✅ Campaign Complete"}
                    </Badge>
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Broadcasting {isMultiProduct ? `${selectedProductsState.length} selected products` : `product "${currentProduct.name}"`} to {bulkStats.total} WhatsApp numbers
                  </p>
                </div>
              </div>

              {!isBulkSending && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsBulkModalOpen(false)}
                  className="text-xs"
                >
                  Close Monitor
                </Button>
              )}
            </div>

            {/* Center Area: Progress & Metrics */}
            <div className="my-auto space-y-5 py-4 max-w-2xl w-full mx-auto">
              {/* Progress Bar with Glow */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-foreground flex items-center gap-1.5">
                    {isBulkSending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    )}
                    <span>
                      {bulkStats.sent + bulkStats.failed} of {bulkStats.total} Numbers Processed
                    </span>
                  </span>
                  <span className="font-mono text-emerald-400 font-bold text-sm">
                    {bulkProgressPercent}%
                  </span>
                </div>

                <div className="h-3 w-full rounded-full bg-muted overflow-hidden border border-border p-0.5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-teal-400 transition-all duration-300 shadow-sm shadow-emerald-500/50"
                    style={{ width: `${bulkProgressPercent}%` }}
                  />
                </div>
              </div>

              {/* 3 Metric Cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 text-center">
                  <p className="text-[11px] text-muted-foreground font-medium">Delivered Successfully</p>
                  <p className="text-2xl font-bold font-mono text-emerald-400 mt-1">
                    {bulkStats.sent}
                  </p>
                </div>
                <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/5 text-center">
                  <p className="text-[11px] text-muted-foreground font-medium">Failed / Invalid</p>
                  <p className="text-2xl font-bold font-mono text-red-400 mt-1">
                    {bulkStats.failed}
                  </p>
                </div>
                <div className="p-3 rounded-xl border border-border bg-muted/30 text-center">
                  <p className="text-[11px] text-muted-foreground font-medium">Remaining In Queue</p>
                  <p className="text-2xl font-bold font-mono text-foreground mt-1">
                    {Math.max(0, bulkStats.total - (bulkStats.sent + bulkStats.failed))}
                  </p>
                </div>
              </div>

              {/* Live Delivery Feed Log */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="font-semibold text-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3 text-emerald-400" />
                    Live Delivery Stream
                  </span>
                  <span>Latest activity shown</span>
                </div>

                <div className="h-44 overflow-y-auto rounded-xl border border-border bg-black/40 p-2.5 font-mono text-[11px] space-y-1">
                  {bulkLogs.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-zinc-500 text-xs">
                      Initializing queue...
                    </div>
                  ) : (
                    bulkLogs.map((log, lIdx) => (
                      <div
                        key={lIdx}
                        className={cn(
                          "flex items-center justify-between py-1 px-2 rounded",
                          log.status === "sent"
                            ? "bg-emerald-500/10 text-emerald-300"
                            : "bg-red-500/10 text-red-300"
                        )}
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          {log.status === "sent" ? (
                            <Check className="h-3 w-3 text-emerald-400 shrink-0" />
                          ) : (
                            <XCircle className="h-3 w-3 text-red-400 shrink-0" />
                          )}
                          <span className="font-semibold text-white">{log.phone}</span>
                          {log.name && <span className="text-zinc-400">({log.name})</span>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {log.error && <span className="text-[10px] text-red-300">{log.error}</span>}
                          <span className="text-[10px] text-zinc-500">{log.time}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Overlay Footer Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-border">
              <div className="flex items-center gap-2">
                {isBulkSending ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleToggleBulkPause}
                      className="text-xs gap-1.5 h-8"
                    >
                      {isBulkPaused ? (
                        <>
                          <Play className="h-3.5 w-3.5 text-emerald-400" />
                          Resume
                        </>
                      ) : (
                        <>
                          <Pause className="h-3.5 w-3.5 text-amber-400" />
                          Pause
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={handleCancelBulk}
                      className="text-xs gap-1.5 h-8"
                    >
                      <StopCircle className="h-3.5 w-3.5" />
                      Stop Campaign
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={exportBulkReportCsv}
                    className="text-xs gap-1.5 h-8 text-foreground border-border"
                  >
                    <Download className="h-3.5 w-3.5 text-emerald-400" />
                    Download Delivery Report (CSV)
                  </Button>
                )}
              </div>

              <div>
                {!isBulkSending ? (
                  <Button
                    type="button"
                    onClick={() => {
                      setIsBulkModalOpen(false);
                      onOpenChange(false);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs h-8 px-4"
                  >
                    Done & Close
                  </Button>
                ) : (
                  <span className="text-xs font-mono text-muted-foreground animate-pulse">
                    Broadcasting batch {bulkStats.currentBatch}...
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
