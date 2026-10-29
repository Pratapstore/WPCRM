"use client";

import { useRef } from "react";
import {
  Printer,
  Download,
  Copy,
  CheckCircle2,
  Building2,
  FileText,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  formatIndianCurrency,
  numberToIndianRupeesWords,
} from "@/lib/orders/upi-helper";

interface OrderItemPreview {
  name: string;
  variant?: string;
  price: number;
  quantity: number;
  subtotal: number;
}

interface InvoicePreviewProps {
  orderNumber: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  items: OrderItemPreview[];
  subtotal: number;
  shippingFee: number;
  discountAmount: number;
  taxAmount?: number;
  totalAmount: number;
  paymentMethod: "razorpay" | "cod" | "upi_manual";
  paymentStatus?: "pending" | "paid" | "failed";
  shippingAddress: {
    street: string;
    landmark?: string;
    city: string;
    state: string;
    pincode: string;
  };
  sellerName?: string;
  sellerGstin?: string;
  sellerAddress?: string;
}

export function InvoicePreview({
  orderNumber,
  invoiceNumber,
  invoiceDate,
  customerName,
  customerPhone,
  customerEmail,
  items,
  subtotal,
  shippingFee,
  discountAmount,
  taxAmount = 0,
  totalAmount,
  paymentMethod,
  paymentStatus = "pending",
  shippingAddress,
  sellerName = "Pratap Store Pvt Ltd",
  sellerGstin = "07AAACP1928F1Z4",
  sellerAddress = "Plot 42, Commercial Complex, Chandni Chowk, New Delhi, Delhi - 110006",
}: InvoicePreviewProps) {
  const invoiceRef = useRef<HTMLDivElement>(null);

  const displayInvoiceNo =
    invoiceNumber ||
    `INV-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}-${orderNumber.replace(/\D/g, "").slice(-4) || "0419"}`;

  const displayDate =
    invoiceDate ||
    new Date().toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  const handlePrint = () => {
    window.print();
  };

  const handleCopySummary = () => {
    const summary = `Invoice #${displayInvoiceNo} for Order #${orderNumber} | Total: ${formatIndianCurrency(totalAmount)} | Customer: ${customerName}`;
    navigator.clipboard.writeText(summary);
    toast.success("Invoice summary copied!");
  };

  const taxableValue = Math.max(0, subtotal - discountAmount);
  const wordsAmount = numberToIndianRupeesWords(totalAmount);

  return (
    <div className="flex flex-col gap-4">
      {/* Actions Bar */}
      <div className="flex items-center justify-between bg-card p-3 rounded-xl border border-border shadow-xs print:hidden">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold text-foreground">
            Tax Invoice #{displayInvoiceNo}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopySummary}
            className="text-xs gap-1.5 h-8 border-border"
          >
            <Copy className="h-3.5 w-3.5" />
            Copy Summary
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={handlePrint}
            className="text-xs gap-1.5 h-8 bg-indigo-600 hover:bg-indigo-500 text-white"
          >
            <Printer className="h-3.5 w-3.5" />
            Print / Save PDF
          </Button>
        </div>
      </div>

      {/* Invoice Printable Sheet */}
      <div
        ref={invoiceRef}
        id="printable-tax-invoice"
        className="bg-white text-slate-900 p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-md font-sans text-xs leading-relaxed max-w-3xl mx-auto w-full print:p-0 print:border-0 print:shadow-none print:max-w-none"
      >
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start pb-5 border-b border-slate-200 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl bg-slate-900 text-white font-black text-sm flex items-center justify-center">
                PS
              </div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900">
                {sellerName}
              </h2>
            </div>
            <p className="text-slate-500 text-[11px] mt-1.5 max-w-xs">
              {sellerAddress}
            </p>
            <p className="text-slate-600 font-mono text-[11px] mt-1">
              <strong>GSTIN:</strong> {sellerGstin} &bull; <strong>State:</strong> Delhi (07)
            </p>
          </div>

          <div className="text-left sm:text-right">
            <span className="inline-block px-3 py-1 bg-slate-100 text-slate-800 text-[11px] font-bold uppercase tracking-wider rounded border border-slate-200 mb-2">
              TAX INVOICE / BILL OF SUPPLY
            </span>
            <div className="space-y-0.5 text-[11px]">
              <p>
                <span className="text-slate-500">Invoice No: </span>
                <strong className="font-mono text-slate-900">{displayInvoiceNo}</strong>
              </p>
              <p>
                <span className="text-slate-500">Invoice Date: </span>
                <strong className="text-slate-900">{displayDate}</strong>
              </p>
              <p>
                <span className="text-slate-500">Order ID: </span>
                <strong className="font-mono text-slate-900">{orderNumber}</strong>
              </p>
              <p>
                <span className="text-slate-500">Payment Status: </span>
                <span className="uppercase font-bold text-emerald-700">
                  {paymentStatus === "paid" ? "PAID" : paymentMethod === "cod" ? "CASH ON DELIVERY" : "PAYMENT PENDING"}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Customer / Billed To Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4 border-b border-slate-200 text-[11px]">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              BILLED TO / SHIP TO:
            </span>
            <p className="font-bold text-sm text-slate-900">{customerName || "Customer Name"}</p>
            <p className="text-slate-600 mt-0.5">{shippingAddress.street || "Delivery Address"}</p>
            {shippingAddress.landmark && (
              <p className="text-slate-500">Landmark: {shippingAddress.landmark}</p>
            )}
            <p className="text-slate-600">
              {shippingAddress.city || "New Delhi"}, {shippingAddress.state || "Delhi"} -{" "}
              <span className="font-mono font-medium">{shippingAddress.pincode || "110001"}</span>
            </p>
            <p className="text-slate-700 mt-1 font-medium">
              Phone: {customerPhone || "+91 98765 43210"}
              {customerEmail ? ` • Email: ${customerEmail}` : ""}
            </p>
          </div>

          <div className="sm:text-right">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              DISPATCH & PAYMENT DETAILS:
            </span>
            <p className="text-slate-700">
              <span className="text-slate-500">Payment Mode: </span>
              <strong className="uppercase">
                {paymentMethod === "cod"
                  ? "Cash On Delivery (COD)"
                  : paymentMethod === "upi_manual"
                  ? "Direct UPI Scan & Pay"
                  : "Razorpay Online (UPI/Cards/NetBanking)"}
              </strong>
            </p>
            <p className="text-slate-700">
              <span className="text-slate-500">Shipping Partner: </span>
              <strong>Express Courier (Surface/Air)</strong>
            </p>
            <p className="text-slate-700">
              <span className="text-slate-500">Place of Supply: </span>
              <strong>{shippingAddress.state || "Delhi"} (State Code)</strong>
            </p>
            <p className="text-slate-700">
              <span className="text-slate-500">Reverse Charge: </span>
              <strong>No</strong>
            </p>
          </div>
        </div>

        {/* Itemized Table */}
        <div className="py-4">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-300 text-[10px] uppercase font-bold text-slate-600 bg-slate-50">
                <th className="py-2 px-2 text-center w-8">#</th>
                <th className="py-2 px-2">Description of Goods</th>
                <th className="py-2 px-2 text-center w-16">HSN/SAC</th>
                <th className="py-2 px-2 text-center w-12">Qty</th>
                <th className="py-2 px-2 text-right w-20">Unit Rate</th>
                <th className="py-2 px-2 text-right w-24">Taxable Amt</th>
                <th className="py-2 px-2 text-right w-24">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {items.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50">
                  <td className="py-2.5 px-2 text-center font-mono text-slate-500">
                    {idx + 1}
                  </td>
                  <td className="py-2.5 px-2">
                    <p className="font-semibold text-slate-900">{item.name || "Custom Item"}</p>
                    {item.variant && (
                      <p className="text-[10px] text-slate-500">Variant: {item.variant}</p>
                    )}
                  </td>
                  <td className="py-2.5 px-2 text-center font-mono text-slate-500 text-[10px]">
                    610910
                  </td>
                  <td className="py-2.5 px-2 text-center font-semibold text-slate-900">
                    {item.quantity}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono text-slate-700">
                    ₹{item.price}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono text-slate-700">
                    ₹{item.price * item.quantity}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono font-bold text-slate-900">
                    ₹{item.subtotal || item.price * item.quantity}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Calculation & Summary Footer */}
        <div className="pt-3 border-t-2 border-slate-300 grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Left: Amount in Words & Notes */}
          <div className="space-y-3">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Total Amount in Words:
              </span>
              <p className="text-slate-800 font-semibold italic mt-0.5">
                {wordsAmount}
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-[10px] text-slate-600 space-y-1">
              <span className="font-bold text-slate-800 block">Terms & Conditions:</span>
              <p>1. Goods once sold will be replaced only if damaged during transit with unboxing video proof.</p>
              <p>2. Subject to Delhi jurisdiction only.</p>
              <p>3. This is a computer-generated tax invoice verified by Pratap Store CRM.</p>
            </div>
          </div>

          {/* Right: Calculations Table */}
          <div className="space-y-1.5 text-[11px]">
            <div className="flex justify-between text-slate-600">
              <span>Taxable Value (Subtotal):</span>
              <span className="font-mono">{formatIndianCurrency(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-emerald-700 font-medium">
                <span>Discount Applied:</span>
                <span className="font-mono">-{formatIndianCurrency(discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-600">
              <span>Shipping / Delivery Charges:</span>
              <span className="font-mono">
                {shippingFee > 0 ? formatIndianCurrency(shippingFee) : "FREE"}
              </span>
            </div>
            {taxAmount > 0 ? (
              <>
                <div className="flex justify-between text-slate-600 text-[10px]">
                  <span>CGST (2.5%):</span>
                  <span className="font-mono">₹{Math.round(taxAmount / 2)}</span>
                </div>
                <div className="flex justify-between text-slate-600 text-[10px]">
                  <span>SGST (2.5%):</span>
                  <span className="font-mono">₹{Math.round(taxAmount / 2)}</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between text-slate-500 text-[10px]">
                <span>GST (0% / Inclusive):</span>
                <span>₹0</span>
              </div>
            )}

            <div className="flex justify-between items-center text-sm font-bold text-slate-900 pt-2 border-t border-slate-300 mt-2">
              <span>Grand Total (INR):</span>
              <span className="text-base font-black text-indigo-700 font-mono">
                {formatIndianCurrency(totalAmount)}
              </span>
            </div>

            {/* Authorized Signatory Block */}
            <div className="pt-6 text-right">
              <div className="inline-block text-center">
                <div className="h-10 flex items-center justify-center">
                  <span className="font-serif italic text-indigo-900 text-sm font-bold border-b border-dashed border-indigo-400 pb-0.5">
                    Authorized Signatory
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1 font-semibold uppercase">
                  For {sellerName}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
