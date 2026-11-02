import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = readFileSync(new URL('../app/lib/session-recovery.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const module = { exports: {} };
new Function('module', 'exports', js)(module, module.exports);
const { loadWithSessionRecovery, SessionExpiredError } = module.exports;
const valid = id => ({ data: { user: { id, email: 'family@example.com' } }, error: null });
const expired = { message: 'JWT expired', code: 'PGRST301', status: 401 };
function client(identities, refreshError = null) {
  let refreshes = 0;
  return { auth: {
    getUser: async () => identities.length > 1 ? identities.shift() : identities[0],
    refreshSession: async () => { refreshes++; return { data: { session: refreshError ? null : {} }, error: refreshError }; }
  }, refreshCount: () => refreshes };
}

test('normal session reads once without forcing refresh', async () => {
  const c = client([valid('alice')]); let reads = 0;
  const result = await loadWithSessionRecovery(c, async () => { reads++; return { errors: [], persons: ['Alice'] }; });
  assert.equal(result.user.id, 'alice'); assert.equal(reads, 1); assert.equal(c.refreshCount(), 0);
});
test('JWT rejected by Auth is refreshed and validated before database reads', async () => {
  const c = client([{ data: { user: null }, error: expired }, valid('alice')]); let reads = 0;
  await loadWithSessionRecovery(c, async () => { reads++; return { errors: [] }; });
  assert.equal(reads, 1); assert.equal(c.refreshCount(), 1);
});
test('database JWT expiry triggers one refresh then retries both reads', async () => {
  const c = client([valid('alice')]); let reads = 0;
  const result = await loadWithSessionRecovery(c, async () => ({ errors: ++reads === 1 ? [expired, expired] : [], persons: ['Family'] }));
  assert.deepEqual(result.result.persons, ['Family']); assert.equal(reads, 2); assert.equal(c.refreshCount(), 1);
});
test('missing or revoked session requires login without reading data', async () => {
  for (const failure of [
    { data: { user: null }, error: { name: 'AuthSessionMissingError', message: 'missing' } },
    { data: { user: null }, error: { status: 401, message: 'invalid JWT' } }
  ]) {
    const c = client([failure]); let reads = 0;
    await assert.rejects(loadWithSessionRecovery(c, async () => { reads++; return { errors: [] }; }), SessionExpiredError);
    assert.equal(reads, 0);
  }
});
test('invalid refresh and repeatedly expired JWT cannot loop', async () => {
  const c = client([valid('alice')], { status: 400, message: 'Invalid refresh token' }); let reads = 0;
  await assert.rejects(loadWithSessionRecovery(c, async () => { reads++; return { errors: [expired] }; }), SessionExpiredError);
  assert.equal(reads, 1); assert.equal(c.refreshCount(), 1);
  const repeated = client([valid('alice')]); reads = 0;
  await assert.rejects(loadWithSessionRecovery(repeated, async () => { reads++; return { errors: [expired] }; }), SessionExpiredError);
  assert.equal(reads, 2); assert.equal(repeated.refreshCount(), 1);
});
test('account switch during refresh never retries another users data', async () => {
  const c = client([valid('alice'), valid('bob')]); let reads = 0;
  await assert.rejects(loadWithSessionRecovery(c, async () => { reads++; return { errors: [expired] }; }), SessionExpiredError);
  assert.equal(reads, 1);
});
test('network errors and permission errors are not treated as missing family data', async () => {
  const network = client([{ data: { user: null }, error: { message: 'Failed to fetch', status: 0 } }]);
  await assert.rejects(loadWithSessionRecovery(network, async () => ({ errors: [] })), e => !(e instanceof SessionExpiredError));
  const c = client([valid('alice')]);
  const result = await loadWithSessionRecovery(c, async () => ({ errors: [{ message: 'permission denied', code: '42501' }] }));
  assert.equal(result.result.errors[0].code, '42501'); assert.equal(c.refreshCount(), 0);
});
test('home and login do not show empty data or trust a stale local identity on failure', () => {
  const home = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
  const login = readFileSync(new URL('../app/login/page.tsx', import.meta.url), 'utf8');
  assert.match(home, /error \? null : persons.length === 0/);
  assert.match(home, /calendarError \? null : upcoming.length === 0/);
  assert.match(home, /login\?reason=session_expired/);
  assert.doesNotMatch(login, /auth.getSession\(/);
  assert.match(login, /!error && data.user/);
});
