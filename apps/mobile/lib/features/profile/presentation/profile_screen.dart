import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../data/profile_repository.dart';
import '../../auth/domain/auth_notifier.dart';

class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  Map<String, dynamic>? _employee;
  bool _loading = true;
  String? _error;

  // Payslip state
  late int _psYear;
  late int _psMonth; // 1-indexed
  Map<String, dynamic>? _payslipData;
  bool _psLoading = false;
  bool _psExpanded = false;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    // Default to last month (current month is not yet complete)
    final lastMonth = DateTime(now.year, now.month - 1);
    _psYear = lastMonth.year;
    _psMonth = lastMonth.month;
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    setState(() { _loading = true; _error = null; });
    try {
      final emp = await ref.read(profileRepositoryProvider).getMyProfile();
      if (!mounted) return;
      setState(() { _employee = emp; _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _error = e.toString(); _loading = false; });
    }
  }

  Future<void> _loadPayslip() async {
    setState(() => _psLoading = true);
    try {
      final data = await ref.read(profileRepositoryProvider).getPayslipData(_psYear, _psMonth);
      if (!mounted) return;
      setState(() { _payslipData = data; _psLoading = false; });
    } catch (e) {
      if (mounted) setState(() => _psLoading = false);
    }
  }

  void _togglePayslip() {
    setState(() => _psExpanded = !_psExpanded);
    if (_psExpanded && _payslipData == null) _loadPayslip();
  }

  void _prevPsMonth() {
    setState(() {
      if (_psMonth == 1) { _psMonth = 12; _psYear--; } else { _psMonth--; }
      _payslipData = null;
    });
    _loadPayslip();
  }

  void _nextPsMonth() {
    final now = DateTime.now();
    final canGoForward = !(_psYear == now.year && _psMonth == now.month - 1);
    if (!canGoForward) return;
    setState(() {
      if (_psMonth == 12) { _psMonth = 1; _psYear++; } else { _psMonth++; }
      _payslipData = null;
    });
    _loadPayslip();
  }

  // Payslip calculations
  _PayslipStats _computeStats(Map<String, dynamic> data, int year, int month) {
    final punches = (data['punches'] as List?)?.cast<Map<String, dynamic>>() ?? [];
    final leaves  = (data['leaves']  as List?)?.cast<Map<String, dynamic>>() ?? [];
    final holidays = (data['holidays'] as List?)?.cast<Map<String, dynamic>>() ?? [];

    // Working days = days in month excluding Sundays
    final lastDay = DateUtils.getDaysInMonth(year, month);
    var workingDays = 0;
    for (var d = 1; d <= lastDay; d++) {
      if (DateTime(year, month, d).weekday != DateTime.sunday) workingDays++;
    }

    // Holidays in this month
    final monthStart = '$year-${month.toString().padLeft(2, '0')}-01';
    final monthEnd = '$year-${month.toString().padLeft(2, '0')}-${lastDay.toString().padLeft(2, '0')}';
    final holidayDates = <String>{};
    for (final h in holidays) {
      final ds = (h['date'] as String? ?? '').length >= 10 ? (h['date'] as String).substring(0, 10) : '';
      if (ds.compareTo(monthStart) >= 0 && ds.compareTo(monthEnd) <= 0) holidayDates.add(ds);
    }

    // Present days (non-rejected IN punches)
    final presentDates = <String>{};
    for (final p in punches) {
      if (p['type'] == 'IN' && p['approvalStatus'] != 'REJECTED') {
        final ts = DateTime.tryParse(p['timestampServer'] as String? ?? '')?.toLocal();
        if (ts != null) {
          presentDates.add('${ts.year}-${ts.month.toString().padLeft(2, '0')}-${ts.day.toString().padLeft(2, '0')}');
        }
      }
    }

    // Leave days (approved leaves overlapping this month)
    var leaveDays = 0;
    for (final lr in leaves) {
      if (lr['status'] == 'APPROVED') {
        final start = (lr['startDate'] as String? ?? '').length >= 10 ? (lr['startDate'] as String).substring(0, 10) : '';
        final end   = (lr['endDate']   as String? ?? '').length >= 10 ? (lr['endDate']   as String).substring(0, 10) : '';
        if (start.isEmpty || end.isEmpty) continue;
        var cursor = DateTime.parse(start);
        final endDt = DateTime.parse(end);
        while (!cursor.isAfter(endDt)) {
          final ds = '${cursor.year}-${cursor.month.toString().padLeft(2, '0')}-${cursor.day.toString().padLeft(2, '0')}';
          if (ds.compareTo(monthStart) >= 0 && ds.compareTo(monthEnd) <= 0 && cursor.weekday != DateTime.sunday) {
            leaveDays++;
          }
          cursor = cursor.add(const Duration(days: 1));
        }
      }
    }

    final presentDays = presentDates.length;
    final holidayDays = holidayDates.length;
    final absentDays  = (workingDays - presentDays - leaveDays - holidayDays).clamp(0, workingDays);

    return _PayslipStats(
      workingDays: workingDays,
      presentDays: presentDays,
      leaveDays: leaveDays,
      holidayDays: holidayDays,
      absentDays: absentDays,
    );
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(
        surfaceTintColor: Colors.transparent,
        title: const Text('Profile', style: TextStyle(fontWeight: FontWeight.bold)),
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _loadProfile),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
                  Icon(Icons.cloud_off, size: 48, color: cs.error),
                  const SizedBox(height: 12),
                  Text(_error!, textAlign: TextAlign.center),
                  const SizedBox(height: 16),
                  FilledButton(onPressed: _loadProfile, child: const Text('Retry')),
                ]))
              : RefreshIndicator(
                  onRefresh: _loadProfile,
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
                    children: [
                      _ProfileCard(employee: _employee!),
                      const SizedBox(height: 16),
                      _PayslipSection(
                        employee: _employee!,
                        year: _psYear,
                        month: _psMonth,
                        expanded: _psExpanded,
                        loading: _psLoading,
                        data: _payslipData,
                        onToggle: _togglePayslip,
                        onPrev: _prevPsMonth,
                        onNext: _nextPsMonth,
                        computeStats: _computeStats,
                      ),
                      const SizedBox(height: 16),
                      _SignOutButton(onPressed: () => ref.read(authNotifierProvider.notifier).logout()),
                    ],
                  ),
                ),
    );
  }
}

