import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { validateVariant, validateAll, extractUrls, countHashtags } from '../src/variants/validate.mjs';
import { buildUserMessage, buildOutputSchema, SYSTEM_PROMPT } from '../src/variants/prompt.mjs';

const CANONICAL = 'https://meetinmotion.sg/e/tuesday-run';

const channel = (key, config) => ({ id: `c-${key}`, key, name: key, config });
const telegram  = channel('telegram',  { max_length: 4096, supports_links: true });
const whatsapp  = channel('whatsapp',  { max_length: 1024, supports_links: false });
const instagram = channel('instagram', { max_length: 2200, supports_links: false, hashtag_limit: 3 });
const push      = channel('push',      { max_length: 140,  supports_links: true });

const ctx = { allowedUrls: [CANONICAL] };

describe('length', () => {
  test('accepts copy inside the limit', () => {
    const result = validateVariant({ body: 'Short and fine.' }, push, ctx);
    assert.equal(result.ok, true);
  });

  test('rejects copy over the limit rather than trimming it', () => {
    const result = validateVariant({ body: 'x'.repeat(141) }, push, ctx);
    assert.equal(result.ok, false);
    assert.match(result.problems[0], /141 characters, over the 140 limit/);
  });

  test('rejects empty copy', () => {
    assert.equal(validateVariant({ body: '   ' }, telegram, ctx).ok, false);
  });
});

describe('links', () => {
  test('the canonical link is allowed', () => {
    assert.equal(validateVariant({ body: `Details: ${CANONICAL}` }, telegram, ctx).ok, true);
  });

  test('a trailing full stop does not make the link foreign', () => {
    assert.equal(validateVariant({ body: `See ${CANONICAL}.` }, telegram, ctx).ok, true);
  });

  test('a link that is not the canonical one is rejected', () => {
    // The failure mode: a generated post that quietly sends people elsewhere.
    const result = validateVariant(
      { body: `Sign up at https://bit.ly/3xKq9 today` }, telegram, ctx);
    assert.equal(result.ok, false);
    assert.match(result.problems[0], /not the canonical one/);
  });

  test('any link at all is rejected where links do not render', () => {
    const result = validateVariant({ body: `Details: ${CANONICAL}` }, whatsapp, ctx);
    assert.equal(result.ok, false);
    assert.match(result.problems[0], /does not render links/);
  });
});

describe('hashtags', () => {
  test('counts hashtags in body and hashtag field together', () => {
    assert.equal(countHashtags('A run #running with #sgfitness'), 2);
  });

  test('rejects going over the channel limit', () => {
    const result = validateVariant(
      { body: 'Come along.', hashtags: '#running #sg #padel #kopi' }, instagram, ctx);
    assert.equal(result.ok, false);
    assert.match(result.problems[0], /4 hashtags, over the 3 allowed/);
  });
});

describe('sponsorship disclosure', () => {
  const sponsored = { ...ctx, disclosureLabel: 'Sponsored' };

  test('copy carrying the label passes', () => {
    const result = validateVariant(
      { body: 'Sponsored — join the Tuesday run.' }, whatsapp, sponsored);
    assert.equal(result.ok, true);
  });

  test('copy missing the label is rejected, however good it reads', () => {
    const result = validateVariant({ body: 'Join the Tuesday run.' }, whatsapp, sponsored);
    assert.equal(result.ok, false);
    assert.match(result.problems[0], /missing its required disclosure label/);
  });

  test('the check is case-insensitive but the label must actually be there', () => {
    assert.equal(validateVariant({ body: 'sponsored post here' }, whatsapp, sponsored).ok, true);
    assert.equal(validateVariant({ body: 'sponsor us!' }, whatsapp, sponsored).ok, false);
  });
});

describe('placeholders', () => {
  for (const body of ['Join us at [insert venue]', 'TODO: write this', 'Lorem ipsum dolor', 'Meet at {{venue}}']) {
    test(`rejects: ${body}`, () => {
      assert.equal(validateVariant({ body }, telegram, ctx).ok, false);
    });
  }
});

describe('validateAll', () => {
  const channels = [telegram, whatsapp];

  test('splits valid from rejected per channel', () => {
    const { valid, rejected } = validateAll(
      { telegram: { body: `Run on Tuesday. ${CANONICAL}` }, whatsapp: { body: 'Run on Tuesday, 7am, East Coast.' } },
      channels, ctx);
    assert.deepEqual(valid.map((v) => v.channel.key), ['telegram', 'whatsapp']);
    assert.equal(rejected.length, 0);
  });

  test('a channel with no copy at all is a rejection, not a silence', () => {
    const { rejected } = validateAll({ telegram: { body: 'Fine.' } }, channels, ctx);
    assert.equal(rejected.length, 1);
    assert.equal(rejected[0].channel.key, 'whatsapp');
    assert.match(rejected[0].problems[0], /no copy was generated/);
  });
});

describe('prompt', () => {
  const post = {
    activity_title: 'Tuesday Easy 8km', organiser_name: 'East Coast Run Club',
    venue_name: 'East Coast Park', nearest_mrt: 'Bedok', summary: 'A friendly run.',
    solo_friendly: 'yes', newcomer_norm: 'unknown', social_after: true,
    price_min: 0, currency: 'SGD',
  };

  test('states the facts the copy may use, and no more', () => {
    const message = buildUserMessage(post, [telegram], ctx);
    assert.match(message, /Can someone come alone\?: yes/);
    assert.match(message, /Cost: Free/);
    assert.match(message, /Anything social afterwards\?: Yes/);
    assert.doesNotMatch(message, /newcomers common/i,
      'an unknown attribute is omitted rather than shown as unknown');
    assert.match(message, /Everything above is all you know/);
  });

  test('passes each channel its hard constraints', () => {
    const message = buildUserMessage(post, [whatsapp, instagram], ctx);
    assert.match(message, /hard limit 1024 characters; links do NOT work/);
    assert.match(message, /at most 3 hashtags/);
  });

  test('makes disclosure explicit when the post is sponsored', () => {
    const message = buildUserMessage(post, [telegram], { ...ctx, disclosureLabel: 'Sponsored' });
    assert.match(message, /must appear in the copy for every channel/);
  });

  test('the system prompt forbids invention and link construction', () => {
    assert.match(SYSTEM_PROMPT, /Invent nothing/);
    assert.match(SYSTEM_PROMPT, /Never construct, shorten, or guess a URL/);
    assert.match(SYSTEM_PROMPT, /hard limits, not targets/);
  });

  test('the schema asks for exactly the channels requested', () => {
    const schema = buildOutputSchema([telegram, whatsapp]);
    const ok = schema.safeParse({
      telegram: { headline: 'Run', body: 'text', hashtags: null },
      whatsapp: { headline: null, body: 'text', hashtags: null },
    });
    assert.equal(ok.success, true);
    assert.equal(schema.safeParse({ telegram: { headline: null, body: 'x', hashtags: null } }).success, false);
  });
});

describe('url extraction', () => {
  test('finds links and ignores bare words', () => {
    assert.deepEqual(extractUrls('go to https://a.test/x and http://b.test'), ['https://a.test/x', 'http://b.test']);
    assert.deepEqual(extractUrls('no links here'), []);
  });
});
