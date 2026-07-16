'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useState, useEffect } from 'react';
import { Save } from 'lucide-react';

const SETTING_LABELS: Record<string, string> = {
  company_name: 'Company Name',
  shift_start: 'Shift Start Time',
  shift_end: 'Shift End Time',
  grace_minutes: 'Grace Period (minutes)',
  half_day_cutoff: 'Half Day Cutoff',
  default_weekly_off: 'Weekly Off Day',
  require_photo: 'Require Photo',
  require_gps: 'Require GPS',
  min_gps_accuracy: 'Min GPS Accuracy (m, 0=any)',
  require_face_detection: 'Require Face Detection',
  allow_punch_on_camera_fail: 'Allow Punch if Camera Fails',
  missing_punchout_handling: 'Missing Punch-out Handling',
  auto_approve_normal: 'Auto-approve Normal Punches',
  bulk_approve_enabled: 'Enable Bulk Approve',
  photo_retention_days: 'Photo Retention (days)',
  punchin_reminder_enabled: 'Punch-in Reminder',
  punchout_reminder_buffer: 'Punch-out Reminder Buffer (min)',
  cl_days_per_month: 'Casual Leave Days/Month',
  fl_days_per_month: 'Female Leave Days/Month',
};

export default function SettingsPage() {
  const qc = useQueryClient();
  const [local, setLocal] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  const settingsQ = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get('/admin/settings').then(r => r.data.data as Record<string, string>),
  });

  useEffect(() => {
    if (settingsQ.data) setLocal(settingsQ.data);
  }, [settingsQ.data]);

  const save = useMutation({
    mutationFn: () => api.patch('/admin/settings', { settings: local }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['settings'] }); setSaved(true); setTimeout(() => setSaved(false), 2000); },
  });

  if (settingsQ.isLoading) return <div className="p-6 text-gray-400">Loading…</div>;

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-500 mt-0.5">Configure attendance rules and app behaviour</p>
        </div>
        <button onClick={() => save.mutate()} disabled={save.isPending}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          <Save size={15} />
          {saved ? 'Saved ✓' : save.isPending ? 'Saving…' : 'Save Changes'}
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
        {Object.entries(local).map(([key, value]) => (
          <div key={key} className="flex items-center justify-between px-5 py-3.5 gap-4">
            <label className="text-sm text-gray-700 font-medium min-w-0 shrink">
              {SETTING_LABELS[key] ?? key}
            </label>
            {value === 'true' || value === 'false' ? (
              <button
                onClick={() => setLocal(l => ({ ...l, [key]: l[key] === 'true' ? 'false' : 'true' }))}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 ${value === 'true' ? 'bg-blue-600' : 'bg-gray-200'}`}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${value === 'true' ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
            ) : (
              <input
                value={value}
                onChange={e => setLocal(l => ({ ...l, [key]: e.target.value }))}
                className="w-44 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500 shrink-0"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
