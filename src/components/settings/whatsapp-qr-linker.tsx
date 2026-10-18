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
  ArrowRight,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface BaileysState {
  status: 'idle' | 'connecting' | 'qr_ready' | 'connected' | 'disconnected';
  qrCode: string | null;
  rawQr: string | null;
  pairingCode: string | null;
  phoneNumber: string | null;
  pushName: string | null;
  lastError: string | null;
  updatedAt: number;
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
    updatedAt: Date.now(),
  });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showPairCodeInput, setShowPairCodeInput] = useState(false);
  const [pairPhone, setPairPhone] = useState('');
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch('/api/whatsapp/baileys');
      if (res.ok) {
        const data = await res.json();
        setSession(data);
        return data as BaileysState;
      }
    } catch (err) {
      console.error('Failed to fetch Baileys session:', err);
    }
    return null;
  }, []);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      setLoading(true);
      await fetchSession();
      if (isMounted) setLoading(false);
    })();

    return () => {
      isMounted = false;
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [fetchSession]);

  // Dynamic polling when waiting for scan
  useEffect(() => {
    if (session.status === 'connecting' || session.status === 'qr_ready') {
      if (!pollTimerRef.current) {
        pollTimerRef.current = setInterval(async () => {
          const updated = await fetchSession();
          if (updated && updated.status === 'connected') {
            toast.success('WhatsApp device linked successfully!');
            if (pollTimerRef.current) {
              clearInterval(pollTimerRef.current);
              pollTimerRef.current = null;
            }
          }
        }, 3000);
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
  }, [session.status, fetchSession]);

  async function handleStartQr() {
    try {
      setActionLoading(true);
      setShowPairCodeInput(false);
      const res = await fetch('/api/whatsapp/baileys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' }),
      });
      const data = await res.json();
      if (res.ok) {
        setSession(data);
        toast.info('QR Code session started. Scan with WhatsApp on your phone.');
      } else {
        toast.error(data.error || 'Failed to start session');
      }
    } catch {
      toast.error('Failed to generate QR code');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRequestPairCode() {
    if (!pairPhone.trim()) {
      toast.error('Please enter your phone number with country code (e.g. +91 9876543210)');
      return;
    }
    try {
      setActionLoading(true);
      const res = await fetch('/api/whatsapp/baileys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pair_code', phoneNumber: pairPhone.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setSession(data);
        toast.success('Pairing code generated! Check your WhatsApp notification.');
      } else {
        toast.error(data.error || 'Failed to request pairing code');
      }
    } catch {
      toast.error('Failed to generate pairing code');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm('Are you sure you want to log out and disconnect this WhatsApp device?')) {
      return;
    }
    try {
      setActionLoading(true);
      const res = await fetch('/api/whatsapp/baileys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disconnect' }),
      });
      if (res.ok) {
        setSession({
          status: 'disconnected',
          qrCode: null,
          rawQr: null,
          pairingCode: null,
          phoneNumber: null,
          pushName: null,
          lastError: null,
          updatedAt: Date.now(),
        });
        toast.success('WhatsApp device unlinked.');
      } else {
        toast.error('Failed to disconnect');
      }
    } catch {
      toast.error('Disconnect failed');
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-7 animate-spin text-primary" />
      </div>
    );
  }

  const isConnected = session.status === 'connected';
  const isQrReady = session.status === 'qr_ready' && Boolean(session.qrCode);
  const isConnecting = session.status === 'connecting';

  return (
    <div className="space-y-6">
      {/* Status banner */}
      {isConnected ? (
        <Alert className="border-emerald-600/40 bg-emerald-950/20 text-foreground">
          <div className="flex items-start gap-3">
            <ShieldCheck className="size-5 text-emerald-400 mt-0.5 shrink-0" />
            <div className="flex-1">
              <AlertTitle className="text-emerald-300 font-semibold flex items-center gap-2">
                WhatsApp Linked Device Active
                <span className="inline-flex items-center gap-1 text-[11px] font-normal bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full">
                  <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live Socket
                </span>
              </AlertTitle>
              <AlertDescription className="text-muted-foreground text-sm mt-1">
                Your device is connected and synced. Inbound & outbound messages will sync directly with your CRM inbox.
              </AlertDescription>
              <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <div>
                  <span className="text-foreground font-medium">Connected Phone:</span>{' '}
                  <code className="text-emerald-300 font-mono text-sm">
                    {session.phoneNumber || 'Linked Phone'}
                  </code>
                </div>
                {session.pushName && (
                  <div>
                    <span className="text-foreground font-medium">Profile Name:</span>{' '}
                    <span>{session.pushName}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Alert>
      ) : (
        <Alert className="border-border bg-card">
          <div className="flex items-start gap-3">
            <Smartphone className="size-5 text-primary mt-0.5 shrink-0" />
            <div className="flex-1">
              <AlertTitle className="text-foreground font-semibold">
                Link WhatsApp Device (Scan QR Code)
              </AlertTitle>
              <AlertDescription className="text-muted-foreground text-sm mt-1">
                Connect your WhatsApp number directly using WhatsApp Multi-Device. No Meta Developer verification, no paid template fees, and no 24-hour messaging window limitations.
              </AlertDescription>
            </div>
          </div>
        </Alert>
      )}

      {/* Main card */}
      <Card className="border-border bg-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-foreground text-lg flex items-center gap-2">
                <QrCode className="size-5 text-primary" />
                Device Pairing & QR Code
              </CardTitle>
              <CardDescription className="text-muted-foreground mt-0.5">
                Scan the QR code with WhatsApp on your phone or use an 8-digit pairing code.
              </CardDescription>
            </div>
            {isConnected && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnect}
                disabled={actionLoading}
                className="border-red-800/60 text-red-400 hover:bg-red-950/30 hover:text-red-300"
              >
                <LogOut className="size-4 mr-1.5" />
                Unlink Device
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* CONNECTED VIEW */}
          {isConnected ? (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="size-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="size-8 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">
                    Device Successfully Linked
                  </h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Phone: <span className="text-emerald-400 font-mono font-medium">{session.phoneNumber}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Multi-Device session active. You can send and receive WhatsApp messages right from the CRM Inbox.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchSession}
                  disabled={actionLoading}
                  className="border-border text-foreground hover:bg-muted"
                >
                  <RefreshCw className="size-3.5 mr-1.5" />
                  Check Status
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDisconnect}
                  disabled={actionLoading}
                >
                  <LogOut className="size-3.5 mr-1.5" />
                  Disconnect
                </Button>
              </div>
            </div>
          ) : (
            /* DISCONNECTED / PAIRING VIEW */
            <div className="grid gap-8 lg:grid-cols-2 items-center">
              {/* QR Code display area */}
              <div className="flex flex-col items-center justify-center p-6 rounded-2xl border border-border bg-muted/40 min-h-[340px]">
                {isQrReady ? (
                  <div className="flex flex-col items-center space-y-4">
                    <div className="relative p-3 bg-white rounded-2xl shadow-xl border border-gray-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={session.qrCode!}
                        alt="WhatsApp QR Code"
                        className="size-60 rounded-lg object-contain"
                      />
                      <div className="absolute inset-0 rounded-2xl border-2 border-primary/20 pointer-events-none" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleStartQr}
                        disabled={actionLoading}
                        className="text-xs border-border"
                      >
                        <RefreshCw className={`size-3.5 mr-1.5 ${actionLoading ? 'animate-spin' : ''}`} />
                        Refresh QR Code
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-emerald-400 animate-ping" />
                      Waiting for WhatsApp scan...
                    </p>
                  </div>
                ) : isConnecting ? (
                  <div className="flex flex-col items-center justify-center space-y-3 py-12">
                    <Loader2 className="size-10 animate-spin text-primary" />
                    <p className="text-sm font-medium text-foreground">
                      Initializing WhatsApp socket...
                    </p>
                    <p className="text-xs text-muted-foreground text-center max-w-xs">
                      Generating secure multi-device cryptographic keys and pairing QR code.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center space-y-4 py-8 text-center">
                    <div className="size-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                      <QrCode className="size-8 text-primary" />
                    </div>
                    <div>
                      <h4 className="text-base font-semibold text-foreground">
                        Ready to Connect
                      </h4>
                      <p className="text-xs text-muted-foreground max-w-xs mt-1">
                        Click below to generate a new QR code and link your WhatsApp in seconds.
                      </p>
                    </div>
                    <Button
                      onClick={handleStartQr}
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
                )}
              </div>

              {/* Instructions & Phone Pairing Option */}
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                    <Smartphone className="size-4 text-primary" />
                    How to Link your Phone
                  </h4>
                  <ol className="space-y-3 text-sm text-foreground/90">
                    <li className="flex items-start gap-2.5">
                      <span className="flex size-5 rounded-full bg-primary/20 text-primary font-bold text-xs items-center justify-center shrink-0 mt-0.5">
                        1
                      </span>
                      <span>Open <strong>WhatsApp</strong> on your mobile phone.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="flex size-5 rounded-full bg-primary/20 text-primary font-bold text-xs items-center justify-center shrink-0 mt-0.5">
                        2
                      </span>
                      <span>
                        Tap <strong>Menu</strong> (Android: ⋮ top right) or <strong>Settings</strong> (iPhone: ⚙️ bottom right).
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="flex size-5 rounded-full bg-primary/20 text-primary font-bold text-xs items-center justify-center shrink-0 mt-0.5">
                        3
                      </span>
                      <span>Tap <strong>Linked Devices</strong>, then tap <strong>Link a Device</strong>.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="flex size-5 rounded-full bg-primary/20 text-primary font-bold text-xs items-center justify-center shrink-0 mt-0.5">
                        4
                      </span>
                      <span>Point your phone at this screen to capture the QR code!</span>
                    </li>
                  </ol>
                </div>

                {/* Pairing Code alternative */}
                <div className="pt-4 border-t border-border">
                  {!showPairCodeInput ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowPairCodeInput(true)}
                      className="text-xs text-primary hover:text-primary/90 p-0 h-auto"
                    >
                      <KeyRound className="size-3.5 mr-1" />
                      Link with phone number instead (Pairing Code)
                    </Button>
                  ) : (
                    <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-medium text-foreground">
                          Enter Mobile Number with Country Code
                        </Label>
                        <button
                          type="button"
                          onClick={() => setShowPairCodeInput(false)}
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          Cancel
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <Input
                          placeholder="+91 80010 80776"
                          value={pairPhone}
                          onChange={(e) => setPairPhone(e.target.value)}
                          className="text-sm bg-muted border-border font-mono"
                        />
                        <Button
                          size="sm"
                          onClick={handleRequestPairCode}
                          disabled={actionLoading}
                          className="shrink-0"
                        >
                          {actionLoading ? <Loader2 className="size-3.5 animate-spin" /> : 'Get Code'}
                        </Button>
                      </div>

                      {session.pairingCode && (
                        <div className="mt-3 p-3 rounded-md bg-primary/10 border border-primary/20 text-center">
                          <p className="text-xs text-muted-foreground mb-1">Your 8-Digit Pairing Code:</p>
                          <p className="text-2xl font-mono font-bold tracking-widest text-primary">
                            {session.pairingCode}
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-1">
                            Enter this code on your phone when prompted by WhatsApp.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Advantage Notice */}
                <div className="rounded-lg border border-border bg-card/60 p-3 text-xs text-muted-foreground space-y-1">
                  <div className="flex items-center gap-1.5 text-foreground font-medium">
                    <Sparkles className="size-3.5 text-primary" />
                    Why use Linked Devices?
                  </div>
                  <p>
                    • No Meta Business verification or credit card required.
                  </p>
                  <p>
                    • Reply to customer inquiries at any time without the 24-hour window restriction.
                  </p>
                  <p>
                    • Works seamlessly alongside your phone app.
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
