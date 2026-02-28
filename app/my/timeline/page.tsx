'use client';

import { useState } from 'react';

/**
 * Worker Timeline Page — UI Shell / Demo Only
 * 
 * Displays a "Domino's-style" timeline showing the worker's journey through
 * the job assignment process. This is a MOCK/DEMO page with no backend integration.
 * 
 * Route: /my/timeline
 */

// ============================================================================
// TYPES
// ============================================================================

type StepKey =
  | 'opted_in'
  | 'awaiting_candidate_action'
  | 'mw4h_approved'
  | 'customer_approval_pending'
  | 'pre_dispatch'
  | 'dispatched'
  | 'exception_no_show';

type StepStatus = 'completed' | 'current' | 'upcoming' | 'skipped';

interface TimelineStep {
  key: StepKey;
  label: string;
  shortDescription: string;
  whatsNext: string;
  isGate?: boolean; // Customer gate step
  isCandidateAction?: boolean; // Candidate-blocked step
}

interface CandidateAction {
  id: string;
  label: string;
  completed: boolean;
}

interface MockScenario {
  id: string;
  name: string;
  description: string;
  currentStep: StepKey;
  hasCustomerGate: boolean;
  candidateActions?: CandidateAction[];
  jobInfo: {
    jobName: string;
    site: string;
    startDate: string;
  };
}

// ============================================================================
// STEP DEFINITIONS (LOCKED)
// ============================================================================

const TIMELINE_STEPS: TimelineStep[] = [
  {
    key: 'opted_in',
    label: 'Opted-In (This Job)',
    shortDescription: 'You have expressed interest in this job opportunity.',
    whatsNext: 'MW4H will review your profile and qualifications.',
  },
  {
    key: 'awaiting_candidate_action',
    label: 'Awaiting Candidate Action',
    shortDescription: 'We need some information or action from you to proceed.',
    whatsNext: 'Complete the required actions below to move forward.',
    isCandidateAction: true,
  },
  {
    key: 'mw4h_approved',
    label: 'MW4H Approved (Candidate Pool)',
    shortDescription: 'You have been approved and added to the candidate pool.',
    whatsNext: 'Your profile will be submitted to the customer for final approval.',
  },
  {
    key: 'customer_approval_pending',
    label: 'Customer Approval Pending',
    shortDescription: 'The customer is reviewing your profile for final approval.',
    whatsNext: 'Once approved, you will move to pre-dispatch preparation.',
    isGate: true,
  },
  {
    key: 'pre_dispatch',
    label: 'Pre-Dispatch',
    shortDescription: 'You are confirmed for this job. Final preparations are underway.',
    whatsNext: 'You will receive your dispatch packet with job details.',
  },
  {
    key: 'dispatched',
    label: 'Dispatched',
    shortDescription: 'You have been dispatched to the job site.',
    whatsNext: 'Report to the job site as instructed in your dispatch packet.',
  },
  {
    key: 'exception_no_show',
    label: 'Exception (No-Show)',
    shortDescription: 'There was an issue with your assignment.',
    whatsNext: 'Contact MW4H immediately to resolve this issue.',
  },
];

// ============================================================================
// MOCK SCENARIOS
// ============================================================================

