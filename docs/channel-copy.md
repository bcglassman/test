# Channel copy

Turning an approved post into the copy that actually goes out, per channel. Built in
`worker/src/variants/`.

```sh
node src/index.mjs variants --dry-run       # generate and print, write nothing
node src/index.mjs variants --limit 10
```

## One call, every channel

All of a post's channels are written in a single model call. Three reasons: the material
is paid for once, the voice stays consistent across channels, and each channel's copy can
be written *for its own reader* rather than as a trimmed version of the website's.

The prompt gives each channel its brief and its hard constraints — WhatsApp gets "links
do NOT work, the message must stand alone"; Instagram gets "no clickable links, so never
say link below". Those constraints come from `channels.config`, so adding a channel stays
a row plus a brief.

## Validation is not advisory

Generated copy is a suggestion. These are the rules, checked before anything is stored:

| Rule | Why |
|---|---|
| Within the channel's `max_length` | Over-length copy is rejected by the channel, not trimmed by it |
| No links where `supports_links` is false | "Link below" on WhatsApp is a dead end |
| **Every URL must be the canonical one** | A generated post that quietly sends people to a shortener is how this becomes a phishing vector |
| Within `hashtag_limit` | Instagram silently drops the overflow |
| No placeholder text | `[insert venue]` reaching a channel is unrecoverable |
| **Sponsored posts must carry the disclosure label** | A legal requirement, and the reason disclosure is structural everywhere else in this design |

The two in bold are never softened into warnings.

## One repair round, then it stops

Anything that fails gets one more attempt — the model is told exactly what failed, for
exactly the channels that failed, and asked to change nothing else. That is cheaper and
better than regenerating blind, and it fixes the common cases: twelve characters over the
limit, a shortener that crept in.

If it still fails, the variant is stored as **rejected with its reason** in
`generation_note` rather than left absent. An editor can then tell "the generator could
not do this" from "nobody has run the generator yet", which are different problems. The
bad copy itself is not stored — `body` stays null, so there is nothing publishable.

## Everything is a draft

Variants are created with status `draft`. The publish worker reads only approved ones, so
nothing in this pass can put copy in front of the public.

Regeneration only touches channels that have no variant. An edited or approved variant is
never overwritten by a later run.

## Model

`claude-opus-5` with adaptive thinking and structured outputs. Effort defaults to
`medium`, a step below enrichment: a clumsy sentence is visible and fixable, while a wrong
`solo_friendly` is neither. Raise it with `--effort high` or `VARIANT_EFFORT` if the copy
reads flat.

`model` and `prompt_version` are recorded on every variant, and `attempts` counts how many
times a channel has been regenerated — a rising count is a signal that the brief for that
channel needs work.
