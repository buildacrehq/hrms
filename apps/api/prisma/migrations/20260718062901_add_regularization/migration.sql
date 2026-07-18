-- CreateEnum
CREATE TYPE "RegType" AS ENUM ('PUNCH_IN', 'PUNCH_OUT', 'BOTH');

-- CreateTable
CREATE TABLE "Regularization" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "requestType" "RegType" NOT NULL,
    "punchInTime" TEXT,
    "punchOutTime" TEXT,
    "reason" TEXT NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Regularization_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Regularization_employeeId_idx" ON "Regularization"("employeeId");

-- CreateIndex
CREATE INDEX "Regularization_status_idx" ON "Regularization"("status");

-- CreateIndex
CREATE INDEX "Regularization_date_idx" ON "Regularization"("date");

-- AddForeignKey
ALTER TABLE "Regularization" ADD CONSTRAINT "Regularization_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
