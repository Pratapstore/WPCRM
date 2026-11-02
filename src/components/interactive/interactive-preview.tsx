"use client";

import { useState } from "react";
import { List, Reply, ShoppingBag, ExternalLink, ChevronLeft, ChevronRight, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import type { InteractiveMessagePayload, InteractiveCarouselCard } from "@/lib/whatsapp/interactive";

/**
 * WhatsApp-style read-only render of an interactive message. Used both
 * in the builder's live preview and by the inbox message bubble so a
 * sent buttons/list/carousel message shows the same way it does on the phone.
 */
export interface InteractivePreviewLabels {
  /** Shown in place of an empty body. */
  body?: string;
  /** Shown in place of an untitled reply button. */
  button?: string;
  /** Shown in place of an empty list button label. */
  menu?: string;
}

export function InteractivePreview({
  payload,
  className,
  labels,
}: {
  payload: InteractiveMessagePayload;
  className?: string;
  labels?: InteractivePreviewLabels;
}) {
  const bodyLabel = labels?.body ?? "Message body…";
  const buttonLabel = labels?.button ?? "Button";
  const menuLabel = labels?.menu ?? "Menu";
  const [activeCardIndex, setActiveCardIndex] = useState(0);

  if (payload.kind === "carousel") {
    const cards = payload.cards || [];
    const currentCard: InteractiveCarouselCard | undefined = cards[activeCardIndex] || cards[0];

    return (
      <div
        className={cn(
          "w-full max-w-[280px] overflow-hidden rounded-xl bg-card text-foreground shadow-md ring-1 ring-border/80",
          className
        )}
      >
        {/* Header / Body */}
        {(payload.header || payload.body) && (
          <div className="px-3 pt-2.5 pb-2 border-b border-border/50 bg-muted/20">
            {payload.header && (
              <p className="mb-0.5 break-words text-xs font-semibold text-primary">
                {payload.header}
              </p>
            )}
            {payload.body && (
              <p className="whitespace-pre-wrap break-words text-xs text-foreground/90">
                {payload.body}
              </p>
            )}
          </div>
        )}

        {/* Carousel Card Box */}
        {currentCard ? (
          <div className="relative">
            {/* Card Image */}
            <div className="relative h-32 w-full bg-muted/40 flex items-center justify-center overflow-hidden border-b border-border/50">
              {currentCard.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={currentCard.image}
                  alt={currentCard.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-muted-foreground/60 gap-1">
                  <Package className="h-8 w-8" />
                  <span className="text-[10px] font-medium">Product Card</span>
                </div>
              )}

              {/* Price Badge */}
              {currentCard.price && (
                <div className="absolute top-2 right-2 rounded-full bg-emerald-600/95 text-white px-2 py-0.5 text-[10px] font-bold shadow-sm backdrop-blur-xs">
                  ₹{currentCard.price}
                </div>
              )}

              {/* Card Index Indicator */}
              <div className="absolute bottom-1.5 left-2 rounded-md bg-black/60 text-white px-1.5 py-0.5 text-[9px] font-medium">
                {activeCardIndex + 1} / {cards.length}
              </div>

              {/* Carousel Arrow Navigation */}
              {cards.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveCardIndex((prev) => (prev > 0 ? prev - 1 : cards.length - 1));
                    }}
                    className="absolute left-1 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-background/80 hover:bg-background text-foreground flex items-center justify-center shadow-sm cursor-pointer z-10"
                    title="Previous product"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveCardIndex((prev) => (prev < cards.length - 1 ? prev + 1 : 0));
                    }}
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-background/80 hover:bg-background text-foreground flex items-center justify-center shadow-sm cursor-pointer z-10"
                    title="Next product"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>

            {/* Card Content */}
            <div className="p-2.5 space-y-1 bg-card">
              <h4 className="font-semibold text-xs text-foreground line-clamp-1">
                {currentCard.title}
              </h4>
              {currentCard.description && (
                <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                  {currentCard.description}
                </p>
              )}
            </div>

            {/* Card Buttons */}
            {Array.isArray(currentCard.buttons) && currentCard.buttons.length > 0 && (
              <div className="border-t border-border/60 divide-y divide-border/60">
                {currentCard.buttons.map((btn, i) => (
                  <button
                    key={btn.id || i}
                    type="button"
                    disabled
                    className="flex w-full items-center justify-center gap-1.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/5 transition-colors"
                  >
                    {btn.url ? (
                      <ExternalLink className="h-3 w-3" />
                    ) : (
                      <ShoppingBag className="h-3 w-3" />
                    )}
                    <span className="truncate">{btn.title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {/* Carousel Dots Indicator */}
        {cards.length > 1 && (
          <div className="flex items-center justify-center gap-1 py-1.5 bg-muted/20 border-t border-border/50">
            {cards.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActiveCardIndex(i)}
                className={cn(
                  "h-1.5 rounded-full transition-all cursor-pointer",
                  activeCardIndex === i ? "w-3 bg-primary" : "w-1.5 bg-muted-foreground/30"
                )}
              />
            ))}
          </div>
        )}

        {/* Footer */}
        {payload.footer && (
          <div className="px-3 py-1 bg-muted/10 border-t border-border/40">
            <p className="text-[10px] text-muted-foreground italic truncate">
              {payload.footer}
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "w-full max-w-[260px] overflow-hidden rounded-lg bg-card text-foreground shadow-sm ring-1 ring-border",
        className,
      )}
    >
      <div className="px-3 py-2">
        {payload.header ? (
          <p className="mb-1 break-words text-sm font-semibold">
            {payload.header}
          </p>
        ) : null}
        <p className="whitespace-pre-wrap break-words text-sm">
          {payload.body || (
            <span className="text-muted-foreground">{bodyLabel}</span>
          )}
        </p>
        {payload.footer ? (
          <p className="mt-1 break-words text-[11px] text-muted-foreground">
            {payload.footer}
          </p>
        ) : null}
      </div>

      {payload.kind === "buttons" ? (
        <div className="flex flex-col border-t border-border">
          {payload.buttons.map((b, i) => (
            <button
              key={b.id || i}
              type="button"
              disabled
              className="flex items-center justify-center gap-1.5 border-t border-border py-2 text-sm font-medium text-primary first:border-t-0"
            >
              <Reply className="h-3.5 w-3.5" />
              <span className="truncate">{b.title || buttonLabel}</span>
            </button>
          ))}
        </div>
      ) : (
        <button
          type="button"
          disabled
          className="flex w-full items-center justify-center gap-1.5 border-t border-border py-2 text-sm font-medium text-primary"
        >
          <List className="h-3.5 w-3.5" />
          <span className="truncate">{payload.button_label || menuLabel}</span>
        </button>
      )}
    </div>
  );
}
