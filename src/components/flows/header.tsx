"use client";

/**
 * Editor toolbar — flow name / description, status chip, dirty
 * indicator, and the action buttons (Save, Activate/Pause, Delete,
 * View runs, Back).
 *
 * Restyled to the Flow Builder design handoff: a single compact
 * toolbar row (back · icon · inline-editable name · status chip ·
 * edited dot on the left; Runs · Delete · Activate · Save on the
 * right) followed by a subtle, full-width description "note" line.
 * Replaces the old three-row stack so the editor reads as one app
 * chrome bar above the canvas/list stage.
 *
 * Lifted out of flow-builder.tsx so the same toolbar renders above
 * both views in FlowEditorShell. Without this, canvas users had no
 * way to save without toggling to list view.
 *
 * Reads everything from the editor context (`useFlowEditor`) so it
 * stays in sync with whichever view is mutating state, and routes
 * router navigation locally (back to /flows, View runs to
 * /flows/[id]/runs) — those don't belong in the hook.
 */

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  ChevronDown,
  CircleDot,
  History,
  Loader2,
  PauseCircle,
  PlayCircle,
  Save,
  Trash2,
  Workflow,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  useFlowEditor,
  type BuilderState,
} from "./flow-editor-state";
import { KeywordsInput } from "./flow-builder";

