'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.message || 'Request failed');
      }

      setSubmitted(true);
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fp-container">
      <div className="fp-card">
        <div className="fp-header">
          <div className="fp-icon">JP</div>
          <h1>Reset Your Password</h1>
          <p>Enter your email address and we&rsquo;ll send you a link to reset your password.</p>
        </div>

        {submitted ? (
          <div className="fp-success">
            <div className="fp-success-icon">&#10003;</div>
            <p className="fp-success-text">
              If that account exists, a password reset link has been sent.
            </p>
            <p className="fp-success-hint">Check your email inbox and follow the link to reset your password.</p>
            <Link href="/login" className="fp-back-link">Back to Sign In</Link>
          </div>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="fp-form">
              <div className="form-field">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  autoComplete="email"
                  autoFocus
                  required
                />
              </div>

              {error ? <div className="fp-error">{error}</div> : null}

              <button type="submit" className="fp-submit-btn" disabled={loading || !email.trim()}>
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>

            <div className="fp-footer">
              <Link href="/login" className="fp-back-link">Back to Sign In</Link>
            </div>
          </>
        )}
      </div>

      <style jsx>{`
        .fp-container {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: calc(100vh - 96px);
          padding: 40px 20px;
        }

        .fp-card {
          width: 100%;
          max-width: 400px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          padding: 40px;
        }

        .fp-header {
          text-align: center;
          margin-bottom: 32px;
        }

        .fp-icon {
          width: 56px;
          height: 56px;
          background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 18px;
          color: #fff;
          margin: 0 auto 20px;
        }

        .fp-header h1 {
          font-size: 22px;
          font-weight: 600;
          color: #fff;
          margin: 0 0 8px;
          letter-spacing: -0.3px;
        }

        .fp-header p {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.5);
          margin: 0;
          line-height: 1.5;
        }

        .fp-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .form-field {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .form-field label {
          font-size: 13px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.7);
        }

        .form-field input {
          height: 44px;
          padding: 0 14px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          font-size: 14px;
          color: #fff;
          transition: all 0.15s ease;
        }

        .form-field input::placeholder {
          color: rgba(255, 255, 255, 0.3);
        }

        .form-field input:focus {
          outline: none;
          border-color: #3b82f6;
          background: rgba(59, 130, 246, 0.08);
        }

        .fp-error {
          background: rgba(239, 68, 68, 0.12);
          border: 1px solid rgba(239, 68, 68, 0.25);
          color: rgba(255, 255, 255, 0.9);
          padding: 10px 12px;
          border-radius: 8px;
          font-size: 13px;
        }

        .fp-submit-btn {
          height: 46px;
          margin-top: 8px;
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          border: none;
          border-radius: 8px;
          font-size: 15px;
          font-weight: 600;
          color: #fff;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .fp-submit-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 20px rgba(59, 130, 246, 0.4);
        }

        .fp-submit-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }

        .fp-footer {
          margin-top: 24px;
          padding-top: 20px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          text-align: center;
        }

        .fp-back-link {
          font-size: 13px;
          color: #3b82f6;
          text-decoration: none;
          transition: color 0.15s ease;
        }

        .fp-back-link:hover {
          color: #60a5fa;
        }

        .fp-success {
          text-align: center;
          padding: 12px 0;
        }

        .fp-success-icon {
          width: 48px;
          height: 48px;
          background: rgba(34, 197, 94, 0.12);
          border: 1px solid rgba(34, 197, 94, 0.25);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          color: #22c55e;
          margin: 0 auto 20px;
        }

        .fp-success-text {
          font-size: 15px;
          color: #fff;
          font-weight: 500;
          margin: 0 0 8px;
        }

        .fp-success-hint {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.5);
          margin: 0 0 24px;
          line-height: 1.5;
        }
      `}</style>
    </div>
  );
}
