/**
 * What Directus should show, and who may do what.
 *
 * The database owns the schema (schema/*.sql). This file owns only what the
 * database cannot express: how a collection reads in the Data Studio, and the
 * access policies. Field dropdowns are not listed here - they are derived from
 * the CHECK constraints at bootstrap time. See lib/choices.mjs.
 */

/** Sidebar folders, in the order an editor works. */
export const groups = [
  { collection: 'grp_content',    icon: 'stars',            note: 'What we publish' },
  { collection: 'grp_pipeline',   icon: 'conveyor_belt',    note: 'Where content comes from, before review' },
  { collection: 'grp_publishing', icon: 'campaign',         note: 'The daily calendar and what went out' },
  { collection: 'grp_people',     icon: 'group',            note: 'Readers, coaches and organisers' },
  { collection: 'grp_taxonomy',   icon: 'sell',             note: 'Reference data' },
];

/**
 * `sort` orders collections within a group. `archive` wires the status field to
 * Directus's archive behaviour so "archived" hides rows instead of deleting.
 */
export const collections = [
  // --- content -------------------------------------------------------------
  { name: 'activities', group: 'grp_content', icon: 'directions_run', sort: 1,
    note: 'One row per thing you can go to, whether it happens once or every Tuesday.',
    display: '{{title}}', archive: 'archived', sortField: 'sort' },
  { name: 'sessions', group: 'grp_content', icon: 'event_repeat', sort: 2,
    note: 'Occurrences of an activity. Materialised, not computed.',
    display: '{{activity.title}} — {{starts_at}}', sortField: 'sort' },
  { name: 'coaches', group: 'grp_content', icon: 'sports', sort: 3,
    note: 'Professional and peer coaches. coach_type is never inferred or hidden.',
    display: '{{display_name}}', archive: 'archived', sortField: 'sort' },
  { name: 'promotions', group: 'grp_content', icon: 'local_offer', sort: 4,
    note: 'Context around an activity — a gym trial before HYROX — not the main object.',
    display: '{{title}}', archive: 'archived', sortField: 'sort' },
  { name: 'resources', group: 'grp_content', icon: 'menu_book', sort: 5,
    note: 'Vetted third-party context. We link out; we do not mirror.',
    display: '{{title}}', archive: 'archived', sortField: 'sort' },

  // --- pipeline ------------------------------------------------------------
  { name: 'enrichment_proposals', group: 'grp_pipeline', icon: 'auto_awesome', sort: 1,
    note: 'AI proposals awaiting a human. Read the evidence, then accept or correct.',
    display: '{{activity.title}} — {{field_key}}' },
  { name: 'submissions', group: 'grp_pipeline', icon: 'inbox', sort: 2,
    note: 'Community-proposed events. A submission is never an activity until accepted.',
    display: '{{title}}' },
  { name: 'sources', group: 'grp_pipeline', icon: 'rss_feed', sort: 3,
    note: 'Feeds, scrapers and APIs. terms_note records what we are permitted to do.',
    display: '{{name}}' },
  { name: 'raw_items', group: 'grp_pipeline', icon: 'data_object', sort: 4,
    note: 'Untouched ingested payloads, kept so dedupe decisions can be explained.',
    display: '{{source.name}} — {{external_id}}' },

  // --- publishing ----------------------------------------------------------
  { name: 'posts', group: 'grp_publishing', icon: 'today', sort: 1,
    note: 'One thing published on one day. Empty slots are visible gaps.',
    display: '{{scheduled_for}} {{slot}} — {{headline}}', archive: 'archived', sortField: 'sort' },
  { name: 'post_variants', group: 'grp_publishing', icon: 'tune', sort: 2,
    note: 'Per-channel copy. Separate from publications so copy can be regenerated.',
    display: '{{post.headline}} → {{channel.name}}' },
  { name: 'publications', group: 'grp_publishing', icon: 'send', sort: 3,
    note: 'The idempotency ledger. One row per post and channel; retries update it.',
    display: '{{post.headline}} → {{channel.name}} ({{status}})' },
  { name: 'campaigns', group: 'grp_publishing', icon: 'flag', sort: 4,
    note: 'A themed arc across several days, e.g. HYROX prep week.',
    display: '{{name}}', archive: 'archived' },
  { name: 'channels', group: 'grp_publishing', icon: 'hub', sort: 5,
    note: 'delivery_mode api = the worker sends. assisted = a person taps send.',
    display: '{{name}}' },
  { name: 'sponsorships', group: 'grp_publishing', icon: 'paid', sort: 6,
    note: 'Paid placement. disclosure_label renders on every surface, always.',
    display: '{{advertiser.name}} — {{tier}}' },

  // --- people --------------------------------------------------------------
  { name: 'people', group: 'grp_people', icon: 'person', sort: 1,
    note: 'Deduped on email. Consent fields are PDPA-relevant — read docs before editing.',
    display: '{{display_name}} ({{email}})' },
  { name: 'interest_registrations', group: 'grp_people', icon: 'how_to_reg', sort: 2,
    note: 'An expression of interest, not a booking.',
    display: '{{person.email}} → {{activity.title}}' },
  { name: 'coach_enquiries', group: 'grp_people', icon: 'contact_mail', sort: 3,
    note: 'A lead. Cannot be forwarded without consent to share contact.',
    display: '{{enquirer_email}} → {{coach.display_name}}' },
  { name: 'organisers', group: 'grp_people', icon: 'diversity_3', sort: 4,
    note: 'Clubs, gyms, race organisers. Separate from venues — a club is not a park.',
    display: '{{name}}', archive: 'archived', sortField: 'sort' },
  { name: 'organiser_claims', group: 'grp_people', icon: 'verified_user', sort: 5,
    note: 'Always human-reviewed. There is no auto-approval path.',
    display: '{{person.email}} → {{organiser.name}}' },
  { name: 'organiser_members', group: 'grp_people', icon: 'manage_accounts', sort: 6,
    display: '{{person.email}} — {{role}}' },

  // --- taxonomy ------------------------------------------------------------
  { name: 'categories', group: 'grp_taxonomy', icon: 'category', sort: 1,
    display: '{{name}}', sortField: 'sort' },
  { name: 'tags', group: 'grp_taxonomy', icon: 'label', sort: 2, display: '{{name}}', sortField: 'sort' },
  { name: 'venues', group: 'grp_taxonomy', icon: 'place', sort: 3,
    note: 'nearest_mrt drives turnout more than coordinates do.',
    display: '{{name}}', archive: 'archived', sortField: 'sort' },

  // --- junctions: real collections, hidden from the sidebar ----------------
  { name: 'activity_tags',       hidden: true, display: '{{tag.name}}' },
  { name: 'activity_promotions', hidden: true, display: '{{promotion.title}}' },
  { name: 'activity_resources',  hidden: true, display: '{{resource.title}}' },
  { name: 'activity_coaches',    hidden: true, display: '{{coach.display_name}}' },
  { name: 'coach_categories',    hidden: true, display: '{{category.name}}' },
  { name: 'campaign_posts',      hidden: true, display: '{{post.headline}}' },
  { name: 'person_interests',    hidden: true, display: '{{category.name}}' },
  { name: 'auth_tokens',         hidden: true, display: '{{purpose}}' },
  { name: 'auth_sessions',       hidden: true, display: '{{person.email}}' },
];

