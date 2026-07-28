import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../data/punch_repository.dart';

// ─── Data model ───────────────────────────────────────────────────────────────

class _DayGroup {
  _DayGroup({required this.dateStr, required this.punches}) {
    date = DateTime.parse(dateStr);

    final inPs = punches.where((p) => p['type'] == 'IN').toList()
      ..sort((a, b) => (a['timestampServer'] as String).compareTo(b['timestampServer'] as String));
    final outPs = punches.where((p) => p['type'] == 'OUT').toList()
      ..sort((a, b) => (b['timestampServer'] as String).compareTo(a['timestampServer'] as String));

    if (inPs.isNotEmpty) {
      final ts = DateTime.tryParse(inPs.first['timestampServer'] as String? ?? '')?.toLocal();
      if (ts != null) {
        inTime = DateFormat('hh:mm a').format(ts);
        final h = ts.hour % 12 == 0 ? 12 : ts.hour % 12;
        final p = ts.hour >= 12 ? 'p' : 'a';
        inTimeShort = ts.minute > 0 ? '$h:${ts.minute.toString().padLeft(2, '0')}$p' : '$h$p';
      }
    }
    if (outPs.isNotEmpty) {
      final ts = DateTime.tryParse(outPs.first['timestampServer'] as String? ?? '')?.toLocal();
      if (ts != null) outTime = DateFormat('hh:mm a').format(ts);
    }
    if (inPs.isNotEmpty && outPs.isNotEmpty) {
      final tsIn  = DateTime.tryParse(inPs.first['timestampServer']  as String? ?? '');
      final tsOut = DateTime.tryParse(outPs.first['timestampServer'] as String? ?? '');
      if (tsIn != null && tsOut != null && tsOut.isAfter(tsIn)) {
        hoursWorked = tsOut.difference(tsIn);
      }
    }
  }

  final String dateStr;
  late final DateTime date;
  final List<Map<String, dynamic>> punches;
  String? inTime;
  String? inTimeShort;
  String? outTime;
  Duration? hoursWorked;

  bool get hasPending  => punches.any((p) => p['approvalStatus'] == 'PENDING');
  bool get hasRejected => punches.any((p) => p['approvalStatus'] == 'REJECTED');

  Color get statusDot {
    if (hasPending)  return Colors.orange;
    if (hasRejected) return Colors.red;
    return Colors.green;
  }
}

// ─── Calendar status helpers ──────────────────────────────────────────────────

enum _CellStatus { present, halfDay, pending, absent, holiday, leave, sunday, future }

Color _cellBg(_CellStatus s) => switch (s) {
  _CellStatus.present  => const Color(0xFFDCFCE7),
  _CellStatus.halfDay  => const Color(0xFFD1FAE5),
  _CellStatus.pending  => const Color(0xFFFEF9C3),
  _CellStatus.absent   => const Color(0xFFFEE2E2),
  _CellStatus.holiday  => const Color(0xFFEDE9FE),
  _CellStatus.leave    => const Color(0xFFFEF3C7),
  _CellStatus.sunday   => const Color(0xFFF1F5F9),
  _CellStatus.future   => const Color(0xFFF8FAFC),
};

Color _cellText(_CellStatus s) => switch (s) {
  _CellStatus.present  => const Color(0xFF15803D),
  _CellStatus.halfDay  => const Color(0xFF065F46),
  _CellStatus.pending  => const Color(0xFFB45309),
  _CellStatus.absent   => const Color(0xFFB91C1C),
  _CellStatus.holiday  => const Color(0xFF6D28D9),
  _CellStatus.leave    => const Color(0xFF92400E),
  _CellStatus.sunday   => const Color(0xFF64748B),
  _CellStatus.future   => const Color(0xFFCBD5E1),
};

String _cellLabel(_CellStatus s) => switch (s) {
  _CellStatus.present  => 'P',
  _CellStatus.halfDay  => 'HD',
  _CellStatus.pending  => 'Pend',
  _CellStatus.absent   => 'A',
  _CellStatus.holiday  => 'Hol',
  _CellStatus.leave    => 'Leave',
  _CellStatus.sunday   => 'Off',
  _CellStatus.future   => '',
};

String _cellLabelFull(_CellStatus s) => switch (s) {
  _CellStatus.present  => 'Present',
  _CellStatus.halfDay  => 'Half Day',
  _CellStatus.pending  => 'Pending',
  _CellStatus.absent   => 'Absent',
  _CellStatus.holiday  => 'Holiday',
  _CellStatus.leave    => 'Leave',
  _CellStatus.sunday   => 'Off',
  _CellStatus.future   => '',
};

// ─── Duration formatter ───────────────────────────────────────────────────────

String _fmtDuration(Duration d) {
  final h = d.inHours;
  final m = d.inMinutes.remainder(60);
  return m > 0 ? '${h}h ${m}m' : '${h}h';
}

// ─── Main screen ──────────────────────────────────────────────────────────────

class HistoryScreen extends ConsumerStatefulWidget {
  const HistoryScreen({super.key});
  @override
  ConsumerState<HistoryScreen> createState() => _HistoryScreenState();
}

enum _Tab { list, calendar, corrections }

class _HistoryScreenState extends ConsumerState<HistoryScreen> {
  late int _year;
  late int _month;

  List<Map<String, dynamic>> _punches  = [];
  List<Map<String, dynamic>> _holidays = [];
  List<Map<String, dynamic>> _leaves   = [];
  List<Map<String, dynamic>> _regReqs  = [];

