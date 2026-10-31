import { NextResponse } from 'next/server';
import { getCurrentAccount } from '@/lib/auth/account';
import { decrypt } from '@/lib/whatsapp/encryption';

export async function GET() {
  try {
    const { supabase, accountId } = await getCurrentAccount();

    // Check if there are any PENDING templates with meta_template_id to update status
    const { data: pendingTemplates } = await supabase
      .from('message_templates')
      .select('id, meta_template_id, name')
      .eq('account_id', accountId)
      .eq('status', 'PENDING')
      .not('meta_template_id', 'is', null);

    if (pendingTemplates && pendingTemplates.length > 0) {
      const { data: config } = await supabase
        .from('whatsapp_config')
        .select('access_token')
        .eq('account_id', accountId)
        .maybeSingle();

      if (config?.access_token) {
        try {
          const token = decrypt(config.access_token);
          for (const pt of pendingTemplates) {
            const res = await fetch(`https://graph.facebook.com/v21.0/${pt.meta_template_id}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (data.status === 'APPROVED') {
              await supabase
                .from('message_templates')
                .update({ status: 'APPROVED' })
                .eq('id', pt.id);
            }
          }
        } catch {
          // ignore background sync errors
        }
      }
    }

    const { data, error } = await supabase
      .from('message_templates')
      .select('*')
      .eq('account_id', accountId)
      .eq('status', 'APPROVED')
      .not('meta_template_id', 'is', null)
      .order('name', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Sort 'mainmenu' to top if present
    const sorted = [...(data || [])].sort((a, b) => {
      if (a.name === 'mainmenu') return -1;
      if (b.name === 'mainmenu') return 1;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({ templates: sorted });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}
