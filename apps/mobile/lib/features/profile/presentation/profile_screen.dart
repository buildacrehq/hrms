import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../data/profile_repository.dart';
import '../../auth/domain/auth_notifier.dart';

const _kGradient = LinearGradient(
  begin: Alignment.topLeft,
  end: Alignment.bottomRight,
  colors: [Color(0xFF1e3a8a), Color(0xFF1d4ed8), Color(0xFF1e40af)],
  stops: [0.0, 0.45, 1.0],
);

class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  Map<String, dynamic>? _employee;
  bool _loading = true;
  String? _error;

  late int _psYear;
  late int _psMonth;
  Map<String, dynamic>? _payslipData;
  bool _psLoading = false;
  bool _psExpanded = false;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    final lastMonth = DateTime(now.year, now.month - 1);
    _psYear  = lastMonth.year;
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
    } catch (_) {
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
    if (_psYear == now.year && _psMonth == now.month - 1) return;
    setState(() {
      if (_psMonth == 12) { _psMonth = 1; _psYear++; } else { _psMonth++; }
      _payslipData = null;
    });
    _loadPayslip();
  }

  _PayslipStats _computeStats(Map<String, dynamic> data, int year, int month) {
    final punches  = (data['punches']  as List?)?.cast<Map<String, dynamic>>() ?? [];
    final leaves   = (data['leaves']   as List?)?.cast<Map<String, dynamic>>() ?? [];
    final holidays = (data['holidays'] as List?)?.cast<Map<String, dynamic>>() ?? [];

    final lastDay = DateUtils.getDaysInMonth(year, month);
    var workingDays = 0;
    for (var d = 1; d <= lastDay; d++) {
      if (DateTime(year, month, d).weekday != DateTime.sunday) workingDays++;
    }
    final monthStart = '$year-${month.toString().padLeft(2,'0')}-01';
    final monthEnd   = '$year-${month.toString().padLeft(2,'0')}-${lastDay.toString().padLeft(2,'0')}';
    final holidayDates = <String>{};
    for (final h in holidays) {
      final ds = (h['date'] as String? ?? '').length >= 10 ? (h['date'] as String).substring(0, 10) : '';
      if (ds.compareTo(monthStart) >= 0 && ds.compareTo(monthEnd) <= 0) holidayDates.add(ds);
    }
    final presentDates = <String>{};
    for (final p in punches) {
      if (p['type'] == 'IN' && p['approvalStatus'] != 'REJECTED') {
        final ts = DateTime.tryParse(p['timestampServer'] as String? ?? '')?.toLocal();
        if (ts != null) {
          presentDates.add('${ts.year}-${ts.month.toString().padLeft(2,'0')}-${ts.day.toString().padLeft(2,'0')}');
        }
      }
    }
    var leaveDays = 0;
    for (final lr in leaves) {
      if (lr['status'] == 'APPROVED') {
        final start = (lr['fromDate'] ?? lr['startDate'] as String? ?? '').toString();
        final end   = (lr['toDate']   ?? lr['endDate']   as String? ?? '').toString();
        if (start.length < 10 || end.length < 10) continue;
        var cursor = DateTime.parse(start.substring(0, 10));
        final endDt = DateTime.parse(end.substring(0, 10));
        while (!cursor.isAfter(endDt)) {
          final ds = '${cursor.year}-${cursor.month.toString().padLeft(2,'0')}-${cursor.day.toString().padLeft(2,'0')}';
          if (ds.compareTo(monthStart) >= 0 && ds.compareTo(monthEnd) <= 0 && cursor.weekday != DateTime.sunday) leaveDays++;
          cursor = cursor.add(const Duration(days: 1));
        }
      }
    }
    final presentDays = presentDates.length;
    final holidayDays = holidayDates.length;
    final absentDays  = (workingDays - presentDays - leaveDays - holidayDays).clamp(0, workingDays);
    return _PayslipStats(workingDays: workingDays, presentDays: presentDays, leaveDays: leaveDays, holidayDays: holidayDays, absentDays: absentDays);
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final topPad = MediaQuery.of(context).padding.top;

    if (_loading) {
      return Scaffold(
        backgroundColor: const Color(0xFF1e3a8a),
        body: const Center(child: CircularProgressIndicator(color: Colors.white)),
      );
    }
    if (_error != null) {
      return Scaffold(
        body: Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(Icons.cloud_off, size: 48, color: cs.error),
          const SizedBox(height: 12),
          Text(_error!, textAlign: TextAlign.center),
          const SizedBox(height: 16),
          FilledButton(onPressed: _loadProfile, child: const Text('Retry')),
        ])),
      );
    }

    final emp         = _employee!;
    final name        = emp['name']        as String? ?? '—';
    final phone       = emp['phone']       as String? ?? '—';
    final designation = emp['designation'] as String? ?? '';
    final site        = (emp['defaultSite'] as Map<String, dynamic>?)?['name'] as String? ?? '';
    final dob         = emp['dob']         as String?;
    final gender      = emp['gender']      as String?;
    final initials    = name.trim().split(' ').map((w) => w.isNotEmpty ? w[0] : '').take(2).join().toUpperCase();

    return Scaffold(
      backgroundColor: cs.surface,
      body: AnnotatedRegion<SystemUiOverlayStyle>(
        value: const SystemUiOverlayStyle(
          statusBarColor: Colors.transparent,
          statusBarIconBrightness: Brightness.light,
        ),
        child: RefreshIndicator(
          onRefresh: _loadProfile,
          child: CustomScrollView(slivers: [
            // ── Gradient hero header ──────────────────────────────────────────
            SliverToBoxAdapter(child: Container(
              decoration: const BoxDecoration(gradient: _kGradient),
              padding: EdgeInsets.fromLTRB(20, topPad + 16, 20, 32),
              child: Column(children: [
                Row(mainAxisAlignment: MainAxisAlignment.end, children: [
                  IconButton(
                    icon: const Icon(Icons.refresh, color: Colors.white70, size: 20),
                    onPressed: _loadProfile,
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                  ),
                ]),
                const SizedBox(height: 8),
                // Avatar
                Container(
                  width: 80, height: 80,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: Colors.white.withAlpha(30),
                    border: Border.all(color: Colors.white.withAlpha(80), width: 2.5),
                  ),
                  child: Center(child: Text(
                    initials.isNotEmpty ? initials : '?',
                    style: const TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: Colors.white),
                  )),
                ),
                const SizedBox(height: 14),
                Text(name, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: Colors.white)),
                if (designation.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(designation, style: const TextStyle(fontSize: 13, color: Color(0xB3FFFFFF))),
                ],
                if (site.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.white.withAlpha(20),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: Colors.white.withAlpha(40)),
                    ),
                    child: Row(mainAxisSize: MainAxisSize.min, children: [
                      const Icon(Icons.location_on, size: 12, color: Color(0xB3FFFFFF)),
                      const SizedBox(width: 4),
                      Text(site, style: const TextStyle(fontSize: 12, color: Color(0xCCFFFFFF))),
                    ]),
                  ),
                ],
              ]),
            )),

            // ── Content ───────────────────────────────────────────────────────
            SliverToBoxAdapter(child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 20, 16, 40),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [

                // Contact info card
                _SectionCard(children: [
                  _InfoTile(icon: Icons.phone_outlined, label: 'Phone', value: '+91 $phone'),
                  if (gender != null && gender.isNotEmpty)
                    _InfoTile(icon: Icons.person_outline, label: 'Gender', value: _fmtGender(gender)),
                  if (dob != null && dob.isNotEmpty)
                    _InfoTile(icon: Icons.cake_outlined, label: 'Date of Birth', value: _fmtDate(dob), isLast: true),
                  if (dob == null || dob.isEmpty)
                    _InfoTile(icon: Icons.cake_outlined, label: 'Date of Birth', value: '—', isLast: true),
                ]),
                const SizedBox(height: 16),

                // Payslip section
                _PayslipCard(
                  year: _psYear, month: _psMonth,
                  expanded: _psExpanded, loading: _psLoading,
                  data: _payslipData, employee: emp,
                  onToggle: _togglePayslip,
                  onPrev: _prevPsMonth,
                  onNext: _nextPsMonth,
                  computeStats: _computeStats,
                ),
                const SizedBox(height: 20),

                // Sign out
                OutlinedButton.icon(
                  onPressed: () => ref.read(authNotifierProvider.notifier).logout(),
                  icon: const Icon(Icons.logout_rounded, color: Colors.red, size: 18),
                  label: const Text('Sign Out', style: TextStyle(color: Colors.red, fontWeight: FontWeight.w600)),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: Colors.red),
                    minimumSize: const Size(double.infinity, 50),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                ),
              ]),
            )),
          ]),
        ),
      ),
    );
  }

  String _fmtDate(String d) {
    try { return DateFormat('dd MMMM yyyy').format(DateTime.parse(d)); }
    catch (_) { return d.length >= 10 ? d.substring(0, 10) : d; }
  }

  String _fmtGender(String g) {
    return switch (g.toUpperCase()) {
      'MALE'   => 'Male',
      'FEMALE' => 'Female',
      'OTHER'  => 'Other',
      _        => g,
    };
  }
}

