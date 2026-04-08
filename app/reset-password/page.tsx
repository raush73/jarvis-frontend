'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordsMatch = newPassword === confirmPassword;
  const passwordLongEnough = newPassword.length >= 8;
  const canSubmit = token && passwordLongEnough && passwordsMatch && !loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || data?.message || 'Password reset failed');
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="rp-container">
        <div className="rp-card">
          <div className="rp-header">
            <div className="rp-icon">JP</div>
            <h1>Invalid Reset Link</h1>
            <p>This password reset link is invalid or missing. Please request a new one.</p>
          </div>
          <div className="rp-actions">
            <Link href="/forgot-password" className="rp-link-btn">Request New Reset Link</Link>
            <Link href="/login" className="rp-back-link">Back to Sign In</Link>
          </div>
        </div>
        <Styles />
      </div>
    );
  }

  if (success) {
    return (
      <div className="rp-container">
        <div className="rp-card">
          <div className="rp-header">
            <div className="rp-icon">JP</div>
            <h1>Password Reset Complete</h1>
          </div>
          <div className="rp-success">
            <div className="rp-success-icon">&#10003;</div>
            <p className="rp-success-text">Your password has been updated successfully.</p>
            <Link href="/login" className="rp-link-btn">Sign In with New Password</Link>
          </div>
        </div>
        <Styles />
      </div>
    );
  }

  return (
    <div className="rp-container">
      <div className="rp-card">
        <div className="rp-header">
          <div className="rp-icon">JP</div>
          <h1>Set New Password</h1>
          <p>Enter your new password below.</p>
        </div>

        <form onSubmit={handleSubmit} className="rp-form">
          <div className="form-field">
            <label htmlFor="newPassword">New Password</label>
            <input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              autoComplete="new-password"
              autoFocus
            />
            {newPassword.length > 0 && !passwordLongEnough && (
              <div className="field-hint error-hint">Password must be at least 8 characters</div>
            )}
          </div>

          <div className="form-field">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your new password"
              autoComplete="new-password"
            />
            {confirmPassword.length > 0 && !passwordsMatch && (
              <div className="field-hint error-hint">Passwords do not match</div>
            )}
          </div>

          {error ? (
            <div className="rp-error">
              <span>{error}</span>
              {(error.includes('expired') || error.includes('already been used')) && (
                <Link href="/forgot-password" className="rp-error-link">Request a new reset link</Link>
              )}
            </div>
          ) : null}

          <button type="submit" className="rp-submit-btn" disabled={!canSubmit}>
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>

        <div className="rp-footer">
          <Link href="/login" className="rp-back-link">Back to Sign In</Link>
        </div>
      </div>
      <Styles />
    </div>
  );
}

function Styles() {
  return (
    <style jsx global>{`
      .rp-container {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: calc(100vh - 96px);
        padding: 40px 20px;
      }

      .rp-card {
        width: 100%;
        max-width: 400px;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 16px;
        padding: 40px;
      }

      .rp-header {
        text-align: center;
        margin-bottom: 32px;
      }

      .rp-icon {
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

      .rp-header h1 {
        font-size: 22px;
        font-weight: 600;
        color: #fff;
        margin: 0 0 8px;
        letter-spacing: -0.3px;
      }

      .rp-header p {
        font-size: 14px;
        color: rgba(255, 255, 255, 0.5);
        margin: 0;
        line-height: 1.5;
      }

      .rp-form {
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

      .field-hint {
        font-size: 11px;
        color: rgba(255, 255, 255, 0.35);
        margin-top: 4px;
      }

      .error-hint {
        color: #ef4444;
      }

      .rp-error {
        background: rgba(239, 68, 68, 0.12);
        border: 1px solid rgba(239, 68, 68, 0.25);
        color: rgba(255, 255, 255, 0.9);
        padding: 10px 12px;
        border-radius: 8px;
        font-size: 13px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .rp-error-link {
        font-size: 12px;
        color: #3b82f6;
        text-decoration: none;
      }

      .rp-error-link:hover {
        color: #60a5fa;
      }

      .rp-submit-btn {
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

      .rp-submit-btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 20px rgba(59, 130, 246, 0.4);
      }

      .rp-submit-btn:disabled {
        opacity: 0.7;
        cursor: not-allowed;
        transform: none;
        box-shadow: none;
      }

      .rp-footer {
        margin-top: 24px;
        padding-top: 20px;
        border-top: 1px solid rgba(255, 255, 255, 0.06);
        text-align: center;
      }

      .rp-back-link {
        font-size: 13px;
        color: #3b82f6;
        text-decoration: none;
        transition: color 0.15s ease;
      }

      .rp-back-link:hover {
        color: #60a5fa;
      }

      .rp-success {
        text-align: center;
        padding: 12px 0;
      }

      .rp-success-icon {
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

      .rp-success-text {
        font-size: 15px;
        color: #fff;
        font-weight: 500;
        margin: 0 0 24px;
      }

      .rp-link-btn {
        display: inline-block;
        padding: 12px 24px;
        background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        color: #fff;
        text-decoration: none;
        transition: all 0.15s ease;
      }

      .rp-link-btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 20px rgba(59, 130, 246, 0.4);
      }

      .rp-actions {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 16px;
        padding: 12px 0;
      }
    `}</style>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="rp-container">
        <div className="rp-card" style={{ textAlign: 'center', padding: 60 }}>
          <p style={{ color: 'rgba(255,255,255,0.5)' }}>Loading...</p>
        </div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