  bool    _loading = true;
  String? _error;
  _Tab    _tab     = _Tab.list;
  final   _expanded = <String>{};

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _year  = now.year;
    _month = now.month;
    _load();
  }

  String get _monthKey => '$_year-${_month.toString().padLeft(2, '0')}';

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final repo = ref.read(punchRepositoryProvider);
      final results = await Future.wait([
        repo.getMonthPunches(_monthKey),
        repo.getHolidays(_year),
        repo.getMyLeaves(),
        repo.getRegularizations(),
      ]);
      if (!mounted) return;
      setState(() {
        final md = results[0] as Map<String, dynamic>;
        _punches  = (md['punches'] as List?)?.cast<Map<String, dynamic>>() ?? [];
        _holidays = results[1] as List<Map<String, dynamic>>;
        _leaves   = results[2] as List<Map<String, dynamic>>;
        _regReqs  = results[3] as List<Map<String, dynamic>>;
        _loading  = false;
      });
    } catch (e) {
      if (mounted) setState(() { _error = e.toString(); _loading = false; });
    }
  }

  void _prevMonth() {
    setState(() {
      _expanded.clear();
      if (_month == 1) { _month = 12; _year--; } else { _month--; }
    });
    _load();
  }

  void _nextMonth() {
    if (_isCurrentMonth) return;
    setState(() {
      _expanded.clear();
      if (_month == 12) { _month = 1; _year++; } else { _month++; }
    });
    _load();
  }

  bool get _isCurrentMonth {
    final now = DateTime.now();
    return _year == now.year && _month == now.month;
  }

  // ── Computed ──────────────────────────────────────────────────────────────

  Map<String, List<Map<String, dynamic>>> get _grouped {
    final map = <String, List<Map<String, dynamic>>>{};
    for (final p in _punches) {
      final ts = DateTime.tryParse(p['timestampServer'] as String? ?? '')?.toLocal();
      if (ts == null) continue;
      map.putIfAbsent(DateFormat('yyyy-MM-dd').format(ts), () => []).add(p);
    }
    return map;
  }

  List<_DayGroup> get _dayGroups {
    return _grouped.entries
        .map((e) => _DayGroup(dateStr: e.key, punches: e.value))
        .toList()
      ..sort((a, b) => b.dateStr.compareTo(a.dateStr));
  }

  Set<String> get _holidaySet {
    return _holidays
        .map((h) => (h['date'] as String? ?? ''))
        .where((d) => d.length >= 10)
        .map((d) => d.substring(0, 10))
        .toSet();
  }

  Set<String> get _leaveDaySet {
    final s = <String>{};
    for (final lr in _leaves) {
      if (lr['status'] != 'APPROVED') continue;
      final startStr = ((lr['fromDate'] ?? lr['startDate']) as String? ?? '');
      final endStr   = ((lr['toDate']   ?? lr['endDate'])   as String? ?? '');
      if (startStr.length < 10 || endStr.length < 10) continue;
      var cur = DateTime.parse(startStr.substring(0, 10));
      final end = DateTime.parse(endStr.substring(0, 10));
      while (!cur.isAfter(end)) {
        s.add(DateFormat('yyyy-MM-dd').format(cur));
        cur = cur.add(const Duration(days: 1));
      }
    }
    return s;
  }

  ({int presentDays, Duration totalHours, int pendingDays}) get _stats {
    final groups = _dayGroups;
    return (
      presentDays: groups.where((g) => g.inTime != null).length,
      totalHours:  groups.fold(Duration.zero, (s, g) => s + (g.hoursWorked ?? Duration.zero)),
      pendingDays: groups.where((g) => g.hasPending).length,
    );
  }

  // ── Regularization actions ────────────────────────────────────────────────

  void _openRegForm({String? dateStr, bool hasPunchIn = false, bool hasPunchOut = false}) {
    final date = dateStr ?? DateFormat('yyyy-MM-dd')
        .format(DateTime.now().subtract(const Duration(days: 1)));
    String type = 'BOTH';
    if (hasPunchIn && !hasPunchOut) type = 'PUNCH_OUT';
    if (!hasPunchIn && hasPunchOut) type = 'PUNCH_IN';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (sheetCtx) => _RegForm(
        initialDate: date,
        initialType: type,
        repo: ref.read(punchRepositoryProvider),
        onSubmitted: (req) => setState(() => _regReqs = [req, ..._regReqs]),
      ),
    );
  }

  Future<void> _cancelReg(String id) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (dlgCtx) => AlertDialog(
        title: const Text('Cancel Correction'),
        content: const Text('Cancel this correction request?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dlgCtx, false), child: const Text('No')),
          TextButton(
            onPressed: () => Navigator.pop(dlgCtx, true),
            child: Text('Yes, Cancel', style: TextStyle(color: Colors.red.shade600)),
          ),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    try {
      await ref.read(punchRepositoryProvider).cancelRegularization(id);
      if (mounted) setState(() => _regReqs = _regReqs.where((r) => r['id'] != id).toList());
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to cancel: $e'), backgroundColor: Colors.red),
        );
      }
    }
  }

  // ── Build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final monthLabel = DateFormat('MMMM yyyy').format(DateTime(_year, _month));
    final stats = _loading ? null : _stats;
    final corrLabel = _regReqs.isEmpty ? 'Corrections' : 'Corrections (${_regReqs.length})';

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) { if (!didPop) context.go('/home'); },
      child: Scaffold(
        appBar: AppBar(
          surfaceTintColor: Colors.transparent,
          title: const Text('History', style: TextStyle(fontWeight: FontWeight.bold)),
          actions: [IconButton(icon: const Icon(Icons.refresh), onPressed: _loading ? null : _load)],
        ),
        body: Column(children: [
          // Month navigator
          _MonthNav(
            label: monthLabel,
            canGoNext: !_isCurrentMonth,
            onPrev: _loading ? null : _prevMonth,
            onNext: (_loading || _isCurrentMonth) ? null : _nextMonth,
          ),

          // Stats strip
          if (stats != null) _StatsStrip(stats: stats),

          // Tabs
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            child: Row(children: [
              Expanded(child: _TabBtn(label: 'List',     selected: _tab == _Tab.list,        onTap: () => setState(() => _tab = _Tab.list))),
              const SizedBox(width: 6),
              Expanded(child: _TabBtn(label: 'Calendar', selected: _tab == _Tab.calendar,    onTap: () => setState(() => _tab = _Tab.calendar))),
              const SizedBox(width: 6),
              Expanded(child: _TabBtn(label: corrLabel,  selected: _tab == _Tab.corrections, onTap: () => setState(() => _tab = _Tab.corrections))),
            ]),
          ),

          // Body
          Expanded(child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _error != null
              ? _ErrorView(error: _error!, onRetry: _load)
              : _buildBody()),
        ]),
      ),
    );
  }

  Widget _buildBody() {
    final grouped = _grouped;
    return switch (_tab) {
      _Tab.list => _buildList(),
      _Tab.calendar => _CalendarView(
          year: _year, month: _month,
          grouped: grouped,
          holidaySet: _holidaySet,
          leaveDaySet: _leaveDaySet,
        ),
      _Tab.corrections => _CorrectionsTab(
          regReqs: _regReqs,
          onNew: () => _openRegForm(),
          onCancel: _cancelReg,
        ),
    };
  }

  Widget _buildList() {
    final groups = _dayGroups;
    if (groups.isEmpty) {
      return _EmptyView(month: DateFormat('MMMM yyyy').format(DateTime(_year, _month)));
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(16, 10, 16, 16),
        itemCount: groups.length,
        itemBuilder: (_, i) {
          final g = groups[i];
          return _DayRow(
            group: g,
            isExpanded: _expanded.contains(g.dateStr),
            repo: ref.read(punchRepositoryProvider),
            onToggle: () => setState(() {
              if (!_expanded.remove(g.dateStr)) _expanded.add(g.dateStr);
            }),
            onRequestCorrection: () => _openRegForm(
              dateStr: g.dateStr,
              hasPunchIn: g.inTime != null,
              hasPunchOut: g.outTime != null,
            ),
          );
        },
      ),
    );
  }
}

