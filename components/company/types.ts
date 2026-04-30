export interface CompanyRecord {
  id: string;
  name: string;
  phone?: string | null;
  website?: string | null;
  street?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  country?: string | null;
  domain?: string | null;
  primaryIndustry?: string | null;
  lifecycleStatus?: string | null;
  ownerSalespersonName?: string | null;
  registrySalesperson?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    fullName?: string | null;
    email?: string | null;
  } | null;
  contacts?: ContactRecord[];
}

export interface ContactRecord {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  jobTitle?: string | null;
  email?: string | null;
  officePhone?: string | null;
  cellPhone?: string | null;
}

export type DrawerTab = 'overview' | 'contacts';
