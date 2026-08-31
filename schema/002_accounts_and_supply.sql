-- =============================================================================
-- Meet in Motion - migration 002
--
-- Adds three things settled after the v1 product review:
--
--   1. Lightweight accounts (magic link, no passwords) so a person can record
--      their interests and come back to a list of what they registered for.
--   2. Public social proof on activity pages - counts only, never identities.
--   3. All three supply modes: aggregation (already present via sources),
--      community submissions, and organiser-claimed pages.
--
-- Requires 001_init.sql.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Accounts
--
-- Magic link only: we email a single-use link, exchange it for a session, and
-- never store a password. No password column, no reset flow, no credential to
-- leak. Both tables store a SHA-256 hash of the token, never the token itself -
-- a database leak must not hand someone a working login.
-- -----------------------------------------------------------------------------

ALTER TABLE people
    ADD COLUMN display_name      varchar(120),
    ADD COLUMN avatar_color      varchar(7),
    ADD COLUMN email_verified_at timestamptz,
    ADD COLUMN last_login_at     timestamptz;

COMMENT ON COLUMN people.display_name IS
    'Shown publicly only where the person has opted in. Initials derived from this '
    'drive the avatar chip - v1 stores no uploaded images.';
COMMENT ON COLUMN people.avatar_color IS
    'Hex chip colour, assigned at signup so a person looks consistent across the site.';

CREATE TABLE auth_tokens (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    person        uuid NOT NULL REFERENCES people (id) ON DELETE CASCADE,
    token_hash    varchar(64) NOT NULL UNIQUE,
    purpose       varchar(20) NOT NULL DEFAULT 'login'
                  CHECK (purpose IN ('login', 'email_verify')),
    expires_at    timestamptz NOT NULL,
    consumed_at   timestamptz,
    requested_ip  inet,
    date_created  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE auth_tokens IS
    'Single-use magic links. Store only the SHA-256 hash; issue links with a short '
    'expiry (15 minutes) and mark consumed_at on first use so a forwarded email '
    'cannot be replayed.';

CREATE INDEX auth_tokens_person_idx  ON auth_tokens (person);
CREATE INDEX auth_tokens_cleanup_idx ON auth_tokens (expires_at)
    WHERE consumed_at IS NULL;

CREATE TABLE auth_sessions (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    person        uuid NOT NULL REFERENCES people (id) ON DELETE CASCADE,
    token_hash    varchar(64) NOT NULL UNIQUE,
    expires_at    timestamptz NOT NULL,
    last_seen_at  timestamptz,
    user_agent    varchar(400),
    revoked_at    timestamptz,
    date_created  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX auth_sessions_person_idx ON auth_sessions (person);

-- What a person says they're into. Drives segmented posting and the
-- "recommended for you" surface. Reuses the activity taxonomy so a person's
-- interests and an activity's category are the same vocabulary.
CREATE TABLE person_interests (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    person        uuid NOT NULL REFERENCES people (id) ON DELETE CASCADE,
    category      uuid NOT NULL REFERENCES categories (id) ON DELETE CASCADE,
    date_created  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT person_interests_unique UNIQUE (person, category)
);

-- -----------------------------------------------------------------------------
-- 2. Social proof
--
-- Counts only. The first-timer count is the most reassuring number on the page:
-- it says other people also arrived not knowing anyone.
-- -----------------------------------------------------------------------------

ALTER TABLE interest_registrations
    ADD COLUMN show_publicly boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN interest_registrations.show_publicly IS
    'Opt-in, default false. Even when true, v1 surfaces counts only - never names '
    'or emails. Flipping this to default true would be a PDPA regression.';

CREATE VIEW activity_interest_stats AS
SELECT
    a.id                                            AS activity,
    count(r.id)                                     AS interested_count,
    count(r.id) FILTER (WHERE r.is_first_timer)     AS first_timer_count,
    count(r.id) FILTER (WHERE r.interest_level = 'committed') AS committed_count
FROM activities a
LEFT JOIN interest_registrations r
       ON r.activity = a.id
      AND r.status IN ('registered', 'contacted', 'attended')
GROUP BY a.id;

COMMENT ON VIEW activity_interest_stats IS
    'Public-safe aggregate for activity pages: "8 interested, 3 first-timers". '
    'Withdrawn and no-show registrations are excluded so the number stays honest.';

-- -----------------------------------------------------------------------------
-- 3a. Community submissions
--
-- Anyone can propose an event. Submissions land in the same review queue as
-- ingested items rather than in a separate workflow, so there is one place to
-- look. A submission is a proposal, never an activity - acceptance creates one.
-- -----------------------------------------------------------------------------

CREATE TABLE submissions (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    submitter         uuid REFERENCES people (id) ON DELETE SET NULL,
    submitter_name    varchar(200),
    submitter_email   citext,
    is_organiser      boolean NOT NULL DEFAULT false,

    -- free-text as given; parsing happens during review
    title             varchar(300) NOT NULL,
    organiser_name    varchar(200),
    venue_name        varchar(200),
    url               varchar(1000),
    when_text         varchar(300),
    description       text,
    notes             text,

    status            varchar(20) NOT NULL DEFAULT 'new'
                      CHECK (status IN ('new', 'in_review', 'accepted',
                                        'rejected', 'duplicate', 'spam')),
    activity          uuid REFERENCES activities (id) ON DELETE SET NULL,
    review_note       text,
    reviewed_by       uuid,
    reviewed_at       timestamptz,
    spam_score        numeric(3, 2) CHECK (spam_score IS NULL
                                           OR spam_score BETWEEN 0 AND 1),
    submitted_ip      inet,
    date_created      timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT submissions_contactable
        CHECK (submitter IS NOT NULL OR submitter_email IS NOT NULL),
    CONSTRAINT submissions_accepted_has_activity
        CHECK (status <> 'accepted' OR activity IS NOT NULL),
    CONSTRAINT submissions_reviewed_is_timestamped
        CHECK (status IN ('new', 'in_review') OR reviewed_at IS NOT NULL)
);

COMMENT ON TABLE submissions IS
    'How the events nobody indexes get in - the run club that exists only as a '
    'Telegram group. Kept separate from activities so an unreviewed submission can '
    'never appear publicly.';

CREATE INDEX submissions_status_idx ON submissions (status);
CREATE INDEX submissions_queue_idx  ON submissions (date_created)
    WHERE status IN ('new', 'in_review');

-- -----------------------------------------------------------------------------
-- 3b. Organiser-claimed pages
--
-- The durable supply: a run club or gym claims its own listing and maintains it.
-- A claim is evidence reviewed by a human; membership is what a claim grants.
-- -----------------------------------------------------------------------------

CREATE TABLE organiser_claims (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organiser            uuid NOT NULL REFERENCES organisers (id) ON DELETE CASCADE,
    person               uuid NOT NULL REFERENCES people (id) ON DELETE CASCADE,
    evidence             text,
    verification_method  varchar(20)
                         CHECK (verification_method IN ('email_domain', 'social_dm',
                                                        'website_token', 'manual')),
    status               varchar(20) NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'approved', 'rejected')),
    review_note          text,
    reviewed_by          uuid,
    reviewed_at          timestamptz,
    date_created         timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT organiser_claims_reviewed_is_timestamped
        CHECK (status = 'pending' OR reviewed_at IS NOT NULL)
);

