-- =============================================================================
-- Meet in Motion - initial schema
--
-- Discovery platform for active social events in Singapore, built around
-- soft-socializing attributes: low-pressure, activity-anchored ways to spend
-- time with people.
--
-- Postgres 14+. Directus-compatible conventions:
--   * uuid primary keys, generated client-side by Directus or by gen_random_uuid()
--   * varchar + CHECK for enumerations (Directus renders these as dropdowns and
--     they migrate far more easily than native PG enum types)
--   * status / sort / user_created / date_created / user_updated / date_updated
--     housekeeping columns on editable collections
--   * junction tables carry their own uuid primary key, as Directus requires
--
-- See docs/data-model.md for the narrative version of everything below.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS citext;     -- case-insensitive email
CREATE EXTENSION IF NOT EXISTS pg_trgm;    -- fuzzy title matching for dedupe

-- =============================================================================
-- Reference data
-- =============================================================================

CREATE TABLE categories (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name          varchar(120) NOT NULL,
    slug          varchar(140) NOT NULL UNIQUE,
    parent        uuid REFERENCES categories (id) ON DELETE SET NULL,
    icon          varchar(60),
    description   text,
    sort          integer,
    status        varchar(20) NOT NULL DEFAULT 'active'
                  CHECK (status IN ('draft', 'active', 'archived'))
);

COMMENT ON TABLE categories IS
    'Shallow taxonomy tree: running, racket sports, strength, water, cycling, mind-body, social.';

CREATE TABLE tags (
    id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name    varchar(80) NOT NULL,
    slug    varchar(100) NOT NULL UNIQUE,
    sort    integer
);

CREATE TABLE organisers (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name           varchar(200) NOT NULL,
    slug           varchar(220) NOT NULL UNIQUE,
    type           varchar(30) NOT NULL DEFAULT 'club'
                   CHECK (type IN ('club', 'race_organiser', 'gym', 'studio',
                                   'venue_operator', 'brand', 'community_group',
                                   'individual')),
    description    text,
    website        varchar(500),
    instagram      varchar(120),
    telegram       varchar(120),
    whatsapp       varchar(120),
    email          varchar(255),
    logo           uuid,                      -- -> directus_files
    is_verified    boolean NOT NULL DEFAULT false,
    status         varchar(20) NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft', 'active', 'archived')),
    sort           integer,
    user_created   uuid,
    date_created   timestamptz DEFAULT now(),
    user_updated   uuid,
    date_updated   timestamptz
);

COMMENT ON COLUMN organisers.telegram IS
    'Many Singapore run clubs exist only as a Telegram group; this is often the real front door.';

CREATE TABLE venues (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name           varchar(200) NOT NULL,
    slug           varchar(220) NOT NULL UNIQUE,
    address        varchar(400),
    postal_code    varchar(10),
    region         varchar(20)
                   CHECK (region IN ('central', 'north', 'north_east', 'east', 'west')),
    nearest_mrt    varchar(120),
    latitude       numeric(9, 6),
    longitude      numeric(9, 6),
    is_outdoor     boolean NOT NULL DEFAULT false,
    notes          text,
    status         varchar(20) NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft', 'active', 'archived')),
    sort           integer,
    user_created   uuid,
    date_created   timestamptz DEFAULT now(),
    user_updated   uuid,
    date_updated   timestamptz
);

COMMENT ON COLUMN venues.nearest_mrt IS
    'Drives turnout more than coordinates do; surfaced prominently in listings.';

-- =============================================================================
-- Ingestion
-- =============================================================================

CREATE TABLE sources (
    id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name                   varchar(200) NOT NULL,
    slug                   varchar(220) NOT NULL UNIQUE,
    type                   varchar(20) NOT NULL
                           CHECK (type IN ('api', 'rss', 'scraper', 'manual',
                                           'submission', 'email')),
    url                    varchar(1000),
    config                 jsonb NOT NULL DEFAULT '{}'::jsonb,
    organiser              uuid REFERENCES organisers (id) ON DELETE SET NULL,
    poll_interval_minutes  integer NOT NULL DEFAULT 1440,
    is_active              boolean NOT NULL DEFAULT true,
    last_polled_at         timestamptz,
    last_status            varchar(20)
                           CHECK (last_status IN ('ok', 'partial', 'error', 'skipped')),
    last_error             text,
    terms_note             text,
    sort                   integer,
    user_created           uuid,
    date_created           timestamptz DEFAULT now(),
    user_updated           uuid,
    date_updated           timestamptz
);

