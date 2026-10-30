const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, '');
});
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function checkAllFlows() {
  const { data: flows } = await supabase.from('flows').select('*');
  console.log(`Checking ${flows.length} flows...`);

  for (const f of flows) {
    console.log(`\n========================================`);
    console.log(`Flow: "${f.name}" [${f.id}] | Status: ${f.status} | Trigger: ${f.trigger_type}`);
    console.log(`Config:`, JSON.stringify(f.trigger_config));
    console.log(`Entry node:`, f.entry_node_id);

    const { data: nodes } = await supabase.from('flow_nodes').select('*').eq('flow_id', f.id);
    if (!nodes || nodes.length === 0) {
      console.log(`⚠️ Flow has NO nodes!`);
      continue;
    }

    const nodeMap = new Map();
    nodes.forEach(n => nodeMap.set(n.node_key, n));

    if (f.entry_node_id && !nodeMap.has(f.entry_node_id)) {
      console.log(`❌ ERROR: Entry node '${f.entry_node_id}' does not exist in flow!`);
    }

    let broken = [];
    nodes.forEach(n => {
      const c = n.config || {};
      if (c.next_node_key && !nodeMap.has(c.next_node_key)) {
        broken.push(`${n.node_key} -> ${c.next_node_key}`);
      }
      if (c.buttons) {
        c.buttons.forEach(b => {
          if (b.next_node_key && !nodeMap.has(b.next_node_key)) {
            broken.push(`${n.node_key} [btn: ${b.title}] -> ${b.next_node_key}`);
          }
        });
      }
      if (c.sections) {
        c.sections.forEach(s => {
          if (s.rows) {
            s.rows.forEach(r => {
              if (r.next_node_key && !nodeMap.has(r.next_node_key)) {
                broken.push(`${n.node_key} [row: ${r.title}] -> ${r.next_node_key}`);
              }
            });
          }
        });
      }
    });

    if (broken.length > 0) {
      console.log(`❌ ${broken.length} broken links:`, broken);
    } else {
      console.log(`✅ All ${nodes.length} nodes are correctly linked.`);
    }
  }
}

checkAllFlows();