COMMENT ON TABLE organiser_claims IS
    'Claiming is always human-reviewed. Handing the wrong person control of a real '
    'club''s page is unrecoverable, so there is no auto-approval path.';

CREATE UNIQUE INDEX organiser_claims_one_open
    ON organiser_claims (organiser, person)
    WHERE status = 'pending';

CREATE TABLE organiser_members (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organiser     uuid NOT NULL REFERENCES organisers (id) ON DELETE CASCADE,
    person        uuid NOT NULL REFERENCES people (id) ON DELETE CASCADE,
    role          varchar(20) NOT NULL DEFAULT 'editor'
                  CHECK (role IN ('owner', 'editor')),
    status        varchar(20) NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'revoked')),
    granted_by    uuid,
    date_created  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT organiser_members_unique UNIQUE (organiser, person)
);

-- Organiser-authored activities still go through review. Self-service is a
-- supply channel, not a bypass: the enrichment gate from 001 applies unchanged.
ALTER TABLE activities
    ADD COLUMN submitted_by uuid REFERENCES people (id) ON DELETE SET NULL,
    ADD COLUMN origin varchar(20) NOT NULL DEFAULT 'ingested'
        CHECK (origin IN ('ingested', 'submitted', 'organiser', 'editorial'));

COMMENT ON COLUMN activities.origin IS
    'Which supply mode produced this: aggregation, community submission, an '
    'organiser managing their own page, or our own editorial work.';

CREATE INDEX activities_origin_idx ON activities (origin);

-- -----------------------------------------------------------------------------
-- 4. 'social' as a structural format
--
-- Post-run kopi and club socials are barely athletic and often the actual point.
-- -----------------------------------------------------------------------------

ALTER TABLE activities DROP CONSTRAINT activities_format_check;
ALTER TABLE activities ADD CONSTRAINT activities_format_check
    CHECK (format IN ('one_off', 'recurring', 'course', 'open_play',
                      'league', 'race', 'social'));

-- -----------------------------------------------------------------------------
-- 5. Seed the browse taxonomy
-- -----------------------------------------------------------------------------

INSERT INTO categories (name, slug, sort, status) VALUES
    ('Running & endurance',  'running-endurance',  1, 'active'),
    ('Racket & court',       'racket-court',       2, 'active'),
    ('Team & pickup',        'team-pickup',        3, 'active'),
    ('Strength & studio',    'strength-studio',    4, 'active'),
    ('Water',                'water',              5, 'active'),
    ('Climbing & movement',  'climbing-movement',  6, 'active'),
    ('Outdoor & walking',    'outdoor-walking',    7, 'active'),
    ('Mind & body',          'mind-body',          8, 'active');
