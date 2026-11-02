'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Send,
  Upload,
  UserPlus,
  Hash,
  Download,
  Trash2,
  Edit2,
  Copy,
  Plus,
  RefreshCw,
  Eye,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  QrCode,
  Smile,
  Bold,
  Italic,
  Strikethrough,
  Code,
  List as ListIcon,
  Search,
  Filter,
  Check,
  X,
  Clock,
  Sparkles,
  Image as ImageIcon,
  FileText,
  Film,
  Layers,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ExternalLink,
  Paperclip,
  Menu,
  ShoppingBag,
  Package,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { WhatsAppQrLinker } from '@/components/settings/whatsapp-qr-linker';
import { uploadAccountMedia } from '@/lib/storage/upload-media';

interface RecipientRow {
  id: string;
  name: string;
  number: string;
  var1: string;
}

interface ButtonItem {
  id: string;
  title: string;
}

interface ListRowItem {
  id: string;
  title: string;
  description: string;
}

interface ListSectionItem {
  title: string;
  rows: ListRowItem[];
}

const PRESET_TEMPLATES = [
  {
    id: 'custom_text',
    name: 'New Message (Custom Text)',
    type: 'text' as const,
    text: 'Hello {{Name}}! 🙏\n\nWelcome to *Pratap Store*.\nWe have exciting custom products personalized with your name and photos.\n\nReply *MENU* to browse our catalog or place an order!\n\nWebsite: www.pratapstore.in',
    header: '',
    footer: '',
    buttons: [],
    listLabel: 'View Menu',
    listSections: [],
  },
  {
    id: 'interactive_buttons_offer',
    name: 'Special Offer (With 3 Quick Buttons) 🔥',
    type: 'buttons' as const,
    header: 'Pratap Store Special Offer 🔥',
    text: 'Hello {{Name}}! ✨\n\nExclusive flat discount for you! Apne favourite customized products (T-Shirts, Mugs, Keychains) par paayein up to *80% OFF*!\n\n🏷️ Coupon Code: *PRATAP100*\n\nTap a quick button below to start:',
    footer: 'Pratap Store • Fast Pan-India Delivery',
    buttons: [
      { id: 'view_catalog', title: 'Browse Catalog 🛍️' },
      { id: 'view_offers', title: 'Special Offers 🔥' },
      { id: 'contact_agent', title: 'Talk to Agent 📞' },
    ],
    listLabel: 'View Menu',
    listSections: [],
  },
  {
    id: 'interactive_list_catalog',
    name: 'Product Catalog (Interactive List Menu) 📋',
    type: 'list' as const,
    header: 'Pratap Store Catalog 📦',
    text: 'Hello {{Name}}! Welcome to *Pratap Store*.\n\nWe provide premium personalized and customized printing with fast doorstep shipping.\n\n👇 Click the menu button below to select a category:',
    footer: 'Select an option to view details & pricing',
    buttons: [],
    listLabel: 'Select Category',
    listSections: [
      {
        title: 'Apparel & Wearables',
        rows: [
          { id: 'cat_tshirts', title: 'Custom T-Shirts', description: '100% Premium Cotton with Photo/Text print' },
          { id: 'cat_hoodies', title: 'Printed Hoodies', description: 'Warm fleece with custom embroidery or print' },
        ],
      },
      {
        title: 'Personalized Gifts',
        rows: [
          { id: 'cat_mugs', title: 'Magic Photo Mugs', description: 'Color changes with hot beverage reveal' },
          { id: 'cat_keychains', title: 'Photo Keychains', description: 'Laser engraved acrylic & metal keychains' },
          { id: 'cat_cushions', title: 'Velvet Cushions', description: 'Soft fluffy personalized photo cushions' },
        ],
      },
    ],
  },
  {
    id: 'welcome_greeting',
    name: 'Welcome Greeting 🙏',
    type: 'text' as const,
    text: 'Namaste {{Name}}! 🙏\n\nThank you for connecting with *Pratap Store*.\nWe specialize in high quality customized printing:\n▪️ Personalized Photo Keychains\n▪️ Custom Printed T-Shirts\n▪️ Magic Photo Mugs\n▪️ Personalized Frames\n\nHow can we help you today? Reply with your requirement!',
    header: '',
    footer: '',
    buttons: [],
    listLabel: 'View Menu',
    listSections: [],
  },
];

export interface CarouselCardItem {
  id: string;
  image: string;
  title: string;
  description: string;
  price: string;
  buttons: Array<{ id: string; title: string; url?: string; type?: 'quick_reply' | 'url' }>;
}

