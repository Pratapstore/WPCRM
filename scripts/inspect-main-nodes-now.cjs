const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, '');
});
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function inspectNodes() {
  const flowId = '99e55432-bcfe-44f4-acfd-a62484838ce1';
  const { data: flow } = await supabase.from('flows').select('*').eq('id', flowId).single();
  console.log('Flow Name:', flow.name, '| entry_node_id:', flow.entry_node_id);
  console.log('Trigger config:', JSON.stringify(flow.trigger_config));

  const { data: nodes } = await supabase.from('flow_nodes').select('id, node_key, node_type, config').eq('flow_id', flowId);
  console.log(`\nFound ${nodes.length} nodes:`);
  nodes.forEach(n => {
    if (n.node_key.includes('main')) {
      console.log(`==> Node [${n.node_key}] (${n.node_type}):`, JSON.stringify(n.config));
    } else {
      console.log(`Node [${n.node_key}] (${n.node_type})`);
    }
  });

  // Also let's inspect the message content of the messages sent in that run
  const { data: recentMsgs } = await supabase
    .from('messages')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  console.log('\n=== REAL MESSAGES FROM MESSAGES TABLE ===');
  recentMsgs.forEach(m => {
    console.log(`[${m.created_at}] [${m.sender_type}] ${m.content_text}`);
  });
}

inspectNodes();
