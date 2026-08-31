/**
 * The model call. Isolated behind one function so the enrichment pass can be
 * tested end to end without a network or an API key.
 */

import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { SYSTEM_PROMPT, buildUserMessage, buildOutputSchema } from './prompt.mjs';

export const DEFAULT_MODEL = 'claude-opus-5';

/**
 * Effort is the cost lever worth measuring here. The default is `high`,
 * because these judgements are the product's whole differentiator and a wrong
 * `solo_friendly` is expensive in a way tokens are not. `medium` is the
 * step-down to try once there is enough reviewed data to compare against.
 */
export const DEFAULT_EFFORT = 'high';

export function createModelCaller({ client = new Anthropic(), model = DEFAULT_MODEL,
                                    effort = DEFAULT_EFFORT } = {}) {
  return async function callModel(activity, allowed) {
    const response = await client.messages.parse({
      model,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      thinking: { type: 'adaptive' },
      output_config: {
        effort,
        format: zodOutputFormat(buildOutputSchema(allowed), 'soft_attributes'),
      },
      messages: [{ role: 'user', content: buildUserMessage(activity, allowed) }],
    });

    // Always check stop_reason before reading content: a policy decline returns
    // HTTP 200 with no usable output.
    if (response.stop_reason === 'refusal') {
      throw Object.assign(
        new Error(`model declined: ${response.stop_details?.category ?? 'unspecified'}`),
        { refusal: true },
      );
    }
    if (!response.parsed_output) {
      throw new Error('model returned no parsable output');
    }

    return { attributes: response.parsed_output, model, usage: response.usage };
  };
}
