const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, '');
});
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function testGraph() {
  const flowId = '99e55432-bcfe-44f4-acfd-a62484838ce1';
  const { data: flow } = await supabase.from('flows').select('*').eq('id', flowId).single();
  const { data: nodes } = await supabase.from('flow_nodes').select('*').eq('flow_id', flowId);

  console.log('=== FLOW:', flow.name, '===');
  console.log('Entry Node:', flow.entry_node_id);
  console.log('Trigger config:', JSON.stringify(flow.trigger_config));

  const nodeMap = new Map();
  nodes.forEach(n => nodeMap.set(n.node_key, n));

  // Check every node's targets to verify if any target node is missing
  let brokenTransitions = [];

  for (const n of nodes) {
    const cfg = n.config || {};
    console.log(`\nNode: [${n.node_key}] (${n.node_type})`);

    if (cfg.next_node_key) {
      const exists = nodeMap.has(cfg.next_node_key);
      console.log(`  -> next_node_key: ${cfg.next_node_key} (${exists ? 'OK' : 'BROKEN ❌'})`);
      if (!exists) brokenTransitions.push({ from: n.node_key, to: cfg.next_node_key });
    }

    if (cfg.buttons && Array.isArray(cfg.buttons)) {
      cfg.buttons.forEach((b, idx) => {
        const exists = nodeMap.has(b.next_node_key);
        console.log(`  Button [${b.title} / ${b.reply_id}] -> ${b.next_node_key} (${exists ? 'OK' : 'BROKEN ❌'})`);
        if (!exists) brokenTransitions.push({ from: n.node_key, button: b.title, to: b.next_node_key });
      });
    }

    if (cfg.sections && Array.isArray(cfg.sections)) {
      cfg.sections.forEach(sec => {
        if (sec.rows && Array.isArray(sec.rows)) {
          sec.rows.forEach(r => {
            const exists = nodeMap.has(r.next_node_key);
            console.log(`  List row [${r.title} / ${r.reply_id}] -> ${r.next_node_key} (${exists ? 'OK' : 'BROKEN ❌'})`);
            if (!exists) brokenTransitions.push({ from: n.node_key, row: r.title, to: r.next_node_key });
          });
        }
      });
    }

    // Check Meta API limits:
    // button_label max 20 chars
    if (n.node_type === 'send_list' && cfg.button_label && cfg.button_label.length > 20) {
      console.log(`  ⚠️ WARNING: button_label > 20 chars: "${cfg.button_label}" (${cfg.button_label.length} chars)`);
    }
    // button title max 20 chars
    if (cfg.buttons && Array.isArray(cfg.buttons)) {
      cfg.buttons.forEach(b => {
        if (b.title && b.title.length > 20) {
          console.log(`  ⚠️ WARNING: button title > 20 chars: "${b.title}" (${b.title.length} chars)`);
        }
      });
    }
    // list row title max 24 chars
    if (cfg.sections && Array.isArray(cfg.sections)) {
      cfg.sections.forEach(sec => {
        if (sec.rows && Array.isArray(sec.rows)) {
          sec.rows.forEach(r => {
            if (r.title && r.title.length > 24) {
              console.log(`  ⚠️ WARNING: row title > 24 chars: "${r.title}" (${r.title.length} chars)`);
            }
          });
        }
      });
    }
  }

  console.log('\n=== Summary of Broken Transitions ===');
  if (brokenTransitions.length === 0) {
    console.log('✅ No broken transitions found!');
  } else {
    console.log(`❌ Found ${brokenTransitions.length} broken transitions:`, JSON.stringify(brokenTransitions, null, 2));
  }
}

testGraph();

