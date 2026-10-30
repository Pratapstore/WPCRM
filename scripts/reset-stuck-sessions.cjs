const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, '');
});
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function resetStuckSessions() {
  const { data, error } = await supabase
    .from('order_sessions')
    .update({ state: 'IDLE' })
    .neq('state', 'IDLE')
    .select();

  if (error) {
    console.error('Error resetting sessions:', error);
  } else {
    console.log(`✅ Successfully reset ${data.length} stuck order session(s) to IDLE!`);
  }
}
resetStuckSessions();
