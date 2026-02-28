'use client';

import { useState } from 'react';
import { Candidate, mockJarvisMatches, mockSearchResults } from '@/data/mockRecruitingData';

interface RecruitingSourcingPanelProps {
  onAddToIdentified?: (candidate: Candidate) => void;
}

/**
 * Recruiting Sourcing Panel
 * 
 * Split panel layout:
 * LEFT — Jarvis Matches (System Identified)
 * RIGHT — Recruiting Search (Manual)
 * 
 * UI-only, no actual search logic.
 */
export function RecruitingSourcingPanel({ onAddToIdentified }: RecruitingSourcingPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTrade, setSelectedTrade] = useState('all');
  const [selectedAvailability, setSelectedAvailability] = useState('all');
  const [maxDistance, setMaxDistance] = useState(50);

  // Mock: Filter search results based on UI state (no real filtering)
  const filteredSearchResults = mockSearchResults;

  return (
    <div className="sourcing-panel">
      {/* LEFT: Jarvis Matches */}
      <div className="sourcing-section jarvis-matches">
        <div className="section-header">
          <div className="section-title">
            <span className="section-icon">🤖</span>
            <h3>Jarvis Matches</h3>
            <span className="section-badge system">System Identified</span>
          </div>
          <button className="run-match-btn" disabled>
            <span className="btn-icon">⚡</span>
            Run Match
          </button>
        </div>

        <div className="candidates-list">
          {mockJarvisMatches.map(candidate => (
            <JarvisMatchCard
              key={candidate.id}
              candidate={candidate}
              onAdd={() => onAddToIdentified?.(candidate)}
            />
          ))}
        </div>

        <div className="section-footer">
          <span className="result-count">{mockJarvisMatches.length} matches found</span>
        </div>
      </div>

      {/* RIGHT: Recruiting Search */}
      <div className="sourcing-section recruiter-search">
        <div className="section-header">
          <div className="section-title">
            <span className="section-icon">🔍</span>
            <h3>Recruiting Search</h3>
            <span className="section-badge manual">Manual</span>
          </div>
        </div>

        <div className="search-controls">
          <input
            type="text"
            className="search-input"
            placeholder="Search employees by name, skill, location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <div className="filter-row">
            <select
              className="filter-select"
              value={selectedTrade}
              onChange={(e) => setSelectedTrade(e.target.value)}
            >
              <option value="all">All Trades</option>
              <option value="trade_elec">Electrician</option>
              <option value="trade_plumb">Plumber</option>
              <option value="trade_hvac">HVAC Tech</option>
              <option value="trade_carp">Carpenter</option>
            </select>

            <select
              className="filter-select"
              value={selectedAvailability}
              onChange={(e) => setSelectedAvailability(e.target.value)}
            >
              <option value="all">Any Availability</option>
              <option value="available">Available</option>
              <option value="partial">Partial</option>
            </select>

            <div className="distance-filter">
              <label>Max Distance: {maxDistance} mi</label>
              <input
                type="range"
                min="5"
                max="100"
                value={maxDistance}
                onChange={(e) => setMaxDistance(Number(e.target.value))}
              />
            </div>
          </div>

          <button className="search-btn">
            <span className="btn-icon">🔎</span>
            Search Employees
          </button>
        </div>

        <div className="candidates-list">
          {filteredSearchResults.map(candidate => (
            <SearchResultCard
              key={candidate.id}
              candidate={candidate}
              onAdd={() => onAddToIdentified?.(candidate)}
            />
          ))}
        </div>

        <div className="section-footer">
          <span className="result-count">{filteredSearchResults.length} results</span>
        </div>
      </div>

      <style jsx>{`
        .sourcing-panel {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          padding: 20px;
          background: linear-gradient(135deg, #1a1f2e 0%, #0f1318 100%);
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          margin-bottom: 24px;
        }

        .sourcing-section {
          background: rgba(0, 0, 0, 0.2);
          border-radius: 10px;
          padding: 16px;
          border: 1px solid rgba(255, 255, 255, 0.06);
        }

        .jarvis-matches {
          border-left: 3px solid #3b82f6;
        }

        .recruiter-search {
          border-left: 3px solid #10b981;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .section-title {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .section-icon {
          font-size: 20px;
        }

        .section-title h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
          color: #fff;
        }

        .section-badge {
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 3px 8px;
          border-radius: 4px;
        }

        .section-badge.system {
          background: rgba(59, 130, 246, 0.2);
          color: #60a5fa;
        }

        .section-badge.manual {
          background: rgba(16, 185, 129, 0.2);
          color: #34d399;
        }

        .run-match-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          background: rgba(59, 130, 246, 0.15);
          border: 1px solid rgba(59, 130, 246, 0.3);
          border-radius: 6px;
          color: #60a5fa;
          font-size: 13px;
          font-weight: 500;
          cursor: not-allowed;
          opacity: 0.6;
        }

        .btn-icon {
          font-size: 14px;
        }

        .search-controls {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 16px;
        }

        .search-input {
          width: 100%;
          padding: 10px 14px;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          color: #fff;
          font-size: 14px;
        }

        .search-input::placeholder {
          color: rgba(255, 255, 255, 0.4);
        }

        .search-input:focus {
          outline: none;
          border-color: #10b981;
        }

        .filter-row {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .filter-select {
          flex: 1;
          min-width: 120px;
          padding: 8px 10px;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          color: #fff;
          font-size: 13px;
        }

        .filter-select:focus {
          outline: none;
          border-color: #10b981;
        }

        .distance-filter {
          flex: 1;
          min-width: 140px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .distance-filter label {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.6);
        }

        .distance-filter input[type="range"] {
          width: 100%;
          accent-color: #10b981;
        }

        .search-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px 16px;
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          border: none;
          border-radius: 6px;
          color: #fff;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .search-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
        }

        .candidates-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
          max-height: 320px;
          overflow-y: auto;
          padding-right: 4px;
        }

        .candidates-list::-webkit-scrollbar {
          width: 6px;
        }

        .candidates-list::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.2);
          border-radius: 3px;
        }

        .candidates-list::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.15);
          border-radius: 3px;
        }

        .section-footer {
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }

        .result-count {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.5);
        }
      `}</style>
    </div>
  );
}

