import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import {
  sendMessageToConversation,
} from '@/lib/whatsapp/send-message';
import {
  formatProductWhatsAppMessage,
  formatMultiProductWhatsAppMessage,
} from '@/lib/products/format-product-message';
import type { Product } from '@/types/orders';

function sanitizePhoneNumber(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
  return digits;
}

function normalizeWhatsAppImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  if (
    trimmed.includes('imagekit.io') &&
    (trimmed.toLowerCase().includes('.gif') || trimmed.toLowerCase().includes('format=gif'))
  ) {
    if (trimmed.includes('tr=') || trimmed.includes('/tr:')) return trimmed;
    const separator = trimmed.includes('?') ? '&' : '?';
    return `${trimmed}${separator}tr=f-jpg`;
  }

  return trimmed;
}

export interface BulkRecipientItem {
  phone: string;
  name?: string;
  contactId?: string;
}

export async function POST(request: Request) {
  try {
    const { supabase, accountId, userId } = await requireRole('agent');
    const body = await request.json();

    const {
      productId,
      productIds,
      recipients = [],
      customMessage,
      headlineStyle = 'special_offer',
      customHeadline,
      customNote,
      includeButtons = true,
      buttons,
      storeDomain = 'www.pratapstore.in',
    } = body;

    const targetProductIds: string[] =
      Array.isArray(productIds) && productIds.length > 0
        ? productIds.map(String)
        : productId
        ? [String(productId)]
        : [];

    if (targetProductIds.length === 0) {
      return NextResponse.json(
        { error: 'Product ID or productIds array is required' },
        { status: 400 }
      );
    }

    if (!Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json({ error: 'No recipients provided' }, { status: 400 });
    }

    // Limit single batch to 50 recipients to prevent function timeouts and allow smooth progress reporting
    const batch = recipients.slice(0, 50);

    // 1. Load product(s)
    const { data: productRows, error: productErr } = await supabase
      .from('products')
      .select('*')
      .in('id', targetProductIds)
      .eq('account_id', accountId);

    if (productErr || !productRows || productRows.length === 0) {
      return NextResponse.json({ error: 'Selected product(s) not found in catalog' }, { status: 404 });
    }

    const orderedProducts: Product[] = targetProductIds
      .map((id) => productRows.find((p) => p.id === id))
      .filter(Boolean) as Product[];

    const product = orderedProducts[0];
    const isMultiProduct = orderedProducts.length > 1;

    // 2. Format message
    const formattedCaption =
      typeof customMessage === 'string' && customMessage.trim().length > 0
        ? customMessage.trim()
        : isMultiProduct
        ? formatMultiProductWhatsAppMessage(orderedProducts, {
            headlineStyle,
            customHeadline,
            customNote,
            storeDomain,
            storeName: 'Pratap Store',
            includePerks: true,
            includeDiscount: true,
          })
        : formatProductWhatsAppMessage(product, {
            headlineStyle,
            customHeadline,
            customNote,
            storeDomain,
            storeName: 'Pratap Store',
            includePerks: true,
            includeDiscount: true,
          });

    const normalizedImageUrl = normalizeWhatsAppImageUrl(product.image_url);
    const isUnsupportedGif =
      normalizedImageUrl &&
      !normalizedImageUrl.includes('tr=f-') &&
      !normalizedImageUrl.includes('/tr:') &&
      normalizedImageUrl.toLowerCase().includes('.gif');

    const interactiveBody =
      formattedCaption.length > 1020
        ? `${formattedCaption.slice(0, 1017)}...`
        : formattedCaption;

    const defaultButtons = isMultiProduct
      ? [
          { id: 'order_selected_items', title: '🛍️ Order Items' },
          { id: 'catalog_all', title: '📋 All Products' },
          { id: 'chat_support', title: '💬 Chat with Us' },
        ]
      : [
          { id: `order_${product.id}`, title: '🛍️ Order Now' },
          { id: 'catalog_all', title: '📋 All Products' },
          { id: 'chat_support', title: '💬 Chat with Us' },
        ];

    let interactiveButtons = defaultButtons;
    if (Array.isArray(buttons) && buttons.length > 0) {
      const sanitized = buttons
        .slice(0, 3)
        .map((b: { id?: string; title?: string }, idx: number) => ({
          id: (b && b.id && String(b.id).trim()) || `btn_${idx + 1}_${product.id.slice(0, 8)}`,
          title: (b && b.title && String(b.title).trim().slice(0, 20)) || '',
        }))
        .filter((b) => b.title.length > 0);
      if (sanitized.length > 0) {
        interactiveButtons = sanitized;
      }
    }

    const messageType = includeButtons
      ? 'interactive'
      : normalizedImageUrl && !isUnsupportedGif
        ? 'image'
        : 'text';

    // 3. Dispatch to batch recipients
    const results: Array<{ phone: string; name?: string; status: 'sent' | 'failed'; error?: string; messageId?: string }> = [];

    for (const item of batch) {
      const rawPhone = item.phone || '';
      const cleanPhone = sanitizePhoneNumber(rawPhone);
      if (!cleanPhone) {
        results.push({ phone: rawPhone, name: item.name, status: 'failed', error: 'Invalid phone number' });
        continue;
      }

      try {
        let contactId = item.contactId;
        let conversationId: string | undefined;

        // Resolve or create contact
        if (!contactId) {
          const { data: existingContact } = await supabase
            .from('contacts')
            .select('id')
            .eq('account_id', accountId)
            .eq('phone', cleanPhone)
            .maybeSingle();

          if (existingContact) {
            contactId = existingContact.id;
          } else {
            const { data: newContact } = await supabase
              .from('contacts')
              .insert({
                account_id: accountId,
                name: item.name?.trim() || `Customer ${cleanPhone.slice(-4)}`,
                phone: cleanPhone,
              })
              .select('id')
              .single();

            if (newContact) contactId = newContact.id;
          }
        }

        // Resolve or create conversation
        if (contactId) {
          const { data: existingConv } = await supabase
            .from('conversations')
            .select('id')
            .eq('account_id', accountId)
            .eq('contact_id', contactId)
            .maybeSingle();

          if (existingConv) {
            conversationId = existingConv.id;
          } else {
            const { data: newConv } = await supabase
              .from('conversations')
              .insert({
                account_id: accountId,
                user_id: userId,
                contact_id: contactId,
              })
              .select('id')
              .single();

            if (newConv) conversationId = newConv.id;
          }
        }

        if (!conversationId) {
          results.push({ phone: cleanPhone, name: item.name, status: 'failed', error: 'Failed to create conversation' });
          continue;
        }

        // Send via WhatsApp CRM engine with fallback cascade
        let sendRes;
        try {
          sendRes = await sendMessageToConversation(supabase, accountId, {
            conversationId,
            messageType,
            contentText: formattedCaption,
            mediaUrl: normalizedImageUrl || undefined,
            senderId: userId,
            interactivePayload: includeButtons
              ? {
                  kind: 'buttons',
                  body: interactiveBody,
                  footer: 'Pratap Store • Fast Pan-India Delivery',
                  buttons: interactiveButtons,
                }
              : undefined,
          });
        } catch {
          // Fallback cascade to standard image or text if interactive failed
          if (messageType === 'interactive' && normalizedImageUrl && !isUnsupportedGif) {
            try {
              sendRes = await sendMessageToConversation(supabase, accountId, {
                conversationId,
                messageType: 'image',
                contentText: formattedCaption,
                mediaUrl: normalizedImageUrl,
                senderId: userId,
              });
            } catch {
              const fallbackText = product.image_url
                ? `${formattedCaption}\n\n📸 Product Photo: ${product.image_url}`
                : formattedCaption;
              sendRes = await sendMessageToConversation(supabase, accountId, {
                conversationId,
                messageType: 'text',
                contentText: fallbackText,
                senderId: userId,
              });
            }
          } else {
            const fallbackText = product.image_url
              ? `${formattedCaption}\n\n📸 Product Photo: ${product.image_url}`
              : formattedCaption;
            sendRes = await sendMessageToConversation(supabase, accountId, {
              conversationId,
              messageType: 'text',
              contentText: fallbackText,
              senderId: userId,
            });
          }
        }

        results.push({
          phone: cleanPhone,
          name: item.name,
          status: 'sent',
          messageId: sendRes?.messageId,
        });
      } catch (err) {
        results.push({
          phone: cleanPhone,
          name: item.name,
          status: 'failed',
          error: err instanceof Error ? err.message : 'Send failed',
        });
      }
    }

    const successfulCount = results.filter((r) => r.status === 'sent').length;
    const failedCount = results.filter((r) => r.status === 'failed').length;

    return NextResponse.json({
      success: true,
      processed: results.length,
      successful: successfulCount,
      failed: failedCount,
      results,
    });
  } catch (error) {
    console.error('[api/products/send-bulk] Unexpected error:', error);
    return toErrorResponse(error);
  }
}
