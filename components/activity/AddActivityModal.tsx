"use client";

import { useState, useEffect, useCallback } from "react";
import TaskCreateForm from "./TaskCreateForm";
import NoteCreateForm from "./NoteCreateForm";
import FollowUpCreateForm from "./FollowUpCreateForm";

type ActivityTab = "followup" | "task" | "note";

// Follow-Up is only available for PROSPECT and CUSTOMER accounts (governance
// ACTIVITY_SYSTEM §14): leads are Friday-only and create follow-ups via call
// completion, not from Add Activity.
function buildTabs(lifecycleStatus?: string | null): { key: ActivityTab; label: string }[] {
  const tabs: { key: ActivityTab; label: string }[] = [];
  const status = (lifecycleStatus ?? "").toUpperCase();
  if (status === "PROSPECT" || status === "CUSTOMER") {
    tabs.push({ key: "followup", label: "Follow-Up" });
  }
  tabs.push({ key: "task", label: "Task" });
  tabs.push({ key: "note", label: "Note" });
  return tabs;
}

export default function AddActivityModal({
  customerId,
  lifecycleStatus,
  onCreated,
  onClose,
}: {
  customerId: string;
  lifecycleStatus?: string | null;
  onCreated: () => void;
  onClose: () => void;
}) {
  const TABS = buildTabs(lifecycleStatus);
  const [activeTab, setActiveTab] = useState<ActivityTab>(TABS[0].key);

  const handleCreated = useCallback(() => {
    onCreated();
    onClose();
  }, [onCreated, onClose]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-container">
        <div className="modal-header">
          <h2>Add Activity</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        <div className="modal-tabs">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              className={`modal-tab ${activeTab === tab.key ? "active" : ""}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="modal-body">
          {activeTab === "followup" && (
            <FollowUpCreateForm
              customerId={customerId}
              onCreated={handleCreated}
              onCancel={onClose}
            />
          )}
          {activeTab === "task" && (
            <TaskCreateForm
              customerId={customerId}
              onCreated={handleCreated}
              onCancel={onClose}
            />
          )}
          {activeTab === "note" && (
            <NoteCreateForm
              customerId={customerId}
              onCreated={handleCreated}
              onCancel={onClose}
            />
          )}
        </div>
      </div>

      <style jsx>{`
        .modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.45);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 24px;
        }
        .modal-container {
          background: #fff;
          border-radius: 12px;
          width: 100%;
          max-width: 480px;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
        }
        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px 12px;
          border-bottom: 1px solid #e9ecef;
        }
        .modal-header h2 {
          margin: 0;
          font-size: 17px;
          font-weight: 600;
          color: #2c3e50;
        }
        .modal-close {
          background: none;
          border: none;
          font-size: 22px;
          color: #8e99a4;
          cursor: pointer;
          padding: 0 4px;
          line-height: 1;
        }
        .modal-close:hover {
          color: #2c3e50;
        }
        .modal-tabs {
          display: flex;
          gap: 0;
          border-bottom: 1px solid #e9ecef;
          padding: 0 20px;
        }
        .modal-tab {
          padding: 10px 20px;
          border: none;
          background: none;
          font-size: 13px;
          font-weight: 600;
          color: #8e99a4;
          cursor: pointer;
          border-bottom: 2px solid transparent;
          transition: all 0.15s ease;
        }
        .modal-tab:hover {
          color: #2c3e50;
        }
        .modal-tab.active {
          color: #1976d2;
          border-bottom-color: #1976d2;
        }
        .modal-body {
          padding: 20px;
        }
      `}</style>
    </div>
  );
}