// ── Section card ─────────────────────────────────────────────────────────────

class _SectionCard extends StatelessWidget {
  const _SectionCard({required this.children});
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Container(
      decoration: BoxDecoration(
        color: cs.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: cs.outlineVariant),
      ),
      child: Column(children: children),
    );
  }
}

class _InfoTile extends StatelessWidget {
  const _InfoTile({required this.icon, required this.label, required this.value, this.isLast = false});
  final IconData icon;
  final String label;
  final String value;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Column(children: [
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
        child: Row(children: [
          Container(
            width: 34, height: 34,
            decoration: BoxDecoration(
              color: cs.primaryContainer.withAlpha(80),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, size: 16, color: cs.primary),
          ),
          const SizedBox(width: 12),
          Text(label, style: TextStyle(fontSize: 13, color: cs.onSurfaceVariant)),
          const Spacer(),
          Text(value, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
        ]),
      ),
      if (!isLast) Divider(height: 1, indent: 16, color: cs.outlineVariant),
    ]);
  }
}

// ── Payslip card ─────────────────────────────────────────────────────────────

class _PayslipCard extends StatelessWidget {
  const _PayslipCard({
    required this.year, required this.month,
    required this.expanded, required this.loading,
    required this.data, required this.employee,
    required this.onToggle, required this.onPrev, required this.onNext,
    required this.computeStats,
  });
  final int year, month;
  final bool expanded, loading;
  final Map<String, dynamic>? data;
  final Map<String, dynamic> employee;
  final VoidCallback onToggle, onPrev, onNext;
  final _PayslipStats Function(Map<String, dynamic>, int, int) computeStats;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final now = DateTime.now();
    final canForward = !(year == now.year && month == now.month - 1);
    final monthLabel = DateFormat('MMMM yyyy').format(DateTime(year, month));

