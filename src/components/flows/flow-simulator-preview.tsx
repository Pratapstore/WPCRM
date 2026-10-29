"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Smartphone,
  RotateCcw,
  Send,
  Sparkles,
  CheckCircle2,
  Package,
  MapPin,
  CreditCard,
  User,
  Check,
  ChevronRight,
  X,
  ExternalLink,
  ShieldCheck,
  Phone,
  MessageSquare,
  ListFilter,
  Play,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useFlowEditor } from "./flow-editor-state";
import type { BuilderNode } from "./shared";
import { toast } from "sonner";

interface SimMessage {
  id: string;
  sender: "bot" | "user";
  nodeKey?: string;
  nodeType?: string;
  text?: string;
  headerText?: string;
  footerText?: string;
  buttons?: Array<{ reply_id: string; title: string; next_node_key: string }>;
  list?: {
    button_label: string;
    header_text?: string;
    sections: Array<{
      title?: string;
      rows: Array<{
        reply_id: string;
        title: string;
        description?: string;
        next_node_key: string;
      }>;
    }>;
  };
  isHandoff?: boolean;
  handoffNote?: string;
  timestamp: string;
}

export function FlowSimulatorPreview() {
  const { flow, state } = useFlowEditor();
  const nodes = state.nodes;

  const [history, setHistory] = useState<SimMessage[]>([]);
  const [currentNodeKey, setCurrentNodeKey] = useState<string | null>(null);
  const [vars, setVars] = useState<Record<string, string>>({
    customer_name: "",
    shipping_address: "",
    pincode: "",
    product_name: "",
    product_size: "",
    payment_mode: "",
  });
  const [inputVal, setInputVal] = useState("");
  const [activeListSheet, setActiveListSheet] = useState<{
    button_label: string;
    sections: Array<{
      title?: string;
      rows: Array<{
        reply_id: string;
        title: string;
        description?: string;
        next_node_key: string;
      }>;
    }>;
  } | null>(null);

  const [waitingInputKey, setWaitingInputKey] = useState<string | null>(null);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Helper to interpolate {{vars.xyz}}
  const interpolate = (text?: string): string => {
    if (!text) return "";
    return text.replace(/\{\{\s*vars\.([a-zA-Z0-9_-]+)\s*\}\}/g, (_, key) => {
      return vars[key] || `[${key}]`;
    });
  };

  const getTimeStr = () => {
    const d = new Date();
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // Node lookup map
  const nodeMap = useRef<Map<string, BuilderNode>>(new Map());
  useEffect(() => {
    const map = new Map<string, BuilderNode>();
    nodes.forEach((n) => map.set(n.node_key, n));
    nodeMap.current = map;
  }, [nodes]);

  // Restart flow from beginning
  const startFlow = () => {
    const entryId = flow.entry_node_id || (nodes[0]?.node_key ?? "start");
    setHistory([]);
    setVars({
      customer_name: "",
      shipping_address: "",
      pincode: "",
      product_name: "",
      product_size: "",
      payment_mode: "",
    });
    setWaitingInputKey(null);
    setActiveListSheet(null);
    setCurrentNodeKey(entryId);
    advanceToNode(entryId, {});
  };

  useEffect(() => {
    startFlow();
  }, [flow.id]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, waitingInputKey, activeListSheet]);

  const advanceToNode = (
    nodeKey: string,
    currentVars: Record<string, string>
  ) => {
    const targetNode = nodeMap.current.get(nodeKey);
    if (!targetNode) {
      // End or unknown node
      return;
    }

    const cfg = (targetNode.config || {}) as any;

    if (targetNode.node_type === "start") {
      const nextKey = cfg.next_node_key;
      if (nextKey) {
        setTimeout(() => advanceToNode(nextKey, currentVars), 300);
      }
      return;
    }

    if (targetNode.node_type === "send_message") {
      const msgText = interpolate(cfg.text || "");
      const msg: SimMessage = {
        id: `bot-${Date.now()}-${Math.random()}`,
        sender: "bot",
        nodeKey: targetNode.node_key,
        nodeType: targetNode.node_type,
        text: msgText,
        timestamp: getTimeStr(),
      };
      setHistory((prev) => [...prev, msg]);

      if (cfg.next_node_key) {
        setTimeout(() => advanceToNode(cfg.next_node_key, currentVars), 600);
      }
      return;
    }

    if (targetNode.node_type === "send_buttons") {
      const msgText = interpolate(cfg.text || "");
      const msg: SimMessage = {
        id: `bot-${Date.now()}-${Math.random()}`,
        sender: "bot",
        nodeKey: targetNode.node_key,
        nodeType: targetNode.node_type,
        headerText: cfg.header_text ? interpolate(cfg.header_text) : undefined,
        footerText: cfg.footer_text ? interpolate(cfg.footer_text) : undefined,
        text: msgText,
        buttons: cfg.buttons || [],
        timestamp: getTimeStr(),
      };
      setHistory((prev) => [...prev, msg]);
      return;
    }

    if (targetNode.node_type === "send_list") {
      const msgText = interpolate(cfg.text || "");
      const msg: SimMessage = {
        id: `bot-${Date.now()}-${Math.random()}`,
        sender: "bot",
        nodeKey: targetNode.node_key,
        nodeType: targetNode.node_type,
        headerText: cfg.header_text ? interpolate(cfg.header_text) : undefined,
        footerText: cfg.footer_text ? interpolate(cfg.footer_text) : undefined,
        text: msgText,
        list: {
          button_label: cfg.button_label || "View Options",
          sections: cfg.sections || [],
        },
        timestamp: getTimeStr(),
      };
      setHistory((prev) => [...prev, msg]);
      return;
    }

    if (targetNode.node_type === "collect_input") {
      const promptText = interpolate(cfg.prompt_text || "Please reply:");
      const msg: SimMessage = {
        id: `bot-${Date.now()}-${Math.random()}`,
        sender: "bot",
        nodeKey: targetNode.node_key,
        nodeType: targetNode.node_type,
        text: promptText,
        timestamp: getTimeStr(),
      };
      setHistory((prev) => [...prev, msg]);
      setWaitingInputKey(targetNode.node_key);
      return;
    }

    if (targetNode.node_type === "handoff") {
      const noteText = interpolate(cfg.note || "Handoff to human agent");
      const msg: SimMessage = {
        id: `bot-${Date.now()}-${Math.random()}`,
        sender: "bot",
        nodeKey: targetNode.node_key,
        nodeType: targetNode.node_type,
        isHandoff: true,
        handoffNote: noteText,
        text: "🔔 Your request has been passed to our human order fulfillment team.",
        timestamp: getTimeStr(),
      };
      setHistory((prev) => [...prev, msg]);
      return;
    }

    if (targetNode.node_type === "end") {
      const msg: SimMessage = {
        id: `bot-${Date.now()}-${Math.random()}`,
        sender: "bot",
        nodeKey: targetNode.node_key,
        nodeType: targetNode.node_type,
        text: "🏁 Flow ended.",
        timestamp: getTimeStr(),
      };
      setHistory((prev) => [...prev, msg]);
      return;
    }
  };

  const handleButtonClick = (btn: {
    reply_id: string;
    title: string;
    next_node_key: string;
  }) => {
    // Record user reply
    const userMsg: SimMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: btn.title,
      timestamp: getTimeStr(),
    };
    setHistory((prev) => [...prev, userMsg]);

    // Detect size / payment preference
    const updatedVars = { ...vars };
    const lower = btn.title.toLowerCase();
    if (lower.includes("s") || lower.includes("m") || lower.includes("l") || lower.includes("photo") || lower.includes("spotify")) {
      updatedVars.product_size = btn.title;
    }
    if (lower.includes("upi") || lower.includes("online")) {
      updatedVars.payment_mode = "prepaid_upi";
    } else if (lower.includes("cod") || lower.includes("delivery")) {
      updatedVars.payment_mode = "cod";
    }
    setVars(updatedVars);

    // Advance
    if (btn.next_node_key) {
      setTimeout(() => advanceToNode(btn.next_node_key, updatedVars), 400);
    }
  };

  const handleListSelect = (row: {
    reply_id: string;
    title: string;
    description?: string;
    next_node_key: string;
  }) => {
    setActiveListSheet(null);
    const userMsg: SimMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: row.title,
      timestamp: getTimeStr(),
    };
    setHistory((prev) => [...prev, userMsg]);

    const updatedVars = { ...vars, product_name: row.title };
    setVars(updatedVars);

    if (row.next_node_key) {
      setTimeout(() => advanceToNode(row.next_node_key, updatedVars), 400);
    }
  };

  const handleInputSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputVal.trim() || !waitingInputKey) return;

    const currNode = nodeMap.current.get(waitingInputKey);
    const cfg = (currNode?.config || {}) as any;
    const varKey = cfg.var_key || "input";
    const text = inputVal.trim();

    // Add user message
    const userMsg: SimMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: text,
      timestamp: getTimeStr(),
    };
    setHistory((prev) => [...prev, userMsg]);

    const updatedVars: Record<string, string> = { ...vars, [varKey]: text };
    if (varKey.includes("name")) updatedVars["customer_name"] = text;
    if (varKey.includes("address")) updatedVars["shipping_address"] = text;
    if (varKey.includes("pin")) updatedVars["pincode"] = text;

    setVars(updatedVars);
    setInputVal("");
    setWaitingInputKey(null);

    const nextKey = cfg.next_node_key;
    if (nextKey) {
      setTimeout(() => advanceToNode(nextKey, updatedVars), 500);
    }
  };

  // 1-Click Auto Demo (Simulates customer typing & placing complete order)
  const runAutoDemo = () => {
    startFlow();
    setIsAutoPlaying(true);
    toast.info("Auto Demo started: Simulating customer order collection flow...");

    setTimeout(() => {
      // 1. Pick keychain or mug from list
      const catalogMsg = history.find((m) => m.list);
      if (catalogMsg?.list?.sections?.[0]?.rows?.[0]) {
        handleListSelect(catalogMsg.list.sections[0].rows[0]);
      }
    }, 1200);
  };

  return (
    <div className="flex h-full w-full flex-col lg:flex-row overflow-hidden bg-background">
      {/* LEFT: Phone Shell Container */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 overflow-y-auto">
        {/* Top Controls Bar */}
        <div className="w-full max-w-sm flex items-center justify-between mb-3 text-xs">
          <div className="flex items-center gap-1.5 font-medium text-muted-foreground">
            <Smartphone className="h-4 w-4 text-emerald-500" />
            <span>Interactive WhatsApp Simulator</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs px-2.5 gap-1"
              onClick={startFlow}
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs px-2.5 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={runAutoDemo}
            >
              <Play className="h-3 w-3" />
              Auto Test
            </Button>
          </div>
        </div>

        {/* Smartphone Hardware Frame */}
        <div className="relative w-full max-w-[360px] h-[640px] sm:h-[680px] bg-neutral-950 rounded-[44px] p-3 shadow-2xl border-4 border-neutral-800 flex flex-col overflow-hidden">
          {/* Top Notch & Camera */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 w-24 h-4 bg-neutral-900 rounded-full z-30 flex items-center justify-center">
            <div className="w-2.5 h-2.5 bg-neutral-950 rounded-full border border-neutral-700" />
          </div>

          {/* Screen Wrapper */}
          <div className="relative flex-1 bg-[#0b141a] text-[#e9edef] rounded-[36px] overflow-hidden flex flex-col pt-5">
            {/* WhatsApp Header */}
            <div className="h-14 bg-[#1f2c34] px-3.5 flex items-center justify-between shrink-0 border-b border-[#2a3942] z-20">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-emerald-700 flex items-center justify-center font-bold text-white text-xs border border-emerald-500/40">
                  PS
                </div>
                <div>
                  <div className="flex items-center gap-1 leading-tight">
                    <span className="font-semibold text-xs sm:text-sm text-white">
                      Pratap Store
                    </span>
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 fill-emerald-400" />
                  </div>
                  <span className="text-[10px] text-emerald-400">
                    Official Business Account
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2.5 text-neutral-400 text-xs">
                <Phone className="h-4 w-4 hover:text-white cursor-pointer" />
                <span className="text-[11px] font-mono">5G</span>
              </div>
            </div>

            {/* Chat Messages Body */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-3 space-y-3 relative"
              style={{
                backgroundImage:
                  "radial-gradient(#1f2c34 0.75px, transparent 0.75px)",
                backgroundSize: "16px 16px",
              }}
            >
              {/* Date Chip */}
              <div className="flex justify-center my-1">
                <span className="bg-[#182229] text-neutral-400 text-[10px] px-2.5 py-0.5 rounded-full font-medium">
                  TODAY
                </span>
              </div>

              {history.map((msg) => {
                const isBot = msg.sender === "bot";

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${
                      isBot ? "items-start" : "items-end"
                    } animate-in fade-in duration-200`}
                  >
                    {/* Bot Message Bubble */}
                    {isBot ? (
                      <div className="max-w-[88%] space-y-1">
                        <div className="bg-[#202c33] text-[#e9edef] rounded-2xl rounded-tl-sm p-3 shadow-sm border border-[#2a3942]/60 text-xs space-y-2">
                          {msg.headerText && (
                            <div className="font-semibold text-[11px] text-emerald-400 uppercase tracking-wide border-b border-[#2a3942] pb-1">
                              {msg.headerText}
                            </div>
                          )}

                          {msg.text && (
                            <div className="whitespace-pre-line leading-relaxed text-[12px]">
                              {msg.text}
                            </div>
                          )}

                          {msg.footerText && (
                            <div className="text-[10px] text-neutral-400 pt-0.5 italic">
                              {msg.footerText}
                            </div>
                          )}

                          {/* List Button Trigger */}
                          {msg.list && (
                            <div className="pt-2 border-t border-[#2a3942]">
                              <button
                                type="button"
                                onClick={() => setActiveListSheet(msg.list!)}
                                className="w-full bg-[#00a884] hover:bg-[#029071] text-neutral-950 font-semibold py-2 px-3 rounded-lg text-xs flex items-center justify-center gap-1.5 shadow transition-all active:scale-95"
                              >
                                <ListFilter className="h-3.5 w-3.5" />
                                {msg.list.button_label || "Browse Catalog 🛍️"}
                              </button>
                            </div>
                          )}

                          {/* Handoff Notice */}
                          {msg.isHandoff && (
                            <div className="bg-emerald-950/60 border border-emerald-600/40 rounded-lg p-2 text-[11px] text-emerald-300 flex items-start gap-1.5 mt-2">
                              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                              <div>
                                <span className="font-bold">System Registered:</span>{" "}
                                {msg.handoffNote}
                              </div>
                            </div>
                          )}

                          <div className="text-[9px] text-neutral-400 text-right pt-0.5">
                            {msg.timestamp}
                          </div>
                        </div>

                        {/* Interactive Buttons Below Bubble (Meta Cloud API Card Style) */}
                        {msg.buttons && msg.buttons.length > 0 && (
                          <div className="space-y-1 pt-0.5 pl-1">
                            {msg.buttons.map((btn) => (
                              <button
                                key={btn.reply_id}
                                type="button"
                                onClick={() => handleButtonClick(btn)}
                                className="w-full bg-[#202c33] hover:bg-[#2a3942] text-emerald-400 font-semibold py-2 px-3 rounded-xl border border-[#2a3942] text-xs flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.98] group"
                              >
                                <span>{btn.title}</span>
                                <ChevronRight className="h-3 w-3 opacity-60 group-hover:translate-x-0.5 transition-transform" />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Customer Message Bubble */
                      <div className="max-w-[85%] bg-[#005c4b] text-[#e9edef] rounded-2xl rounded-tr-sm p-2.5 shadow-sm text-xs space-y-1">
                        <div className="whitespace-pre-line text-[12px] leading-relaxed">
                          {msg.text}
                        </div>
                        <div className="text-[9px] text-[#8696a0] text-right flex items-center justify-end gap-1">
                          <span>{msg.timestamp}</span>
                          <Check className="h-3 w-3 text-[#53bdeb]" />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Waiting Input Indicator */}
              {waitingInputKey && (
                <div className="flex items-center gap-1.5 text-neutral-400 text-[11px] italic bg-[#182229] px-3 py-1.5 rounded-full w-fit">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Waiting for your response below...</span>
                </div>
              )}
            </div>

            {/* List Menu Bottom Sheet (WhatsApp Style) */}
            {activeListSheet && (
              <div className="absolute inset-x-0 bottom-0 max-h-[75%] bg-[#111b21] rounded-t-3xl border-t border-[#2a3942] p-4 flex flex-col z-40 shadow-2xl animate-in slide-in-from-bottom duration-250">
                <div className="flex items-center justify-between border-b border-[#2a3942] pb-3 mb-2">
                  <div className="font-semibold text-sm text-white flex items-center gap-1.5">
                    <Package className="h-4 w-4 text-emerald-400" />
                    <span>{activeListSheet.button_label}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveListSheet(null)}
                    className="text-neutral-400 hover:text-white p-1"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
                  {activeListSheet.sections.map((sec, sIdx) => (
                    <div key={sIdx} className="space-y-1.5">
                      {sec.title && (
                        <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider px-1">
                          {sec.title}
                        </div>
                      )}
                      <div className="space-y-1">
                        {sec.rows.map((row) => (
                          <div
                            key={row.reply_id}
                            onClick={() => handleListSelect(row)}
                            className="p-2.5 rounded-xl bg-[#202c33] hover:bg-[#2a3942] cursor-pointer border border-[#2a3942]/60 transition-colors flex items-center justify-between"
                          >
                            <div>
                              <div className="font-medium text-white text-[12px]">
                                {row.title}
                              </div>
                              {row.description && (
                                <div className="text-[11px] text-neutral-400">
                                  {row.description}
                                </div>
                              )}
                            </div>
                            <ChevronRight className="h-3.5 w-3.5 text-neutral-400" />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* WhatsApp Chat Input Bar */}
            <form
              onSubmit={handleInputSubmit}
              className="h-14 bg-[#1f2c34] px-3 flex items-center gap-2 shrink-0 border-t border-[#2a3942] z-20"
            >
              <input
                type="text"
                placeholder={
                  waitingInputKey
                    ? "Type your response..."
                    : "Tap a button or list option..."
                }
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                disabled={!waitingInputKey}
                className="flex-1 bg-[#2a3942] text-white text-xs px-3.5 py-2 rounded-full outline-none placeholder:text-neutral-500 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!waitingInputKey || !inputVal.trim()}
                className="w-9 h-9 rounded-full bg-[#00a884] hover:bg-[#029071] disabled:opacity-40 disabled:hover:bg-[#00a884] flex items-center justify-center text-neutral-950 transition-all shrink-0"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* RIGHT: Live Flow Variables & Order Summary */}
      <div className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l border-border bg-card/60 p-4 sm:p-6 flex flex-col space-y-5 overflow-y-auto">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-400" />
            <h3 className="font-bold text-base text-foreground">
              Live Order Intelligence
            </h3>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Real-time variables collected automatically by the WhatsApp Flow as
            the customer interacts.
          </p>
        </div>

        {/* Live Extracted Variables Cards */}
        <div className="space-y-2.5">
          {/* Product Name */}
          <div className="p-3 rounded-xl border border-border bg-card/40 flex items-start justify-between">
            <div className="flex items-start gap-2.5">
              <Package className="h-4 w-4 text-primary mt-0.5" />
              <div>
                <span className="text-[11px] text-muted-foreground uppercase tracking-wide block font-semibold">
                  Selected Product
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {vars.product_name || "Waiting for catalog pick..."}
                </span>
              </div>
            </div>
            {vars.product_name && (
              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px]">
                Captured
              </Badge>
            )}
          </div>

          {/* Size / Variant */}
          <div className="p-3 rounded-xl border border-border bg-card/40 flex items-start justify-between">
            <div className="flex items-start gap-2.5">
              <ListFilter className="h-4 w-4 text-purple-400 mt-0.5" />
              <div>
                <span className="text-[11px] text-muted-foreground uppercase tracking-wide block font-semibold">
                  Size / Customization
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {vars.product_size || "Waiting for button tap..."}
                </span>
              </div>
            </div>
            {vars.product_size && (
              <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/30 text-[10px]">
                Selected
              </Badge>
            )}
          </div>

          {/* Customer Name */}
          <div className="p-3 rounded-xl border border-border bg-card/40 flex items-start justify-between">
            <div className="flex items-start gap-2.5">
              <User className="h-4 w-4 text-blue-400 mt-0.5" />
              <div>
                <span className="text-[11px] text-muted-foreground uppercase tracking-wide block font-semibold">
                  Customer Name
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {vars.customer_name || "Waiting for input reply..."}
                </span>
              </div>
            </div>
            {vars.customer_name && (
              <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/30 text-[10px]">
                Verified
              </Badge>
            )}
          </div>

          {/* Delivery Address */}
          <div className="p-3 rounded-xl border border-border bg-card/40 flex items-start justify-between">
            <div className="flex items-start gap-2.5">
              <MapPin className="h-4 w-4 text-amber-400 mt-0.5" />
              <div>
                <span className="text-[11px] text-muted-foreground uppercase tracking-wide block font-semibold">
                  Shipping Address
                </span>
                <span className="text-sm font-semibold text-foreground leading-snug line-clamp-2">
                  {vars.shipping_address || "Waiting for address input..."}
                </span>
              </div>
            </div>
            {vars.shipping_address && (
              <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-[10px]">
                Saved
              </Badge>
            )}
          </div>

          {/* PIN Code */}
          <div className="p-3 rounded-xl border border-border bg-card/40 flex items-start justify-between">
            <div className="flex items-start gap-2.5">
              <span className="text-xs font-mono font-bold text-emerald-400">
                📮
              </span>
              <div>
                <span className="text-[11px] text-muted-foreground uppercase tracking-wide block font-semibold">
                  Pincode / City
                </span>
                <span className="text-sm font-semibold text-foreground font-mono">
                  {vars.pincode || "Waiting for pincode..."}
                </span>
              </div>
            </div>
            {vars.pincode && (
              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px]">
                Pincode
              </Badge>
            )}
          </div>

          {/* Payment Mode */}
          <div className="p-3 rounded-xl border border-border bg-card/40 flex items-start justify-between">
            <div className="flex items-start gap-2.5">
              <CreditCard className="h-4 w-4 text-emerald-400 mt-0.5" />
              <div>
                <span className="text-[11px] text-muted-foreground uppercase tracking-wide block font-semibold">
                  Payment Mode
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {vars.payment_mode === "prepaid_upi"
                    ? "Instant UPI (Zero Fees)"
                    : vars.payment_mode === "cod"
                    ? "Cash on Delivery"
                    : "Not chosen yet"}
                </span>
              </div>
            </div>
            {vars.payment_mode && (
              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px]">
                {vars.payment_mode === "prepaid_upi" ? "Prepaid" : "COD"}
              </Badge>
            )}
          </div>
        </div>

        {/* Store UPI Handle Card */}
        <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-950/20 text-xs space-y-1.5">
          <div className="font-semibold text-emerald-300 flex items-center justify-between">
            <span>Verified Store UPI Account</span>
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
          </div>
          <div className="font-mono text-white text-xs bg-black/40 px-2 py-1 rounded flex items-center justify-between">
            <span>pratapstore@jio</span>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText("pratapstore@jio");
                toast.success("UPI ID copied!");
              }}
              className="text-neutral-400 hover:text-white"
            >
              <Copy className="h-3 w-3" />
            </button>
          </div>
          <p className="text-[11px] text-neutral-400">
            Payment link and QR code in the flow are directly hooked to Pratap Store UPI.
          </p>
        </div>
      </div>
    </div>
  );
}
