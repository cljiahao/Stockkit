import { createServiceClient } from '@/lib/supabase/server';
import type { Json } from '@/lib/types';

/** Record operator and vendor mutations without interrupting the completed action. */
export async function recordAudit(
  actorId: string,
  action: string,
  targetId: string | null,
  detail: Json
): Promise<void> {
  try {
    const supabase = await createServiceClient();
    const { error } = await supabase.from('admin_audit').insert({
      admin_id: actorId,
      action,
      target_id: targetId,
      detail,
    });
    if (error) console.error('admin_audit insert failed', error.message);
  } catch (error) {
    console.error(
      'admin_audit insert failed',
      error instanceof Error ? error.message : 'Unexpected audit failure'
    );
  }
}