COMMENT ON COLUMN sources.terms_note IS
    'What we are permitted to do with this source. Several candidate sources restrict '
    'scraping; recording the basis for ingestion keeps the decision reviewable.';

CREATE TABLE raw_items (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source        uuid NOT NULL REFERENCES sources (id) ON DELETE CASCADE,
    external_id   varchar(500),
    url           varchar(1000),
    raw_payload   jsonb NOT NULL DEFAULT '{}'::jsonb,
    content_hash  varchar(64) NOT NULL,
    fetched_at    timestamptz NOT NULL DEFAULT now(),
    status        varchar(20) NOT NULL DEFAULT 'new'
                  CHECK (status IN ('new', 'parsed', 'duplicate', 'rejected', 'error')),
    activity      uuid,                        -- FK added after activities exists
    dedupe_note   text,
    parse_error   text,
    CONSTRAINT raw_items_source_external_id_unique UNIQUE (source, external_id)
);

CREATE INDEX raw_items_content_hash_idx ON raw_items (content_hash);
CREATE INDEX raw_items_status_idx       ON raw_items (status);
CREATE INDEX raw_items_fetched_at_idx   ON raw_items (fetched_at DESC);

-- =============================================================================
-- Activities - the canonical record
-- =============================================================================

CREATE TABLE activities (
    id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- identity
    title                  varchar(300) NOT NULL,
    slug                   varchar(320) NOT NULL UNIQUE,
    summary                text,
    description            text,
    organiser              uuid REFERENCES organisers (id) ON DELETE SET NULL,
    venue                  uuid REFERENCES venues (id) ON DELETE SET NULL,
    category               uuid REFERENCES categories (id) ON DELETE SET NULL,
    hero_image             uuid,                -- -> directus_files
    source                 uuid REFERENCES sources (id) ON DELETE SET NULL,
    source_url             varchar(1000),

    -- dedupe
    dedupe_key             varchar(255) NOT NULL UNIQUE,
    content_hash           varchar(64),

    -- shape
    format                 varchar(20) NOT NULL DEFAULT 'one_off'
                           CHECK (format IN ('one_off', 'recurring', 'course',
                                             'open_play', 'league', 'race')),
    intensity              varchar(20)
                           CHECK (intensity IN ('gentle', 'moderate', 'vigorous',
                                                'competitive')),
    skill_level            varchar(20) NOT NULL DEFAULT 'any'
                           CHECK (skill_level IN ('any', 'beginner', 'improver',
                                                  'intermediate', 'advanced')),
    capacity               integer CHECK (capacity IS NULL OR capacity > 0),
    spots_remaining        integer CHECK (spots_remaining IS NULL OR spots_remaining >= 0),
    cost_band              varchar(20)
                           CHECK (cost_band IN ('free', 'under_20', '20_to_50',
                                                '50_to_100', 'over_100')),
    price_min              numeric(10, 2) CHECK (price_min IS NULL OR price_min >= 0),
    price_max              numeric(10, 2) CHECK (price_max IS NULL OR price_max >= 0),
    currency               varchar(3) NOT NULL DEFAULT 'SGD',
    booking_url            varchar(1000),
    booking_platform       varchar(80),
    discussion_group_url   varchar(1000),

    -- soft-socializing attributes (AI-inferred, human-confirmed)
    solo_friendly          varchar(20) NOT NULL DEFAULT 'unknown'
                           CHECK (solo_friendly IN ('yes', 'probably', 'unlikely', 'unknown')),
    pressure_level         varchar(20)
                           CHECK (pressure_level IN ('drop_in', 'rsvp', 'commit')),
    conversation_load      varchar(20)
                           CHECK (conversation_load IN ('parallel', 'light', 'conversational')),
    group_size             varchar(20)
                           CHECK (group_size IN ('intimate', 'small', 'medium', 'large')),
    newcomer_norm          varchar(20) NOT NULL DEFAULT 'unknown'
                           CHECK (newcomer_norm IN ('common', 'occasional', 'rare', 'unknown')),
    social_after           boolean,
    confirmed_fields       jsonb NOT NULL DEFAULT '[]'::jsonb,
    enrichment_status      varchar(24) NOT NULL DEFAULT 'not_started'
                           CHECK (enrichment_status IN ('not_started', 'proposed',
                                                        'partially_confirmed', 'confirmed')),

    -- workflow
    status                 varchar(20) NOT NULL DEFAULT 'draft'
                           CHECK (status IN ('draft', 'pending_review', 'needs_info',
                                             'approved', 'published', 'expired',
                                             'rejected', 'archived')),
    is_featured            boolean NOT NULL DEFAULT false,
    quality_score          integer NOT NULL DEFAULT 0
                           CHECK (quality_score BETWEEN 0 AND 100),
    published_at           timestamptz,
    first_seen_at          timestamptz NOT NULL DEFAULT now(),
    last_verified_at       timestamptz,

    sort                   integer,
    user_created           uuid,
    date_created           timestamptz DEFAULT now(),
    user_updated           uuid,
    date_updated           timestamptz,

    CONSTRAINT activities_price_range_valid
        CHECK (price_min IS NULL OR price_max IS NULL OR price_max >= price_min),
    CONSTRAINT activities_spots_within_capacity
        CHECK (capacity IS NULL OR spots_remaining IS NULL OR spots_remaining <= capacity),
    -- The gate: nothing reaches the public site on inferred values alone.
    CONSTRAINT activities_publishable_requires_confirmed_enrichment
        CHECK (status NOT IN ('approved', 'published')
               OR enrichment_status = 'confirmed')
);

