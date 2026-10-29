const { createClient } = require('@supabase/supabase-js');

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const USER_ID = '7078fc41-0264-4b9f-a9a1-41b67f624d44';
const ACCOUNT_ID = '842c3d98-69ad-4661-abe1-d53629a5bdb1';

async function main() {
  // Check if already exists
  const { data: existing } = await db
    .from('flows')
    .select('id, name')
    .eq('account_id', ACCOUNT_ID)
    .ilike('name', '%Order Collection%')
    .maybeSingle();

  if (existing) {
    console.log('Order Collection Flow already exists:', existing.id);
    return;
  }

  // Insert flow
  const { data: flow, error: flowErr } = await db
    .from('flows')
    .insert({
      user_id: USER_ID,
      account_id: ACCOUNT_ID,
      name: '🛍️ Order Collection & Auto-Checkout',
      description: 'Automated A to Z Order Flow: Interactive Product Catalog List, Size/Variant Buttons, Customer Details Auto-Capture (Name, Address, Pincode), and UPI/COD Checkout.',
      status: 'active',
      trigger_type: 'keyword',
      trigger_config: {
        keywords: ['order', 'buy', 'shop', 'price', 'catalog', 'pratap', 'keychain', 'tshirt', 'suit'],
        match_type: 'contains',
      },
      entry_node_id: 'start',
    })
    .select()
    .single();

  if (flowErr) {
    console.error('Error inserting flow:', flowErr);
    process.exit(1);
  }

  console.log('Created flow:', flow.id);

  // Nodes definition
  const nodes = [
    {
      flow_id: flow.id,
      node_key: 'start',
      node_type: 'start',
      config: { next_node_key: 'catalog_menu' },
    },
    {
      flow_id: flow.id,
      node_key: 'catalog_menu',
      node_type: 'send_list',
      config: {
        header_text: 'Pratap Store • Official Store',
        text: 'Namaste! Welcome to Pratap Store 🙏✨ Please select your favorite product from our catalog below to begin your personalized order:',
        button_label: 'Browse Catalog 🛍️',
        sections: [
          {
            title: 'Personalized Photo Gifts',
            rows: [
              {
                reply_id: 'prod_keychain',
                title: 'Acrylic Photo Keychain',
                description: 'HD Clear acrylic with Spotify QR - ₹199',
                next_node_key: 'gift_variant',
              },
              {
                reply_id: 'prod_mug',
                title: 'Magic Color Photo Mug',
                description: 'Heat-sensitive ceramic mug - ₹399',
                next_node_key: 'gift_variant',
              },
              {
                reply_id: 'prod_frame',
                title: 'Wooden Photo Frame',
                description: 'Laser engraved pine wood - ₹599',
                next_node_key: 'gift_variant',
              },
            ],
          },
          {
            title: 'Apparel & Wearables',
            rows: [
              {
                reply_id: 'prod_tshirt',
                title: 'Printed Graphic T-Shirt',
                description: '100% Combed cotton with DTF - ₹499',
                next_node_key: 'apparel_size',
              },
              {
                reply_id: 'prod_hoodie',
                title: 'Custom Winter Hoodie',
                description: '350 GSM premium fleece - ₹899',
                next_node_key: 'apparel_size',
              },
            ],
          },
        ],
      },
    },
    {
      flow_id: flow.id,
      node_key: 'gift_variant',
      node_type: 'send_buttons',
      config: {
        header_text: 'Customization Style',
        text: 'Please select your customization style:',
        buttons: [
          {
            reply_id: 'single_photo',
            title: 'Single Side Photo',
            next_node_key: 'ask_customer_name',
          },
          {
            reply_id: 'double_photo',
            title: 'Double Side Photo',
            next_node_key: 'ask_customer_name',
          },
          {
            reply_id: 'spotify_code',
            title: 'Spotify Code + QR',
            next_node_key: 'ask_customer_name',
          },
        ],
      },
    },
    {
      flow_id: flow.id,
      node_key: 'apparel_size',
      node_type: 'send_buttons',
      config: {
        header_text: 'Choose Size',
        text: 'Please select your preferred Size for T-Shirt / Hoodie:',
        buttons: [
          {
            reply_id: 'size_s',
            title: 'Small (S - 36)',
            next_node_key: 'ask_customer_name',
          },
          {
            reply_id: 'size_m',
            title: 'Medium (M - 38)',
            next_node_key: 'ask_customer_name',
          },
          {
            reply_id: 'size_l',
            title: 'Large / XL (40-42)',
            next_node_key: 'ask_customer_name',
          },
        ],
      },
    },
    {
      flow_id: flow.id,
      node_key: 'ask_customer_name',
      node_type: 'collect_input',
      config: {
        prompt_text: 'Great choice! 🌟 What is your Full Name for courier delivery receipt?',
        var_key: 'customer_name',
        next_node_key: 'ask_shipping_address',
      },
    },
    {
      flow_id: flow.id,
      node_key: 'ask_shipping_address',
      node_type: 'collect_input',
      config: {
        prompt_text: 'Namaste {{vars.customer_name}}! 📍 Please send your Complete Delivery Address (House/Flat No, Building, Street, Landmark):',
        var_key: 'shipping_address',
        next_node_key: 'ask_pincode',
      },
    },
    {
      flow_id: flow.id,
      node_key: 'ask_pincode',
      node_type: 'collect_input',
      config: {
        prompt_text: 'Almost done! 📮 Please enter your 6-digit PIN Code & City for instant dispatch:',
        var_key: 'pincode',
        next_node_key: 'ask_payment_mode',
      },
    },
    {
      flow_id: flow.id,
      node_key: 'ask_payment_mode',
      node_type: 'send_buttons',
      config: {
        header_text: 'Payment Option',
        text: 'How would you like to pay for your order?\n\n🚚 Free Shipping on Prepaid UPI!\n⚡ Instant dispatch tracking provided.',
        buttons: [
          {
            reply_id: 'pay_upi',
            title: '💳 Pay Online',
            next_node_key: 'confirm_prepaid',
          },
          {
            reply_id: 'pay_cod',
            title: 'Cash on Delivery',
            next_node_key: 'confirm_cod',
          },
          {
            reply_id: 'pay_support',
            title: '💬 Agent Support',
            next_node_key: 'support_handoff',
          },
        ],
      },
    },
    {
      flow_id: flow.id,
      node_key: 'confirm_prepaid',
      node_type: 'send_message',
      config: {
        text: '🎉 *ORDER REGISTERED - PRATAP STORE*\n━━━━━━━━━━━━━━━━━━━━\n👤 *Customer:* {{vars.customer_name}}\n📍 *Delivery Address:* {{vars.shipping_address}}\n📮 *PIN Code:* {{vars.pincode}}\n\n💳 *Payment Mode:* Instant UPI (Zero Fees)\n📲 *Store UPI ID:* `pratapstore@jio`\n\n_Please send payment to `pratapstore@jio` to confirm priority dispatch! Your order is registered in our CRM._',
        next_node_key: 'order_handoff',
      },
    },
    {
      flow_id: flow.id,
      node_key: 'confirm_cod',
      node_type: 'send_message',
      config: {
        text: '✅ *ORDER CONFIRMED (COD) - PRATAP STORE*\n━━━━━━━━━━━━━━━━━━━━\n👤 *Customer:* {{vars.customer_name}}\n📍 *Delivery Address:* {{vars.shipping_address}}\n📮 *PIN Code:* {{vars.pincode}}\n🚚 *Payment:* Cash on delivery.\n\nOur team has received your order and will contact you shortly for dispatch confirmation. Thank you for shopping with Pratap Store 🙏',
        next_node_key: 'order_handoff',
      },
    },
    {
      flow_id: flow.id,
      node_key: 'order_handoff',
      node_type: 'handoff',
      config: {
        note: 'New WhatsApp Order: Customer={{vars.customer_name}}, Address={{vars.shipping_address}}, PIN={{vars.pincode}}.',
      },
    },
    {
      flow_id: flow.id,
      node_key: 'support_handoff',
      node_type: 'handoff',
      config: {
        note: 'Customer requested human support during order collection flow.',
      },
    },
  ];

  const { error: nodesErr } = await db.from('flow_nodes').insert(nodes);
  if (nodesErr) {
    console.error('Error inserting nodes:', nodesErr);
    process.exit(1);
  }

  console.log(`Successfully created flow with ${nodes.length} nodes!`);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