// ── Profile card ─────────────────────────────────────────────────────────────

class _ProfileCard extends StatelessWidget {
  const _ProfileCard({required this.employee});
  final Map<String, dynamic> employee;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final name = employee['name'] as String? ?? '—';
    final phone = employee['phone'] as String? ?? '—';
    final designation = employee['designation'] as String? ?? '';
    final site = (employee['defaultSite'] as Map<String, dynamic>?)?['name'] as String? ?? '—';
    final initials = name.trim().split(' ').map((w) => w.isNotEmpty ? w[0] : '').take(2).join().toUpperCase();
    final dob = employee['dob'] as String?;
    final gender = employee['gender'] as String?;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: cs.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: cs.outlineVariant),
      ),
      child: Column(children: [
        CircleAvatar(
          radius: 36,
          backgroundColor: cs.primaryContainer,
          child: Text(initials.isNotEmpty ? initials : '?',
              style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: cs.onPrimaryContainer)),
        ),
        const SizedBox(height: 12),
        Text(name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
        if (designation.isNotEmpty)
          Text(designation, style: TextStyle(color: cs.onSurfaceVariant, fontSize: 13)),
        const SizedBox(height: 16),
        const Divider(),
        const SizedBox(height: 8),
        _InfoRow(Icons.phone_outlined, 'Phone', '+91 $phone'),
        _InfoRow(Icons.location_on_outlined, 'Site', site),
        if (dob != null && dob.isNotEmpty)
          _InfoRow(Icons.cake_outlined, 'Date of Birth', _fmtDate(dob)),
        if (gender != null && gender.isNotEmpty)
          _InfoRow(Icons.person_outline, 'Gender', gender),
      ]),
    );
  }

  String _fmtDate(String d) {
    try {
      return DateFormat('dd MMMM yyyy').format(DateTime.parse(d));
    } catch (_) {
      return d.length >= 10 ? d.substring(0, 10) : d;
    }
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow(this.icon, this.label, this.value);
  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(children: [
        Icon(icon, size: 16, color: cs.onSurfaceVariant),
        const SizedBox(width: 10),
        Text(label, style: TextStyle(fontSize: 13, color: cs.onSurfaceVariant)),
        const Spacer(),
        Text(value, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
      ]),
    );
  }
}

// ── Payslip section ───────────────────────────────────────────────────────────

class _PayslipSection extends StatelessWidget {
  const _PayslipSection({
    required this.employee,
    required this.year,
    required this.month,
    required this.expanded,
    required this.loading,
    required this.data,
    required this.onToggle,
    required this.onPrev,
    required this.onNext,
    required this.computeStats,
  });
  final Map<String, dynamic> employee;
  final int year;
  final int month;
  final bool expanded;
  final bool loading;
  final Map<String, dynamic>? data;
  final VoidCallback onToggle;
  final VoidCallback onPrev;
  final VoidCallback onNext;
  final _PayslipStats Function(Map<String, dynamic>, int, int) computeStats;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final monthLabel = DateFormat('MMMM yyyy').format(DateTime(year, month));
    final now = DateTime.now();
    final canGoForward = !(year == now.year && month == now.month - 1);

