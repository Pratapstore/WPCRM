"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import {
  Download,
  Copy,
  Check,
  QrCode,
  Smartphone,
  ShieldCheck,
  Zap,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { buildUpiIntentUri, formatIndianCurrency } from "@/lib/orders/upi-helper";

interface UpiQrPreviewProps {
  amount: number;
  orderNumber: string;
  customerName?: string;
  upiId?: string;
  storeName?: string;
}

export function UpiQrPreview({
  amount,
  orderNumber,
  customerName = "Customer",
  upiId = "pratapstore@jio",
  storeName = "Pratap Store",
}: UpiQrPreviewProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  const intentUri = buildUpiIntentUri({
    upiId,
    payeeName: storeName,
    amount,
    transactionNote: `Order #${orderNumber || "Draft"} - ${storeName}`,
    orderNumber,
  });

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    QRCode.toDataURL(intentUri, {
      width: 320,
      margin: 2,
      color: {
        dark: "#0f172a",
        light: "#ffffff",
      },
      errorCorrectionLevel: "M",
    })
      .then((url) => {
        if (isMounted) {
          setQrDataUrl(url);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("QR Code generation error:", err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [intentUri]);

  const handleCopyUri = () => {
    navigator.clipboard.writeText(intentUri);
    setCopied(true);
    toast.success("UPI Intent link copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `UPI-QR-${orderNumber || "Order"}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success("QR Code downloaded successfully!");
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-gradient-to-b from-card to-card/60 rounded-2xl border border-border shadow-sm text-center">
      {/* Merchant Header */}
      <div className="flex items-center gap-2 mb-2">
        <div className="h-8 w-8 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold text-xs border border-emerald-500/20">
          <Zap className="h-4 w-4" />
        </div>
        <div className="text-left">
          <h4 className="text-sm font-semibold text-foreground leading-tight">
            {storeName}
          </h4>
          <p className="text-[11px] text-muted-foreground font-mono">{upiId}</p>
        </div>
      </div>

      {/* Amount Pill */}
      <div className="my-3 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold text-lg flex items-center gap-1.5 shadow-sm">
        <span>{formatIndianCurrency(amount)}</span>
      </div>

      <p className="text-xs text-muted-foreground mb-4">
        Scan with any UPI app for instant zero-fee settlement
      </p>

      {/* QR Code Container */}
      <div className="relative p-4 bg-white rounded-2xl shadow-md border border-slate-200 dark:border-slate-800 flex items-center justify-center min-w-[220px] min-h-[220px]">
        {loading || !qrDataUrl ? (
          <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
            <QrCode className="h-8 w-8 animate-pulse text-muted-foreground" />
            <span className="text-xs">Generating UPI QR...</span>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrDataUrl}
              alt="UPI QR Code"
              className="w-48 h-48 rounded-lg object-contain"
            />
            {/* UPI Brand Strip */}
            <div className="mt-2 flex items-center justify-center gap-3 text-[10px] text-slate-600 font-semibold uppercase tracking-wider">
              <span>GPay</span>
              <span>•</span>
              <span>PhonePe</span>
              <span>•</span>
              <span>Paytm</span>
              <span>•</span>
              <span>BHIM</span>
            </div>
          </div>
        )}
      </div>

      {/* Order Reference */}
      <div className="mt-4 text-xs text-muted-foreground flex items-center gap-2">
        <span>Ref: <strong className="text-foreground font-mono">{orderNumber || "ORD-DRAFT"}</strong></span>
        <span>•</span>
        <span>Customer: <strong className="text-foreground">{customerName}</strong></span>
      </div>

      {/* Action Buttons */}
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2 w-full max-w-xs">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleCopyUri}
          className="flex-1 text-xs gap-1.5 h-8 border-border"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied UPI" : "Copy UPI Link"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleDownloadQr}
          disabled={!qrDataUrl}
          className="flex-1 text-xs gap-1.5 h-8"
        >
          <Download className="h-3.5 w-3.5" />
          Download QR
        </Button>
      </div>

      {/* Security Footer */}
      <div className="mt-4 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
        <span>NPCI Verified &bull; Instant Bank Transfer</span>
      </div>
    </div>
  );
}
