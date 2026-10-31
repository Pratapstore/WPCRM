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

interface CampaignButton {
  id: string;
  title: string;
}

interface CampaignListSection {
  title?: string;
  rows: Array<{
    id: string;
    title: string;
    description?: string;
  }>;
}

interface CampaignListConfig {
  buttonLabel: string;
  sections: CampaignListSection[];
}

function detectMediaKind(url?: string): 'image' | 'document' | 'video' {
  if (!url) return 'image';
  const lower = url.toLowerCase();
  if (lower.includes('.pdf') || lower.includes('.doc') || lower.includes('.txt')) return 'document';
  if (lower.match(/\.(mp4|mov|avi|mkv|webm)$/i)) return 'video';
  return 'image';
}

function formatBaileysButtons(
  body: string,
  header?: string,
  footer?: string,
  buttons?: CampaignButton[]
): string {
  const parts: string[] = [];
  if (header?.trim()) parts.push(`*${header.trim()}*`);
  if (body?.trim()) parts.push(body.trim());
  if (buttons && buttons.length > 0) {
    const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];
    const buttonLines = buttons.map(
      (b, idx) => `${emojis[idx] || `[${idx + 1}]`} *${b.title.trim()}*`
    );
    parts.push(
      `━━━━━━━━━━━━━━━━━━━━\n⚡ *Quick Actions:*\n${buttonLines.join('\n')}\n👉 _Reply with the number or option name_`
    );
  }
  if (footer?.trim()) parts.push(`_${footer.trim()}_`);
  return parts.join('\n\n');
}

function formatBaileysList(
  body: string,
  header?: string,
  footer?: string,
  buttonLabel?: string,
  sections?: CampaignListSection[]
): string {
  const parts: string[] = [];
  if (header?.trim()) parts.push(`*${header.trim()}*`);
  if (body?.trim()) parts.push(body.trim());
  if (sections && sections.length > 0) {
    const listLines: string[] = [];
    let count = 1;
    for (const sec of sections) {
      if (sec.title?.trim()) listLines.push(`\n📌 *${sec.title.trim()}*`);
      for (const row of sec.rows || []) {
        const desc = row.description?.trim() ? ` — ${row.description.trim()}` : '';
        const numEmoji =
          ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'][count - 1] ||
          `[${count}]`;
        listLines.push(`${numEmoji} *${row.title.trim()}*${desc}`);
        count++;
      }
    }
    parts.push(
      `━━━━━━━━━━━━━━━━━━━━\n📋 *${
        buttonLabel?.trim() || 'Menu Options'
      }:*\n${listLines.join('\n')}\n👉 _Reply with the number or option title_`
    );
  }
  if (footer?.trim()) parts.push(`_${footer.trim()}_`);
  return parts.join('\n\n');
}

