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
  List,
  Search,
  Filter,
  Check,
  X,
  Clock,
  Sparkles,
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

interface RecipientRow {
  id: string;
  name: string;
  number: string;
  var1: string;
}

const PRESET_TEMPLATES = [
  {
    id: 'custom',
    name: 'New Message (Custom)',
    text: 'Hello {{Name}}! 🙏\n\nWelcome to *Pratap Store*.\nWe have exciting custom products personalized with your name and photos.\n\nReply *MENU* to browse our catalog or place an order!\n\nWebsite: www.pratapstore.in',
  },
  {
    id: 'diwali_offer',
    name: 'Special Discount Offer 🔥',
    text: 'Hello {{Name}}! ✨\n\n*Special Offer: Exclusive flat discount for you! 🔥*\n\nApne favourite products (Custom T-Shirts, Photo Mugs, Keychains & Cushions) par paayein up to *80% OFF*!\n\n🏷️ Use Code: *PRATAP100*\n\nReply *ORDER* to browse or shop now!\nPratap Store — Your Ideas, Our Prints!',
  },
  {
    id: 'welcome_greeting',
    name: 'Welcome Greeting 🙏',
    text: 'Namaste {{Name}}! 🙏\n\nThank you for connecting with *Pratap Store*.\nWe specialize in high quality customized printing:\n▪️ Personalized Photo Keychains\n▪️ Custom Printed T-Shirts\n▪️ Magic Photo Mugs\n▪️ Personalized Frames\n\nHow can we help you today? Reply with your requirement!',
  },
  {
    id: 'order_status_reminder',
    name: 'Order / Catalog Reminder 🛍️',
    text: 'Hi {{Name}}, your custom order details are ready!\n\nCheck out our latest catalog and best-selling customized prints.\nFast Pan-India shipping with instant tracking.\n\nReply *MENU* anytime to get started.',
  },
];

