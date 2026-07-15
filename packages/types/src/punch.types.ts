import { PunchType, ApprovalStatus } from './common.types';

export interface Punch {
  id: string;
  employeeId: string;
  siteId: string;
  type: PunchType;
  timestampServer: string;
  timestampDevice: string;
  lat: number;
  long: number;
  accuracy: number;
  photoKey: string;
  approvalStatus: ApprovalStatus;
  approvedById: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  syncedOffline: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PunchSummary {
  workingDays: number;
  presentDays: number;
  lateDays: number;
  halfDays: number;
  absentDays: number;
  totalHoursWorked: number;
}
