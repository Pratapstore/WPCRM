const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, '');
});
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function validateMetaLimits() {
  const flowId = '99e55432-bcfe-44f4-acfd-a62484838ce1';
  const { data: nodes } = await supabase.from('flow_nodes').select('*').eq('flow_id', flowId);

  let errors = [];

  for (const n of nodes) {
    const c = n.config || {};
    if (n.node_type === 'send_list') {
      if (c.button_label && c.button_label.length > 20) {
        errors.push(`Node [${n.node_key}] button_label '${c.button_label}' is ${c.button_label.length} > 20 chars`);
      }
      if (c.header_text && c.header_text.length > 60) {
        errors.push(`Node [${n.node_key}] header_text is ${c.header_text.length} > 60 chars`);
      }
      if (c.footer_text && c.footer_text.length > 60) {
        errors.push(`Node [${n.node_key}] footer_text is ${c.footer_text.length} > 60 chars`);
      }
      let totalRows = 0;
      if (c.sections) {
        c.sections.forEach((s, sIdx) => {
          if (s.title && s.title.length > 24) {
            errors.push(`Node [${n.node_key}] section[${sIdx}] title '${s.title}' is ${s.title.length} > 24 chars`);
          }
          if (s.rows) {
            totalRows += s.rows.length;
            s.rows.forEach((r, rIdx) => {
              if (r.title && r.title.length > 24) {
                errors.push(`Node [${n.node_key}] row title '${r.title}' is ${r.title.length} > 24 chars`);
              }
              if (r.description && r.description.length > 72) {
                errors.push(`Node [${n.node_key}] row description '${r.description}' is ${r.description.length} > 72 chars`);
              }
              if (r.reply_id && r.reply_id.length > 200) {
                errors.push(`Node [${n.node_key}] row reply_id is > 200 chars`);
              }
            });
          }
        });
      }
      if (totalRows > 10) {
        errors.push(`Node [${n.node_key}] total rows ${totalRows} > 10 (Meta limit)`);
      }
    }

    if (n.node_type === 'send_buttons') {
      if (c.buttons) {
        if (c.buttons.length > 3) {
          errors.push(`Node [${n.node_key}] buttons count ${c.buttons.length} > 3`);
        }
        c.buttons.forEach((b, bIdx) => {
          if (b.title && b.title.length > 20) {
            errors.push(`Node [${n.node_key}] button[${bIdx}] title '${b.title}' is ${b.title.length} > 20 chars`);
          }
        });
      }
    }
  }

  console.log('=== Meta API Limits Violations in Main Flow ===');
  if (errors.length === 0) {
    console.log('✅ All nodes in Main flow strictly comply with Meta limits!');
  } else {
    errors.forEach(e => console.log('❌', e));
  }
}

validateMetaLimits();

