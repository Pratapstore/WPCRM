const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// read .env.local manually
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

async function checkFlows() {
  const { data: flows, error: flowsErr } = await supabase
    .from('flows')
    .select('id, name, status, trigger_type, trigger_config, updated_at, account_id');

  if (flowsErr) {
    console.error('Error fetching flows:', flowsErr);
    return;
  }

  console.log('Total flows:', flows.length);
  for (const f of flows) {
    console.log(`Flow: [${f.id}] "${f.name}" | Status: ${f.status} | Trigger: ${f.trigger_type}`);
    console.log(`   Config:`, JSON.stringify(f.trigger_config));
    
    const { data: nodes } = await supabase.from('flow_nodes').select('id, node_key, node_type, config').eq('flow_id', f.id);
    const { data: edges } = await supabase.from('flow_edges').select('id, source_node_key, target_node_key, source_handle').eq('flow_id', f.id);
    
    console.log(`   Nodes (${nodes ? nodes.length : 0}):`, nodes ? nodes.map(n => `${n.node_key} (${n.node_type})`).join(', ') : 'none');
    console.log(`   Edges (${edges ? edges.length : 0}):`, edges ? edges.map(e => `${e.source_node_key} -> ${e.target_node_key}${e.source_handle ? ' [' + e.source_handle + ']' : ''}`).join(', ') : 'none');
  }

  console.log('\n--- Recent Flow Runs ---');
  const { data: runs, error: runsErr } = await supabase
    .from('flow_runs')
    .select('id, flow_id, status, error, current_node_id, context, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  if (runs && runs.length > 0) {
    runs.forEach(r => {
      console.log(`Run [${r.id}] Flow: ${r.flow_id} | Status: ${r.status} | Error: ${r.error} | Created: ${r.created_at}`);
      if (r.error) {
        console.log(`   Error details:`, r.error);
      }
    });
  } else {
    console.log('No recent flow runs found.');
  }
}

checkFlows();

