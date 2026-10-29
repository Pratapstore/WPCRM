/**
 * Starter flow templates.
 *
 * Three pre-canned flows users can clone with one click instead of
 * building from scratch. Each template is a plain JS object describing
 * the same shape `/api/flows` PUT accepts — name, trigger config,
 * entry_node_id, fallback_policy, nodes[] — keyed by a stable
 * `slug`.
 *
 * The clone path (`/api/flows` POST with `template_slug`) creates a
 * NEW flow_row + flow_nodes rows for the user. `node_key`s are kept
 * verbatim (they're stable strings, not UUIDs, so cloning never
 * needs to rewrite edge references).
 *
 * Choosing a single static module over a DB-backed gallery for v1
 * because: (a) the set is small and changes with code releases, not
 * data; (b) keeps templates portable across self-hosted instances
 * without migrations; (c) editing in source is the lowest-friction
 * way to add the next template.
 */

import type {
  CollectInputNodeConfig,
  ConditionNodeConfig,
  HandoffNodeConfig,
  KeywordTriggerConfig,
  SendButtonsNodeConfig,
  SendListNodeConfig,
  SendMessageNodeConfig,
  StartNodeConfig,
} from "./types";
import { getT } from "@/lib/i18n/translate";

export type FlowTemplateNodeType =
  | "start"
  | "send_message"
  | "send_buttons"
  | "send_list"
  | "collect_input"
  | "condition"
  | "set_tag"
  | "handoff"
  | "end";

export interface FlowTemplateNode {
  node_key: string;
  node_type: FlowTemplateNodeType;
  config:
    | StartNodeConfig
    | SendMessageNodeConfig
    | SendButtonsNodeConfig
    | SendListNodeConfig
    | CollectInputNodeConfig
    | ConditionNodeConfig
    | HandoffNodeConfig
    | Record<string, unknown>;
}

export interface FlowTemplate {
  slug: string;
  name: string;
  description: string;
  /** Used by the gallery to surface a relevant icon. lucide-react name. */
  icon: "MessageSquare" | "HelpCircle" | "UserPlus" | "ShoppingBag";
  trigger_type: "keyword" | "first_inbound_message" | "manual";
  trigger_config: KeywordTriggerConfig | Record<string, unknown>;
  entry_node_id: string;
  nodes: FlowTemplateNode[];
}

const t = getT("StarterFlows");

/** Comma-separated keyword list from the catalogue → trimmed array. */
function keywords(key: string): string[] {
  return t(key)
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
}

// ============================================================
// 1. Welcome menu — the example from the owner's brief
// ============================================================
const WELCOME_MENU: FlowTemplate = {
  slug: "welcome_menu",
  name: t("welcome_menu.name"),
  description: t("welcome_menu.description"),
  icon: "MessageSquare",
  trigger_type: "keyword",
  trigger_config: { keywords: keywords("welcome_menu.keywords"), match_type: "contains" },
  entry_node_id: "start",
  nodes: [
    {
      node_key: "start",
      node_type: "start",
      config: { next_node_key: "welcome" },
    },
    {
      node_key: "welcome",
      node_type: "send_buttons",
      config: {
        text: t("welcome_menu.text"),
        footer_text: t("welcome_menu.footer"),
        buttons: [
          {
            reply_id: "existing",
            title: t("welcome_menu.existingButton"),
            next_node_key: "existing_handoff",
          },
          {
            reply_id: "new",
            title: t("welcome_menu.newButton"),
            next_node_key: "new_handoff",
          },
        ],
      } as SendButtonsNodeConfig,
    },
    {
      node_key: "existing_handoff",
      node_type: "handoff",
      config: {
        note: t("welcome_menu.existingNote"),
      } as HandoffNodeConfig,
    },
    {
      node_key: "new_handoff",
      node_type: "handoff",
      config: {
        note: t("welcome_menu.newNote"),
      } as HandoffNodeConfig,
    },
  ],
};

