-- =============================================================================
-- Meet in Motion - migration 003
--
--   1. Assisted publishing: an 'awaiting_manual' publication state and the
--      one-tap flow for channels with no publishing API (WhatsApp Channels).
--   2. Coaches: a directory of professional and peer coaches, surfaced in
--      context beside the events they suit.
--
-- Requires 001_init.sql and 002_accounts_and_supply.sql.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Assisted publishing
--
-- WhatsApp Channels have no official publishing API, and the unofficial
-- gateways that do it link a personal account by QR code in violation of
-- WhatsApp's terms - the reported outcome is account restriction, which would
-- cost the audience the channel exists to serve. So the copy and image are
-- generated automatically as for any channel; only the final send is a person.
--
-- The publication ledger stays authoritative either way, so idempotency,
-- payload_hash staleness detection and retry logic work unchanged.
-- -----------------------------------------------------------------------------

ALTER TABLE channels
    ADD COLUMN delivery_mode varchar(20) NOT NULL DEFAULT 'api'
        CHECK (delivery_mode IN ('api', 'assisted'));

COMMENT ON COLUMN channels.delivery_mode IS
    'api: the worker publishes directly. assisted: the worker prepares everything '
    'and a person taps send. Not a fallback - a permanent property of the channel.';

UPDATE channels SET delivery_mode = 'assisted' WHERE key = 'whatsapp';

ALTER TABLE publications DROP CONSTRAINT publications_status_check;
ALTER TABLE publications ADD CONSTRAINT publications_status_check
    CHECK (status IN ('pending', 'queued', 'awaiting_manual', 'sending',
                      'published', 'failed', 'skipped', 'revoked'));

ALTER TABLE publications
    ADD COLUMN manual_token_hash       varchar(64) UNIQUE,
    ADD COLUMN manual_token_expires_at timestamptz,
    ADD COLUMN manual_opened_at        timestamptz,
    ADD COLUMN marked_sent_by          uuid REFERENCES people (id) ON DELETE SET NULL,
    ADD COLUMN reminder_sent_at        timestamptz,
    ADD COLUMN reminder_count          integer NOT NULL DEFAULT 0
                                       CHECK (reminder_count >= 0);

COMMENT ON COLUMN publications.manual_token_hash IS
    'SHA-256 hash of the single-use token in the publish link. The raw token is '
    'never stored, and the link expires - a forwarded message must not let someone '
    'else mark a post sent.';

ALTER TABLE publications
    ADD CONSTRAINT publications_published_is_timestamped
        CHECK (status <> 'published' OR published_at IS NOT NULL);

CREATE INDEX publications_awaiting_manual_idx ON publications (date_created)
    WHERE status = 'awaiting_manual';

-- What a person still has to send, oldest first. This is the query behind both
-- the mobile page and the nudge.
CREATE VIEW pending_manual_publications AS
SELECT
    pb.id                AS publication,
    pb.post,
    c.key                AS channel_key,
    c.name               AS channel_name,
    p.headline,
    p.scheduled_for,
    p.slot,
    pb.reminder_count,
    pb.manual_token_expires_at,
    pb.date_created
FROM publications pb
JOIN channels c ON c.id = pb.channel
JOIN posts    p ON p.id = pb.post
WHERE pb.status = 'awaiting_manual'
ORDER BY p.scheduled_for, pb.date_created;

-- -----------------------------------------------------------------------------
-- 2. Coaches
--
-- Both professional and peer coaches, in the CoachUp sense - an experienced
-- club runner who will pace you through your first 10k is a real offering, and
-- pretending they are a certified professional would be the failure mode.
-- The distinction is a column, shown on every surface.
-- -----------------------------------------------------------------------------

