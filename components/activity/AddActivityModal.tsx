"use client";

import { useState } from "react";
import TaskCreateForm from "./TaskCreateForm";
import NoteCreateForm from "./NoteCreateForm";

type ActivityTab = "task" | "note";

const TABS: { key: ActivityTab; label: string }[] = [
  { key: "task", label: "Task" },
  { key: "note", label: "Note" },
];

export default function AddActivityModal({
  customerId,
  onCreated,
  onClose,
}: {
  customerId: string;
  onCreated: () => void;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<ActivityTab>("task");

  const handleCreated = () => {
    onCreated();
    onClose();
  };

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
