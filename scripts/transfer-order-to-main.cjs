const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const MAIN_FLOW_ID = '99e55432-bcfe-44f4-acfd-a62484838ce1';
const ORDER_FLOW_ID = '93fecb50-7fc4-42f6-a745-683471c2a6d6';

async function transfer() {
  console.log('--- Starting Flow Transfer to Main ---');

  // 1. Fetch nodes from Order Collection flow
  const { data: orderNodes, error: orderErr } = await db
    .from('flow_nodes')
    .select('node_key, node_type, config')
    .eq('flow_id', ORDER_FLOW_ID);

  if (orderErr || !orderNodes) {
    console.error('Failed to load order flow nodes:', orderErr);
    process.exit(1);
  }

  console.log(`Found ${orderNodes.length} nodes from Order Collection flow.`);

  // 2. Filter out 'start' node since Main already has its entry point
  const nodesToTransfer = orderNodes.filter((n) => n.node_key !== 'start');

  // 3. Delete any previously transferred nodes in Main if they exist
  const nodeKeys = nodesToTransfer.map((n) => n.node_key);
  await db
    .from('flow_nodes')
    .delete()
    .eq('flow_id', MAIN_FLOW_ID)
    .in('node_key', nodeKeys);

  // 4. Insert nodes into Main flow
  const newNodesPayload = nodesToTransfer.map((n) => ({
    flow_id: MAIN_FLOW_ID,
    node_key: n.node_key,
    node_type: n.node_type,
    config: n.config,
  }));

  const { error: insertErr } = await db.from('flow_nodes').insert(newNodesPayload);
  if (insertErr) {
    console.error('Failed to insert nodes into Main flow:', insertErr);
    process.exit(1);
  }
  console.log(`Successfully transferred ${newNodesPayload.length} nodes into Main flow!`);

  // 5. Update send_list (Main Menu) in Main flow to feature Quick Order at the top
  const { data: sendListNode } = await db
    .from('flow_nodes')
    .select('id, config')
    .eq('flow_id', MAIN_FLOW_ID)
    .eq('node_key', 'send_list')
    .single();

  if (sendListNode) {
    const updatedConfig = {
      header_text: 'Pratap Store • Official Store',
      text: '🛍️ Welcome to Pratap Store\n🎨 YOUR IDEAS, OUR PRINTS!\n\nYour Personalized Printing & Gifting Partner.\n\nApne favourite products ko apne naam, photo, logo ya custom design ke saath personalize karein!',
      button_label: 'Main Menu',
      footer_text: 'Please select an option below:',
      sections: [
        {
          title: 'Order & Catalog',
          rows: [
            {
              reply_id: 'quick_order',
              title: '🛍️ Quick Order (Auto)',
              description: 'Instant A-Z Order with Size, Address & Checkout',
              next_node_key: 'catalog_menu',
            },
            {
              reply_id: 'row_1',
              title: 'View Products Catalog',
              description: 'Browse T-shirts, Mugs, Cushions, Keychains',
              next_node_key: 'send_list_2',
            },
          ],
        },
        {
          title: 'Help & Support',
          rows: [
            {
              reply_id: 'row_2',
              title: 'Talk to Support',
              description: 'Connect with our team for questions',
              next_node_key: 'support_handoff',
            },
          ],
        },
      ],
    };

    await db
      .from('flow_nodes')
      .update({ config: updatedConfig })
      .eq('id', sendListNode.id);

    console.log('Updated Main Menu (send_list) with Quick Order option!');
  }

  // 6. Connect "Order Now" in product details (send_buttons) to catalog_menu / apparel_size
  const { data: sendButtonsNode } = await db
    .from('flow_nodes')
    .select('id, config')
    .eq('flow_id', MAIN_FLOW_ID)
    .eq('node_key', 'send_buttons')
    .single();

  if (sendButtonsNode) {
    const btnCfg = sendButtonsNode.config;
    if (btnCfg.buttons && btnCfg.buttons[0]) {
      btnCfg.buttons[0].next_node_key = 'catalog_menu';
      await db
        .from('flow_nodes')
        .update({ config: btnCfg })
        .eq('id', sendButtonsNode.id);
      console.log('Connected send_buttons (Order Now) to catalog_menu!');
    }
  }

  // 7. Update Main flow's keywords and description
  const allKeywords = [
    'order',
    'buy',
    'shop',
    'price',
    'catalog',
    'pratap',
    'keychain',
    'tshirt',
    'mug',
    'suit',
    'main',
    'menu',
    'hi',
    'hello',
    'hey',
    'start',
    'namaste',
    '0',
    '*',
    '#',
    'mainmenu',
  ];

  await db
    .from('flows')
    .update({
      description: 'All-in-One Store Flow: Welcome Menu, Product Gallery, Interactive A-Z Order Collection (Catalog, Sizes, Customer Name, Address, Pincode) & Automated Checkout.',
      trigger_type: 'keyword',
      trigger_config: { keywords: allKeywords, match_type: 'contains' },
      status: 'active',
    })
    .eq('id', MAIN_FLOW_ID);

  console.log('Updated Main flow trigger keywords!');

  // 8. Set separate Order Collection flow to draft so there are no trigger collisions
  await db
    .from('flows')
    .update({ status: 'draft' })
    .eq('id', ORDER_FLOW_ID);

  console.log('Set separate Order Collection flow to draft.');
  console.log('--- Transfer Complete! ---');
}

transfer()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Transfer failed:', err);
    process.exit(1);
  });
