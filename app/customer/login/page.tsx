'use client';

/**
 * Customer Login Screen - UI Shell Only
 * 
 * Visual-only login page for customers.
 * Inputs/buttons are present but INERT.
 * NO auth wiring of any kind.
 * NO magic-link behavior.
 * NO form submission.
 * 
 * Route: /customer/login
 */

export default function CustomerLoginPage() {
  return (
    <div className="customer-login-page">
      {/* Background Pattern */}
      <div className="bg-pattern" aria-hidden="true" />

      {/* Login Container */}
      <div className="login-container">
        {/* Demo Warning Banner */}
        <div className="demo-banner">
          <span className="demo-icon">!</span>
          <span className="demo-text">UI Shell Only - No Auth Wiring</span>
        </div>

        {/* Brand Header */}
        <div className="brand-header">
          <span className="brand-icon">[CP]</span>
          <h1 className="brand-title">Customer Portal</h1>
          <span className="brand-subtitle">MW4H Services</span>
        </div>

        {/* Login Form Shell (INERT) */}
        <form
          className="login-form"
          onSubmit={(e) => {
            e.preventDefault();
            // NO ACTION - UI shell only
          }}
        >
          <div className="form-group">
            <label className="form-label" htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              className="form-input"
              placeholder="you@company.com"
              disabled
              aria-label="Email input (disabled - UI shell)"
            />
          </div>

          <button
            type="submit"
            className="login-btn"
            disabled
            aria-label="Sign in button (disabled - UI shell)"
          >
            Sign In
          </button>

          <p className="form-hint">
            Authentication will be enabled in a future build.
          </p>
        </form>

        {/* Divider */}
        <div className="divider">
          <span className="divider-line" />
          <span className="divider-text">or</span>
          <span className="divider-line" />
        </div>

        {/* Magic Link Section (INERT) */}
        <div className="magic-link-section">
          <p className="magic-link-label">Request a secure login link</p>
          <button
            type="button"
            className="magic-link-btn"
            disabled
            aria-label="Magic link button (disabled - UI shell)"
          >
            Send Login Link
          </button>
          <p className="magic-link-hint">
            Magic link functionality will be enabled in a future build.
          </p>
        </div>

        {/* Footer Info */}
        <div className="login-footer">
          <p className="footer-text">
            This portal provides read-only access to your order information.
          </p>
          <p className="footer-contact">
            For access requests, contact your account representative.
          </p>
        </div>
      </div>

      {/* Brand Footer */}
      <div className="page-footer">
        <span className="footer-brand">(c) 2026 MW4H Services</span>
      </div>

      <style jsx>{`
        .customer-login-page {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          background: linear-gradient(180deg, #0a0c10 0%, #0f1219 100%);
          font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
          color: #fff;
          position: relative;
          overflow: hidden;
        }

        /* Background Pattern */
        .bg-pattern {
          position: absolute;
          inset: 0;
          background: 
            radial-gradient(circle at 20% 30%, rgba(34, 197, 94, 0.08) 0%, transparent 50%),
            radial-gradient(circle at 80% 70%, rgba(59, 130, 246, 0.08) 0%, transparent 50%);
          pointer-events: none;
        }

        /* Login Container */
        .login-container {
          width: 100%;
          max-width: 420px;
          padding: 40px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 20px;
          backdrop-filter: blur(10px);
          position: relative;
          z-index: 1;
        }

        /* Demo Banner */
        .demo-banner {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 8px 16px;
          background: rgba(245, 158, 11, 0.1);
          border: 1px solid rgba(245, 158, 11, 0.2);
          border-radius: 8px;
          margin-bottom: 32px;
        }

        .demo-icon {
          font-size: 12px;
        }

        .demo-text {
          font-size: 11px;
          font-weight: 600;
          color: #fbbf24;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        /* Brand Header */
        .brand-header {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          margin-bottom: 36px;
        }

        .brand-icon {
          font-size: 48px;
          margin-bottom: 8px;
        }

        .brand-title {
          margin: 0;
          font-size: 28px;
          font-weight: 700;
          background: linear-gradient(135deg, #fff 0%, #86efac 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          letter-spacing: -0.3px;
        }

        .brand-subtitle {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.45);
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        /* Login Form */
        .login-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .form-label {
          font-size: 13px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.7);
        }

        .form-input {
          padding: 14px 18px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          font-size: 15px;
          color: rgba(255, 255, 255, 0.4);
          outline: none;
          transition: all 0.15s ease;
        }

        .form-input:disabled {
          cursor: not-allowed;
          opacity: 0.6;
        }

        .form-input::placeholder {
          color: rgba(255, 255, 255, 0.25);
        }

        .login-btn {
          padding: 16px 24px;
          background: linear-gradient(135deg, rgba(34, 197, 94, 0.2) 0%, rgba(59, 130, 246, 0.2) 100%);
          border: 1px solid rgba(34, 197, 94, 0.3);
          border-radius: 10px;
          font-size: 15px;
          font-weight: 600;
          color: #86efac;
          cursor: not-allowed;
          opacity: 0.6;
          transition: all 0.15s ease;
        }

        .form-hint {
          margin: 0;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.35);
          text-align: center;
          font-style: italic;
        }

        /* Divider */
        .divider {
          display: flex;
          align-items: center;
          gap: 16px;
          margin: 28px 0;
        }

        .divider-line {
          flex: 1;
          height: 1px;
          background: rgba(255, 255, 255, 0.08);
        }

        .divider-text {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.3);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        /* Magic Link Section */
        .magic-link-section {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }

        .magic-link-label {
          margin: 0;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.5);
        }

        .magic-link-btn {
          width: 100%;
          padding: 14px 24px;
          background: rgba(139, 92, 246, 0.1);
          border: 1px solid rgba(139, 92, 246, 0.2);
          border-radius: 10px;
          font-size: 14px;
          font-weight: 500;
          color: #a78bfa;
          cursor: not-allowed;
          opacity: 0.6;
          transition: all 0.15s ease;
        }

        .magic-link-hint {
          margin: 0;
          font-size: 11px;
          color: rgba(255, 255, 255, 0.3);
          text-align: center;
          font-style: italic;
        }

        /* Footer Info */
        .login-footer {
          margin-top: 32px;
          padding-top: 24px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          text-align: center;
        }

        .footer-text {
          margin: 0 0 8px 0;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.4);
        }

        .footer-contact {
          margin: 0;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.3);
        }

        /* Page Footer */
        .page-footer {
          margin-top: 32px;
          position: relative;
          z-index: 1;
        }

        .footer-brand {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.25);
        }

        /* Responsive */
        @media (max-width: 480px) {
          .login-container {
            padding: 28px 24px;
          }

          .brand-icon {
            font-size: 40px;
          }

          .brand-title {
            font-size: 24px;
          }
        }
      `}</style>
    </div>
  );
}