export default function SendMessagePage() {
  // Campaign State
  const [campaignName, setCampaignName] = useState(`Campaign ${new Date().toLocaleDateString('en-IN')}`);
  const [selectedTemplateId, setSelectedTemplateId] = useState('custom_text');
  const [selectedInstance, setSelectedInstance] = useState('auto');
  const [messageType, setMessageType] = useState<'template' | 'buttons' | 'list' | 'text' | 'media' | 'carousel'>('template');
  
  // Meta Approved Templates State
  const [approvedTemplates, setApprovedTemplates] = useState<any[]>([]);
  const [selectedMetaTemplateName, setSelectedMetaTemplateName] = useState('welcome_greeting');
  
  // Media State
  const [mediaUrl, setMediaUrl] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [uploadedFileSize, setUploadedFileSize] = useState<string>('');
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [showManualMediaUrl, setShowManualMediaUrl] = useState(false);
  const mediaFileInputRef = useRef<HTMLInputElement>(null);

  // Message Content State
  const [headerText, setHeaderText] = useState('');
  const [messageText, setMessageText] = useState(PRESET_TEMPLATES[0].text);
  const [footerText, setFooterText] = useState('');

  // Buttons State (1-3 buttons)
  const [buttons, setButtons] = useState<ButtonItem[]>([
    { id: 'btn_catalog', title: 'Browse Catalog 🛍️' },
    { id: 'btn_offers', title: 'Special Offers 🔥' },
    { id: 'btn_agent', title: 'Talk to Agent 📞' },
  ]);

  // List Menu State
  const [listButtonLabel, setListButtonLabel] = useState('View Menu');
  const [listSections, setListSections] = useState<ListSectionItem[]>([
    {
      title: 'Our Top Categories',
      rows: [
        { id: 'row_1', title: 'Custom T-Shirts', description: '100% Cotton, Personalized Prints' },
        { id: 'row_2', title: 'Magic Photo Mugs', description: 'Color changing with hot drinks' },
        { id: 'row_3', title: 'Photo Keychains', description: 'Laser engraved acrylic & metal' },
      ],
    },
  ]);

  // Carousel Cards State (2-10 cards)
  const [carouselCards, setCarouselCards] = useState<CarouselCardItem[]>([
    {
      id: 'card_1',
      image: 'https://edyxoahfaksulmifdgke.supabase.co/storage/v1/object/public/chat-media/account-842c3d98-69ad-4661-abe1-d53629a5bdb1/1793606561183-_Hindi_Sticker.png',
      title: 'Custom Photo T-Shirt',
      description: '100% Cotton with HD Durable Photo Print',
      price: '399',
      buttons: [
        { id: 'order_card_1', title: '🛍️ Order Now', type: 'quick_reply' },
        { id: 'view_card_1', title: '🌐 Website', url: 'https://pratapstore.in', type: 'url' },
      ],
    },
    {
      id: 'card_2',
      image: '',
      title: 'Magic Ceramic Photo Mug',
      description: 'Reveals photo when hot coffee or tea is poured',
      price: '299',
      buttons: [
        { id: 'order_card_2', title: '🛍️ Order Now', type: 'quick_reply' },
        { id: 'view_card_2', title: '🌐 Website', url: 'https://pratapstore.in', type: 'url' },
      ],
    },
    {
      id: 'card_3',
      image: '',
      title: 'Laser Cut Photo Keychain',
      description: 'Crystal clear acrylic with personalized picture',
      price: '149',
      buttons: [
        { id: 'order_card_3', title: '🛍️ Order Now', type: 'quick_reply' },
        { id: 'view_card_3', title: '💬 Customize', type: 'quick_reply' },
      ],
    },
  ]);
  const [showProductCatalogModal, setShowProductCatalogModal] = useState(false);
  const [storeProductsList, setStoreProductsList] = useState<any[]>([]);
  const [isLoadingStoreProducts, setIsLoadingStoreProducts] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [previewCardIdx, setPreviewCardIdx] = useState(0);

  // Phone Numbers State
  const [recipients, setRecipients] = useState<RecipientRow[]>([
    { id: '1', name: 'Customer 1', number: '919876543210', var1: 'VIP Discount' },
  ]);
  const [searchQuery, setSearchQuery] = useState('');
  const [excludeUnsubscribes, setExcludeUnsubscribes] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Delivery State
  const [isScheduled, setIsScheduled] = useState(false);
  const [delaySeconds, setDelaySeconds] = useState(2);

  // Instances / Device State
  const [instances, setInstances] = useState<any[]>([]);
  const [isBaileysConnected, setIsBaileysConnected] = useState(false);
  const [linkedPhoneNumber, setLinkedPhoneNumber] = useState('');
  const [isMetaConnected, setIsMetaConnected] = useState(false);
  const [metaPhoneNumber, setMetaPhoneNumber] = useState('');
  const [showQrModal, setShowQrModal] = useState(false);

  // Dialogs State
  const [showManualImport, setShowManualImport] = useState(false);
  const [manualText, setManualText] = useState('');
  const [showGenerator, setShowGenerator] = useState(false);
  const [genPrefix, setGenPrefix] = useState('91');
  const [genStart, setGenStart] = useState('9876543000');
  const [genCount, setGenCount] = useState(10);
  const [showCountryCodeModal, setShowCountryCodeModal] = useState(false);
  const [countryCodeInput, setCountryCodeInput] = useState('91');
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Progress Sending State
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState({ current: 0, total: 0, sent: 0, failed: 0 });
  const [sendLogs, setSendLogs] = useState<Array<{ phone: string; name?: string; status: 'sent' | 'failed'; error?: string }>>([]);
  const [showProgressModal, setShowProgressModal] = useState(false);

  const csvFileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch Baileys & Meta Channel status
  async function fetchInstances() {
    try {
      const [baileysRes, healthRes] = await Promise.allSettled([
        fetch('/api/whatsapp/baileys'),
        fetch('/api/whatsapp/health'),
      ]);

      if (baileysRes.status === 'fulfilled') {
        const data = await baileysRes.value.json();
        if (data.sessions && Array.isArray(data.sessions)) {
          setInstances(data.sessions);
          const active = data.sessions.find((s: any) => s.status === 'connected');
          if (active) {
            setIsBaileysConnected(true);
            setLinkedPhoneNumber(active.phoneNumber || 'Linked WhatsApp');
          } else {
            setIsBaileysConnected(false);
          }
        } else if (data.status === 'connected') {
          setIsBaileysConnected(true);
          setLinkedPhoneNumber(data.phoneNumber || 'Linked WhatsApp');
        } else {
          setIsBaileysConnected(false);
        }
      }

      if (healthRes.status === 'fulfilled') {
        const healthData = await healthRes.value.json();
        if (healthData.state === 'connected') {
          setIsMetaConnected(true);
          setMetaPhoneNumber(healthData.displayPhoneNumber || '+91 80010 80776');
        } else {
          setIsMetaConnected(false);
        }
      }
    } catch {
      // ignore
    }
  }

  // Fetch Approved Meta Templates
  async function fetchApprovedTemplates() {
    try {
      const res = await fetch('/api/whatsapp/templates');
      const data = await res.json();
      if (data.templates && Array.isArray(data.templates) && data.templates.length > 0) {
        setApprovedTemplates(data.templates);
        setSelectedMetaTemplateName((prev) => {
          if (prev && data.templates.some((t: any) => t.name === prev)) return prev;
          const preferred =
            data.templates.find((t: any) => t.name === 'welcome_greeting') ||
            data.templates.find((t: any) => t.name === 'mainmenu') ||
            data.templates[0];
          return preferred.name;
        });
      }
    } catch {}
  }

  useEffect(() => {
    fetchInstances();
    fetchApprovedTemplates();
    const interval = setInterval(fetchInstances, 10000);
    return () => clearInterval(interval);
  }, []);

  // Template change handler
  function handleTemplateSelect(id: string | null) {
    if (!id) return;
    setSelectedTemplateId(id);
    const tpl = PRESET_TEMPLATES.find((t) => t.id === id);
    if (tpl) {
      setMessageType(tpl.type);
      setMessageText(tpl.text);
      setHeaderText(tpl.header || '');
      setFooterText(tpl.footer || '');
      if (tpl.buttons && tpl.buttons.length > 0) {
        setButtons(tpl.buttons);
      }
      if (tpl.listSections && tpl.listSections.length > 0) {
        setListSections(tpl.listSections);
      }
      if (tpl.listLabel) {
        setListButtonLabel(tpl.listLabel);
      }
    }
  }

  // Media file upload handler
  async function handleMediaUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 16 * 1024 * 1024) {
      toast.error('File size exceeds 16 MB limit');
      return;
    }

    setIsUploadingMedia(true);
    const sizeStr = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
    try {
      const { publicUrl } = await uploadAccountMedia('chat-media', file);
      setMediaUrl(publicUrl);
      setUploadedFileName(file.name);
      setUploadedFileSize(sizeStr);
      toast.success(`Media "${file.name}" uploaded successfully!`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload media');
    } finally {
      setIsUploadingMedia(false);
      if (mediaFileInputRef.current) mediaFileInputRef.current.value = '';
    }
  }

  function handleRemoveMedia() {
    setMediaUrl('');
    setUploadedFileName('');
    setUploadedFileSize('');
  }

  // Formatting tool helpers
  function insertFormatting(prefix: string, suffix: string = '') {
    if (!textareaRef.current) return;
    const el = textareaRef.current;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const sel = messageText.substring(start, end);
    const replacement = `${prefix}${sel || 'text'}${suffix}`;
    const newText = messageText.substring(0, start) + replacement + messageText.substring(end);
    setMessageText(newText);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, start + replacement.length - suffix.length);
    }, 50);
  }

  function insertTag(tag: string) {
    if (!textareaRef.current) return;
    const el = textareaRef.current;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const newText = messageText.substring(0, start) + tag + messageText.substring(end);
    setMessageText(newText);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + tag.length, start + tag.length);
    }, 50);
  }

  // Button operations
  function handleAddButton() {
    if (buttons.length >= 3) {
      toast.error('WhatsApp limits interactive buttons to a maximum of 3');
      return;
    }
    const nextIdx = buttons.length + 1;
    setButtons([...buttons, { id: `btn_${Date.now()}`, title: `Option ${nextIdx}` }]);
  }

  function handleUpdateButton(index: number, field: keyof ButtonItem, val: string) {
    const updated = [...buttons];
    updated[index] = { ...updated[index], [field]: val };
    setButtons(updated);
  }

  function handleDeleteButton(index: number) {
    if (buttons.length <= 1) {
      toast.error('Button messages require at least 1 button');
      return;
    }
    setButtons(buttons.filter((_, i) => i !== index));
  }

  // List operations
  const totalListRows = listSections.reduce((sum, s) => sum + s.rows.length, 0);

  function handleAddListRow(sectionIndex: number) {
    if (totalListRows >= 10) {
      toast.error('WhatsApp limits interactive lists to a maximum of 10 total items');
      return;
    }
    const updated = [...listSections];
    const nextIdx = updated[sectionIndex].rows.length + 1;
    updated[sectionIndex].rows.push({
      id: `row_${Date.now()}`,
      title: `Item ${nextIdx}`,
      description: 'Short description',
    });
    setListSections(updated);
  }

  function handleUpdateListRow(
    sectionIndex: number,
    rowIndex: number,
    field: keyof ListRowItem,
    val: string
  ) {
    const updated = [...listSections];
    updated[sectionIndex].rows[rowIndex] = {
      ...updated[sectionIndex].rows[rowIndex],
      [field]: val,
    };
    setListSections(updated);
  }

  function handleDeleteListRow(sectionIndex: number, rowIndex: number) {
    if (totalListRows <= 1) {
      toast.error('List menu requires at least 1 row');
      return;
    }
    const updated = [...listSections];
    updated[sectionIndex].rows = updated[sectionIndex].rows.filter((_, i) => i !== rowIndex);
    setListSections(updated);
  }

  function handleUpdateSectionTitle(sectionIndex: number, title: string) {
    const updated = [...listSections];
    updated[sectionIndex].title = title;
    setListSections(updated);
  }

  // Carousel Operations
  async function handleOpenStoreCatalogPicker() {
    setShowProductCatalogModal(true);
    if (storeProductsList.length === 0) {
      setIsLoadingStoreProducts(true);
      try {
        const res = await fetch('/api/products');
        if (res.ok) {
          const data = await res.json();
          setStoreProductsList(Array.isArray(data.products) ? data.products : []);
        }
      } catch (e) {
        console.error('Failed to load products:', e);
      } finally {
        setIsLoadingStoreProducts(false);
      }
    }
  }

  function handleAddProductToCarousel(prod: any) {
    if (carouselCards.length >= 10) {
      toast.error('Maximum 10 carousel cards allowed');
      return;
    }
    const newCard: CarouselCardItem = {
      id: `card_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      image: prod.image_url || '',
      title: prod.name?.slice(0, 35) || 'Store Product',
      description: prod.description?.slice(0, 85) || `Category: ${prod.category || 'Custom Prints'}`,
      price: String(prod.price || '299'),
      buttons: [
        { id: `order_${prod.id}`, title: '🛍️ Order Now', type: 'quick_reply' },
        { id: `view_${prod.id}`, title: '🌐 View', url: `https://pratapstore.in/products/${prod.id}`, type: 'url' },
      ],
    };
    setCarouselCards((prev) => [...prev, newCard]);
    toast.success(`Added "${prod.name}" to carousel`);
  }

  function handleAddBlankCarouselCard() {
    if (carouselCards.length >= 10) {
      toast.error('Maximum 10 carousel cards allowed');
      return;
    }
    const idx = carouselCards.length + 1;
    setCarouselCards((prev) => [
      ...prev,
      {
        id: `card_${Date.now()}`,
        image: '',
        title: `Product Card ${idx}`,
        description: 'Personalized with your custom photo or text',
        price: '349',
        buttons: [
          { id: `order_${idx}`, title: '🛍️ Order Now', type: 'quick_reply' },
          { id: `view_${idx}`, title: '🌐 Details', url: 'https://pratapstore.in', type: 'url' },
        ],
      },
    ]);
  }

  function handleUpdateCarouselCard(cardIdx: number, field: keyof CarouselCardItem, value: any) {
    setCarouselCards((prev) => {
      const copy = [...prev];
      copy[cardIdx] = { ...copy[cardIdx], [field]: value };
      return copy;
    });
  }

  function handleDeleteCarouselCard(cardIdx: number) {
    if (carouselCards.length <= 2) {
      toast.error('WhatsApp carousel requires at least 2 cards');
      return;
    }
    setCarouselCards((prev) => prev.filter((_, idx) => idx !== cardIdx));
  }

  function handleUpdateCardButton(cardIdx: number, btnIdx: number, field: 'title' | 'url', value: string) {
    setCarouselCards((prev) => {
      const copy = [...prev];
      const card = { ...copy[cardIdx] };
      const btns = [...(card.buttons || [])];
      while (btns.length <= btnIdx) {
        btns.push({ id: `btn_${btnIdx}`, title: 'Button', type: 'quick_reply' });
      }
      btns[btnIdx] = { ...btns[btnIdx], [field]: value };
      card.buttons = btns;
      copy[cardIdx] = card;
      return copy;
    });
  }

  // Phone Numbers Operations
  function handleAddRow() {
    const newRow: RecipientRow = {
      id: Date.now().toString(),
      name: '',
      number: '',
      var1: '',
    };
    setRecipients([...recipients, newRow]);
    setEditingId(newRow.id);
  }

  function handleDeleteRow(id: string) {
    setRecipients(recipients.filter((r) => r.id !== id));
  }

  function handleUpdateRow(id: string, field: keyof RecipientRow, val: string) {
    setRecipients(
      recipients.map((r) => (r.id === id ? { ...r, [field]: val } : r))
    );
  }

  function handleClearAll() {
    if (confirm('Are you sure you want to clear all recipient numbers?')) {
      setRecipients([]);
    }
  }

  function handleClearInvalid() {
    const valid = recipients.filter((r) => {
      const digits = r.number.replace(/\D/g, '');
      return digits.length >= 10 && digits.length <= 15;
    });
    const removed = recipients.length - valid.length;
    setRecipients(valid);
    toast.success(`Removed ${removed} invalid numbers!`);
  }

  function handleRemoveDuplicates() {
    const seen = new Set<string>();
    const unique: RecipientRow[] = [];
    for (const r of recipients) {
      const clean = r.number.replace(/\D/g, '');
      if (clean && !seen.has(clean)) {
        seen.add(clean);
        unique.push(r);
      }
    }
    const removed = recipients.length - unique.length;
    setRecipients(unique);
    toast.success(`Removed ${removed} duplicate numbers!`);
  }

  function handleInsertCountryCode() {
    const code = countryCodeInput.replace(/\D/g, '') || '91';
    let updatedCount = 0;
    const updated = recipients.map((r) => {
      const clean = r.number.replace(/\D/g, '');
      if (clean.length === 10) {
        updatedCount++;
        return { ...r, number: `${code}${clean}` };
      }
      return r;
    });
    setRecipients(updated);
    setShowCountryCodeModal(false);
    toast.success(`Added country code +${code} to ${updatedCount} numbers!`);
  }

  // Manual Import
  function handleManualImportSubmit() {
    const lines = manualText.split('\n');
    const newItems: RecipientRow[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const parts = trimmed.split(/[,;\t]/).map((p) => p.trim());
      const rawNum = parts[0] || '';
      const name = parts[1] || '';
      const var1 = parts[2] || '';
      if (rawNum) {
        newItems.push({
          id: Math.random().toString(),
          number: rawNum,
          name,
          var1,
        });
      }
    }
    setRecipients([...recipients, ...newItems]);
    setManualText('');
    setShowManualImport(false);
    toast.success(`Imported ${newItems.length} recipients!`);
  }

  // Number Generator
  function handleGenerateSubmit() {
    const startNum = parseInt(genStart.replace(/\D/g, ''), 10);
    if (isNaN(startNum)) {
      toast.error('Invalid starting number');
      return;
    }
    const prefix = genPrefix.replace(/\D/g, '');
    const newItems: RecipientRow[] = [];
    for (let i = 0; i < genCount; i++) {
      const num = `${prefix}${startNum + i}`;
      newItems.push({
        id: Math.random().toString(),
        number: num,
        name: `Lead ${i + 1}`,
        var1: '',
      });
    }
    setRecipients([...recipients, ...newItems]);
    setShowGenerator(false);
    toast.success(`Generated ${genCount} consecutive numbers!`);
  }

  // CSV Import
  function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const lines = content.split(/\r\n|\n/);
      const newItems: RecipientRow[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        if (i === 0 && (line.toLowerCase().includes('phone') || line.toLowerCase().includes('number'))) {
          continue;
        }
        const parts = line.split(/[,;\t]/).map((p) => p.replace(/^["']|["']$/g, '').trim());
        const phone = parts[0] || parts[1] || '';
        const name = parts[0] && isNaN(Number(parts[0])) ? parts[0] : parts[1] || '';
        const actualPhone = isNaN(Number(parts[0])) ? parts[1] : parts[0];
        const var1 = parts[2] || '';

        if (actualPhone) {
          newItems.push({
            id: Math.random().toString(),
            number: actualPhone,
            name: name || '',
            var1,
          });
        }
      }
      setRecipients([...recipients, ...newItems]);
      toast.success(`Imported ${newItems.length} contacts from CSV!`);
    };
    reader.readAsText(file);
    if (csvFileInputRef.current) csvFileInputRef.current.value = '';
  }

  // Download Sample CSV
  function handleDownloadSample() {
    const csvContent =
      'data:text/csv;charset=utf-8,Number,Name,Variable1\n919876543210,Rahul Sharma,Exclusive 20% Off\n919876543211,Priya Verma,Free Shipping\n919876543212,Amit Singh,Buy 1 Get 1';
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'wacrm_sample_numbers.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Send Campaign
  async function handleSendCampaign() {
    if (!campaignName.trim()) {
      toast.error('Please enter a campaign name');
      return;
    }
    if (recipients.length === 0) {
      toast.error('Please add at least one recipient number');
      return;
    }
    if (messageType === 'template') {
      if (!selectedMetaTemplateName) {
        toast.error('Please select an Approved Meta Template');
        return;
      }
    } else if (!messageText.trim() && !mediaUrl.trim()) {
      toast.error('Please compose a message or upload media');
      return;
    }

    if (messageType === 'buttons') {
      if (buttons.length === 0) {
        toast.error('Please add at least 1 button for Button messages');
        return;
      }
      for (const b of buttons) {
        if (!b.title.trim()) {
          toast.error('Each button must have a title');
          return;
        }
        if (b.title.length > 20) {
          toast.error(`Button title "${b.title}" exceeds WhatsApp 20 character limit`);
          return;
        }
      }
    }

    if (messageType === 'list') {
      if (!listButtonLabel.trim()) {
        toast.error('Please enter a Menu Button Label (e.g. "Select Option")');
        return;
      }
      if (totalListRows === 0) {
        toast.error('Please add at least 1 item row in the list menu');
        return;
      }
      if (totalListRows > 10) {
        toast.error('WhatsApp limits interactive lists to 10 total items');
        return;
      }
    }

    if (messageType === 'carousel') {
      if (carouselCards.length < 2) {
        toast.error('WhatsApp Carousel requires at least 2 product cards (up to 10)');
        return;
      }
      if (carouselCards.length > 10) {
        toast.error('WhatsApp limits carousel messages to a maximum of 10 cards');
        return;
      }
      for (let i = 0; i < carouselCards.length; i++) {
        const c = carouselCards[i];
        if (!c.title.trim()) {
          toast.error(`Card #${i + 1} must have a product title`);
          return;
        }
      }
    }

    setIsSending(true);
    setShowProgressModal(true);
    setSendProgress({ current: 0, total: recipients.length, sent: 0, failed: 0 });
    setSendLogs([]);

    try {
      const res = await fetch('/api/whatsapp/campaign-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignName,
          instance: selectedInstance,
          messageType,
          templateName: messageType === 'template' ? selectedMetaTemplateName : undefined,
          templateLanguage: 'en_US',
          messageText,
          mediaUrl: mediaUrl || undefined,
          headerText: headerText || undefined,
          footerText: footerText || undefined,
          buttons: messageType === 'buttons' ? buttons : undefined,
          listConfig:
            messageType === 'list'
              ? {
                  buttonLabel: listButtonLabel,
                  sections: listSections,
                }
              : undefined,
          carouselCards: messageType === 'carousel' ? carouselCards : undefined,
          recipients: recipients.map((r) => ({
            phone: r.number,
            name: r.name,
            var1: r.var1,
          })),
          delaySeconds,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to dispatch campaign');
      }

      setSendProgress({
        current: recipients.length,
        total: recipients.length,
        sent: data.sent,
        failed: data.failed,
      });
      setSendLogs(data.results || []);

      if (data.sent > 0) {
        toast.success(`Campaign sent successfully! ${data.sent} sent, ${data.failed} failed.`);
      } else {
        toast.error(`All ${data.failed} messages failed. Please check error details.`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Error executing campaign');
    } finally {
      setIsSending(false);
    }
  }

  // Filtered recipients
  const filteredRecipients = recipients.filter((r) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.number.toLowerCase().includes(q) ||
      r.name.toLowerCase().includes(q) ||
      r.var1.toLowerCase().includes(q)
    );
  });

  const validCount = recipients.filter((r) => r.number.replace(/\D/g, '').length >= 10).length;
  const invalidCount = recipients.length - validCount;

  return (
    <div className="flex-1 space-y-6 p-6 max-w-7xl mx-auto pb-32">
      {/* Hidden file inputs */}
      <input
        type="file"
        ref={csvFileInputRef}
        onChange={handleCsvUpload}
        accept=".csv,.txt,.xlsx"
        className="hidden"
      />
      <input
        type="file"
        ref={mediaFileInputRef}
        onChange={handleMediaUpload}
        accept="image/*,application/pdf,video/*"
        className="hidden"
      />

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Send className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Send Message
                <Badge variant="outline" className="text-xs font-normal border-primary/30 text-primary bg-primary/5">
                  Campaign &amp; Interactive Sender
                </Badge>
              </h1>
              <p className="text-sm text-muted-foreground">
                Broadcast personalized text, buttons, list menus, and uploaded media directly to customers.
              </p>
            </div>
          </div>
        </div>

        {/* Device & Channel Status Banner */}
        <div className="flex flex-wrap items-center gap-2">
          {isBaileysConnected ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Linked WhatsApp: {linkedPhoneNumber}</span>
            </div>
          ) : isMetaConnected ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Meta Cloud API: {metaPhoneNumber} (Active)</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-medium">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>WhatsApp QR Disconnected</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowQrModal(true)}
                className="gap-1.5 border-primary/40 text-primary hover:bg-primary/10"
              >
                <QrCode className="w-4 h-4" />
                Link WhatsApp (QR Scan)
              </Button>
            </div>
          )}

          {isBaileysConnected && isMetaConnected && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20 text-primary text-[11px]">
              <span>Meta Cloud Also Active</span>
            </div>
          )}
        </div>
      </div>

      {/* Section 1: Campaign Configuration */}
      <Card className="border-border/50 bg-card/60 backdrop-blur-sm shadow-sm">
        <CardHeader className="py-4 border-b border-border/40">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded bg-muted text-muted-foreground text-xs font-semibold">1</span>
            <CardTitle className="text-base font-semibold">Campaign &amp; Message Type</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Name the campaign, choose sending channel, and select message format (Text, Media, Buttons, or List Menu).
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="text-xs font-medium text-foreground mb-1.5 block">
              <span className="text-destructive">*</span> Campaign Name
            </label>
            <Input
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="e.g. Diwali Flash Sale"
              className="bg-background/50 h-9"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-foreground mb-1.5 block">
              Preset Template
            </label>
            <Select value={selectedTemplateId} onValueChange={handleTemplateSelect}>
              <SelectTrigger className="bg-background/50 h-9">
                <SelectValue placeholder="Select template" />
              </SelectTrigger>
              <SelectContent>
                {PRESET_TEMPLATES.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-medium text-foreground mb-1.5 block">
              <span className="text-destructive">*</span> Sending Channel
            </label>
            <Select value={selectedInstance} onValueChange={(val) => val && setSelectedInstance(val)}>
              <SelectTrigger className="bg-background/50 h-9">
                <SelectValue placeholder="Select channel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">
                  {isBaileysConnected
                    ? `Auto (Linked WhatsApp: ${linkedPhoneNumber})`
                    : isMetaConnected
                    ? `Auto (Meta Cloud API: ${metaPhoneNumber})`
                    : 'Auto (Recommended)'}
                </SelectItem>
                <SelectItem value="meta">
                  {isMetaConnected ? `Meta Cloud API (${metaPhoneNumber})` : 'Meta Cloud API (Official Cloud)'}
                </SelectItem>
                <SelectItem value="baileys">
                  {isBaileysConnected ? `Linked WhatsApp (${linkedPhoneNumber})` : 'Linked WhatsApp Web (QR)'}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-medium text-foreground mb-1.5 block">
              <span className="text-destructive">*</span> Message Type
            </label>
            <Select
              value={messageType}
              onValueChange={(val) =>
                val &&
                setMessageType(val as 'template' | 'text' | 'media' | 'buttons' | 'list' | 'carousel')
              }
            >
              <SelectTrigger className="bg-background/50 h-9 font-medium">
                <SelectValue placeholder="Message type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="template">
                  ⭐ 📋 Meta Approved Template (100% Delivery to ANY New Customer)
                </SelectItem>
                <SelectItem value="carousel">
                  🎠 🛍️ WhatsApp Product Carousel (Swipeable Showcase Cards)
                </SelectItem>
                <SelectItem value="buttons">🔘 Interactive Buttons (1–3 Quick Replies)</SelectItem>
                <SelectItem value="list">📋 Interactive List Menu (Expandable Menu)</SelectItem>
                <SelectItem value="text">📝 Text Message (24h Window / QR)</SelectItem>
                <SelectItem value="media">🖼️ Media Image / Banner / PDF (24h Window / QR)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Manual Upload Media Box (Available for 'media', 'buttons', and 'text') */}
      {(messageType === 'media' || messageType === 'buttons' || mediaUrl) && (
        <Card className="border-border/50 bg-card/60 backdrop-blur-sm shadow-sm border-l-4 border-l-primary">
          <CardHeader className="py-3 border-b border-border/40">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-primary" />
                <CardTitle className="text-sm font-semibold">
                  Media Attachment (Image / Banner / PDF / Video)
                </CardTitle>
                {messageType === 'buttons' && (
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">
                    Optional Header Banner
                  </Badge>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowManualMediaUrl(!showManualMediaUrl)}
                className="text-xs h-7 text-muted-foreground hover:text-foreground"
              >
                {showManualMediaUrl ? 'Switch to File Upload' : 'Or paste URL directly'}
              </Button>
            </div>
          </CardHeader>

          <CardContent className="pt-4">
            {!showManualMediaUrl ? (
              <div className="space-y-3">
                {mediaUrl ? (
                  /* Uploaded File Preview Card */
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-3.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5">
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      {mediaUrl.toLowerCase().includes('.pdf') ? (
                        <div className="w-14 h-14 rounded-lg bg-red-500/10 border border-red-500/20 flex flex-col items-center justify-center text-red-400">
                          <FileText className="w-7 h-7" />
                          <span className="text-[9px] font-bold uppercase mt-0.5">PDF</span>
                        </div>
                      ) : mediaUrl.toLowerCase().match(/\.(mp4|mov|avi|mkv)$/i) ? (
                        <div className="w-14 h-14 rounded-lg bg-blue-500/10 border border-blue-500/20 flex flex-col items-center justify-center text-blue-400">
                          <Film className="w-7 h-7" />
                          <span className="text-[9px] font-bold uppercase mt-0.5">VIDEO</span>
                        </div>
                      ) : (
                        <div className="w-14 h-14 rounded-lg overflow-hidden border border-border/60 bg-black/40 flex-shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={mediaUrl}
                            alt="Media Preview"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-xs text-foreground truncate max-w-xs">
                            {uploadedFileName || mediaUrl.split('/').pop()?.split('?')[0] || 'Uploaded Media'}
                          </span>
                          <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px] py-0">
                            Uploaded &amp; Ready
                          </Badge>
                        </div>
                        {uploadedFileSize && (
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            Size: {uploadedFileSize}
                          </div>
                        )}
                        <a
                          href={mediaUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-primary hover:underline flex items-center gap-1 mt-0.5"
                        >
                          View full media <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => mediaFileInputRef.current?.click()}
                        disabled={isUploadingMedia}
                        className="h-8 text-xs gap-1.5"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        Change File
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={handleRemoveMedia}
                        className="h-8 text-xs text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" />
                        Remove
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* Drag and Drop / Upload Button */
                  <div
                    onClick={() => mediaFileInputRef.current?.click()}
                    className="border-2 border-dashed border-border/60 hover:border-primary/50 bg-background/30 hover:bg-muted/30 transition-all rounded-xl p-6 text-center cursor-pointer group"
                  >
                    <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center text-primary mb-3 transition-colors">
                      {isUploadingMedia ? (
                        <RefreshCw className="w-6 h-6 animate-spin" />
                      ) : (
                        <Upload className="w-6 h-6" />
                      )}
                    </div>
                    <div className="font-medium text-xs text-foreground mb-1">
                      {isUploadingMedia ? (
                        <span>Uploading media to secure CRM storage...</span>
                      ) : (
                        <span>Click to upload Image, Banner, PDF, or Video from device</span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
                      Supports PNG, JPG, WEBP, GIF, PDF documents &amp; MP4 videos up to 16 MB.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              /* Direct URL Input */
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground block">
                  Media Direct Public URL (Image / Banner / PDF / Video)
                </label>
                <div className="flex gap-2">
                  <Input
                    value={mediaUrl}
                    onChange={(e) => setMediaUrl(e.target.value)}
                    placeholder="https://yourstore.com/banner.jpg"
                    className="bg-background/50 h-9 font-mono text-xs flex-1"
                  />
                  {mediaUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveMedia}
                      className="h-9 text-destructive hover:bg-destructive/10"
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Section 2: Phone Numbers & Audience */}
      <Card className="border-border/50 bg-card/60 backdrop-blur-sm shadow-sm">
        <CardHeader className="py-4 border-b border-border/40">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1 rounded bg-muted text-muted-foreground text-xs font-semibold">2</span>
                <CardTitle className="text-base font-semibold">Phone Numbers</CardTitle>
                <Badge variant="secondary" className="text-xs font-normal">
                  {recipients.length} Contacts
                </Badge>
              </div>
              <CardDescription className="text-xs mt-0.5">
                Import a list, or add rows by hand. Supports dynamic personalization variables.
              </CardDescription>
            </div>

            {/* Action Buttons Toolbar */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => csvFileInputRef.current?.click()}
                className="h-8 gap-1.5 text-xs bg-background/50"
              >
                <Upload className="w-3.5 h-3.5" />
                Import CSV
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowManualImport(true)}
                className="h-8 gap-1.5 text-xs bg-background/50"
              >
                <Edit2 className="w-3.5 h-3.5" />
                Manual Import
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowGenerator(true)}
                className="h-8 gap-1.5 text-xs bg-background/50"
              >
                <Hash className="w-3.5 h-3.5" />
                Number Generator
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleAddRow}
                className="h-8 gap-1.5 text-xs bg-background/50"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Contact Row
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDownloadSample}
                className="h-8 gap-1.5 text-xs text-muted-foreground"
              >
                <Download className="w-3.5 h-3.5" />
                Sample CSV
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-4 space-y-3">
          {/* List Controls & Cleaning Tools */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/20 p-2.5 rounded-lg border border-border/30">
            <div className="flex items-center gap-2 flex-1 min-w-[240px] max-w-sm">
              <div className="relative w-full">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search name, number or variable..."
                  className="h-8 pl-8 text-xs bg-background/60"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1.5 text-xs cursor-pointer text-muted-foreground select-none px-2">
                <input
                  type="checkbox"
                  checked={excludeUnsubscribes}
                  onChange={(e) => setExcludeUnsubscribes(e.target.checked)}
                  className="rounded border-border text-primary"
                />
                Exclude Unsubscribes
              </label>

              <Button
                size="sm"
                variant="outline"
                onClick={handleClearInvalid}
                className="h-7 text-xs px-2.5 bg-background/50 hover:bg-destructive/10 hover:text-destructive"
              >
                Clear Invalid Numbers
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowCountryCodeModal(true)}
                className="h-7 text-xs px-2.5 bg-background/50 text-primary border-primary/30"
              >
                Insert Country Code (+91)
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={handleRemoveDuplicates}
                className="h-7 text-xs px-2.5 bg-background/50"
              >
                Remove Duplicates
              </Button>

              <Button
                size="sm"
                variant="ghost"
                onClick={handleClearAll}
                className="h-7 text-xs px-2 text-destructive hover:bg-destructive/10"
              >
                Clear All
              </Button>
            </div>
          </div>

          {/* Numbers Table */}
          <div className="border border-border/40 rounded-lg overflow-hidden bg-background/40">
            <div className="max-h-[280px] overflow-y-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/40 text-muted-foreground uppercase tracking-wider font-semibold sticky top-0 backdrop-blur-md border-b border-border/40">
                  <tr>
                    <th className="py-2.5 px-3 w-12 text-center">SN</th>
                    <th className="py-2.5 px-3">Name</th>
                    <th className="py-2.5 px-3">Phone Number</th>
                    <th className="py-2.5 px-3">Variable 1</th>
                    <th className="py-2.5 px-3 w-20 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {filteredRecipients.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-muted-foreground">
                        No phone numbers added yet. Click &quot;Import CSV&quot;, &quot;Manual Import&quot;, or &quot;Add Contact Row&quot;.
                      </td>
                    </tr>
                  ) : (
                    filteredRecipients.map((row, idx) => (
                      <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-2 px-3 text-center text-muted-foreground">{idx + 1}</td>
                        <td className="py-2 px-3">
                          <Input
                            value={row.name}
                            onChange={(e) => handleUpdateRow(row.id, 'name', e.target.value)}
                            placeholder="Enter Name"
                            className="h-7 text-xs bg-transparent border-transparent hover:border-border/40 focus:border-primary"
                          />
                        </td>
                        <td className="py-2 px-3 font-mono">
                          <Input
                            value={row.number}
                            onChange={(e) => handleUpdateRow(row.id, 'number', e.target.value)}
                            placeholder="e.g. 919876543210"
                            className={`h-7 text-xs bg-transparent border-transparent hover:border-border/40 focus:border-primary ${
                              row.number.replace(/\D/g, '').length < 10 ? 'text-destructive font-semibold' : ''
                            }`}
                          />
                        </td>
                        <td className="py-2 px-3">
                          <Input
                            value={row.var1}
                            onChange={(e) => handleUpdateRow(row.id, 'var1', e.target.value)}
                            placeholder="Extra Note / Value"
                            className="h-7 text-xs bg-transparent border-transparent hover:border-border/40 focus:border-primary"
                          />
                        </td>
                        <td className="py-2 px-3 text-center">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleDeleteRow(row.id)}
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between p-2.5 bg-muted/20 border-t border-border/40 text-xs text-muted-foreground">
              <span>
                Total Contacts: <strong className="text-foreground">{recipients.length}</strong> (Valid: {validCount}, Invalid: {invalidCount})
              </span>
              <span>Showing {filteredRecipients.length} entries</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Smart Hint Banner for New Customers */}
      {messageType !== 'template' && (
        <div className="flex items-start gap-3 p-3.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-200 text-xs shadow-sm">
          <Sparkles className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
          <div className="flex-1 space-y-1">
            <div className="font-semibold text-amber-300">
              Sending to New Customers? (WhatsApp 24-Hour Rule)
            </div>
            <div className="text-amber-200/90 leading-relaxed">
              Meta WhatsApp Cloud API blocks custom text/media to new numbers who haven&apos;t messaged you in 24 hours (Error 131047). To guarantee 100% instant delivery to ANY new customer, select <strong>Meta Approved Template</strong>. Or link your phone via <strong>WhatsApp QR</strong> to send custom text/buttons to anyone without restrictions.
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setMessageType('template')}
                className="h-7 text-xs bg-amber-500/20 border-amber-500/40 hover:bg-amber-500/30 text-amber-100"
              >
                ⭐ Switch to Meta Approved Template
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowQrModal(true)}
                className="h-7 text-xs text-amber-300 hover:text-amber-100 hover:bg-amber-500/20"
              >
                Scan WhatsApp QR Code →
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Section 3: Message Composer */}
      <Card className="border-border/50 bg-card/60 backdrop-blur-sm shadow-sm">
        <CardHeader className="py-4 border-b border-border/40">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded bg-muted text-muted-foreground text-xs font-semibold">3</span>
            <CardTitle className="text-base font-semibold">
              {messageType === 'template'
                ? 'Meta Approved Template Selector'
                : messageType === 'carousel'
                ? 'WhatsApp Product Carousel Showcase Builder'
                : messageType === 'buttons'
                ? 'Interactive Button Message Builder'
                : messageType === 'list'
                ? 'Interactive List Menu Builder'
                : 'Message Content'}
            </CardTitle>
          </div>
          <CardDescription className="text-xs">
            {messageType === 'template'
              ? 'WhatsApp guarantees 100% instant delivery for approved templates to ANY new customer, opening the 24-hour chat window.'
              : messageType === 'carousel'
              ? 'Build a multi-card swipeable showcase (2 to 10 cards) with product images, titles, prices, and 1-tap action buttons.'
              : messageType === 'buttons'
              ? 'Configure WhatsApp Quick Reply buttons (up to 3 buttons) that recipients can tap with 1 click.'
              : messageType === 'list'
              ? 'Configure a tap-to-expand list menu (up to 10 rows) with section headings and row descriptions.'
              : 'Insert contact columns ({{Name}}, {{Number}}) to personalize each send.'}
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-4 space-y-4">
          {messageType === 'template' ? (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-foreground">
                    <span className="text-destructive">*</span> Select Approved Template
                  </label>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={fetchApprovedTemplates}
                    className="h-6 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
                  >
                    <RefreshCw className="w-3 h-3" /> Refresh Templates
                  </Button>
                </div>
                <Select
                  value={selectedMetaTemplateName}
                  onValueChange={(val) => val && setSelectedMetaTemplateName(val)}
                >
                  <SelectTrigger className="bg-background/50 h-10 font-medium">
                    <SelectValue placeholder="Choose a Meta template" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[350px] overflow-y-auto">
                    {approvedTemplates.map((t) => (
                      <SelectItem key={t.id} value={t.name}>
                        <div className="flex items-center justify-between w-full gap-3 text-left">
                          <span className="font-medium text-foreground">{t.name}</span>
                          <span className="text-[11px] text-muted-foreground shrink-0">
                            {t.status === 'APPROVED' ? '✓ Approved' : t.status === 'PENDING' ? '⏳ In Review' : '📝 Draft'} • {t.category || 'Marketing'}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Template Live Inspector Card */}
              {(() => {
                const activeTmpl =
                  approvedTemplates.find((t) => t.name === selectedMetaTemplateName) ||
                  approvedTemplates[0];
                if (!activeTmpl) {
                  return (
                    <div className="p-4 rounded-lg bg-muted/20 border border-border/40 text-center text-xs text-muted-foreground">
                      No approved templates found. Please create or sync templates in Settings &gt; WhatsApp.
                    </div>
                  );
                }

                const sampleName = recipients[0]?.name || 'Rahul Sharma';
                const sampleVar1 = recipients[0]?.var1 || '10% OFF';
                const previewBody = (activeTmpl.body_text || '')
                  .replace(/\{\{1\}\}/g, sampleName)
                  .replace(/\{\{2\}\}/g, sampleVar1);

                return (
                  <div className="p-4 rounded-xl bg-card border border-border/60 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-border/40">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-foreground">
                          {activeTmpl.name}
                        </span>
                        <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                          {activeTmpl.category || 'Marketing'}
                        </Badge>
                        {activeTmpl.status === 'APPROVED' ? (
                          <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                            ✓ APPROVED by Meta
                          </Badge>
                        ) : activeTmpl.status === 'PENDING' ? (
                          <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-400 border-amber-500/20">
                            ⏳ In Meta Review
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-400 border-blue-500/20">
                            📝 Draft
                          </Badge>
                        )}
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        Language: {activeTmpl.language || 'en_US'}
                      </span>
                    </div>

                    {activeTmpl.header_content && (
                      <div className="text-xs font-bold text-primary">
                        {activeTmpl.header_content}
                      </div>
                    )}

                    <div className="text-xs text-muted-foreground">
                      Body Preview:
                    </div>
                    <div className="p-3 rounded-lg bg-muted/30 border border-border/30 text-xs text-foreground whitespace-pre-wrap leading-relaxed">
                      {previewBody}
                    </div>

                    {activeTmpl.footer_text && (
                      <div className="text-[11px] text-muted-foreground italic">
                        Footer: {activeTmpl.footer_text}
                      </div>
                    )}

                    {Array.isArray(activeTmpl.buttons) && activeTmpl.buttons.length > 0 && (
                      <div className="pt-2 border-t border-border/40">
                        <div className="text-[11px] font-medium text-muted-foreground mb-1.5">
                          Interactive Quick Reply Buttons:
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {activeTmpl.buttons.map((btn: any, idx: number) => (
                            <span
                              key={idx}
                              className="px-2.5 py-1 rounded bg-primary/15 text-primary text-xs font-medium border border-primary/20"
                            >
                              🔘 {btn.text || btn.title || `Button ${idx + 1}`}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {activeTmpl.status === 'APPROVED' ? (
                      isBaileysConnected ? (
                        <div className="p-2.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>
                            <strong>100% Guaranteed Direct Delivery:</strong> WhatsApp is linked via QR! Messages will send directly from your phone with 0 Meta restrictions, 0 rate limits, and 0 fees.
                          </span>
                        </div>
                      ) : (
                        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-200 text-xs space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 font-medium text-amber-300">
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                              <span>Meta Approved Template</span>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setShowQrModal(true)}
                              className="h-6 text-[11px] gap-1 px-2 border-primary/40 text-primary hover:bg-primary/10"
                            >
                              <QrCode className="h-3 w-3" />
                              Link Phone (QR)
                            </Button>
                          </div>
                          <p className="text-[11px] text-amber-200/90 leading-relaxed">
                            Meta Cloud API accepts this template for new customer outreach. If Meta throttles cold numbers (Error 130429) due to unverified billing, simply link your phone via <strong>WhatsApp QR</strong> for 100% unrestricted direct delivery.
                          </p>
                        </div>
                      )
                    ) : (
                      <div className="p-2.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>
                          <strong>Meta Review Pending:</strong> This template is currently in review by Meta. You can send it instantly using Linked WhatsApp (QR) or choose an approved template above.
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          ) : (
            <>
              {/* Header Text (for Buttons or List) */}
              {(messageType === 'buttons' || messageType === 'list') && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-foreground">
                  Header Title <span className="text-muted-foreground font-normal">(Optional, max 60 chars)</span>
                </label>
                <span className="text-[11px] text-muted-foreground">{headerText.length}/60</span>
              </div>
              <Input
                value={headerText}
                maxLength={60}
                onChange={(e) => setHeaderText(e.target.value)}
                placeholder="e.g. Pratap Store Specials 🔥"
                className="bg-background/50 h-9 text-xs"
              />
            </div>
          )}

          {/* Formatting & Insert Toolbar */}
          <div className="flex flex-wrap items-center gap-1.5 p-2 bg-muted/30 rounded-lg border border-border/40">
            {/* Variable Tag Inserters */}
            <div className="flex items-center gap-1 border-r border-border/40 pr-2 mr-1">
              <span className="text-xs font-medium text-muted-foreground mr-1">Use Column:</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => insertTag('{{Name}}')}
                className="h-7 text-xs px-2 bg-background/50 hover:bg-primary/10 hover:text-primary"
              >
                + &#123;&#123;Name&#125;&#125;
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => insertTag('{{Number}}')}
                className="h-7 text-xs px-2 bg-background/50 hover:bg-primary/10 hover:text-primary"
              >
                + &#123;&#123;Number&#125;&#125;
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => insertTag('{{Variable1}}')}
                className="h-7 text-xs px-2 bg-background/50 hover:bg-primary/10 hover:text-primary"
              >
                + &#123;&#123;Variable1&#125;&#125;
              </Button>
            </div>

            {/* Quick Styling Buttons */}
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                onClick={() => insertFormatting('*', '*')}
                className="h-7 w-7 text-xs font-bold"
                title="Bold (*text*)"
              >
                <Bold className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => insertFormatting('_', '_')}
                className="h-7 w-7 text-xs italic"
                title="Italic (_text_)"
              >
                <Italic className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => insertFormatting('~', '~')}
                className="h-7 w-7 text-xs line-through"
                title="Strikethrough (~text~)"
              >
                <Strikethrough className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => insertFormatting('```', '```')}
                className="h-7 w-7 text-xs font-mono"
                title="Monospace (```text```)"
              >
                <Code className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => insertFormatting('\n▪️ ')}
                className="h-7 w-7 text-xs"
                title="Bullet point"
              >
                <ListIcon className="w-3.5 h-3.5" />
              </Button>
            </div>

            {/* Quick Emojis */}
            <div className="flex items-center gap-0.5 border-l border-border/40 pl-2 ml-1">
              {['🙏', '✨', '🛍️', '🔥', '🎉', '🎁', '⚡', '📦', '❤️'].map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => insertTag(emoji)}
                  className="hover:scale-125 transition-transform p-1 text-sm rounded hover:bg-background/80"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Message Textarea */}
          <div className="relative">
            <label className="text-xs font-medium text-foreground mb-1 block">
              <span className="text-destructive">*</span> Body Text
            </label>
            <Textarea
              ref={textareaRef}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Type your WhatsApp message here... Format with *bold*, _italic_, or {{Name}} tags."
              rows={6}
              className="font-sans text-sm bg-background/50 border-border/50 focus:border-primary p-3"
            />
            <div className="absolute right-3 bottom-2.5 text-[11px] text-muted-foreground pointer-events-none">
              {messageText.length} characters
            </div>
          </div>

          {/* Footer Text (for Buttons or List) */}
          {(messageType === 'buttons' || messageType === 'list') && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-foreground">
                  Footer Line <span className="text-muted-foreground font-normal">(Optional subtle grey text, max 60 chars)</span>
                </label>
                <span className="text-[11px] text-muted-foreground">{footerText.length}/60</span>
              </div>
              <Input
                value={footerText}
                maxLength={60}
                onChange={(e) => setFooterText(e.target.value)}
                placeholder="e.g. Pratap Store • Pan-India Free Delivery"
                className="bg-background/50 h-9 text-xs"
              />
            </div>
          )}

          {/* BUTTON BUILDER (when messageType === 'buttons') */}
          {messageType === 'buttons' && (
            <div className="border border-border/50 rounded-xl p-4 bg-background/40 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <span>Quick Reply Buttons</span>
                    <Badge variant="outline" className="text-[10px]">
                      {buttons.length} / 3 Buttons
                    </Badge>
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    Recipients tap a button to reply instantly. Meta standard allows max 20 characters per button title.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleAddButton}
                  disabled={buttons.length >= 3}
                  className="h-7 text-xs gap-1 border-primary/30 text-primary hover:bg-primary/10"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Button
                </Button>
              </div>

              <div className="space-y-2 pt-1">
                {buttons.map((btn, idx) => (
                  <div
                    key={btn.id || idx}
                    className="flex items-center gap-2.5 p-2 rounded-lg bg-card/80 border border-border/40"
                  >
                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {idx + 1}
                    </span>
                    <div className="flex-1">
                      <Input
                        value={btn.title}
                        maxLength={20}
                        onChange={(e) => handleUpdateButton(idx, 'title', e.target.value)}
                        placeholder={`Button ${idx + 1} Title (e.g. Browse Catalog)`}
                        className="h-8 text-xs bg-background/50"
                      />
                    </div>
                    <span className="text-[11px] text-muted-foreground w-12 text-right">
                      {btn.title.length}/20
                    </span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDeleteButton(idx)}
                      disabled={buttons.length <= 1}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive flex-shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* LIST BUILDER (when messageType === 'list') */}
          {messageType === 'list' && (
            <div className="border border-border/50 rounded-xl p-4 bg-background/40 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <span>Interactive List Menu</span>
                    <Badge variant="outline" className="text-[10px]">
                      {totalListRows} / 10 Items
                    </Badge>
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    Displays an expandable popup list menu when customer taps the action button on WhatsApp.
                  </p>
                </div>
              </div>

              {/* Menu Button Label */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-foreground">
                    <span className="text-destructive">*</span> Menu Button Label{' '}
                    <span className="text-muted-foreground font-normal">(Text on the WhatsApp trigger button, max 20 chars)</span>
                  </label>
                  <span className="text-[11px] text-muted-foreground">{listButtonLabel.length}/20</span>
                </div>
                <Input
                  value={listButtonLabel}
                  maxLength={20}
                  onChange={(e) => setListButtonLabel(e.target.value)}
                  placeholder="e.g. View Catalog or Select Option"
                  className="bg-background/50 h-9 text-xs"
                />
              </div>

              {/* Sections & Rows */}
              <div className="space-y-4 pt-1">
                {listSections.map((sec, sIdx) => (
                  <div
                    key={sIdx}
                    className="p-3.5 rounded-xl bg-card/90 border border-border/50 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 max-w-sm">
                        <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                          Section {sIdx + 1} Heading (max 24 chars)
                        </label>
                        <Input
                          value={sec.title}
                          maxLength={24}
                          onChange={(e) => handleUpdateSectionTitle(sIdx, e.target.value)}
                          placeholder="e.g. Popular Categories"
                          className="h-7 text-xs bg-background/50 font-semibold"
                        />
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleAddListRow(sIdx)}
                        disabled={totalListRows >= 10}
                        className="h-7 text-xs gap-1 border-primary/30 text-primary hover:bg-primary/10 self-end"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Item
                      </Button>
                    </div>

                    <div className="space-y-2">
                      {sec.rows.map((row, rIdx) => (
                        <div
                          key={row.id || rIdx}
                          className="flex items-center gap-2 p-2 rounded-lg bg-background/40 border border-border/30"
                        >
                          <span className="text-xs text-muted-foreground font-mono w-5 text-center">
                            {rIdx + 1}.
                          </span>
                          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <Input
                              value={row.title}
                              maxLength={24}
                              onChange={(e) => handleUpdateListRow(sIdx, rIdx, 'title', e.target.value)}
                              placeholder="Row Title (e.g. Custom T-Shirts, max 24)"
                              className="h-7 text-xs bg-background/50 font-medium"
                            />
                            <Input
                              value={row.description}
                              maxLength={72}
                              onChange={(e) =>
                                handleUpdateListRow(sIdx, rIdx, 'description', e.target.value)
                              }
                              placeholder="Description (optional, max 72)"
                              className="h-7 text-xs bg-background/50 text-muted-foreground"
                            />
                          </div>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => handleDeleteListRow(sIdx, rIdx)}
                            disabled={totalListRows <= 1}
                            className="h-7 w-7 text-muted-foreground hover:text-destructive flex-shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CAROUSEL BUILDER (when messageType === 'carousel') */}
          {messageType === 'carousel' && (
            <div className="border border-border/50 rounded-xl p-4 bg-background/40 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border/40">
                <div>
                  <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <span>Product Carousel Cards</span>
                    <Badge variant="outline" className="text-[10px] text-primary border-primary/30">
                      {carouselCards.length} / 10 Cards
                    </Badge>
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    Customers receive a multi-card swipeable carousel with photos, titles, prices, and 1-tap action buttons.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleOpenStoreCatalogPicker}
                    className="h-7 text-xs gap-1.5 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 cursor-pointer"
                  >
                    <ShoppingBag className="w-3.5 h-3.5 text-emerald-400" />
                    Pick from Store Catalog
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleAddBlankCarouselCard}
                    disabled={carouselCards.length >= 10}
                    className="h-7 text-xs gap-1 border-primary/30 text-primary hover:bg-primary/10 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Card
                  </Button>
                </div>
              </div>

              {/* Cards List */}
              <div className="space-y-3">
                {carouselCards.map((card, cIdx) => (
                  <div
                    key={card.id || cIdx}
                    className="p-3.5 rounded-xl bg-card border border-border/60 space-y-3 transition-all hover:border-border"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-bold">
                          {cIdx + 1}
                        </span>
                        <span className="text-xs font-semibold text-foreground">
                          Card #{cIdx + 1}: {card.title || 'Untitled Card'}
                        </span>
                        {card.price && (
                          <Badge variant="secondary" className="text-[10px] text-emerald-400 bg-emerald-500/10 font-mono">
                            ₹{card.price}
                          </Badge>
                        )}
                      </div>

                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDeleteCarouselCard(cIdx)}
                        disabled={carouselCards.length <= 2}
                        className="h-7 w-7 text-muted-foreground hover:text-destructive cursor-pointer"
                        title={carouselCards.length <= 2 ? 'Minimum 2 cards required' : 'Delete card'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div className="sm:col-span-2">
                        <label className="text-[10px] text-muted-foreground font-medium block mb-1">
                          Product Title <span className="text-destructive">*</span>
                        </label>
                        <Input
                          value={card.title}
                          maxLength={40}
                          onChange={(e) => handleUpdateCarouselCard(cIdx, 'title', e.target.value)}
                          placeholder="e.g. Custom Photo T-Shirt"
                          className="h-8 text-xs bg-background/50 font-medium"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground font-medium block mb-1">
                          Price (₹)
                        </label>
                        <Input
                          value={card.price}
                          onChange={(e) => handleUpdateCarouselCard(cIdx, 'price', e.target.value)}
                          placeholder="e.g. 399"
                          className="h-8 text-xs bg-background/50 font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-[10px] text-muted-foreground font-medium block mb-1">
                          Description / Highlights
                        </label>
                        <Input
                          value={card.description}
                          maxLength={100}
                          onChange={(e) => handleUpdateCarouselCard(cIdx, 'description', e.target.value)}
                          placeholder="e.g. 100% Cotton with HD photo print"
                          className="h-8 text-xs bg-background/50"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground font-medium block mb-1">
                          Image URL (Optional)
                        </label>
                        <Input
                          value={card.image}
                          onChange={(e) => handleUpdateCarouselCard(cIdx, 'image', e.target.value)}
                          placeholder="https://... / image URL"
                          className="h-8 text-xs bg-background/50 font-mono"
                        />
                      </div>
                    </div>

                    {/* Action Buttons for this card */}
                    <div className="pt-2 border-t border-border/40 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-muted-foreground font-medium block mb-1">
                          Button 1 (Quick Order)
                        </label>
                        <Input
                          value={card.buttons?.[0]?.title || ''}
                          maxLength={20}
                          onChange={(e) => handleUpdateCardButton(cIdx, 0, 'title', e.target.value)}
                          placeholder="Button 1 (e.g. 🛍️ Order Now)"
                          className="h-7 text-xs bg-background/50"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground font-medium block mb-1">
                          Button 2 Link URL (Details)
                        </label>
                        <Input
                          value={card.buttons?.[1]?.url || ''}
                          onChange={(e) => handleUpdateCardButton(cIdx, 1, 'url', e.target.value)}
                          placeholder="https://pratapstore.in/..."
                          className="h-7 text-xs bg-background/50 font-mono"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </CardContent>
  </Card>

      {/* Section 4: Delivery Settings */}
      <Card className="border-border/50 bg-card/60 backdrop-blur-sm shadow-sm">
        <CardHeader className="py-4 border-b border-border/40">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded bg-muted text-muted-foreground text-xs font-semibold">4</span>
            <CardTitle className="text-base font-semibold">Delivery &amp; Anti-Ban Delay</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Send immediately with automatic jitter delay between messages to safeguard your WhatsApp number.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-foreground">Anti-ban Pacing Delay:</label>
              <Select value={delaySeconds.toString()} onValueChange={(val) => val && setDelaySeconds(Number(val))}>
                <SelectTrigger className="h-8 w-36 bg-background/50 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 second / msg</SelectItem>
                  <SelectItem value="2">2 seconds / msg (Safe)</SelectItem>
                  <SelectItem value="3">3 seconds / msg (Recommended)</SelectItem>
                  <SelectItem value="5">5 seconds / msg (Ultra Safe)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <span className="text-[11px] text-muted-foreground">
              Randomized jitter is applied automatically to prevent WhatsApp spam flags.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Schedule send:</span>
            <Badge variant="outline" className="text-xs font-normal">
              Immediate (Send Now)
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Sticky Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-card/95 backdrop-blur-md border-t border-border/50 py-3 px-6 shadow-xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">CONTACTS:</span>
              <strong className="text-foreground font-mono">{recipients.length}</strong>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">INVALID:</span>
              <strong className={invalidCount > 0 ? 'text-destructive font-mono' : 'text-foreground font-mono'}>
                {invalidCount}
              </strong>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">MESSAGE TYPE:</span>
              <strong className="text-primary uppercase font-mono">{messageType}</strong>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">CHANNEL:</span>
              <strong className="text-foreground font-mono">
                {isBaileysConnected
                  ? `Linked WhatsApp (${linkedPhoneNumber})`
                  : isMetaConnected
                  ? `Meta Cloud (${metaPhoneNumber})`
                  : 'Ready'}
              </strong>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => setShowPreviewModal(true)}
              className="gap-2 h-9 text-xs"
            >
              <Eye className="w-3.5 h-3.5" />
              Preview WhatsApp Chat
            </Button>

            <Button
              onClick={handleSendCampaign}
              disabled={isSending || recipients.length === 0}
              className="gap-2 h-9 text-xs font-semibold px-6 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md"
            >
              <Send className="w-4 h-4" />
              {isSending ? 'Sending Campaign...' : 'Send Campaign Now'}
            </Button>
          </div>
        </div>
      </div>

      {/* Manual Import Dialog */}
      <Dialog open={showManualImport} onOpenChange={setShowManualImport}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manual Numbers Import</DialogTitle>
            <DialogDescription className="text-xs">
              Paste mobile numbers below (one per line). Format: <code>919876543210</code> or <code>919876543210, Name, Variable1</code>
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            placeholder="919876543210, Rahul Sharma, VIP 20%&#10;919876543211, Priya Verma&#10;919876543212"
            rows={8}
            className="font-mono text-xs"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowManualImport(false)}>
              Cancel
            </Button>
            <Button onClick={handleManualImportSubmit}>Import Numbers</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Number Generator Dialog */}
      <Dialog open={showGenerator} onOpenChange={setShowGenerator}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Generate Phone Numbers</DialogTitle>
            <DialogDescription className="text-xs">
              Generate consecutive numbers for local promotional campaigns.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-medium">Country Code</label>
              <Input value={genPrefix} onChange={(e) => setGenPrefix(e.target.value)} placeholder="91" className="h-8" />
            </div>
            <div>
              <label className="text-xs font-medium">Starting Mobile Number</label>
              <Input value={genStart} onChange={(e) => setGenStart(e.target.value)} placeholder="9876543000" className="h-8" />
            </div>
            <div>
              <label className="text-xs font-medium">Quantity to Generate</label>
              <Input
                type="number"
                value={genCount}
                onChange={(e) => setGenCount(Number(e.target.value))}
                min={1}
                max={500}
                className="h-8"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenerator(false)}>
              Cancel
            </Button>
            <Button onClick={handleGenerateSubmit}>Generate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Insert Country Code Dialog */}
      <Dialog open={showCountryCodeModal} onOpenChange={setShowCountryCodeModal}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Insert Country Code</DialogTitle>
            <DialogDescription className="text-xs">
              Prepends country code to all 10-digit phone numbers in your list.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Input
              value={countryCodeInput}
              onChange={(e) => setCountryCodeInput(e.target.value)}
              placeholder="e.g. 91"
              className="text-center font-mono text-base"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCountryCodeModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleInsertCountryCode}>Apply Code</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* WhatsApp Message Preview Dialog */}
      <Dialog open={showPreviewModal} onOpenChange={setShowPreviewModal}>
        <DialogContent className="max-w-sm p-0 overflow-hidden bg-zinc-950 border-zinc-800">
          <div className="bg-[#075e54] text-white p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs">
              PS
            </div>
            <div>
              <div className="font-semibold text-xs leading-none">Pratap Store Official</div>
              <div className="text-[10px] text-emerald-200">Online • WhatsApp Verified</div>
            </div>
          </div>

          <div
            className="p-4 min-h-[380px] flex flex-col justify-end bg-repeat"
            style={{ backgroundColor: '#0b141a' }}
          >
            {(() => {
              const activeTmpl =
                messageType === 'template'
                  ? approvedTemplates.find((t) => t.name === selectedMetaTemplateName) ||
                    approvedTemplates[0]
                  : null;

              const sampleName = recipients[0]?.name || 'Rahul Sharma';
              const sampleNumber = recipients[0]?.number || '919876543210';
              const sampleVar1 = recipients[0]?.var1 || '10% OFF';

              let displayHeader = headerText;
              let displayBody = messageText
                .replace(/\{\{\s*(name|Name)\s*\}\}/g, sampleName)
                .replace(/\{\{\s*(number|Number)\s*\}\}/g, sampleNumber)
                .replace(/\{\{\s*(var1|Variable1)\s*\}\}/g, sampleVar1);
              let displayFooter = footerText;
              let displayButtons: Array<{ title: string }> = messageType === 'buttons' ? buttons : [];

              if (activeTmpl) {
                displayHeader = activeTmpl.header_content || '';
                displayBody = (activeTmpl.body_text || '')
                  .replace(/\{\{1\}\}/g, sampleName)
                  .replace(/\{\{2\}\}/g, sampleVar1);
                displayFooter = activeTmpl.footer_text || '';
                displayButtons = Array.isArray(activeTmpl.buttons)
                  ? activeTmpl.buttons.map((b: any, idx: number) => ({
                      title: b.text || b.title || `Option ${idx + 1}`,
                    }))
                  : [];
              }

              if (messageType === 'carousel') {
                const currentCard = carouselCards[previewCardIdx] || carouselCards[0];
                return (
                  <div className="w-full space-y-2">
                    {/* Introductory bubble if present */}
                    {(displayHeader || displayBody) && (
                      <div className="max-w-[90%] self-end bg-[#005c4b] text-white p-2.5 rounded-xl rounded-tr-none text-xs shadow-md space-y-1 ml-auto">
                        {displayHeader && <div className="font-bold text-xs border-b border-white/10 pb-0.5">{displayHeader}</div>}
                        {displayBody && <div className="whitespace-pre-wrap leading-relaxed">{displayBody}</div>}
                        <div className="text-[9px] text-emerald-200 text-right pt-0.5">
                          {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ✓✓
                        </div>
                      </div>
                    )}

                    {/* Interactive Carousel Card */}
                    {currentCard && (
                      <div className="w-full max-w-[280px] ml-auto rounded-xl overflow-hidden bg-[#1f2c34] border border-[#2a3942] shadow-xl text-white">
                        {/* Media Window */}
                        <div className="relative h-36 w-full bg-[#111b21] flex items-center justify-center overflow-hidden border-b border-[#2a3942]">
                          {currentCard.image ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={currentCard.image}
                              alt={currentCard.title}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex flex-col items-center justify-center text-zinc-400 gap-1">
                              <Package className="h-8 w-8 text-zinc-500" />
                              <span className="text-[10px]">Product Image</span>
                            </div>
                          )}

                          {currentCard.price && (
                            <div className="absolute top-2 right-2 rounded-full bg-emerald-600 text-white px-2 py-0.5 text-[10px] font-bold shadow-md">
                              ₹{currentCard.price}
                            </div>
                          )}

                          <div className="absolute bottom-2 left-2 rounded-md bg-black/70 text-white px-1.5 py-0.5 text-[9px] font-medium backdrop-blur-xs">
                            {previewCardIdx + 1} / {carouselCards.length}
                          </div>

                          {carouselCards.length > 1 && (
                            <>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPreviewCardIdx((prev) => (prev > 0 ? prev - 1 : carouselCards.length - 1));
                                }}
                                className="absolute left-1.5 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center shadow z-10"
                                title="Previous product"
                              >
                                <ChevronLeft className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPreviewCardIdx((prev) => (prev < carouselCards.length - 1 ? prev + 1 : 0));
                                }}
                                className="absolute right-1.5 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center shadow z-10"
                                title="Next product"
                              >
                                <ChevronRight className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>

                        {/* Title & Description */}
                        <div className="p-2.5 space-y-1">
                          <h4 className="font-semibold text-xs text-zinc-100 line-clamp-1">
                            {currentCard.title || 'Product Title'}
                          </h4>
                          {currentCard.description && (
                            <p className="text-[11px] text-zinc-300 line-clamp-2 leading-relaxed">
                              {currentCard.description}
                            </p>
                          )}
                        </div>

                        {/* Card Buttons */}
                        {Array.isArray(currentCard.buttons) && currentCard.buttons.length > 0 && (
                          <div className="border-t border-[#2a3942] divide-y divide-[#2a3942]">
                            {currentCard.buttons.map((btn, i) => (
                              <div
                                key={btn.id || i}
                                className="flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-teal-400 bg-[#202c33] hover:bg-[#2a3942] cursor-pointer"
                              >
                                {btn.url ? <ExternalLink className="h-3 w-3" /> : <ShoppingBag className="h-3 w-3" />}
                                <span className="truncate">{btn.title}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Dots indicator */}
                        {carouselCards.length > 1 && (
                          <div className="flex items-center justify-center gap-1 py-1.5 bg-[#172128] border-t border-[#2a3942]">
                            {carouselCards.map((_, i) => (
                              <button
                                key={i}
                                type="button"
                                onClick={() => setPreviewCardIdx(i)}
                                className={`h-1.5 rounded-full transition-all ${
                                  i === previewCardIdx ? 'w-4 bg-teal-400' : 'w-1.5 bg-zinc-600 hover:bg-zinc-400'
                                }`}
                                aria-label={`Card ${i + 1}`}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <>
                  <div className="max-w-[90%] self-end bg-[#005c4b] text-white p-3 rounded-xl rounded-tr-none text-xs shadow-md space-y-2">
                    {/* Media Preview */}
                    {mediaUrl && (
                      <div className="rounded overflow-hidden bg-black/40 mb-1 max-h-44 flex items-center justify-center">
                        {mediaUrl.toLowerCase().includes('.pdf') ? (
                          <div className="p-4 text-center">
                            <FileText className="w-10 h-10 text-red-400 mx-auto mb-1" />
                            <div className="text-[11px] font-semibold">
                              {uploadedFileName || 'Document.pdf'}
                            </div>
                            <div className="text-[9px] text-zinc-400">PDF Document</div>
                          </div>
                        ) : mediaUrl.toLowerCase().match(/\.(mp4|mov|avi|mkv)$/i) ? (
                          <div className="p-4 text-center">
                            <Film className="w-10 h-10 text-blue-400 mx-auto mb-1" />
                            <div className="text-[11px] font-semibold">Video Media</div>
                          </div>
                        ) : (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={mediaUrl} alt="media preview" className="object-cover max-h-44 w-full" />
                        )}
                      </div>
                    )}

                    {/* Header Text */}
                    {displayHeader && (
                      <div className="font-bold text-sm text-white/95 border-b border-white/10 pb-1">
                        {displayHeader}
                      </div>
                    )}

                    {/* Body Text */}
                    <div className="whitespace-pre-wrap leading-relaxed text-zinc-100">
                      {displayBody}
                    </div>

                    {/* Footer Text */}
                    {displayFooter && (
                      <div className="text-[10px] text-zinc-300 italic pt-0.5">
                        {displayFooter}
                      </div>
                    )}

                    {/* Time Stamp */}
                    <div className="text-[10px] text-emerald-200 text-right flex items-center justify-end gap-1 pt-0.5">
                      <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <span>✓✓</span>
                    </div>
                  </div>

                  {/* WhatsApp Buttons Preview (rendered below bubble just like WhatsApp) */}
                  {(messageType === 'buttons' || (messageType === 'template' && displayButtons.length > 0)) &&
                    displayButtons.length > 0 && (
                      <div className="max-w-[90%] self-end w-full space-y-1 mt-1">
                        {displayButtons.map((btn, i) => (
                          <div
                            key={i}
                            className="bg-[#202c33] hover:bg-[#2a3942] text-teal-400 py-2 px-3 rounded-lg text-center text-xs font-semibold shadow transition-colors flex items-center justify-center gap-1.5 cursor-pointer border border-zinc-800"
                          >
                            <Smartphone className="w-3.5 h-3.5" />
                            <span>{btn.title || `Button ${i + 1}`}</span>
                          </div>
                        ))}
                      </div>
                    )}

                  {/* WhatsApp List Trigger Button Preview */}
                  {messageType === 'list' && (
                    <div className="max-w-[90%] self-end w-full mt-1">
                      <div className="bg-[#202c33] text-teal-400 py-2.5 px-3 rounded-lg text-center text-xs font-semibold shadow flex items-center justify-center gap-2 border border-zinc-800">
                        <Menu className="w-3.5 h-3.5" />
                        <span>{listButtonLabel || 'View Menu'}</span>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* QR Code Linker Modal */}
      <Dialog open={showQrModal} onOpenChange={setShowQrModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Link WhatsApp Device</DialogTitle>
            <DialogDescription className="text-xs">
              Scan the QR code with WhatsApp on your phone (Settings &gt; Linked Devices &gt; Link a Device) to send bulk broadcasts without Meta restrictions.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <WhatsAppQrLinker />
          </div>
        </DialogContent>
      </Dialog>

      {/* Campaign Progress / Results Modal */}
      <Dialog open={showProgressModal} onOpenChange={setShowProgressModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isSending ? (
                <>
                  <RefreshCw className="w-4 h-4 text-primary animate-spin" />
                  Sending Campaign...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  Campaign Complete!
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {campaignName} • Real-time delivery updates
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Counts grid */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2.5 rounded-lg bg-muted/40 border border-border/40">
                <div className="text-xs text-muted-foreground">Total</div>
                <div className="text-lg font-bold">{sendProgress.total}</div>
              </div>
              <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                <div className="text-xs text-emerald-400">Sent Successfully</div>
                <div className="text-lg font-bold text-emerald-400">{sendProgress.sent}</div>
              </div>
              <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/30">
                <div className="text-xs text-destructive">Failed</div>
                <div className="text-lg font-bold text-destructive">{sendProgress.failed}</div>
              </div>
            </div>

            {/* Results Table */}
            <div className="border border-border/40 rounded-lg max-h-56 overflow-y-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/40 sticky top-0 border-b border-border/40 text-muted-foreground">
                  <tr>
                    <th className="py-2 px-3">Phone</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3">Detail</th>
                    <th className="py-2 px-3 text-right">Quick Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20 font-mono">
                  {sendLogs.map((log, i) => (
                    <tr key={i} className="hover:bg-muted/30">
                      <td className="py-1.5 px-3">{log.phone}</td>
                      <td className="py-1.5 px-3">
                        {log.status === 'sent' ? (
                          <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px] py-0">
                            Sent
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-[10px] py-0">
                            Failed
                          </Badge>
                        )}
                      </td>
                      <td className="py-1.5 px-3 text-[11px] text-muted-foreground font-sans truncate max-w-[140px]">
                        {log.error || 'Delivered'}
                      </td>
                      <td className="py-1.5 px-3 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-[11px] gap-1 px-2 text-emerald-400 hover:bg-emerald-500/10"
                          onClick={() => {
                            const clean = log.phone.replace(/\D/g, '');
                            const activeTmpl = approvedTemplates.find((t) => t.name === selectedMetaTemplateName);
                            const text = encodeURIComponent(messageText || activeTmpl?.body_text || '');
                            window.open(`https://web.whatsapp.com/send?phone=${clean}&text=${text}`, '_blank');
                          }}
                        >
                          <ExternalLink className="h-3 w-3" />
                          Send via Web
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!isBaileysConnected && (
              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-200 text-[11px] flex items-center justify-between gap-2">
                <span>Want 100% direct delivery without Meta restrictions? Link your phone via QR.</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setShowProgressModal(false);
                    setShowQrModal(true);
                  }}
                  className="h-6 text-[11px] border-amber-500/40 text-amber-300 hover:bg-amber-500/20 shrink-0"
                >
                  <QrCode className="h-3 w-3 mr-1" />
                  Link WhatsApp
                </Button>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              disabled={isSending}
              onClick={() => setShowProgressModal(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Store Product Catalog Picker Modal for WhatsApp Carousel */}
      <Dialog open={showProductCatalogModal} onOpenChange={setShowProductCatalogModal}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-primary" />
              Pick Products for WhatsApp Carousel
            </DialogTitle>
            <DialogDescription className="text-xs">
              Select products from your Pratap Store catalog to quickly add them as interactive showcase cards ({carouselCards.length}/10 cards added).
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2 py-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                placeholder="Search products by title, category, or SKU..."
                className="pl-9 h-9 text-xs"
              />
            </div>
            {catalogSearch && (
              <Button size="sm" variant="ghost" onClick={() => setCatalogSearch('')} className="h-9 px-2 text-xs">
                Clear
              </Button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto pr-1 -mr-1 min-h-[300px] max-h-[420px]">
            {isLoadingStoreProducts ? (
              <div className="flex flex-col items-center justify-center h-48 gap-2 text-muted-foreground">
                <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                <span className="text-xs">Loading store catalog...</span>
              </div>
            ) : storeProductsList.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 gap-2 text-muted-foreground">
                <Package className="w-8 h-8 opacity-40" />
                <span className="text-xs">No products found in catalog.</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {storeProductsList
                  .filter((p) => {
                    if (!catalogSearch) return true;
                    const q = catalogSearch.toLowerCase();
                    return (
                      p.name?.toLowerCase().includes(q) ||
                      p.category?.toLowerCase().includes(q) ||
                      p.sku?.toLowerCase().includes(q) ||
                      p.description?.toLowerCase().includes(q)
                    );
                  })
                  .map((prod) => {
                    const isAlreadyAdded = carouselCards.some((c) => c.title === prod.name);
                    return (
                      <div
                        key={prod.id || prod.sku}
                        className="flex items-center gap-3 p-2.5 rounded-lg border border-border/50 bg-card hover:bg-muted/30 transition-colors"
                      >
                        <div className="h-14 w-14 rounded-md overflow-hidden bg-muted shrink-0 flex items-center justify-center border border-border/40">
                          {prod.image_url ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={prod.image_url} alt={prod.name} className="h-full w-full object-cover" />
                          ) : (
                            <Package className="w-5 h-5 text-muted-foreground/60" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h5 className="font-semibold text-xs truncate text-foreground">{prod.name}</h5>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs font-bold text-emerald-500">₹{prod.price}</span>
                            {prod.compare_at_price && (
                              <span className="text-[11px] text-muted-foreground line-through">
                                ₹{prod.compare_at_price}
                              </span>
                            )}
                            {prod.category && (
                              <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-normal">
                                {prod.category}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant={isAlreadyAdded ? 'secondary' : 'default'}
                          disabled={carouselCards.length >= 10}
                          onClick={() => handleAddProductToCarousel(prod)}
                          className="h-8 text-xs shrink-0 gap-1 px-3"
                        >
                          <Plus className="w-3 h-3" />
                          {isAlreadyAdded ? 'Add Again' : 'Add Card'}
                        </Button>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          <DialogFooter className="flex items-center justify-between sm:justify-between border-t border-border/40 pt-3">
            <span className="text-xs text-muted-foreground">
              {carouselCards.length} / 10 cards in carousel
            </span>
            <Button onClick={() => setShowProductCatalogModal(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