// Jarvis Match Card Component
function JarvisMatchCard({
  candidate,
  onAdd,
}: {
  candidate: Candidate;
  onAdd: () => void;
}) {
  return (
    <div className="candidate-card jarvis-card">
      <div className="card-header">
        <div className="candidate-info">
          <span className="candidate-name">{candidate.name}</span>
          <span className="candidate-trade">{candidate.tradeName}</span>
        </div>
        {candidate.matchConfidence && (
          <div className="confidence-badge">
            <span className="confidence-value">{candidate.matchConfidence}%</span>
            <span className="confidence-label">match</span>
          </div>
        )}
      </div>

      <div className="card-details">
        <span className="detail-item">📍 {candidate.distance} mi</span>
        <span className={`availability availability--${candidate.availability}`}>
          {candidate.availability === 'available' ? '✓ Available' : '◐ Partial'}
        </span>
      </div>

      <div className="card-certs">
        {candidate.certifications.slice(0, 2).map(cert => (
          <span key={cert.id} className="cert-tag">
            {cert.verified ? '✓' : '○'} {cert.name}
          </span>
        ))}
      </div>

      <button className="add-btn" onClick={onAdd}>
        + Add to Identified
      </button>

      <style jsx>{`
        .candidate-card {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          padding: 12px;
          transition: all 0.2s ease;
        }

        .candidate-card:hover {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(255, 255, 255, 0.12);
        }

        .jarvis-card {
          border-left: 2px solid #3b82f6;
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 8px;
        }

        .candidate-info {
          display: flex;
          flex-direction: column;
        }

        .candidate-name {
          font-size: 14px;
          font-weight: 600;
          color: #fff;
        }

        .candidate-trade {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.6);
        }

        .confidence-badge {
          display: flex;
          flex-direction: column;
          align-items: center;
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(99, 102, 241, 0.2) 100%);
          padding: 4px 10px;
          border-radius: 6px;
          border: 1px solid rgba(59, 130, 246, 0.3);
        }

        .confidence-value {
          font-size: 14px;
          font-weight: 700;
          color: #60a5fa;
        }

        .confidence-label {
          font-size: 9px;
          text-transform: uppercase;
          color: rgba(96, 165, 250, 0.7);
          letter-spacing: 0.5px;
        }

        .card-details {
          display: flex;
          gap: 12px;
          margin-bottom: 8px;
        }

        .detail-item {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.6);
        }

        .availability {
          font-size: 12px;
          font-weight: 500;
        }

        .availability--available {
          color: #34d399;
        }

        .availability--partial {
          color: #fbbf24;
        }

        .card-certs {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-bottom: 10px;
        }

        .cert-tag {
          font-size: 10px;
          padding: 3px 8px;
          background: rgba(255, 255, 255, 0.06);
          border-radius: 4px;
          color: rgba(255, 255, 255, 0.7);
        }

        .add-btn {
          width: 100%;
          padding: 8px;
          background: transparent;
          border: 1px dashed rgba(59, 130, 246, 0.4);
          border-radius: 6px;
          color: #60a5fa;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .add-btn:hover {
          background: rgba(59, 130, 246, 0.1);
          border-style: solid;
        }
      `}</style>
    </div>
  );
}