/**
 * Field metadata the database cannot carry. Keys are `collection.field`.
 *
 * Anything omitted keeps whatever Directus infers, which is usually right.
 * These are the fields where a wrong default would cost a reviewer time or
 * cause a mistake.
 */
export const fields = {
  // the review surface - this is where an editor spends their twenty minutes
  'enrichment_proposals.evidence': {
    interface: 'input-multiline', width: 'full',
    note: 'The quoted source text this inference rests on. No evidence = treat as low confidence.',
    readonly: true,
  },
  'enrichment_proposals.confidence': { interface: 'slider', options: { minValue: 0, maxValue: 1, stepInterval: 0.01 }, readonly: true },
  'enrichment_proposals.reasoning':  { interface: 'input-multiline', readonly: true },
  'enrichment_proposals.model':      { readonly: true, width: 'half' },
  'enrichment_proposals.prompt_version': { readonly: true, width: 'half' },

  // the attributes the product rests on
  'activities.solo_friendly':     { width: 'half', note: 'Can I come alone without it being weird? Bias toward unknown.' },
  'activities.newcomer_norm':     { width: 'half', note: 'Will I be the only new face?' },
  'activities.conversation_load': { width: 'half', note: 'Parallel (pottery) vs conversational (book club).' },
  'activities.pressure_level':    { width: 'half' },
  'activities.group_size':        { width: 'half' },
  'activities.social_after':      { width: 'half', note: 'Is there kopi afterwards?' },
  'activities.confirmed_fields':  { readonly: true, note: 'Set by the review flow. Do not edit by hand.' },
  'activities.enrichment_status': { readonly: true, note: 'Must be "confirmed" before this can be approved — the database enforces it.' },
  'activities.summary':           { interface: 'input-multiline', width: 'full', note: 'Canonical. All channel copy derives from this.' },
  'activities.description':       { interface: 'input-rich-text-md', width: 'full' },
  'activities.dedupe_key':        { readonly: true, hidden: true },
  'activities.content_hash':      { readonly: true, hidden: true },
  'activities.quality_score':     { interface: 'slider', options: { minValue: 0, maxValue: 100, stepInterval: 1 } },

  // trust surfaces - never editable by a bot, and flagged for the human
  'resources.credibility':      { note: 'Only a person sets this. Must be "reputable" before the resource can be published.' },
  'coaches.verification_status':{ note: 'documents_checked means certification or insurance was actually seen.' },
  'coaches.works_with_minors':  { note: 'Requires documents_checked. Recommendation: leave off entirely until safeguarding exists.' },
  'coaches.coach_type':         { note: 'Peer coaching is a real offering. Never present a peer coach as a professional.' },
  'coaches.credentials':        { interface: 'input-multiline', note: 'Required before a professional can be published.' },
  'coaches.bio':                { interface: 'input-rich-text-md', width: 'full' },

  // publishing
  'posts.body':                     { interface: 'input-rich-text-md', width: 'full' },
  'post_variants.body':             { interface: 'input-multiline', width: 'full' },
  'publications.idempotency_key':   { readonly: true, hidden: true },
  'publications.manual_token_hash': { readonly: true, hidden: true },
  'publications.payload_hash':      { readonly: true, hidden: true },
  'publications.external_post_id':  { readonly: true },
  'publications.last_error':        { readonly: true, interface: 'input-multiline' },
  'publications.attempts':          { readonly: true, width: 'half' },
  'channels.config':                { interface: 'input-code', options: { language: 'json' } },
  'sponsorships.disclosure_label':  { note: 'Rendered on every surface. Required by Singapore advertising guidelines.' },

  // credentials and personal data - never browsable in the Data Studio
  'auth_tokens.token_hash':    { readonly: true, hidden: true },
  'auth_sessions.token_hash':  { readonly: true, hidden: true },
  'people.consent_at':             { readonly: true },
  'people.consent_text_version':   { readonly: true },
  'interest_registrations.show_publicly': { note: 'Opt-in. Even when true, only counts are shown publicly — never names.' },

  // ingestion
  'sources.config':      { interface: 'input-code', options: { language: 'json' } },
  'sources.terms_note':  { interface: 'input-multiline', note: 'What we are permitted to do with this source.' },
  'raw_items.raw_payload': { interface: 'input-code', options: { language: 'json' }, readonly: true },
};

