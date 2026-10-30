const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, '');
});
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function cleanAllStuckRuns() {
  // 1. Reset any active order sessions
  const { data: sData } = await supabase
    .from('order_sessions')
    .update({ state: 'IDLE' })
    .neq('state', 'IDLE')
    .select();
  console.log(`Reset ${sData ? sData.length : 0} order sessions.`);

  // 2. Cancel any pending or stuck flow runs so customer starts fresh
  const { data: rData } = await supabase
    .from('flow_runs')
    .update({ status: 'completed', end_reason: 'manual_reset', ended_at: new Date().toISOString() })
    .eq('status', 'active')
    .select();
  console.log(`Closed ${rData ? rData.length : 0} active flow runs.`);
}

cleanAllStuckRuns();