    return Container(
      decoration: BoxDecoration(
        color: cs.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: cs.outlineVariant),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        InkWell(
          onTap: onToggle,
          borderRadius: BorderRadius.circular(16),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: Row(children: [
              Container(
                width: 34, height: 34,
                decoration: BoxDecoration(
                  color: cs.primaryContainer.withAlpha(80),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(Icons.receipt_long_outlined, size: 16, color: cs.primary),
              ),
              const SizedBox(width: 12),
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
              IconButton(icon: const Icon(Icons.chevron_left, size: 20), onPressed: loading ? null : onPrev),
              Expanded(child: Text(monthLabel, textAlign: TextAlign.center,
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14))),
              IconButton(
                icon: Icon(Icons.chevron_right, size: 20, color: canForward ? null : cs.onSurface.withAlpha(50)),
                onPressed: (loading || !canForward) ? null : onNext,
              ),
            ]),
          ),
          if (loading)
            const Padding(padding: EdgeInsets.all(28), child: Center(child: CircularProgressIndicator()))
          else if (data != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
              child: Builder(builder: (ctx) {
                final stats = computeStats(data!, year, month);
                final salary = (employee['salary'] as num?)?.toDouble();
                final net = salary != null && stats.workingDays > 0
                    ? salary * (stats.presentDays + stats.leaveDays + stats.holidayDays) / stats.workingDays
                    : null;
                return Column(children: [
                  // Stats row
                  Row(children: [
                    _PsChip(label: 'Working', value: stats.workingDays, color: Colors.blue),
                    const SizedBox(width: 8),
                    _PsChip(label: 'Present', value: stats.presentDays, color: Colors.green),
                    const SizedBox(width: 8),
                    _PsChip(label: 'Absent', value: stats.absentDays, color: Colors.red),
                  ]),
                  const SizedBox(height: 8),
                  Row(children: [
                    _PsChip(label: 'Leaves', value: stats.leaveDays, color: Colors.orange),
                    const SizedBox(width: 8),
                    _PsChip(label: 'Holidays', value: stats.holidayDays, color: Colors.purple),
                    const Spacer(),
                  ]),
                  if (salary != null) ...[
                    const SizedBox(height: 14),
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFF1e3a8a), Color(0xFF1d4ed8)],
                        ),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(children: [
                        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          const Text('Gross Salary', style: TextStyle(fontSize: 11, color: Color(0xB3FFFFFF))),
                          Text('₹ ${NumberFormat('#,##,##0', 'en_IN').format(salary)}',
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Colors.white)),
                        ])),
                        if (net != null) ...[
                          Container(width: 1, height: 36, color: Colors.white24),
                          const SizedBox(width: 14),
                          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            const Text('Net Payable', style: TextStyle(fontSize: 11, color: Color(0xB3FFFFFF))),
                            Text('₹ ${NumberFormat('#,##,##0', 'en_IN').format(net.roundToDouble())}',
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Color(0xFF86efac))),
                          ])),
                        ],
                      ]),
                    ),
                  ],
                ]);
              }),
            ),
        ],
      ]),
    );
  }
}

class _PsChip extends StatelessWidget {
  const _PsChip({required this.label, required this.value, required this.color});
  final String label;
  final int value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: color.withAlpha(18),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.withAlpha(50)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('$value', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: color, height: 1)),
        const SizedBox(height: 2),
        Text(label, style: TextStyle(fontSize: 10, color: color.withAlpha(180))),
      ]),
    );
  }
}

// ── Model ─────────────────────────────────────────────────────────────────────

class _PayslipStats {
  const _PayslipStats({required this.workingDays, required this.presentDays, required this.leaveDays, required this.holidayDays, required this.absentDays});
  final int workingDays, presentDays, leaveDays, holidayDays, absentDays;
}
