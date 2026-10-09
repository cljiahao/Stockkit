type Result<T> = { data: T[] | null; error: { message: string } | null };

/** Read ordered UUID-keyed pages until empty, including API caps below our limit.
 * Callers recreate their scoped query each time. A failed or stalled page never
 * returns a successful partial collection. This is not a database snapshot. */
export async function readAllRows<T extends { id: string }>(
  page: (after: string | null) => PromiseLike<Result<T>>
): Promise<Result<T>> {
  const rows: T[] = [];
  let after: string | null = null;
  try {
    while (true) {
      const result = await page(after);
      if (result.error) return { data: null, error: result.error };
      const batch = result.data ?? [];
      if (batch.length === 0) return { data: rows, error: null };
      const next = batch[batch.length - 1].id;
      if (!next || (after !== null && next <= after)) {
        return { data: null, error: { message: 'Collection cursor did not advance' } };
      }
      rows.push(...batch);
      after = next;
    }
  } catch {
    return { data: null, error: { message: 'Collection read failed' } };
  }
}
