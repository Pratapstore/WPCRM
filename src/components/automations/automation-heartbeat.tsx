"use client";

import { useEffect } from "react";

/**
 * AutomationHeartbeat — headless component mounted in DashboardShell.
 * Periodically calls the automations and flows cron endpoints (every 20s)
 * so that any pending wait steps and flows drain reliably whenever the
 * dashboard is open in any browser tab.
 */
export function AutomationHeartbeat() {
  useEffect(() => {
    const drain = async () => {
      try {
        await Promise.allSettled([
          fetch("/api/automations/cron", { method: "GET", cache: "no-store" }),
          fetch("/api/flows/cron", { method: "GET", cache: "no-store" }),
        ]);
      } catch {
        // Silent fail — background non-critical
      }
    };

    // Run once on initial load after 3 seconds
    const initialTimer = setTimeout(drain, 3_000);
    // Then run every 20 seconds
    const interval = setInterval(drain, 20_000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, []);

  return null;
}