export async function POST(request: Request) {
  try {
    const { accountId, userId } = await requireRole('agent');
    const body = await request.json();

    const {
      campaignName = 'Quick Campaign',
      instance = 'auto', // 'baileys' | 'meta' | 'auto'
      sessionId = 'primary',
      messageType = 'text', // 'template' | 'text' | 'media' | 'buttons' | 'list'
      templateName = '',
      templateLanguage = 'en_US',
      messageText = '',
      mediaUrl = '',
      headerText = '',
      footerText = '',
      buttons = [] as CampaignButton[],
      listConfig,
      recipients = [] as CampaignRecipient[],
      delaySeconds = 1,
    } = body;

    if (messageType === 'template' && !templateName) {
      return NextResponse.json(
        { error: 'Template name is required for template campaigns' },
        { status: 400 }
      );
    }

    if (messageType !== 'template' && !messageText && !mediaUrl) {
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

    // If template message, load template definition from database
    let templateDbRow: any = null;
    if (messageType === 'template' && templateName) {
      const { data: tmpl } = await db
        .from('message_templates')
        .select('*')
        .eq('account_id', accountId)
        .eq('name', templateName)
        .maybeSingle();
      templateDbRow = tmpl;
    }

    // Check Meta configuration
    const { data: metaConfig } = await db
      .from('whatsapp_config')
      .select('phone_number_id, status')
      .eq('account_id', accountId)
      .maybeSingle();

    const hasMeta = !!(metaConfig && metaConfig.phone_number_id);

    let useBaileys = false;
    if (instance === 'baileys') {
      if (!isBaileysConnected) {
        return NextResponse.json(
          {
            error:
              'Linked WhatsApp device is not connected. Please scan QR code in Settings > WhatsApp to connect.',
          },
          { status: 400 }
        );
      }
      useBaileys = true;
    } else if (instance === 'meta') {
      if (!hasMeta) {
        return NextResponse.json(
          {
            error:
              'Meta Cloud API is not configured. Please set up your Meta WhatsApp credentials in Settings.',
          },
          { status: 400 }
        );
      }
      useBaileys = false;
    } else {
      // auto mode: prefer baileys if connected, otherwise fallback to Meta if configured
      if (isBaileysConnected) {
        useBaileys = true;
      } else if (hasMeta) {
        useBaileys = false;
      } else {
        return NextResponse.json(
          {
            error:
              'No active WhatsApp connection found. Please scan the QR code to link your phone (Baileys) or connect Meta Cloud API in Settings.',
          },
          { status: 400 }
        );
      }
    }

    // Create a broadcast campaign record to track results
    const { data: broadcastRow } = await db
      .from('broadcasts')
      .insert({
        user_id: userId,
        account_id: accountId,
        name: campaignName,
        template_name:
          messageType === 'buttons'
            ? 'interactive_buttons'
            : messageType === 'list'
            ? 'interactive_list'
            : useBaileys
            ? 'direct_campaign'
            : 'custom_campaign',
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
    const mediaKind = detectMediaKind(mediaUrl);

    for (let i = 0; i < recipients.length; i++) {
      const r = recipients[i];
      const rawPhone = String(r.phone || '').trim();
      let cleanPhone = rawPhone.replace(/\D/g, '');

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

      // Automatically prepend India country code (91) if user entered a 10-digit mobile number
      if (cleanPhone.length === 10) {
        cleanPhone = `91${cleanPhone}`;
      }

      // Interpolate dynamic tags
      const personalizedText = messageText
        .replace(/\{\{\s*(name|Name)\s*\}\}/g, r.name || 'Friend')
        .replace(/\{\{\s*(number|Number|phone|Phone)\s*\}\}/g, cleanPhone)
        .replace(/\{\{\s*(var1|Variable1|Variable 1|var_1)\s*\}\}/g, r.var1 || '');

      // Prepare template variables if template message
      const templateParams: string[] = [];
      let templateRenderedBody = personalizedText;
      if (messageType === 'template' && templateDbRow) {
        const sampleBody = (templateDbRow.sample_values?.body_text as string[]) || [];
        const varMatches = (templateDbRow.body_text || '').match(/\{\{\d+\}\}/g) || [];
        const varCount = varMatches.length;

        for (let idx = 0; idx < varCount; idx++) {
          if (idx === 0) {
            templateParams.push(r.name || sampleBody[0] || 'Friend');
          } else if (idx === 1) {
            templateParams.push(r.var1 || sampleBody[1] || '10% OFF');
          } else {
            templateParams.push(sampleBody[idx] || `Value ${idx + 1}`);
          }
        }

        let rendered = templateDbRow.body_text || '';
        templateParams.forEach((val, pIdx) => {
          rendered = rendered.replace(new RegExp(`\\{\\{${pIdx + 1}\\}\\}`, 'g'), val);
        });
        templateRenderedBody = rendered;
      }

      try {
        let sentMsgId = '';

        if (useBaileys) {
          let textToSend = personalizedText;
          if (messageType === 'template' && templateDbRow) {
            const parts: string[] = [];
            if (templateDbRow.header_content) parts.push(`*${templateDbRow.header_content}*`);
            parts.push(templateRenderedBody);
            if (templateDbRow.footer_text) parts.push(`_${templateDbRow.footer_text}_`);
            if (Array.isArray(templateDbRow.buttons) && templateDbRow.buttons.length > 0) {
              const actionCards = templateDbRow.buttons.map(
                (b: any) => `🔘 *[ ${b.text || b.title} ]*`
              );
              parts.push(`━━━━━━━━━━━━━━━━━━━━\n⚡ *Quick Actions:*\n${actionCards.join('\n')}`);
            }
            textToSend = parts.join('\n\n');
          } else if (messageType === 'buttons') {
            textToSend = formatBaileysButtons(
              personalizedText,
              headerText,
              footerText,
              buttons
            );
          } else if (messageType === 'list') {
            textToSend = formatBaileysList(
              personalizedText,
              headerText,
              footerText,
              listConfig?.buttonLabel,
              listConfig?.sections
            );
          }

          const res = await sendBaileysMessage(
            accountId,
            cleanPhone,
            {
              text: textToSend,
              mediaUrl: mediaUrl || undefined,
              caption: textToSend,
            },
            sessionId
          );
          sentMsgId = res.messageId;
        } else {
          // Meta Cloud API path
          let { data: contact } = await db
            .from('contacts')
            .select('id')
            .eq('account_id', accountId)
            .eq('phone', cleanPhone)
            .maybeSingle();

          if (!contact) {
            const { data: newContact, error: ce } = await db
              .from('contacts')
              .insert({
                user_id: userId,
                account_id: accountId,
                phone: cleanPhone,
                name: r.name || `Customer ${cleanPhone.slice(-4)}`,
              })
              .select('id')
              .single();
            if (ce) {
              console.error('[campaign-send] Failed to create contact:', ce);
              throw new Error(`Failed to create contact for ${cleanPhone}: ${ce.message}`);
            }
            contact = newContact;
          }

          if (contact) {
            let { data: conv } = await db
              .from('conversations')
              .select('id')
              .eq('account_id', accountId)
              .eq('contact_id', contact.id)
              .maybeSingle();

            if (!conv) {
              const { data: newConv, error: cve } = await db
                .from('conversations')
                .insert({
                  user_id: userId,
                  account_id: accountId,
                  contact_id: contact.id,
                  status: 'open',
                  last_message_at: new Date().toISOString(),
                })
                .select('id')
                .single();
              if (cve) {
                console.error('[campaign-send] Failed to create conv:', cve);
                throw new Error(`Failed to create conversation for ${cleanPhone}: ${cve.message}`);
              }
              conv = newConv;
            }

            if (conv) {
              if (messageType === 'template') {
                const res = await sendMessageToConversation(db, accountId, {
                  conversationId: conv.id,
                  messageType: 'template',
                  templateName,
                  templateLanguage: templateLanguage || templateDbRow?.language || 'en_US',
                  templateParams: templateParams.length > 0 ? templateParams : undefined,
                  contentText: templateRenderedBody || undefined,
                });
                sentMsgId = res.messageId;
              } else {
                let interactivePayload: any = null;
                if (messageType === 'buttons') {
                  interactivePayload = {
                    kind: 'buttons',
                    body: personalizedText,
                    header: headerText || undefined,
                    footer: footerText || undefined,
                    buttons: ((buttons as CampaignButton[]) || []).map(
                      (b: CampaignButton, idx: number) => ({
                        id: b.id || `btn_${idx + 1}`,
                        title: (b.title || '').slice(0, 20),
                      })
                    ),
                  };
                } else if (messageType === 'list') {
                  interactivePayload = {
                    kind: 'list',
                    body: personalizedText,
                    header: headerText || undefined,
                    footer: footerText || undefined,
                    button_label: (listConfig?.buttonLabel || 'View options').slice(0, 20),
                    sections: listConfig?.sections || [],
                  };
                }

                const res = await sendMessageToConversation(db, accountId, {
                  conversationId: conv.id,
                  messageType:
                    messageType === 'buttons' || messageType === 'list'
                      ? 'interactive'
                      : mediaUrl
                      ? mediaKind
                      : 'text',
                  contentText: personalizedText,
                  mediaUrl: mediaUrl || undefined,
                  interactivePayload,
                });
                sentMsgId = res.messageId;
              }
            }
          }
        }

        // For Baileys sends, persist contact, conversation, and message into DB
        if (useBaileys) {
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
                user_id: userId,
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
                  user_id: userId,
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
              const interactivePayload =
                messageType === 'buttons'
                  ? {
                      kind: 'buttons',
                      body: personalizedText,
                      header: headerText || null,
                      footer: footerText || null,
                      buttons: buttons || [],
                    }
                  : messageType === 'list'
                  ? {
                      kind: 'list',
                      body: personalizedText,
                      header: headerText || null,
                      footer: footerText || null,
                      button_label: listConfig?.buttonLabel || 'Menu',
                      sections: listConfig?.sections || [],
                    }
                  : null;

              await db.from('messages').insert({
                conversation_id: conversation.id,
                sender_type: 'agent',
                content_type:
                  messageType === 'template'
                    ? 'template'
                    : messageType === 'buttons' || messageType === 'list'
                    ? 'interactive'
                    : mediaUrl
                    ? mediaKind
                    : 'text',
                content_text: messageType === 'template' ? templateRenderedBody : personalizedText,
                interactive_payload: interactivePayload,
                media_url: mediaUrl || null,
                message_id: sentMsgId || `camp_${Date.now()}_${i}`,
                status: 'sent',
              });

              await db
                .from('conversations')
                .update({
                  last_message_at: new Date().toISOString(),
                  last_message_text:
                    messageType === 'template'
                      ? `[Template: ${templateName}] ${(templateRenderedBody || '').slice(0, 40)}...`
                      : messageType === 'buttons'
                      ? `[Buttons] ${personalizedText.slice(0, 30)}...`
                      : messageType === 'list'
                      ? `[List] ${personalizedText.slice(0, 30)}...`
                      : personalizedText.slice(0, 50),
                })
                .eq('id', conversation.id);
            }
          }
        }

        if (!sentMsgId) {
          throw new Error('Message dispatch failed to return a message ID from provider');
        }

        results.push({
          phone: cleanPhone,
          name: r.name,
          status: 'sent',
          messageId: sentMsgId,
        });
        sentCount++;
      } catch (sendErr: any) {
        console.error(`[campaign-send] Failed to send to ${cleanPhone}:`, sendErr);
        let errorMsg = sendErr instanceof Error ? sendErr.message : 'Send failed';
        if (
          errorMsg.includes('131047') ||
          errorMsg.includes('24 hours') ||
          errorMsg.includes('Re-engagement message')
        ) {
          errorMsg =
            'Meta 24-hr Policy: WhatsApp requires an Approved Template to message new customers. Select "Meta Approved Template" above (e.g. welcome_greeting) or link your phone via QR.';
        } else if (
          errorMsg.includes('130429') ||
          errorMsg.includes('Rate limit') ||
          errorMsg.includes('too many messages')
        ) {
          errorMsg =
            'Meta Rate Limit / Billing (130429): WhatsApp requires a verified payment card in Meta Business Suite to message new numbers, or scan your WhatsApp QR code to send freely.';
        }
        results.push({
          phone: cleanPhone,
          name: r.name,
          status: 'failed',
          error: errorMsg,
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
