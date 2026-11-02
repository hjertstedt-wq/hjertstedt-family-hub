import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function load(path, mocks = {}) {
  const js = ts.transpileModule(readFileSync(new URL('../' + path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const module = { exports: {} };
  new Function('module', 'exports', 'require', js)(module, module.exports, name => mocks[name] ?? require(name));
  return module.exports;
}
const selection = load('app/lib/integrations/google-selection.ts');
const { googleSelectionKey: key, selectFamilyCalendar } = selection;
const family = { id: 'family@group.calendar.google.com', summary: 'Family' };

test('exact Family wins; no case, translated, trimmed or primary fallback', () => {
  const others = ['Familj', 'family', 'Family ', 'My Family'].map((summary, i) => ({ id: String(i), summary, primary: true }));
  assert.equal(selectFamilyCalendar([...others, family], '0', null), family);
  assert.equal(selectFamilyCalendar(others, null, null), undefined);
  assert.equal(selectFamilyCalendar([...others, family], null, '0'), undefined);
});

test('duplicate names require a validated saved or explicit ID; stale IDs never authorize', () => {
  const second = { ...family, id: 'second' };
  assert.equal(selectFamilyCalendar([family, second], null, null), undefined);
  assert.equal(selectFamilyCalendar([family, second], second.id, null), second);
  assert.equal(selectFamilyCalendar([family, second], null, family.id), family);
  assert.equal(selectFamilyCalendar([family], 'removed', null), family);
  assert.equal(selectFamilyCalendar([family], null, 'someone-elses'), undefined);
});

test('route: server preference survives devices, isolates accounts and handles failures', async t => {
  const oldFetch = globalThis.fetch;
  const oldEnv = { ...process.env };
  Object.assign(process.env, {
    GOOGLE_OAUTH_APP_ORIGIN: 'https://staging.example',
    NEXT_PUBLIC_SUPABASE_URL: 'https://auth.example',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'publishable'
  });
  const auth = load('app/api/google/session-auth.ts');
  const store = load('app/api/google/selection-store.ts', { '../../lib/integrations/google-selection': selection });
  const route = load('app/api/google/family/route.ts', {
    '../session-auth': auth,
    '../access': {
      getGoogleAccess: async (_request, id) => ({ ok: true, accessToken: 'google-' + id, refreshable: true }),
      setGoogleAccessCookie() {}
    },
    '../../../lib/integrations/google-selection': selection,
    '../selection-store': store
  });
  let users, list, writes, eventIds, saveFails, listStatus, pages;
  function reset() {
    users = { alice: { id: 'alice', user_metadata: { unrelated: 'keep' } }, bob: { id: 'bob', user_metadata: {} } };
    list = [family, { id: 'wrong', summary: 'Familj', primary: true }];
    writes = []; eventIds = []; saveFails = false; listStatus = 200; pages = null;
  }
  reset();
  globalThis.fetch = async (url, options = {}) => {
    url = String(url);
    const bearer = options.headers.Authorization ?? options.headers.authorization;
    if (url === 'https://auth.example/auth/v1/user') {
      const id = bearer?.replace('Bearer ', '');
      if (!users[id]) return Response.json({}, { status: 401 });
      if (options.method === 'PUT') {
        writes.push({ id, body: JSON.parse(options.body) });
        if (saveFails) return Response.json({}, { status: 500 });
        Object.assign(users[id].user_metadata, JSON.parse(options.body).data);
      }
      return Response.json(users[id]);
    }
    if (url.includes('/users/me/calendarList')) {
      if (listStatus !== 200) return Response.json({}, { status: listStatus });
      return Response.json(pages ? pages(new URL(url)) : { items: list });
    }
    if (url.includes('/events')) {
      eventIds.push(decodeURIComponent(new URL(url).pathname.split('/')[4]));
      return Response.json({ items: [
        { id: 'event-1', summary: 'Family dinner', start: { dateTime: '2026-11-03T18:00:00+01:00' }, end: { dateTime: '2026-11-03T19:00:00+01:00' } },
        { id: 'cancelled', status: 'cancelled' }
      ] });
    }
    throw Error('Unexpected network request');
  };
  const call = async (id = 'alice', query = '') => {
    const response = await route.GET({ url: 'https://staging.example/api/google/family' + query, headers: new Headers({ Authorization: 'Bearer ' + id }) });
    assert.match(response.headers.get('cache-control'), /private, no-store/);
    return { status: response.status, data: await response.json() };
  };
  try {
    await t.test('automatic save and event display; fresh device reads same server ID', async () => {
      const first = await call();
      assert.equal(first.data.calendar.id, family.id);
      assert.equal(first.data.events.length, 1);
      assert.deepEqual(eventIds, [family.id]);
      assert.equal(users.alice.user_metadata[key], family.id);
      assert.equal(users.alice.user_metadata.unrelated, 'keep');
      assert.deepEqual(writes[0].body, { data: { [key]: family.id } });
      list.push({ ...family, id: 'duplicate' });
      const phone = await call(); // New request, no browser-local choice at all.
      assert.equal(phone.data.calendar.id, family.id);
      assert.equal(writes.length, 1);
      assert.equal((await call('bob')).data.status, 'choose_calendar');
      assert.equal(users.bob.user_metadata[key], undefined);
    });
    await t.test('unauthenticated and foreign IDs cannot read events or save', async () => {
      reset();
      assert.equal((await call('invalid')).status, 401);
      assert.equal((await call('alice', '?calendarId=foreign')).status, 404);
      assert.equal((await call('alice', '?calendarId=wrong')).status, 404);
      assert.equal(writes.length, 0); assert.equal(eventIds.length, 0);
    });
    await t.test('all Calendar List pages are searched before selection', async () => {
      reset();
      pages = url => url.searchParams.has('pageToken') ? { items: [family] } : { items: list.slice(1), nextPageToken: 'next' };
      assert.equal((await call()).data.calendar.id, family.id);
      reset(); pages = () => ({ items: [family], nextPageToken: 'more' });
      assert.equal((await call()).data.status, 'calendar_list_incomplete');
      assert.equal(writes.length, 0); assert.equal(eventIds.length, 0);
    });
    await t.test('no Family, denied Google access and failed server persistence are visible', async () => {
      reset(); list = [{ id: 'primary', summary: 'Familj' }];
      assert.equal((await call()).data.status, 'calendar_not_found');
      reset(); listStatus = 403;
      assert.equal((await call()).data.status, 'google_access_failed');
      reset(); saveFails = true;
      assert.equal((await call()).data.status, 'selection_save_failed');
      assert.equal(eventIds.length, 0);
    });
    await t.test('list action persists unique Family and explicit duplicate choice persists', async () => {
      reset();
      assert.equal((await call('alice', '?list=1')).data.selectionSaved, true);
      assert.equal(eventIds.length, 0);
      list.push({ ...family, id: 'second' });
      assert.equal((await call('bob', '?calendarId=second')).data.calendar.id, 'second');
      assert.equal(users.bob.user_metadata[key], 'second');
      assert.equal(users.alice.user_metadata[key], family.id);
    });
  } finally {
    globalThis.fetch = oldFetch;
    for (const key of Object.keys(process.env)) if (!(key in oldEnv)) delete process.env[key];
    Object.assign(process.env, oldEnv);
  }
});

test('Google OAuth cookies stay bound to their Hub user and missing grants require OAuth', async () => {
  const previous = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = 'ab'.repeat(32);
  try {
    const crypto = load('app/api/google/token-crypto.ts');
    const access = load('app/api/google/access.ts', { './token-crypto': crypto });
    const cookie = crypto.seal(JSON.stringify({ userId: 'alice', token: 'test-google-token', expiresAt: Date.now() + 3600000 }));
    const request = { cookies: { get: () => ({ value: cookie }) } };
    assert.equal((await access.getGoogleAccess(request, 'bob')).reason, 'wrong_user');
    assert.equal((await access.getGoogleAccess(request, 'alice')).accessToken, 'test-google-token');
    assert.equal((await access.getGoogleAccess({ cookies: { get: () => undefined } }, 'alice')).reason, 'not_connected');
  } finally {
    if (previous === undefined) delete process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
    else process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = previous;
  }
});