// ─── Month navigator ──────────────────────────────────────────────────────────

class _MonthNav extends StatelessWidget {
  const _MonthNav({required this.label, required this.canGoNext, this.onPrev, this.onNext});
  final String label;
  final bool canGoNext;
  final VoidCallback? onPrev;
  final VoidCallback? onNext;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
      decoration: BoxDecoration(
        color: cs.surface,
        border: Border(bottom: BorderSide(color: cs.outlineVariant)),
      ),
      child: Row(children: [
        IconButton(icon: const Icon(Icons.chevron_left), onPressed: onPrev),
        Expanded(child: Text(label,
            textAlign: TextAlign.center,
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16))),
        IconButton(
          icon: Icon(Icons.chevron_right,
              color: canGoNext ? null : cs.onSurface.withAlpha(60)),
          onPressed: onNext,
        ),
      ]),
    );
  }
}

// ─── Stats strip ──────────────────────────────────────────────────────────────

class _StatsStrip extends StatelessWidget {
  const _StatsStrip({required this.stats});
  final ({int presentDays, Duration totalHours, int pendingDays}) stats;

  @override
  Widget build(BuildContext context) {
    final items = [
      (label: 'Days Present', value: '${stats.presentDays}',   color: const Color(0xFF15803D), bg: const Color(0xFFF0FDF4)),
      (label: 'Hours Worked', value: stats.totalHours > Duration.zero ? _fmtDuration(stats.totalHours) : '—', color: const Color(0xFF1D4ED8), bg: const Color(0xFFEFF6FF)),
      (label: 'Pending',      value: '${stats.pendingDays}',   color: const Color(0xFFA16207), bg: const Color(0xFFFEFCE8)),
    ];
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 4),
      child: Row(children: [
        for (var i = 0; i < items.length; i++) ...[
          Expanded(child: Container(
            padding: const EdgeInsets.symmetric(vertical: 10),
            decoration: BoxDecoration(
              color: items[i].bg,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(children: [
              Text(items[i].value, style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: items[i].color)),
              const SizedBox(height: 2),
              Text(items[i].label, textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: items[i].color.withAlpha(190))),
            ]),
          )),
          if (i < items.length - 1) const SizedBox(width: 8),
        ],
      ]),
    );
  }
}

// ─── Tab button ───────────────────────────────────────────────────────────────

class _TabBtn extends StatelessWidget {
  const _TabBtn({required this.label, required this.selected, required this.onTap});
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(vertical: 8),
        decoration: BoxDecoration(
          color: selected ? cs.primary : cs.surface,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: selected ? cs.primary : cs.outlineVariant,
            width: 1.5,
          ),
        ),
        child: Text(label,
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w700,
            color: selected ? cs.onPrimary : cs.onSurfaceVariant,
          )),
      ),
    );
  }
}

// ─── Collapsible day row ──────────────────────────────────────────────────────