    return Container(
      decoration: BoxDecoration(
        color: cs.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: cs.outlineVariant),
      ),
      child: Column(children: [
        // Header
        InkWell(
          onTap: onToggle,
          borderRadius: BorderRadius.circular(16),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: Row(children: [
              Icon(Icons.receipt_long_outlined, color: cs.primary, size: 20),
              const SizedBox(width: 10),
              const Text('Payslip', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
              const Spacer(),
              AnimatedRotation(
                turns: expanded ? 0.25 : 0,
                duration: const Duration(milliseconds: 200),
                child: Icon(Icons.chevron_right, color: cs.onSurfaceVariant),
              ),
            ]),
          ),
        ),

        if (expanded) ...[
          Divider(height: 1, color: cs.outlineVariant),

          // Month picker
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            child: Row(children: [
              IconButton(icon: const Icon(Icons.chevron_left), onPressed: loading ? null : onPrev),
              Expanded(child: Text(monthLabel, textAlign: TextAlign.center,
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15))),
              IconButton(
                icon: Icon(Icons.chevron_right, color: canGoForward ? null : cs.onSurface.withAlpha(60)),
                onPressed: (loading || !canGoForward) ? null : onNext,
              ),
            ]),
          ),

          if (loading)
            const Padding(padding: EdgeInsets.all(32), child: CircularProgressIndicator())
          else if (data != null) ...[
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
              child: Builder(builder: (ctx) {
                final stats = computeStats(data!, year, month);
                final salary = (employee['salary'] as num?)?.toDouble();
                final netSalary = salary != null && stats.workingDays > 0
                    ? salary * (stats.presentDays + stats.leaveDays + stats.holidayDays) / stats.workingDays
                    : null;

                return Column(children: [
                  _StatsGrid(stats: stats),
                  if (salary != null) ...[
                    const SizedBox(height: 16),
                    _SalaryCard(gross: salary, net: netSalary),
                  ],
                ]);
              }),
            ),
          ],
        ],
      ]),
    );
  }
}

class _StatsGrid extends StatelessWidget {
  const _StatsGrid({required this.stats});
  final _PayslipStats stats;

  @override
  Widget build(BuildContext context) {
    final items = [
      ('Working Days', stats.workingDays, Colors.blue),
      ('Present', stats.presentDays, Colors.green),
      ('Absent', stats.absentDays, Colors.red),
      ('Holidays', stats.holidayDays, Colors.purple),
      ('Leaves', stats.leaveDays, Colors.orange),
    ];
    return GridView.count(
      crossAxisCount: 3,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisSpacing: 10,
      mainAxisSpacing: 10,
      childAspectRatio: 1.3,
      children: items.map((item) => _StatCell(label: item.$1, value: item.$2, color: item.$3)).toList(),
    );
  }
}

class _StatCell extends StatelessWidget {
  const _StatCell({required this.label, required this.value, required this.color});
  final String label;
  final int value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: color.withAlpha(15),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.withAlpha(60)),
      ),
      child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        Text('$value', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: color)),
        const SizedBox(height: 2),
        Text(label, style: TextStyle(fontSize: 10, color: color.withAlpha(180)), textAlign: TextAlign.center),
      ]),
    );
  }
}

class _SalaryCard extends StatelessWidget {
  const _SalaryCard({required this.gross, required this.net});
  final double gross;
  final double? net;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final fmt = NumberFormat('#,##,##0', 'en_IN');
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: cs.primaryContainer.withAlpha(60),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(children: [
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Gross Salary', style: TextStyle(fontSize: 12, color: cs.onSurfaceVariant)),
          Text('₹ ${fmt.format(gross)}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
        ])),
        if (net != null) ...[
          Container(width: 1, height: 36, color: cs.outlineVariant),
          const SizedBox(width: 16),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Net Payable', style: TextStyle(fontSize: 12, color: cs.onSurfaceVariant)),
            Text('₹ ${fmt.format(net!.roundToDouble())}',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: cs.primary)),
          ])),
        ],
      ]),
    );
  }
}

// ── Sign out ──────────────────────────────────────────────────────────────────

class _SignOutButton extends StatelessWidget {
  const _SignOutButton({required this.onPressed});
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return OutlinedButton.icon(
      onPressed: onPressed,
      icon: const Icon(Icons.logout_rounded, color: Colors.red),
      label: const Text('Sign Out', style: TextStyle(color: Colors.red)),
      style: OutlinedButton.styleFrom(
        side: const BorderSide(color: Colors.red),
        minimumSize: const Size(double.infinity, 50),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }
}

// ── Stats model ───────────────────────────────────────────────────────────────

class _PayslipStats {
  const _PayslipStats({
    required this.workingDays,
    required this.presentDays,
    required this.leaveDays,
    required this.holidayDays,
    required this.absentDays,
  });
  final int workingDays;
  final int presentDays;
  final int leaveDays;
  final int holidayDays;
  final int absentDays;
}