CREATE TABLE coaches (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    person                uuid REFERENCES people (id) ON DELETE SET NULL,
    slug                  varchar(220) NOT NULL UNIQUE,
    display_name          varchar(200) NOT NULL,
    headline              varchar(200),
    bio                   text,
    photo                 uuid,

    coach_type            varchar(20) NOT NULL
                          CHECK (coach_type IN ('professional', 'peer')),
    years_experience      integer CHECK (years_experience IS NULL
                                         OR years_experience BETWEEN 0 AND 70),
    credentials           text,

    -- what they offer
    offers_one_to_one     boolean NOT NULL DEFAULT true,
    offers_small_group    boolean NOT NULL DEFAULT false,
    offers_programme      boolean NOT NULL DEFAULT false,
    offers_free_intro     boolean NOT NULL DEFAULT false,
    rate_min              numeric(10, 2) CHECK (rate_min IS NULL OR rate_min >= 0),
    rate_max              numeric(10, 2) CHECK (rate_max IS NULL OR rate_max >= 0),
    rate_unit             varchar(20)
                          CHECK (rate_unit IN ('session', 'hour', 'month', 'programme')),
    currency              varchar(3) NOT NULL DEFAULT 'SGD',

    regions               jsonb NOT NULL DEFAULT '[]'::jsonb,
    languages             jsonb NOT NULL DEFAULT '[]'::jsonb,
    availability_note     varchar(300),

    -- trust
    verification_status   varchar(24) NOT NULL DEFAULT 'unverified'
                          CHECK (verification_status IN ('unverified', 'self_declared',
                                                         'documents_checked', 'rejected')),
    verification_note     text,
    verified_by           uuid,
    verified_at           timestamptz,
    works_with_minors     boolean NOT NULL DEFAULT false,

    contact_email         citext,
    contact_phone         varchar(40),
    website               varchar(500),
    instagram             varchar(120),

    status                varchar(20) NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft', 'pending_review', 'approved',
                                            'published', 'suspended', 'archived')),
    is_featured           boolean NOT NULL DEFAULT false,
    sort                  integer,
    user_created          uuid,
    date_created          timestamptz DEFAULT now(),
    user_updated          uuid,
    date_updated          timestamptz,

    CONSTRAINT coaches_rate_range_valid
        CHECK (rate_min IS NULL OR rate_max IS NULL OR rate_max >= rate_min),
    CONSTRAINT coaches_rate_has_unit
        CHECK ((rate_min IS NULL AND rate_max IS NULL) OR rate_unit IS NOT NULL),
    -- No coach reaches the public site on an unreviewed profile.
    CONSTRAINT coaches_published_requires_review
        CHECK (status NOT IN ('approved', 'published')
               OR verification_status IN ('self_declared', 'documents_checked')),
    -- Coaching minors requires documents actually checked - never a self-declaration.
    CONSTRAINT coaches_minors_require_documents
        CHECK (NOT works_with_minors OR verification_status = 'documents_checked'),
    -- "Professional" is a claim about credentials; it needs some evidence recorded.
    CONSTRAINT coaches_professional_states_credentials
        CHECK (coach_type <> 'professional'
               OR status NOT IN ('approved', 'published')
               OR credentials IS NOT NULL)
);

COMMENT ON TABLE coaches IS
    'Professional and peer coaches. coach_type is never inferred or hidden: a peer '
    'coach is a real, useful offering, and presenting one as a certified '
    'professional is the failure mode this table is shaped to prevent.';
COMMENT ON COLUMN coaches.verification_status IS
    'unverified: nothing checked. self_declared: a human read the profile and the '
    'claims are plausible and consistent. documents_checked: certification or '
    'insurance actually seen. Only a person sets this - never the enrichment worker.';
COMMENT ON CONSTRAINT coaches_minors_require_documents ON coaches IS
    'Coaching under-18s is the highest-consequence thing on the platform. '
    'Self-declaration is not sufficient, by construction.';

CREATE INDEX coaches_status_idx       ON coaches (status);
CREATE INDEX coaches_type_idx         ON coaches (coach_type) WHERE status = 'published';
CREATE INDEX coaches_verification_idx ON coaches (verification_status);

CREATE TABLE coach_categories (
    id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    coach     uuid NOT NULL REFERENCES coaches (id) ON DELETE CASCADE,
    category  uuid NOT NULL REFERENCES categories (id) ON DELETE CASCADE,
    sort      integer,
    CONSTRAINT coach_categories_unique UNIQUE (coach, category)
);

COMMENT ON TABLE coach_categories IS
    'What a coach coaches, in the same vocabulary as activities.category - which is '
    'what makes "you are looking at a 10k, here are run coaches" a join rather than '
    'a curation task.';

