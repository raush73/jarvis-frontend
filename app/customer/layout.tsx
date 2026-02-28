'use client';

import { useRouter, usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

/**
 * Customer Portal Layout Shell - UI Only
 * 
 * A customer-specific layout wrapper distinct from internal app.
 * Provides clear visual context that user is in CUSTOMER PORTAL.
 * Contains customer-safe navigation surface (links only).
 * 
 * NO auth logic.
 * NO backend wiring.
 * NO RBAC implementation.
 */

export default function CustomerPortalLayout({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  // Navigation items - links to existing customer-safe routes
  const navItems = [
    { label: 'Dashboard', href: '/customer', icon: '[D]' },
    { label: 'Orders', href: '/customer/orders', icon: '[O]' },
  ];

  // Check if current path matches nav item
  const isActive = (href: string) => {
    if (href === '/customer') {
      return pathname === '/customer';
    }
    return pathname?.startsWith(href);
  };

  // Skip layout chrome for login page
  const isLoginPage = pathname === '/customer/login';
  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <div className="customer-portal-layout">
      {/* Portal Header */}
      <header className="portal-header">
        <div className="header-brand">
          <span className="brand-icon">[CP]</span>
          <div className="brand-text">
            <span className="brand-title">Customer Portal</span>
            <span className="brand-subtitle">MW4H Services</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="portal-nav">
          {navItems.map((item) => (
            <button
              key={item.href}
              type="button"
              className={`nav-item ${isActive(item.href) ? 'nav-item-active' : ''}`}
              onClick={() => router.push(item.href)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </nav>

        {/* User Placeholder (UI shell only) */}
        <div className="header-user">
          <span className="user-icon">[U]</span>
          <span className="user-label">Customer</span>
        </div>
      </header>

      {/* Portal Indicator Bar */}
      <div className="portal-indicator">
        <span className="indicator-dot" />
        <span className="indicator-text">Customer Portal (Read-Only)</span>
      </div>

      {/* Main Content */}
      <main className="portal-main">
        {children}
      </main>

      {/* Portal Footer */}
      <footer className="portal-footer">
        <span className="footer-text">(c) 2026 MW4H Services - Customer Portal</span>
        <span className="footer-divider">|</span>
        <span className="footer-note">For support, contact your account representative.</span>
      </footer>

      <style jsx>{`
        .customer-portal-layout {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background: linear-gradient(180deg, #0a0c10 0%, #0f1219 100%);
        }

        /* Portal Header */
        .portal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 32px;
          background: rgba(0, 0, 0, 0.4);
          border-bottom: 1px solid rgba(34, 197, 94, 0.15);
        }

        .header-brand {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .brand-icon {
          font-size: 28px;
        }

        .brand-text {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .brand-title {
          font-size: 18px;
          font-weight: 700;
          color: #86efac;
          letter-spacing: -0.3px;
        }

        .brand-subtitle {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.45);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        /* Navigation */
        .portal-nav {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 18px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .nav-item:hover {
          background: rgba(34, 197, 94, 0.08);
          border-color: rgba(34, 197, 94, 0.2);
        }

        .nav-item-active {
          background: rgba(34, 197, 94, 0.12);
          border-color: rgba(34, 197, 94, 0.3);
        }

        .nav-icon {
          font-size: 16px;
        }

        .nav-label {
          font-size: 13px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.8);
        }

        .nav-item-active .nav-label {
          color: #86efac;
        }

        /* User Placeholder */
        .header-user {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 16px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 8px;
        }

        .user-icon {
          font-size: 18px;
          opacity: 0.7;
        }

        .user-label {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.6);
        }

        /* Portal Indicator */
        .portal-indicator {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 8px 20px;
          background: linear-gradient(90deg, rgba(34, 197, 94, 0.08) 0%, rgba(59, 130, 246, 0.08) 100%);
          border-bottom: 1px solid rgba(34, 197, 94, 0.1);
        }

        .indicator-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #22c55e;
          box-shadow: 0 0 8px #22c55e;
          animation: pulse 2s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .indicator-text {
          font-size: 11px;
          font-weight: 600;
          color: #86efac;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        /* Main Content */
        .portal-main {
          flex: 1;
          padding: 0;
        }

        /* Portal Footer */
        .portal-footer {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 16px 32px;
          background: rgba(0, 0, 0, 0.3);
          border-top: 1px solid rgba(255, 255, 255, 0.05);
        }

        .footer-text {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.4);
        }

        .footer-divider {
          color: rgba(255, 255, 255, 0.2);
        }

        .footer-note {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.35);
        }

        /* Responsive */
        @media (max-width: 768px) {
          .portal-header {
            flex-direction: column;
            gap: 16px;
            padding: 16px 20px;
          }

          .portal-nav {
            width: 100%;
            justify-content: center;
          }

          .header-user {
            display: none;
          }

          .portal-footer {
            flex-direction: column;
            gap: 6px;
          }

          .footer-divider {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}

