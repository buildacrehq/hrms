import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../data/punch_repository.dart';

class HistoryScreen extends ConsumerStatefulWidget {
  const HistoryScreen({super.key});

  @override
  ConsumerState<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends ConsumerState<HistoryScreen> {
  late int _year;
  late int _month; // 1-indexed
  List<Map<String, dynamic>> _punches = [];
  bool _loading = true;
  bool _showCalendar = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _year = now.year;
    _month = now.month;
    _load();
  }

  String get _monthKey => '$_year-${_month.toString().padLeft(2, '0')}';

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final data = await ref.read(punchRepositoryProvider).getMonthPunches(_monthKey);
      if (!mounted) return;
      setState(() {
        _punches = (data['punches'] as List?)?.cast<Map<String, dynamic>>() ?? [];
        _loading = false;
      });
    } catch (e) {
      if (mounted) setState(() { _error = e.toString(); _loading = false; });
    }
  }

  void _prevMonth() {
    setState(() { if (_month == 1) { _month = 12; _year--; } else { _month--; } });
    _load();
  }

  void _nextMonth() {
    final now = DateTime.now();
    if (_year == now.year && _month == now.month) return;
    setState(() { if (_month == 12) { _month = 1; _year++; } else { _month++; } });
    _load();
  }

  bool get _isCurrentMonth {
    final now = DateTime.now();
    return _year == now.year && _month == now.month;
  }

  // Group punches by local date
  Map<String, List<Map<String, dynamic>>> get _grouped {
    final map = <String, List<Map<String, dynamic>>>{};
    for (final p in _punches) {
      final ts = DateTime.tryParse(p['timestampServer'] as String? ?? '')?.toLocal();
      if (ts == null) continue;
      final key = DateFormat('yyyy-MM-dd').format(ts);
      map.putIfAbsent(key, () => []).add(p);
    }
    return map;
  }

  // Stats
  int get _presentDays {
    final dates = <String>{};
    for (final p in _punches) {
      if (p['type'] == 'IN' && p['approvalStatus'] != 'REJECTED') {
        final ts = DateTime.tryParse(p['timestampServer'] as String? ?? '')?.toLocal();
        if (ts != null) dates.add(DateFormat('yyyy-MM-dd').format(ts));
      }
    }
    return dates.length;
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final monthLabel = DateFormat('MMMM yyyy').format(DateTime(_year, _month));
    final grouped = _grouped;
    final dates = grouped.keys.toList()..sort((a, b) => b.compareTo(a));

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) { if (!didPop) context.go('/home'); },
      child: Scaffold(
      appBar: AppBar(
        surfaceTintColor: Colors.transparent,
        title: const Text('History', style: TextStyle(fontWeight: FontWeight.bold)),
        actions: [
          IconButton(
            icon: Icon(_showCalendar ? Icons.view_list_rounded : Icons.calendar_month_rounded),
            tooltip: _showCalendar ? 'List view' : 'Calendar view',
            onPressed: () => setState(() => _showCalendar = !_showCalendar),
          ),
          IconButton(icon: const Icon(Icons.refresh), onPressed: _load),
        ],
      ),
      body: Column(children: [
        // Month navigator
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            color: cs.surface,
            border: Border(bottom: BorderSide(color: cs.outlineVariant)),
          ),
          child: Row(children: [
            IconButton(
              icon: const Icon(Icons.chevron_left),
              onPressed: _loading ? null : _prevMonth,
            ),
            Expanded(
              child: Text(monthLabel, textAlign: TextAlign.center,
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            ),
            IconButton(
              icon: Icon(Icons.chevron_right, color: _isCurrentMonth ? cs.onSurface.withAlpha(60) : null),
              onPressed: (_loading || _isCurrentMonth) ? null : _nextMonth,
            ),
          ]),
        ),

        // Stats strip
        if (!_loading && _error == null)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            color: cs.primaryContainer.withAlpha(60),
            child: Row(children: [
              _StatChip('Present', '$_presentDays days', Colors.green),
              const SizedBox(width: 8),
              _StatChip('Records', '${_punches.length}', cs.primary),
            ]),
          ),

        // Body
        Expanded(child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _error != null
                ? _ErrorView(error: _error!, onRetry: _load)
                : _showCalendar
                    ? _CalendarView(year: _year, month: _month, grouped: grouped)
                    : _punches.isEmpty
                        ? _EmptyView(month: monthLabel)
                        : RefreshIndicator(
                            onRefresh: _load,
                            child: ListView.builder(
                              padding: const EdgeInsets.all(16),
                              itemCount: dates.length,
                              itemBuilder: (ctx, i) {
                                final date = dates[i];
                                final dayPunches = grouped[date]!;
                                final dt = DateTime.parse(date);
                                final isToday = DateFormat('yyyy-MM-dd').format(DateTime.now()) == date;
                                return _DayCard(
                                  date: dt,
                                  isToday: isToday,
                                  punches: dayPunches,
                                  repo: ref.read(punchRepositoryProvider),
                                );
                              },
                            ),
                          ),
        ),
      ]),
    ));
  }
}

