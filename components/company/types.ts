export interface CompanyRecord {
  id: string;
  name: string;
  websiteUrl?: string | null;
  phone?: string | null;
  lifecycleStatus?: string | null;
  registrySalespersonId?: string | null;
  registrySalesperson?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
  } | null;
  locations?: LocationRecord[];
  contacts?: ContactRecord[];
  createdAt?: string;
  updatedAt?: string;
}

export interface LocationRecord {
  id: string;
  name?: string | null;
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
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

export type DrawerTab = 'overview' | 'contacts' | 'activity';
