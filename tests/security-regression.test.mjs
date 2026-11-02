import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("iCloud routes authenticate and never use shared Apple credentials", () => {
  for (const path of ["app/api/icloud/events/route.ts", "app/api/icloud/discover/route.ts", "app/api/icloud/connection/route.ts"]) {
    const code = source(path);
    assert.match(code, /integrationUser\(request\)/);
    assert.doesNotMatch(code, /ICLOUD_APP_PASSWORD|ICLOUD_APPLE_ID/);
  }
  const store = source("app/lib/server/integration-store.ts");
  assert.match(store, /authenticatedUserId\(request\)/);
  assert.match(store, /private, no-store/);
  assert.match(store, /encryptConfig/);
});

test("sports preview is authenticated, source allowlisted and no-store", () => {
  const code = source("app/api/integrations/feed-preview/route.ts");
  assert.match(code, /authenticatedUserId\(req\)/);
  assert.match(code, /status:\s*401/);
  assert.match(code, /cal\.svenskalag\.se/);
  assert.match(code, /publicweb\.sportadmin\.se/);
  assert.match(code, /redirect:\s*"manual"/);
  assert.match(code, /no-store/);
  assert.doesNotMatch(code, /\.insert\(|\.upsert\(/);
});

test("sports overlay uses account-scoped selections and no database writes", () => {
  const lib = source("app/lib/integrations/pilot-sports.ts");
  const hook = source("app/lib/integrations/use-sports-calendar.ts");
  const page = source("app/calendar/page.tsx");
  assert.match(lib, /selectedPrefix\s*\+\s*userId/);
  assert.match(lib, /temporaryPrefix\s*\+\s*userId/);
  assert.match(hook, /readSelectedSportsFeeds\(user\.id\)/);
  assert.match(hook, /readTemporarySportsFeed\(user\.id\)/);
  assert.match(page, /useSportsCalendar\(\)/);
  assert.doesNotMatch(hook, /\.from\("calendar_events"\)/);
});

test("external account passwords are never entered in connection screen", () => {
  const code = source("app/connections/page.tsx");
  assert.doesNotMatch(code, /<input[^>]*type=["']password["']/i);
  assert.match(code, /publicSportsFeeds/);
});

test("alpine training validates limits and exposes partial rollback failure", () => {
  const code = source("app/ski/training/page.tsx");
  assert.match(code, /days>14/);
  assert.match(code, /selected\.length/);
  assert.match(code, /rollbackError/);
  assert.match(code, /Delvis sparat/);
});