class _DayRow extends StatefulWidget {
  const _DayRow({
    required this.group,
    required this.isExpanded,
    required this.repo,
    required this.onToggle,
    required this.onRequestCorrection,
  });
  final _DayGroup group;
  final bool isExpanded;
  final PunchRepository repo;
  final VoidCallback onToggle;
  final VoidCallback onRequestCorrection;

  @override
  State<_DayRow> createState() => _DayRowState();
}

class _DayRowState extends State<_DayRow> {
  final _photoUrls    = <String, String>{};
  final _photoLoading = <String>{};

  Future<void> _viewPhoto(String punchId) async {
    if (_photoLoading.contains(punchId)) return;
    if (_photoUrls.containsKey(punchId)) { _showPhoto(_photoUrls[punchId]!); return; }
    setState(() => _photoLoading.add(punchId));
    try {
      final url = await widget.repo.getPunchPhotoUrl(punchId);
      if (!mounted) return;
      if (url != null) {
        setState(() => _photoUrls[punchId] = url);
        _showPhoto(url);
      }
    } finally {
      if (mounted) setState(() => _photoLoading.remove(punchId));
    }
  }

  void _showPhoto(String url) {
    showDialog(
      context: context,
      builder: (dlgCtx) => Dialog(
        backgroundColor: Colors.transparent,
        insetPadding: const EdgeInsets.all(16),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: Image.network(url, fit: BoxFit.contain,
                loadingBuilder: (_, child, p) => p == null ? child
                    : const SizedBox(height: 200, child: Center(child: CircularProgressIndicator()))),
          ),
          const SizedBox(height: 12),
          TextButton(
            onPressed: () => Navigator.pop(dlgCtx),
            child: const Text('Close', style: TextStyle(color: Colors.white, fontSize: 14)),
          ),
        ]),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final g  = widget.group;
    final now = DateTime.now();
    final todayStr = DateFormat('yyyy-MM-dd').format(now);
    final isToday  = g.dateStr == todayStr;
    final isPast   = g.date.isBefore(DateTime(now.year, now.month, now.day));

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: cs.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: isToday ? cs.primary : cs.outlineVariant, width: isToday ? 1.5 : 1),
      ),
      child: Column(children: [
        // ── Collapsed header ──
        InkWell(
          onTap: widget.onToggle,
          borderRadius: BorderRadius.circular(14),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
            child: Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
              // Date badge
              SizedBox(width: 44, child: Column(mainAxisSize: MainAxisSize.min, children: [
                Text(g.dateStr.substring(8),
                  style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800,
                      color: isToday ? cs.primary : cs.onSurface, height: 1.1)),
                Text(DateFormat('EEE').format(g.date),
                  style: TextStyle(fontSize: 11, color: cs.onSurfaceVariant)),
              ])),

              // Divider
              Container(width: 1, height: 36, color: cs.outlineVariant,
                  margin: const EdgeInsets.symmetric(horizontal: 12)),

              // Times + hours
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Wrap(spacing: 6, runSpacing: 4, children: [
                  if (g.inTime != null)
                    _TimePill(label: 'IN', time: g.inTime!, isIn: true),
                  if (g.outTime != null)
                    _TimePill(label: 'OUT', time: g.outTime!, isIn: false),
                  if (g.inTime == null)
                    Text('No punch recorded',
                        style: TextStyle(fontSize: 12, color: cs.onSurfaceVariant, fontStyle: FontStyle.italic)),
                ]),
                const SizedBox(height: 3),
                if (g.hoursWorked != null)
                  Text('${_fmtDuration(g.hoursWorked!)} worked',
                      style: TextStyle(fontSize: 11, color: cs.onSurfaceVariant))
                else if (g.inTime != null)
                  const Text('No punch-out recorded',
                      style: TextStyle(fontSize: 11, color: Colors.orange)),
              ])),

              // Status dot + chevron
              Row(mainAxisSize: MainAxisSize.min, children: [
                Container(width: 8, height: 8,
                    decoration: BoxDecoration(color: g.statusDot, shape: BoxShape.circle)),
                const SizedBox(width: 8),
                AnimatedRotation(
                  turns: widget.isExpanded ? 0.25 : 0,
                  duration: const Duration(milliseconds: 200),
                  child: Icon(Icons.chevron_right, color: cs.onSurfaceVariant, size: 20),
                ),
              ]),
            ]),
          ),
        ),

        // ── Expanded detail ──
        if (widget.isExpanded) ...[
          Divider(height: 1, color: cs.outlineVariant),
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 8, 14, 12),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              // Individual punches
              for (final p in ([...g.punches]..sort((a, b) =>
                  (a['timestampServer'] as String).compareTo(b['timestampServer'] as String))))
                _PunchDetailRow(
                  punch: p,
                  onViewPhoto: _viewPhoto,
                  isPhotoLoading: _photoLoading.contains(p['id']),
                ),

              const SizedBox(height: 4),

              // Site name
              if (g.punches.isNotEmpty)
                Builder(builder: (ctx) {
                  final site = (g.punches.first['site'] as Map<String, dynamic>?)?['name'] as String?;
                  if (site == null || site.isEmpty) return const SizedBox.shrink();
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: Row(children: [
                      Icon(Icons.location_on_outlined, size: 12, color: cs.onSurfaceVariant),
                      const SizedBox(width: 4),
                      Text(site, style: TextStyle(fontSize: 11, color: cs.onSurfaceVariant)),
                    ]),
                  );
                }),

              // Request Correction
              if (isPast && (g.inTime == null || g.outTime == null))
                GestureDetector(
                  onTap: widget.onRequestCorrection,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: const Color(0xFFEFF6FF),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: const Color(0xFFBFDBFE)),
                    ),
                    child: const Row(mainAxisSize: MainAxisSize.min, children: [
                      Icon(Icons.edit_outlined, size: 13, color: Color(0xFF1D4ED8)),
                      SizedBox(width: 4),
                      Text('Request Correction',
                          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF1D4ED8))),
                    ]),
                  ),
                ),
            ]),
          ),
        ],
      ]),
    );
  }
}