COMMENT ON TABLE activities IS
    'One row per thing you can go to, whether it happens once or every Tuesday.';
COMMENT ON COLUMN activities.solo_friendly IS
    'The question users are silently asking. Bias toward unknown - a false "yes" is the '
    'worst failure this product has.';
COMMENT ON COLUMN activities.dedupe_key IS
    'Normalised organiser + title + first session date + venue.';
COMMENT ON CONSTRAINT activities_publishable_requires_confirmed_enrichment ON activities IS
    'Blocks approved/published until a human has confirmed the inferred soft attributes.';

CREATE INDEX activities_status_idx        ON activities (status);
CREATE INDEX activities_category_idx      ON activities (category);
CREATE INDEX activities_organiser_idx     ON activities (organiser);
CREATE INDEX activities_venue_idx         ON activities (venue);
CREATE INDEX activities_solo_friendly_idx ON activities (solo_friendly)
    WHERE status = 'published';
CREATE INDEX activities_quality_idx       ON activities (quality_score DESC)
    WHERE status = 'approved';
CREATE INDEX activities_title_trgm_idx    ON activities USING gin (title gin_trgm_ops);

ALTER TABLE raw_items
    ADD CONSTRAINT raw_items_activity_fkey
    FOREIGN KEY (activity) REFERENCES activities (id) ON DELETE SET NULL;

-- Occurrences. Materialised rather than computed, so "what's on Saturday" is a
-- plain indexed query and a single week can be cancelled without special-casing.
CREATE TABLE sessions (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    activity          uuid NOT NULL REFERENCES activities (id) ON DELETE CASCADE,
    starts_at         timestamptz NOT NULL,
    ends_at           timestamptz,
    timezone          varchar(60) NOT NULL DEFAULT 'Asia/Singapore',
    recurrence_rule   varchar(500),
    venue             uuid REFERENCES venues (id) ON DELETE SET NULL,
    capacity          integer CHECK (capacity IS NULL OR capacity > 0),
    spots_remaining   integer CHECK (spots_remaining IS NULL OR spots_remaining >= 0),
    notes             text,
    status            varchar(20) NOT NULL DEFAULT 'scheduled'
                      CHECK (status IN ('scheduled', 'full', 'cancelled', 'completed')),
    sort              integer,
    date_created      timestamptz DEFAULT now(),
    date_updated      timestamptz,
    CONSTRAINT sessions_end_after_start CHECK (ends_at IS NULL OR ends_at > starts_at)
);

COMMENT ON COLUMN sessions.recurrence_rule IS
    'RFC 5545 RRULE describing the pattern that generated this row, for regeneration.';

CREATE INDEX sessions_activity_idx  ON sessions (activity);
CREATE INDEX sessions_starts_at_idx ON sessions (starts_at);
CREATE INDEX sessions_upcoming_idx  ON sessions (starts_at)
    WHERE status = 'scheduled';

CREATE TABLE activity_tags (
    id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    activity  uuid NOT NULL REFERENCES activities (id) ON DELETE CASCADE,
    tag       uuid NOT NULL REFERENCES tags (id) ON DELETE CASCADE,
    CONSTRAINT activity_tags_unique UNIQUE (activity, tag)
);

