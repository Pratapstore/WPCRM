import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/account';
import { getBaileysSession, sendBaileysMessage } from '@/lib/whatsapp/baileys-service';
import { sendMessageToConversation } from '@/lib/whatsapp/send-message';
import { supabaseAdmin } from '@/lib/flows/admin-client';

export const maxDuration = 300; // 5 minutes for bulk campaigns

interface CampaignRecipient {
  phone: string;
  name?: string;
  var1?: string;
}

export async function POST(request: Request) {
  try {
    const { accountId, userId } = await requireRole('agent');
    const body = await request.json();

    const {
      campaignName = 'Quick Campaign',
      instance = 'auto', // 'baileys' | 'meta' | 'auto'
      sessionId = 'primary',
      messageType = 'text',
      messageText = '',
      mediaUrl = '',
      recipients = [] as CampaignRecipient[],
      delaySeconds = 1,
    } = body;

    if (!messageText && !mediaUrl) {
      return NextResponse.json(
        { error: 'Message text or media is required' },
        { status: 400 }
      );
    }

    if (!Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json(
        { error: 'At least one recipient phone number is required' },
        { status: 400 }
      );
    }

    const db = supabaseAdmin();
    const baileysSession = getBaileysSession(accountId, sessionId);
    const isBaileysConnected = baileysSession.status === 'connected';

    const useBaileys = instance === 'baileys' || (instance === 'auto' && isBaileysConnected);

    if (instance === 'baileys' && !isBaileysConnected) {
      return NextResponse.json(
        {
          error:
            'Linked WhatsApp device is not connected. Please scan QR code in Settings > WhatsApp to connect.',
        },
        { status: 400 }
      );
    }

    // Create a broadcast campaign record to track results
    const { data: broadcastRow } = await db
      .from('broadcasts')
      .insert({
        user_id: userId,
        account_id: accountId,
        name: campaignName,
        template_name: useBaileys ? 'direct_campaign' : 'custom_campaign',
        template_language: 'en',
        status: 'sending',
        total_recipients: recipients.length,
        sent_count: 0,
        failed_count: 0,
        delivered_count: 0,
        read_count: 0,
      })
      .select('id')
      .single();

    const results: Array<{
      phone: string;
      name?: string;
      status: 'sent' | 'failed';
      messageId?: string;
      error?: string;
    }> = [];

    let sentCount = 0;
    let failedCount = 0;

    for (let i = 0; i < recipients.length; i++) {
      const r = recipients[i];
      const rawPhone = String(r.phone || '').trim();
      const cleanPhone = rawPhone.replace(/\D/g, '');

      if (!cleanPhone || cleanPhone.length < 10) {
        results.push({
          phone: rawPhone,
          name: r.name,
          status: 'failed',
          error: 'Invalid phone number (must be at least 10 digits)',
        });
        failedCount++;
        continue;
      }

      // Interpolate dynamic tags
      const personalizedText = messageText
        .replace(/\{\{\s*(name|Name)\s*\}\}/g, r.name || 'Friend')
        .replace(/\{\{\s*(number|Number|phone|Phone)\s*\}\}/g, cleanPhone)
        .replace(/\{\{\s*(var1|Variable1|Variable 1|var_1)\s*\}\}/g, r.var1 || '');

      try {
        let sentMsgId = '';

        if (useBaileys) {
          const res = await sendBaileysMessage(
            accountId,
            cleanPhone,
            {
              text: personalizedText,
              mediaUrl: mediaUrl || undefined,
              caption: personalizedText,
            },
            sessionId
          );
          sentMsgId = res.messageId;
        } else {
          // Meta Cloud API path
          // First resolve or create contact
          let { data: contact } = await db
            .from('contacts')
            .select('id')
            .eq('account_id', accountId)
            .eq('phone', cleanPhone)
            .maybeSingle();

          if (!contact) {
            const { data: newContact } = await db
              .from('contacts')
              .insert({
                account_id: accountId,
                phone: cleanPhone,
                name: r.name || `User ${cleanPhone.slice(-4)}`,
              })
              .select('id')
              .single();
            contact = newContact;
          }

          if (contact) {
            // Find or create conversation
            let { data: conv } = await db
              .from('conversations')
              .select('id')
              .eq('account_id', accountId)
              .eq('contact_id', contact.id)
              .maybeSingle();

            if (!conv) {
              const { data: newConv } = await db
                .from('conversations')
                .insert({
                  account_id: accountId,
                  contact_id: contact.id,
                  status: 'open',
                })
                .select('id')
                .single();
              conv = newConv;
            }

            if (conv) {
              const res = await sendMessageToConversation(db, accountId, {
                conversationId: conv.id,
                messageType: mediaUrl ? 'image' : 'text',
                contentText: personalizedText,
                mediaUrl: mediaUrl || undefined,
              });
              sentMsgId = res.messageId;
            }
          }
        }

        // Auto-save contact into CRM database so user can see them in Contacts & Inbox!
        let { data: existingContact } = await db
          .from('contacts')
          .select('id')
          .eq('account_id', accountId)
          .eq('phone', cleanPhone)
          .maybeSingle();

        if (!existingContact) {
          const { data: createdContact } = await db
            .from('contacts')
            .insert({
              account_id: accountId,
              phone: cleanPhone,
              name: r.name || `Customer ${cleanPhone.slice(-4)}`,
            })
            .select('id')
            .single();
          existingContact = createdContact;
        }

        if (existingContact) {
          let { data: conversation } = await db
            .from('conversations')
            .select('id')
            .eq('account_id', accountId)
            .eq('contact_id', existingContact.id)
            .maybeSingle();

          if (!conversation) {
            const { data: createdConv } = await db
              .from('conversations')
              .insert({
                account_id: accountId,
                contact_id: existingContact.id,
                status: 'open',
                last_message_at: new Date().toISOString(),
              })
              .select('id')
              .single();
            conversation = createdConv;
          }

          if (conversation) {
            await db.from('messages').insert({
              conversation_id: conversation.id,
              sender_type: 'agent',
              content_type: mediaUrl ? 'image' : 'text',
              content_text: personalizedText,
              media_url: mediaUrl || null,
              message_id: sentMsgId || `camp_${Date.now()}_${i}`,
              status: 'sent',
            });

            await db
              .from('conversations')
              .update({
                last_message_at: new Date().toISOString(),
              })
              .eq('id', conversation.id);
          }
        }

        results.push({
          phone: cleanPhone,
          name: r.name,
          status: 'sent',
          messageId: sentMsgId,
        });
        sentCount++;
      } catch (sendErr) {
        console.error(`[campaign-send] Failed to send to ${cleanPhone}:`, sendErr);
        results.push({
          phone: cleanPhone,
          name: r.name,
          status: 'failed',
          error: sendErr instanceof Error ? sendErr.message : 'Send failed',
        });
        failedCount++;
      }

      // Anti-ban delay pacing between sends (if more recipients remain)
      if (i < recipients.length - 1 && delaySeconds > 0) {
        const jitter = Math.floor(Math.random() * 800);
        await new Promise((resolve) => setTimeout(resolve, delaySeconds * 1000 + jitter));
      }
    }

    // Update broadcast row with final counts
    if (broadcastRow?.id) {
      await db
        .from('broadcasts')
        .update({
          status: failedCount === recipients.length ? 'failed' : 'completed',
          sent_count: sentCount,
          failed_count: failedCount,
        })
        .eq('id', broadcastRow.id);
    }

    return NextResponse.json({
      success: true,
      total: recipients.length,
      sent: sentCount,
      failed: failedCount,
      mode: useBaileys ? 'baileys' : 'meta',
      results,
    });
  } catch (error) {
    console.error('[campaign-send] Fatal error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Campaign dispatch failed' },
      { status: 500 }
    );
  }
}
