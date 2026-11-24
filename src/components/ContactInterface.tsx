import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { CheckCircle2, Clock, Mail, MapPin, Phone, X } from 'lucide-react';
import { ContactDetails, FloorHotspot } from '../types/architecture';

interface ContactInterfaceProps {
  open: boolean;
  contact: ContactDetails;
  floors: FloorHotspot[];
  preselectedFloorLabel?: string;
  preselectedUnitLabel?: string;
  onClose: () => void;
}

export const ContactInterface: React.FC<ContactInterfaceProps> = ({
  open,
  contact,
  floors,
  preselectedFloorLabel,
  preselectedUnitLabel,
  onClose,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [preferredLevel, setPreferredLevel] = useState(
    preselectedFloorLabel || floors[0]?.levelLabel || 'LEVEL 26'
  );
  const [unitInterest, setUnitInterest] = useState(preselectedUnitLabel || '');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationRef, setConfirmationRef] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (preselectedFloorLabel) {
      setPreferredLevel(preselectedFloorLabel);
    }
  }, [preselectedFloorLabel]);

  useEffect(() => {
    if (open) {
      setUnitInterest(preselectedUnitLabel || '');
      setError(null);
    }
  }, [open, preselectedUnitLabel]);

  useEffect(() => {
    if (!open) return;
    if (panelRef.current) {
      gsap.fromTo(
        panelRef.current,
        { opacity: 0, y: 18, scale: 0.98 },
        { opacity: 1, y: 0, scale: 1, duration: 0.38, ease: 'power3.out', clearProps: 'transform' }
      );
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName) {
      setError('Please enter your full name.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch('/api/enquiries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: trimmedName,
          email: trimmedEmail,
          phone: phone.trim(),
          preferredLevel,
          unitInterest: unitInterest.trim(),
          message: message.trim(),
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        reference?: string;
        error?: string;
      } | null;

      if (!response.ok || !payload?.ok) {
        setError(payload?.error || 'Unable to submit enquiry right now. Please try again.');
        return;
      }

      setConfirmationRef(payload.reference || 'REGISTERED');
    } catch {
      setError('Network error while contacting the private viewing desk.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setConfirmationRef(null);
    setName('');
    setEmail('');
    setPhone('');
    setUnitInterest('');
    setMessage('');
    onClose();
  };

  const sanitizedPhoneHref = `tel:${contact.phone.replace(/[^\d+]/g, '')}`;
  const sanitizedEmailHref = `mailto:${encodeURIComponent(contact.email)}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="contact-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#0B0C0E]/85 backdrop-blur-lg"
    >
      <div
        ref={panelRef}
        className="relative w-full max-w-3xl bg-[#141619] border border-white/15 shadow-2xl overflow-hidden max-h-[92vh] overflow-y-auto arch-scroll"
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
          <div>
            <div className="text-[11px] tracking-[0.2em] uppercase text-[#C8A96E]">
              Private Appointment
            </div>
            <h2 id="contact-modal-title" className="font-display text-2xl sm:text-3xl text-[#F4F0EA]">
              Book a Private Viewing
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close viewing enquiry modal"
            className="w-10 h-10 flex items-center justify-center border border-white/15 hover:border-[#C8A96E] text-[#A6A095] hover:text-[#F4F0EA] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5">
          {/* Left Info Column: Gallery Concierge Details */}
          <div className="md:col-span-2 bg-[#0B0C0E]/60 p-6 border-b md:border-b-0 md:border-r border-white/10 flex flex-col justify-between gap-6">
            <div className="space-y-4">
              <p className="text-xs text-[#A6A095] leading-relaxed">
                Arrange a private architectural consultation or request floor-by-floor availability
                schedules from our private sales desk.
              </p>

              <div className="space-y-3.5 pt-2">
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-[#C8A96E] shrink-0 mt-0.5" />
                  <div>
                    <div className="text-[10px] tracking-[0.14em] uppercase text-[#A6A095]">
                      Gallery Location
                    </div>
                    <div className="text-xs text-[#F4F0EA] mt-0.5">{contact.salesGalleryAddress}</div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Phone className="w-4 h-4 text-[#C8A96E] shrink-0 mt-0.5" />
                  <div>
                    <div className="text-[10px] tracking-[0.14em] uppercase text-[#A6A095]">
                      Telephone
                    </div>
                    <a
                      href={sanitizedPhoneHref}
                      className="font-mono text-xs text-[#F4F0EA] hover:text-[#DFC48F] transition-colors mt-0.5 inline-block"
                    >
                      {contact.phone}
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Mail className="w-4 h-4 text-[#C8A96E] shrink-0 mt-0.5" />
                  <div>
                    <div className="text-[10px] tracking-[0.14em] uppercase text-[#A6A095]">
                      Email Concierge
                    </div>
                    <a
                      href={sanitizedEmailHref}
                      className="text-xs text-[#F4F0EA] hover:text-[#DFC48F] transition-colors mt-0.5 break-all inline-block"
                    >
                      {contact.email}
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Clock className="w-4 h-4 text-[#C8A96E] shrink-0 mt-0.5" />
                  <div>
                    <div className="text-[10px] tracking-[0.14em] uppercase text-[#A6A095]">
                      Viewing Hours
                    </div>
                    <div className="text-xs text-[#F4F0EA] mt-0.5">{contact.hours}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-[10px] tracking-[0.12em] uppercase text-[#C8A96E]/85 border-t border-white/10 pt-3">
              Architectural Scale Model &amp; Material Library On Site
            </div>
          </div>

          {/* Right Enquiry Form */}
          <div className="md:col-span-3 p-6">
            {confirmationRef ? (
              <div className="h-full flex flex-col items-start justify-center py-8">
                <CheckCircle2 className="w-8 h-8 text-[#C8A96E] mb-3" />
                <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-[#C8A96E] mb-1">
                  Reference · {confirmationRef}
                </div>
                <h3 className="font-display text-2xl text-[#F4F0EA] mb-2">
                  Enquiry Registered
                </h3>
                <p className="text-xs text-[#A6A095] leading-relaxed mb-6">
                  Thank you, <span className="text-[#F4F0EA]">{name}</span>. Your private viewing
                  request for <span className="text-[#C8A96E]">{preferredLevel}</span>
                  {unitInterest ? ` (${unitInterest})` : ''} has been logged with our concierge desk
                  for <span className="text-[#F4F0EA]">{email}</span>.
                </p>
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-5 py-2.5 text-xs font-medium tracking-[0.16em] uppercase bg-[#C8A96E] text-[#0B0C0E] hover:bg-[#DFC48F] transition-colors cursor-pointer"
                >
                  Return to Tower
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                {error && (
                  <div className="px-3.5 py-2.5 text-xs text-rose-200 bg-rose-950/50 border border-rose-500/40">
                    {error}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="enquiry-name"
                      className="block text-[11px] tracking-[0.14em] uppercase text-[#A6A095] mb-1.5"
                    >
                      Full Name *
                    </label>
                    <input
                      id="enquiry-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                      maxLength={120}
                      className="w-full px-3.5 py-2.5 text-xs bg-[#0B0C0E] border border-white/15 focus:border-[#C8A96E] text-[#F4F0EA] outline-none transition-colors"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="enquiry-email"
                      className="block text-[11px] tracking-[0.14em] uppercase text-[#A6A095] mb-1.5"
                    >
                      Email Address *
                    </label>
                    <input
                      id="enquiry-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      maxLength={160}
                      className="w-full px-3.5 py-2.5 text-xs bg-[#0B0C0E] border border-white/15 focus:border-[#C8A96E] text-[#F4F0EA] outline-none transition-colors"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="enquiry-phone"
                      className="block text-[11px] tracking-[0.14em] uppercase text-[#A6A095] mb-1.5"
                    >
                      Telephone (Optional)
                    </label>
                    <input
                      id="enquiry-phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+44 20 0000 0000"
                      maxLength={40}
                      className="w-full px-3.5 py-2.5 text-xs bg-[#0B0C0E] border border-white/15 focus:border-[#C8A96E] text-[#F4F0EA] outline-none transition-colors"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="enquiry-level"
                      className="block text-[11px] tracking-[0.14em] uppercase text-[#A6A095] mb-1.5"
                    >
                      Level of Interest
                    </label>
                    <select
                      id="enquiry-level"
                      value={preferredLevel}
                      onChange={(e) => setPreferredLevel(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs bg-[#0B0C0E] border border-white/15 focus:border-[#C8A96E] text-[#F4F0EA] outline-none transition-colors"
                    >
                      {floors.map((f) => (
                        <option key={f.id} value={f.levelLabel}>
                          {f.levelLabel} — {f.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {unitInterest && (
                  <div className="flex items-center justify-between gap-2 px-3.5 py-2 bg-[#0B0C0E]/70 border border-[#C8A96E]/40 text-xs">
                    <div>
                      <span className="text-[10px] tracking-[0.14em] uppercase text-[#C8A96E] mr-2">
                        Selected Suite
                      </span>
                      <span className="text-[#F4F0EA]">{unitInterest}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setUnitInterest('')}
                      aria-label="Clear selected suite"
                      className="text-[#A6A095] hover:text-[#F4F0EA] cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <div>
                  <label
                    htmlFor="enquiry-message"
                    className="block text-[11px] tracking-[0.14em] uppercase text-[#A6A095] mb-1.5"
                  >
                    Private Notes
                  </label>
                  <textarea
                    id="enquiry-message"
                    rows={3}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    maxLength={2000}
                    placeholder="Preferred viewing schedule, residential wing, or commercial suite enquiry..."
                    className="w-full px-3.5 py-2.5 text-xs bg-[#0B0C0E] border border-white/15 focus:border-[#C8A96E] text-[#F4F0EA] outline-none transition-colors resize-none"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={submitting}
                    className="px-4 py-2.5 text-xs tracking-[0.14em] uppercase text-[#A6A095] hover:text-[#F4F0EA] transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-2.5 text-xs font-medium tracking-[0.16em] uppercase bg-[#C8A96E] text-[#0B0C0E] hover:bg-[#DFC48F] transition-colors cursor-pointer disabled:opacity-60"
                  >
                    {submitting ? 'Submitting...' : 'Request Viewing'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