-- =============================================================================
-- Enrichment: AI proposes, a human disposes
-- =============================================================================

CREATE TABLE enrichment_proposals (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    activity         uuid NOT NULL REFERENCES activities (id) ON DELETE CASCADE,
    field_key        varchar(40) NOT NULL
                     CHECK (field_key IN ('solo_friendly', 'pressure_level',
                                          'conversation_load', 'group_size',
                                          'newcomer_norm', 'social_after',
                                          'intensity', 'cost_band')),
    proposed_value   jsonb NOT NULL,
    confidence       numeric(3, 2) CHECK (confidence IS NULL
                                          OR confidence BETWEEN 0 AND 1),
    evidence         text,
    reasoning        text,
    model            varchar(80),
    prompt_version   varchar(40),
    status           varchar(20) NOT NULL DEFAULT 'proposed'
                     CHECK (status IN ('proposed', 'accepted', 'edited',
                                       'rejected', 'superseded')),
    final_value      jsonb,
    reviewed_by      uuid,
    reviewed_at      timestamptz,
    date_created     timestamptz DEFAULT now(),
    CONSTRAINT enrichment_reviewed_fields_consistent
        CHECK (status = 'proposed' OR reviewed_at IS NOT NULL)
);

COMMENT ON COLUMN enrichment_proposals.evidence IS
    'The quoted source text the inference rests on. Makes review a glance rather than a '
    'judgement call - without it, treat the proposal as low confidence.';

-- One open proposal per field at a time.
CREATE UNIQUE INDEX enrichment_proposals_open_unique
    ON enrichment_proposals (activity, field_key)
    WHERE status = 'proposed';

CREATE INDEX enrichment_proposals_activity_idx ON enrichment_proposals (activity);
CREATE INDEX enrichment_proposals_pending_idx  ON enrichment_proposals (date_created)
    WHERE status = 'proposed';

-- =============================================================================
-- Surrounding content: promotions and resources
-- =============================================================================

CREATE TABLE promotions (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title              varchar(300) NOT NULL,
    slug               varchar(320) NOT NULL UNIQUE,
    summary            text,
    organiser          uuid REFERENCES organisers (id) ON DELETE SET NULL,
    offer_type         varchar(20) NOT NULL
                       CHECK (offer_type IN ('percent_off', 'amount_off', 'free_trial',
                                             'bundle', 'freebie', 'bogo', 'early_bird')),
    discount_value     numeric(10, 2) CHECK (discount_value IS NULL OR discount_value >= 0),
    currency           varchar(3) NOT NULL DEFAULT 'SGD',
    promo_code         varchar(80),
    requires_code      boolean NOT NULL DEFAULT false,
    landing_url        varchar(1000),
    hero_image         uuid,
    terms              text,
    starts_at          timestamptz,
    ends_at            timestamptz,
    is_paid_placement  boolean NOT NULL DEFAULT false,
    status             varchar(20) NOT NULL DEFAULT 'draft'
                       CHECK (status IN ('draft', 'pending_review', 'approved',
                                         'published', 'expired', 'rejected', 'archived')),
    sort               integer,
    user_created       uuid,
    date_created       timestamptz DEFAULT now(),
    user_updated       uuid,
    date_updated       timestamptz,
    CONSTRAINT promotions_end_after_start
        CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at),
    CONSTRAINT promotions_code_present_when_required
        CHECK (NOT requires_code OR promo_code IS NOT NULL)
);

COMMENT ON TABLE promotions IS
    'Context around an activity - a gym trial before HYROX - not the main object.';

CREATE INDEX promotions_status_idx  ON promotions (status);
CREATE INDEX promotions_ends_at_idx ON promotions (ends_at);

CREATE TABLE activity_promotions (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    activity          uuid NOT NULL REFERENCES activities (id) ON DELETE CASCADE,
    promotion         uuid NOT NULL REFERENCES promotions (id) ON DELETE CASCADE,
    relevance_reason  text,
    relevance_score   integer NOT NULL DEFAULT 50
                      CHECK (relevance_score BETWEEN 0 AND 100),
    sort              integer,
    CONSTRAINT activity_promotions_unique UNIQUE (activity, promotion)
);