// Search Result Card Component
function SearchResultCard({
  candidate,
  onAdd,
}: {
  candidate: Candidate;
  onAdd: () => void;
}) {
  return (
    <div className="candidate-card search-card">
      <div className="card-header">
        <div className="candidate-info">
          <span className="candidate-name">{candidate.name}</span>
          <span className="candidate-trade">{candidate.tradeName}</span>
        </div>
      </div>

      <div className="card-details">
        <span className="detail-item">📍 {candidate.distance} mi</span>
        <span className={`availability availability--${candidate.availability}`}>
          {candidate.availability === 'available' ? '✓ Available' : '◐ Partial'}
        </span>
      </div>

      <div className="card-certs">
        {candidate.certifications.map(cert => (
          <span key={cert.id} className={`cert-tag ${!cert.verified ? 'unverified' : ''}`}>
            {cert.verified ? '✓' : '○'} {cert.name}
          </span>
        ))}
      </div>

      <button className="add-btn" onClick={onAdd}>
        + Add to Identified
      </button>

      <style jsx>{`
        .candidate-card {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          padding: 12px;
          transition: all 0.2s ease;
        }

        .candidate-card:hover {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(255, 255, 255, 0.12);
        }

        .search-card {
          border-left: 2px solid #10b981;
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 8px;
        }

        .candidate-info {
          display: flex;
          flex-direction: column;
        }

        .candidate-name {
          font-size: 14px;
          font-weight: 600;
          color: #fff;
        }

        .candidate-trade {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.6);
        }

        .card-details {
          display: flex;
          gap: 12px;
          margin-bottom: 8px;
        }

        .detail-item {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.6);
        }

        .availability {
          font-size: 12px;
          font-weight: 500;
        }

        .availability--available {
          color: #34d399;
        }

        .availability--partial {
          color: #fbbf24;
        }

        .card-certs {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-bottom: 10px;
        }

        .cert-tag {
          font-size: 10px;
          padding: 3px 8px;
          background: rgba(255, 255, 255, 0.06);
          border-radius: 4px;
          color: rgba(255, 255, 255, 0.7);
        }

        .cert-tag.unverified {
          background: rgba(245, 158, 11, 0.1);
          color: #fbbf24;
        }

        .add-btn {
          width: 100%;
          padding: 8px;
          background: transparent;
          border: 1px dashed rgba(16, 185, 129, 0.4);
          border-radius: 6px;
          color: #34d399;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .add-btn:hover {
          background: rgba(16, 185, 129, 0.1);
          border-style: solid;
        }
      `}</style>
    </div>
  );
}

export default RecruitingSourcingPanel;