-- Explicit pairing, for editorial or paid placement. The default surface is the
-- category match above; this is for deliberate exceptions.
CREATE TABLE activity_coaches (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    activity           uuid NOT NULL REFERENCES activities (id) ON DELETE CASCADE,
    coach              uuid NOT NULL REFERENCES coaches (id) ON DELETE CASCADE,
    relevance_reason   text,
    relevance_score    integer NOT NULL DEFAULT 50
                       CHECK (relevance_score BETWEEN 0 AND 100),
    is_paid_placement  boolean NOT NULL DEFAULT false,
    sort               integer,
    CONSTRAINT activity_coaches_unique UNIQUE (activity, coach)
);

CREATE TABLE coach_enquiries (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    coach              uuid NOT NULL REFERENCES coaches (id) ON DELETE CASCADE,
    person             uuid REFERENCES people (id) ON DELETE SET NULL,
    activity           uuid REFERENCES activities (id) ON DELETE SET NULL,
    enquirer_name      varchar(200),
    enquirer_email     citext,
    message            text,
    goal               varchar(300),
    consent_share_contact boolean NOT NULL DEFAULT false,
    status             varchar(20) NOT NULL DEFAULT 'new'
                       CHECK (status IN ('new', 'forwarded', 'responded',
                                         'closed', 'spam')),
    forwarded_at       timestamptz,
    date_created       timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT coach_enquiries_contactable
        CHECK (person IS NOT NULL OR enquirer_email IS NOT NULL),
    -- Contact details reach a coach only with explicit consent (PDPA).
    CONSTRAINT coach_enquiries_forward_requires_consent
        CHECK (status <> 'forwarded' OR (consent_share_contact AND forwarded_at IS NOT NULL))
);

COMMENT ON TABLE coach_enquiries IS
    'A lead, not a booking. We pass an introduction along with consent and stay out '
    'of the money - taking payment would make us responsible for delivery, which is '
    'a different business needing different agreements.';
COMMENT ON COLUMN coach_enquiries.activity IS
    'Which event the person was looking at when they enquired. The whole point of '
    'contextual placement, and the only way to know it works.';

CREATE INDEX coach_enquiries_coach_idx  ON coach_enquiries (coach);
CREATE INDEX coach_enquiries_queue_idx  ON coach_enquiries (date_created)
    WHERE status = 'new';

-- Coaches can be sponsored like anything else, with the same disclosure rule.
ALTER TABLE sponsorships
    ADD COLUMN coach uuid REFERENCES coaches (id) ON DELETE CASCADE;

ALTER TABLE sponsorships DROP CONSTRAINT sponsorships_has_subject;
ALTER TABLE sponsorships ADD CONSTRAINT sponsorships_has_subject
    CHECK (activity IS NOT NULL OR promotion IS NOT NULL
           OR post IS NOT NULL OR coach IS NOT NULL);

-- Coach spotlights become a post type.
ALTER TABLE posts DROP CONSTRAINT posts_type_check;
ALTER TABLE posts ADD CONSTRAINT posts_type_check
    CHECK (type IN ('event_spotlight', 'resource', 'promotion',
                    'roundup', 'announcement', 'coach'));

ALTER TABLE posts
    ADD COLUMN coach uuid REFERENCES coaches (id) ON DELETE SET NULL;

ALTER TABLE posts DROP CONSTRAINT posts_subject_matches_type;
ALTER TABLE posts ADD CONSTRAINT posts_subject_matches_type CHECK (
    (type = 'event_spotlight'
         AND activity IS NOT NULL AND promotion IS NULL AND resource IS NULL AND coach IS NULL)
 OR (type = 'promotion'
         AND promotion IS NOT NULL AND resource IS NULL AND coach IS NULL)
 OR (type = 'resource'
         AND resource IS NOT NULL AND promotion IS NULL AND coach IS NULL)
 OR (type = 'coach'
         AND coach IS NOT NULL AND promotion IS NULL AND resource IS NULL)
 OR (type IN ('roundup', 'announcement')
         AND promotion IS NULL AND resource IS NULL AND coach IS NULL)
);
