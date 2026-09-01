'use client';

import { useState } from 'react';

/**
 * Copy, open the app, mark sent.
 *
 * Opening WhatsApp deliberately does NOT mark the post as sent. Opening is not
 * sending, and a ledger that says "published" when nothing went out is what
 * causes a double-post later. Marking is always a separate, explicit tap.
 */
export default function MarkSent({ publicationId, token, body, channelKey }) {
  const [copied, setCopied] = useState(false);
  const [state, setState] = useState('idle');
  const [error, setError] = useState(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError('Could not copy automatically — select the text above and copy it.');
    }
  }

  async function submit(status) {
    setState('saving');
    setError(null);
    try {
      const response = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, publicationId, status }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? 'Could not save that.');
      }
      setState(status === 'published' ? 'sent' : 'skipped');
    } catch (cause) {
      setState('idle');
      setError(cause.message);
    }
  }

  if (state === 'sent') {
    return (
      <div className="panel" style={{ marginTop: '1rem' }}>
        <h3>Marked sent</h3>
        <p className="note">Recorded. You can close this.</p>
      </div>
    );
  }
  if (state === 'skipped') {
    return (
      <div className="panel" style={{ marginTop: '1rem' }}>
        <h3>Skipped</h3>
        <p className="note">Recorded as skipped — nothing went out on this channel.</p>
      </div>
    );
  }

  return (
    <div className="stack" style={{ marginTop: '1rem', gap: '.6rem' }}>
      <button className="btn" onClick={copy}>{copied ? 'Copied' : 'Copy text'}</button>

      {channelKey === 'whatsapp' && (
        <a className="btn secondary" href="whatsapp://">Open WhatsApp</a>
      )}

      <button className="btn" onClick={() => submit('published')} disabled={state === 'saving'}
              style={{ background: 'var(--accent)' }}>
        {state === 'saving' ? 'Saving…' : 'Mark sent'}
      </button>

      <button className="btn secondary" onClick={() => submit('skipped')} disabled={state === 'saving'}>
        Skip this one
      </button>

      {error && <p className="note" style={{ color: 'var(--accent)' }}>{error}</p>}
      <p className="note">
        Opening WhatsApp doesn&rsquo;t mark it sent — tap <strong>Mark sent</strong> once
        the post is actually up.
      </p>
    </div>
  );
}
