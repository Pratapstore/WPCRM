import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import {
  expireAwaitingReplies,
  requeueStalledExecutions,
  drainDuePendingExecutions,
} from '@/lib/automations/engine'

export const maxDuration = 60

/**
 * Drain due `automation_pending_executions` rows. Meant to be hit
 * on a schedule (Vercel Cron / external pinger) or internally via dashboard heartbeat.
 */
function isAuthorized(request: Request): boolean {
  // Allow Vercel Cron automatically
  if (request.headers.get('x-vercel-cron') === '1') {
    return true
  }

  const expectedSecret =
    process.env.AUTOMATION_CRON_SECRET || process.env.CRON_SECRET

  // If secret is configured in env, enforce it
  if (expectedSecret) {
    const suppliedSecret = request.headers.get('x-cron-secret')
    if (suppliedSecret) {
      const sBuf = Buffer.from(suppliedSecret)
      const eBuf = Buffer.from(expectedSecret)
      if (sBuf.length === eBuf.length && timingSafeEqual(sBuf, eBuf)) return true
    }

    const authHeader = request.headers.get('authorization')
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim()
      const tBuf = Buffer.from(token)
      const eBuf = Buffer.from(expectedSecret)
      if (tBuf.length === eBuf.length && timingSafeEqual(tBuf, eBuf)) return true
    }

    return false
  }

  // Without secret configured, allow execution (e.g. internal dashboard heartbeat, dev, or free pinger)
  return true
}

/**
 * Drain due `automation_pending_executions` rows.
 * Hit on a schedule (Vercel Cron / external pinger) or internally.
 */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Close out wait_for_reply runs whose 24h reply window lapsed.
  const expired = await expireAwaitingReplies()
  const requeued = await requeueStalledExecutions()
  const processed = await drainDuePendingExecutions(50)

  return NextResponse.json({ processed, expired, requeued })
}
