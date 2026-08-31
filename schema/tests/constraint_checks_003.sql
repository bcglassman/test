\set ON_ERROR_STOP 0
INSERT INTO people (id,email,display_name) VALUES ('bbbb0000-0000-0000-0000-000000000001','coach@test.sg','Aisha');
INSERT INTO activities (id,title,slug,dedupe_key,enrichment_status,status)
  VALUES ('cccc0000-0000-0000-0000-000000000001','ECP 10k','ecp-10k','k9','confirmed','published');
INSERT INTO posts (id,type,activity,headline,scheduled_for,slot)
  VALUES ('dddd0000-0000-0000-0000-000000000001','event_spotlight','cccc0000-0000-0000-0000-000000000001','10k','2026-09-02','morning');

\echo '=== A1: WhatsApp is an assisted channel, Telegram is not'
SELECT key, delivery_mode FROM channels WHERE key IN ('whatsapp','telegram') ORDER BY key;

\echo '=== A2: awaiting_manual is a valid publication state'
INSERT INTO publications (id,post,channel,idempotency_key,status,manual_token_hash,manual_token_expires_at)
  SELECT 'eeee0000-0000-0000-0000-000000000001','dddd0000-0000-0000-0000-000000000001',id,'d1:whatsapp','awaiting_manual','hash-abc',now()+interval '2 days' FROM channels WHERE key='whatsapp';

\echo '=== A3: marking published without a timestamp must FAIL'
UPDATE publications SET status='published' WHERE idempotency_key='d1:whatsapp';
\echo '=== A4: marking published with timestamp + who sent it succeeds'
UPDATE publications SET status='published', published_at=now(), marked_sent_by='bbbb0000-0000-0000-0000-000000000001' WHERE idempotency_key='d1:whatsapp';

\echo '=== A5: two publications cannot share a manual token'
INSERT INTO publications (post,channel,idempotency_key,status,manual_token_hash)
  SELECT 'dddd0000-0000-0000-0000-000000000001',id,'d1:push','awaiting_manual','hash-abc' FROM channels WHERE key='push';

\echo '=== A6: the pending-manual queue view works'
SELECT channel_key, headline FROM pending_manual_publications;

\echo '=== C1: a coach who works with minors cannot be self-declared only'
INSERT INTO coaches (slug,display_name,coach_type,works_with_minors,verification_status,status)
  VALUES ('a-1','Aisha','professional',true,'self_declared','published');
\echo '=== C2: documents_checked allows it'
INSERT INTO coaches (id,slug,display_name,coach_type,works_with_minors,verification_status,credentials,status)
  VALUES ('ffff0000-0000-0000-0000-000000000001','a-2','Aisha','professional',true,'documents_checked','SNOC L2','published');

\echo '=== C3: an unverified coach cannot be published'
INSERT INTO coaches (slug,display_name,coach_type,status) VALUES ('b-1','Rando','peer','published');
\echo '=== C4: a peer coach, self-declared, publishes fine (no credentials needed)'
INSERT INTO coaches (id,slug,display_name,coach_type,verification_status,status)
  VALUES ('ffff0000-0000-0000-0000-000000000002','b-2','Wei','peer','self_declared','published');
\echo '=== C5: a PROFESSIONAL with no credentials recorded cannot be published'
INSERT INTO coaches (slug,display_name,coach_type,verification_status,status)
  VALUES ('c-1','Claims Pro','professional','self_declared','published');

\echo '=== C6: a rate without a unit must FAIL'
INSERT INTO coaches (slug,display_name,coach_type,rate_min) VALUES ('d-1','Ratey','peer',80);

\echo '=== C7: forwarding an enquiry without consent must FAIL'
INSERT INTO coach_enquiries (coach,enquirer_email,status,forwarded_at)
  VALUES ('ffff0000-0000-0000-0000-000000000002','me@test.sg','forwarded',now());
\echo '=== C8: with consent it is fine'
INSERT INTO coach_enquiries (coach,enquirer_email,activity,status,consent_share_contact,forwarded_at)
  VALUES ('ffff0000-0000-0000-0000-000000000002','me@test.sg','cccc0000-0000-0000-0000-000000000001','forwarded',true,now());

\echo '=== C9: a coach post must reference a coach'
INSERT INTO posts (type,headline,scheduled_for,slot) VALUES ('coach','Meet Wei','2026-09-03','morning');
\echo '=== C10: a valid coach post inserts'
INSERT INTO posts (type,coach,headline,scheduled_for,slot) VALUES ('coach','ffff0000-0000-0000-0000-000000000002','Meet Wei','2026-09-03','morning');
\echo '=== C11: an event_spotlight may not also carry a coach'
INSERT INTO posts (type,activity,coach,headline,scheduled_for,slot)
  VALUES ('event_spotlight','cccc0000-0000-0000-0000-000000000001','ffff0000-0000-0000-0000-000000000002','Mixed','2026-09-04','morning');

\echo '=== C12: contextual match - run coaches for a running event, by category join'
INSERT INTO coach_categories (coach,category) SELECT 'ffff0000-0000-0000-0000-000000000002', id FROM categories WHERE slug='running-endurance';
UPDATE activities SET category=(SELECT id FROM categories WHERE slug='running-endurance') WHERE slug='ecp-10k';
SELECT c.display_name, c.coach_type
FROM activities a
JOIN coach_categories cc ON cc.category = a.category
JOIN coaches c ON c.id = cc.coach AND c.status='published'
WHERE a.slug='ecp-10k';

\echo '=== C13: earlier gates still hold'
\echo '=== A6b: queue shows unsent work, and empties when marked sent'
INSERT INTO posts (id,type,activity,headline,scheduled_for,slot)
  VALUES ('dddd0000-0000-0000-0000-000000000002','event_spotlight','cccc0000-0000-0000-0000-000000000001','Sunday long run','2026-09-05','morning');
INSERT INTO publications (post,channel,idempotency_key,status,manual_token_hash,manual_token_expires_at)
  SELECT 'dddd0000-0000-0000-0000-000000000002',id,'d2:whatsapp','awaiting_manual','hash-xyz',now()+interval '2 days' FROM channels WHERE key='whatsapp';
SELECT channel_key, headline, scheduled_for, slot FROM pending_manual_publications;
UPDATE publications SET status='published', published_at=now() WHERE idempotency_key='d2:whatsapp';
\echo '-- after marking sent:'
SELECT count(*) AS still_pending FROM pending_manual_publications;

\echo '=== C13: earlier gates still hold'
INSERT INTO activities (title,slug,dedupe_key,status) VALUES ('Unconf','unconf2','k10','approved');
