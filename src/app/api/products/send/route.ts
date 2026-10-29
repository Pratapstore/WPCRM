import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { supabaseAdmin } from '@/lib/flows/admin-client';
import {
  sendMessageToConversation,
  SendMessageError,
} from '@/lib/whatsapp/send-message';
import {
  formatProductWhatsAppMessage,
  formatMultiProductWhatsAppMessage,
} from '@/lib/products/format-product-message';
import type { Product } from '@/types/orders';

function sanitizePhoneNumber(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (!digits) return '';
  // If Indian 10-digit number without country code, prepend 91
  if (digits.length === 10) {
    return `91${digits}`;
  }
  // If starts with 0 and has 11 digits (e.g. 09876543210), replace leading 0 with 91
  if (digits.length === 11 && digits.startsWith('0')) {
    return `91${digits.slice(1)}`;
  }
  return digits;
}

function normalizeWhatsAppImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  // ImageKit.io GIF to JPG auto-conversion for WhatsApp Cloud API & Baileys compatibility
  if (
    trimmed.includes('imagekit.io') &&
    (trimmed.toLowerCase().includes('.gif') || trimmed.toLowerCase().includes('format=gif'))
  ) {
    if (trimmed.includes('tr=') || trimmed.includes('/tr:')) {
      return trimmed;
    }
    const separator = trimmed.includes('?') ? '&' : '?';
    return `${trimmed}${separator}tr=f-jpg`;
  }

  return trimmed;
}

