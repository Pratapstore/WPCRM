import { supabaseAdmin } from '@/lib/flows/admin-client';
import { sendMessageToConversation } from '@/lib/whatsapp/send-message';
import { createRazorpayPaymentLink, checkRazorpayPaymentLinkStatus } from '@/lib/payments/razorpay';
import { sendOrderNotification } from '@/lib/orders/whatsapp-notifications';
import type { Product, OrderItem, ShippingAddress, Order } from '@/types/orders';

interface ProcessInboundCommerceArgs {
  accountId: string;
  contactId: string;
  conversationId: string;
  messageText: string;
  interactiveReplyId?: string | null;
  interactiveReplyTitle?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
}

export interface CommerceBotResult {
  handled: boolean;
  replySent: boolean;
  orderCreated?: Order;
}

export type ProductActionKind = 'order' | 'all_products' | 'chat_support';

export function isProductAction(
  replyId?: string | null,
  replyTitle?: string | null,
  text?: string | null
): ProductActionKind | null {
  const id = (replyId || '').toLowerCase().trim();
  const title = (replyTitle || '').toLowerCase().trim();
  const t = (text || '').toLowerCase().trim();

  // 1. Order Now
  if (
    id.startsWith('order_') ||
    id.startsWith('action_order_') ||
    id.startsWith('prod_') ||
    title.includes('order now') ||
    title.includes('buy now') ||
    t === 'order now' ||
    t === 'buy now'
  ) {
    return 'order';
  }

  // 2. All Products Catalog
  if (
    id === 'catalog_all' ||
    id === 'action_all_products' ||
    id === 'all_products' ||
    title.includes('all products') ||
    title.includes('view products') ||
    t === 'all products' ||
    t === 'all product' ||
    t === 'catalog' ||
    t === 'catalogue'
  ) {
    return 'all_products';
  }

  // 3. Chat with Us / Human Support
  if (
    id === 'chat_support' ||
    id === 'action_chat_support' ||
    id === 'support' ||
    id === 'help' ||
    title.includes('chat with us') ||
    title.includes('talk to support') ||
    title.includes('ask pratap store') ||
    t === 'chat with us' ||
    t === 'support' ||
    t === 'help'
  ) {
    return 'chat_support';
  }

  return null;
}

const COMMERCE_TRIGGERS = [
  'order',
  'buy',
  'menu',
  'catalog',
  'catalogue',
  'price',
  'shop',
  'products',
  'product',
  'keychain',
  'mug',
  'tshirt',
  't-shirt',
  'cushion',
  'lamp',
  'frame',
  'kharidna',
  'samagri',
  'start',
  'store',
  'items',
];

function generateOrderNumber(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `ORD-${dateStr}-${rand}`;
}

/**
 * Automated WhatsApp Commerce Bot Engine (like AiSensy / JioMart).
 * Handles:
 * 1. Self-service customer catalog browsing with images, prices, descriptions
 * 2. Instant direct product identification (e.g. typing "mug", "keychain", "1")
 * 3. Quantity selection (1, 2, 3 or custom typed number)
 * 4. Step-by-step complete delivery address collection
 * 5. Crystal-clear choice between PREPAID (Razorpay UPI/Cards) and CASH ON DELIVERY (COD)
 * 6. Automated Razorpay payment link generation & instant confirmation receipt
 */
