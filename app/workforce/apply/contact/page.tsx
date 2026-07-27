"use client";

import { useCallback } from "react";
import WorkforceWizardShell from "@/components/workforce/WorkforceWizardShell";
import { useLoadIdentity } from "@/components/workforce/IdentityDraftContext";
import { US_STATES } from "@/lib/careers/usStates";

/**
 * Contact Information screen.
 *
 * Completing this screen performs the SINGLE atomic Identity-stage save carrying both
 * the previous screen's identity values and everything entered here. The backend
 * validates the whole payload and its messages are surfaced verbatim.
 *
 * `US_STATES` is the existing shared USPS abbreviation list - static presentation
 * reference data, reused rather than duplicated so there is one source for it.
 */
export default function ContactPage() {
  const { draft, setField, serverView, loading, save } = useLoadIdentity();

  const onSave = useCallback(async () => {
    await save();
  }, [save]);

  return (
    <WorkforceWizardShell
      slug="contact"
      loading={loading}
      onSave={onSave}
      intro="We use this information to contact you about your application and job opportunities."
    >
      {serverView?.ssnProvided && !draft.ssn.trim() ? (
        <div className="wf-notice">
          Your Social Security number is already on file as {serverView.ssnMasked}.
          Saving this screen requires re-entering it on the Identity screen, because
          your identity information is stored together and we never display your full
          number back to you.
        </div>
      ) : null}

      <div className="wf-grid">
        <label className="wf-field">
          <span className="wf-label">
            Email address <span className="wf-req">*</span>
          </span>
          <input
            className="wf-input"
            type="email"
            value={draft.email}
            onChange={(e) => setField("email", e.target.value)}
            autoComplete="email"
          />
        </label>

        <label className="wf-field">
          <span className="wf-label">
            Phone number <span className="wf-req">*</span>
          </span>
          <input
            className="wf-input"
            type="tel"
            value={draft.phone}
            onChange={(e) => setField("phone", e.target.value)}
            placeholder="(555) 555-5555"
            autoComplete="tel"
          />
        </label>

        <label className="wf-field wf-field-wide">
          <span className="wf-label">
            Street address <span className="wf-req">*</span>
          </span>
          <input
            className="wf-input"
            value={draft.address1}
            onChange={(e) => setField("address1", e.target.value)}
            autoComplete="address-line1"
            maxLength={200}
          />
        </label>

        <label className="wf-field wf-field-wide">
          <span className="wf-label">Apartment, suite, or unit</span>
          <input
            className="wf-input"
            value={draft.address2}
            onChange={(e) => setField("address2", e.target.value)}
            autoComplete="address-line2"
            maxLength={200}
          />
        </label>

        <label className="wf-field">
          <span className="wf-label">
            City <span className="wf-req">*</span>
          </span>
          <input
            className="wf-input"
            value={draft.city}
            onChange={(e) => setField("city", e.target.value)}
            autoComplete="address-level2"
            maxLength={100}
          />
        </label>

        <label className="wf-field">
          <span className="wf-label">
            State <span className="wf-req">*</span>
          </span>
          <select
            className="wf-select"
            value={draft.state}
            onChange={(e) => setField("state", e.target.value)}
            autoComplete="address-level1"
          >
            <option value="">Select a state</option>
            {US_STATES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <label className="wf-field">
          <span className="wf-label">
            ZIP code <span className="wf-req">*</span>
          </span>
          <input
            className="wf-input"
            value={draft.zip}
            onChange={(e) => setField("zip", e.target.value)}
            placeholder="00000"
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={10}
          />
        </label>
      </div>
    </WorkforceWizardShell>
  );
}
