/**
 * Seed: populates the database with the minimal data required for a fresh launch.
 * Run with:  pnpm api:seed   (from monorepo root)
 *        or: pnpm db:seed    (from apps/api)
 *
 * Safe to re-run — every upsert is idempotent.
 * Change the default admin password before any real deployment.
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // ── Settings ────────────────────────────────────────────────────────────────
  // Every value here is editable by Admin at runtime via the Settings screen.
  // Keys are stable contracts between the DB and SettingsService — don't rename.
  const settings: { key: string; value: string }[] = [
    // Shift
    { key: 'shift_start', value: '10:00' },
    { key: 'grace_minutes', value: '15' },
    { key: 'half_day_cutoff', value: '12:00' },
    { key: 'shift_end', value: '18:00' },
    // Punch rules
    { key: 'require_photo', value: 'true' },
    { key: 'require_gps', value: 'true' },
    { key: 'min_gps_accuracy', value: '0' },              // 0 = accept any accuracy
    { key: 'allow_punch_on_camera_fail', value: 'true' },  // punch flagged, not blocked
    { key: 'require_face_detection', value: 'true' },      // block punch if no face detected
    { key: 'missing_punchout_handling', value: 'flag' },   // flag | autoclose | stayopen
    // Approvals
    { key: 'bulk_approve_enabled', value: 'true' },
    { key: 'auto_approve_normal', value: 'false' },        // Option 1 (manual) per spec
    // Notifications
    { key: 'punchout_reminder_buffer', value: '15' },      // minutes after shift_end: 15 or 60
    { key: 'punchin_reminder_enabled', value: 'false' },
    // Leave
    { key: 'cl_days_per_month', value: '1' },
    { key: 'fl_days_per_month', value: '1' },
    // Data / Compliance
    { key: 'photo_retention_days', value: '730' },         // ~2 years
    // Display
    { key: 'company_name', value: 'Buildacre' },
    { key: 'default_weekly_off', value: 'SUNDAY' },        // day name
  ];

  for (const s of settings) {
    await prisma.setting.upsert({
      where: { key: s.key },
      update: {},           // don't overwrite values admin may have already changed
      create: s,
    });
  }
  console.log(`✓ Settings seeded (${settings.length} keys)`);

  // ── Leave types ─────────────────────────────────────────────────────────────
  await prisma.leaveType.upsert({
    where: { id: 'lt-casual' },
    update: {},
    create: {
      id: 'lt-casual',
      name: 'Casual Leave',
      daysEntitled: 1,
      scope: 'ALL',
      paid: true,
      carryForward: false,
      eligibilityMinMonths: 0,
      approvalMode: 'MANUAL',
      accrual: 'MONTHLY',
    },
  });

  await prisma.leaveType.upsert({
    where: { id: 'lt-female' },
    update: {},
    create: {
      id: 'lt-female',
      name: 'Female Leave',
      daysEntitled: 1,
      scope: 'FEMALE_ONLY',
      paid: true,
      carryForward: false,
      eligibilityMinMonths: 0,
      approvalMode: 'MANUAL',
      accrual: 'MONTHLY',
    },
  });
  console.log('✓ Leave types seeded (Casual Leave, Female Leave)');

  // ── Default admin account ───────────────────────────────────────────────────
  // IMPORTANT: change this password before any real deployment.
  const defaultPassword = 'Admin@123';
  const passwordHash = await bcrypt.hash(defaultPassword, 12);

  const admin = await prisma.admin.upsert({
    where: { email: 'admin@buildacre.com' },
    update: {},
    create: {
      name: 'Buildacre Admin',
      email: 'admin@buildacre.com',
      passwordHash,
    },
  });
  console.log(`✓ Admin seeded  →  email: ${admin.email}  password: ${defaultPassword}`);

  // ── Sample site ─────────────────────────────────────────────────────────────
  const site = await prisma.site.upsert({
    where: { id: 'site-main' },
    update: {},
    create: {
      id: 'site-main',
      name: 'Main Site',
      address: 'Bangalore, Karnataka',
    },
  });
  console.log(`✓ Site seeded   →  ${site.name}`);

  console.log('\n✅  Database seeded successfully.\n');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
