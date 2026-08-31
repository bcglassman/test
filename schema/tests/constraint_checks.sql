\set ON_ERROR_STOP 0
-- fixtures
INSERT INTO organisers (id,name,slug) VALUES ('11111111-1111-1111-1111-111111111111','East Coast Run Club','ecrc');
INSERT INTO activities (id,title,slug,dedupe_key,organiser)
  VALUES ('22222222-2222-2222-2222-222222222222','Tuesday Easy 8km','tue-8km','ecrc|tue-8km|2026-09-01', '11111111-1111-1111-1111-111111111111');

\echo '--- TEST 1: approving with unconfirmed enrichment must FAIL'
UPDATE activities SET status='approved' WHERE slug='tue-8km';

\echo '--- TEST 2: approving after enrichment confirmed must SUCCEED'
UPDATE activities SET enrichment_status='confirmed', status='approved' WHERE slug='tue-8km';
SELECT status, enrichment_status FROM activities WHERE slug='tue-8km';

\echo '--- TEST 3: publishing a non-reputable resource must FAIL'
INSERT INTO resources (url,type,title,status) VALUES ('https://x.test/a','video','Heat training','published');

\echo '--- TEST 4: reputable resource publishes fine'
INSERT INTO resources (url,type,title,credibility,status) VALUES ('https://x.test/b','video','Heat training','reputable','published');

\echo '--- TEST 5: event_spotlight post without an activity must FAIL'
INSERT INTO posts (type,headline,scheduled_for) VALUES ('event_spotlight','No subject','2026-09-01');

\echo '--- TEST 6: valid spotlight post succeeds'
INSERT INTO posts (id,type,activity,headline,scheduled_for,slot)
  VALUES ('33333333-3333-3333-3333-333333333333','event_spotlight','22222222-2222-2222-2222-222222222222','Tuesday run','2026-09-01','morning');

\echo '--- TEST 7: second spotlight in same day+slot must FAIL'
INSERT INTO posts (type,activity,headline,scheduled_for,slot)
  VALUES ('event_spotlight','22222222-2222-2222-2222-222222222222','Another run','2026-09-01','morning');

\echo '--- TEST 8: double-publish to same channel must FAIL (idempotency)'
INSERT INTO publications (post,channel,idempotency_key)
  SELECT '33333333-3333-3333-3333-333333333333', id, '33333333-3333-3333-3333-333333333333:telegram' FROM channels WHERE key='telegram';
INSERT INTO publications (post,channel,idempotency_key)
  SELECT '33333333-3333-3333-3333-333333333333', id, '33333333-3333-3333-3333-333333333333:telegram-retry' FROM channels WHERE key='telegram';

\echo '--- TEST 9: two open enrichment proposals for same field must FAIL'
INSERT INTO enrichment_proposals (activity,field_key,proposed_value) VALUES ('22222222-2222-2222-2222-222222222222','solo_friendly','"yes"');
INSERT INTO enrichment_proposals (activity,field_key,proposed_value) VALUES ('22222222-2222-2222-2222-222222222222','solo_friendly','"probably"');

\echo '--- TEST 10: marketing consent without a timestamp must FAIL'
INSERT INTO people (email,marketing_consent) VALUES ('a@test.sg', true);

\echo '--- TEST 11: empty slots are queryable (the daily-gap check)'
SELECT s.slot FROM (VALUES ('morning'),('midday'),('evening')) AS s(slot)
WHERE NOT EXISTS (SELECT 1 FROM posts p WHERE p.scheduled_for='2026-09-01' AND p.slot=s.slot);
