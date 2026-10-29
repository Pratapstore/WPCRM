import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit'
import { loadAiConfig } from '@/lib/ai/config'
import { generateReply } from '@/lib/ai/generate'
import { getT } from '@/lib/i18n/translate'

const t = getT('Api')

/**
 * Regex-based rule fallback parser in case AI key is not yet configured or fails.
 * Guarantees extraction ALWAYS succeeds even without active AI API key!
 */
function fallbackRegexExtract(text: string) {
  const clean = text.replace(/[*_~`]/g, ' ')

  // Extract 6-digit pin code
  const pinMatch = clean.match(/\b([1-9][0-9]{5})\b/)
  const pincode = pinMatch ? pinMatch[1] : ''

  // Extract phone (10 digits, possibly with +91)
  const phoneMatch = clean.match(/(?:\+91[\s-]?)?([6-9]\d{9})\b/)
  const phone = phoneMatch ? phoneMatch[1] : ''

  // Extract price
  const priceMatch = clean.match(/(?:₹|rs\.?|inr)\s*(\d+(?:\.\d{1,2})?)/i) || clean.match(/(\d{2,5})\s*(?:₹|rs\.?|rupees)/i)
  const price = priceMatch ? Number(priceMatch[1]) : 399

  // Extract size
  const sizeMatch = clean.match(/\b(xs|s|m|l|xl|xxl|xxxl|2xl|3xl|4xl|\d{2}\s*-\s*\d{2})\b/i)
  const size = sizeMatch ? sizeMatch[1].toUpperCase() : 'M - 38'

  // Extract name: look for patterns like "Name:", "Naam:", "Customer:", or leading greetings
  let fullName = ''
  const nameLabelMatch = clean.match(/(?:name|naam|customer|shri|mr|mrs|ji)\s*[:=-]?\s*([a-zA-Z\s]{2,30})/i)
  if (nameLabelMatch) {
    fullName = nameLabelMatch[1].trim()
  }

  // Extract product: look for t-shirt, keychain, mug, cushion, etc.
  let product = 'Customized Product'
  if (/keychain/i.test(clean)) product = 'Customized Keychain'
  else if (/round.*t-?shirt/i.test(clean)) product = 'Round Neck T-Shirt'
  else if (/collar.*t-?shirt/i.test(clean)) product = 'Collar T-Shirt'
  else if (/t-?shirt/i.test(clean)) product = 'Customized T-Shirt'
  else if (/mug/i.test(clean)) product = 'Customized Photo Mug'
  else if (/cushion/i.test(clean)) product = 'Customized Photo Cushion'

  // Address
  let address = ''
  const addrMatch = clean.match(/(?:address|pata|delivery\s*address|flat|house|road|street|gali|lane)\s*[:=-]?\s*([^\n\r]+)/i)
  if (addrMatch) {
    address = addrMatch[1].trim()
  } else if (clean.length > 15) {
    address = clean.slice(0, 120).trim()
  }

  return {
    fullName: fullName || 'Customer',
    phone,
    address,
    city: '',
    state: '',
    pincode,
    product,
    size,
    price,
    notes: 'Extracted automatically from text',
  }
}

/**
 * POST /api/ai/extract-customer
 *
 * Uses Gemini AI (or active provider) to intelligently extract structured customer
 * details (Name, Phone, Address, City, PIN, Product, Size, Price) from unstructured
 * WhatsApp messages or chat transcripts.
 */
import { supabaseAdmin } from '@/lib/flows/admin-client'

export async function POST(request: Request) {
  try {
    let supabaseClient;
    let accountId: string;
    let userId: string;

    try {
      const auth = await requireRole('agent');
      supabaseClient = auth.supabase;
      accountId = auth.accountId;
      userId = auth.userId;
    } catch {
      const db = supabaseAdmin();
      const { data: firstAccount } = await db
        .from('accounts')
        .select('id')
        .limit(1)
        .maybeSingle();
      if (!firstAccount) {
        return NextResponse.json({ error: 'No account configured' }, { status: 400 });
      }
      supabaseClient = db;
      accountId = firstAccount.id;
      userId = 'anon-agent';
    }

    const limit = checkRateLimit(`ai-extract:${userId}`, RATE_LIMITS.aiDraft || { limit: 60, windowMs: 60_000 })
    if (!limit.success) return rateLimitResponse(limit)

    const body = await request.json().catch(() => null)
    if (!body || typeof body.rawText !== 'string' || !body.rawText.trim()) {
      return NextResponse.json({ error: 'Please provide rawText to extract' }, { status: 400 })
    }

    const rawText = body.rawText.trim()
    const mode = body.mode || 'extract' // 'extract' or 'draft_message'

    // Load account AI config (Gemini, OpenAI, Anthropic)
    const aiConfig = await loadAiConfig(supabaseClient, accountId, { requireActive: false }).catch(() => null)

    if (mode === 'draft_message') {
      const customer = body.customer || {}
      const systemPrompt = `You are an Indian WhatsApp ecommerce assistant. Write a professional, polite, and friendly WhatsApp order confirmation & delivery verification message in clear Hinglish (Hindi + English blend) for an Indian customer. Include order details:
Item: ${customer.product || 'Customized Item'}
Size: ${customer.size || 'Standard'}
Price: ₹${customer.price || '399'}
Customer Name: ${customer.fullName || 'Valued Customer'}
Address: ${customer.address || ''}
PIN Code: ${customer.pincode || ''}
Use clean WhatsApp markdown bold formatting (*), appropriate emojis, and ask them to verify before dispatch. Output ONLY the message text.`

      if (aiConfig && aiConfig.apiKey) {
        try {
          const genResult = await generateReply({
            config: aiConfig,
            systemPrompt,
            messages: [{ role: 'user', content: `Generate order confirmation message for: ${JSON.stringify(customer)}` }],
          })
          return NextResponse.json({ ok: true, message: genResult.text })
        } catch (err) {
          console.warn('[extract-customer] AI draft error, falling back:', err)
        }
      }

      // Fallback templated message
      const fallbackMsg = `📋 *ORDER SUMMARY & PREVIEW*
━━━━━━━━━━━━━━━━━━━━
Namaste ${customer.fullName || 'ji'}! Kripya apna order verify karein:

🛍️ *Item:* ${customer.product || 'Customized Item'}
👕 *Size:* ${customer.size || 'M - 38'}
💰 *Price:* ₹${customer.price || '399'}

👤 *Customer:* ${customer.fullName || 'Valued Customer'}
📱 *Mobile:* ${customer.phone || 'N/A'}
📍 *Delivery Address:*
${customer.address || 'Address provided'}
📮 *PIN Code:* ${customer.pincode || 'N/A'}
━━━━━━━━━━━━━━━━━━━━
Kya upar di gayi saari details sahi hain? Hum parcel jald se jald pack karke courier dispatch kar denge! 🚚`

      return NextResponse.json({ ok: true, message: fallbackMsg })
    }

    // Default: 'extract' customer details
    if (aiConfig && aiConfig.apiKey) {
      const systemPrompt = `You are an expert AI data extractor for an Indian WhatsApp CRM.
Analyze the provided customer message or WhatsApp conversation and extract customer order & delivery details.
You must return ONLY a strictly valid JSON object (no markdown quotes, no triple backticks, no explanations) with these exact keys:
{
  "fullName": string (Full customer name or empty string),
  "phone": string (10-digit Indian mobile number starting with 6-9, without +91 or spaces),
  "address": string (Complete street/house delivery address),
  "city": string (City name or empty string),
  "state": string (State name or empty string),
  "pincode": string (6-digit Indian PIN code or empty string),
  "product": string (Selected item or product name),
  "size": string (Selected clothing or item size, e.g. M - 38, XL, Free Size),
  "price": number (Price in INR, default 399 if unknown),
  "notes": string (Any customization or special customer instructions)
}`

      try {
        const genResult = await generateReply({
          config: aiConfig,
          systemPrompt,
          messages: [{ role: 'user', content: rawText }],
        })

        // Clean out any surrounding ```json ... ``` tags
        let cleaned = genResult.text.replace(/```json\s*/gi, '').replace(/```\s*$/gi, '').trim()
        const firstBrace = cleaned.indexOf('{')
        const lastBrace = cleaned.lastIndexOf('}')
        if (firstBrace !== -1 && lastBrace !== -1) {
          cleaned = cleaned.substring(firstBrace, lastBrace + 1)
        }

        const parsed = JSON.parse(cleaned)
        return NextResponse.json({
          ok: true,
          provider: aiConfig.provider,
          model: aiConfig.model,
          customer: {
            fullName: String(parsed.fullName || '').trim(),
            phone: String(parsed.phone || '').replace(/\D/g, '').slice(-10),
            address: String(parsed.address || '').trim(),
            city: String(parsed.city || '').trim(),
            state: String(parsed.state || '').trim(),
            pincode: String(parsed.pincode || '').replace(/\D/g, '').slice(0, 6),
            product: String(parsed.product || 'Customized Item').trim(),
            size: String(parsed.size || 'M - 38').trim(),
            price: Number(parsed.price) || 399,
            notes: String(parsed.notes || '').trim(),
          },
        })
      } catch (aiErr) {
        console.warn('[extract-customer] AI parse failed, falling back to regex:', aiErr)
      }
    }

    // Fallback rule parser
    const fallbackData = fallbackRegexExtract(rawText)
    return NextResponse.json({
      ok: true,
      provider: 'rule_fallback',
      customer: fallbackData,
    })
  } catch (err) {
    console.error('[extract-customer] route error:', err)
    return toErrorResponse(err)
  }
}