CREATE TABLE resources (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    url               varchar(1000) NOT NULL UNIQUE,
    type              varchar(20) NOT NULL
                      CHECK (type IN ('video', 'article', 'guide', 'podcast',
                                      'study', 'thread')),
    title             varchar(400) NOT NULL,
    publisher         varchar(200),
    author            varchar(200),
    summary           text,
    duration_seconds  integer CHECK (duration_seconds IS NULL OR duration_seconds > 0),
    published_date    date,
    thumbnail_url     varchar(1000),
    credibility       varchar(20) NOT NULL DEFAULT 'pending'
                      CHECK (credibility IN ('pending', 'reputable',
                                             'questionable', 'rejected')),
    credibility_note  text,
    topics            jsonb NOT NULL DEFAULT '[]'::jsonb,
    status            varchar(20) NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'pending_review', 'approved',
                                        'published', 'archived')),
    sort              integer,
    user_created      uuid,
    date_created      timestamptz DEFAULT now(),
    user_updated      uuid,
    date_updated      timestamptz,
    -- AI may propose a resource; only a human marks it reputable, and only a
    -- reputable resource can be published.
    CONSTRAINT resources_published_requires_reputable
        CHECK (status NOT IN ('approved', 'published') OR credibility = 'reputable')
);

COMMENT ON TABLE resources IS
    'Vetted third-party context. We store the URL, our own summary and metadata, and we '
    'link out - we do not mirror article bodies or re-host video.';
COMMENT ON COLUMN resources.topics IS
    'e.g. ["heat_acclimatisation","hydration"] so one resource serves many activities.';

CREATE INDEX resources_credibility_idx ON resources (credibility);
CREATE INDEX resources_topics_idx      ON resources USING gin (topics);

CREATE TABLE activity_resources (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    activity          uuid NOT NULL REFERENCES activities (id) ON DELETE CASCADE,
    resource          uuid NOT NULL REFERENCES resources (id) ON DELETE CASCADE,
    relevance_reason  text,
    relevance_score   integer NOT NULL DEFAULT 50
                      CHECK (relevance_score BETWEEN 0 AND 100),
    sort              integer,
    CONSTRAINT activity_resources_unique UNIQUE (activity, resource)
);

-- =============================================================================
-- Demand side: people and interest
-- =============================================================================

CREATE TABLE people (
    id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email                  citext NOT NULL UNIQUE,
    name                   varchar(200),
    phone                  varchar(40),
    telegram_handle        varchar(120),
    marketing_consent      boolean NOT NULL DEFAULT false,
    consent_at             timestamptz,
    consent_text_version   varchar(40),
    unsubscribed_at        timestamptz,
    status                 varchar(20) NOT NULL DEFAULT 'active'
                           CHECK (status IN ('active', 'unsubscribed', 'bounced', 'deleted')),
    date_created           timestamptz DEFAULT now(),
    date_updated           timestamptz,
    CONSTRAINT people_consent_timestamped
        CHECK (NOT marketing_consent OR consent_at IS NOT NULL)
);

COMMENT ON TABLE people IS
    'PDPA (Singapore): consent is explicit and separate from the registration action, the '
    'consent text version is recorded, marketing consent is distinct from event-specific '
    'contact, and withdrawal is honoured via unsubscribed_at. No pre-ticked consent boxes.';

CREATE TABLE interest_registrations (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    activity        uuid NOT NULL REFERENCES activities (id) ON DELETE CASCADE,
    session         uuid REFERENCES sessions (id) ON DELETE SET NULL,
    person          uuid NOT NULL REFERENCES people (id) ON DELETE CASCADE,
    interest_level  varchar(20) NOT NULL DEFAULT 'curious'
                    CHECK (interest_level IN ('curious', 'likely', 'committed')),
    party_size      integer NOT NULL DEFAULT 1 CHECK (party_size > 0),
    is_first_timer  boolean,
    notes           text,
    channel         varchar(40),
    status          varchar(20) NOT NULL DEFAULT 'registered'
                    CHECK (status IN ('registered', 'contacted', 'attended',
                                      'no_show', 'withdrawn')),
    date_created    timestamptz DEFAULT now(),
    date_updated    timestamptz,
    CONSTRAINT interest_registrations_unique UNIQUE (activity, person)
);

COMMENT ON TABLE interest_registrations IS
    'Expression of interest, not a booking - we take no money and guarantee no slot. '
    'The public copy must say so.';
COMMENT ON COLUMN interest_registrations.is_first_timer IS
    'Cheapest correction signal for the newcomer_norm attribute. Raises a flag for review; '
    'never auto-updates the activity.';

