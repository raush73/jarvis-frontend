'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async (e: any) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.accessToken) {
        const msg =
          data?.message ||
          (res.status === 401 ? 'Invalid credentials' : 'Sign in failed');
        throw new Error(msg);
      }

      localStorage.setItem('jp_accessToken', data.accessToken);
      router.push('/orders');
    } catch (err: any) {
      setError(err?.message || 'Sign in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-icon">JP</div>
          <h1>Sign in to Jarvis Prime</h1>
          <p>Enter your credentials to continue</p>
        </div>

        <form onSubmit={handleSignIn} className="login-form">
          <div className="form-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              autoComplete="email"
            />
          </div>

          <div className="form-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="************"
              autoComplete="current-password"
            />
          </div>

          {error ? <div className="login-error">{error}</div> : null}

          <button type="submit" className="sign-in-btn" disabled={loading}>
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <div className="login-footer">
          <span>Demo mode - any credentials accepted</span>
        </div>
      </div>

      <style jsx>{`
        .login-container {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: calc(100vh - 96px);
          padding: 40px 20px;
        }

        .login-card {
          width: 100%;
          max-width: 400px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          padding: 40px;
        }

        .login-header {
          text-align: center;
          margin-bottom: 32px;
        }

        .login-icon {
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

        .login-header h1 {
          font-size: 22px;
          font-weight: 600;
          color: #fff;
          margin: 0 0 8px;
          letter-spacing: -0.3px;
        }

        .login-header p {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.5);
          margin: 0;
        }

        .login-form {
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

        .login-error {
          background: rgba(239, 68, 68, 0.12);
          border: 1px solid rgba(239, 68, 68, 0.25);
          color: rgba(255, 255, 255, 0.9);
          padding: 10px 12px;
          border-radius: 8px;
          font-size: 13px;
        }

        .sign-in-btn {
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

        .sign-in-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 20px rgba(59, 130, 246, 0.4);
        }

        .sign-in-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }

        .login-footer {
          margin-top: 24px;
          padding-top: 20px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          text-align: center;
        }

        .login-footer span {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.35);
        }
      `}</style>
    </div>
  );
}