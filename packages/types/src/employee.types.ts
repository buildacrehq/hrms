import { Gender, Role, EmpStatus, SiteStatus } from './common.types';

export interface Employee {
  id: string;
  name: string;
  gender: Gender;
  phone: string;
  role: Role;
  defaultSiteId: string | null;
  status: EmpStatus;
  joinedAt: string;
  exitedAt: string | null;
  consentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeWithSite extends Employee {
  defaultSite: Site | null;
}

export interface Site {
  id: string;
  name: string;
  address: string | null;
  status: SiteStatus;
  createdAt: string;
  updatedAt: string;
}
