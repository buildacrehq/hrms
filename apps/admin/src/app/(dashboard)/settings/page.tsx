'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useState, useEffect } from 'react';
import { Building2, Clock, ShieldCheck, Camera, Bell, CalendarDays, Save, CheckCircle2 } from 'lucide-react';

type LocalSettings = Record<string, string>;

const SECTIONS = [
  {
    id: 'company',
    label: 'Company',
    icon: Building2,
    description: 'Basic company information',
    keys: ['company_name'],
  },
  {
    id: 'shift',
    label: 'Shift & Timing',
    icon: Clock,
    description: 'Configure work hours and attendance thresholds',
    keys: ['shift_start', 'shift_end', 'grace_minutes', 'half_day_cutoff', 'default_weekly_off'],
  },
  {
    id: 'attendance',
    label: 'Attendance Rules',
    icon: ShieldCheck,
    description: 'Approval flow and punch handling',
    keys: ['missing_punchout_handling', 'auto_approve_normal', 'bulk_approve_enabled'],
  },
  {
    id: 'photo_gps',
    label: 'Photo & GPS',
    icon: Camera,
    description: 'Face detection, location and photo requirements',
    keys: ['require_photo', 'require_gps', 'min_gps_accuracy', 'require_face_detection', 'allow_punch_on_camera_fail', 'photo_retention_days'],
  },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: Bell,
    description: 'Reminders sent to employees',
    keys: ['punchin_reminder_enabled', 'punchout_reminder_buffer'],
  },
  {
    id: 'leave',
    label: 'Leave Policy',
    icon: CalendarDays,
    description: 'Monthly leave entitlements',
    keys: ['cl_days_per_month', 'fl_days_per_month'],
  },
] as const;

const LABELS: Record<string, string> = {
  company_name:               'Company Name',
  shift_start:                'Shift Start Time',
  shift_end:                  'Shift End Time',
  grace_minutes:              'Grace Period (minutes)',
  half_day_cutoff:            'Half-Day Cutoff (hours)',
  default_weekly_off:         'Weekly Off Day',
  require_photo:              'Require Photo on Punch',
  require_gps:                'Require GPS Location',
  min_gps_accuracy:           'Min GPS Accuracy (m, 0 = any)',
  require_face_detection:     'Require Face Detection',
  allow_punch_on_camera_fail: 'Allow Punch if Camera Fails',
  missing_punchout_handling:  'Missing Punch-out Handling',
  auto_approve_normal:        'Auto-approve Normal Punches',
  bulk_approve_enabled:       'Enable Bulk Approve',
  photo_retention_days:       'Photo Retention (days)',
  punchin_reminder_enabled:   'Punch-in Reminder',
  punchout_reminder_buffer:   'Punch-out Reminder Buffer (min)',
  cl_days_per_month:          'Casual Leave Days / Month',
  fl_days_per_month:          'Female Leave Days / Month',
};

const HINTS: Record<string, string> = {
  grace_minutes:              'Punches within this window after shift start count as on-time',
  min_gps_accuracy:           'Set 0 to accept any accuracy',
  half_day_cutoff:            'Minimum hours worked to count as a full day',
  photo_retention_days:       'Photos are deleted after this many days; punch records are kept',
  punchout_reminder_buffer:   'Minutes before shift end to send reminder',
  missing_punchout_handling:  'What to do when an employee forgets to punch out',
  auto_approve_normal:        'Automatically approve punches that fall within normal hours',
};

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!value)}
      className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      style={{ background: value ? '#2563eb' : '#e2e8f0' }}
    >
      <span className="inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow transition-transform duration-200"
        style={{ transform: value ? 'translateX(22px)' : 'translateX(3px)', width: 18, height: 18, display: 'inline-block' }} />
    </button>
  );
}

export default function SettingsPage() {
  const qc = useQueryClient();
  const [local, setLocal]       = useState<LocalSettings>({});
  const [savedId, setSavedId]   = useState<string | null>(null);

  const settingsQ = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get('/admin/settings').then(r => r.data.data as LocalSettings),
  });

  useEffect(() => {
    if (settingsQ.data) setLocal(settingsQ.data);
  }, [settingsQ.data]);

  const save = useMutation({
    mutationFn: (sectionId: string) => api.patch('/admin/settings', { settings: local }),
    onSuccess: (_d, sectionId) => {
      qc.invalidateQueries({ queryKey: ['settings'] });
      setSavedId(sectionId);
      setTimeout(() => setSavedId(null), 2500);
    },
  });

  const set = (key: string, val: string) => setLocal(l => ({ ...l, [key]: val }));

  if (settingsQ.isLoading) {
    return (
      <div className="min-h-full bg-slate-50 flex items-center justify-center">
        <p className="text-slate-400 text-sm">Loading settings…</p>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-8 py-5">
        <h1 className="text-xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">Configure attendance rules and app behaviour</p>
      </div>

      <div className="px-8 py-6 max-w-3xl space-y-5">
        {SECTIONS.map(section => {
          const { id, label, icon: Icon, description, keys } = section;
          const sectionKeys = keys.filter(k => k in local);
          if (sectionKeys.length === 0) return null;
          const isSaved   = savedId === id;
          const isPending = save.isPending && save.variables === id;

          return (
            <div key={id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              {/* Section header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                    <Icon size={16} />
                  </div>
                  <div>
                    <h2 className="font-semibold text-slate-900 text-sm">{label}</h2>
                    <p className="text-xs text-slate-400 mt-0.5">{description}</p>
                  </div>
                </div>
                <button
                  onClick={() => save.mutate(id)}
                  disabled={isPending}
                  className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-xl transition-all"
                  style={{
                    background: isSaved ? '#f0fdf4' : '#2563eb',
                    color: isSaved ? '#16a34a' : '#fff',
                    opacity: isPending ? 0.6 : 1,
                  }}
                >
                  {isSaved
                    ? <><CheckCircle2 size={14} /> Saved</>
                    : isPending
                    ? 'Saving…'
                    : <><Save size={14} /> Save</>}
                </button>
              </div>

              {/* Fields */}
              <div className="divide-y divide-slate-50">
                {sectionKeys.map(key => {
                  const val   = local[key] ?? '';
                  const isBool = val === 'true' || val === 'false';
                  return (
                    <div key={key} className="flex items-center gap-6 px-6 py-4">
                      <div className="flex-1 min-w-0">
                        <label className="block text-sm font-medium text-slate-800">{LABELS[key] ?? key}</label>
                        {HINTS[key] && <p className="text-xs text-slate-400 mt-0.5">{HINTS[key]}</p>}
                      </div>
                      {isBool ? (
                        <Toggle value={val === 'true'} onChange={v => set(key, v ? 'true' : 'false')} />
                      ) : (
                        <input
                          value={val}
                          onChange={e => set(key, e.target.value)}
                          className="w-48 border border-slate-200 rounded-xl px-3 py-2 text-sm text-right text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
