'use client';
import { submitSupportMessageAction } from '@/app/actions/support';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { SupportMessageInput } from '@/lib/schemas';
import { SUPPORT_CATEGORY_LABELS, supportMessageSchema } from '@/lib/schemas';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

/** Vendor support message widget, similar to FeedbackForm but for categorized
 *  support requests. Designed to be mounted in a Sheet off the account menu. */
export function SupportForm() {
  const [category, setCategory] = useState<SupportMessageInput['category']>('products');
  const [body, setBody] = useState('');
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();

  function send() {
    if (!body.trim()) {
      toast.error("Tell us what's wrong");
      return;
    }
    const parsed = supportMessageSchema.safeParse({
      category,
      body: body.trim(),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Invalid message');
      return;
    }
    start(async () => {
      const res = await submitSupportMessageAction(parsed.data);
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
        We&apos;ll look into this and get back to you soon.
      </div>
    );
  }

  return (
    <div className="bg-card space-y-4 rounded-xl border p-4" data-testid="support-form">
      <div>
        <p className="mb-2 text-sm font-medium">What&apos;s the issue?</p>
        <ToggleGroup
          type="single"
          value={category}
          onValueChange={(v) => v && setCategory(v as SupportMessageInput['category'])}
          spacing={1.5}
          aria-label="Issue category"
          className="grid grid-cols-2"
        >
          {(Object.keys(SUPPORT_CATEGORY_LABELS) as SupportMessageInput['category'][]).map(
            (cat) => (
              <ToggleGroupItem key={cat} value={cat} aria-label={SUPPORT_CATEGORY_LABELS[cat]}>
                {SUPPORT_CATEGORY_LABELS[cat]}
              </ToggleGroupItem>
            )
          )}
        </ToggleGroup>
      </div>
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        aria-label="Describe the problem"
        placeholder="Describe the problem..."
        rows={4}
        maxLength={2000}
        className="rounded-lg text-sm"
      />
      <Button
        type="button"
        className="h-11 w-full rounded-xl font-semibold"
        onClick={send}
        disabled={pending}
      >
        {pending ? 'Sending…' : 'Send message'}
      </Button>
    </div>
  );
}
