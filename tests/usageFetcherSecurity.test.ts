import assert from 'node:assert/strict';

import { __usageFetcherTestHooks } from '../src/lib/usage-fetcher';

async function main() {
  const baseUrl = new URL('https://api.openai.com/v1/organization/usage/completions?start_time=2025-09-01T00:00:00Z');

  {
    const result = __usageFetcherTestHooks.sanitizeAdminNextPageUrlForTest(baseUrl, '?page=abc123');
    assert.equal(result.ok, true, 'relative query should be accepted');
    if (result.ok) {
      assert.equal(
        result.url.toString(),
        'https://api.openai.com/v1/organization/usage/completions?page=abc123'
      );
    }
  }

  {
    const result = __usageFetcherTestHooks.sanitizeAdminNextPageUrlForTest(
      baseUrl,
      'https://attacker.example/steal'
    );
    assert.equal(result.ok, false, 'unexpected host must be rejected');
    if (!result.ok) {
      assert.equal(result.reason, 'unexpected-host');
    }
  }

  {
    const result = __usageFetcherTestHooks.sanitizeAdminNextPageUrlForTest(
      baseUrl,
      'https://api.openai.com/v1/auth/me'
    );
    assert.equal(result.ok, false, 'unexpected path must be rejected');
    if (!result.ok) {
      assert.equal(result.reason, 'unexpected-path');
    }
  }

  {
    const result = __usageFetcherTestHooks.sanitizeAdminNextPageUrlForTest(baseUrl, 'not a url');
    assert.equal(result.ok, false, 'invalid URLs should be rejected');
    if (!result.ok) {
      assert.equal(result.reason, 'parse-error');
    }
  }
}

main()
  .then(() => {
    console.log('usageFetcher security pagination tests passed');
  })
  .catch((error) => {
    console.error('usageFetcher security pagination tests failed');
    console.error(error);
    process.exit(1);
  });
