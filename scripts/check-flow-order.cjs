const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, '');
});
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function checkBoth() {
  const { data: flows } = await supabase.from('flows').select('id, name, status, created_at, updated_at, trigger_config');
  flows.forEach(f => {
    console.log(`[${f.id}] "${f.name}" | Status: ${f.status} | Created: ${f.created_at}`);
  });
}
checkBoth();

