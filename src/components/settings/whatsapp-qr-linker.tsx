'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import {
  QrCode,
  Smartphone,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Loader2,
  LogOut,
  Sparkles,
  ShieldCheck,
  KeyRound,
  Copy,
  Check,
  Send,
  Plus,
  Server,
  Wifi,
  WifiOff,
  AlertTriangle,
  Radio,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface BaileysState {
  sessionId?: string;
  sessionName?: string;
  status: 'idle' | 'connecting' | 'qr_ready' | 'connected' | 'disconnected';
  qrCode: string | null;
  rawQr: string | null;
  pairingCode: string | null;
  phoneNumber: string | null;
  pushName: string | null;
  lastError: string | null;
  updatedAt: number;
  connectedAt?: number | null;
  isDefault?: boolean;
  platform?: string;
}

interface SessionSummary {
  sessionId: string;
  sessionName: string;
  status: 'idle' | 'connecting' | 'qr_ready' | 'connected' | 'disconnected';
  phoneNumber: string | null;
  pushName: string | null;
  isDefault: boolean;
  connectedAt: number | null;
  updatedAt: number;
  platform: string;
  hasSavedAuth: boolean;
}

export function WhatsAppQrLinker() {
  const [session, setSession] = useState<BaileysState>({
    status: 'idle',
    qrCode: null,
    rawQr: null,
    pairingCode: null,
    phoneNumber: null,
    pushName: null,
    lastError: null,
    updatedAt: 0,
  });
  const [sessionsList, setSessionsList] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [pairMode, setPairMode] = useState<'qr' | 'code'>('qr');
  const [pairPhone, setPairPhone] = useState('');
  const [newSessionName, setNewSessionName] = useState('');
  const [activePairSessionId, setActivePairSessionId] = useState('primary');
  const [isPairingActive, setIsPairingActive] = useState(false);

  // Test Message Modal State
  const [showTestModal, setShowTestModal] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState(
    '✅ WACRM Connection Test: Your WhatsApp linked device is active and communicating in real-time with your CRM inbox!'
  );
  const [testSending, setTestSending] = useState(false);

  // Logout / Delete Confirmation Modal State
  const [logoutTarget, setLogoutTarget] = useState<{ id: string; phone: string | null; name: string } | null>(null);

  // Copy feedback state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchSession = useCallback(async (targetSessionId?: string) => {
    try {
      const url = targetSessionId
        ? `/api/whatsapp/baileys?sessionId=${encodeURIComponent(targetSessionId)}`
        : '/api/whatsapp/baileys';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const cur = data.current || data;
        setSession(cur);
        if (Array.isArray(data.sessions)) {
          setSessionsList(data.sessions);
        }
        return data as { current: BaileysState; sessions: SessionSummary[] };
      }
    } catch (err) {
      console.error('Failed to fetch Baileys session:', err);
    }
    return null;
  }, []);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      await fetchSession();
      if (isMounted) setLoading(false);
    })();

    return () => {
      isMounted = false;
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [fetchSession]);

  // Polling ONLY when actively waiting for a QR scan or pairing code
  useEffect(() => {
    const isWaitingForScan =
      isPairingActive &&
      (session.status === 'qr_ready' || session.status === 'connecting');

    if (isWaitingForScan) {
      if (!pollTimerRef.current) {
        pollTimerRef.current = setInterval(async () => {
          const res = await fetchSession(activePairSessionId);
          if (res && res.current && res.current.status === 'connected' && res.current.phoneNumber) {
            toast.success(`WhatsApp (${res.current.phoneNumber}) linked successfully!`);
            setIsPairingActive(false);
            if (pollTimerRef.current) {
              clearInterval(pollTimerRef.current);
              pollTimerRef.current = null;
            }
          }
        }, 2500);
      }
    } else {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    }

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [isPairingActive, session.status, activePairSessionId, fetchSession]);

  // Copy phone number or pairing code
  function handleCopy(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopiedId(null), 2000);
  }

  // Start QR Code Pairing
  async function handleStartQr(targetSessionId: string = 'primary', isNew: boolean = false) {
    try {
      setActionLoading(true);
      setActivePairSessionId(targetSessionId);
      setIsPairingActive(true);
      setPairMode('qr');

      const res = await fetch('/api/whatsapp/baileys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start',
          sessionId: targetSessionId,
          sessionName: newSessionName || undefined,
          forceNew: isNew,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSession(data.current || data);
        if (Array.isArray(data.sessions)) setSessionsList(data.sessions);
        toast.info('Scan QR Code with WhatsApp on your phone.');
      } else {
        toast.error(data.error || 'Failed to generate QR code');
      }
    } catch {
      toast.error('Failed to generate QR code');
    } finally {
      setActionLoading(false);
    }
  }

  // Request 8-Digit Pairing Code
  async function handleRequestPairCode() {
    if (!pairPhone.trim()) {
      toast.error('Please enter your phone number with country code (e.g. +91 9876543210)');
      return;
    }
    try {
      setActionLoading(true);
      setIsPairingActive(true);
      const res = await fetch('/api/whatsapp/baileys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'pair_code',
          phoneNumber: pairPhone.trim(),
          sessionId: activePairSessionId,
          sessionName: newSessionName || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSession(data.current || data);
        if (Array.isArray(data.sessions)) setSessionsList(data.sessions);
        toast.success('Pairing code generated! Check notification on your phone.');
      } else {
        toast.error(data.error || 'Failed to request pairing code');
      }
    } catch {
      toast.error('Failed to generate pairing code');
    } finally {
      setActionLoading(false);
    }
  }

  // Reconnect saved session
  async function handleReconnect(sessionId: string) {
    try {
      setActionLoading(true);
      const res = await fetch('/api/whatsapp/baileys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reconnect', sessionId }),
      });
      const data = await res.json();
      if (res.ok) {
        setSession(data.current || data);
        if (Array.isArray(data.sessions)) setSessionsList(data.sessions);
        toast.success('Reconnecting WhatsApp session in background...');
      } else {
        toast.error(data.error || 'Failed to reconnect');
      }
    } catch {
      toast.error('Reconnect failed');
    } finally {
      setActionLoading(false);
    }
  }

  // Confirm and Execute Disconnect / Logout / Delete
  async function confirmDisconnect() {
    if (!logoutTarget) return;
    try {
      setActionLoading(true);
      const res = await fetch('/api/whatsapp/baileys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'disconnect',
          sessionId: logoutTarget.id,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`WhatsApp account (${logoutTarget.phone || logoutTarget.name}) unlinked and deleted.`);
        setLogoutTarget(null);
        setIsPairingActive(false);
        await fetchSession();
      } else {
        toast.error(data.error || 'Failed to disconnect');
      }
    } catch {
      toast.error('Disconnect failed');
    } finally {
      setActionLoading(false);
    }
  }

  // Clean all orphan or unlinked session attempts
  async function handleCleanOrphans() {
    try {
      setActionLoading(true);
      const res = await fetch('/api/whatsapp/baileys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clean_orphans' }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Cleaned up unlinked session attempts.');
        setIsPairingActive(false);
        await fetchSession();
      }
    } catch {
      toast.error('Failed to clean orphan sessions');
    } finally {
      setActionLoading(false);
    }
  }

  // Send Test Message
  async function handleSendTestMessage() {
    if (!testPhone.trim()) {
      toast.error('Please enter a destination phone number with country code');
      return;
    }
    try {
      setTestSending(true);
      const res = await fetch('/api/whatsapp/baileys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test_message',
          toPhone: testPhone.trim(),
          messageText: testMessage,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Test message sent successfully! Check your phone.');
        setShowTestModal(false);
      } else {
        toast.error(data.error || 'Failed to send test message');
      }
    } catch {
      toast.error('Failed to send test message');
    } finally {
      setTestSending(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-3">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Checking linked WhatsApp devices...</p>
      </div>
    );
  }

  // ONLY show sessions that have a real, verified phone number!
  const activeSessions = sessionsList.filter((s) => Boolean(s.phoneNumber));

  // If memory has a connected session with phone number not yet in list
  if (activeSessions.length === 0 && session.phoneNumber && session.status === 'connected') {
    activeSessions.push({
      sessionId: session.sessionId || 'primary',
      sessionName: session.sessionName || 'Primary WhatsApp',
      status: 'connected',
      phoneNumber: session.phoneNumber,
      pushName: session.pushName,
      isDefault: true,
      connectedAt: session.connectedAt || null,
      updatedAt: session.updatedAt,
      platform: session.platform || 'macOS Desktop (WhatsApp Web)',
      hasSavedAuth: true,
    });
  }

  const connectedCount = activeSessions.filter((s) => s.status === 'connected').length;
  const isQrReady = session.status === 'qr_ready' && Boolean(session.qrCode);
  const isConnecting = session.status === 'connecting';

  return (
    <div className="space-y-6">
      {/* Top Professional Header & Summary */}
      <div className="p-5 rounded-2xl border border-border/80 bg-gradient-to-r from-card via-card/90 to-primary/5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="size-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Smartphone className="size-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                  Connected WhatsApp Numbers
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    Multi-Device v7 Engine
                  </span>
                </h2>
                <p className="text-xs text-muted-foreground">
                  Connect multiple WhatsApp numbers, manage live sockets, sync real-time CRM messages, and control logouts.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchSession()}
              disabled={actionLoading}
              className="text-xs border-border hover:bg-muted"
            >
              <RefreshCw className={`size-3.5 mr-1.5 ${actionLoading ? 'animate-spin' : ''}`} />
              Refresh Status
            </Button>

            {connectedCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTestModal(true)}
                className="text-xs border-emerald-500/30 text-emerald-400 hover:bg-emerald-950/20"
              >
                <Send className="size-3.5 mr-1.5" />
                Send Test Message
              </Button>
            )}

            <Button
              size="sm"
              onClick={() => {
                const nextId = activeSessions.length === 0 ? 'primary' : `session_${Date.now()}`;
                setNewSessionName(`WhatsApp Line #${activeSessions.length + 1}`);
                handleStartQr(nextId, true);
              }}
              disabled={actionLoading}
              className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-sm"
            >
              <Plus className="size-3.5 mr-1.5" />
              Link WhatsApp Number
            </Button>
          </div>
        </div>

        {/* Status Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-border/60">
          <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
            <span className="text-[11px] text-muted-foreground block font-medium">Logged-in Numbers</span>
            <span className="text-lg font-bold text-foreground font-mono">
              {activeSessions.length} {activeSessions.length === 1 ? 'Number' : 'Numbers'}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
            <span className="text-[11px] text-muted-foreground block font-medium">Live Socket Sync</span>
            <span className="text-sm font-semibold flex items-center gap-1.5 mt-1 text-emerald-400">
              <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
              {connectedCount > 0 ? `${connectedCount} Online` : 'Offline / Standby'}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
            <span className="text-[11px] text-muted-foreground block font-medium">Inbound CRM Routing</span>
            <span className="text-sm font-semibold text-foreground flex items-center gap-1 mt-1">
              <Server className="size-3.5 text-primary" />
              Direct Inbox & Bot
            </span>
          </div>

          <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
            <span className="text-[11px] text-muted-foreground block font-medium">Security Protocol</span>
            <span className="text-sm font-semibold text-foreground flex items-center gap-1 mt-1">
              <ShieldCheck className="size-3.5 text-emerald-400" />
              End-to-End Encrypted
            </span>
          </div>
        </div>
      </div>

      {/* SECTION 1: LOGGED IN NUMBERS LIST (ONLY SHOWS REAL CONNECTED NUMBERS) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Radio className="size-4 text-emerald-400" />
            Active Logged-in WhatsApp Accounts ({activeSessions.length})
          </h3>
          {sessionsList.length > activeSessions.length && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCleanOrphans}
              className="text-xs text-muted-foreground hover:text-red-400 h-7"
            >
              <Trash2 className="size-3 mr-1" />
              Clean Incomplete Attempts
            </Button>
          )}
        </div>

        {activeSessions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 p-8 text-center space-y-4">
            <div className="size-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto text-primary">
              <QrCode className="size-8" />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h4 className="text-base font-semibold text-foreground">No WhatsApp Number Logged In</h4>
              <p className="text-xs text-muted-foreground">
                Point your phone camera at the QR code below to link your WhatsApp number. Once scanned, your phone number will show up here.
              </p>
            </div>
            <Button
              onClick={() => handleStartQr('primary', false)}
              disabled={actionLoading}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-sm"
            >
              <QrCode className="size-4 mr-2" />
              Scan QR Code to Log In
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {activeSessions.map((item) => {
              const isItemConnected = item.status === 'connected';
              const isItemConnecting = item.status === 'connecting';
              const displayPhone = item.phoneNumber!;

              return (
                <div
                  key={item.sessionId}
                  className={`relative rounded-2xl border p-5 transition-all space-y-4 ${
                    isItemConnected
                      ? 'border-emerald-500/40 bg-gradient-to-br from-emerald-950/20 via-card to-card shadow-sm'
                      : 'border-border bg-card'
                  }`}
                >
                  {/* Top row: Phone number, badges & online indicator */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`size-12 rounded-2xl flex items-center justify-center shrink-0 border ${
                          isItemConnected
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                            : isItemConnecting
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                            : 'bg-muted border-border text-muted-foreground'
                        }`}
                      >
                        {isItemConnected ? (
                          <CheckCircle2 className="size-6 text-emerald-400" />
                        ) : isItemConnecting ? (
                          <Loader2 className="size-6 animate-spin text-amber-400" />
                        ) : (
                          <Smartphone className="size-6" />
                        )}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold font-mono text-emerald-400 tracking-tight">
                            {displayPhone}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(displayPhone, `phone_${item.sessionId}`)}
                            className="text-muted-foreground hover:text-foreground transition-colors p-1"
                            title="Copy Phone Number"
                          >
                            {copiedId === `phone_${item.sessionId}` ? (
                              <Check className="size-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="size-3.5" />
                            )}
                          </button>
                        </div>

                        <div className="flex items-center gap-2 mt-0.5">
                          {item.pushName && (
                            <span className="text-xs text-foreground font-medium">
                              {item.pushName}
                            </span>
                          )}
                          {item.isDefault && (
                            <span className="text-[10px] bg-primary/15 text-primary border border-primary/20 px-1.5 py-0.2 rounded font-semibold">
                              Primary Outbound
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Status pill */}
                    <div className="shrink-0">
                      {isItemConnected ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Online & Live
                        </span>
                      ) : isItemConnecting ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                          <Loader2 className="size-3 animate-spin" />
                          Reconnecting...
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border">
                          <WifiOff className="size-3" />
                          Standby / Saved
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Device Info & Details */}
                  <div className="rounded-xl bg-muted/40 p-3 text-xs space-y-1.5 border border-border/40">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Device Platform:</span>
                      <span className="font-medium text-foreground">{item.platform}</span>
                    </div>
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>WhatsApp Number:</span>
                      <code className="text-emerald-400 font-mono font-semibold">{displayPhone}</code>
                    </div>
                    {item.connectedAt && (
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span>Connected Since:</span>
                        <span className="text-foreground">
                          {new Date(item.connectedAt).toLocaleDateString()} {new Date(item.connectedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Card Actions: Reconnect, Test Message & ALWAYS VISIBLE LOGOUT */}
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40">
                    <div className="flex items-center gap-2">
                      {!isItemConnected && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleReconnect(item.sessionId)}
                          disabled={actionLoading}
                          className="h-8 text-xs border-border text-foreground hover:bg-muted"
                        >
                          <RefreshCw className="size-3 mr-1" />
                          Reconnect
                        </Button>
                      )}

                      {isItemConnected && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setTestPhone(item.phoneNumber || '');
                            setShowTestModal(true);
                          }}
                          className="h-8 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/20"
                        >
                          <Send className="size-3 mr-1" />
                          Test Ping
                        </Button>
                      )}
                    </div>

                    {/* ALWAYS VISIBLE LOGOUT / DELETE BUTTON */}
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() =>
                        setLogoutTarget({
                          id: item.sessionId,
                          phone: item.phoneNumber,
                          name: item.sessionName || 'WhatsApp Device',
                        })
                      }
                      disabled={actionLoading}
                      className="h-8 text-xs bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/30 transition-all font-medium"
                    >
                      <LogOut className="size-3 mr-1" />
                      Logout / Delete
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 2: PAIRING & SCANNING SECTION (QR CODE & PAIRING CODE) */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-foreground text-lg flex items-center gap-2">
                <QrCode className="size-5 text-primary" />
                Device Pairing & QR Code Scanner
              </CardTitle>
              <CardDescription className="text-muted-foreground mt-0.5">
                Scan with your WhatsApp mobile app or use the 8-digit Pairing Code to link.
              </CardDescription>
            </div>

            {/* Pair Mode Switcher: QR Code vs Pairing Code */}
            <div className="flex p-1 rounded-xl bg-muted/50 border border-border shrink-0 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => {
                  setPairMode('qr');
                  handleStartQr(activePairSessionId);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  pairMode === 'qr' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <QrCode className="size-3.5" />
                QR Scanner
              </button>
              <button
                type="button"
                onClick={() => setPairMode('code')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  pairMode === 'code' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <KeyRound className="size-3.5" />
                Pairing Code
              </button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="grid gap-8 lg:grid-cols-2 items-center">
            {/* Visual Screen: QR Code OR 8-digit Pairing Code */}
            <div className="flex flex-col items-center justify-center p-6 rounded-2xl border border-border bg-muted/30 min-h-[360px]">
              {pairMode === 'qr' ? (
                isQrReady ? (
                  <div className="flex flex-col items-center space-y-4">
                    {/* Modern QR Container with scan line effect */}
                    <div className="relative p-3.5 bg-white rounded-2xl shadow-xl border border-gray-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={session.qrCode!}
                        alt="WhatsApp QR Code"
                        className="size-60 rounded-lg object-contain"
                      />
                      <div className="absolute inset-0 rounded-2xl border-2 border-primary/30 pointer-events-none" />
                    </div>

                    <div className="flex items-center gap-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleStartQr(activePairSessionId, true)}
                        disabled={actionLoading}
                        className="text-xs border-border"
                      >
                        <RefreshCw className={`size-3.5 mr-1.5 ${actionLoading ? 'animate-spin' : ''}`} />
                        Refresh QR Code
                      </Button>
                    </div>

                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-emerald-400 animate-ping" />
                      Point your phone camera at this QR code...
                    </p>
                  </div>
                ) : isConnecting ? (
                  <div className="flex flex-col items-center justify-center space-y-3 py-12 text-center">
                    <Loader2 className="size-10 animate-spin text-primary" />
                    <p className="text-sm font-semibold text-foreground">
                      Initializing Baileys Socket...
                    </p>
                    <p className="text-xs text-muted-foreground max-w-xs">
                      Generating cryptographic keypairs and fresh QR code.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center space-y-4 py-8 text-center">
                    <div className="size-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                      <QrCode className="size-8" />
                    </div>
                    <div>
                      <h4 className="text-base font-semibold text-foreground">Generate Pairing QR Code</h4>
                      <p className="text-xs text-muted-foreground max-w-xs mt-1">
                        Click below to generate a fresh QR code to link your WhatsApp number.
                      </p>
                    </div>
                    <Button
                      onClick={() => handleStartQr(activePairSessionId, false)}
                      disabled={actionLoading}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
                    >
                      {actionLoading ? (
                        <>
                          <Loader2 className="size-4 animate-spin mr-2" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <QrCode className="size-4 mr-2" />
                          Generate QR Code
                        </>
                      )}
                    </Button>
                  </div>
                )
              ) : (
                /* Pairing Code Mode */
                <div className="w-full max-w-sm space-y-4 py-4">
                  <div className="text-center space-y-1">
                    <div className="size-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto text-primary">
                      <KeyRound className="size-6" />
                    </div>
                    <h4 className="text-base font-semibold text-foreground">Link with Phone Number</h4>
                    <p className="text-xs text-muted-foreground">
                      Receive an 8-digit code directly to enter in your WhatsApp mobile app.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-xs font-semibold text-foreground">
                      Mobile Number (with Country Code)
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="+91 80010 80776"
                        value={pairPhone}
                        onChange={(e) => setPairPhone(e.target.value)}
                        className="text-sm bg-muted border-border font-mono"
                      />
                      <Button
                        onClick={handleRequestPairCode}
                        disabled={actionLoading}
                        className="shrink-0"
                      >
                        {actionLoading ? <Loader2 className="size-3.5 animate-spin" /> : 'Get Code'}
                      </Button>
                    </div>
                  </div>

                  {session.pairingCode && (
                    <div className="p-4 rounded-xl bg-primary/10 border border-primary/25 text-center space-y-2">
                      <span className="text-xs text-muted-foreground block font-medium">
                        Your 8-Digit Pairing Code:
                      </span>
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-2xl font-mono font-bold tracking-widest text-primary">
                          {session.pairingCode}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopy(session.pairingCode!, 'pair_code')}
                          className="h-8 px-2 text-primary hover:bg-primary/20"
                        >
                          {copiedId === 'pair_code' ? (
                            <Check className="size-4 text-emerald-400" />
                          ) : (
                            <Copy className="size-4" />
                          )}
                        </Button>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Open WhatsApp on your phone, tap Linked Devices &gt; Link with phone number instead, and enter this code.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Step-by-Step Linking Instructions */}
            <div className="space-y-6">
              <div>
                <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                  <Smartphone className="size-4 text-primary" />
                  How to Link WhatsApp on Mobile Phone
                </h4>
                <ol className="space-y-3 text-sm text-foreground/90">
                  <li className="flex items-start gap-2.5">
                    <span className="flex size-5 rounded-full bg-primary/20 text-primary font-bold text-xs items-center justify-center shrink-0 mt-0.5">
                      1
                    </span>
                    <span>Open <strong>WhatsApp</strong> on your phone.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="flex size-5 rounded-full bg-primary/20 text-primary font-bold text-xs items-center justify-center shrink-0 mt-0.5">
                      2
                    </span>
                    <span>
                      Tap <strong>Menu</strong> (Android: <strong>⋮</strong> top right) or <strong>Settings</strong> (iPhone: <strong>⚙️</strong> bottom right).
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="flex size-5 rounded-full bg-primary/20 text-primary font-bold text-xs items-center justify-center shrink-0 mt-0.5">
                      3
                    </span>
                    <span>
                      Tap <strong>Linked Devices</strong>, then tap <strong>Link a Device</strong>.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="flex size-5 rounded-full bg-primary/20 text-primary font-bold text-xs items-center justify-center shrink-0 mt-0.5">
                      4
                    </span>
                    <span>
                      Point your phone camera at this QR code or choose &ldquo;Link with phone number instead&rdquo; to enter the 8-digit code!
                    </span>
                  </li>
                </ol>
              </div>

              {/* Pro Advantages */}
              <div className="rounded-xl border border-border/80 bg-muted/20 p-4 space-y-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2 text-foreground font-semibold">
                  <Sparkles className="size-4 text-primary" />
                  Benefits of Linked Multi-Device
                </div>
                <ul className="space-y-1.5 pl-5 list-disc">
                  <li>Zero Meta Developer setup & no per-conversation messaging fees.</li>
                  <li>Replies can be sent anytime without 24-hour customer window limits.</li>
                  <li>Inbound messages trigger AI auto-replies, flows, and the commerce ordering bot automatically.</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* MODAL 1: CONFIRM DISCONNECT / LOGOUT / DELETE */}
      {logoutTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in-50">
          <div className="w-full max-w-md rounded-2xl border border-red-500/30 bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="size-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0">
                <AlertTriangle className="size-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">Log out from WhatsApp?</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Are you sure you want to log out and permanently delete{' '}
                  <strong className="text-foreground font-mono text-sm">{logoutTarget.phone || logoutTarget.name}</strong>?
                </p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed bg-muted/30 p-3 rounded-lg border border-border">
              This will terminate the active WhatsApp Web socket and delete saved authentication files from the server. You can re-link this device anytime by scanning a new QR code.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLogoutTarget(null)}
                disabled={actionLoading}
                className="text-xs border-border"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={confirmDisconnect}
                disabled={actionLoading}
                className="text-xs bg-red-600 hover:bg-red-700 text-white font-medium"
              >
                {actionLoading ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin mr-1.5" />
                    Logging out...
                  </>
                ) : (
                  <>
                    <LogOut className="size-3.5 mr-1.5" />
                    Yes, Disconnect & Delete
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: SEND TEST MESSAGE */}
      {showTestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in-50">
          <div className="w-full max-w-md rounded-2xl border border-emerald-500/30 bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="size-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <Send className="size-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">Send Test WhatsApp Message</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Verify real-time delivery from your connected WhatsApp device.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <Label className="text-xs font-semibold text-foreground">Destination Phone Number</Label>
                <Input
                  placeholder="e.g. 919876543210 (with country code)"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  className="text-sm bg-muted border-border font-mono mt-1"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-foreground">Message Body</Label>
                <textarea
                  rows={3}
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  className="w-full rounded-md border border-border bg-muted p-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary mt-1"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTestModal(false)}
                disabled={testSending}
                className="text-xs border-border"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSendTestMessage}
                disabled={testSending}
                className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
              >
                {testSending ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin mr-1.5" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="size-3.5 mr-1.5" />
                    Send Test Message
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
