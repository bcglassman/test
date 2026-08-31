-- =============================================================================
-- Meet in Motion - migration 004
--
-- Channel copy that fails validation needs somewhere to say why. Without this
-- a rejected variant is indistinguishable from one that was never generated,
-- and an editor cannot tell whether to wait or to write it themselves.
--
-- Requires 001-003.
-- =============================================================================

ALTER TABLE post_variants
    ADD COLUMN generation_note text,
    ADD COLUMN attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0);

COMMENT ON COLUMN post_variants.generation_note IS
    'Why this variant was rejected, or what had to be repaired. Written by the '
    'generator, read by a human deciding whether to fix it or write it by hand.';

-- A rejected variant must explain itself.
ALTER TABLE post_variants
    ADD CONSTRAINT post_variants_rejected_states_reason
        CHECK (status <> 'rejected' OR generation_note IS NOT NULL);
