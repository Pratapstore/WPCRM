/**
 * Standalone seed script to populate 20 WhatsApp Message Templates
 * and 20 Keyword Auto-Reply Automations for Pratap Store.
 *
 * Run with:
 *   npx tsx scripts/seed-templates-automations.ts
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

const env = dotenv.parse(fs.readFileSync('.env.local'));
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!);

const ACCOUNT_ID = '842c3d98-69ad-4661-abe1-d53629a5bdb1';
const USER_ID = '7078fc41-0264-4b9f-a9a1-41b67f624d44';

export const TEMPLATES = [
  {
    name: 'welcome_greeting',
    category: 'Marketing',
    language: 'en_US',
    body_text: 'Namaste {{1}}! 🙏 Welcome to Pratap Store. Explore our exclusive personalized photo gifts, custom t-shirts, mugs, and keychains. Reply with *MENU* to see our full catalog!',
    footer_text: 'Pratap Store • Your Ideas, Our Prints',
    buttons: [
      { type: 'QUICK_REPLY', text: 'View Products' },
      { type: 'QUICK_REPLY', text: 'Contact Support' }
    ],
    status: 'APPROVED',
    sample_values: { body_text: ['Amit'] }
  },
  {
    name: 'order_confirmed',
    category: 'Utility',
    language: 'en_US',
    body_text: 'Hi {{1}}, your order #{{2}} of ₹{{3}} has been successfully confirmed! 🎉 We are preparing your custom prints. You will receive tracking details once dispatched.',
    footer_text: 'Thank you for shopping with us!',
    buttons: [
      { type: 'QUICK_REPLY', text: 'Track Order' },
      { type: 'QUICK_REPLY', text: 'Help' }
    ],
    status: 'APPROVED',
    sample_values: { body_text: ['Rahul', 'ORD-1042', '499'] }
  },
  {
    name: 'order_dispatched',
    category: 'Utility',
    language: 'en_US',
    body_text: 'Great news {{1}}! 🚚 Your order #{{2}} has been dispatched via {{3}}. Tracking Number: *{{4}}*. Estimated delivery in 2-4 business days.',
    footer_text: 'Pratap Store Tracking',
    buttons: [
      { type: 'QUICK_REPLY', text: 'Delivery Status' }
    ],
    status: 'APPROVED',
    sample_values: { body_text: ['Priya', 'ORD-1042', 'Delhivery', 'DL123456789IN'] }
  },
  {
    name: 'out_for_delivery',
    category: 'Utility',
    language: 'en_US',
    body_text: 'Hello {{1}}, your order #{{2}} is OUT FOR DELIVERY today! 📦 Please ensure someone is available at the delivery address.',
    footer_text: 'Pratap Store Express',
    status: 'APPROVED',
    sample_values: { body_text: ['Priya', 'ORD-1042'] }
  },
  {
    name: 'order_delivered',
    category: 'Utility',
    language: 'en_US',
    body_text: 'Hello {{1}}! Your order #{{2}} has been delivered. 🎁 We hope you loved your personalized items! Please take a moment to share your feedback.',
    footer_text: 'Pratap Store',
    buttons: [
      { type: 'QUICK_REPLY', text: 'Rate 5 Stars ⭐' },
      { type: 'QUICK_REPLY', text: 'Need Help' }
    ],
    status: 'APPROVED',
    sample_values: { body_text: ['Amit', 'ORD-1042'] }
  },
  {
    name: 'payment_received',
    category: 'Utility',
    language: 'en_US',
    body_text: 'Hi {{1}}, payment of ₹{{2}} for order #{{3}} has been successfully received via {{4}}. Thank you for your prompt payment! ✅',
    footer_text: 'Payment Receipt • Pratap Store',
    status: 'APPROVED',
    sample_values: { body_text: ['Rohit', '299', 'ORD-1055', 'UPI'] }
  },
  {
    name: 'payment_reminder',
    category: 'Utility',
    language: 'en_US',
    body_text: 'Namaste {{1}}, gentle reminder: Payment of ₹{{2}} for your custom order #{{3}} is pending. Kindly complete it to start printing: UPI ID: *pratapstore@upi*',
    footer_text: 'Instant verification via WhatsApp',
    buttons: [
      { type: 'QUICK_REPLY', text: 'Paid Already' },
      { type: 'QUICK_REPLY', text: 'Send QR Code' }
    ],
    status: 'APPROVED',
    sample_values: { body_text: ['Vikas', '349', 'ORD-1080'] }
  },
  {
    name: 'custom_tshirt_offer',
    category: 'Marketing',
    language: 'en_US',
    body_text: '👕 Custom T-Shirts Special Offer! Get personalized YouTube/Instagram logo or photo T-Shirts starting at only ₹{{1}}! High-quality fabric & vibrant print.',
    footer_text: 'Limited Time Offer • Pratap Store',
    buttons: [
      { type: 'QUICK_REPLY', text: 'Order T-Shirt' },
      { type: 'QUICK_REPLY', text: 'See Designs' }
    ],
    status: 'APPROVED',
    sample_values: { body_text: ['299'] }
  },
  {
    name: 'photo_keychain_deal',
    category: 'Marketing',
    language: 'en_US',
    body_text: '🔑 Carry Your Memories Everywhere! 1 Photo Keychain @ ₹149 | Combo of 5 Keychains @ only ₹299! ✨ Send your favorite photos to get started.',
    footer_text: 'Pratap Store Custom Prints',
    buttons: [
      { type: 'QUICK_REPLY', text: 'Order Keychain' }
    ],
    status: 'APPROVED'
  },
  {
    name: 'magic_mug_promo',
    category: 'Marketing',
    language: 'en_US',
    body_text: '☕ Pour Hot Coffee & Reveal Your Photo! 🪄 Magic Photo Mug now available for ₹{{1}}. The best surprise gift for birthdays & anniversaries!',
    footer_text: 'Premium Ceramic Prints',
    buttons: [
      { type: 'QUICK_REPLY', text: 'Order Magic Mug' }
    ],
    status: 'APPROVED',
    sample_values: { body_text: ['349'] }
  },
  {
    name: 'cushion_gift_pack',
    category: 'Marketing',
    language: 'en_US',
    body_text: '🛋️ Personalized Photo Cushions! High-definition print with ultra-soft filling. Special price ₹{{1}} only. Reply with *PHOTO* to preview!',
    footer_text: 'Gifts That Touch Hearts',
    status: 'APPROVED',
    sample_values: { body_text: ['399'] }
  },
  {
    name: 'abandoned_cart_reminder',
    category: 'Marketing',
    language: 'en_US',
    body_text: 'Hi {{1}}, did you leave something behind? 👀 Your customized items in cart are waiting for you! Complete your order today and get an extra 10% OFF with code *SAVE10*.',
    footer_text: 'Valid for 24 hours only',
    buttons: [
      { type: 'QUICK_REPLY', text: 'Complete Order' },
      { type: 'QUICK_REPLY', text: 'Clear Cart' }
    ],
    status: 'APPROVED',
    sample_values: { body_text: ['Anjali'] }
  },
  {
    name: 'festival_special_sale',
    category: 'Marketing',
    language: 'en_US',
    body_text: '🎉 Festive Season Mega Sale! Enjoy FLAT {{1}}% OFF on all custom gifts & apparel. Use coupon code *{{2}}* at checkout. Hurry, offer valid till stocks last!',
    footer_text: 'Celebrate with Pratap Store',
    buttons: [
      { type: 'QUICK_REPLY', text: 'Claim Discount' }
    ],
    status: 'APPROVED',
    sample_values: { body_text: ['20', 'FESTIVE20'] }
  },
  {
    name: 'support_ticket_created',
    category: 'Utility',
    language: 'en_US',
    body_text: 'Hello {{1}}, support ticket #{{2}} has been opened for: \'{{3}}\'. Our team is reviewing it and will get back to you shortly. Average response time: < 30 mins.',
    footer_text: 'Customer Happiness Team',
    status: 'APPROVED',
    sample_values: { body_text: ['Deepak', 'TK-402', 'Print inquiry'] }
  },
  {
    name: 'support_ticket_resolved',
    category: 'Utility',
    language: 'en_US',
    body_text: 'Hi {{1}}, your support inquiry #{{2}} has been marked as resolved. If you still have questions, simply reply to this message. We are happy to help!',
    footer_text: 'Pratap Store Support',
    status: 'APPROVED',
    sample_values: { body_text: ['Deepak', 'TK-402'] }
  },
  {
    name: 'feedback_review_request',
    category: 'Marketing',
    language: 'en_US',
    body_text: 'Namaste {{1}}, thank you for choosing Pratap Store! ⭐ How was your experience with our product and print quality? Your feedback helps us improve.',
    footer_text: 'Your review means the world to us',
    buttons: [
      { type: 'QUICK_REPLY', text: '⭐⭐⭐⭐⭐ Excellent' },
      { type: 'QUICK_REPLY', text: 'Need Help' }
    ],
    status: 'APPROVED',
    sample_values: { body_text: ['Pooja'] }
  },
  {
    name: 'bulk_order_quote',
    category: 'Utility',
    language: 'en_US',
    body_text: 'Hi {{1}}, thank you for your bulk inquiry for {{2}} units of {{3}}. We have generated a custom wholesale quotation with special discounted rates: ₹{{4}} per piece.',
    footer_text: 'Wholesale & Corporate Gifting',
    buttons: [
      { type: 'QUICK_REPLY', text: 'Accept Quotation' },
      { type: 'QUICK_REPLY', text: 'Talk to Manager' }
    ],
    status: 'APPROVED',
    sample_values: { body_text: ['Suresh', '50', 'Custom Mugs', '180'] }
  },
  {
    name: 'return_replacement_update',
    category: 'Utility',
    language: 'en_US',
    body_text: 'Hello {{1}}, update on your replacement request for order #{{2}}: {{3}}. Your replacement parcel will be dispatched within 24 hours. Tracking will be shared soon.',
    footer_text: '100% Satisfaction Guarantee',
    status: 'APPROVED',
    sample_values: { body_text: ['Karan', 'ORD-1011', 'Approved'] }
  },
  {
    name: 'store_location_visiting',
    category: 'Utility',
    language: 'en_US',
    body_text: 'Hi {{1}}, here is our store location details: 📍 Pratap Store, Main Road Market. Open 7 days: 10:00 AM to 9:00 PM. We look forward to seeing you!',
    footer_text: 'Visit Us In Store',
    buttons: [
      { type: 'QUICK_REPLY', text: 'Open in Maps' }
    ],
    status: 'APPROVED',
    sample_values: { body_text: ['Friend'] }
  },
  {
    name: 'reengagement_we_miss_you',
    category: 'Marketing',
    language: 'en_US',
    body_text: 'We miss you, {{1}}! ❤️ It has been a while since your last order. Here is a special ₹{{2}} voucher code *WELCOMEBACK* just for you. Valid on any purchase!',
    footer_text: 'Pratap Store Family',
    buttons: [
      { type: 'QUICK_REPLY', text: 'Shop New Arrivals' }
    ],
    status: 'APPROVED',
    sample_values: { body_text: ['Meha', '100'] }
  }
];

export const AUTOMATIONS = [
  {
    name: 'Greetings & Welcome Auto-Reply',
    description: 'Instant welcome greeting when customer says hi, hello, namaste, start',
    keywords: ['hi', 'hello', 'hey', 'namaste', 'start', 'shuru', 'hlo', 'hii', 'hy'],
    replyText: '🙏 *Namaste & Welcome to Pratap Store!* 🎉\n\nHum provide karte hain premium customized prints:\n▪️ Customized Photo Keychains\n▪️ Custom T-Shirts (Round & Collar Neck)\n▪️ Magic & Ceramic Photo Mugs\n▪️ Custom Photo Cushions\n\n📌 *Quick Navigation:*\nType *MENU* — View full product menu\nType *PRICE* — Check price list\nType *OFFER* — Today\'s discounts\nType *SUPPORT* — Talk to an agent'
  },
  {
    name: 'Price & Rate List Auto-Reply',
    description: 'Instant price list for all custom items when customer asks rate or price',
    keywords: ['price', 'rate', 'cost', 'charges', 'kitna', 'daam', 'price list', 'kya rate hai'],
    replyText: '💰 *Pratap Store — Best Price List* 💰\n\n🔑 *Photo Keychains:*\n▪️ 1 Piece: ₹149\n▪️ Combo of 5: ₹299 (Bestseller!)\n\n👕 *Custom T-Shirts:*\n▪️ Round Neck Custom: ₹299\n▪️ Collar Polo T-Shirt: ₹349\n\n☕ *Photo Mugs:*\n▪️ White Ceramic Mug: ₹249\n▪️ Magic Heat Reveal Mug: ₹349\n\n🛋️ *Photo Cushion:* ₹399\n\n✨ All prices include high-definition printing!\nReply with product name to order.'
  },
  {
    name: 'Product Catalog & Designs Auto-Reply',
    description: 'Shows full product collection when customer asks for catalog or items',
    keywords: ['catalog', 'catalogue', 'products', 'items', 'designs', 'collection', 'saman', 'kya kya hai'],
    replyText: '📦 *Pratap Store Product Collection* ✨\n\n1️⃣ *Custom Keychains:* Acrylic & Wooden Photo Keychains\n2️⃣ *Apparel:* Custom Printed T-Shirts (Sizes S to XXL)\n3️⃣ *Drinkware:* Magic Mugs, Coffee Mugs\n4️⃣ *Home Decor:* Photo Cushions, Photo Frames\n\n👉 Type *MENU* to browse interactive menu or send your photo to check sample preview!'
  },
  {
    name: 'Order Status & Tracking Auto-Reply',
    description: 'Helps customer track their parcel by order number or mobile',
    keywords: ['track', 'order status', 'kahan hai', 'tracking', 'mera order', 'status', 'order update'],
    replyText: '🔍 *Order Tracking Status* 📦\n\nApna order track karne ke liye kripya apna *Order ID* ya *Registered Mobile Number* yahan share karein.\n\nHamari team turant aapka current shipping & dispatch status check karke reply karegi!\n\nStandard Delivery Time: 3 to 5 working days.'
  },
  {
    name: 'Payment Details & UPI Auto-Reply',
    description: 'Instant official UPI ID and QR payment instructions',
    keywords: ['payment', 'pay', 'upi', 'gpay', 'phonepe', 'paytm', 'bank', 'account details', 'qr', 'paise'],
    replyText: '💳 *Official Payment Details — Pratap Store*\n\nAap kisi bhi UPI App se payment kar sakte hain:\n\n🔹 *UPI ID:* `pratapstore@upi`\n🔹 *Google Pay / PhonePe / Paytm:* `8001080776`\n\n✅ Payment complete hone ke baad transaction ka *Screenshot* yahan WhatsApp par bhein. Payment verify hote hi printing start ho jayegi!'
  },
  {
    name: 'Store Location & Address Auto-Reply',
    description: 'Physical store location, landmark, and visit details',
    keywords: ['location', 'address', 'shop', 'store', 'pata', 'kahan par hai', 'dukan', 'store location'],
    replyText: '📍 *Pratap Store Address & Location:*\n\nPratap Store Prints & Customized Gifts\nMain Market Road, Near Central Plaza\n\n🕒 *Timing:* 10:00 AM – 9:00 PM (Monday to Sunday)\n📞 *Contact:* +91 80010 80776\n\nAap store visit karke live prints preview bhi dekh sakte hain!'
  },
  {
    name: 'Store Timings & Working Hours Auto-Reply',
    description: 'Opening and closing hours for store and online support',
    keywords: ['timing', 'hours', 'open', 'close', 'kab khulega', 'time', 'working hours', 'kitne baje'],
    replyText: '⏰ *Working Hours — Pratap Store*\n\n🗓️ *Days:* Monday to Sunday (Open all 7 days)\n🕙 *Opening Time:* 10:00 AM\n🕘 *Closing Time:* 09:00 PM\n\n🌐 WhatsApp Online Orders are accepted 24/7! Feel free to drop your requirements anytime.'
  },
  {
    name: 'Discounts & Offers Auto-Reply',
    description: 'Current coupon codes and promotional deals',
    keywords: ['offer', 'discount', 'coupon', 'promo', 'deal', 'chhoot', 'sale', 'discount code'],
    replyText: '🎁 *Today\'s Exclusive Offers at Pratap Store!* 🎉\n\n🔥 *Offer 1:* 5 Photo Keychains @ ₹299 (Save ₹446!)\n🔥 *Offer 2:* Buy 2 T-Shirts & Get ₹100 FLAT Discount! Coupon: *TSHIRT100*\n🔥 *Offer 3:* Free Shipping on all orders above ₹499!\n\nReply with your order to claim these discounts now!'
  },
  {
    name: 'Custom Photo Keychains Auto-Reply',
    description: 'Features, combos, and ordering instructions for keychains',
    keywords: ['keychain', 'keychains', 'photo keychain', 'chabi', 'keyring'],
    replyText: '🔑 *Customized Photo Keychains — Pratap Store*\n\n✨ Features:\n▪️ Double-sided HD Photo Printing\n▪️ Scratch-proof acrylic protection\n▪️ Lightweight & durable metal ring\n\n💰 *Special Pricing:*\n▪️ 1 Piece – ₹149\n▪️ Combo of 5 – ₹299\n\n📸 Apni pasandida photo yahan send kijiye aur apna order book karein!'
  },
  {
    name: 'Custom T-Shirts Auto-Reply',
    description: 'Size guide, fabric, styles and pricing for custom printed apparel',
    keywords: ['tshirt', 't-shirt', 't-shirts', 'collar', 'round neck', 'print tshirt', 'tees'],
    replyText: '👕 *Custom Printed T-Shirts — Pratap Store*\n\n▪️ *Available Styles:* Round Neck & Collar Polo\n▪️ *Sizes:* S (38), M (40), L (42), XL (44), XXL (46)\n▪️ *Fabric:* 100% Premium Breathable Cotton & Polyester\n▪️ *Printing:* YouTube / Instagram Logo, Photos, Custom Text\n\n💰 Price: Starts at just ₹299!\nSend your size and design to get started.'
  },
  {
    name: 'Magic Mug & Coffee Mug Auto-Reply',
    description: 'Magic heat reveal mugs and white ceramic mugs explanation',
    keywords: ['mug', 'cup', 'magic mug', 'coffee mug', 'photo mug'],
    replyText: '☕ *Personalized Photo & Magic Mugs!* 🪄\n\n✨ *Magic Mug (₹349):* Black mug jo hot coffee/chai dalte hi aapki photo reveal karta hai!\n✨ *White Ceramic Mug (₹249):* Classic HD glossy photo print mug.\n\n▪️ Microwave & Dishwasher Safe\n▪️ Best Gift for Birthday / Anniversary\n\nPhoto bhej kar preview dekhein!'
  },
  {
    name: 'Photo Cushions & Pillows Auto-Reply',
    description: 'Custom photo cushions sizes, material, and price',
    keywords: ['cushion', 'pillow', 'photo cushion', 'takiya'],
    replyText: '🛋️ *Personalized Photo Cushions — Pratap Store*\n\n✨ Soft velvet feel with fluffy inner filling.\n✨ Washable cover with concealed zipper.\n✨ Size: 12x12 & 16x16 inches available.\n💰 Price: Only ₹399!\n\nLoved ones ko gift karne ke liye perfect choice. Photo send karein!'
  },
  {
    name: 'Delivery Time & Courier Info Auto-Reply',
    description: 'Dispatch timeline and estimated courier delivery days',
    keywords: ['delivery', 'shipping', 'kab aayega', 'delivery time', 'how many days', 'kitne din', 'courier'],
    replyText: '🚚 *Shipping & Delivery Information*\n\n⚡ *Order Processing:* 24-48 hours (Printing & Quality Check)\n📦 *Courier Delivery:* 2 to 4 working days\n📍 All India courier delivery available with live tracking!\n\nUrgent / Same-day dispatch bhi available hai for select locations.'
  },
  {
    name: 'Cash on Delivery (COD) Policy Auto-Reply',
    description: 'Explains COD terms and advance token booking',
    keywords: ['cod', 'cash on delivery', 'pay on delivery', 'delivery par payment'],
    replyText: '📦 *Cash on Delivery (COD) Policy*\n\nCustomized products me photo printing hone ki wajah se ₹99 advance token amount required hota hai to confirm order, baaki balance amount aap delivery ke waqt de sakte hain!\n\n100% Prepaid orders par *Free Shipping* aur priority dispatch milta hai. ✅'
  },
  {
    name: 'Return & Replacement Guarantee Auto-Reply',
    description: 'Damage replacement and unboxing video guideline',
    keywords: ['return', 'refund', 'replacement', 'wapas', 'exchange', 'damaged'],
    replyText: '🛡️ *100% Quality & Replacement Guarantee*\n\nAgar product transit me damage hota hai ya printing defect hoti hai, toh hum *Free Replacement* provide karte hain!\n\nSirf parcel open karte waqt ka ek short *Unboxing Video* humare WhatsApp par share karein. Hamari team 24 ghante me replacement issue kar degi.'
  },
  {
    name: 'Bulk Orders & Wholesale Auto-Reply',
    description: 'Discounts and quotations for large quantity orders',
    keywords: ['bulk', 'wholesale', 'badi quantity', 'reseller', 'bulk order', 'corporate'],
    replyText: '🏢 *Bulk Orders & Corporate Gifting — Pratap Store*\n\nAgar aap school, college fest, corporate event ya business ke liye 20+ pieces order karna chahte hain, toh hum dete hain *Wholesale Rates*!\n\nKripya quantity aur product details batayein, hum turant custom quotation share karenge.'
  },
  {
    name: 'Human Agent & Live Support Auto-Reply',
    description: 'Connects customer with a human representative or call',
    keywords: ['agent', 'human', 'baat karni hai', 'call', 'support person', 'owner', 'help', 'madad'],
    replyText: '👤 *Customer Support Desk — Pratap Store*\n\nHamara customer executive aapse jud raha hai. Kripya apna prashna ya query yahan likh kar bhein.\n\n🕒 *Calling Support:* +91 80010 80776\nAverage chat response time: 5 to 10 minutes.'
  },
  {
    name: 'Thank You & Appreciation Auto-Reply',
    description: 'Polite thank you response for satisfied customers',
    keywords: ['thank you', 'thanks', 'dhanyawad', 'shukriya', 'thx'],
    replyText: '🙏 *Aapka Bahut Bahut Dhanyawad!* ❤️\n\nPratap Store ko choose karne ke liye shukriya. Agar aapko koi aur sahayata chahiye toh kabhi bhi message karein.\n\nHave a wonderful day ahead! ✨'
  },
  {
    name: 'Social Media Channels Auto-Reply',
    description: 'Links to YouTube, Instagram, and community',
    keywords: ['instagram', 'youtube', 'facebook', 'website', 'channel', 'social', 'page'],
    replyText: '📱 *Connect with Pratap Store Online!*\n\nStay updated with our latest designs & video previews:\n\n🎥 *YouTube Channel:* Search \'Pratap Store\'\n📸 *Instagram:* Follow @pratapstore_prints\n\nFollow us for exclusive discounts and daily giveaways! 🎁'
  },
  {
    name: 'Urgent & Priority Help Auto-Reply',
    description: 'Direct emergency hotline for urgent orders and deliveries',
    keywords: ['urgent', 'emergency', 'jaldi', 'asap', 'fast delivery'],
    replyText: '🚨 *Priority Urgent Assistance*\n\nHamne aapki query ko *HIGH PRIORITY* mark kar diya hai. Agar urgent delivery chahiye toh direct call karein:\n\n📞 *Call Now:* +91 80010 80776\n\nHamari team turant call attend karegi!'
  }
];
