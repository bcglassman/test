\set ON_ERROR_STOP 0
INSERT INTO organisers (id,name,slug) VALUES ('11111111-1111-1111-1111-111111111111','East Coast Run Club','ecrc');
INSERT INTO people (id,email,display_name) VALUES ('aaaaaaaa-0000-0000-0000-000000000001','runner@test.sg','Wei Ming');
INSERT INTO people (id,email,display_name) VALUES ('aaaaaaaa-0000-0000-0000-000000000002','solo@test.sg','Sarah');
INSERT INTO activities (id,title,slug,dedupe_key,organiser,enrichment_status,status,origin)
  VALUES ('22222222-2222-2222-2222-222222222222','Tuesday Easy 8km','tue-8km','k1','11111111-1111-1111-1111-111111111111','confirmed','published','submitted');

\echo '=== T1: social is now a valid format'
UPDATE activities SET format='social' WHERE slug='tue-8km';
\echo '=== T2: a bogus format is still rejected'
UPDATE activities SET format='karaoke' WHERE slug='tue-8km';
UPDATE activities SET format='recurring' WHERE slug='tue-8km';

\echo '=== T3: accepted submission with no resulting activity must FAIL'
INSERT INTO submissions (title,submitter_email,status,reviewed_at) VALUES ('Ghost run','x@test.sg','accepted',now());
\echo '=== T4: accepted submission linked to an activity is fine'
INSERT INTO submissions (title,submitter_email,status,reviewed_at,activity) VALUES ('Real run','x@test.sg','accepted',now(),'22222222-2222-2222-2222-222222222222');
\echo '=== T5: submission with no way to contact the submitter must FAIL'
INSERT INTO submissions (title) VALUES ('Anonymous');
\echo '=== T6: reviewed submission without a review timestamp must FAIL'
INSERT INTO submissions (title,submitter_email,status) VALUES ('Rejected one','x@test.sg','rejected');

\echo '=== T7: two pending claims by the same person on the same organiser must FAIL'
INSERT INTO organiser_claims (organiser,person,evidence) VALUES ('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000001','I run it');
INSERT INTO organiser_claims (organiser,person,evidence) VALUES ('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000001','Again');
\echo '=== T8: approved claim without review timestamp must FAIL'
INSERT INTO organiser_claims (organiser,person,status) VALUES ('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000002','approved');

\echo '=== T9: magic-link token hash must be unique'
INSERT INTO auth_tokens (person,token_hash,expires_at) VALUES ('aaaaaaaa-0000-0000-0000-000000000001','deadbeef',now()+interval '15 min');
INSERT INTO auth_tokens (person,token_hash,expires_at) VALUES ('aaaaaaaa-0000-0000-0000-000000000002','deadbeef',now()+interval '15 min');

\echo '=== T10: duplicate interest in the same category must FAIL'
INSERT INTO person_interests (person,category) SELECT 'aaaaaaaa-0000-0000-0000-000000000001', id FROM categories WHERE slug='running-endurance';
INSERT INTO person_interests (person,category) SELECT 'aaaaaaaa-0000-0000-0000-000000000001', id FROM categories WHERE slug='running-endurance';

\echo '=== T11: social proof counts - withdrawn and no-shows must be excluded'
INSERT INTO interest_registrations (activity,person,is_first_timer,status) VALUES ('22222222-2222-2222-2222-222222222222','aaaaaaaa-0000-0000-0000-000000000001',true,'registered');
INSERT INTO interest_registrations (activity,person,is_first_timer,status) VALUES ('22222222-2222-2222-2222-222222222222','aaaaaaaa-0000-0000-0000-000000000002',false,'withdrawn');
SELECT interested_count, first_timer_count FROM activity_interest_stats WHERE activity='22222222-2222-2222-2222-222222222222';

\echo '=== T12: show_publicly defaults to opt-OUT'
SELECT DISTINCT show_publicly FROM interest_registrations;

\echo '=== T13: the 001 enrichment gate still holds after migration'
INSERT INTO activities (title,slug,dedupe_key,status) VALUES ('Unconfirmed','unconf','k2','approved');
