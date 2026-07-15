import { Employee } from './employee.types';
export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
}
export interface EmployeeAuthResponse extends AuthTokens {
    employee: Employee;
}
export interface AdminAuthResponse extends AuthTokens {
    admin: {
        id: string;
        name: string;
        email: string;
    };
}
export interface JwtPayload {
    sub: string;
    role: 'EMPLOYEE' | 'SITE_MANAGER' | 'ADMIN';
    iat?: number;
    exp?: number;
}