export async function POST(request: Request) {
  try {
    const { supabase, accountId, userId } = await requireRole('agent');
    const body = await request.json();

    const {
      productId,
      productIds,
      sendMode = 'combined',
      phone,
      contactId: contactIdInput,
      conversationId: conversationIdInput,
      customerName,
      headlineStyle = 'deal_alert',
      customHeadline,
      customNote,
      includeButtons = true,
      storeDomain = 'www.pratapstore.in',
      customMessage,
      buttons,
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

    if (!phone && !contactIdInput && !conversationIdInput) {
      return NextResponse.json(
        { error: 'Please provide a recipient (Phone number, Contact, or Conversation)' },
        { status: 400 }
      );
    }

    // 1. Load the product(s)
    const { data: productRows, error: productErr } = await supabase
      .from('products')
      .select('*')
      .in('id', targetProductIds)
      .eq('account_id', accountId);

    if (productErr || !productRows || productRows.length === 0) {
      return NextResponse.json(
        { error: 'Selected product(s) not found in your catalog' },
        { status: 404 }
      );
    }

    // Preserve the user's selected order
    const orderedProducts: Product[] = targetProductIds
      .map((id) => productRows.find((p) => p.id === id))
      .filter(Boolean) as Product[];

    const product = orderedProducts[0];
    const isMultiProduct = orderedProducts.length > 1;

    // 2. Format the message in Amazon E-Commerce style or use seller's edited custom message
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

    // 3. Resolve conversation and contact
    let conversationId = conversationIdInput;
    let contactId = contactIdInput;
    let targetPhone = phone ? sanitizePhoneNumber(phone) : '';

    if (conversationId) {
      const { data: conv } = await supabase
        .from('conversations')
        .select('id, contact_id, contact:contacts(phone, name)')
        .eq('id', conversationId)
        .eq('account_id', accountId)
        .maybeSingle();

      if (!conv) {
        return NextResponse.json(
          { error: 'Target conversation not found' },
          { status: 404 }
        );
      }
      contactId = conv.contact_id;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const convContact = (conv as any).contact;
      if (convContact?.phone && !targetPhone) {
        targetPhone = sanitizePhoneNumber(convContact.phone);
      }
    } else if (contactId) {
      const { data: contact } = await supabase
        .from('contacts')
        .select('id, phone, name')
        .eq('id', contactId)
        .eq('account_id', accountId)
        .maybeSingle();

      if (!contact) {
        return NextResponse.json(
          { error: 'Contact not found' },
          { status: 404 }
        );
      }
      if (contact.phone && !targetPhone) {
        targetPhone = sanitizePhoneNumber(contact.phone);
      }
    } else if (targetPhone) {
      // Find contact by sanitized phone or create a new contact
      const { data: existingContact } = await supabase
        .from('contacts')
        .select('id, name, phone')
        .eq('account_id', accountId)
        .eq('phone', targetPhone)
        .maybeSingle();

      if (existingContact) {
        contactId = existingContact.id;
      } else {
        const { data: newContact, error: createContactErr } = await supabase
          .from('contacts')
          .insert({
            account_id: accountId,
            name: customerName?.trim() || `Customer ${targetPhone.slice(-4)}`,
            phone: targetPhone,
          })
          .select('id')
          .single();

        if (createContactErr || !newContact) {
          return NextResponse.json(
            { error: 'Failed to create contact for this phone number' },
            { status: 500 }
          );
        }
        contactId = newContact.id;
      }
    }

    // Ensure conversation exists for contact
    if (!conversationId && contactId) {
      const { data: existingConv } = await supabase
        .from('conversations')
        .select('id')
        .eq('account_id', accountId)
        .eq('contact_id', contactId)
        .maybeSingle();

      if (existingConv) {
        conversationId = existingConv.id;
      } else {
        const { data: newConv, error: createConvErr } = await supabase
          .from('conversations')
          .insert({
            account_id: accountId,
            user_id: userId,
            contact_id: contactId,
          })
          .select('id')
          .single();

        if (createConvErr || !newConv) {
          return NextResponse.json(
            { error: 'Failed to open conversation thread' },
            { status: 500 }
          );
        }
        conversationId = newConv.id;
      }
    }

    // Construct direct WhatsApp Web / App URL for instant fallback or manual sharing
    const encodedText = encodeURIComponent(
      product.image_url
        ? `${formattedCaption}\n\n📸 Product Image: ${product.image_url}`
        : formattedCaption
    );
    const waMeUrl = targetPhone
      ? `https://api.whatsapp.com/send?phone=${targetPhone}&text=${encodedText}`
      : `https://api.whatsapp.com/send?text=${encodedText}`;

    // 4. Send via WhatsApp CRM engine
    try {
      const normalizedImageUrl = normalizeWhatsAppImageUrl(product.image_url);
      const isUnsupportedGif =
        normalizedImageUrl &&
        !normalizedImageUrl.includes('tr=f-') &&
        !normalizedImageUrl.includes('/tr:') &&
        normalizedImageUrl.toLowerCase().includes('.gif');

      // Meta limits interactive body to 1024 characters
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

      // Primary message type:
      // When buttons are requested, use 'interactive' (with image header if image exists).
      // Otherwise use 'image' (if image exists) or 'text'.
      const messageType = includeButtons
        ? 'interactive'
        : normalizedImageUrl && !isUnsupportedGif
          ? 'image'
          : 'text';

      let result;
      try {
        result = await sendMessageToConversation(supabase, accountId, {
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
      } catch (primarySendErr) {
        console.warn(
          `[api/products/send] Primary send (${messageType}) failed, trying fallback:`,
          primarySendErr
        );
        // Fallback cascade:
        // 1. If interactive failed, try standard image message (if image is available)
        // 2. If image message failed or no image, try text message
        if (messageType === 'interactive' && normalizedImageUrl && !isUnsupportedGif) {
          try {
            result = await sendMessageToConversation(supabase, accountId, {
              conversationId,
              messageType: 'image',
              contentText: formattedCaption,
              mediaUrl: normalizedImageUrl,
              senderId: userId,
            });
          } catch (imageFallbackErr) {
            console.warn('[api/products/send] Image fallback failed, trying text:', imageFallbackErr);
            const fallbackText = product.image_url
              ? `${formattedCaption}\n\n📸 Product Photo: ${product.image_url}`
              : formattedCaption;
            result = await sendMessageToConversation(supabase, accountId, {
              conversationId,
              messageType: 'text',
              contentText: fallbackText,
              senderId: userId,
            });
          }
        } else if (messageType !== 'text') {
          const fallbackText = product.image_url
            ? `${formattedCaption}\n\n📸 Product Photo: ${product.image_url}`
            : formattedCaption;
          result = await sendMessageToConversation(supabase, accountId, {
            conversationId,
            messageType: 'text',
            contentText: fallbackText,
            senderId: userId,
          });
        } else {
          throw primarySendErr;
        }
      }

      // Check if conversation 24-hour customer window has expired
      let isWindowExpired = false;
      if (conversationId) {
        const { data: lastCustomerMsg } = await supabase
          .from('messages')
          .select('created_at')
          .eq('conversation_id', conversationId)
          .eq('sender_type', 'customer')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!lastCustomerMsg) {
          isWindowExpired = true;
        } else {
          const diffHours =
            (Date.now() - new Date(lastCustomerMsg.created_at).getTime()) / (1000 * 60 * 60);
          if (diffHours >= 24) {
            isWindowExpired = true;
          }
        }
      }

      return NextResponse.json({
        success: true,
        messageId: result.messageId,
        whatsappMessageId: result.whatsappMessageId,
        conversationId,
        contactId,
        targetPhone,
        waMeUrl,
        sessionExpired: isWindowExpired,
        formattedMessage: formattedCaption,
      });
    } catch (sendErr) {
      console.warn('[api/products/send] WhatsApp live send error:', sendErr);
      const errMsg = sendErr instanceof Error ? sendErr.message : 'Send failed';
      const is24hErr =
        errMsg.includes('24 hours') ||
        errMsg.includes('131047') ||
        errMsg.toLowerCase().includes('re-engagement');

      // If WhatsApp is offline or session expired or not configured, return waMeUrl so user can still send
      return NextResponse.json(
        {
          success: false,
          offline: !is24hErr,
          sessionExpired: is24hErr,
          error: is24hErr
            ? 'Customer 24-hour window is closed. Click to send directly via WhatsApp Web without restrictions.'
            : errMsg,
          waMeUrl,
          formattedMessage: formattedCaption,
          conversationId,
          contactId,
        },
        { status: 200 }
      );
    }
  } catch (error) {
    console.error('[api/products/send] Unexpected error:', error);
    return toErrorResponse(error);
  }
}