CREATE INDEX interest_registrations_activity_idx ON interest_registrations (activity);
CREATE INDEX interest_registrations_person_idx   ON interest_registrations (person);

-- =============================================================================
-- Publishing
-- =============================================================================

CREATE TABLE channels (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    key         varchar(40) NOT NULL UNIQUE,
    name        varchar(120) NOT NULL,
    is_active   boolean NOT NULL DEFAULT true,
    config      jsonb NOT NULL DEFAULT '{}'::jsonb,
    sort        integer
);

COMMENT ON COLUMN channels.config IS
    'max_length, supports_links, image_aspect, hashtag_limit. Variant generation reads '
    'these rather than hard-coding per-channel rules, so a new channel is a row plus a '
    'prompt, not a code change.';

CREATE TABLE campaigns (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name          varchar(200) NOT NULL,
    slug          varchar(220) NOT NULL UNIQUE,
    description   text,
    starts_on     date,
    ends_on       date,
    status        varchar(20) NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'active', 'completed', 'archived')),
    sort          integer,
    user_created  uuid,
    date_created  timestamptz DEFAULT now(),
    CONSTRAINT campaigns_end_after_start
        CHECK (ends_on IS NULL OR starts_on IS NULL OR ends_on >= starts_on)
);

COMMENT ON TABLE campaigns IS
    'A themed arc - "HYROX prep week" grouping the race, gym promotions and preparation '
    'resources across several days, so the sequence is planned rather than coincidental.';

CREATE TABLE posts (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    type            varchar(20) NOT NULL
                    CHECK (type IN ('event_spotlight', 'resource', 'promotion',
                                    'roundup', 'announcement')),
    activity        uuid REFERENCES activities (id) ON DELETE SET NULL,
    promotion       uuid REFERENCES promotions (id) ON DELETE SET NULL,
    resource        uuid REFERENCES resources (id) ON DELETE SET NULL,
    campaign        uuid REFERENCES campaigns (id) ON DELETE SET NULL,
    headline        varchar(300) NOT NULL,
    body            text,
    hero_image      uuid,
    scheduled_for   date NOT NULL,
    slot            varchar(10) NOT NULL DEFAULT 'morning'
                    CHECK (slot IN ('morning', 'midday', 'evening')),
    status          varchar(20) NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'pending_review', 'approved',
                                      'scheduled', 'published', 'failed', 'archived')),
    published_at    timestamptz,
    sort            integer,
    user_created    uuid,
    date_created    timestamptz DEFAULT now(),
    user_updated    uuid,
    date_updated    timestamptz,
    -- Each post type references exactly the subject it is about.
    CONSTRAINT posts_subject_matches_type CHECK (
        (type = 'event_spotlight'
             AND activity IS NOT NULL AND promotion IS NULL AND resource IS NULL)
     OR (type = 'promotion'
             AND promotion IS NOT NULL AND resource IS NULL)
     OR (type = 'resource'
             AND resource IS NOT NULL AND promotion IS NULL)
     OR (type IN ('roundup', 'announcement')
             AND promotion IS NULL AND resource IS NULL)
    ),
    -- One post per type per slot per day: keeps spotlights from colliding and
    -- makes an unfilled slot a queryable gap.
    CONSTRAINT posts_slot_unique UNIQUE (scheduled_for, slot, type)
);

CREATE INDEX posts_scheduled_for_idx ON posts (scheduled_for);
CREATE INDEX posts_status_idx        ON posts (status);
CREATE INDEX posts_due_idx           ON posts (scheduled_for, slot)
    WHERE status = 'scheduled';

CREATE TABLE campaign_posts (
    id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign  uuid NOT NULL REFERENCES campaigns (id) ON DELETE CASCADE,
    post      uuid NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
    sort      integer,
    CONSTRAINT campaign_posts_unique UNIQUE (campaign, post)
);

CREATE TABLE post_variants (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    post            uuid NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
    channel         uuid NOT NULL REFERENCES channels (id) ON DELETE CASCADE,
    headline        varchar(300),
    body            text,
    hashtags        varchar(500),
    image           uuid,
    status          varchar(20) NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'approved', 'rejected')),
    generated_by    varchar(10) NOT NULL DEFAULT 'ai'
                    CHECK (generated_by IN ('ai', 'human')),
    model           varchar(80),
    prompt_version  varchar(40),
    date_created    timestamptz DEFAULT now(),
    date_updated    timestamptz,
    CONSTRAINT post_variants_unique UNIQUE (post, channel)
);