const MOCK_SCENARIOS: MockScenario[] = [
  {
    id: 'normal',
    name: 'Normal Flow',
    description: 'Standard progression through the job journey',
    currentStep: 'pre_dispatch',
    hasCustomerGate: false,
    jobInfo: {
      jobName: 'Refinery Turnaround Q1',
      site: 'Marathon Petroleum — Galveston Bay, TX',
      startDate: '2026-02-15',
    },
  },
  {
    id: 'candidate_blocked',
    name: 'Candidate Action Needed',
    description: 'Waiting on candidate to complete required actions',
    currentStep: 'awaiting_candidate_action',
    hasCustomerGate: false,
    candidateActions: [
      { id: 'cert', label: 'Upload safety certification', completed: false },
      { id: 'date', label: 'Confirm start date availability', completed: true },
      { id: 'docs', label: 'Submit required documentation', completed: false },
    ],
    jobInfo: {
      jobName: 'Power Plant Maintenance',
      site: 'NRG Energy — Houston, TX',
      startDate: '2026-03-05',
    },
  },
  {
    id: 'customer_gated',
    name: 'Customer Gate',
    description: 'Awaiting customer approval to proceed',
    currentStep: 'customer_approval_pending',
    hasCustomerGate: true,
    jobInfo: {
      jobName: 'Chemical Plant Expansion',
      site: 'BASF Corporation — Freeport, TX',
      startDate: '2026-03-20',
    },
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function getStepStatus(
  stepKey: StepKey,
  currentStep: StepKey,
  hasCustomerGate: boolean
): StepStatus {
  const steps = TIMELINE_STEPS.filter(
    (s) => !s.isGate || hasCustomerGate
  );
  const stepIndex = steps.findIndex((s) => s.key === stepKey);
  const currentIndex = steps.findIndex((s) => s.key === currentStep);

  // Exception is always at the end and only shown if current
  if (stepKey === 'exception_no_show') {
    return currentStep === 'exception_no_show' ? 'current' : 'skipped';
  }

  if (stepIndex < currentIndex) return 'completed';
  if (stepIndex === currentIndex) return 'current';
  return 'upcoming';
}

function getStatusLabel(currentStep: StepKey): string {
  const step = TIMELINE_STEPS.find((s) => s.key === currentStep);
  return step?.label || 'Unknown';
}

// ============================================================================
// COMPONENTS
// ============================================================================

function ScenarioSelector({
  scenarios,
  selectedId,
  onSelect,
}: {
  scenarios: MockScenario[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="scenario-selector">
      <div className="selector-label">Demo Scenario:</div>
      <div className="selector-buttons">
        {scenarios.map((scenario) => (
          <button
            key={scenario.id}
            className={`scenario-btn ${selectedId === scenario.id ? 'active' : ''}`}
            onClick={() => onSelect(scenario.id)}
          >
            <span className="scenario-name">{scenario.name}</span>
            <span className="scenario-desc">{scenario.description}</span>
          </button>
        ))}
      </div>

      <style jsx>{`
        .scenario-selector {
          margin-bottom: 32px;
        }

        .selector-label {
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: rgba(255, 255, 255, 0.5);
          margin-bottom: 12px;
        }

        .selector-buttons {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        .scenario-btn {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 4px;
          padding: 14px 20px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: left;
          min-width: 200px;
        }

        .scenario-btn:hover {
          background: rgba(59, 130, 246, 0.08);
          border-color: rgba(59, 130, 246, 0.25);
        }

        .scenario-btn.active {
          background: rgba(59, 130, 246, 0.15);
          border-color: rgba(59, 130, 246, 0.4);
        }

        .scenario-name {
          font-size: 14px;
          font-weight: 600;
          color: #fff;
        }

        .scenario-btn.active .scenario-name {
          color: #60a5fa;
        }

        .scenario-desc {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.45);
        }
      `}</style>
    </div>
  );
}

function JobInfoHeader({ jobInfo, currentStatus }: { jobInfo: MockScenario['jobInfo']; currentStatus: string }) {
  return (
    <div className="job-info-header">
      <div className="job-main">
        <h2 className="job-name">{jobInfo.jobName}</h2>
        <div className="job-details">
          <div className="detail-item">
            <span className="detail-icon">📍</span>
            <span className="detail-value">{jobInfo.site}</span>
          </div>
          <div className="detail-item">
            <span className="detail-icon">📅</span>
            <span className="detail-value">Start: {formatDate(jobInfo.startDate)}</span>
          </div>
        </div>
      </div>
      <div className="status-badge">
        <span className="status-label">Current Status</span>
        <span className="status-value">{currentStatus}</span>
      </div>

      <style jsx>{`
        .job-info-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 24px;
          background: rgba(255, 255, 255, 0.025);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          margin-bottom: 32px;
        }

        .job-main {
          flex: 1;
        }

        .job-name {
          margin: 0 0 12px 0;
          font-size: 22px;
          font-weight: 700;
          color: #fff;
          letter-spacing: -0.3px;
        }

        .job-details {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .detail-item {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .detail-icon {
          font-size: 14px;
          opacity: 0.8;
        }

        .detail-value {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.6);
        }

        .status-badge {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 6px;
          padding: 16px 20px;
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.2);
          border-radius: 10px;
        }

        .status-label {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: rgba(255, 255, 255, 0.45);
        }

        .status-value {
          font-size: 14px;
          font-weight: 600;
          color: #60a5fa;
        }
      `}</style>
    </div>
  );
}

function TimelineStepItem({
  step,
  status,
  isLast,
}: {
  step: TimelineStep;
  status: StepStatus;
  isLast: boolean;
}) {
  const getStepIcon = () => {
    if (status === 'completed') return '✓';
    if (status === 'current') return '●';
    if (status === 'skipped') return '—';
    return '○';
  };

  const getGateLabel = () => {
    if (step.isGate) return 'CUSTOMER GATE';
    if (step.isCandidateAction) return 'YOUR ACTION';
    return null;
  };

  const gateLabel = getGateLabel();

  return (
    <div className={`timeline-step status-${status}`}>
      <div className="step-indicator">
        <div className="step-icon">{getStepIcon()}</div>
        {!isLast && <div className="step-line" />}
      </div>
      <div className="step-content">
        <div className="step-header">
          <span className="step-label">{step.label}</span>
          {gateLabel && <span className={`gate-badge ${step.isGate ? 'customer' : 'candidate'}`}>{gateLabel}</span>}
        </div>
        {status === 'current' && (
          <div className="step-details">
            <p className="step-description">{step.shortDescription}</p>
            <div className="whats-next">
              <span className="whats-next-label">What happens next:</span>
              <span className="whats-next-value">{step.whatsNext}</span>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .timeline-step {
          display: flex;
          gap: 20px;
          padding-bottom: 24px;
        }

        .timeline-step:last-child {
          padding-bottom: 0;
        }

        .step-indicator {
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 32px;
          flex-shrink: 0;
        }

        .step-icon {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: 700;
          transition: all 0.2s ease;
        }

        .status-completed .step-icon {
          background: rgba(34, 197, 94, 0.2);
          border: 2px solid #22c55e;
          color: #4ade80;
        }

        .status-current .step-icon {
          background: rgba(59, 130, 246, 0.2);
          border: 2px solid #3b82f6;
          color: #60a5fa;
          box-shadow: 0 0 12px rgba(59, 130, 246, 0.4);
        }

        .status-upcoming .step-icon {
          background: rgba(255, 255, 255, 0.03);
          border: 2px solid rgba(255, 255, 255, 0.15);
          color: rgba(255, 255, 255, 0.35);
        }

        .status-skipped .step-icon {
          background: rgba(255, 255, 255, 0.02);
          border: 2px dashed rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.2);
        }

        .step-line {
          flex: 1;
          width: 2px;
          margin-top: 8px;
          min-height: 24px;
        }

        .status-completed .step-line {
          background: linear-gradient(180deg, #22c55e 0%, rgba(34, 197, 94, 0.3) 100%);
        }

        .status-current .step-line {
          background: linear-gradient(180deg, #3b82f6 0%, rgba(59, 130, 246, 0.15) 100%);
        }

        .status-upcoming .step-line,
        .status-skipped .step-line {
          background: rgba(255, 255, 255, 0.08);
        }

        .step-content {
          flex: 1;
          padding-top: 4px;
        }

        .step-header {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .step-label {
          font-size: 15px;
          font-weight: 600;
          transition: color 0.2s ease;
        }

        .status-completed .step-label {
          color: rgba(255, 255, 255, 0.6);
        }

        .status-current .step-label {
          color: #fff;
          font-size: 16px;
        }

        .status-upcoming .step-label {
          color: rgba(255, 255, 255, 0.4);
        }

        .status-skipped .step-label {
          color: rgba(255, 255, 255, 0.25);
          text-decoration: line-through;
        }

        .gate-badge {
          padding: 3px 8px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .gate-badge.customer {
          background: rgba(245, 158, 11, 0.15);
          border: 1px solid rgba(245, 158, 11, 0.3);
          color: #fbbf24;
        }

        .gate-badge.candidate {
          background: rgba(139, 92, 246, 0.15);
          border: 1px solid rgba(139, 92, 246, 0.3);
          color: #a78bfa;
        }

        .step-details {
          margin-top: 12px;
          padding: 16px;
          background: rgba(59, 130, 246, 0.06);
          border: 1px solid rgba(59, 130, 246, 0.15);
          border-radius: 10px;
        }

        .step-description {
          margin: 0 0 14px 0;
          font-size: 14px;
          color: rgba(255, 255, 255, 0.75);
          line-height: 1.5;
        }

        .whats-next {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .whats-next-label {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: rgba(255, 255, 255, 0.4);
        }

        .whats-next-value {
          font-size: 13px;
          color: #60a5fa;
        }
      `}</style>
    </div>
  );
}

function CandidateActionPanel({ actions }: { actions: CandidateAction[] }) {
  const completedCount = actions.filter((a) => a.completed).length;
  const totalCount = actions.length;

  return (
    <div className="action-panel">
      <div className="panel-header">
        <div className="panel-icon">⚡</div>
        <div className="panel-title">
          <h3>What You Need To Do Now</h3>
          <p className="panel-progress">
            {completedCount} of {totalCount} completed
          </p>
        </div>
      </div>
      <div className="action-list">
        {actions.map((action) => (
          <div key={action.id} className={`action-item ${action.completed ? 'completed' : ''}`}>
            <div className="action-checkbox">
              {action.completed ? '✓' : '○'}
            </div>
            <span className="action-label">{action.label}</span>
            {!action.completed && (
              <button className="action-btn" disabled>
                Complete
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="panel-footer">
        <span className="footer-note">Complete all items to proceed to the next step</span>
      </div>

      <style jsx>{`
        .action-panel {
          padding: 24px;
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(59, 130, 246, 0.08) 100%);
          border: 1px solid rgba(139, 92, 246, 0.25);
          border-radius: 12px;
          margin-bottom: 32px;
        }

        .panel-header {
          display: flex;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 20px;
        }

        .panel-icon {
          width: 44px;
          height: 44px;
          background: rgba(139, 92, 246, 0.2);
          border: 1px solid rgba(139, 92, 246, 0.3);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
        }

        .panel-title h3 {
          margin: 0 0 4px 0;
          font-size: 18px;
          font-weight: 700;
          color: #fff;
        }

        .panel-progress {
          margin: 0;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.5);
        }

        .action-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .action-item {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 14px 16px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 8px;
          transition: all 0.2s ease;
        }

        .action-item.completed {
          opacity: 0.6;
        }

        .action-checkbox {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 700;
          flex-shrink: 0;
        }

        .action-item:not(.completed) .action-checkbox {
          background: rgba(255, 255, 255, 0.05);
          border: 2px solid rgba(255, 255, 255, 0.2);
          color: rgba(255, 255, 255, 0.4);
        }

        .action-item.completed .action-checkbox {
          background: rgba(34, 197, 94, 0.2);
          border: 2px solid #22c55e;
          color: #4ade80;
        }

        .action-label {
          flex: 1;
          font-size: 14px;
          color: rgba(255, 255, 255, 0.85);
        }

        .action-item.completed .action-label {
          text-decoration: line-through;
          color: rgba(255, 255, 255, 0.45);
        }

        .action-btn {
          padding: 8px 16px;
          background: rgba(139, 92, 246, 0.2);
          border: 1px solid rgba(139, 92, 246, 0.35);
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          color: #a78bfa;
          cursor: not-allowed;
          opacity: 0.7;
        }

        .panel-footer {
          margin-top: 16px;
          padding-top: 14px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }

        .footer-note {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.4);
        }
      `}</style>
    </div>
  );
}

function ContactPanel() {
  return (
    <div className="contact-panel">
      <div className="contact-header">
        <span className="contact-icon">📞</span>
        <span className="contact-title">Contact MW4H</span>
      </div>
      <div className="contact-actions">
        <button className="contact-btn" disabled>
          <span className="btn-icon">📱</span>
          <span className="btn-label">Call Support</span>
        </button>
        <button className="contact-btn" disabled>
          <span className="btn-icon">✉️</span>
          <span className="btn-label">Email Support</span>
        </button>
      </div>

      <style jsx>{`
        .contact-panel {
          padding: 20px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 10px;
        }

        .contact-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 16px;
        }

        .contact-icon {
          font-size: 16px;
        }

        .contact-title {
          font-size: 14px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.7);
        }

        .contact-actions {
          display: flex;
          gap: 12px;
        }

        .contact-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px 16px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          cursor: not-allowed;
          opacity: 0.6;
          transition: all 0.2s ease;
        }

        .btn-icon {
          font-size: 14px;
        }

        .btn-label {
          font-size: 13px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.6);
        }
      `}</style>
    </div>
  );
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function WorkerTimelinePage() {
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('normal');

  const selectedScenario = MOCK_SCENARIOS.find((s) => s.id === selectedScenarioId) || MOCK_SCENARIOS[0];

  // Filter steps based on scenario (hide customer gate if not applicable)
  const visibleSteps = TIMELINE_STEPS.filter((step) => {
    // Always hide exception unless it's the current step
    if (step.key === 'exception_no_show' && selectedScenario.currentStep !== 'exception_no_show') {
      return false;
    }
    // Hide customer gate if scenario doesn't have it
    if (step.isGate && !selectedScenario.hasCustomerGate) {
      return false;
    }
    return true;
  });

  const isCandidateBlocked = selectedScenario.currentStep === 'awaiting_candidate_action';

  return (
    <div className="timeline-page">
      {/* Demo Banner */}
      <div className="demo-banner">
        <span className="demo-icon">⚠️</span>
        <span className="demo-text">UI Shell / Mock Data / Demo Only</span>
      </div>

      {/* Page Header */}
      <header className="page-header">
        <div className="header-icon">🚀</div>
        <div className="header-content">
          <h1 className="page-title">Your Job Journey</h1>
          <p className="page-subtitle">Track your progress from opt-in to dispatch</p>
        </div>
      </header>

      {/* Scenario Selector (Demo Only) */}
      <ScenarioSelector
        scenarios={MOCK_SCENARIOS}
        selectedId={selectedScenarioId}
        onSelect={setSelectedScenarioId}
      />

      {/* Job Info Header */}
      <JobInfoHeader
        jobInfo={selectedScenario.jobInfo}
        currentStatus={getStatusLabel(selectedScenario.currentStep)}
      />

      {/* Candidate Action Panel (if blocked) */}
      {isCandidateBlocked && selectedScenario.candidateActions && (
        <CandidateActionPanel actions={selectedScenario.candidateActions} />
      )}

      {/* Timeline */}
      <div className="timeline-container">
        <div className="timeline-header">
          <h2 className="timeline-title">Progress Timeline</h2>
          <div className="you-are-here">
            <span className="here-dot" />
            <span className="here-label">You are here</span>
          </div>
        </div>

        <div className="timeline">
          {visibleSteps.map((step, index) => (
            <TimelineStepItem
              key={step.key}
              step={step}
              status={getStepStatus(step.key, selectedScenario.currentStep, selectedScenario.hasCustomerGate)}
              isLast={index === visibleSteps.length - 1}
            />
          ))}
        </div>
      </div>

      {/* Contact Panel */}
      <ContactPanel />

      <style jsx>{`
        .timeline-page {
          min-height: 100vh;
          background: linear-gradient(180deg, #0c0f14 0%, #111827 100%);
          color: #fff;
          padding: 24px 40px 60px;
          max-width: 900px;
          margin: 0 auto;
          font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
        }

        /* Demo Banner */
        .demo-banner {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 12px 20px;
          background: rgba(245, 158, 11, 0.12);
          border: 1px solid rgba(245, 158, 11, 0.25);
          border-radius: 8px;
          margin-bottom: 32px;
        }

        .demo-icon {
          font-size: 16px;
        }

        .demo-text {
          font-size: 13px;
          font-weight: 600;
          color: #fbbf24;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        /* Page Header */
        .page-header {
          display: flex;
          align-items: flex-start;
          gap: 20px;
          margin-bottom: 40px;
        }

        .header-icon {
          width: 56px;
          height: 56px;
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%);
          border: 1px solid rgba(59, 130, 246, 0.25);
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 26px;
        }

        .header-content {
          flex: 1;
        }

        .page-title {
          margin: 0 0 6px 0;
          font-size: 32px;
          font-weight: 700;
          background: linear-gradient(135deg, #fff 0%, #94a3b8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          letter-spacing: -0.5px;
        }

        .page-subtitle {
          margin: 0;
          font-size: 15px;
          color: rgba(255, 255, 255, 0.55);
        }

        /* Timeline Container */
        .timeline-container {
          padding: 24px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          margin-bottom: 24px;
        }

        .timeline-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
          padding-bottom: 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .timeline-title {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.9);
        }

        .you-are-here {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .here-dot {
          width: 10px;
          height: 10px;
          background: #3b82f6;
          border-radius: 50%;
          box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);
          animation: pulse 2s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.7;
            transform: scale(1.1);
          }
        }

        .here-label {
          font-size: 12px;
          font-weight: 600;
          color: #60a5fa;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .timeline {
          padding-left: 4px;
        }
      `}</style>
    </div>
  );
}
