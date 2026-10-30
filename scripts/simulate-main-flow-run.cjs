const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, '');
});
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function simulate() {
  const flowId = '99e55432-bcfe-44f4-acfd-a62484838ce1'; // Main flow
  const { data: flow } = await supabase.from('flows').select('*').eq('id', flowId).single();
  const { data: nodes } = await supabase.from('flow_nodes').select('*').eq('flow_id', flowId);

  const nodeMap = new Map();
  nodes.forEach(n => nodeMap.set(n.node_key, n));

  console.log(`Simulating Main Flow: "${flow.name}"`);
  console.log(`Starting at entry node: [${flow.entry_node_id}]`);

  // Path 1: User chooses "🛍️ Quick Order (Auto)" -> catalog_menu -> Acrylic Photo Keychain -> Single Side Photo -> Customer Name -> Phone -> Address -> Pincode -> Pay Online UPI -> confirm_prepaid -> order_handoff
  console.log('\n--- Testing Path 1 (Quick Order Path) ---');
  let curr = flow.entry_node_id;
  const mockVars = {
    customer_name: 'Rahul Sharma',
    customer_phone: '9876543210',
    shipping_address: 'Flat 402, Sunshine Apts, MG Road',
    pincode: '700001'
  };

  const steps = [
    { from: 'main_menu', choice: 'quick_order', desc: 'Clicked Quick Order' },
    { from: 'catalog_menu', choice: 'prod_keychain', desc: 'Clicked Acrylic Photo Keychain' },
    { from: 'gift_variant', choice: 'single_photo', desc: 'Clicked Single Side Photo' },
    { from: 'customer_name', input: mockVars.customer_name, desc: 'Typed Name' },
    { from: 'customer_phone_number', input: mockVars.customer_phone, desc: 'Typed Phone' },
    { from: 'customer_shipping_address', input: mockVars.shipping_address, desc: 'Typed Address' },
    { from: 'customer_pincode', input: mockVars.pincode, desc: 'Typed PIN Code' },
    { from: 'ask_payment_mode', choice: 'pay_upi', desc: 'Clicked Pay Online' },
    { from: 'confirm_prepaid', desc: 'Auto send confirmation message' },
    { from: 'order_handoff', desc: 'Order handoff to team' }
  ];

  let currentKey = flow.entry_node_id;
  for (const step of steps) {
    const node = nodeMap.get(currentKey);
    if (!node) {
      console.log(`❌ FAILED at ${currentKey}: node not found!`);
      break;
    }
    console.log(`✓ At [${node.node_key}] (${node.node_type}) - ${step.desc}`);

    if (node.node_type === 'send_list') {
      let target = null;
      node.config.sections.forEach(s => {
        s.rows.forEach(r => {
          if (r.reply_id === step.choice) target = r.next_node_key;
        });
      });
      if (!target) {
        console.log(`❌ Option '${step.choice}' not found in send_list rows!`);
        break;
      }
      currentKey = target;
    } else if (node.node_type === 'send_buttons') {
      let target = null;
      node.config.buttons.forEach(b => {
        if (b.reply_id === step.choice) target = b.next_node_key;
      });
      if (!target) {
        console.log(`❌ Button '${step.choice}' not found in send_buttons!`);
        break;
      }
      currentKey = target;
    } else if (node.node_type === 'collect_input' || node.node_type === 'send_message' || node.node_type === 'send_media') {
      currentKey = node.config.next_node_key;
    } else if (node.node_type === 'handoff') {
      console.log(`🎉 Successfully reached handoff node [${node.node_key}]! Path 1 completed!`);
      break;
    }
  }

  // Path 2: Products list -> T-shirts -> Round -> YouTube Round T-Shirt -> Media -> Order Now -> Size M -> Name...
  console.log('\n--- Testing Path 2 (Catalog Browse Path) ---');
  const path2Steps = [
    { from: 'main_menu', choice: 'row_1', desc: 'Clicked View Products List' },
    { from: 'products_category', choice: 'row_1', desc: 'Clicked T-shirts' },
    { from: 't_shirts_style', choice: 'row_1', desc: 'Clicked Round' },
    { from: 'round_t_shirts', choice: 'row_1', desc: 'Clicked YouTube Round T-Shirt' },
    { from: 'youtube_round_neck_t_shirt', desc: 'Sent T-Shirt Media Image' },
    { from: 'order_now', choice: 'yes', desc: 'Clicked Order Now' },
    { from: 't_shirt_size', choice: 'row_2', desc: 'Selected Size M - 38' },
    { from: 'customer_name', input: 'Amit', desc: 'Entered Name' }
  ];

  currentKey = flow.entry_node_id;
  for (const step of path2Steps) {
    const node = nodeMap.get(currentKey);
    if (!node) {
      console.log(`❌ FAILED at ${currentKey}: node not found!`);
      break;
    }
    console.log(`✓ At [${node.node_key}] (${node.node_type}) - ${step.desc}`);

    if (node.node_type === 'send_list') {
      let target = null;
      node.config.sections.forEach(s => {
        s.rows.forEach(r => {
          if (r.reply_id === step.choice) target = r.next_node_key;
        });
      });
      currentKey = target;
    } else if (node.node_type === 'send_buttons') {
      let target = null;
      node.config.buttons.forEach(b => {
        if (b.reply_id === step.choice) target = b.next_node_key;
      });
      currentKey = target;
    } else if (node.node_type === 'send_media') {
      currentKey = node.config.next_node_key;
    } else if (node.node_type === 'collect_input') {
      currentKey = node.config.next_node_key;
    }
  }
  console.log(`🎉 Path 2 reached [${currentKey}] cleanly!`);
}

simulate();