// ─── Time pill ────────────────────────────────────────────────────────────────

class _TimePill extends StatelessWidget {
  const _TimePill({required this.label, required this.time, required this.isIn});
  final String label;
  final String time;
  final bool isIn;

  @override
  Widget build(BuildContext context) {
    final bg   = isIn ? const Color(0xFFDCFCE7) : const Color(0xFFFFF7ED);
    final text = isIn ? const Color(0xFF15803D) : const Color(0xFFB45309);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(20)),
      child: Text('$label $time',
          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: text)),
    );
  }
}

// ─── Punch detail row (inside expanded day) ───────────────────────────────────

class _PunchDetailRow extends StatelessWidget {
  const _PunchDetailRow({
    required this.punch,
    required this.onViewPhoto,
    required this.isPhotoLoading,
  });
  final Map<String, dynamic> punch;
  final void Function(String id) onViewPhoto;
  final bool isPhotoLoading;

  @override
  Widget build(BuildContext context) {
    final cs       = Theme.of(context).colorScheme;
    final type     = punch['type'] as String? ?? '';
    final status   = punch['approvalStatus'] as String? ?? 'PENDING';
    final id       = punch['id'] as String? ?? '';
    final hasPhoto = (punch['photoKey'] as String?)?.isNotEmpty == true;
    final ts = DateTime.tryParse(punch['timestampServer'] as String? ?? '')?.toLocal();
    final isIn = type == 'IN';

    final statusColor = switch (status) {
      'APPROVED' => Colors.green,
      'REJECTED' => Colors.red,
      _ =>          Colors.orange,
    };
    final statusLabel = switch (status) {
      'APPROVED' => 'Approved',
      'REJECTED' => 'Rejected',
      _ =>          'Pending',
    };
    final typeColor = isIn ? const Color(0xFF15803D) : const Color(0xFFB45309);

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(children: [
        Container(width: 6, height: 6,
            decoration: BoxDecoration(color: statusColor, shape: BoxShape.circle)),
        const SizedBox(width: 8),
        SizedBox(width: 32,
            child: Text(type, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12, color: typeColor))),
        Expanded(
          child: Text(
            ts != null ? DateFormat('hh:mm a').format(ts) : '—',
            style: const TextStyle(fontSize: 12, color: Color(0xFF374151)),
          ),
        ),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
          decoration: BoxDecoration(
            color: statusColor.withAlpha(25),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Text(statusLabel,
              style: TextStyle(fontSize: 11, color: statusColor, fontWeight: FontWeight.w600)),
        ),
        if (hasPhoto) ...[
          const SizedBox(width: 8),
          GestureDetector(
            onTap: () => onViewPhoto(id),
            child: Container(
              width: 30, height: 30,
              decoration: BoxDecoration(
                color: cs.primaryContainer.withAlpha(80),
                borderRadius: BorderRadius.circular(8),
              ),
              child: isPhotoLoading
                  ? const Center(child: SizedBox(width: 12, height: 12, child: CircularProgressIndicator(strokeWidth: 2)))
                  : Icon(Icons.photo_camera_outlined, size: 15, color: cs.primary),
            ),
          ),
        ],
      ]),
    );
  }
}

// ─── Calendar view ────────────────────────────────────────────────────────────

class _CalendarView extends StatelessWidget {
  const _CalendarView({
    required this.year,
    required this.month,
    required this.grouped,
    required this.holidaySet,
    required this.leaveDaySet,
  });
  final int year;
  final int month;
  final Map<String, List<Map<String, dynamic>>> grouped;
  final Set<String> holidaySet;
  final Set<String> leaveDaySet;