// ============================================================
// 2. FAQ bot — list-message answers, fully automated
// ============================================================
const FAQ_BOT: FlowTemplate = {
  slug: "faq_bot",
  name: t("faq_bot.name"),
  description: t("faq_bot.description"),
  icon: "HelpCircle",
  trigger_type: "keyword",
  trigger_config: {
    keywords: keywords("faq_bot.keywords"),
    match_type: "contains",
  },
  entry_node_id: "start",
  nodes: [
    {
      node_key: "start",
      node_type: "start",
      config: { next_node_key: "topics" },
    },
    {
      node_key: "topics",
      node_type: "send_list",
      config: {
        text: t("faq_bot.text"),
        button_label: t("faq_bot.buttonLabel"),
        sections: [
          {
            title: t("faq_bot.commonSection"),
            rows: [
              {
                reply_id: "hours",
                title: t("faq_bot.hoursRow"),
                next_node_key: "answer_hours",
              },
              {
                reply_id: "pricing",
                title: t("faq_bot.pricingRow"),
                next_node_key: "answer_pricing",
              },
              {
                reply_id: "refunds",
                title: t("faq_bot.refundsRow"),
                next_node_key: "answer_refunds",
              },
            ],
          },
          {
            title: t("faq_bot.otherSection"),
            rows: [
              {
                reply_id: "human",
                title: t("faq_bot.humanRow"),
                next_node_key: "human_handoff",
              },
            ],
          },
        ],
      } as SendListNodeConfig,
    },
    {
      node_key: "answer_hours",
      node_type: "send_message",
      config: {
        text: t("faq_bot.hoursAnswer"),
        next_node_key: "end",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "answer_pricing",
      node_type: "send_message",
      config: {
        text: t("faq_bot.pricingAnswer"),
        next_node_key: "end",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "answer_refunds",
      node_type: "send_message",
      config: {
        text: t("faq_bot.refundsAnswer"),
        next_node_key: "end",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "human_handoff",
      node_type: "handoff",
      config: {
        note: t("faq_bot.humanNote"),
      } as HandoffNodeConfig,
    },
    {
      node_key: "end",
      node_type: "end",
      config: {},
    },
  ],
};

// ============================================================
// 3. Lead capture — collect_input chain, ends in a handoff
// ============================================================
const LEAD_CAPTURE: FlowTemplate = {
  slug: "lead_capture",
  name: t("lead_capture.name"),
  description: t("lead_capture.description"),
  icon: "UserPlus",
  trigger_type: "first_inbound_message",
  trigger_config: {},
  entry_node_id: "start",
  nodes: [
    {
      node_key: "start",
      node_type: "start",
      config: { next_node_key: "intro" },
    },
    {
      node_key: "intro",
      node_type: "send_message",
      config: {
        text: t("lead_capture.intro"),
        next_node_key: "ask_name",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "ask_name",
      node_type: "collect_input",
      config: {
        prompt_text: t("lead_capture.askName"),
        var_key: "name",
        next_node_key: "ask_email",
      } as CollectInputNodeConfig,
    },
    {
      node_key: "ask_email",
      node_type: "collect_input",
      config: {
        prompt_text: t("lead_capture.askEmail", { name: "{{vars.name}}" }),
        var_key: "email",
        next_node_key: "ask_company",
      } as CollectInputNodeConfig,
    },
    {
      node_key: "ask_company",
      node_type: "collect_input",
      config: {
        prompt_text: t("lead_capture.askCompany"),
        var_key: "company",
        next_node_key: "handoff",
      } as CollectInputNodeConfig,
    },
    {
      node_key: "handoff",
      node_type: "handoff",
      config: {
        note: t("lead_capture.handoffNote", {
          name: "{{vars.name}}",
          email: "{{vars.email}}",
          company: "{{vars.company}}",
        }),
      } as HandoffNodeConfig,
    },
  ],
};

// ============================================================
// 4. Order Collection & Checkout — A to Z WhatsApp Order Flow
// ============================================================
const ORDER_COLLECTION: FlowTemplate = {
  slug: "order_collection",
  name: t("order_collection.name"),
  description: t("order_collection.description"),
  icon: "ShoppingBag",
  trigger_type: "keyword",
  trigger_config: {
    keywords: keywords("order_collection.keywords"),
    match_type: "contains",
  },
  entry_node_id: "start",
  nodes: [
    {
      node_key: "start",
      node_type: "start",
      config: { next_node_key: "catalog_menu" },
    },
    {
      node_key: "catalog_menu",
      node_type: "send_list",
      config: {
        header_text: t("order_collection.welcomeHeader"),
        text: t("order_collection.welcomeText"),
        button_label: t("order_collection.browseCatalog"),
        sections: [
          {
            title: t("order_collection.giftsSection"),
            rows: [
              {
                reply_id: "keychain",
                title: t("order_collection.keychainRow"),
                description: t("order_collection.keychainDesc"),
                next_node_key: "gift_variant",
              },
              {
                reply_id: "mug",
                title: t("order_collection.mugRow"),
                description: t("order_collection.mugDesc"),
                next_node_key: "gift_variant",
              },
              {
                reply_id: "frame",
                title: t("order_collection.frameRow"),
                description: t("order_collection.frameDesc"),
                next_node_key: "gift_variant",
              },
            ],
          },
          {
            title: t("order_collection.apparelSection"),
            rows: [
              {
                reply_id: "tshirt",
                title: t("order_collection.tshirtRow"),
                description: t("order_collection.tshirtDesc"),
                next_node_key: "apparel_size",
              },
              {
                reply_id: "hoodie",
                title: t("order_collection.hoodieRow"),
                description: t("order_collection.hoodieDesc"),
                next_node_key: "apparel_size",
              },
            ],
          },
        ],
      } as SendListNodeConfig,
    },
    {
      node_key: "gift_variant",
      node_type: "send_buttons",
      config: {
        header_text: t("order_collection.giftOptHeader"),
        text: t("order_collection.giftOptText"),
        buttons: [
          {
            reply_id: "single_photo",
            title: t("order_collection.giftOptSingle"),
            next_node_key: "ask_customer_name",
          },
          {
            reply_id: "double_photo",
            title: t("order_collection.giftOptDouble"),
            next_node_key: "ask_customer_name",
          },
          {
            reply_id: "spotify_code",
            title: t("order_collection.giftOptSpotify"),
            next_node_key: "ask_customer_name",
          },
        ],
      } as SendButtonsNodeConfig,
    },
    {
      node_key: "apparel_size",
      node_type: "send_buttons",
      config: {
        header_text: t("order_collection.sizeHeader"),
        text: t("order_collection.sizeText"),
        buttons: [
          {
            reply_id: "size_s",
            title: t("order_collection.sizeSmall"),
            next_node_key: "ask_customer_name",
          },
          {
            reply_id: "size_m",
            title: t("order_collection.sizeMedium"),
            next_node_key: "ask_customer_name",
          },
          {
            reply_id: "size_l",
            title: t("order_collection.sizeLarge"),
            next_node_key: "ask_customer_name",
          },
        ],
      } as SendButtonsNodeConfig,
    },
    {
      node_key: "ask_customer_name",
      node_type: "collect_input",
      config: {
        prompt_text: t("order_collection.askName"),
        var_key: "customer_name",
        next_node_key: "ask_shipping_address",
      } as CollectInputNodeConfig,
    },
    {
      node_key: "ask_shipping_address",
      node_type: "collect_input",
      config: {
        prompt_text: t("order_collection.askAddress", { name: "{{vars.customer_name}}" }),
        var_key: "shipping_address",
        next_node_key: "ask_pincode",
      } as CollectInputNodeConfig,
    },
    {
      node_key: "ask_pincode",
      node_type: "collect_input",
      config: {
        prompt_text: t("order_collection.askPincode"),
        var_key: "pincode",
        next_node_key: "ask_payment_mode",
      } as CollectInputNodeConfig,
    },
    {
      node_key: "ask_payment_mode",
      node_type: "send_buttons",
      config: {
        header_text: t("order_collection.paymentHeader"),
        text: t("order_collection.paymentText"),
        buttons: [
          {
            reply_id: "pay_upi",
            title: t("order_collection.payOnlineBtn"),
            next_node_key: "confirm_prepaid",
          },
          {
            reply_id: "pay_cod",
            title: t("order_collection.payCodBtn"),
            next_node_key: "confirm_cod",
          },
          {
            reply_id: "pay_support",
            title: t("order_collection.paySupportBtn"),
            next_node_key: "support_handoff",
          },
        ],
      } as SendButtonsNodeConfig,
    },
    {
      node_key: "confirm_prepaid",
      node_type: "send_message",
      config: {
        text: t("order_collection.prepaidConfirm", {
          name: "{{vars.customer_name}}",
          address: "{{vars.shipping_address}}",
          pincode: "{{vars.pincode}}",
        }),
        next_node_key: "order_handoff",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "confirm_cod",
      node_type: "send_message",
      config: {
        text: t("order_collection.codConfirm", {
          name: "{{vars.customer_name}}",
          address: "{{vars.shipping_address}}",
          pincode: "{{vars.pincode}}",
        }),
        next_node_key: "order_handoff",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "order_handoff",
      node_type: "handoff",
      config: {
        note: t("order_collection.orderNote", {
          name: "{{vars.customer_name}}",
          address: "{{vars.shipping_address}}",
          pincode: "{{vars.pincode}}",
        }),
      } as HandoffNodeConfig,
    },
    {
      node_key: "support_handoff",
      node_type: "handoff",
      config: {
        note: t("order_collection.supportNote"),
      } as HandoffNodeConfig,
    },
  ],
};

// ============================================================
// Registry
// ============================================================

const TEMPLATES: Record<string, FlowTemplate> = {
  order_collection: ORDER_COLLECTION,
  welcome_menu: WELCOME_MENU,
  faq_bot: FAQ_BOT,
  lead_capture: LEAD_CAPTURE,
};

export function getFlowTemplate(slug: string): FlowTemplate | null {
  return TEMPLATES[slug] ?? null;
}

export function listFlowTemplates(): FlowTemplate[] {
  return Object.values(TEMPLATES);
}

