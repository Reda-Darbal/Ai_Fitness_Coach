"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2, SendHorizontal } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sendCoachMessage } from "@/lib/coach/actions";
import type { CoachMessage } from "@/lib/coach/queries";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

interface Bubble {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export function CoachChat({ initialMessages }: { initialMessages: CoachMessage[] }) {
  const { dict } = useI18n();
  const [messages, setMessages] = useState<Bubble[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, pending]);

  const quickActions = [
    dict.coach.quick1,
    dict.coach.quick2,
    dict.coach.quick3,
    dict.coach.quick4,
  ];

  function send(text: string) {
    const content = text.trim();
    if (!content || pending) return;
    setDraft("");
    setMessages((prev) => [
      ...prev,
      { id: `local-${Date.now()}`, role: "user", content },
    ]);

    startTransition(async () => {
      const result = await sendCoachMessage({ content });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setMessages((prev) => [
        ...prev,
        { id: `reply-${Date.now()}`, role: "assistant", content: result.reply },
      ]);
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto py-2">
        {messages.length === 0 ? (
          <div className="flex max-w-md flex-col gap-1 rounded-xl rounded-es-sm border border-border bg-card px-4 py-3">
            <span className="text-xs font-medium tracking-[0.08em] text-primary uppercase">
              {dict.coach.title}
            </span>
            <p className="text-sm text-foreground">{dict.coach.welcome}</p>
          </div>
        ) : null}

        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "max-w-[85%] rounded-xl px-4 py-2.5 text-sm whitespace-pre-wrap",
              message.role === "user"
                ? "self-end rounded-ee-sm bg-secondary text-secondary-foreground"
                : "self-start rounded-es-sm border border-border bg-card text-foreground",
            )}
          >
            {message.content}
          </div>
        ))}

        {pending ? (
          <div
            className="flex items-center gap-2 self-start rounded-xl rounded-es-sm border border-border bg-card px-4 py-2.5 text-sm text-muted-foreground"
            aria-live="polite"
          >
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            {dict.coach.thinking}
          </div>
        ) : null}
        <div ref={endRef} />
      </div>

      {messages.length === 0 ? (
        <div className="mb-3 flex flex-wrap gap-2">
          {quickActions.map((action) => (
            <button
              key={action}
              type="button"
              onClick={() => send(action)}
              disabled={pending}
              className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
            >
              <Badge
                variant="outline"
                className="cursor-pointer px-3 py-1.5 text-muted-foreground transition-colors hover:border-input hover:text-foreground"
              >
                {action}
              </Badge>
            </button>
          ))}
        </div>
      ) : null}

      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
      >
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={dict.coach.placeholder}
          aria-label={dict.coach.placeholder}
          className="h-11"
          disabled={pending}
        />
        <Button
          type="submit"
          size="icon-xl"
          disabled={pending || draft.trim().length === 0}
          aria-label={dict.coach.send}
        >
          {pending ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <SendHorizontal className="rtl:-scale-x-100 size-5" />
          )}
        </Button>
      </form>
    </div>
  );
}
