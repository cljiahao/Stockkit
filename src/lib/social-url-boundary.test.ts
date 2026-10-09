import { expect, it } from 'vitest';
import { socialLinksSchema } from './schemas';
it.each(['javascript:alert(1)', 'data:text/html,hello', 'file:///tmp/test', 'ftp://example.com'])(
  'rejects non-web profile links: %s',
  (website) => {
    expect(socialLinksSchema.safeParse({ website }).success).toBe(false);
  }
);
it.each(['https://example.com', 'http://example.com', '', undefined])(
  'accepts web links and omitted values: %s',
  (website) => {
    expect(socialLinksSchema.safeParse({ website }).success).toBe(true);
  }
);
