const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, '');
});
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function checkUnderscores() {
  const flowId = '99e55432-bcfe-44f4-acfd-a62484838ce1';
  const { data: nodes } = await supabase.from('flow_nodes').select('node_key, config').eq('flow_id', flowId);

  const keys = new Set(nodes.map(n => n.node_key));
  console.log('All node keys in flow:', Array.from(keys));

  nodes.forEach(n => {
    const json = JSON.stringify(n.config);
    if (json.includes('main_menu')) {
      console.log(`Node [${n.node_key}] references 'main_menu'! Does 'main_menu' exist?`, keys.has('main_menu'));
    }
    if (json.includes('mainmenu')) {
      console.log(`Node [${n.node_key}] references 'mainmenu'! Does 'mainmenu' exist?`, keys.has('mainmenu'));
    }
  });
}

checkUnderscores();
