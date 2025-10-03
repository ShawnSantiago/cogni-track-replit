import assert from 'node:assert/strict';

import {
  __usageFetcherTestHooks,
  type UsageEventData,
} from '../src/lib/usage-fetcher';

class MockDb {
  public insertAttempts = 0;
  public manualInsertCount = 0;
  public selectCalls = 0;
  public updateCalls = 0;

  constructor(private readonly options: { throwOnConflict?: Error; existingId?: number } = {}) {}

  insert() {
    this.insertAttempts += 1;
    const self = this;
    return {
      values() {
        return this;
      },
      onConflictDoUpdate() {
        if (self.options.throwOnConflict) {
          throw self.options.throwOnConflict;
        }
        return this;
      },
      returning() {
        self.manualInsertCount += 1;
        return [{ inserted: true }];
      },
    };
  }

  select() {
    this.selectCalls += 1;
    const existing = this.options.existingId;
    return {
      from: () => ({
        where: () => ({
          limit: () => (existing === undefined ? [] : [{ id: existing }]),
        }),
      }),
    };
  }

  update() {
    const self = this;
    return {
      set() {
        return {
          where() {
            self.updateCalls += 1;
            return [];
          },
        };
      },
    };
  }
}

function buildSampleUsagePayload(overrides: Partial<UsageEventData> = {}) {
  const baseUsage: UsageEventData = {
    model: 'gpt-4o-mini',
    tokensIn: 100,
    tokensOut: 50,
    costEstimate: 0.123456,
    timestamp: new Date('2025-10-02T00:00:00Z'),
    windowStart: new Date('2025-10-02T00:00:00Z'),
    windowEnd: new Date('2025-10-03T00:00:00Z'),
  };
  return __usageFetcherTestHooks.buildUsageEventInsertPayloadForTest(
    42,
    { ...baseUsage, ...overrides }
  );
}

async function main() {
  {
    // SQLSTATE detection guards fallback
    assert.equal(__usageFetcherTestHooks.isConstraintMissingError({ code: '42P10' }), true);
    assert.equal(__usageFetcherTestHooks.isConstraintMissingError({ code: '42704' }), true);
    assert.equal(__usageFetcherTestHooks.isConstraintMissingError({ code: '23505' }), false);
    assert.equal(__usageFetcherTestHooks.isConstraintMissingError(new Error('boom')), false);
  }

  {
    // Manual dedupe kicks in when constraint is missing and inserts a new row
    __usageFetcherTestHooks.resetConstraintWarningFlag();
    const warnings: unknown[] = [];
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      warnings.push(args);
    };

    const missingConstraintError = Object.assign(new Error('no unique constraint'), {
      code: '42P10',
    });
    const db = new MockDb({ throwOnConflict: missingConstraintError });
    const payload = buildSampleUsagePayload();

    const result = await __usageFetcherTestHooks.upsertUsageEventForTest(db as unknown, payload);

    assert.equal(result, 'inserted');
    assert.equal(db.insertAttempts, 2, 'should attempt insert twice (conflict + fallback)');
    assert.equal(db.manualInsertCount, 1, 'manual insert should succeed once');
    assert.equal(db.selectCalls, 1, 'manual dedupe should query existing rows');
    assert.equal(db.updateCalls, 0, 'no update when record absent');
    assert.equal(warnings.length, 1, 'should log a single warning when fallback activates');
    const [firstWarningMessage] = (warnings[0] as unknown[] | undefined) ?? [];
    assert.match(String(firstWarningMessage ?? ''), /usage_admin_bucket_idx/);

    console.warn = originalWarn;
  }

  {
    // Manual dedupe updates existing rows without duplicating data
    __usageFetcherTestHooks.resetConstraintWarningFlag();
    const missingConstraintError = Object.assign(new Error('no unique constraint'), {
      code: '42704',
    });
    const db = new MockDb({ throwOnConflict: missingConstraintError, existingId: 99 });
    const payload = buildSampleUsagePayload({ tokensOut: 200 });

    const result = await __usageFetcherTestHooks.upsertUsageEventForTest(db as unknown, payload);

    assert.equal(result, 'updated');
    assert.equal(db.insertAttempts, 2, 'should reattempt insert after conflict');
    assert.equal(db.manualInsertCount, 0, 'manual insert skipped when row exists');
    assert.equal(db.selectCalls, 1, 'manual dedupe should still query for existing row');
    assert.equal(db.updateCalls, 1, 'existing row should be updated once');
  }

  {
    // Non matching SQLSTATE errors still surface to callers
    __usageFetcherTestHooks.resetConstraintWarningFlag();
    const unexpectedError = Object.assign(new Error('other failure'), { code: 'XX000' });
    const db = new MockDb({ throwOnConflict: unexpectedError });
    const payload = buildSampleUsagePayload();
    let caught = false;
    try {
      await __usageFetcherTestHooks.upsertUsageEventForTest(db as unknown, payload);
    } catch (error) {
      caught = true;
      const typedError = error as Error & { code?: string };
      assert.equal(typedError, unexpectedError);
    }
    assert.equal(caught, true, 'unexpected errors should bubble up');
  }
}

main()
  .then(() => {
    console.log('usageFetcher constraint fallback tests passed');
  })
  .catch((error) => {
    console.error('usageFetcher constraint fallback tests failed');
    console.error(error);
    process.exit(1);
  });
