import type { Product } from '@/types/orders';

export interface ProductMessageOptions {
  headlineStyle?: 'deal_alert' | 'special_offer' | 'inquiry' | 'festival_sale' | 'custom';
  customHeadline?: string;
  customNote?: string;
  storeDomain?: string;
  storeName?: string;
  includePerks?: boolean;
  includeDiscount?: boolean;
}

export const HEADLINE_PRESETS: Record<
  string,
  { label: string; text: string; subtitle: string; icon: string }
> = {
  deal_alert: {
    label: 'Amazon Deal Alert',
    text: 'Deal Alert: Deal alert on your wishlist item 😍',
    subtitle: 'High conversion Amazon-style deal alert',
    icon: '⚡',
  },
  special_offer: {
    label: 'Special Offer',
    text: 'Special Offer: Exclusive flat discount for you! 🔥',
    subtitle: 'Limited-time discount offer',
    icon: '🎁',
  },
  inquiry: {
    label: 'Product Details Inquiry',
    text: 'Product Details: As requested, here is your product overview ✨',
    subtitle: 'Direct reply to customer enquiry',
    icon: '📦',
  },
  festival_sale: {
    label: 'Festival Sale Alert',
    text: '🪔 Festive Dhamaka Deal: Biggest deals of the season! 🛍️',
    subtitle: 'Festive & seasonal promotion',
    icon: '🪔',
  },
};

/**
 * Format a product into a high-converting, professional e-commerce WhatsApp message
 * modeled directly after Amazon India WhatsApp notification templates.
 */
export function formatProductWhatsAppMessage(
  product: Product,
  options: ProductMessageOptions = {}
): string {
  const {
    headlineStyle = 'deal_alert',
    customHeadline,
    customNote,
    storeDomain = 'www.pratapstore.in',
    storeName = 'Pratap Store',
    includePerks = true,
    includeDiscount = true,
  } = options;

  const headline =
    customHeadline?.trim() ||
    HEADLINE_PRESETS[headlineStyle]?.text ||
    'Deal Alert: Deal alert on your wishlist item 😍';

  const parts: string[] = [];

  // 1. Top domain / store link (like www.amazon.in in the screenshot)
  parts.push(storeDomain);

  // 2. Bold Deal Alert headline
  parts.push(`*${headline}*`);

  // 3. Discount calculation & Price line
  const hasCompare =
    includeDiscount &&
    product.compare_at_price &&
    product.compare_at_price > product.price;

  if (hasCompare) {
    const compare = Number(product.compare_at_price);
    const savings = compare - product.price;
    const discountPercent = Math.round((savings / compare) * 100);

    parts.push(
      `Save ${discountPercent}% on ${product.name}\n` +
        `₹${product.price}\n` +
        `~₹${compare}~\n` +
        `(Save ₹${savings})`
    );
  } else {
    parts.push(
      `*${product.name}*\n` +
        `₹${product.price}`
    );
  }

  // 4. Description / Highlights
  if (product.description?.trim()) {
    parts.push(`✨ ${product.description.trim()}`);
  }

  // 5. Optional merchant personalized note
  if (customNote?.trim()) {
    parts.push(`💬 _${customNote.trim()}_`);
  }

  // 6. "What's more?" section
  if (includePerks) {
    parts.push(
      `What's more?\n\n` +
        `🪔 ${storeName} Deals are LIVE | Fast Pan-India Delivery\n\n` +
        `Reply *ORDER* to purchase • Reply STOP to unsubscribe`
    );
  } else {
    parts.push(
      `Reply *ORDER* to purchase • Reply STOP to unsubscribe`
    );
  }

  return parts.join('\n\n');
}

/**
 * Format multiple selected products (e.g. 2, 3, 4 products) into a combined
 * high-converting showcase WhatsApp message with item numbering, discounts, and combo pricing.
 */
export function formatMultiProductWhatsAppMessage(
  products: Product[],
  options: ProductMessageOptions = {}
): string {
  if (!products || products.length === 0) return '';
  if (products.length === 1) return formatProductWhatsAppMessage(products[0], options);

  const {
    headlineStyle = 'special_offer',
    customHeadline,
    customNote,
    storeDomain = 'www.pratapstore.in',
    storeName = 'Pratap Store',
    includePerks = true,
    includeDiscount = true,
  } = options;

  const defaultMultiHeadline =
    headlineStyle === 'deal_alert'
      ? `Deal Alert: Exclusive ${products.length} Wishlist Deals for You! 😍`
      : headlineStyle === 'festival_sale'
      ? `🪔 Festive Dhamaka: Top ${products.length} Best-Selling Deals! 🛍️`
      : headlineStyle === 'inquiry'
      ? `Product Details: As requested, here are ${products.length} product overviews ✨`
      : `Special Offer: Top ${products.length} Curated Deals for You! 🔥`;

  const headline = customHeadline?.trim() || defaultMultiHeadline;

  const parts: string[] = [];

  // 1. Top domain / store link
  parts.push(storeDomain);

  // 2. Bold Deal Alert headline
  parts.push(`*${headline}*`);

  // 3. Products list with numbering, price, discount
  let totalSellingPrice = 0;
  let totalComparePrice = 0;
  let hasAnyCompare = false;

  const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

  const productBlocks = products.map((product, idx) => {
    const sPrice = Number(product.price) || 0;
    totalSellingPrice += sPrice;
    const numIcon = numberEmojis[idx] || `${idx + 1}.`;

    const hasCompare =
      includeDiscount &&
      product.compare_at_price &&
      Number(product.compare_at_price) > sPrice;

    let priceLine = `₹${sPrice}`;
    if (hasCompare) {
      hasAnyCompare = true;
      const compare = Number(product.compare_at_price);
      totalComparePrice += compare;
      const savings = compare - sPrice;
      const discountPercent = Math.round((savings / compare) * 100);
      priceLine = `₹${sPrice} ~₹${compare}~ (${discountPercent}% OFF • Save ₹${savings})`;
    } else {
      totalComparePrice += sPrice;
    }

    const descSnippet = product.description?.trim()
      ? `\n   ✨ _${product.description.trim().slice(0, 90)}${product.description.trim().length > 90 ? '...' : ''}_`
      : '';

    return `${numIcon} *${product.name}*\n   💰 ${priceLine}${descSnippet}`;
  });

  parts.push(productBlocks.join('\n\n'));

  // 4. Bundle / Total Combo summary
  if (hasAnyCompare && totalComparePrice > totalSellingPrice) {
    const totalSavings = totalComparePrice - totalSellingPrice;
    const totalPercent = Math.round((totalSavings / totalComparePrice) * 100);
    parts.push(
      `📦 *Bundle Value (${products.length} Selected Items): ₹${totalSellingPrice}* ~₹${totalComparePrice}~\n` +
      `🎉 *Total Savings: ₹${totalSavings} (${totalPercent}% OFF)*`
    );
  } else {
    parts.push(`📦 *Total (${products.length} Selected Items): ₹${totalSellingPrice}*`);
  }

  // 5. Merchant custom note
  if (customNote?.trim()) {
    parts.push(`💬 _${customNote.trim()}_`);
  }

  // 6. Perks & CTA
  if (includePerks) {
    parts.push(
      `What's more?\n\n` +
      `🪔 ${storeName} Deals are LIVE | Fast Pan-India Delivery\n\n` +
      `Reply *ORDER* to purchase • Reply STOP to unsubscribe`
    );
  } else {
    parts.push(`Reply *ORDER* to purchase • Reply STOP to unsubscribe`);
  }

  return parts.join('\n\n');
}

