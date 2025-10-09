import assert from 'node:assert/strict';

import { parseUsageMode, isUsageMode, toIsoTimestamp } from '../src/lib/provider-key-utils';

{
  const value = parseUsageMode('standard');
  assert.equal(value, 'standard');
}

{
  const value = parseUsageMode('ADMIN');
  assert.equal(value, 'admin');
}

{
  const value = parseUsageMode('unsupported');
  assert.equal(value, null);
}

{
  const fallback = parseUsageMode(undefined);
  assert.equal(fallback, null);
}

{
  assert.equal(isUsageMode('admin'), true);
  assert.equal(isUsageMode('STANDARD'), true);
  assert.equal(isUsageMode('invalid'), false);
  assert.equal(isUsageMode(null), false);
}

{
  const iso = toIsoTimestamp(new Date('2025-01-02T03:04:05Z'));
  assert.equal(iso, '2025-01-02T03:04:05.000Z');
  const fallback = toIsoTimestamp('not-a-date');
  assert.equal(fallback, new Date(0).toISOString());
}
