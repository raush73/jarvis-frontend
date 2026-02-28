"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Employee,
  EmployeeSearchFilters,
  TRADE_OPTIONS,
  LOCATION_OPTIONS,
  DISTANCE_OPTIONS,
  searchEmployees,
  getRecentResults,
} from "@/data/mockEmployeeData";

// Mock data for last name autocomplete
const AUTOCOMPLETE_MOCK = [
  { id: "EMP-001", firstName: "Marcus", lastName: "Johnson" },
  { id: "EMP-002", firstName: "Sarah", lastName: "Johnson" },
  { id: "EMP-003", firstName: "Michael", lastName: "Williams" },
  { id: "EMP-004", firstName: "Jennifer", lastName: "Williams" },
  { id: "EMP-005", firstName: "David", lastName: "Brown" },
  { id: "EMP-006", firstName: "Emily", lastName: "Davis" },
  { id: "EMP-007", firstName: "Robert", lastName: "Miller" },
  { id: "EMP-008", firstName: "Lisa", lastName: "Wilson" },
  { id: "EMP-009", firstName: "James", lastName: "Moore" },
  { id: "EMP-010", firstName: "Amanda", lastName: "Taylor" },
];

// Pagination config
const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

export default function EmployeesPage() {
  const router = useRouter();

  // Search form state
  const [filters, setFilters] = useState<EmployeeSearchFilters>({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    trade: "",
    status: "",
    location: "",
    distance: undefined,
  });

  // Advanced section toggle
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Last name autocomplete state
  const [lastNameSuggestions, setLastNameSuggestions] = useState<typeof AUTOCOMPLETE_MOCK>([]);

  // Search results state
  const [hasSearched, setHasSearched] = useState(false);
  const [searchResults, setSearchResults] = useState<Employee[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Recent results (async loaded)
  const [recentResults, setRecentResults] = useState<Employee[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);

  // Load recent results async (simulated delay)
  useEffect(() => {
    const timer = setTimeout(() => {
      setRecentResults(getRecentResults());
      setRecentLoading(false);
    }, 400); // Simulated async delay

    return () => clearTimeout(timer);
  }, []);

  // Reset to page 1 when searchResults changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchResults]);

  // Handle filter changes
  const handleFilterChange = useCallback(
    (field: keyof EmployeeSearchFilters, value: string | number | undefined) => {
      setFilters((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  // Handle last name change with autocomplete
  const handleLastNameChange = useCallback((value: string) => {
    handleFilterChange("lastName", value);
    if (value.length >= 3) {
      const filtered = AUTOCOMPLETE_MOCK.filter((emp) =>
        emp.lastName.toLowerCase().includes(value.toLowerCase())
      ).slice(0, 8);
      setLastNameSuggestions(filtered);
    } else {
      setLastNameSuggestions([]);
    }
  }, [handleFilterChange]);

  // Handle autocomplete suggestion click
  const handleSuggestionClick = useCallback((id: string) => {
    setLastNameSuggestions([]);
    router.push(`/employees/${id}`);
  }, [router]);

  // Execute search
  const handleSearch = useCallback(() => {
    const results = searchEmployees(filters);
    setSearchResults(results);
    setHasSearched(true);
    setCurrentPage(1);
  }, [filters]);

  // Clear search
  const handleClear = useCallback(() => {
    setFilters({
      firstName: "",
      lastName: "",
      phone: "",
      email: "",
      trade: "",
      status: "",
      location: "",
      distance: undefined,
    });
    setHasSearched(false);
    setSearchResults([]);
    setCurrentPage(1);
  }, []);

  // Pagination
  const paginatedResults = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return searchResults.slice(start, start + pageSize);
  }, [searchResults, currentPage, pageSize]);

  const totalPages = Math.ceil(searchResults.length / pageSize);

  // Pagination display values
  const startIndex = (currentPage - 1) * pageSize;
  const showingStart = searchResults.length === 0 ? 0 : startIndex + 1;
  const showingEnd = Math.min(startIndex + pageSize, searchResults.length);

  // Page number window (max 5)
  const getPageNumbers = () => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    let windowStart = Math.max(1, currentPage - 2);
    let windowEnd = Math.min(totalPages, windowStart + 4);
    if (windowEnd - windowStart < 4) {
      windowStart = Math.max(1, windowEnd - 4);
    }
    return Array.from({ length: windowEnd - windowStart + 1 }, (_, i) => windowStart + i);
  };

  // Status badge color
  const getStatusColor = (status: Employee["status"]) => {
    switch (status) {
      case "Active":
        return "#22c55e";
      case "Inactive":
        return "#6b7280";
      case "Do Not Dispatch":
        return "#ef4444";
      default:
        return "#6b7280";
    }
  };

  // Availability badge color
  const getAvailabilityColor = (availability: Employee["availability"]) => {
    switch (availability) {
      case "Available":
        return "#22c55e";
      case "On Assignment":
        return "#3b82f6";
      case "Unavailable":
        return "#f59e0b";
      default:
        return "#6b7280";
    }
  };

  return (
    <div className="employees-container">
      {/* Page Header */}
      <div className="employees-header">
        <h1>Employee Search</h1>
        <p className="header-subtitle">
          Search the employee database by name, contact, trade, or location
        </p>
      </div>

      {/* Search Form */}
      <div className="search-form-section">
        <div className="search-form-header">
          <span className="form-section-label">Search Criteria</span>
        </div>

        {/* Simple Search Fields (always visible) */}
        <div className="search-grid">
          <div className="form-field">
            <label htmlFor="firstName">First Name</label>
            <input
              id="firstName"
              type="text"
              placeholder="e.g. Marcus"
              value={filters.firstName || ""}
              onChange={(e) => handleFilterChange("firstName", e.target.value)}
            />
          </div>

          <div className="form-field">
            <label htmlFor="lastName">Last Name</label>
            <input
              id="lastName"
              type="text"
              placeholder="e.g. Johnson"
              value={filters.lastName || ""}
              onChange={(e) => handleLastNameChange(e.target.value)}
            />
            {lastNameSuggestions.length > 0 && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10, background: "#1a1d24", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", marginTop: "4px" }}>
                {lastNameSuggestions.map((emp, idx) => (
                  <button
                    key={emp.id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSuggestionClick(emp.id);
                    }}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "10px 12px",
                      cursor: "pointer",
                      fontSize: "14px",
                      color: "rgba(255,255,255,0.85)",
                      background: "transparent",
                      border: "none",
                      borderBottom: idx === lastNameSuggestions.length - 1 ? "none" : "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    {emp.lastName}, {emp.firstName}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="form-field">
            <label htmlFor="phone">Phone</label>
            <input
              id="phone"
              type="text"
              placeholder="(555) 123-4567"
              value={filters.phone || ""}
              onChange={(e) => handleFilterChange("phone", e.target.value)}
            />
          </div>

          <div className="form-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="text"
              placeholder="email@example.com"
              value={filters.email || ""}
              onChange={(e) => handleFilterChange("email", e.target.value)}
            />
          </div>

          <div className="form-field">
            <label htmlFor="trade">Trade</label>
            <select
              id="trade"
              value={filters.trade || ""}
              onChange={(e) => handleFilterChange("trade", e.target.value)}
            >
              <option value="">All Trades</option>
              {TRADE_OPTIONS.map((trade) => (
                <option key={trade} value={trade}>
                  {trade}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="status">Status</label>
            <select
              id="status"
              value={filters.status || ""}
              onChange={(e) =>
                handleFilterChange("status", e.target.value as EmployeeSearchFilters["status"])
              }
            >
              <option value="">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Do Not Dispatch">Do Not Dispatch</option>
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="location">Location</label>
            <select
              id="location"
              value={filters.location || ""}
              onChange={(e) => handleFilterChange("location", e.target.value)}
            >
              <option value="">All Locations</option>
              {LOCATION_OPTIONS.map((loc) => (
                <option key={loc.value} value={loc.value}>
                  {loc.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="distance">Distance</label>
            <select
              id="distance"
              value={filters.distance || ""}
              onChange={(e) =>
                handleFilterChange(
                  "distance",
                  e.target.value ? Number(e.target.value) : undefined
                )
              }
              disabled={!filters.location}
            >
              <option value="">Any Distance</option>
              {DISTANCE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Advanced Section Toggle */}
        <button
          className="advanced-toggle"
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          <span className="toggle-icon">{showAdvanced ? "-" : "+"}</span>
          Advanced Filters
        </button>

        {/* Advanced Section (collapsed by default) */}
        {showAdvanced && (
          <div className="advanced-section">
            <div className="advanced-groups">
              <div className="advanced-group">
                <span className="group-label">Identity</span>
                <div className="group-fields">
                  <span className="field-placeholder">SSN (last 4)</span>
                  <span className="field-placeholder">Date of Birth</span>
                </div>
              </div>

              <div className="advanced-group">
                <span className="group-label">Compliance</span>
                <div className="group-fields">
                  <span className="field-placeholder">Background Check</span>
                  <span className="field-placeholder">Drug Test Date</span>
                  <span className="field-placeholder">I-9 Status</span>
                </div>
              </div>

              <div className="advanced-group">
                <span className="group-label">Work / Availability</span>
                <div className="group-fields">
                  <span className="field-placeholder">Min Rate</span>
                </div>
              </div>

              <div className="advanced-group">
                <span className="group-label">Safety</span>
                <div className="group-fields">
                  <span className="field-placeholder">OSHA Level</span>
                  <span className="field-placeholder">Safety Training Date</span>
                </div>
              </div>

              <div className="advanced-group">
                <span className="group-label">Notes / Tags</span>
                <div className="group-fields">
                  <span className="field-placeholder">Internal Tags</span>
                  <span className="field-placeholder">Notes Contains</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Search Actions */}
        <div className="search-actions">
          <button className="btn-search" type="button" onClick={handleSearch}>
            Search
          </button>
          <button className="btn-clear" type="button" onClick={handleClear}>
            Clear
          </button>
        </div>
      </div>

      {/* Results Area */}
      {!hasSearched ? (
        /* Recent Results Panel (before search) */
        <div className="recent-results-section">
          <div className="recent-header">
            <h2>Recent Results</h2>
            <span className="recent-hint">Based on your recent searches</span>
          </div>

          {recentLoading ? (
            <div className="recent-loading">
              <div className="loading-spinner" />
              <span>Loading recent results...</span>
            </div>
          ) : recentResults.length > 0 ? (
            <div className="results-table-wrap">
              <table className="results-table">
                <thead>
                  <tr>
                    <th>Employee ID</th>
                    <th>Name</th>
                    <th>Trade</th>
                    <th>Phone</th>
                    <th>Location</th>
                    <th>Status</th>
                    <th>Availability</th>
                  </tr>
                </thead>
                <tbody>
                  {recentResults.map((emp) => (
                    <tr key={emp.id} className="result-row">
                      <td className="emp-id">{emp.id}</td>
                      <td className="emp-name">
                        {emp.firstName} {emp.lastName}
                      </td>
                      <td className="emp-trade">{emp.trade}</td>
                      <td className="emp-phone">{emp.phone}</td>
                      <td className="emp-location">
                        {emp.city}, {emp.state}
                      </td>
                      <td>
                        <span
                          className="status-badge"
                          style={{
                            backgroundColor: `${getStatusColor(emp.status)}15`,
                            color: getStatusColor(emp.status),
                            borderColor: `${getStatusColor(emp.status)}40`,
                          }}
                        >
                          {emp.status || "Unknown"}
                        </span>
                      </td>
                      <td>
                        <span
                          className="availability-badge"
                          style={{
                            color: getAvailabilityColor(emp.availability),
                          }}
                        >
                          <span
                            className="availability-dot"
                            style={{
                              backgroundColor: getAvailabilityColor(emp.availability),
                            }}
                          />
                          {emp.availability || "—"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="recent-footer">
                <span className="capped-notice">
                  Showing {recentResults.length} recent records (capped)
                </span>
              </div>
            </div>
          ) : (
            <div className="recent-empty">
              <span>No recent searches found</span>
            </div>
          )}
        </div>
      ) : (
        /* Search Results (after search) */
        <div className="search-results-section">
          <div className="results-header">
            <h2>Search Results</h2>
            <span className="results-count">
              {searchResults.length} employee{searchResults.length !== 1 ? "s" : ""} found
            </span>
          </div>

          {searchResults.length > 0 ? (
            <>
              <div className="results-table-wrap">
                <table className="results-table">
                  <thead>
                    <tr>
                      <th>Employee ID</th>
                      <th>Name</th>
                      <th>Trade</th>
                      <th>Phone</th>
                      <th>Email</th>
                      <th>Location</th>
                      <th>Status</th>
                      <th>Availability</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedResults.map((emp) => (
                      <tr key={emp.id} className="result-row">
                        <td className="emp-id">{emp.id}</td>
                        <td className="emp-name">
                        <Link href={`/employees/${emp.id}`}>
                          {emp.firstName} {emp.lastName}
                        </Link>

                        </td>
                        <td className="emp-trade">{emp.trade}</td>
                        <td className="emp-phone">{emp.phone}</td>
                        <td className="emp-email">{emp.email}</td>
                        <td className="emp-location">
                          {emp.city}, {emp.state}
                        </td>
                        <td>
                          <span
                            className="status-badge"
                            style={{
                              backgroundColor: `${getStatusColor(emp.status)}15`,
                              color: getStatusColor(emp.status),
                              borderColor: `${getStatusColor(emp.status)}40`,
                            }}
                          >
                            {emp.status || "Unknown"}
                          </span>
                        </td>
                        <td>
                          <span
                            className="availability-badge"
                            style={{
                              color: getAvailabilityColor(emp.availability),
                            }}
                          >
                            <span
                              className="availability-dot"
                              style={{
                                backgroundColor: getAvailabilityColor(emp.availability),
                              }}
                            />
                            {emp.availability || "—"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="pagination">
                <div className="pagination-left">
                  <label htmlFor="pageSize" className="page-size-label">Show</label>
                  <select
                    id="pageSize"
                    className="page-size-select"
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                  >
                    {PAGE_SIZE_OPTIONS.map((size) => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </select>
                  <span className="showing-range">
                    Showing {showingStart}â€“{showingEnd} of {searchResults.length}
                  </span>
                </div>
                {totalPages > 1 && (
                  <div className="pagination-center">
                    <button
                      className="page-btn"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage((p) => p - 1)}
                    >
                      Prev
                    </button>
                    {getPageNumbers().map((pageNum) => (
                      <button
                        key={pageNum}
                        className={`page-num-btn ${pageNum === currentPage ? "active" : ""}`}
                        onClick={() => setCurrentPage(pageNum)}
                      >
                        {pageNum}
                      </button>
                    ))}
                    <button
                      className="page-btn"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage((p) => p + 1)}
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>

              {searchResults.length > 50 && (
                <div className="refine-notice">
                  Refine your search to narrow results
                </div>
              )}
            </>
          ) : (
            <div className="no-results">
              <span className="no-results-icon">ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¹ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦</span>
              <span className="no-results-text">
                No employees match your search criteria
              </span>
              <button className="btn-clear-small" onClick={handleClear}>
                Clear filters and try again
              </button>
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .employees-container {
          padding: 32px 40px;
          max-width: 1400px;
          margin: 0 auto;
        }

        .employees-header {
          margin-bottom: 28px;
        }

        .employees-header h1 {
          font-size: 26px;
          font-weight: 600;
          color: #fff;
          margin: 0 0 8px;
          letter-spacing: -0.5px;
        }

        .header-subtitle {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.5);
          margin: 0;
        }

        /* Search Form */
        .search-form-section {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 32px;
        }

        .search-form-header {
          margin-bottom: 20px;
        }

        .form-section-label {
          font-size: 12px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .search-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 16px;
        }

        .form-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .form-field label {
          font-size: 12px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.7);
        }

        .form-field input,
        .form-field select {
          padding: 10px 12px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          font-size: 14px;
          color: #fff;
          transition: all 0.15s ease;
        }

        .form-field input::placeholder {
          color: rgba(255, 255, 255, 0.3);
        }

        .form-field input:focus,
        .form-field select:focus {
          outline: none;
          border-color: #3b82f6;
          background: rgba(59, 130, 246, 0.08);
        }

        .form-field select {
          cursor: pointer;
        }

        .form-field select:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .form-field select option {
          background: #1a1d24;
          color: #fff;
        }

        /* Advanced Toggle */
        .advanced-toggle {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 0;
          background: none;
          border: none;
          font-size: 13px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.6);
          cursor: pointer;
          transition: color 0.15s ease;
        }

        .advanced-toggle:hover {
          color: #3b82f6;
        }

        .toggle-icon {
          font-size: 16px;
          font-weight: 600;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.06);
          border-radius: 4px;
        }

        /* Advanced Section */
        .advanced-section {
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px dashed rgba(255, 255, 255, 0.08);
        }

        .advanced-groups {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 16px;
        }

        .advanced-group {
          background: rgba(255, 255, 255, 0.02);
          border: 1px dashed rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          padding: 14px;
        }

        .group-label {
          display: block;
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.45);
          text-transform: uppercase;
          letter-spacing: 0.4px;
          margin-bottom: 10px;
        }

        .group-fields {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .field-placeholder {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.35);
          padding: 6px 8px;
          background: rgba(255, 255, 255, 0.02);
          border-radius: 4px;
        }

        /* Search Actions */
        .search-actions {
          display: flex;
          gap: 12px;
          margin-top: 20px;
          padding-top: 20px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }

        .btn-search {
          padding: 10px 28px;
          background: #3b82f6;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 600;
          color: #fff;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-search:hover {
          background: #2563eb;
        }

        .btn-clear {
          padding: 10px 20px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.7);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-clear:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
        }

        /* Recent Results Section */
        .recent-results-section {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          overflow: hidden;
        }

        .recent-header {
          display: flex;
          align-items: baseline;
          gap: 12px;
          padding: 20px 24px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .recent-header h2 {
          font-size: 16px;
          font-weight: 600;
          color: #fff;
          margin: 0;
        }

        .recent-hint {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.4);
        }

        .recent-loading {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 32px 24px;
          color: rgba(255, 255, 255, 0.5);
          font-size: 14px;
        }

        .loading-spinner {
          width: 18px;
          height: 18px;
          border: 2px solid rgba(255, 255, 255, 0.1);
          border-top-color: #3b82f6;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .recent-empty {
          padding: 32px 24px;
          color: rgba(255, 255, 255, 0.4);
          font-size: 14px;
        }

        .recent-footer {
          padding: 12px 24px;
          border-top: 1px solid rgba(255, 255, 255, 0.04);
          background: rgba(255, 255, 255, 0.01);
        }

        .capped-notice {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.4);
        }

        /* Search Results Section */
        .search-results-section {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          overflow: hidden;
        }

        .results-header {
          display: flex;
          align-items: baseline;
          gap: 12px;
          padding: 20px 24px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .results-header h2 {
          font-size: 16px;
          font-weight: 600;
          color: #fff;
          margin: 0;
        }

        .results-count {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.5);
        }

        /* Results Table */
        .results-table-wrap {
          overflow-x: auto;
        }

        .results-table {
          width: 100%;
          border-collapse: collapse;
        }

        .results-table thead {
          background: rgba(255, 255, 255, 0.03);
        }

        .results-table th {
          padding: 12px 16px;
          text-align: left;
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.4px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          white-space: nowrap;
        }

        .results-table td {
          padding: 14px 16px;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.85);
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        }

        .result-row {
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .result-row:hover {
          background: rgba(59, 130, 246, 0.08);
        }

        .result-row:last-child td {
          border-bottom: none;
        }

        .emp-id {
          font-family: var(--font-geist-mono), monospace;
          font-size: 12px;
          color: #3b82f6 !important;
        }

        .emp-name {
          font-weight: 500;
          color: #fff !important;
        }

        .emp-trade {
          color: rgba(255, 255, 255, 0.7) !important;
        }

        .emp-phone {
          font-family: var(--font-geist-mono), monospace;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.6) !important;
        }

        .emp-email {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.5) !important;
        }

        .emp-location {
          color: rgba(255, 255, 255, 0.6) !important;
          white-space: nowrap;
        }

        .status-badge {
          display: inline-block;
          padding: 4px 10px;
          border: 1px solid;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          white-space: nowrap;
        }

        .availability-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 500;
          white-space: nowrap;
        }

        .availability-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        /* Pagination */
        .pagination {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 16px 24px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          flex-wrap: wrap;
        }

        .pagination-left {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .page-size-label {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.5);
        }

        .page-size-select {
          padding: 6px 10px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 5px;
          font-size: 13px;
          color: #fff;
          cursor: pointer;
        }

        .page-size-select option {
          background: #1a1d24;
          color: #fff;
        }

        .showing-range {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.5);
          margin-left: 8px;
        }

        .pagination-center {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .page-btn {
          padding: 8px 16px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 5px;
          font-size: 13px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.7);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .page-btn:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
        }

        .page-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .page-num-btn {
          padding: 6px 12px;
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 5px;
          font-size: 13px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.6);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .page-num-btn:hover {
          background: rgba(255, 255, 255, 0.06);
          color: #fff;
        }

        .page-num-btn.active {
          background: #3b82f6;
          border-color: #3b82f6;
          color: #fff;
        }

        .page-info {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.5);
        }

        .refine-notice {
          padding: 12px 24px;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.4);
          text-align: center;
          border-top: 1px solid rgba(255, 255, 255, 0.04);
        }

        /* No Results */
        .no-results {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          padding: 48px 24px;
        }

        .no-results-icon {
          font-size: 32px;
          color: rgba(255, 255, 255, 0.2);
        }

        .no-results-text {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.5);
        }

        .btn-clear-small {
          margin-top: 8px;
          padding: 8px 16px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 5px;
          font-size: 12px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.6);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-clear-small:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
        }

        /* Responsive */
        @media (max-width: 1200px) {
          .search-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .advanced-groups {
            grid-template-columns: repeat(3, 1fr);
          }
        }

        @media (max-width: 768px) {
          .employees-container {
            padding: 20px;
          }

          .search-grid {
            grid-template-columns: 1fr;
          }

          .advanced-groups {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
