const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, '');
});
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function inspectRecentActivity() {
  console.log('=== RECENT MESSAGES (Last 15) ===');
  const { data: messages, error: msgErr } = await supabase
    .from('messages')
    .select('id, conversation_id, sender_type, content_text, message_type, interactive_payload, status, error_details, created_at')
    .order('created_at', { ascending: false })
    .limit(15);

  if (messages) {
    messages.forEach(m => {
      console.log(`[${m.created_at}] [${m.sender_type}] (${m.message_type}): ${m.content_text?.slice(0, 100)}`);
      if (m.error_details) console.log(`   ERROR:`, JSON.stringify(m.error_details));
    });
  }

  console.log('\n=== RECENT FLOW RUNS (Last 10) ===');
  const { data: runs, error: runsErr } = await supabase
    .from('flow_runs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (runs) {
    runs.forEach(r => {
      console.log(`Run [${r.id}] Flow: ${r.flow_id} | Status: ${r.status} | EndReason: ${r.end_reason} | CurrentNode: ${r.current_node_key} | Created: ${r.created_at}`);
      console.log(`   Vars:`, JSON.stringify(r.vars));
    });
  }

  console.log('\n=== RECENT FLOW RUN EVENTS (Last 15) ===');
  const { data: events, error: evErr } = await supabase
    .from('flow_run_events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(15);

  if (events) {
    events.forEach(e => {
      console.log(`Event [${e.created_at}] Run: ${e.flow_run_id} | Type: ${e.event_type} | NodeKey: ${e.node_key} | Payload:`, JSON.stringify(e.payload));
    });
  }
}

inspectRecentActivity();
