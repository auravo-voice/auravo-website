'use client';

import React, { useState, useEffect } from 'react';

type RequestType = 'workshop' | 'institution' | 'coach';

const VALID_TYPES: RequestType[] = ['workshop', 'institution', 'coach'];

const BookWorkshopForm = () => {
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    organization: '',
    requestType: 'workshop' as RequestType,
    preferredDate: '',
    participantCount: '',
    message: '',
  });

  // Pre-select request type from URL (e.g. /book-workshop?type=coach)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const type = params.get('type');
    if (type && VALID_TYPES.includes(type as RequestType)) {
      setForm((prev) => ({ ...prev, requestType: type as RequestType }));
    }
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('submitting');
    setErrorMessage('');

    try {
      const res = await fetch('/api/book-workshop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || undefined,
          organization: form.organization.trim() || undefined,
          requestType: form.requestType,
          preferredDate: form.preferredDate.trim() || undefined,
          participantCount: form.participantCount.trim() || undefined,
          message: form.message.trim(),
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setStatus('error');
        setErrorMessage(data.error || 'Something went wrong. Please try again.');
        return;
      }

      setStatus('success');
      setForm({
        name: '',
        email: '',
        phone: '',
        organization: '',
        requestType: 'workshop',
        preferredDate: '',
        participantCount: '',
        message: '',
      });
    } catch {
      setStatus('error');
      setErrorMessage('Network error. Please check your connection and try again.');
    }
  };

  const inputClass =
    'w-full px-4 py-3 rounded-lg bg-neutral-900/80 border border-neutral-700 text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-neon-blue/50 focus:border-neon-blue transition-colors';
  const labelClass = 'block text-sm font-medium text-neutral-300 mb-1.5';

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-xl mx-auto">
      <div className="grid sm:grid-cols-2 gap-6">
        <div>
          <label htmlFor="name" className={labelClass}>
            Full name <span className="text-red-400">*</span>
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            value={form.name}
            onChange={handleChange}
            className={inputClass}
            placeholder="Jane Smith"
            disabled={status === 'submitting'}
          />
        </div>
        <div>
          <label htmlFor="email" className={labelClass}>
            Email <span className="text-red-400">*</span>
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            value={form.email}
            onChange={handleChange}
            className={inputClass}
            placeholder="jane@example.com"
            disabled={status === 'submitting'}
          />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-6">
        <div>
          <label htmlFor="phone" className={labelClass}>
            Phone
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            value={form.phone}
            onChange={handleChange}
            className={inputClass}
            placeholder="+1 (555) 000-0000"
            disabled={status === 'submitting'}
          />
        </div>
        <div>
          <label htmlFor="organization" className={labelClass}>
            Organization / Institution
          </label>
          <input
            id="organization"
            name="organization"
            type="text"
            value={form.organization}
            onChange={handleChange}
            className={inputClass}
            placeholder="Acme University"
            disabled={status === 'submitting'}
          />
        </div>
      </div>

      <div>
        <label htmlFor="requestType" className={labelClass}>
          I want to <span className="text-red-400">*</span>
        </label>
        <select
          id="requestType"
          name="requestType"
          required
          value={form.requestType}
          onChange={handleChange}
          className={inputClass}
          disabled={status === 'submitting'}
        >
          <option value="workshop">Book a workshop</option>
          <option value="institution">Bring Auravo to my institution</option>
          <option value="coach">Review my voice with a coach</option>
        </select>
      </div>

      {form.requestType === 'workshop' && (
        <div className="grid sm:grid-cols-2 gap-6">
          <div>
            <label htmlFor="preferredDate" className={labelClass}>
              Preferred date(s) or timing
            </label>
            <input
              id="preferredDate"
              name="preferredDate"
              type="text"
              value={form.preferredDate}
              onChange={handleChange}
              className={inputClass}
              placeholder="e.g. Next month, or I'm flexible"
              disabled={status === 'submitting'}
            />
          </div>
          <div>
            <label htmlFor="participantCount" className={labelClass}>
              Approximate number of participants
            </label>
            <input
              id="participantCount"
              name="participantCount"
              type="text"
              value={form.participantCount}
              onChange={handleChange}
              className={inputClass}
              placeholder="e.g. 15–20"
              disabled={status === 'submitting'}
            />
          </div>
        </div>
      )}

      <div>
        <label htmlFor="message" className={labelClass}>
          Message / What you need <span className="text-red-400">*</span>
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={4}
          value={form.message}
          onChange={handleChange}
          className={`${inputClass} resize-y min-h-[100px]`}
          placeholder="Tell us about your goals, timeline, or any questions..."
          disabled={status === 'submitting'}
        />
      </div>

      {status === 'error' && (
        <div className="p-4 rounded-lg bg-red-950/50 border border-red-900/50 text-red-200 text-sm">
          {errorMessage}
        </div>
      )}

      {status === 'success' && (
        <div className="p-4 rounded-lg bg-green-950/30 border border-green-800/50 text-green-200 text-sm">
          Thanks for your request. We'll be in touch soon.
        </div>
      )}

      <div className="pt-2">
        <button
          type="submit"
          disabled={status === 'submitting'}
          className="w-full sm:w-auto inline-flex justify-center items-center px-8 py-4 rounded-lg bg-gradient-to-r from-neon-blue to-neon-purple text-white font-semibold hover:shadow-glow focus:outline-none focus:ring-2 focus:ring-neon-blue focus:ring-offset-2 focus:ring-offset-neutral-950 disabled:opacity-70 disabled:cursor-not-allowed transition-all"
        >
          {status === 'submitting' ? 'Sending…' : 'Send request'}
        </button>
      </div>
    </form>
  );
};

export default BookWorkshopForm;
