import { supabaseAdmin } from '@/lib/flows/admin-client';
import { resolveConversationByPhone } from '@/lib/whatsapp/resolve-conversation';
import { sendMessageToConversation } from '@/lib/whatsapp/send-message';
import type { InteractiveMessagePayload } from '@/lib/whatsapp/interactive';
import type { Order } from '@/types/orders';

export type NotificationType = 'created' | 'confirmed' | 'processing' | 'paid' | 'shipped' | 'delivered' | 'cancelled';

export function formatOrderConfirmedMessage(order: Order): string {
  const itemsText = order.items
    .map(
      (item, idx) =>
        `${idx + 1}. *${item.name}* ${item.variant ? `(${item.variant})` : ''} x ${item.quantity}`
    )
    .join('\n');

  return `✅ *Order Confirmed & In Production!*

Namaste *${order.customer_name}*, aapka Order *#${order.order_number}* confirm ho gaya hai aur hamari printing team ne is par kaam shuru kar diya hai! 🎨

🛍️ *Items:*
${itemsText}

💰 *Total Amount:* ₹${order.total_amount} (${order.payment_method === 'cod' ? 'Cash on Delivery' : 'Prepaid'})
📍 *Delivery City:* ${order.shipping_address?.city || 'Your Location'}

🚚 *Next Step:* Parcel dispatch hote hi aapko courier partner aur live tracking number yahan WhatsApp par mil jayega.

Thank you for choosing *Pratap Store*! ❤️`;
}

export function formatOrderCreatedMessage(order: Order): string {
  const itemsText = order.items
    .map(
      (item, idx) =>
        `${idx + 1}. *${item.name}* ${item.variant ? `(${item.variant})` : ''} x ${item.quantity} - ₹${item.subtotal || item.price * item.quantity}`
    )
    .join('\n');

  const addr = order.shipping_address;
  const addressText = [
    addr.recipient_name || order.customer_name,
    addr.street,
    addr.landmark ? `Near ${addr.landmark}` : '',
    `${addr.city}, ${addr.state} - ${addr.pincode}`,
  ]
    .filter(Boolean)
    .join(', ');

  const paymentLink = order.razorpay_payment_link_url || '';

  return `🙏 *Namaste ${order.customer_name}!*
Thank you for your order with *Pratap Store*.

📦 *Order #${order.order_number}*
━━━━━━━━━━━━━━━━━━━━
🛍️ *Items Ordered:*
${itemsText}

━━━━━━━━━━━━━━━━━━━━
💵 *Subtotal:* ₹${order.subtotal}
🚚 *Shipping:* ${order.shipping_fee > 0 ? `₹${order.shipping_fee}` : 'FREE'}
${order.discount_amount > 0 ? `🏷️ *Discount:* -₹${order.discount_amount}\n` : ''}💰 *Total Payable:* *₹${order.total_amount}*
━━━━━━━━━━━━━━━━━━━━
📍 *Delivery Address:*
${addressText}

${
  order.payment_method === 'cod'
    ? `💵 *Payment Mode:* CASH ON DELIVERY (COD)
💰 *Payable on Delivery:* *₹${order.total_amount}* (Cash)
✅ _No online advance payment required! Keep exact cash ready for courier._`
    : order.payment_status === 'paid'
    ? `💳 *Payment Mode:* PREPAID (ONLINE VIA RAZORPAY)
✅ *Payment Status:* PAID (₹${order.total_amount})`
    : `💳 *Payment Mode:* PREPAID (ONLINE VIA RAZORPAY)
💰 *Total Payable:* *₹${order.total_amount}*

👉 *Click here to pay securely via UPI / Cards / GPay:*
${paymentLink}

⚡ _(Supports UPI, Google Pay, PhonePe, Paytm, Debit/Credit Cards & NetBanking)_`
}

If you have any questions or custom design requests, simply reply to this message! 🎨`;
}

export function formatOrderPaidMessage(order: Order): string {
  return `🎉 *Payment Successful!*

Namaste *${order.customer_name}*, we have received your payment of *₹${order.total_amount}* for Order *#${order.order_number}*.

💳 *Payment Ref:* ${order.razorpay_payment_id || 'Captured'}
📅 *Status:* Confirmed & Processing

Our team is now preparing your personalized items with the highest quality prints! You will receive another update as soon as your parcel is dispatched.

Thank you for choosing *Pratap Store*! ❤️`;
}

