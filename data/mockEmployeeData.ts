/**
 * Mock Employee Data — Employees Search Screen
 * 
 * Search-first pattern: Data is queried, not dumped
 * UI mock only — no backend/DB assumptions
 */

export type EmployeeStatus = 'Active' | 'Inactive' | 'Do Not Dispatch';

export type Employee = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  trade: string;
  status: EmployeeStatus;
  city: string;
  state: string;
  zipCode: string;
  hireDate: string;
  lastDispatchDate?: string;
  certifications: string[];
  availability: 'Available' | 'On Assignment' | 'Unavailable';
};

// Trade options for dropdown
export const TRADE_OPTIONS = [
  'Electrician',
  'Plumber',
  'HVAC Tech',
  'Carpenter',
  'Pipefitter',
  'Welder',
  'Ironworker',
  'Sheet Metal Worker',
  'Millwright',
  'Instrumentation Tech',
];

// Location options for dropdown (mock metros)
export const LOCATION_OPTIONS = [
  { label: 'Denver, CO', value: 'denver' },
  { label: 'Phoenix, AZ', value: 'phoenix' },
  { label: 'Los Angeles, CA', value: 'los-angeles' },
  { label: 'Houston, TX', value: 'houston' },
  { label: 'Las Vegas, NV', value: 'las-vegas' },
  { label: 'Seattle, WA', value: 'seattle' },
  { label: 'Austin, TX', value: 'austin' },
  { label: 'San Diego, CA', value: 'san-diego' },
];

// Distance options
export const DISTANCE_OPTIONS = [
  { label: '10 miles', value: 10 },
  { label: '25 miles', value: 25 },
  { label: '50 miles', value: 50 },
  { label: '100 miles', value: 100 },
];

// Generate a pool of 50 mock employees for search results
const FIRST_NAMES = [
  'Marcus', 'Sarah', 'Derek', 'Elena', 'James', 'Aisha', 'Michael', 'Linda', 'Robert', 'Christina',
  'Thomas', 'Jessica', 'David', 'Amanda', 'Kevin', 'Rachel', 'Brian', 'Nicole', 'Anthony', 'Maria',
  'William', 'Patricia', 'Steven', 'Laura', 'Daniel', 'Michelle', 'Joseph', 'Elizabeth', 'Charles', 'Jennifer',
  'Andrew', 'Sandra', 'Joshua', 'Ashley', 'Ryan', 'Kimberly', 'Brandon', 'Emily', 'Jason', 'Megan',
  'Justin', 'Samantha', 'Eric', 'Rebecca', 'Timothy', 'Heather', 'Aaron', 'Stephanie', 'Adam', 'Crystal',
];

const LAST_NAMES = [
  'Johnson', 'Chen', 'Williams', 'Rodriguez', 'O\'Brien', 'Patel', 'Torres', 'Nakamura', 'Kim', 'Alvarez',
  'Washington', 'Park', 'Martinez', 'Foster', 'Nguyen', 'Green', 'Lee', 'Harris', 'Blake', 'Santos',
  'Wright', 'Thompson', 'Garcia', 'Brown', 'Davis', 'Miller', 'Wilson', 'Moore', 'Taylor', 'Anderson',
  'Thomas', 'Jackson', 'White', 'Lewis', 'Robinson', 'Clark', 'Hall', 'Young', 'King', 'Scott',
  'Adams', 'Baker', 'Nelson', 'Hill', 'Campbell', 'Mitchell', 'Roberts', 'Carter', 'Phillips', 'Evans',
];

const CITIES = [
  { city: 'Denver', state: 'CO', zip: '80202' },
  { city: 'Aurora', state: 'CO', zip: '80012' },
  { city: 'Lakewood', state: 'CO', zip: '80226' },
  { city: 'Phoenix', state: 'AZ', zip: '85001' },
  { city: 'Scottsdale', state: 'AZ', zip: '85251' },
  { city: 'Mesa', state: 'AZ', zip: '85201' },
  { city: 'Los Angeles', state: 'CA', zip: '90001' },
  { city: 'Long Beach', state: 'CA', zip: '90802' },
  { city: 'Pasadena', state: 'CA', zip: '91101' },
  { city: 'Houston', state: 'TX', zip: '77001' },
  { city: 'Austin', state: 'TX', zip: '78701' },
  { city: 'San Antonio', state: 'TX', zip: '78201' },
  { city: 'Las Vegas', state: 'NV', zip: '89101' },
  { city: 'Henderson', state: 'NV', zip: '89002' },
  { city: 'Seattle', state: 'WA', zip: '98101' },
  { city: 'Tacoma', state: 'WA', zip: '98401' },
];

