import { NextResponse } from 'next/server';
import { getCurrentAccount } from '@/lib/auth/account';
import { decrypt } from '@/lib/whatsapp/encryption';

export async function GET() {
  try {
    const { supabase, accountId } = await getCurrentAccount();

    // Fast batch sync of all template statuses directly from Meta in ONE single API call
    try {
      const { data: config } = await supabase
        .from('whatsapp_config')
        .select('access_token, waba_id')
        .eq('account_id', accountId)
        .maybeSingle();

      if (config?.access_token && config?.waba_id) {
        const token = decrypt(config.access_token);
        const metaRes = await fetch(
          `https://graph.facebook.com/v21.0/${config.waba_id}/message_templates?limit=100&fields=id,name,status,category,language`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const metaJson = await metaRes.json();
        if (metaJson.data && Array.isArray(metaJson.data)) {
          for (const mt of metaJson.data) {
            await supabase
              .from('message_templates')
              .update({
                status: mt.status,
                meta_template_id: mt.id,
              })
              .eq('account_id', accountId)
              .eq('name', mt.name);
          }
        }
      }
    } catch (syncErr) {
      // background sync is best-effort, never block template list rendering
      console.warn('[templates/route] Batch Meta sync warning:', syncErr);
    }

    // Return ALL templates for this account (Approved, Pending, and Drafts)
    const { data, error } = await supabase
      .from('message_templates')
      .select('*')
      .eq('account_id', accountId)
      .order('name', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Priority Sort:
    // 1. mainmenu & welcome_greeting on top
    // 2. All APPROVED templates
    // 3. PENDING templates (in Meta review)
    // 4. DRAFT templates
    const sorted = [...(data || [])].sort((a, b) => {
      if (a.name === 'mainmenu') return -1;
      if (b.name === 'mainmenu') return 1;
      if (a.name === 'welcome_greeting') return -1;
      if (b.name === 'welcome_greeting') return 1;

      const score = (status: string) => {
        if (status === 'APPROVED') return 1;
        if (status === 'PENDING') return 2;
        return 3;
      };

      const scoreDiff = score(a.status) - score(b.status);
      if (scoreDiff !== 0) return scoreDiff;

      return a.name.localeCompare(b.name);
    });

    const approvedCount = sorted.filter((t) => t.status === 'APPROVED').length;
    const pendingCount = sorted.filter((t) => t.status === 'PENDING').length;

    return NextResponse.json({
      templates: sorted,
      totalCount: sorted.length,
      approvedCount,
      pendingCount,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}
