'use client';
import { submitFeedbackAction } from '@/app/actions/feedback';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { feedbackSchema } from '@/lib/schemas';
import { cn } from '@/lib/utils';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

/** Vendor NPS + optional comment widget, ported from Merqo's own hub-level
 *  FeedbackForm. Designed to be mounted in a Sheet off the account menu
 *  (wiring is a separate, later task). */
export function FeedbackForm() {
  const [score, setScore] = useState(-1);
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();

  function send() {
    if (score < 0) {
      toast.error('Pick a score first');
      return;
    }
    const parsed = feedbackSchema.safeParse({
      nps: score,
      message: message.trim() || undefined,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Invalid feedback');
      return;
    }
    start(async () => {
      const res = await submitFeedbackAction(parsed.data);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      setSent(true);
    });
  }

  if (sent) {
    return (
      <div className="bg-card text-muted-foreground rounded-xl border px-4 py-3 text-center text-sm">
        Thanks for the feedback — it helps us improve.
      </div>
    );
  }

  return (
    <div className="bg-card space-y-3 rounded-xl border p-4">
      <p className="text-sm font-medium">
        How likely are you to recommend stockkit to another vendor?
      </p>
      <ToggleGroup
        type="single"
        value={score >= 0 ? String(score) : undefined}
        onValueChange={(v) => v && setScore(Number(v))}
        spacing={1}
        aria-label="Recommend score, 0 to 10"
        className="grid grid-cols-11"
      >
        {Array.from({ length: 11 }, (_, n) => (
          <ToggleGroupItem
            key={n}
            value={String(n)}
            aria-label={`${n}`}
            className={cn(
              'text-muted-foreground flex aspect-square items-center justify-center rounded-md border text-sm font-semibold tabular-nums transition-colors',
              'hover:border-primary/50 hover:bg-primary/5 border-border',
              'data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground'
            )}
          >
            {n}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <div className="text-muted-foreground flex justify-between text-[11px] font-medium">
        <span>Not likely</span>
        <span>Very likely</span>
      </div>
      <Textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        aria-label="Anything else?"
        placeholder="Anything we can improve? (optional)"
        rows={3}
        maxLength={2000}
        className="rounded-lg text-sm"
      />
      <Button
        type="button"
        className="h-11 w-full rounded-xl font-semibold"
        onClick={send}
        disabled={pending}
      >
        {pending ? 'Sending…' : 'Send feedback'}
      </Button>
    </div>
  );
}
