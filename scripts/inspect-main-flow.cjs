const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    env[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, '');
  }
});

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

async function inspectMainFlow() {
  const { data: flow } = await supabase
    .from('flows')
    .select('*')
    .eq('id', '99e55432-bcfe-44f4-acfd-a62484838ce1')
    .single();

  console.log('Flow fields:', Object.keys(flow));
  console.log('Flow metadata/config:', {
    trigger_type: flow.trigger_type,
    trigger_config: flow.trigger_config,
    entry_node_id: flow.entry_node_id,
  });

  const { data: nodes } = await supabase
    .from('flow_nodes')
    .select('*')
    .eq('flow_id', flow.id);

  console.log('\n--- Flow Nodes details ---');
  nodes.forEach(n => {
    console.log(`Node [${n.node_key}] type: ${n.node_type}`);
    console.log('   config:', JSON.stringify(n.config));
  });

  const { data: edges } = await supabase
    .from('flow_edges')
    .select('*')
    .eq('flow_id', flow.id);

  console.log('\n--- Flow Edges ---', edges);
}

inspectMainFlow();