  @override
  Widget build(BuildContext context) {
    final cs          = Theme.of(context).colorScheme;
    final daysInMonth = DateUtils.getDaysInMonth(year, month);
    final firstWd     = DateTime(year, month, 1).weekday % 7; // 0=Sun
    final todayStr    = DateFormat('yyyy-MM-dd').format(DateTime.now());

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        // Legend
        Wrap(spacing: 10, runSpacing: 6, children: [
          for (final s in [
            _CellStatus.present, _CellStatus.halfDay, _CellStatus.absent,
            _CellStatus.leave, _CellStatus.holiday, _CellStatus.pending, _CellStatus.sunday,
          ])
            _LegendItem(bg: _cellBg(s), textColor: _cellText(s), label: _cellLabelFull(s)),
        ]),
        const SizedBox(height: 14),

        // Day-of-week header
        Row(children: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) =>
          Expanded(child: Center(child: Text(d,
            style: TextStyle(
              fontWeight: FontWeight.w700, fontSize: 11,
              color: d == 'Su' ? Colors.red.shade400 : cs.onSurfaceVariant,
            ))))).toList()),
        const SizedBox(height: 4),

        // Grid
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 7,
            childAspectRatio: 0.82,
            mainAxisSpacing: 3,
            crossAxisSpacing: 3,
          ),
          itemCount: firstWd + daysInMonth,
          itemBuilder: (_, i) {
            if (i < firstWd) return const SizedBox();
            final day     = i - firstWd + 1;
            final dateStr = '$year-${month.toString().padLeft(2, '0')}-${day.toString().padLeft(2, '0')}';
            final date    = DateTime(year, month, day);
            final isSun   = date.weekday == DateTime.sunday;
            final isFut   = dateStr.compareTo(todayStr) > 0;
            final isToday = dateStr == todayStr;

            _CellStatus status;
            if (isFut)                        status = _CellStatus.future;
            else if (holidaySet.contains(dateStr)) status = _CellStatus.holiday;
            else if (leaveDaySet.contains(dateStr)) status = _CellStatus.leave;
            else if (isSun)                   status = _CellStatus.sunday;
            else {
              final dp = grouped[dateStr] ?? [];
              if (dp.isEmpty) {
                status = _CellStatus.absent;
              } else {
                final approved = dp.where((p) => p['approvalStatus'] == 'APPROVED').toList();
                final pending  = dp.where((p) => p['approvalStatus'] == 'PENDING').toList();
                if (approved.isEmpty && pending.isNotEmpty) {
                  status = _CellStatus.pending;
                } else if (approved.any((p) => p['type'] == 'IN') && approved.any((p) => p['type'] == 'OUT')) {
                  status = _CellStatus.present;
                } else if (approved.any((p) => p['type'] == 'IN')) {
                  status = _CellStatus.halfDay;
                } else {
                  status = _CellStatus.absent;
                }
              }
            }

            // IN time for cell
            String? inTimeShort;
            if (!isFut) {
              final inPs = (grouped[dateStr] ?? [])
                  .where((p) => p['type'] == 'IN' && p['approvalStatus'] == 'APPROVED')
                  .toList()
                ..sort((a, b) => (a['timestampServer'] as String).compareTo(b['timestampServer'] as String));
              if (inPs.isNotEmpty) {
                final ts = DateTime.tryParse(inPs.first['timestampServer'] as String? ?? '')?.toLocal();
                if (ts != null) {
                  final h = ts.hour % 12 == 0 ? 12 : ts.hour % 12;
                  final p = ts.hour >= 12 ? 'p' : 'a';
                  inTimeShort = ts.minute > 0 ? '$h:${ts.minute.toString().padLeft(2, '0')}$p' : '$h$p';
                }
              }
            }

            final bg    = _cellBg(status);
            final text  = _cellText(status);
            final label = _cellLabel(status);

            return Opacity(
              opacity: status == _CellStatus.future ? 0.35 : 1.0,
              child: Container(
                decoration: BoxDecoration(
                  color: bg,
                  borderRadius: BorderRadius.circular(7),
                  border: isToday ? Border.all(color: cs.primary, width: 2) : null,
                ),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 3, horizontal: 1),
                  child: Column(mainAxisAlignment: MainAxisAlignment.start, children: [
                    Container(
                      width: 22, height: 22,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: isToday ? cs.primary : Colors.transparent,
                      ),
                      child: Center(child: Text('$day', style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                        color: isToday ? cs.onPrimary : isSun ? Colors.red.shade400 : cs.onSurface,
                      ))),
                    ),
                    if (label.isNotEmpty)
                      Text(label, style: TextStyle(fontSize: 8, fontWeight: FontWeight.w700, color: text),
                          textAlign: TextAlign.center),
                    if (inTimeShort != null)
                      Text(inTimeShort,
                          style: const TextStyle(fontSize: 7, fontWeight: FontWeight.w600, color: Color(0xFF15803D)),
                          textAlign: TextAlign.center),
                  ]),
                ),
              ),
            );
          },
        ),
      ]),
    );
  }
}

class _LegendItem extends StatelessWidget {
  const _LegendItem({required this.bg, required this.textColor, required this.label});
  final Color bg;
  final Color textColor;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(mainAxisSize: MainAxisSize.min, children: [
      Container(width: 11, height: 11,
          decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(3),
              border: Border.all(color: textColor.withAlpha(60)))),
      const SizedBox(width: 4),
      Text(label, style: TextStyle(fontSize: 10, color: Colors.grey.shade600)),
    ]);
  }
}

// ─── Corrections tab ──────────────────────────────────────────────────────────

class _CorrectionsTab extends StatelessWidget {
  const _CorrectionsTab({required this.regReqs, required this.onNew, required this.onCancel});
  final List<Map<String, dynamic>> regReqs;
  final VoidCallback onNew;
  final void Function(String id) onCancel;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
      children: [
        GestureDetector(
          onTap: onNew,
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 14),
            decoration: BoxDecoration(
              color: const Color(0xFFEFF6FF),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFF1D4ED8), width: 1.5),
            ),
            child: const Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              Icon(Icons.add, color: Color(0xFF1D4ED8), size: 18),
              SizedBox(width: 6),
              Text('Request New Correction',
                  style: TextStyle(color: Color(0xFF1D4ED8), fontWeight: FontWeight.w700, fontSize: 14)),
            ]),
          ),
        ),
        const SizedBox(height: 14),

        if (regReqs.isEmpty)
          Center(child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 48),
            child: Column(children: [
              Icon(Icons.edit_note, size: 48, color: cs.primary.withAlpha(100)),
              const SizedBox(height: 12),
              const Text('No correction requests', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
              const SizedBox(height: 4),
              Text('Tap above to request an attendance correction',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 13, color: cs.onSurfaceVariant)),
            ]),
          ))
        else
          for (final r in regReqs)
            _RegCard(req: r, onCancel: onCancel),
      ],
    );
  }
}

class _RegCard extends StatelessWidget {
  const _RegCard({required this.req, required this.onCancel});
  final Map<String, dynamic> req;
  final void Function(String id) onCancel;