COMMENT ON TABLE post_variants IS
    'Kept separate from publications so copy can be regenerated without touching '
    'publication history.';

-- The idempotency ledger. Unique on (post, channel): a retry updates this row,
-- it never inserts a second one. The worker inserts here BEFORE calling any
-- channel API, so a restart mid-publish cannot double-send.
CREATE TABLE publications (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    post              uuid NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
    channel           uuid NOT NULL REFERENCES channels (id) ON DELETE CASCADE,
    variant           uuid REFERENCES post_variants (id) ON DELETE SET NULL,
    idempotency_key   varchar(200) NOT NULL UNIQUE,
    status            varchar(20) NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'queued', 'sending', 'published',
                                        'failed', 'skipped', 'revoked')),
    external_post_id  varchar(300),
    external_url      varchar(1000),
    payload_hash      varchar(64),
    attempts          integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    last_error        text,
    published_at      timestamptz,
    date_created      timestamptz DEFAULT now(),
    date_updated      timestamptz,
    CONSTRAINT publications_post_channel_unique UNIQUE (post, channel)
);

COMMENT ON COLUMN publications.idempotency_key IS
    'Format: {post_id}:{channel_key}. Unique, so a duplicate send fails at the database.';
COMMENT ON COLUMN publications.payload_hash IS
    'Hash of what was actually sent. A mismatch against the current variant means the '
    'live post is stale and needs an edit or correction, not a repost.';

CREATE INDEX publications_status_idx  ON publications (status);
CREATE INDEX publications_retry_idx   ON publications (date_updated)
    WHERE status = 'failed';

-- =============================================================================
-- Sponsorship - disclosure made structural rather than conventional
-- =============================================================================

CREATE TABLE sponsorships (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    advertiser        uuid NOT NULL REFERENCES organisers (id) ON DELETE CASCADE,
    activity          uuid REFERENCES activities (id) ON DELETE CASCADE,
    promotion         uuid REFERENCES promotions (id) ON DELETE CASCADE,
    post              uuid REFERENCES posts (id) ON DELETE CASCADE,
    tier              varchar(20) NOT NULL DEFAULT 'sponsored'
                      CHECK (tier IN ('featured', 'boosted', 'sponsored')),
    disclosure_label  varchar(80) NOT NULL DEFAULT 'Sponsored',
    starts_at         timestamptz,
    ends_at           timestamptz,
    amount            numeric(10, 2) CHECK (amount IS NULL OR amount >= 0),
    currency          varchar(3) NOT NULL DEFAULT 'SGD',
    notes             text,
    status            varchar(20) NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'active', 'ended', 'cancelled')),
    user_created      uuid,
    date_created      timestamptz DEFAULT now(),
    CONSTRAINT sponsorships_has_subject
        CHECK (activity IS NOT NULL OR promotion IS NOT NULL OR post IS NOT NULL),
    CONSTRAINT sponsorships_end_after_start
        CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);

COMMENT ON TABLE sponsorships IS
    'disclosure_label is NOT NULL with a default: any sponsored surface renders it on '
    'every channel. Singapore advertising guidelines require clear identification of paid '
    'content, so the model makes omitting it hard rather than merely discouraged.';

CREATE INDEX sponsorships_active_idx ON sponsorships (starts_at, ends_at)
    WHERE status = 'active';

-- =============================================================================
-- Seed: channels
-- =============================================================================

INSERT INTO channels (key, name, config, sort) VALUES
    ('website',    'Website',
     '{"max_length": null, "supports_links": true,  "image_aspect": "16:9"}', 1),
    ('telegram',   'Telegram Channel',
     '{"max_length": 4096, "supports_links": true,  "image_aspect": "16:9"}', 2),
    ('whatsapp',   'WhatsApp Channel',
     '{"max_length": 1024, "supports_links": false, "image_aspect": "1:1"}',  3),
    ('instagram',  'Instagram',
     '{"max_length": 2200, "supports_links": false, "image_aspect": "4:5", "hashtag_limit": 30}', 4),
    ('newsletter', 'Email newsletter',
     '{"max_length": null, "supports_links": true,  "image_aspect": "16:9"}', 5),
    ('push',       'Push notification',
     '{"max_length": 140,  "supports_links": true}', 6);
