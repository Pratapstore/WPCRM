const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, '');
});
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function updateMainFlowTrigger() {
  const flowId = '99e55432-bcfe-44f4-acfd-a62484838ce1'; // Main flow

  const expandedKeywords = [
    'hi',
    'hello',
    'hey',
    'menu',
    'main menu',
    'start',
    'start menu',
    'mainmenu',
    'main',
    'namaste',
    'order',
    'order now',
    'catalog',
    'products',
    'pratap',
    'shop',
    'help',
    'support'
  ];

  const { data, error } = await supabase
    .from('flows')
    .update({
      trigger_type: 'keyword',
      trigger_config: {
        keywords: expandedKeywords,
        match_type: 'contains'
      },
      status: 'active',
      updated_at: new Date().toISOString()
    })
    .eq('id', flowId)
    .select()
    .single();

  if (error) {
    console.error('Error updating Main flow trigger:', error);
  } else {
    console.log('✅ Main flow trigger updated successfully!');
    console.log('Keywords:', data.trigger_config.keywords);
  }
}

updateMainFlowTrigger();

