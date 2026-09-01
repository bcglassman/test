'use client';

import { useState } from 'react';

/**
 * Registering interest. Not a booking, and the copy says so — promising a place
 * we cannot hold is the fastest way to lose someone on their first try.
 *
 * Consent is a separate, unticked box (PDPA), and it is for updates about this
 * event only. Marketing consent is a different decision made elsewhere.
 */
export default function InterestForm({ activitySlug, activityTitle }) {
  const [state, setState] = useState('idle');
  const [message, setMessage] = useState(null);

  async function onSubmit(event) {
    event.preventDefault();
    setState('sending');
    setMessage(null);

    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch('/api/interest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activity: activitySlug,
          name: form.get('name'),
          email: form.get('email'),
          first_timer: form.get('first_timer') === 'on',
          consent: form.get('consent') === 'on',
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? 'Something went wrong.');
      setState('done');
    } catch (error) {
      setState('idle');
      setMessage(error.message);
    }
  }

  if (state === 'done') {
    return (
      <div className="panel">
        <h3>You&rsquo;re on the list</h3>
        <p className="note">
          We&rsquo;ll email you what to expect and how to find everyone. This isn&rsquo;t a
          booking — check the organiser&rsquo;s page if a place needs reserving.
        </p>
      </div>
    );
  }

  return (
    <form className="panel" onSubmit={onSubmit}>
      <h3>Interested?</h3>
      <p className="note" style={{ marginBottom: '.9rem' }}>
        Tell us and we&rsquo;ll send you what to expect. <strong>This isn&rsquo;t a booking</strong> —
        no money changes hands and no place is held.
      </p>

      <label className="field">
        <span>Name</span>
        <input type="text" name="name" required autoComplete="name" />
      </label>
      <label className="field">
        <span>Email</span>
        <input type="email" name="email" required autoComplete="email" />
      </label>

      <label className="consent">
        <input type="checkbox" name="first_timer" />
        <span>This would be my first time at something like this</span>
      </label>
      <label className="consent">
        <input type="checkbox" name="consent" required />
        <span>Email me about {activityTitle}. I can unsubscribe at any time.</span>
      </label>

      {message && <p className="note" style={{ color: 'var(--accent)' }}>{message}</p>}

      <button className="btn" type="submit" disabled={state === 'sending'}>
        {state === 'sending' ? 'Sending…' : 'Register interest'}
      </button>
    </form>
  );
}
