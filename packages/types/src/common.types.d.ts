export interface ApiResponse<T> {
    success: boolean;
    data: T;
    timestamp: string;
}
export interface PaginatedResponse<T> {
    items: T[];
    nextCursor: string | null;
    total?: number;
}
export type Gender = 'MALE' | 'FEMALE' | 'OTHER';
export type Role = 'EMPLOYEE' | 'SITE_MANAGER' | 'ADMIN';
export type EmpStatus = 'ACTIVE' | 'DEACTIVATED';
export type SiteStatus = 'ACTIVE' | 'INACTIVE';
export type PunchType = 'IN' | 'OUT';
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type LeaveScope = 'ALL' | 'MALE_ONLY' | 'FEMALE_ONLY' | 'CUSTOM';
export type ApprovalMode = 'AUTO' | 'MANUAL';
export type AccrualType = 'MONTHLY' | 'ANNUAL';
