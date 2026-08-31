/**
 * The model call for channel copy. Injectable, so the pass is testable without
 * a network or an API key.
 */

import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { SYSTEM_PROMPT, buildUserMessage, buildOutputSchema } from './prompt.mjs';

export const DEFAULT_MODEL = 'claude-opus-5';

/**
 * Copy generation is less consequential than the enrichment judgements - a
 * clumsy sentence is visible and fixable, a wrong `solo_friendly` is not - so
 * this defaults a step lower. Raise it if the copy reads flat.
 */
export const DEFAULT_EFFORT = 'medium';

export function createVariantWriter({ client = new Anthropic(), model = DEFAULT_MODEL,
                                      effort = DEFAULT_EFFORT } = {}) {
  return async function writeVariants(post, channels, context, { feedback = null } = {}) {
    const messages = [{ role: 'user', content: buildUserMessage(post, channels, context) }];

    // One repair round: the model is told exactly what failed and rewrites only
    // what it must. Cheaper and better than regenerating blind.
    if (feedback) {
      messages.push({ role: 'assistant', content: JSON.stringify(feedback.previous) });
      messages.push({
        role: 'user',
        content: `That copy failed validation:\n\n${feedback.problems.map((p) => `- ${p}`).join('\n')}\n\n` +
                 'Rewrite it, fixing exactly those problems and changing nothing else. ' +
                 'The character limits are hard limits.',
      });
    }

    const response = await client.messages.parse({
      model,
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      thinking: { type: 'adaptive' },
      output_config: { effort, format: zodOutputFormat(buildOutputSchema(channels), 'channel_copy') },
      messages,
    });

    if (response.stop_reason === 'refusal') {
      throw Object.assign(
        new Error(`model declined: ${response.stop_details?.category ?? 'unspecified'}`),
        { refusal: true },
      );
    }
    if (!response.parsed_output) throw new Error('model returned no parsable output');

    return { variants: response.parsed_output, model };
  };
}
