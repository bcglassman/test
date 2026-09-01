-- =============================================================================
-- Meet in Motion - migration 005
--
-- Seeds the Singapore club ecosystem we are starting with, plus two channel
-- decisions:
--
--   * Instagram is a SOURCE, not a channel. Most of these clubs publish their
--     weekly sessions there and nowhere else. It cannot be scraped - that
--     breaks Meta's terms and gets blocked fast - so the route is a person
--     seeing a post and submitting the link, which `submissions` already
--     handles. The source row exists so those submissions have a provenance.
--
--   * We post to the website, Telegram and WhatsApp. Instagram, newsletter and
--     push are deactivated until there is a reason and a pipeline for them
--     (Instagram in particular needs an image for every post, and there is no
--     image pipeline).
--
-- Organisers are seeded as 'draft': being on this list is not the same as
-- having checked they are still active and that we may list them.
-- =============================================================================

UPDATE channels SET is_active = false WHERE key IN ('instagram', 'newsletter', 'push');
UPDATE channels SET is_active = true  WHERE key IN ('website', 'telegram', 'whatsapp');

INSERT INTO sources (name, slug, type, is_active, poll_interval_minutes, terms_note, config)
VALUES (
  'Instagram (manual submission)',
  'instagram-manual',
  'submission',
  true,
  0,
  'Instagram prohibits automated scraping and blocks it in practice. Events reach us '
  'when a person sees a post and submits the link; this source records that provenance. '
  'Do not build an automated collector against it.',
  '{"how":"paste the post URL into the submit form"}'::jsonb
)
ON CONFLICT (slug) DO NOTHING;

-- The starting ecosystem. Singapore has an unusually dense run-club scene, and
-- these are the clubs and venues to approach first.
INSERT INTO organisers (name, slug, type, status) VALUES
  -- running
  ('Fast and Free Running Club',        'ffrc',                  'club', 'draft'),
  ('Run.JPG',                           'run-jpg',               'club', 'draft'),
  ('Running Department',                'running-department',    'club', 'draft'),
  ('Singapore Runners Club',            'singapore-runners-club','club', 'draft'),
  ('ASICS Running Club Singapore',      'asics-running-club-sg', 'brand', 'draft'),
  ('PUMA Nitro Run Club Singapore',     'puma-nitro-run-club-sg','brand', 'draft'),
  ('adidas Runners Singapore',          'adidas-runners-sg',     'brand', 'draft'),
  ('Garmin Run Club Singapore',         'garmin-run-club-sg',    'brand', 'draft'),
  ('The High Panters',                  'the-high-panters',      'club', 'draft'),
  ('The Social Running Club',           'the-social-running-club','club', 'draft'),
  ('Happy Pace Club',                   'happy-pace-club',       'club', 'draft'),
  ('LAST Running',                      'last-running',          'club', 'draft'),
  ('Beyond Miles Club',                 'beyond-miles-club',     'club', 'draft'),
  ('Easy Pace Run Club',                'easy-pace-run-club',    'club', 'draft'),
  ('Urban Milers',                      'urban-milers',          'club', 'draft'),
  ('lululemon Run Club Singapore',      'lululemon-run-club-sg', 'brand', 'draft'),
  ('New Balance Run Club Singapore',    'new-balance-run-club-sg','brand','draft'),
  ('SAFRA Running Club',                'safra-running-club',    'club', 'draft'),
  ('MR25',                              'mr25',                  'club', 'draft'),
  -- racket
  ('The Padel Co — Bugis',              'the-padel-co-bugis',    'venue_operator', 'draft'),
  ('Prime Padel',                       'prime-padel',           'venue_operator', 'draft'),
  ('Pickle Padel Movement',             'pickle-padel-movement', 'club', 'draft'),
  ('PadelStation THE CHEVRONS',         'padelstation-chevrons', 'venue_operator', 'draft'),
  ('Mandala Racquet Club',              'mandala-racquet-club',  'venue_operator', 'draft'),
  -- climbing
  ('Boulder Movement Downtown',         'boulder-movement-downtown', 'venue_operator', 'draft'),
  ('Climba Gym',                        'climba-gym',            'venue_operator', 'draft'),
  ('Kinetics Climbing',                 'kinetics-climbing',     'venue_operator', 'draft')
ON CONFLICT (slug) DO NOTHING;

COMMENT ON TABLE organisers IS
    'Clubs, gyms, race organisers. Separate from venues - a club is not a park. '
    'Seeded rows start as draft: appearing on our starting list is not the same as '
    'having confirmed the club is active and content to be listed.';