export default function SendMessagePage() {
  // Campaign State
  const [campaignName, setCampaignName] = useState(`Campaign ${new Date().toLocaleDateString('en-IN')}`);
  const [selectedTemplateId, setSelectedTemplateId] = useState('custom');
  const [selectedInstance, setSelectedInstance] = useState('auto');
  const [messageType, setMessageType] = useState<'text' | 'media'>('text');
  const [mediaUrl, setMediaUrl] = useState('');
  const [messageText, setMessageText] = useState(PRESET_TEMPLATES[0].text);

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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch Baileys instances
  async function fetchInstances() {
    try {
      const res = await fetch('/api/whatsapp/baileys');
      const data = await res.json();
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
    } catch {
      setIsBaileysConnected(false);
    }
  }

  useEffect(() => {
    fetchInstances();
    const interval = setInterval(fetchInstances, 10000);
    return () => clearInterval(interval);
  }, []);

  // Template change handler
  function handleTemplateSelect(id: string | null) {
    if (!id) return;
    setSelectedTemplateId(id);
    const tpl = PRESET_TEMPLATES.find((t) => t.id === id);
    if (tpl) {
      setMessageText(tpl.text);
    }
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
  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
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
        // Skip header if first line has 'phone' or 'number'
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
    if (fileInputRef.current) fileInputRef.current.value = '';
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
    if (!messageText.trim() && !mediaUrl.trim()) {
      toast.error('Please compose a message or add a media URL');
      return;
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
          messageText,
          mediaUrl: mediaUrl || undefined,
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
    <div className="flex-1 space-y-6 p-6 max-w-7xl mx-auto pb-28">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".csv,.txt,.xlsx"
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
                  Campaign Sender
                </Badge>
              </h1>
              <p className="text-sm text-muted-foreground">
                Build a campaign, check it, then send it instantly to new or existing customers.
              </p>
            </div>
          </div>
        </div>

        {/* Device Status Banner */}
        <div className="flex items-center gap-3">
          {isBaileysConnected ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Linked Device: {linkedPhoneNumber}</span>
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
        </div>
      </div>

      {/* Section 1: Campaign Configuration */}
      <Card className="border-border/50 bg-card/60 backdrop-blur-sm shadow-sm">
        <CardHeader className="py-4 border-b border-border/40">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded bg-muted text-muted-foreground text-xs font-semibold">1</span>
            <CardTitle className="text-base font-semibold">Campaign</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Name the run, pick who sends it and what shape it is.
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
              <span className="text-destructive">*</span> Sending Instance
            </label>
            <Select value={selectedInstance} onValueChange={(val) => val && setSelectedInstance(val)}>
              <SelectTrigger className="bg-background/50 h-9">
                <SelectValue placeholder="Select instance" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto (Linked Device / High Speed)</SelectItem>
                <SelectItem value="baileys">
                  {isBaileysConnected ? `Linked WhatsApp (${linkedPhoneNumber})` : 'Linked WhatsApp Web (QR)'}
                </SelectItem>
                <SelectItem value="meta">Meta Cloud API (Approved Templates)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-medium text-foreground mb-1.5 block">
              <span className="text-destructive">*</span> Message Type
            </label>
            <Select value={messageType} onValueChange={(val) => val && setMessageType(val as 'text' | 'media')}>
              <SelectTrigger className="bg-background/50 h-9">
                <SelectValue placeholder="Message type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text Message</SelectItem>
                <SelectItem value="media">Image / Media with Caption</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {messageType === 'media' && (
            <div className="md:col-span-4 mt-1">
              <label className="text-xs font-medium text-foreground mb-1.5 block">
                Media URL (Image / Banner / PDF)
              </label>
              <Input
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                placeholder="https://example.com/banner.jpg"
                className="bg-background/50 h-9"
              />
            </div>
          )}
        </CardContent>
      </Card>

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
                Import a list, or add rows by hand. Supports dynamic variables.
              </CardDescription>
            </div>

            {/* Action Buttons Toolbar */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
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
                  placeholder="Search name, number or var..."
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
            <div className="max-h-[320px] overflow-y-auto">
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

      {/* Section 3: Message Composer */}
      <Card className="border-border/50 bg-card/60 backdrop-blur-sm shadow-sm">
        <CardHeader className="py-4 border-b border-border/40">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded bg-muted text-muted-foreground text-xs font-semibold">3</span>
            <CardTitle className="text-base font-semibold">Message</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Insert contact fields with &quot;Use Column&quot; to personalise each send. Format with bold, italic, emoji.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-4 space-y-3">
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
                <List className="w-3.5 h-3.5" />
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
            <Textarea
              ref={textareaRef}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Type your WhatsApp broadcast message here... Use *bold*, _italic_, or {{Name}} tags."
              rows={8}
              className="font-sans text-sm bg-background/50 border-border/50 focus:border-primary p-3"
            />
            <div className="absolute right-3 bottom-2.5 text-[11px] text-muted-foreground pointer-events-none">
              {messageText.length} characters
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 4: Delivery Settings */}
      <Card className="border-border/50 bg-card/60 backdrop-blur-sm shadow-sm">
        <CardHeader className="py-4 border-b border-border/40">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded bg-muted text-muted-foreground text-xs font-semibold">4</span>
            <CardTitle className="text-base font-semibold">Delivery</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Send as soon as you launch, or pick anti-ban pacing between messages.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-foreground">Anti-ban Pacing Delay:</label>
              <Select value={delaySeconds.toString()} onValueChange={(val) => val && setDelaySeconds(Number(val))}>
                <SelectTrigger className="h-8 w-32 bg-background/50 text-xs">
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
              <span className="text-muted-foreground">INSTANCES:</span>
              <strong className="text-foreground font-mono">{isBaileysConnected ? '1 (Active)' : '0 (Offline)'}</strong>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => setShowPreviewModal(true)}
              className="gap-2 h-9 text-xs"
            >
              <Eye className="w-3.5 h-3.5" />
              Preview Chat
            </Button>

            <Button
              onClick={handleSendCampaign}
              disabled={isSending || recipients.length === 0}
              className="gap-2 h-9 text-xs font-semibold px-6 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md"
            >
              <Send className="w-4 h-4" />
              {isSending ? 'Sending Campaign...' : 'Send Now'}
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
              Paste mobile numbers below (one per line). Format: <code>919876543210</code> or <code>919876543210, Name, Note</code>
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            placeholder="919876543210, Rahul, Offer 20%&#10;919876543211, Priya&#10;919876543212"
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
              Generate consecutive numbers for local campaigns.
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
          <div className="bg-emerald-800 text-white p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs">
              PS
            </div>
            <div>
              <div className="font-semibold text-xs leading-none">Pratap Store Official</div>
              <div className="text-[10px] text-emerald-200">Online</div>
            </div>
          </div>

          <div
            className="p-4 min-h-[340px] flex flex-col justify-end bg-repeat"
            style={{ backgroundColor: '#0b141a' }}
          >
            <div className="max-w-[85%] self-end bg-[#005c4b] text-white p-3 rounded-xl rounded-tr-none text-xs shadow-md space-y-2">
              {mediaUrl && (
                <div className="rounded overflow-hidden bg-black/40 mb-1 max-h-40 flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={mediaUrl} alt="media preview" className="object-cover max-h-40 w-full" />
                </div>
              )}
              <div className="whitespace-pre-wrap leading-relaxed">
                {messageText
                  .replace(/\{\{\s*(name|Name)\s*\}\}/g, recipients[0]?.name || 'Rahul Sharma')
                  .replace(/\{\{\s*(number|Number)\s*\}\}/g, recipients[0]?.number || '919876543210')
                  .replace(/\{\{\s*(var1|Variable1)\s*\}\}/g, recipients[0]?.var1 || 'Special Discount')}
              </div>
              <div className="text-[10px] text-emerald-200 text-right flex items-center justify-end gap-1">
                <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                <span>✓✓</span>
              </div>
            </div>
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
            <div className="border border-border/40 rounded-lg max-h-48 overflow-y-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/40 sticky top-0 border-b border-border/40 text-muted-foreground">
                  <tr>
                    <th className="py-2 px-3">Phone</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3">Detail</th>
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
                      <td className="py-1.5 px-3 text-[11px] text-muted-foreground font-sans truncate max-w-[180px]">
                        {log.error || 'Delivered'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
    </div>
  );
}