class _StatChip extends StatelessWidget {
  const _StatChip(this.label, this.value, this.color);
  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: color.withAlpha(20),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withAlpha(60)),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Text(label, style: TextStyle(fontSize: 12, color: color.withAlpha(180))),
        const SizedBox(width: 6),
        Text(value, style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: color)),
      ]),
    );
  }
}

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

class _DayCard extends StatelessWidget {
  const _DayCard({required this.date, required this.isToday, required this.punches, required this.repo});
  final DateTime date;
  final bool isToday;
  final List<Map<String, dynamic>> punches;
  final PunchRepository repo;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final inPunch = punches.where((p) => p['type'] == 'IN').toList();
    final outPunch = punches.where((p) => p['type'] == 'OUT').toList();

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: cs.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: isToday ? cs.primary : cs.outlineVariant, width: isToday ? 1.5 : 1),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            color: isToday ? cs.primaryContainer : cs.surfaceContainerHighest,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(15)),
          ),
          child: Row(children: [
            Icon(Icons.calendar_today, size: 15, color: isToday ? cs.primary : cs.onSurfaceVariant),
            const SizedBox(width: 8),
            Expanded(child: Text(
              isToday ? 'Today — ${DateFormat('dd MMMM yyyy').format(date)}' : DateFormat('EEEE, dd MMMM yyyy').format(date),
              style: TextStyle(fontWeight: FontWeight.bold, color: isToday ? cs.primary : cs.onSurface, fontSize: 13),
            )),
            if (inPunch.isNotEmpty && outPunch.isNotEmpty)
              _DurationBadge(inPunch: inPunch.last, outPunch: outPunch.last),
          ]),
        ),
        for (int i = 0; i < punches.length; i++)
          _PunchRow(punch: punches[i], isLast: i == punches.length - 1, repo: repo),
      ]),
    );
  }
}

class _DurationBadge extends StatelessWidget {
  const _DurationBadge({required this.inPunch, required this.outPunch});
  final Map<String, dynamic> inPunch;
  final Map<String, dynamic> outPunch;

  @override
  Widget build(BuildContext context) {
    final tsIn = DateTime.tryParse(inPunch['timestampServer'] as String? ?? '');
    final tsOut = DateTime.tryParse(outPunch['timestampServer'] as String? ?? '');
    if (tsIn == null || tsOut == null) return const SizedBox.shrink();
    final diff = tsOut.difference(tsIn);
    final h = diff.inHours;
    final m = diff.inMinutes.remainder(60);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(color: Colors.green.withAlpha(30), borderRadius: BorderRadius.circular(8)),
      child: Text('${h}h ${m}m', style: const TextStyle(color: Colors.green, fontSize: 12, fontWeight: FontWeight.bold)),
    );
  }
}

class _PunchRow extends StatefulWidget {
  const _PunchRow({required this.punch, required this.isLast, required this.repo});
  final Map<String, dynamic> punch;
  final bool isLast;
  final PunchRepository repo;

  @override
  State<_PunchRow> createState() => _PunchRowState();
}

class _PunchRowState extends State<_PunchRow> {
  String? _photoUrl;
  bool _loadingPhoto = false;

  Future<void> _viewPhoto() async {
    final punchId = widget.punch['id'] as String?;
    if (punchId == null) return;
    setState(() => _loadingPhoto = true);
    try {
      final url = await widget.repo.getPunchPhotoUrl(punchId);
      if (!mounted) return;
      if (url != null) {
        setState(() => _photoUrl = url);
        _showPhoto(url);
      }
    } finally {
      if (mounted) setState(() => _loadingPhoto = false);
    }
  }

  void _showPhoto(String url) {
    showDialog(
      context: context,
      builder: (_) => Dialog(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: Image.network(url, fit: BoxFit.contain,
                loadingBuilder: (_, child, progress) =>
                    progress == null ? child : const Padding(
                        padding: EdgeInsets.all(40),
                        child: CircularProgressIndicator())),
          ),
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Close')),
        ]),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final ts = DateTime.tryParse(widget.punch['timestampServer'] as String? ?? '')?.toLocal();
    final type = widget.punch['type'] as String? ?? '';
    final status = widget.punch['approvalStatus'] as String? ?? 'PENDING';
    final address = widget.punch['address'] as String? ?? '';
    final hasPhoto = (widget.punch['photoKey'] as String?)?.isNotEmpty == true;
    final isIn = type == 'IN';
    final typeColor = isIn ? Colors.green : Colors.deepOrange;