  @override
  Widget build(BuildContext context) {
    final cs        = Theme.of(context).colorScheme;
    final id        = req['id'] as String? ?? '';
    final status    = req['status'] as String? ?? 'PENDING';
    final date      = req['date'] as String? ?? '';
    final reqType   = req['requestType'] as String? ?? 'BOTH';
    final reason    = req['reason'] as String? ?? '';
    final inTime    = req['punchInTime'] as String?;
    final outTime   = req['punchOutTime'] as String?;
    final rejReason = req['rejectionReason'] as String?;

    final typeLabel = switch (reqType) {
      'PUNCH_IN'  => 'Punch In',
      'PUNCH_OUT' => 'Punch Out',
      _           => 'Both Punches',
    };

    final (statusColor, statusBg, statusLabel) = switch (status) {
      'APPROVED' => (Colors.green, const Color(0xFFDCFCE7), 'Approved'),
      'REJECTED' => (Colors.red,   const Color(0xFFFEE2E2), 'Rejected'),
      _          => (Colors.orange, const Color(0xFFFEF9C3), 'Pending'),
    };

    String dateLabel = date;
    try {
      dateLabel = DateFormat('EEE, dd MMM yyyy').format(DateTime.parse('${date}T00:00:00'));
    } catch (_) {}

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: cs.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: cs.outlineVariant),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(14, 12, 14, 10),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(dateLabel, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
              const SizedBox(height: 2),
              Text(typeLabel, style: TextStyle(fontSize: 12, color: cs.onSurfaceVariant)),
            ])),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(color: statusBg, borderRadius: BorderRadius.circular(20)),
              child: Text(statusLabel,
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: statusColor)),
            ),
          ]),
        ),

        if (inTime != null || outTime != null)
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 0, 14, 8),
            child: Wrap(spacing: 8, children: [
              if (inTime != null)  _TimePill(label: 'IN',  time: inTime,  isIn: true),
              if (outTime != null) _TimePill(label: 'OUT', time: outTime, isIn: false),
            ]),
          ),

        Padding(
          padding: const EdgeInsets.fromLTRB(14, 0, 14, 12),
          child: Text('"$reason"',
              style: TextStyle(fontSize: 12, color: cs.onSurfaceVariant, fontStyle: FontStyle.italic)),
        ),

        if (rejReason != null)
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 0, 14, 10),
            child: Text('Rejected: $rejReason',
                style: const TextStyle(fontSize: 12, color: Colors.red)),
          ),

        if (status == 'PENDING') ...[
          Divider(height: 1, color: cs.outlineVariant),
          TextButton(
            onPressed: () => onCancel(id),
            child: const Text('Cancel', style: TextStyle(color: Colors.red, fontSize: 12)),
          ),
        ],
      ]),
    );
  }
}

// ─── Regularization form (bottom sheet) ──────────────────────────────────────

class _RegForm extends StatefulWidget {
  const _RegForm({
    required this.initialDate,
    required this.initialType,
    required this.repo,
    required this.onSubmitted,
  });
  final String initialDate;
  final String initialType;
  final PunchRepository repo;
  final void Function(Map<String, dynamic>) onSubmitted;

  @override
  State<_RegForm> createState() => _RegFormState();
}

