import React, { useState } from 'react';

interface FormData {
  name: string;
  email: string;
  phone: string;
  occupation: string;
  ageGroup: string;
}

interface FormErrors {
  name?: string;
  email?: string;
  phone?: string;
  occupation?: string;
  ageGroup?: string;
}

interface IntroScreenProps {
  onStart: (formData: FormData) => void;
  /** Call this to start the quiz immediately (no form save). Ensures the CTA always works. */
  onStartDirect?: () => void;
  isStarting?: boolean;
  startError?: string;
}

/**
 * IntroScreen Component
 * Welcomes users and explains the voice archetype quiz
 */
const IntroScreen: React.FC<IntroScreenProps> = ({ onStart, onStartDirect, isStarting = false, startError = '' }) => {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    phone: '',
    occupation: '',
    ageGroup: ''
  });
  const [errors, setErrors] = useState<FormErrors>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement> | { target: { name: string; value: string } }) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (errors[name as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    const phoneDigits = formData.phone.replace(/\D/g, '');

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (phoneDigits.length < 8 || phoneDigits.length > 15) {
      newErrors.phone = 'Please enter a valid phone number (8–15 digits)';
    }

    if (!formData.occupation.trim()) {
      newErrors.occupation = 'Occupation is required';
    }

    if (!formData.ageGroup.trim()) {
      newErrors.ageGroup = 'Age group is required';
    }

    const isValid = Object.keys(newErrors).length === 0;
    setErrors(newErrors);
    // Temporary logging to confirm whether validation is blocking quiz start
    console.log('[IntroScreen validateForm]', {
      formData: { ...formData },
      validationResult: isValid,
      errors: newErrors,
    });
    return isValid;
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isStarting) return;
    if (validateForm()) {
      onStart(formData);
    }
  };

  /** Begin Your Discovery: always open quiz first so click never feels broken, then try to save if form is valid. */
  const handleBeginDiscovery = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (isStarting) return;
    console.log('[IntroScreen Begin Your Discovery]', { formData: { ...formData } });
    // Set hash so parent's hashchange listener will switch to quiz even if onStartDirect doesn't update (e.g. hydration)
    if (typeof window !== 'undefined') window.location.hash = '#start';
    if (onStartDirect) onStartDirect();
    if (validateForm()) onStart(formData);
  };

  return (
    <div className="relative w-full max-w-3xl mx-auto text-center animate-fade-in">
      {/* Hero Section */}
      <div className="mb-8">
        <div className="inline-flex items-center justify-center mb-6 animate-scale-in">
          <img 
            src="/logo.png" 
            alt="The Signature Voice" 
            width={180}
            height={180}
            className="drop-shadow-lg" 
          />
        </div>
        <h1 className="text-h1 md:text-display bg-gradient-to-r from-neon-blue via-neon-blue-light to-neon-purple bg-clip-text text-transparent mb-4">
          Discover Your Voice Archetype
        </h1>
        <p className="text-body-lg text-neutral-300 max-w-2xl mx-auto leading-relaxed">
          Your voice is more than words—it's a reflection of how you think, connect, and lead.
        </p>
      </div>

      {/* Info Cards */}
      <div className="grid md:grid-cols-2 gap-6 mb-10 text-left">
        <div className="bg-neutral-900/80 backdrop-blur-sm rounded-xl p-6 border border-neutral-700 hover:border-neon-blue/50 transition-all duration-300 hover:shadow-glow-soft">
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-10 h-10 rounded-lg bg-neon-blue/20 flex items-center justify-center text-xl">
              ⏱️
            </div>
            <div>
              <h3 className="font-semibold text-neutral-100 mb-1">5 Minutes</h3>
              <p className="text-body-sm text-neutral-400">14 thoughtful questions about your communication style</p>
            </div>
          </div>
        </div>

        <div className="bg-neutral-900/80 backdrop-blur-sm rounded-xl p-6 border border-neutral-700 hover:border-neon-purple/50 transition-all duration-300 hover:shadow-glow-soft">
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-10 h-10 rounded-lg bg-neon-purple/20 flex items-center justify-center text-xl">
              🎯
            </div>
            <div>
              <h3 className="font-semibold text-neutral-100 mb-1">4 Archetypes</h3>
              <p className="text-body-sm text-neutral-400">The Analyst, Connector, Leader, or Hidden Voice</p>
            </div>
          </div>
        </div>
      </div>

      {/* What You'll Learn */}
      <div className="bg-gradient-to-br from-neutral-900 to-neutral-800/80 rounded-2xl p-8 mb-10 border border-neutral-700">
        <h2 className="text-h2 bg-gradient-to-r from-neon-blue to-neon-purple bg-clip-text text-transparent mb-4">What You'll Discover</h2>
        <ul className="text-left space-y-3 max-w-xl mx-auto">
          <li className="flex items-start gap-3">
            <span className="text-neon-blue shrink-0 mt-1">✓</span>
            <span className="text-body text-neutral-300">Your unique communication strengths and natural voice patterns</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-neon-blue shrink-0 mt-1">✓</span>
            <span className="text-body text-neutral-300">The hidden challenges holding your voice back</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-neon-purple shrink-0 mt-1">✓</span>
            <span className="text-body text-neutral-300">Your personalized growth path to vocal mastery</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-neon-purple shrink-0 mt-1">✓</span>
            <span className="text-body text-neutral-300">Recommended programs tailored to your archetype</span>
          </li>
        </ul>
      </div>

      {/* User Details Form */}
      <form
        onSubmit={handleSubmit}
        action="javascript:void(0)"
        method="post"
        className="bg-neutral-900 rounded-2xl p-8 mb-8 border border-neutral-700 shadow-card text-left max-w-xl mx-auto"
        noValidate
      >
        {startError && (
          <div className="mb-4 rounded-md border border-red-500/50 bg-red-500/10 p-3 text-red-400 text-body">
            {startError}
          </div>
        )}
        <h2 className="text-h2 text-neutral-100 mb-6 text-center">Let's Get Started</h2>
        
        {/* Name Field */}
        <div className="mb-5">
          <label htmlFor="name" className="block text-body font-medium text-neutral-300 mb-2">
            Full Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            disabled={isStarting}
            className={`w-full px-4 py-3 rounded-lg border-2 transition-all duration-300 focus:outline-none focus:ring-2 bg-neutral-800 text-neutral-100 placeholder-neutral-500 ${
              errors.name ? 'border-red-500 focus:ring-red-500/20' : 'border-neutral-600 focus:border-neon-blue focus:ring-neon-blue/20'
            }`}
            placeholder="Enter your full name"
          />
          {errors.name && <p className="text-red-400 text-body-sm mt-1">{errors.name}</p>}
        </div>

        {/* Email Field */}
        <div className="mb-5">
          <label htmlFor="email" className="block text-body font-medium text-neutral-300 mb-2">
            Email Address <span className="text-red-400">*</span>
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            disabled={isStarting}
            className={`w-full px-4 py-3 rounded-lg border-2 transition-all duration-300 focus:outline-none focus:ring-2 bg-neutral-800 text-neutral-100 placeholder-neutral-500 ${
              errors.email ? 'border-red-500 focus:ring-red-500/20' : 'border-neutral-600 focus:border-neon-blue focus:ring-neon-blue/20'
            }`}
            placeholder="your.email@example.com"
          />
          {errors.email && <p className="text-red-400 text-body-sm mt-1">{errors.email}</p>}
        </div>

        {/* Phone Field */}
        <div className="mb-5">
          <label htmlFor="phone" className="block text-body font-medium text-neutral-300 mb-2">
            Phone Number <span className="text-red-400">*</span>
          </label>
          <input
            type="tel"
            id="phone"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            disabled={isStarting}
            maxLength={10}
            className={`w-full px-4 py-3 rounded-lg border-2 transition-all duration-300 focus:outline-none focus:ring-2 bg-neutral-800 text-neutral-100 placeholder-neutral-500 ${
              errors.phone ? 'border-red-500 focus:ring-red-500/20' : 'border-neutral-600 focus:border-neon-blue focus:ring-neon-blue/20'
            }`}
            placeholder="9876543210"
          />
          {errors.phone && <p className="text-red-400 text-body-sm mt-1">{errors.phone}</p>}
        </div>

        {/* Occupation Field */}
        <div className="mb-5">
          <label htmlFor="occupation" className="block text-body font-medium text-neutral-300 mb-2">
            Occupation <span className="text-red-400">*</span>
          </label>
          <select
            id="occupation"
            name="occupation"
            value={formData.occupation}
            onChange={handleChange}
            disabled={isStarting}
            className={`w-full px-4 py-3 rounded-lg border-2 transition-all duration-300 focus:outline-none focus:ring-2 bg-neutral-800 text-neutral-100 focus:ring-neon-blue/20 appearance-none cursor-pointer ${
              errors.occupation ? 'border-red-500 focus:ring-red-500/20' : 'border-neutral-600 focus:border-neon-blue'
            }`}
            style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.75rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em', paddingRight: '2.5rem' }}
          >
            <option value="">Select your occupation</option>
            <option value="Student">Student</option>
            <option value="Self-Employed">Self-Employed</option>
            <option value="Freelancer">Freelancer</option>
            <option value="Working Professional">Working Professional</option>
            <option value="Business Owner">Business Owner</option>
          </select>
          {errors.occupation && <p className="text-red-400 text-body-sm mt-1">{errors.occupation}</p>}
        </div>

        {/* Age Group Field */}
        <div className="mb-6">
          <label htmlFor="ageGroup" className="block text-body font-medium text-neutral-300 mb-2">
            Age Group <span className="text-red-400">*</span>
          </label>
          <select
            id="ageGroup"
            name="ageGroup"
            value={formData.ageGroup}
            onChange={handleChange}
            disabled={isStarting}
            className={`w-full px-4 py-3 rounded-lg border-2 transition-all duration-300 focus:outline-none focus:ring-2 bg-neutral-800 text-neutral-100 focus:ring-neon-blue/20 appearance-none cursor-pointer ${
              errors.ageGroup ? 'border-red-500 focus:ring-red-500/20' : 'border-neutral-600 focus:border-neon-blue'
            }`}
            style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.75rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em', paddingRight: '2.5rem' }}
          >
            <option value="">Select your age group</option>
            <option value="18-24">18-24</option>
            <option value="25-34">25-34</option>
            <option value="35-44">35-44</option>
            <option value="45-54">45-54</option>
            <option value="55+">55+</option>
          </select>
          {errors.ageGroup && <p className="text-red-400 text-body-sm mt-1">{errors.ageGroup}</p>}
        </div>

        {/* Begin Your Discovery: starts quiz (and saves form if valid) */}
        <button
          type="button"
          onClick={handleBeginDiscovery}
          disabled={isStarting}
          className="relative z-[100] block w-full text-white font-semibold px-10 py-4 rounded-lg transition-all duration-300 shadow-lg group inline-flex items-center justify-center gap-2 bg-gradient-to-r from-neon-blue to-neon-purple hover:shadow-glow hover:scale-[1.02] cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
          aria-label="Start the voice archetype quiz"
        >
          <span>Begin Your Discovery</span>
          <span className="transform group-hover:translate-x-1 transition-transform duration-300">→</span>
        </button>
      </form>

      <p className="text-body-sm text-neutral-500 mt-4">
        Your information is secure • Instant results • 100% free
      </p>
    </div>
  );
};

export default IntroScreen;

