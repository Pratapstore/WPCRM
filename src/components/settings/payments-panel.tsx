"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CreditCard,
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  Copy,
  ExternalLink,
  Sparkles,
  Banknote,
  Smartphone,
  Save,
} from "lucide-react";
import { toast } from "sonner";

export function PaymentsPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [keyId, setKeyId] = useState("");
  const [keySecret, setKeySecret] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [enablePrepaid, setEnablePrepaid] = useState(true);
  const [enableCod, setEnableCod] = useState(true);
  const [webhookUrl, setWebhookUrl] = useState("");

  useEffect(() => {
    fetch("/api/settings/payments")
      .then((res) => res.json())
      .then((data) => {
        if (data.config) {
          setKeyId(data.config.key_id || "");
          setKeySecret(data.config.key_secret || "");
          setWebhookSecret(data.config.webhook_secret || "");
          setEnablePrepaid(data.config.enable_prepaid ?? true);
          setEnableCod(data.config.enable_cod ?? true);
        }
        if (data.webhook_url) {
          setWebhookUrl(data.webhook_url);
        }
      })
      .catch((err) => console.error("Error loading payment settings:", err))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/settings/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key_id: keyId.trim(),
          key_secret: keySecret.trim(),
          webhook_secret: webhookSecret.trim(),
          enable_prepaid: enablePrepaid,
          enable_cod: enableCod,
          is_enabled: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save payment settings");
      }

      toast.success("Razorpay & Payment settings saved successfully!");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const copyWebhookUrl = () => {
    if (!webhookUrl) return;
    navigator.clipboard.writeText(webhookUrl);
    toast.success("Webhook URL copied to clipboard!");
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-indigo-400" />
          Payments & Razorpay Integration
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Configure automated payment collection for WhatsApp orders via Razorpay (UPI, Google Pay, PhonePe, Cards) and Cash on Delivery.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Payment Methods Toggle */}
        <Card className="border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-400" />
              Allowed Payment Methods
            </CardTitle>
            <CardDescription className="text-xs">
              Choose which payment options customers can select when ordering on WhatsApp.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3.5 rounded-xl border bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <Smartphone className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-foreground">
                    Online Prepaid Payments (Razorpay & UPI)
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Generates secure payment links with instant UPI/Cards payment verification.
                  </p>
                </div>
              </div>
              <Switch checked={enablePrepaid} onCheckedChange={setEnablePrepaid} />
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-xl border bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
                  <Banknote className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-foreground">
                    Cash on Delivery (COD)
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Allows customer to place orders and pay cash to the courier agent upon delivery.
                  </p>
                </div>
              </div>
              <Switch checked={enableCod} onCheckedChange={setEnableCod} />
            </div>
          </CardContent>
        </Card>

        {/* Razorpay API Credentials */}
        <Card className="border shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-indigo-400" />
                  Razorpay API Keys
                </CardTitle>
                <CardDescription className="text-xs">
                  Enter your API keys from Razorpay Dashboard (Settings ➔ API Keys).
                </CardDescription>
              </div>
              <a
                href="https://dashboard.razorpay.com/app/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1 font-medium"
              >
                Get Keys <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="rzp_key_id" className="text-xs font-medium">
                Key ID *
              </Label>
              <Input
                id="rzp_key_id"
                placeholder="rzp_live_xxxxxxxx or rzp_test_xxxxxxxx"
                value={keyId}
                onChange={(e) => setKeyId(e.target.value)}
                className="font-mono text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                Starts with <code className="text-foreground">rzp_live_</code> for live payments or <code className="text-foreground">rzp_test_</code> for test mode.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rzp_key_secret" className="text-xs font-medium">
                Key Secret *
              </Label>
              <Input
                id="rzp_key_secret"
                type="password"
                placeholder="••••••••••••••••••••••••"
                value={keySecret}
                onChange={(e) => setKeySecret(e.target.value)}
                className="font-mono text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                Your Razorpay account secret key (kept encrypted and secure).
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rzp_webhook_secret" className="text-xs font-medium">
                Webhook Secret (Optional)
              </Label>
              <Input
                id="rzp_webhook_secret"
                placeholder="Secret configured in Razorpay Webhooks"
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
          </CardContent>
        </Card>

        {/* Razorpay Webhook Endpoint Setup */}
        <Card className="border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              Automated Payment Capture Webhook
            </CardTitle>
            <CardDescription className="text-xs">
              Add this Webhook URL in your Razorpay Dashboard (Settings ➔ Webhooks) so orders are instantly confirmed when customer pays.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={webhookUrl || "Loading webhook URL..."}
                className="font-mono text-xs bg-muted"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0 h-9 w-9"
                onClick={copyWebhookUrl}
                title="Copy Webhook URL"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Select these Active Events in Razorpay:</p>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-300">
                <li><code className="text-emerald-400">payment_link.paid</code> (Payment link completed)</li>
                <li><code className="text-emerald-400">payment.captured</code> (Payment captured via UPI / Cards)</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            disabled={saving || loading}
            className="bg-indigo-600 hover:bg-indigo-500 text-white gap-2 font-medium"
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save Payment Settings"}
          </Button>
        </div>
      </form>
    </div>
  );
}