class _RegFormState extends State<_RegForm> {
  late String _date;
  late String _type;
  TimeOfDay? _inTime;
  TimeOfDay? _outTime;
  final _reasonCtrl = TextEditingController();
  bool    _busy  = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _date = widget.initialDate;
    _type = widget.initialType;
  }

  @override
  void dispose() {
    _reasonCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final init = DateTime.tryParse(_date) ?? DateTime.now().subtract(const Duration(days: 1));
    final picked = await showDatePicker(
      context: context,
      initialDate: init,
      firstDate: DateTime(DateTime.now().year - 1),
      lastDate: DateTime.now().subtract(const Duration(days: 1)),
    );
    if (picked != null) setState(() => _date = DateFormat('yyyy-MM-dd').format(picked));
  }

  Future<void> _pickTime(bool isIn) async {
    final init = isIn
        ? (_inTime  ?? const TimeOfDay(hour: 9,  minute: 0))
        : (_outTime ?? const TimeOfDay(hour: 18, minute: 0));
    final picked = await showTimePicker(context: context, initialTime: init);
    if (picked != null) setState(() { if (isIn) { _inTime = picked; } else { _outTime = picked; } });
  }

  String _fmtTOD(TimeOfDay t) =>
      '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';

  Future<void> _submit() async {
    if (_reasonCtrl.text.trim().isEmpty) {
      return setState(() => _error = 'Reason is required');
    }
    setState(() { _busy = true; _error = null; });
    try {
      final needIn  = _type == 'PUNCH_IN'  || _type == 'BOTH';
      final needOut = _type == 'PUNCH_OUT' || _type == 'BOTH';
      final result = await widget.repo.submitRegularization(
        date: _date,
        requestType: _type,
        punchInTime:  needIn  && _inTime  != null ? _fmtTOD(_inTime!)  : null,
        punchOutTime: needOut && _outTime != null ? _fmtTOD(_outTime!) : null,
        reason: _reasonCtrl.text.trim(),
      );
      if (mounted) {
        widget.onSubmitted(result);
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) setState(() { _error = e.toString(); _busy = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs      = Theme.of(context).colorScheme;
    final needIn  = _type == 'PUNCH_IN'  || _type == 'BOTH';
    final needOut = _type == 'PUNCH_OUT' || _type == 'BOTH';

    String displayDate = _date;
    try { displayDate = DateFormat('dd MMM yyyy').format(DateTime.parse(_date)); } catch (_) {}

    return SingleChildScrollView(
      padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(context).viewInsets.bottom + 24),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          const Expanded(child: Text('Request Attendance Correction',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16))),
          IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(context)),
        ]),
        const SizedBox(height: 14),

        // Date
        _FieldLabel('DATE'),
        const SizedBox(height: 5),
        GestureDetector(
          onTap: _pickDate,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(border: Border.all(color: cs.outlineVariant), borderRadius: BorderRadius.circular(10)),
            child: Row(children: [
              Icon(Icons.calendar_today, size: 16, color: cs.primary),
              const SizedBox(width: 8),
              Text(displayDate, style: const TextStyle(fontSize: 14)),
              const Spacer(),
              Icon(Icons.chevron_right, size: 16, color: cs.onSurfaceVariant),
            ]),
          ),
        ),
        const SizedBox(height: 14),

        // Correction type
        _FieldLabel('CORRECTION TYPE'),
        const SizedBox(height: 6),
        Row(children: [
          for (final (t, lbl) in [('PUNCH_IN', 'Punch In'), ('PUNCH_OUT', 'Punch Out'), ('BOTH', 'Both')]) ...[
            Expanded(child: GestureDetector(
              onTap: () => setState(() => _type = t),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 150),
                padding: const EdgeInsets.symmetric(vertical: 9),
                decoration: BoxDecoration(
                  color: _type == t ? const Color(0xFFEFF6FF) : cs.surface,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: _type == t ? const Color(0xFF1D4ED8) : cs.outlineVariant,
                    width: 1.5,
                  ),
                ),
                child: Text(lbl, textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 11, fontWeight: FontWeight.w600,
                    color: _type == t ? const Color(0xFF1D4ED8) : cs.onSurfaceVariant,
                  )),
              ),
            )),
            if (t != 'BOTH') const SizedBox(width: 8),
          ],
        ]),
        const SizedBox(height: 14),

        // Times
        if (needIn || needOut)
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            if (needIn) Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              _FieldLabel('PUNCH-IN TIME'),
              const SizedBox(height: 5),
              GestureDetector(
                onTap: () => _pickTime(true),
                child: _TimeBox(time: _inTime != null ? _fmtTOD(_inTime!) : null),
              ),
            ])),
            if (needIn && needOut) const SizedBox(width: 10),
            if (needOut) Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              _FieldLabel('PUNCH-OUT TIME'),
              const SizedBox(height: 5),
              GestureDetector(
                onTap: () => _pickTime(false),
                child: _TimeBox(time: _outTime != null ? _fmtTOD(_outTime!) : null),
              ),
            ])),
          ]),
        if (needIn || needOut) const SizedBox(height: 14),

        // Reason
        _FieldLabel('REASON'),
        const SizedBox(height: 5),
        TextField(
          controller: _reasonCtrl,
          maxLines: 2,
          decoration: const InputDecoration(
            hintText: 'Briefly explain why you missed punching…',
            contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          ),
        ),

        if (_error != null) ...[
          const SizedBox(height: 10),
          Text(_error!, style: TextStyle(color: cs.error, fontSize: 13)),
        ],
        const SizedBox(height: 20),

        Row(children: [
          Expanded(child: OutlinedButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          )),
          const SizedBox(width: 10),
          Expanded(flex: 2, child: FilledButton(
            onPressed: _busy ? null : _submit,
            child: _busy
                ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                : const Text('Submit Request'),
          )),
        ]),
      ]),
    );
  }
}

class _FieldLabel extends StatelessWidget {
  const _FieldLabel(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(text, style: const TextStyle(
        fontSize: 11, fontWeight: FontWeight.w700,
        color: Color(0xFF6B7280), letterSpacing: 0.5));
  }
}

class _TimeBox extends StatelessWidget {
  const _TimeBox({required this.time});
  final String? time;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      decoration: BoxDecoration(
        border: Border.all(color: cs.outlineVariant),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(children: [
        Icon(Icons.access_time, size: 16, color: cs.primary),
        const SizedBox(width: 6),
        Text(time ?? 'Tap to set',
            style: TextStyle(fontSize: 13, color: time != null ? cs.onSurface : cs.onSurfaceVariant)),
      ]),
    );
  }
}

// ─── Empty / Error ────────────────────────────────────────────────────────────

class _EmptyView extends StatelessWidget {
  const _EmptyView({required this.month});
  final String month;

  @override
  Widget build(BuildContext context) {
    return Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
      Icon(Icons.event_available, size: 56, color: Theme.of(context).colorScheme.primary.withAlpha(100)),
      const SizedBox(height: 16),
      const Text('No punch records', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
      const SizedBox(height: 4),
      Text('No punches found for $month', style: TextStyle(color: Colors.grey.shade500, fontSize: 13)),
    ]));
  }
}

class _ErrorView extends StatelessWidget {
  const _ErrorView({required this.error, required this.onRetry});
  final String error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Center(child: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Icon(Icons.cloud_off, size: 48, color: cs.error),
        const SizedBox(height: 16),
        const Text('Could not load history', style: TextStyle(fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        Text(error, style: TextStyle(color: cs.onSurfaceVariant, fontSize: 12), textAlign: TextAlign.center),
        const SizedBox(height: 16),
        FilledButton.icon(onPressed: onRetry, icon: const Icon(Icons.refresh), label: const Text('Retry')),
      ]),
    ));
  }
}