const CERTIFICATIONS = [
  'OSHA 10', 'OSHA 30', 'First Aid/CPR', 'Journeyman', 'Master', 
  'Apprentice', 'EPA 608', 'NATE', 'Forklift', 'Scissor Lift',
  'Fall Protection', 'Confined Space', 'Rigging', 'AWS Welding',
];

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomSubset<T>(arr: T[], min: number, max: number): T[] {
  const count = Math.floor(Math.random() * (max - min + 1)) + min;
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function generatePhone(): string {
  const area = Math.floor(Math.random() * 900) + 100;
  const prefix = Math.floor(Math.random() * 900) + 100;
  const line = Math.floor(Math.random() * 9000) + 1000;
  return `(${area}) ${prefix}-${line}`;
}

function generateEmployee(index: number): Employee {
  const firstName = randomElement(FIRST_NAMES);
  const lastName = randomElement(LAST_NAMES);
  const location = randomElement(CITIES);
  const statusOptions: EmployeeStatus[] = ['Active', 'Active', 'Active', 'Active', 'Inactive', 'Do Not Dispatch'];
  const availOptions: Employee['availability'][] = ['Available', 'Available', 'On Assignment', 'Unavailable'];
  
  // Generate a date between 2018 and 2025
  const hireYear = 2018 + Math.floor(Math.random() * 7);
  const hireMonth = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
  const hireDay = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
  
  const hasLastDispatch = Math.random() > 0.2;
  const lastDispatchYear = 2024 + Math.floor(Math.random() * 2);
  const lastDispatchMonth = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
  const lastDispatchDay = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');

  return {
    id: `EMP-${String(index + 1).padStart(5, '0')}`,
    firstName,
    lastName,
    phone: generatePhone(),
    email: `${firstName.toLowerCase()}.${lastName.toLowerCase().replace(/'/g, '')}@email.com`,
    trade: randomElement(TRADE_OPTIONS),
    status: randomElement(statusOptions),
    city: location.city,
    state: location.state,
    zipCode: location.zip,
    hireDate: `${hireYear}-${hireMonth}-${hireDay}`,
    lastDispatchDate: hasLastDispatch ? `${lastDispatchYear}-${lastDispatchMonth}-${lastDispatchDay}` : undefined,
    certifications: randomSubset(CERTIFICATIONS, 1, 5),
    availability: randomElement(availOptions),
  };
}

// Generate 50 mock employees
export const MOCK_EMPLOYEES: Employee[] = Array.from({ length: 50 }, (_, i) => generateEmployee(i));

// Search filter type
export type EmployeeSearchFilters = {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  trade?: string;
  status?: EmployeeStatus | '';
  location?: string;
  distance?: number;
};

// Mock search function (simulates filtering)
export function searchEmployees(filters: EmployeeSearchFilters): Employee[] {
  return MOCK_EMPLOYEES.filter(emp => {
    if (filters.firstName && !emp.firstName.toLowerCase().includes(filters.firstName.toLowerCase())) {
      return false;
    }
    if (filters.lastName && !emp.lastName.toLowerCase().includes(filters.lastName.toLowerCase())) {
      return false;
    }
    if (filters.phone && !emp.phone.includes(filters.phone)) {
      return false;
    }
    if (filters.email && !emp.email.toLowerCase().includes(filters.email.toLowerCase())) {
      return false;
    }
    if (filters.trade && emp.trade !== filters.trade) {
      return false;
    }
    if (filters.status && emp.status !== filters.status) {
      return false;
    }
    // Location filtering would be more complex IRL - just mock it
    if (filters.location) {
      const loc = LOCATION_OPTIONS.find(l => l.value === filters.location);
      if (loc) {
        const [city] = loc.label.split(',');
        // Simple mock: check if employee's city loosely matches
        if (!emp.city.toLowerCase().includes(city.toLowerCase().trim()) && 
            !emp.state.toLowerCase().includes(loc.label.split(',')[1]?.trim().toLowerCase() || '')) {
          return false;
        }
      }
    }
    return true;
  });
}

// Recent searches mock (simulates user's search history)
export type RecentSearch = {
  id: string;
  searchedAt: string;
  filters: EmployeeSearchFilters;
  resultCount: number;
  previewResults: Employee[];
};

// Generate mock recent searches
export const MOCK_RECENT_SEARCHES: RecentSearch[] = [
  {
    id: 'recent_1',
    searchedAt: '2026-01-29T14:30:00Z',
    filters: { trade: 'Electrician', status: 'Active' },
    resultCount: 12,
    previewResults: MOCK_EMPLOYEES.filter(e => e.trade === 'Electrician' && e.status === 'Active').slice(0, 5),
  },
  {
    id: 'recent_2',
    searchedAt: '2026-01-29T11:15:00Z',
    filters: { lastName: 'Johnson' },
    resultCount: 3,
    previewResults: MOCK_EMPLOYEES.filter(e => e.lastName.toLowerCase().includes('johnson')).slice(0, 5),
  },
  {
    id: 'recent_3',
    searchedAt: '2026-01-28T16:45:00Z',
    filters: { trade: 'Plumber', location: 'denver' },
    resultCount: 5,
    previewResults: MOCK_EMPLOYEES.filter(e => e.trade === 'Plumber').slice(0, 5),
  },
];

// Get recent results (combined from recent searches, capped at 25)
export function getRecentResults(): Employee[] {
  const seen = new Set<string>();
  const results: Employee[] = [];
  
  for (const search of MOCK_RECENT_SEARCHES) {
    for (const emp of search.previewResults) {
      if (!seen.has(emp.id) && results.length < 25) {
        seen.add(emp.id);
        results.push(emp);
      }
    }
  }
  
  return results;
}

