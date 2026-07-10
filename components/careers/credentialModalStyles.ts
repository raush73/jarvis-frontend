/**
 * Jarvis Careers V2.1.5C - shared dialog styles (Industrial Light V1) for the
 * Applicant Credentials editors (Education, Certification, Military Service,
 * Professional Membership). Each modal declares `<style jsx>{CREDENTIAL_MODAL_CSS}</style>`
 * so styled-jsx scopes the same rules to that component's own elements. This
 * mirrors the Work History modal's styling without duplicating the CSS text.
 */
export const CREDENTIAL_MODAL_CSS = `
  .pf-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.35);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    z-index: 1000;
  }
  .pf-modal {
    width: 100%;
    max-width: 620px;
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    box-shadow: 0 20px 48px rgba(0, 0, 0, 0.18);
    max-height: 90vh;
    display: flex;
    flex-direction: column;
  }
  .pf-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 22px;
    border-bottom: 1px solid #f1f5f9;
  }
  .pf-header h3 {
    font-size: 17px;
    font-weight: 700;
    color: #111827;
    margin: 0;
  }
  .pf-close {
    background: transparent;
    border: none;
    font-size: 22px;
    line-height: 1;
    color: #6b7280;
    cursor: pointer;
    padding: 0 4px;
  }
  .pf-close:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
  .pf-body {
    padding: 18px 22px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .pf-error {
    background: #fff1f2;
    border: 1px solid #fecaca;
    color: #991b1b;
    font-size: 12.5px;
    border-radius: 6px;
    padding: 8px 10px;
  }
  .pf-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
  }
  .pf-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .pf-label {
    font-size: 12px;
    font-weight: 600;
    color: #374151;
  }
  .pf-req {
    color: #dc2626;
  }
  .pf-hint {
    font-size: 11.5px;
    color: #9ca3af;
  }
  .pf-section {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding-top: 6px;
    margin-top: 2px;
    border-top: 1px solid #f1f5f9;
  }
  .pf-section-title {
    font-size: 12px;
    font-weight: 700;
    color: #111827;
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }
  .pf-input,
  .pf-textarea {
    font-size: 13px;
    color: #111827;
    background: #ffffff;
    border: 1px solid #d1d5db;
    border-radius: 7px;
    padding: 9px 11px;
    width: 100%;
    box-sizing: border-box;
    font-family: inherit;
  }
  .pf-textarea {
    resize: vertical;
  }
  .pf-input:focus,
  .pf-textarea:focus {
    outline: none;
    border-color: #2563eb;
    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
  }
  .pf-input:disabled {
    background: #f3f4f6;
    color: #9ca3af;
  }
  .pf-input::placeholder,
  .pf-textarea::placeholder {
    color: #9ca3af;
  }
  .pf-check {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: #374151;
  }
  .pf-check input {
    accent-color: #2563eb;
    width: 15px;
    height: 15px;
  }
  .pf-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    padding: 16px 22px;
    border-top: 1px solid #f1f5f9;
  }
  .pf-btn {
    font-size: 13px;
    font-weight: 700;
    border-radius: 7px;
    padding: 9px 16px;
    cursor: pointer;
    border: 1px solid transparent;
  }
  .pf-btn:disabled {
    cursor: not-allowed;
  }
  .pf-cancel {
    background: #ffffff;
    color: #374151;
    border-color: #e5e7eb;
    font-weight: 600;
  }
  .pf-cancel:hover:not(:disabled) {
    background: #f1f5f9;
    border-color: #d1d5db;
  }
  .pf-save {
    background: #2563eb;
    color: #ffffff;
  }
  .pf-save:hover:not(:disabled) {
    background: #1d4ed8;
  }
  .pf-save:disabled {
    background: #93c5fd;
  }
  @media (max-width: 560px) {
    .pf-grid {
      grid-template-columns: 1fr;
    }
  }
`;
