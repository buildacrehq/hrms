import { LeaveScope, ApprovalMode, AccrualType, ApprovalStatus } from './common.types';
export interface LeaveType {
    id: string;
    name: string;
    daysEntitled: number;
    scope: LeaveScope;
    paid: boolean;
    carryForward: boolean;
    eligibilityMinMonths: number;
    approvalMode: ApprovalMode;
    maxConsecutiveDays: number | null;
    accrual: AccrualType;
    createdAt: string;
    updatedAt: string;
}
export interface LeaveRequest {
    id: string;
    employeeId: string;
    leaveTypeId: string;
    fromDate: string;
    toDate: string;
    reason: string | null;
    status: ApprovalStatus;
    approvedById: string | null;
    approvedAt: string | null;
    rejectionReason: string | null;
    createdAt: string;
    updatedAt: string;
}