export async function processCommerceInboundMessage(
  args: ProcessInboundCommerceArgs
): Promise<CommerceBotResult> {
  const {
    accountId,
    contactId,
    conversationId,
    messageText,
    interactiveReplyId,
    interactiveReplyTitle,
    customerName,
    customerPhone,
  } = args;

  const db = supabaseAdmin();
  const trimmedText = (messageText || '').trim();
  const lowerText = trimmedText.toLowerCase();

  // 1. Get or create order session for this contact
  const { data: session } = await db
    .from('order_sessions')
    .select('*')
    .eq('account_id', accountId)
    .eq('contact_id', contactId)
    .maybeSingle();

  const currentState = session?.state || 'IDLE';

  // 2. Fetch active catalog products
  const { data: rawProducts } = await db
    .from('products')
    .select('*')
    .eq('account_id', accountId)
    .eq('in_stock', true)
    .order('price', { ascending: true });

  const products: Product[] = (rawProducts as Product[]) || [];
  if (products.length === 0) {
    return { handled: false, replySent: false };
  }

  // -------------------------------------------------------------
  // Reset / Cancel Handler (can be called anytime)
  // -------------------------------------------------------------
  const isReset =
    lowerText === 'cancel' ||
    lowerText === 'restart' ||
    lowerText === 'reset' ||
    lowerText === 'radd' ||
    lowerText === 'stop';

  if (isReset) {
    await db.from('order_sessions').upsert({
      account_id: accountId,
      contact_id: contactId,
      conversation_id: conversationId,
      state: 'IDLE',
      selected_product: {},
      quantity: 1,
      shipping_address: null,
    });

    await sendMessageToConversation(db, accountId, {
      conversationId,
      messageType: 'text',
      contentText:
        '🔄 *Order session cancelled.*\n\nType *ORDER* or *MENU* anytime to view our products catalog and shop!',
    });
    return { handled: true, replySent: true };
  }

  // -------------------------------------------------------------
  // Dedicated Handler: Order Tracking / Status Query
  // -------------------------------------------------------------
  const isTrackingQuery =
    lowerText === 'track' ||
    lowerText === 'status' ||
    lowerText === 'tracking' ||
    lowerText.includes('order status') ||
    lowerText.includes('track order') ||
    lowerText.includes('kaha pahucha') ||
    Boolean(interactiveReplyId && interactiveReplyId.startsWith('order_status_'));

  if (isTrackingQuery) {
    const cleanPhone = (customerPhone || '').replace(/\D/g, '');
    let orderQuery = db
      .from('orders')
      .select('*')
      .eq('account_id', accountId)
      .neq('order_status', 'cancelled');

    if (cleanPhone.length >= 10) {
      const last10 = cleanPhone.slice(-10);
      orderQuery = orderQuery.or(`contact_id.eq.${contactId},customer_phone.ilike.%${last10}%`);
    } else {
      orderQuery = orderQuery.eq('contact_id', contactId);
    }

    const { data: matchedOrders } = await orderQuery
      .order('created_at', { ascending: false })
      .limit(1);

    if (matchedOrders && matchedOrders.length > 0) {
      const order = matchedOrders[0] as Order;
      const trackingMsg = order.tracking_number
        ? `🚚 *Order Tracking Update - #${order.order_number}*
━━━━━━━━━━━━━━━━━━━━
📦 *Status:* *${order.order_status.toUpperCase()}*
🚚 *Courier Partner:* ${order.tracking_carrier || 'Express Courier'}
🔢 *AWB / Tracking Number:* *${order.tracking_number}*
${order.tracking_url ? `🔗 *Track Live:* ${order.tracking_url}\n` : ''}📍 *Delivery City:* ${order.shipping_address?.city || ''}, ${order.shipping_address?.state || ''}
💰 *Payment:* *${order.payment_status.toUpperCase()}*

Reply here if you need any assistance with your order! 🙏`
        : `📦 *Order Status - #${order.order_number}*
━━━━━━━━━━━━━━━━━━━━
Status: *${order.order_status.toUpperCase()}*
Payment: *${order.payment_status.toUpperCase()}*
Items: ${order.items?.map((i) => `${i.name} x ${i.quantity}`).join(', ') || 'Custom Gifts'}

🎨 Hamari printing team aapke items prepare kar rahi hai. Parcel dispatch hote hi courier tracking number aapko WhatsApp par bhej diya jayega! ❤️`;

      await sendMessageToConversation(db, accountId, {
        conversationId,
        messageType: 'text',
        contentText: trackingMsg,
      });

      return { handled: true, replySent: true };
    }
  }

  // -------------------------------------------------------------
  // Dedicated Handler: Automatic Inbound Payment Detection & Capture
  // Reads customer messages (e.g. "paid", "payment done", UTR number, screenshots)
  // and automatically captures payment & sends official confirmation receipt.
  // -------------------------------------------------------------
  const isPaymentMention =
    lowerText === 'paid' ||
    lowerText === 'done' ||
    lowerText === 'completed' ||
    lowerText === 'success' ||
    lowerText.includes('payment done') ||
    lowerText.includes('done payment') ||
    lowerText.includes('payment complete') ||
    lowerText.includes('payment completed') ||
    lowerText.includes('ho gaya payment') ||
    lowerText.includes('payment ho gaya') ||
    lowerText.includes('maine payment kar diya') ||
    lowerText.includes('paise bhej diye') ||
    lowerText.includes('bhej diya') ||
    lowerText.includes('pay kar diya') ||
    /\b\d{12}\b/.test(trimmedText) ||
    /(?:utr|rrn|upi\s*ref|txn|transaction)\s*[:#-]?\s*([a-zA-Z0-9]{8,22})/i.test(trimmedText);

  if (isPaymentMention) {
    const cleanPhone = (customerPhone || '').replace(/\D/g, '');
    let orderQuery = db
      .from('orders')
      .select('*')
      .eq('account_id', accountId)
      .neq('order_status', 'cancelled');

    if (cleanPhone.length >= 10) {
      const last10 = cleanPhone.slice(-10);
      orderQuery = orderQuery.or(`contact_id.eq.${contactId},customer_phone.ilike.%${last10}%`);
    } else {
      orderQuery = orderQuery.eq('contact_id', contactId);
    }

    const { data: matchedOrders } = await orderQuery
      .order('created_at', { ascending: false })
      .limit(1);

    if (matchedOrders && matchedOrders.length > 0) {
      const order = matchedOrders[0] as Order;

      // Extract UTR if present
      const utrMatch =
        trimmedText.match(/\b\d{12}\b/)?.[0] ||
        trimmedText.match(/(?:utr|rrn|upi\s*ref|txn|transaction)\s*[:#-]?\s*([a-zA-Z0-9]{8,22})/i)?.[1];

      // If already paid, confirm and return
      if (order.payment_status === 'paid') {
        const alreadyPaidMsg = `✅ *Payment Already Confirmed!*

Namaste *${order.customer_name}*, aapka Order *#${order.order_number}* ka payment (₹${order.total_amount}) already confirm aur record ho chuka hai!

📦 *Current Status:* *${order.order_status.toUpperCase()}*
${order.tracking_number ? `🚚 *Courier Partner:* ${order.tracking_carrier || 'Courier'} (AWB: *${order.tracking_number}*)\n${order.tracking_url ? `🔗 *Tracking:* ${order.tracking_url}\n` : ''}` : '🎨 Hamari printing team aapke order par kaam kar rahi hai. Dispatch hote hi tracking number yahan share kar diya jayega.'}

Thank you for choosing *Pratap Store*! ❤️`;

        await sendMessageToConversation(db, accountId, {
          conversationId,
          messageType: 'text',
          contentText: alreadyPaidMsg,
        });

        return { handled: true, replySent: true };
      }

      // Check Razorpay live status if payment link exists
      let rzpPaymentId: string | null = null;
      if (order.razorpay_payment_link_id) {
        const rzpStatus = await checkRazorpayPaymentLinkStatus(order.razorpay_payment_link_id, accountId);
        if (rzpStatus.paymentId) {
          rzpPaymentId = rzpStatus.paymentId;
        }
      }

      const paymentRef = rzpPaymentId || utrMatch || `wa_pay_${Date.now()}`;
      const noteAppend = utrMatch
        ? `Customer verified payment via WhatsApp. UTR: ${utrMatch}`
        : `Customer confirmed payment via WhatsApp message: "${trimmedText.slice(0, 60)}"`;

      // Update order to paid & confirmed in database
      const { data: updatedOrder, error: updateErr } = await db
        .from('orders')
        .update({
          payment_status: 'paid',
          payment_captured_at: new Date().toISOString(),
          order_status: order.order_status === 'new' ? 'confirmed' : order.order_status,
          razorpay_payment_id: paymentRef,
          notes: order.notes ? `${order.notes} | ${noteAppend}` : noteAppend,
        })
        .eq('id', order.id)
        .select('*')
        .single();

      if (!updateErr && updatedOrder) {
        const fullOrder = updatedOrder as Order;
        // Send WhatsApp Payment Confirmation Alert
        await sendOrderNotification({
          order: fullOrder,
          type: 'paid',
        });

        return { handled: true, replySent: true, orderCreated: fullOrder };
      }
    }
  }

  // -------------------------------------------------------------
  // Helper: Build Rich WhatsApp Text Catalog Menu
  // -------------------------------------------------------------
  const buildCatalogText = () => {
    const listLines = products.map((p, i) => {
      const mrp = p.compare_at_price ? ` (~₹${p.compare_at_price}~)` : '';
      const desc = p.description ? `\n   ✨ _${p.description}_` : '';
      return `${i + 1}️⃣ *${p.name}*\n   💵 Price: *₹${p.price}*${mrp}${desc}`;
    });

    return `Namaste! 🙏 Welcome to *Pratap Store* 🛍️\n🌐 Website: *www.pratapstore.in*\n\n*✨ OUR POPULAR PRODUCTS:*\n━━━━━━━━━━━━━━━━━━━━\n${listLines.join('\n\n')}\n━━━━━━━━━━━━━━━━━━━━\n👉 *Reply with the product Number (e.g. 1, 2) or Name to order!*`;
  };

  const prodAction = isProductAction(interactiveReplyId, interactiveReplyTitle, messageText);

  // -------------------------------------------------------------
  // Dedicated Handler 1: Chat with Us (Human Support Handoff)
  // -------------------------------------------------------------
  if (prodAction === 'chat_support') {
    // 1. Reset order session
    await db.from('order_sessions').upsert({
      account_id: accountId,
      contact_id: contactId,
      conversation_id: conversationId,
      state: 'IDLE',
      selected_product: {},
      quantity: 1,
      shipping_address: null,
    });

    // 2. Disable bot auto-reply for this conversation & flag handoff
    await db
      .from('conversations')
      .update({
        status: 'open',
        ai_autoreply_disabled: true,
        ai_handoff_summary: 'Customer tapped Chat with Us to connect with support agent',
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId);

    // 3. Send professional live support reassurance message
    const supportMessage = `👋 *Namaste! Aap Pratap Store Customer Support se connect ho chuke hain.* 🙏\n\nHumare support executive jald hi aapse yahan judenge.\n\nAap apna sawaal, design requirements ya order inquiry yahan likh sakte hain — hum aapki poori madad karenge! 🤝`;

    await sendMessageToConversation(db, accountId, {
      conversationId,
      messageType: 'text',
      contentText: supportMessage,
    });

    return { handled: true, replySent: true };
  }

  // -------------------------------------------------------------
  // Dedicated Handler 2: All Products (Send Catalog)
  // -------------------------------------------------------------
  if (prodAction === 'all_products') {
    const categories = Array.from(new Set(products.map((p) => p.category || 'Gifts')));
    const sections = categories.slice(0, 5).map((cat) => ({
      title: cat.slice(0, 24),
      rows: products
        .filter((p) => (p.category || 'Gifts') === cat)
        .slice(0, 10)
        .map((p) => {
          const saveText =
            p.compare_at_price && p.compare_at_price > p.price
              ? ` | Save ₹${p.compare_at_price - p.price}`
              : '';
          return {
            id: `order_${p.id}`,
            title: p.name.slice(0, 24),
            description: `₹${p.price}${saveText} • ${p.description || 'Personalized'}`.slice(0, 72),
          };
        }),
    }));

    const catalogText = buildCatalogText();

    try {
      await sendMessageToConversation(db, accountId, {
        conversationId,
        messageType: 'interactive',
        contentText: catalogText,
        interactivePayload: {
          kind: 'list',
          header: 'Pratap Store • All Products',
          body: `Namaste! 🙏 Welcome to *Pratap Store*.\n🌐 Website: *www.pratapstore.in*\n\nNeeche humare sabhi trending products ki list hai. Kisi bhi product ko order karne ke liye uspar tap karein:`,
          footer: 'Tap View Products below',
          button_label: 'View Products 🛍️',
          sections,
        },
      });
    } catch {
      await sendMessageToConversation(db, accountId, {
        conversationId,
        messageType: 'text',
        contentText: catalogText,
      });
    }

    await db.from('order_sessions').upsert({
      account_id: accountId,
      contact_id: contactId,
      conversation_id: conversationId,
      state: 'AWAITING_PRODUCT',
      selected_product: {},
      quantity: 1,
      shipping_address: null,
    });

    return { handled: true, replySent: true };
  }

  // -------------------------------------------------------------
  // Dedicated Handler 3: Order Now (Start Order Process)
  // -------------------------------------------------------------
  if (
    prodAction === 'order' ||
    interactiveReplyId?.startsWith('order_') ||
    interactiveReplyId?.startsWith('action_order_') ||
    interactiveReplyId?.startsWith('prod_')
  ) {
    let targetId: string | undefined;
    if (interactiveReplyId?.startsWith('order_')) {
      targetId = interactiveReplyId.replace('order_', '');
    } else if (interactiveReplyId?.startsWith('action_order_')) {
      targetId = interactiveReplyId.replace('action_order_', '');
    } else if (interactiveReplyId?.startsWith('prod_')) {
      targetId = interactiveReplyId.replace('prod_', '');
    }

    let matchedProduct: Product | undefined;
    if (targetId) {
      matchedProduct = products.find((p) => p.id === targetId);
    }

    // If no direct product ID in button, check if an agent recently sent a product message
    if (!matchedProduct) {
      const { data: lastMsg } = await db
        .from('messages')
        .select('content_text')
        .eq('conversation_id', conversationId)
        .eq('sender_type', 'agent')
        .order('created_at', { ascending: false })
        .limit(3);

      if (lastMsg && lastMsg.length > 0) {
        for (const m of lastMsg) {
          if (m.content_text) {
            const found = products.find((p) =>
              m.content_text!.toLowerCase().includes(p.name.toLowerCase())
            );
            if (found) {
              matchedProduct = found;
              break;
            }
          }
        }
      }
    }

    if (!matchedProduct && products.length > 0) {
      matchedProduct = products[0];
    }

    if (matchedProduct) {
      await db.from('order_sessions').upsert({
        account_id: accountId,
        contact_id: contactId,
        conversation_id: conversationId,
        state: 'AWAITING_QUANTITY',
        selected_product: matchedProduct,
        quantity: 1,
        shipping_address: null,
      });

      const compareLine = matchedProduct.compare_at_price
        ? ` ~₹${matchedProduct.compare_at_price}~`
        : '';
      const savingsLine =
        matchedProduct.compare_at_price && matchedProduct.compare_at_price > matchedProduct.price
          ? `\n🎉 *You Save:* ₹${matchedProduct.compare_at_price - matchedProduct.price}`
          : '';

      const qtyMsg = `🛍️ *Order Confirmation for:*\n*${matchedProduct.name}*\n💵 Deal Price: *₹${matchedProduct.price}*${compareLine}${savingsLine}\n\n🔢 *Kitne piece order karna chahte hain?*\nNeeche se quantity button select karein ya number (e.g. 1, 2) reply karein:\n👉 *1* for 1 Piece (₹${matchedProduct.price})\n👉 *2* for 2 Piece (₹${matchedProduct.price * 2})\n👉 *3* for 3 Piece (₹${matchedProduct.price * 3})`;

      try {
        await sendMessageToConversation(db, accountId, {
          conversationId,
          messageType: 'interactive',
          contentText: qtyMsg,
          interactivePayload: {
            kind: 'buttons',
            header: 'Order Details 🛍️',
            body: `Aapka selected product:\n*${matchedProduct.name}*\n💵 Special Price: *₹${matchedProduct.price} each*\n\nQuantity select karein:`,
            footer: 'Neeche button tap karein ya number reply karein',
            buttons: [
              { id: 'qty_1', title: `1 Piece (₹${matchedProduct.price})` },
              { id: 'qty_2', title: `2 Piece (₹${matchedProduct.price * 2})` },
              { id: 'qty_3', title: `3 Piece (₹${matchedProduct.price * 3})` },
            ],
          },
        });
      } catch {
        await sendMessageToConversation(db, accountId, {
          conversationId,
          messageType: 'text',
          contentText: qtyMsg,
        });
      }

      return { handled: true, replySent: true };
    }
  }

  // -------------------------------------------------------------
  // Case A: Customer is in IDLE state
  // -------------------------------------------------------------
  if (currentState === 'IDLE') {
    // If account has active interactive flows designed in the Flow Builder,
    // flows take complete precedence for greetings, menus, and shopping workflows!
    // Standalone commerce bot only handles explicit payments (UTR, paid) or tracking queries.
    const { data: activeFlows } = await db
      .from('flows')
      .select('id')
      .eq('account_id', accountId)
      .eq('status', 'active')
      .limit(1);

    if (activeFlows && activeFlows.length > 0) {
      return { handled: false, replySent: false };
    }

    const isTrigger =
      COMMERCE_TRIGGERS.some((kw) => lowerText.includes(kw)) ||
      lowerText === 'hi' ||
      lowerText === 'hello' ||
      lowerText === 'hey' ||
      lowerText === 'namaste' ||
      lowerText === 'namaskar';

    if (!isTrigger) {
      return { handled: false, replySent: false };
    }

    // Check if customer directly asked for a specific product while IDLE (e.g. "keychain", "mug", "cushion", "lamp", "1")
    let directProduct: Product | undefined;
    const isGenericGreeting = ['hi', 'hello', 'hey', 'namaste', 'namaskar', 'order', 'menu', 'catalog', 'catalogue', 'shop', 'start'].includes(lowerText);

    if (!isGenericGreeting) {
      // Try matching by number: "1", "2"
      const num = parseInt(trimmedText, 10);
      if (!isNaN(num) && num >= 1 && num <= products.length) {
        directProduct = products[num - 1];
      }

      // Try matching by name or SKU
      if (!directProduct) {
        directProduct = products.find(
          (p) =>
            lowerText.includes(p.name.toLowerCase()) ||
            p.name.toLowerCase().includes(lowerText) ||
            (p.category && lowerText.includes(p.category.toLowerCase())) ||
            (p.sku && lowerText.includes(p.sku.toLowerCase()))
        );
      }
    }

    // If customer directly specified a product, jump straight to quantity selection!
    if (directProduct) {
      await db.from('order_sessions').upsert({
        account_id: accountId,
        contact_id: contactId,
        conversation_id: conversationId,
        state: 'AWAITING_QUANTITY',
        selected_product: directProduct,
        quantity: 1,
        shipping_address: null,
      });

      const qtyMsg = `✨ *Product Selected:*\n*${directProduct.name}*\n💵 Price: *₹${directProduct.price} each*\n\n🔢 *How many would you like to order?*\nReply with quantity number:\n👉 *1* for 1 Qty (₹${directProduct.price})\n👉 *2* for 2 Qty (₹${directProduct.price * 2})\n👉 *3* for 3 Qty (₹${directProduct.price * 3})\n_(or reply with any number e.g. 5)_`;

      try {
        await sendMessageToConversation(db, accountId, {
          conversationId,
          messageType: 'interactive',
          contentText: qtyMsg,
          interactivePayload: {
            kind: 'buttons',
            header: 'Product Selected ✨',
            body: `You selected:\n*${directProduct.name}*\n💵 Price: *₹${directProduct.price} each*\n\nChoose the quantity you want:`,
            footer: 'Select quantity below or reply with number',
            buttons: [
              { id: 'qty_1', title: `1 Qty (₹${directProduct.price})` },
              { id: 'qty_2', title: `2 Qty (₹${directProduct.price * 2})` },
              { id: 'qty_3', title: `3 Qty (₹${directProduct.price * 3})` },
            ],
          },
        });
      } catch {
        await sendMessageToConversation(db, accountId, {
          conversationId,
          messageType: 'text',
          contentText: qtyMsg,
        });
      }

      return { handled: true, replySent: true };
    }

    // Otherwise, send the complete interactive catalog!
    const categories = Array.from(new Set(products.map((p) => p.category || 'Gifts')));
    const sections = categories.slice(0, 5).map((cat) => ({
      title: cat.slice(0, 24),
      rows: products
        .filter((p) => (p.category || 'Gifts') === cat)
        .slice(0, 10)
        .map((p) => ({
          id: `prod_${p.id}`,
          title: p.name.slice(0, 24),
          description: `₹${p.price} • ${p.description || 'Custom print'}`.slice(0, 72),
        })),
    }));

    const catalogContent = buildCatalogText();

    try {
      await sendMessageToConversation(db, accountId, {
        conversationId,
        messageType: 'interactive',
        contentText: catalogContent,
        interactivePayload: {
          kind: 'list',
          header: 'Pratap Store • Official Catalog',
          body: 'Namaste! 🙏 Welcome to *Pratap Store*.\n\nBrowse our personalized products below and select an item to place an instant WhatsApp order:',
          footer: 'Tap View Products below',
          button_label: 'View Products 🛍️',
          sections,
        },
      });
    } catch {
      await sendMessageToConversation(db, accountId, {
        conversationId,
        messageType: 'text',
        contentText: catalogContent,
      });
    }

    // Update session state
    await db.from('order_sessions').upsert({
      account_id: accountId,
      contact_id: contactId,
      conversation_id: conversationId,
      state: 'AWAITING_PRODUCT',
      selected_product: {},
      quantity: 1,
      shipping_address: null,
    });

    return { handled: true, replySent: true };
  }

  // -------------------------------------------------------------
  // Case B: State: AWAITING_PRODUCT (or tapped a product row)
  // -------------------------------------------------------------
  if (currentState === 'AWAITING_PRODUCT' || interactiveReplyId?.startsWith('prod_')) {
    let matchedProduct: Product | undefined;

    if (interactiveReplyId?.startsWith('prod_')) {
      const prodId = interactiveReplyId.replace('prod_', '');
      matchedProduct = products.find((p) => p.id === prodId);
    }

    if (!matchedProduct) {
      // Check if user entered a number like "1", "2"
      const num = parseInt(trimmedText, 10);
      if (!isNaN(num) && num >= 1 && num <= products.length) {
        matchedProduct = products[num - 1];
      }
    }

    if (!matchedProduct) {
      // Match by title or name
      const query = (interactiveReplyTitle || trimmedText).toLowerCase();
      matchedProduct = products.find(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          query.includes(p.name.toLowerCase()) ||
          (p.sku && query.includes(p.sku.toLowerCase()))
      );
    }

    if (!matchedProduct) {
      // If user typed menu, hi, hello, main, or tapped a non-product option, release the session back to IDLE
      // so interactive flows or general menu can take over seamlessly!
      const isEscapeKeyword = [
        'hi', 'hello', 'hey', 'menu', 'main', 'main menu', 'start', 'start menu',
        'order', 'order now', 'catalog', 'help', 'support', 'cancel', 'reset'
      ].some(k => lowerText.includes(k)) || Boolean(interactiveReplyId);

      // Reset session to IDLE so customer is never trapped in a loop
      await db.from('order_sessions').upsert({
        account_id: accountId,
        contact_id: contactId,
        conversation_id: conversationId,
        state: 'IDLE',
        selected_product: {},
        quantity: 1,
        shipping_address: null,
      });

      // If it was an escape keyword, return handled: false so Flows engine handles it!
      if (isEscapeKeyword) {
        return { handled: false, replySent: false };
      }

      // If it's a completely unrecognized message, return handled: false so flows or AI can handle
      return { handled: false, replySent: false };
    }

    // Product found! Ask for quantity
    await db.from('order_sessions').upsert({
      account_id: accountId,
      contact_id: contactId,
      conversation_id: conversationId,
      state: 'AWAITING_QUANTITY',
      selected_product: matchedProduct,
      quantity: 1,
      shipping_address: null,
    });

    const qtyMsg = `✨ *Product Selected:*\n*${matchedProduct.name}*\n💵 Price: *₹${matchedProduct.price} each*\n\n🔢 *How many would you like to order?*\nReply with quantity number:\n👉 *1* for 1 Qty (₹${matchedProduct.price})\n👉 *2* for 2 Qty (₹${matchedProduct.price * 2})\n👉 *3* for 3 Qty (₹${matchedProduct.price * 3})\n_(or reply with any number e.g. 5)_`;

    try {
      await sendMessageToConversation(db, accountId, {
        conversationId,
        messageType: 'interactive',
        contentText: qtyMsg,
        interactivePayload: {
          kind: 'buttons',
          header: 'Product Selected ✨',
          body: `You selected:\n*${matchedProduct.name}*\n💵 Price: *₹${matchedProduct.price} each*\n\nChoose the quantity you want:`,
          footer: 'Tap a button below or reply with number',
          buttons: [
            { id: 'qty_1', title: `1 Qty (₹${matchedProduct.price})` },
            { id: 'qty_2', title: `2 Qty (₹${matchedProduct.price * 2})` },
            { id: 'qty_3', title: `3 Qty (₹${matchedProduct.price * 3})` },
          ],
        },
      });
    } catch {
      await sendMessageToConversation(db, accountId, {
        conversationId,
        messageType: 'text',
        contentText: qtyMsg,
      });
    }

    return { handled: true, replySent: true };
  }

  // -------------------------------------------------------------
  // Case C: State: AWAITING_QUANTITY
  // -------------------------------------------------------------
  if (currentState === 'AWAITING_QUANTITY' || interactiveReplyId?.startsWith('qty_')) {
    const product: Product = session?.selected_product as Product;
    if (!product || !product.price) {
      await db.from('order_sessions').upsert({
        account_id: accountId,
        contact_id: contactId,
        conversation_id: conversationId,
        state: 'IDLE',
      });
      await sendMessageToConversation(db, accountId, {
        conversationId,
        messageType: 'text',
        contentText: 'Session expired. Type *MENU* to browse our products.',
      });
      return { handled: true, replySent: true };
    }

    let qty = 1;
    if (interactiveReplyId?.startsWith('qty_')) {
      qty = parseInt(interactiveReplyId.replace('qty_', ''), 10) || 1;
    } else {
      const parsed = parseInt(trimmedText, 10);
      if (!isNaN(parsed) && parsed > 0 && parsed <= 50) {
        qty = parsed;
      }
    }

    const subtotal = product.price * qty;

    await db.from('order_sessions').upsert({
      account_id: accountId,
      contact_id: contactId,
      conversation_id: conversationId,
      state: 'AWAITING_ADDRESS',
      selected_product: product,
      quantity: qty,
      shipping_address: null,
    });

    await sendMessageToConversation(db, accountId, {
      conversationId,
      messageType: 'text',
      contentText: `📍 *STEP 2 OF 3: DELIVERY ADDRESS*
━━━━━━━━━━━━━━━━━━━━
You selected: *${qty}x ${product.name}*
💰 Subtotal: *₹${subtotal}* (FREE Delivery 🚚)
━━━━━━━━━━━━━━━━━━━━
Please reply with your complete delivery address in ONE message:

*Format:*
House/Flat No, Street / Area
Landmark
City, State - PIN code`,
    });

    return { handled: true, replySent: true };
  }

  // -------------------------------------------------------------
  // Case D: State: AWAITING_ADDRESS
  // -------------------------------------------------------------
  if (currentState === 'AWAITING_ADDRESS') {
    const product: Product = session?.selected_product as Product;
    const qty = session?.quantity || 1;
    const address = trimmedText;

    if (address.length < 5) {
      await sendMessageToConversation(db, accountId, {
        conversationId,
        messageType: 'text',
        contentText:
          '⚠️ Please provide a valid complete address (House/Street, City, and PIN code).',
      });
      return { handled: true, replySent: true };
    }

    const totalAmount = product.price * qty;

    await db.from('order_sessions').upsert({
      account_id: accountId,
      contact_id: contactId,
      conversation_id: conversationId,
      state: 'AWAITING_PAYMENT_METHOD',
      selected_product: product,
      quantity: qty,
      shipping_address: address,
    });

    // Send Order Summary with Payment Method Options
    const summaryBody = `📋 *FINAL ORDER SUMMARY*
━━━━━━━━━━━━━━━━━━━━
🛍️ *Item:* ${product.name} x ${qty}
💵 *Subtotal:* ₹${totalAmount}
🚚 *Shipping Fee:* FREE
💰 *Total Payable:* *₹${totalAmount}*
━━━━━━━━━━━━━━━━━━━━
📍 *Deliver To:*
${address}
━━━━━━━━━━━━━━━━━━━━

❓ *How would you like to pay?*
Reply with:
*1* ➡️ 💳 *Pay Online (PREPAID via Razorpay)*
    _(UPI, Google Pay, PhonePe, Paytm, Cards)_
    ⚡ _Instant confirmation & fast shipping!_

*2* ➡️ 💵 *Cash on Delivery (COD)*
    _(Pay cash to courier at doorstep)_`;

    try {
      await sendMessageToConversation(db, accountId, {
        conversationId,
        messageType: 'interactive',
        contentText: summaryBody,
        interactivePayload: {
          kind: 'buttons',
          header: 'Order Summary 📦',
          body: summaryBody,
          footer: 'Choose your payment method below',
          buttons: [
            { id: 'btn_pay_online', title: '💳 Pay Online' },
            { id: 'btn_pay_cod', title: '💵 Cash on Delivery' },
          ],
        },
      });
    } catch {
      await sendMessageToConversation(db, accountId, {
        conversationId,
        messageType: 'text',
        contentText: summaryBody,
      });
    }

    return { handled: true, replySent: true };
  }

  // -------------------------------------------------------------
  // Case E: State: AWAITING_PAYMENT_METHOD
  // -------------------------------------------------------------
  if (
    currentState === 'AWAITING_PAYMENT_METHOD' ||
    interactiveReplyId === 'btn_pay_online' ||
    interactiveReplyId === 'btn_pay_cod'
  ) {
    const product: Product = session?.selected_product as Product;
    const qty = session?.quantity || 1;
    const addressText = session?.shipping_address || 'Address provided on WhatsApp';

    const isOnline =
      interactiveReplyId === 'btn_pay_online' ||
      lowerText.includes('online') ||
      lowerText.includes('upi') ||
      lowerText.includes('prepaid') ||
      lowerText === '1' ||
      lowerText.includes('razorpay');

    const isCod =
      interactiveReplyId === 'btn_pay_cod' ||
      lowerText.includes('cod') ||
      lowerText.includes('cash') ||
      lowerText === '2' ||
      lowerText.includes('delivery');

    if (!isOnline && !isCod) {
      await sendMessageToConversation(db, accountId, {
        conversationId,
        messageType: 'text',
        contentText:
          '⚠️ Please select your payment method:\nReply with *1* for 💳 *Pay Online (Razorpay / UPI)*\nReply with *2* for 💵 *Cash on Delivery (COD)*',
      });
      return { handled: true, replySent: true };
    }

    const orderNumber = generateOrderNumber();
    const totalAmount = product.price * qty;

    const items: OrderItem[] = [
      {
        product_id: product.id,
        name: product.name,
        price: product.price,
        quantity: qty,
        image_url: product.image_url || undefined,
        subtotal: totalAmount,
      },
    ];

    const shippingAddress: ShippingAddress = {
      recipient_name: customerName || 'Valued Customer',
      phone: customerPhone || undefined,
      street: addressText,
      city: '',
      state: '',
      pincode: '',
    };

    // 1. Create order in orders table
    const paymentMethod = isOnline ? 'razorpay' : 'cod';
    const orderStatus = isOnline ? 'new' : 'confirmed';

    const { data: createdOrder, error: orderErr } = await db
      .from('orders')
      .insert({
        account_id: accountId,
        contact_id: contactId,
        conversation_id: conversationId,
        order_number: orderNumber,
        customer_name: customerName || 'WhatsApp Customer',
        customer_phone: customerPhone || '',
        shipping_address: shippingAddress,
        items,
        subtotal: totalAmount,
        total_amount: totalAmount,
        currency: 'INR',
        payment_method: paymentMethod,
        payment_status: 'pending',
        order_status: orderStatus,
        notes: `Automated WhatsApp Commerce Order. Mode: ${isOnline ? 'PREPAID (Razorpay)' : 'CASH ON DELIVERY (COD)'}`,
      })
      .select('*')
      .single();

    if (orderErr || !createdOrder) {
      console.error('[CommerceBot] Failed to create order:', orderErr);
      await sendMessageToConversation(db, accountId, {
        conversationId,
        messageType: 'text',
        contentText: '❌ An error occurred while creating your order. Please try again or type MENU.',
      });
      return { handled: true, replySent: true };
    }

    let order = createdOrder as Order;

    // Reset session back to IDLE
    await db.from('order_sessions').upsert({
      account_id: accountId,
      contact_id: contactId,
      conversation_id: conversationId,
      state: 'IDLE',
      selected_product: {},
      quantity: 1,
      shipping_address: null,
    });

    // 2A. If Online (Prepaid Razorpay)
    if (isOnline) {
      const linkResult = await createRazorpayPaymentLink({
        orderId: order.id,
        orderNumber: order.order_number,
        amount: order.total_amount,
        customerName: order.customer_name,
        customerPhone: order.customer_phone,
        accountId,
        description: `Order #${order.order_number} - Pratap Store`,
      });

      const { data: withLink } = await db
        .from('orders')
        .update({
          razorpay_payment_link_id: linkResult.id,
          razorpay_payment_link_url: linkResult.short_url,
        })
        .eq('id', order.id)
        .select('*')
        .single();

      if (withLink) order = withLink as Order;

      const paymentMsg = `💳 *ORDER TYPE: PREPAID (ONLINE VIA RAZORPAY)*
━━━━━━━━━━━━━━━━━━━━
Order #*${order.order_number}*
🛍️ *Item:* ${product.name} x ${qty}
💰 *Total Amount:* *₹${order.total_amount}*
━━━━━━━━━━━━━━━━━━━━
👉 *Click here to pay securely with UPI / GPay / PhonePe / Paytm / Cards:*
${order.razorpay_payment_link_url}
━━━━━━━━━━━━━━━━━━━━
⚡ _Once payment is completed, your order will be confirmed instantly!_ 🚀`;

      await sendMessageToConversation(db, accountId, {
        conversationId,
        messageType: 'text',
        contentText: paymentMsg,
      });

      return { handled: true, replySent: true, orderCreated: order };
    }

    // 2B. If Cash on Delivery (COD)
    const codMsg = `🎉 *ORDER TYPE: CASH ON DELIVERY (COD)*
━━━━━━━━━━━━━━━━━━━━
Namaste *${order.customer_name}*, your order has been placed successfully!

📦 *Order #:* *${order.order_number}*
🛍️ *Item:* ${product.name} x ${qty}
💵 *Amount to Pay on Delivery:* *₹${order.total_amount} in Cash*
📍 *Delivery Address:*
${addressText}
━━━━━━━━━━━━━━━━━━━━
✅ _No online payment needed! Keep exact cash ready for courier._
Our printing team has started preparing your personalized gifts! Thank you for choosing *Pratap Store*! ❤️`;

    await sendMessageToConversation(db, accountId, {
      conversationId,
      messageType: 'text',
      contentText: codMsg,
    });

    return { handled: true, replySent: true, orderCreated: order };
  }

  return { handled: false, replySent: false };
}
