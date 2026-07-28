-- AlterEnum
ALTER TYPE "AccrualType" ADD VALUE 'MANUAL';

-- AlterTable: Add monthlyExpiry to LeaveType
ALTER TABLE "LeaveType" ADD COLUMN "monthlyExpiry" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: Add weeklyOff to Employee (0=Sun, 1=Mon, ..., 6=Sat)
ALTER TABLE "Employee" ADD COLUMN "weeklyOff" INTEGER NOT NULL DEFAULT 0;
