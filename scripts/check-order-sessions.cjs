const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, '');
});
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function checkSessions() {
  const { data, error } = await supabase.from('order_sessions').select('*');
  console.log('Total order sessions:', data ? data.length : 0);
  if (data) {
    data.forEach(s => {
      console.log(`Session [${s.id}] Contact: ${s.contact_id} | State: ${s.state} | Updated: ${s.updated_at}`);
    });
  }
}
checkSessions();