/**
 * Access policies.
 *
 * The separation that matters: no bot role can approve anything, and no bot can
 * mark a resource reputable or a coach verified. Those are the two places where
 * an automated mistake becomes a public one. The database enforces the gates;
 * these policies stop a bot reaching them in the first place.
 */
const ALL = ['create', 'read', 'update', 'delete'];
const CONTENT = ['activities', 'sessions', 'coaches', 'promotions', 'resources',
                 'organisers', 'venues', 'categories', 'tags',
                 'activity_tags', 'activity_promotions', 'activity_resources',
                 'activity_coaches', 'coach_categories'];
const PUBLISHING = ['posts', 'post_variants', 'campaigns', 'campaign_posts'];

export const policies = [
  {
    name: 'Editor',
    icon: 'edit_note',
    description: 'Prepares content and confirms AI proposals. Cannot approve or publish.',
    permissions: [
      ...CONTENT.map((c) => ({ collection: c, actions: ALL })),
      ...PUBLISHING.map((c) => ({ collection: c, actions: ALL })),
      { collection: 'enrichment_proposals', actions: ALL },
      { collection: 'submissions', actions: ['read', 'update'] },
      { collection: 'sources', actions: ['read'] },
      { collection: 'raw_items', actions: ['read'] },
      { collection: 'publications', actions: ['read'] },
      { collection: 'interest_registrations', actions: ['read'] },
      { collection: 'coach_enquiries', actions: ['read', 'update'] },
      // an editor may move work forward, but not past review
      { collection: 'activities', actions: ['update'],
        validation: { status: { _in: ['draft', 'pending_review', 'needs_info'] } } },
    ],
  },
  {
    name: 'Approver',
    icon: 'verified',
    description: 'Everything an editor can do, plus approve, reject, and set credibility and coach verification.',
    inherits: 'Editor',
    permissions: [
      { collection: 'activities', actions: ALL },
      { collection: 'resources', actions: ALL },
      { collection: 'coaches', actions: ALL },
      { collection: 'posts', actions: ALL },
      { collection: 'submissions', actions: ALL },
      { collection: 'organiser_claims', actions: ALL },
      { collection: 'organiser_members', actions: ALL },
      { collection: 'sponsorships', actions: ALL },
    ],
  },
  {
    name: 'Ingest bot',
    icon: 'smart_toy',
    description: 'The worker. Writes raw items, draft activities and AI proposals. Cannot approve anything.',
    permissions: [
      { collection: 'raw_items', actions: ALL },
      { collection: 'sources', actions: ['read', 'update'],
        fields: ['last_polled_at', 'last_status', 'last_error'] },
      { collection: 'activities', actions: ['create', 'read'] },
      // may enrich and re-verify, but may not touch status or the gate
      { collection: 'activities', actions: ['update'],
        fields: ['summary', 'description', 'hero_image', 'last_verified_at',
                 'content_hash', 'quality_score', 'spots_remaining',
                 'enrichment_status'],
        validation: { status: { _in: ['draft', 'pending_review'] } } },
      { collection: 'sessions', actions: ALL },
      { collection: 'enrichment_proposals', actions: ['create', 'read'] },
      { collection: 'submissions', actions: ['create', 'read'] },
      { collection: 'categories', actions: ['read'] },
      { collection: 'tags', actions: ['read'] },
      { collection: 'organisers', actions: ['create', 'read'] },
      { collection: 'venues', actions: ['create', 'read'] },
      // deliberately absent: resources.credibility, coaches.verification_status,
      // and any path to status = approved or published.
    ],
  },
  {
    name: 'Publish bot',
    icon: 'rocket_launch',
    description: 'Reads approved posts and writes the publication ledger. Cannot edit content.',
    permissions: [
      { collection: 'posts', actions: ['read'] },
      { collection: 'posts', actions: ['update'], fields: ['status', 'published_at'],
        validation: { status: { _in: ['scheduled', 'published', 'failed'] } } },
      { collection: 'post_variants', actions: ['create', 'read', 'update'] },
      { collection: 'publications', actions: ['create', 'read', 'update'] },
      { collection: 'channels', actions: ['read'] },
      { collection: 'activities', actions: ['read'] },
      { collection: 'promotions', actions: ['read'] },
      { collection: 'resources', actions: ['read'] },
      { collection: 'coaches', actions: ['read'] },
      { collection: 'sponsorships', actions: ['read'] },
    ],
  },
];