    return Padding(
      padding: EdgeInsets.fromLTRB(16, 12, 16, widget.isLast ? 16 : 0),
      child: Row(children: [
        Container(
          width: 40, height: 40,
          decoration: BoxDecoration(color: typeColor.withAlpha(25), shape: BoxShape.circle),
          child: Icon(isIn ? Icons.login_rounded : Icons.logout_rounded, color: typeColor, size: 20),
        ),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Text('Punch $type', style: TextStyle(fontWeight: FontWeight.w600, color: typeColor)),
            const SizedBox(width: 8),
            _StatusBadge(status),
          ]),
          const SizedBox(height: 2),
          if (ts != null)
            Text(DateFormat('hh:mm a').format(ts),
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: cs.onSurface)),
          if (address.isNotEmpty)
            Text(address, style: TextStyle(fontSize: 11, color: cs.onSurfaceVariant), maxLines: 1, overflow: TextOverflow.ellipsis),
        ])),
        if (hasPhoto)
          GestureDetector(
            onTap: _photoUrl != null ? () => _showPhoto(_photoUrl!) : (_loadingPhoto ? null : _viewPhoto),
            child: Container(
              padding: const EdgeInsets.all(8),
              child: _loadingPhoto
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                  : Icon(Icons.photo_camera_outlined, size: 20, color: cs.primary),
            ),
          ),
      ]),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge(this.status);
  final String status;

  @override
  Widget build(BuildContext context) {
    final (color, label, icon) = switch (status) {
      'APPROVED' => (Colors.green, 'Approved', Icons.check_circle),
      'REJECTED' => (Colors.red, 'Rejected', Icons.cancel),
      _ => (Colors.orange, 'Pending', Icons.schedule),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: color.withAlpha(25),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: color.withAlpha(100)),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: 11, color: color),
        const SizedBox(width: 3),
        Text(label, style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w600)),
      ]),
    );
  }
}

// ── Calendar view ─────────────────────────────────────────────────────────────

class _CalendarView extends StatelessWidget {
  const _CalendarView({required this.year, required this.month, required this.grouped});
  final int year;
  final int month;
  final Map<String, List<Map<String, dynamic>>> grouped;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final daysInMonth = DateUtils.getDaysInMonth(year, month);
    // 0=Sun,1=Mon,...6=Sat (weekday % 7 converts Mon=1 to 1, Sun=7 to 0)
    final firstWeekday = DateTime(year, month, 1).weekday % 7;
    final today = DateTime.now();

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        // Legend
        Wrap(spacing: 12, runSpacing: 8, children: [
          _LegendItem(color: Colors.green.shade400, label: 'Present'),
          _LegendItem(color: Colors.amber.shade400, label: 'Half day'),
          _LegendItem(color: Colors.red.shade300, label: 'Absent'),
          _LegendItem(color: cs.surfaceContainerHighest, label: 'Sunday', textColor: cs.onSurfaceVariant),
        ]),
        const SizedBox(height: 16),

        // Day-of-week header
        Row(children: ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d) =>
          Expanded(child: Center(child: Text(d,
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: cs.onSurfaceVariant))))
        ).toList()),
        const SizedBox(height: 6),

        // Day grid
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 7, childAspectRatio: 1.05,
            mainAxisSpacing: 4, crossAxisSpacing: 4,
          ),
          itemCount: firstWeekday + daysInMonth,
          itemBuilder: (ctx, i) {
            if (i < firstWeekday) return const SizedBox();
            final day = i - firstWeekday + 1;
            final date = DateTime(year, month, day);
            final dateStr = '$year-${month.toString().padLeft(2, '0')}-${day.toString().padLeft(2, '0')}';
            final dayPunches = grouped[dateStr] ?? [];
            final isSunday = date.weekday == DateTime.sunday;
            final isToday = date.year == today.year && date.month == today.month && date.day == today.day;
            final isFuture = date.isAfter(DateTime(today.year, today.month, today.day));

            final hasIn  = dayPunches.any((p) => p['type'] == 'IN'  && p['approvalStatus'] != 'REJECTED');
            final hasOut = dayPunches.any((p) => p['type'] == 'OUT' && p['approvalStatus'] != 'REJECTED');

            Color? cellColor;
            Color textColor = cs.onSurface;
            if (isSunday) {
              cellColor = cs.surfaceContainerHighest;
              textColor = cs.onSurfaceVariant;
            } else if (isFuture) {
              cellColor = null;
            } else if (hasIn && hasOut) {
              cellColor = Colors.green.withAlpha(45);
              textColor = Colors.green.shade700;
            } else if (hasIn) {
              cellColor = Colors.amber.withAlpha(45);
              textColor = Colors.amber.shade800;
            } else {
              cellColor = Colors.red.withAlpha(30);
              textColor = Colors.red.shade400;
            }

            return Container(
              decoration: BoxDecoration(
                color: cellColor,
                borderRadius: BorderRadius.circular(8),
                border: isToday ? Border.all(color: cs.primary, width: 2) : null,
              ),
              child: Center(child: Text('$day', style: TextStyle(
                fontSize: 13,
                fontWeight: isToday ? FontWeight.bold : FontWeight.normal,
                color: isToday && cellColor == null ? cs.primary : textColor,
              ))),
            );
          },
        ),
      ]),
    );
  }
}

class _LegendItem extends StatelessWidget {
  const _LegendItem({required this.color, required this.label, this.textColor});
  final Color color;
  final String label;
  final Color? textColor;

  @override
  Widget build(BuildContext context) {
    return Row(mainAxisSize: MainAxisSize.min, children: [
      Container(
        width: 12, height: 12,
        decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(3)),
      ),
      const SizedBox(width: 4),
      Text(label, style: TextStyle(fontSize: 11, color: textColor)),
    ]);
  }
}