export function formatOrderShippedMessage(order: Order): string {
  const carrier = order.tracking_carrier || 'Express Courier';
  const trackingNumber = order.tracking_number || 'N/A';
  const trackingLink = order.tracking_url
    ? `\n🔗 *Track your parcel:* ${order.tracking_url}`
    : '';

  return `🚚 *Your Order Has Been Dispatched!*

Namaste *${order.customer_name}*, exciting news! Your Pratap Store Order *#${order.order_number}* is on its way to you.

📦 *Courier Partner:* ${carrier}
🔢 *Tracking Number (AWB):* *${trackingNumber}*${trackingLink}
📍 *Delivering To:* ${order.shipping_address.city || ''}, ${order.shipping_address.state || ''}

Estimated delivery: 2 to 4 business days. Reply here if you need any assistance! 🙏`;
}

export function formatOrderDeliveredMessage(order: Order): string {
  return `✨ *Order Delivered!*

Namaste *${order.customer_name}*, your Pratap Store Order *#${order.order_number}* has been marked as *Delivered*!

We hope you love your personalized products as much as we loved making them for you.

⭐ Please share your feedback or send us a photo of your items! Your review means the world to our small business. 🙏`;
}

export function formatOrderCancelledMessage(order: Order): string {
  return `⚠️ *ORDER CANCELLED - PRATAP STORE*
━━━━━━━━━━━━━━━━━━━━
Namaste *${order.customer_name}*,

Aapka Order #*${order.order_number}* cancel kar diya gaya hai.
📌 *Wajah (Reason):* Payment verification / UTR number bank statement me match nahi hua ya order cancel kiya gaya.

Agar aapko lagta hai yeh galti se hua hai, toh kripya WhatsApp par hamari team se contact karein.
❤️ Thank you for contacting *Pratap Store*!`;
}

/**
 * Sends a WhatsApp notification for an order.
 */
export async function sendOrderNotification(params: {
  order: Order;
  type: NotificationType;
  customMessage?: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { order, type, customMessage } = params;
  const db = supabaseAdmin();

  let messageText = customMessage;
  if (!messageText) {
    switch (type) {
      case 'created':
        messageText = formatOrderCreatedMessage(order);
        break;
      case 'confirmed':
      case 'processing':
        messageText = formatOrderConfirmedMessage(order);
        break;
      case 'paid':
        messageText = formatOrderPaidMessage(order);
        break;
      case 'shipped':
        messageText = formatOrderShippedMessage(order);
        break;
      case 'delivered':
        messageText = formatOrderDeliveredMessage(order);
        break;
      case 'cancelled':
        messageText = formatOrderCancelledMessage(order);
        break;
    }
  }

  // Ensure customer phone is in international format
  let phone = order.customer_phone.replace(/\s+/g, '');
  if (!phone.startsWith('+')) {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) {
      phone = `+91${digits}`;
    } else {
      phone = `+${digits}`;
    }
  }

  try {
    // 1. Resolve contact & conversation
    const { conversationId, contactId } = await resolveConversationByPhone(
      db,
      order.account_id,
      phone,
      order.customer_name
    );

    // 2. Link conversation & contact to order if missing
    if (!order.conversation_id || !order.contact_id) {
      await db
        .from('orders')
        .update({
          conversation_id: conversationId,
          contact_id: contactId,
        })
        .eq('id', order.id);
    }

    // 3. Construct interactive buttons payload (up to 3 buttons, <= 20 chars per Meta limits)
    const buttons =
      order.payment_method === 'cod'
        ? [
            { id: `confirm_addr_${order.id}`, title: '✅ Confirm Address' },
            { id: `order_status_${order.id}`, title: '📦 Track Order' },
          ]
        : order.payment_status === 'paid'
        ? [
            { id: `order_status_${order.id}`, title: '📦 Track Order' },
            { id: `chat_support_${order.id}`, title: '💬 Chat Support' },
          ]
        : [
            { id: `pay_now_${order.id}`, title: '💳 Pay Online' },
            { id: `confirm_addr_${order.id}`, title: '✅ Confirm Address' },
            { id: `order_status_${order.id}`, title: '📦 Track Order' },
          ];

    const interactivePayload: InteractiveMessagePayload = {
      kind: 'buttons',
      header: `Order #${order.order_number}`,
      body: messageText,
      footer: 'Pratap Store • Verified',
      buttons,
    };

    // 4. Send message through unified WhatsApp sender
    const sendResult = await sendMessageToConversation(db, order.account_id, {
      conversationId,
      messageType: 'interactive',
      contentText: messageText,
      interactivePayload,
    });

    return {
      success: true,
      messageId: sendResult.messageId,
    };
  } catch (error) {
    const err = error as Error;
    console.warn(`[OrderNotification] WhatsApp send failed for order ${order.order_number}:`, err.message);
    return {
      success: false,
      error: err.message,
    };
  }
}