export function EditorHeader() {
  const router = useRouter();
  const t = useTranslations("Flows.header");
  const {
    flow,
    state,
    setState,
    dirty,
    saving,
    activating,
    save,
    setStatus,
    deleteFlow,
  } = useFlowEditor();

  return (
    <div className="flex shrink-0 flex-col gap-1 px-4 pt-3 pb-0.5 sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        {/* ---- left: back · icon · name · status · trigger · edited ---- */}
        <button
          type="button"
          onClick={() => router.push("/flows")}
          title={t("backToFlows")}
          aria-label={t("backToFlows")}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
          <Workflow className="h-[18px] w-[18px]" />
        </span>
        <input
          value={state.name}
          onChange={(e) => setState((s) => ({ ...s, name: e.target.value }))}
          placeholder={t("namePlaceholder")}
          spellCheck={false}
          aria-label={t("namePlaceholder")}
          className="min-w-[120px] max-w-[340px] rounded-lg border border-transparent bg-transparent px-2 py-1 text-lg font-bold leading-tight tracking-tight text-foreground outline-none transition-colors hover:bg-muted focus:border-primary focus:bg-transparent focus:shadow-[0_0_0_3px_var(--primary-soft)]"
        />
        <StatusChip status={state.status} />
        <TriggerSettingsChip />
        {dirty && (
          <span
            className="inline-flex shrink-0 items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-amber-300"
            title={t("unsavedHint")}
            aria-live="polite"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            {t("edited")}
          </span>
        )}

        {/* ---- right: runs · delete · activate · save ---- */}
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/flows/${flow.id}/runs`)}
          >
            <History className="h-3.5 w-3.5" />
            {t("runs")}
            <span className="ml-0.5 rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
              {flow.execution_count}
            </span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void deleteFlow()}
            className="text-red-400 hover:bg-red-500/10 hover:text-red-300"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {t("delete")}
          </Button>
          {state.status === "active" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void setStatus("draft")}
              disabled={activating}
            >
              {activating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <PauseCircle className="h-3.5 w-3.5" />
              )}
              {t("pause")}
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (!state.entry_node_id && state.nodes.length > 0) {
                  setState((s) => ({ ...s, entry_node_id: s.nodes[0].node_key }));
                }
                void setStatus("active");
              }}
              disabled={activating}
              className="border-emerald-600/50 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300"
            >
              {activating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <PlayCircle className="h-3.5 w-3.5" />
              )}
              {t("activate")}
            </Button>
          )}
          <Button onClick={() => void save()} disabled={saving} size="sm">
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            {t("save")}
          </Button>
        </div>
      </div>

      {/* ---- description note (subtle, inline-editable) ---- */}
      <input
        value={state.description}
        onChange={(e) =>
          setState((s) => ({ ...s, description: e.target.value }))
        }
        placeholder={t("descriptionPlaceholder")}
        aria-label={t("descriptionLabel")}
        className="w-full max-w-[78ch] rounded-md border border-transparent bg-transparent px-2 py-1 text-[13px] text-muted-foreground outline-none transition-colors placeholder:text-muted-foreground/60 hover:bg-muted/50 focus:border-primary focus:bg-transparent focus:text-foreground"
      />
    </div>
  );
}

function TriggerSettingsChip() {
  const { state, setState } = useFlowEditor();
  const t = useTranslations("Flows.builder");

  const keywords = Array.isArray(state.trigger_config.keywords)
    ? (state.trigger_config.keywords as string[])
    : [];

  const triggerLabel =
    state.trigger_type === "keyword"
      ? keywords.length > 0
        ? `Keyword: ${keywords.slice(0, 2).join(", ")}${keywords.length > 2 ? ` +${keywords.length - 2}` : ""}`
        : `Keyword: "${(state.name || "flow").toLowerCase()}" (default)`
      : state.trigger_type === "first_inbound_message"
        ? t("triggerFirstInboundTitle")
        : t("triggerManualTitle");

  return (
    <Popover>
      <PopoverTrigger
        type="button"
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-primary/30 bg-primary-soft px-2.5 py-1 text-[11.5px] font-medium text-primary transition-colors hover:bg-primary/20 cursor-pointer"
        title="Click to view/change trigger keywords"
      >
        <Zap className="h-3 w-3" />
        <span className="max-w-[180px] truncate">{triggerLabel}</span>
        <ChevronDown className="h-3 w-3 opacity-60" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-3.5 shadow-lg border-border bg-card">
        <h4 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-primary" />
          {t("triggerTitle")}
        </h4>
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-muted-foreground mb-1 block text-[11px]">
              {t("whenLabel")}
            </label>
            <Select
              value={state.trigger_type}
              onValueChange={(v) =>
                setState((s) => ({
                  ...s,
                  trigger_type: v as BuilderState["trigger_type"],
                  trigger_config:
                    v === "keyword"
                      ? {
                          keywords:
                            keywords.length > 0
                              ? keywords
                              : [(s.name || "flow").toLowerCase().trim()],
                        }
                      : {},
                }))
              }
            >
              <SelectTrigger className="h-8 bg-muted text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="keyword">
                  {t("triggerKeywordTitle")}
                </SelectItem>
                <SelectItem value="first_inbound_message">
                  {t("triggerFirstInboundTitle")}
                </SelectItem>
                <SelectItem value="manual">
                  {t("triggerManualTitle")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {state.trigger_type === "keyword" && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-muted-foreground text-[11px]">
                  {t("keywordsLabel")}
                </label>
                <span className="text-[10px] text-muted-foreground">comma-separated</span>
              </div>
              <KeywordsInput
                keywords={keywords}
                onChange={(newKeywords) =>
                  setState((s) => ({
                    ...s,
                    trigger_config: { ...s.trigger_config, keywords: newKeywords },
                  }))
                }
                t={t}
              />
              <p className="mt-1.5 text-[10.5px] text-muted-foreground leading-normal">
                {keywords.length === 0
                  ? `Blank defaults to "${(state.name || "flow").toLowerCase()}". Customers sending these keywords will trigger this flow.`
                  : "Customers sending any of these keywords will start this flow."}
              </p>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function StatusChip({ status }: { status: BuilderState["status"] }) {
  // Status labels live with the flows list so the chip and the list
  // badge can never drift apart.
  const t = useTranslations("Flows.list");
  const cfg = {
    draft: {
      // Neutral, not amber — amber is reserved for the adjacent
      // "Edited" dirty signal, so the two don't read as the same alert.
      cls: "border-border bg-muted text-muted-foreground",
      label: t("statusDraft"),
    },
    active: {
      cls: "border-emerald-600/40 bg-emerald-500/10 text-emerald-300",
      label: t("statusActive"),
    },
    archived: {
      cls: "border-border bg-muted/50 text-muted-foreground",
      label: t("statusArchived"),
    },
  }[status];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-medium",
        cfg.cls,
      )}
    >
      <CircleDot className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}
