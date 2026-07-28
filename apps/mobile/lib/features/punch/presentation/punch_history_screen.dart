import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../data/punch_repository.dart';

final _punchesProvider = FutureProvider.autoDispose<Map<String, dynamic>>((ref) {
  return ref.watch(punchRepositoryProvider).getMyPunches();
});

class PunchHistoryScreen extends ConsumerWidget {
  const PunchHistoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_punchesProvider);
    final cs = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: const Text('My Punches'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.invalidate(_punchesProvider),
          ),
        ],
      ),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.cloud_off, size: 48, color: cs.error),
                const SizedBox(height: 16),
                Text('Could not load punches', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 8),
                Text(e.toString(), style: TextStyle(color: cs.onSurfaceVariant, fontSize: 12), textAlign: TextAlign.center),
                const SizedBox(height: 16),
                FilledButton.icon(
                  onPressed: () => ref.invalidate(_punchesProvider),
                  icon: const Icon(Icons.refresh),
                  label: const Text('Retry'),
                ),
              ],
            ),
          ),
        ),
        data: (data) {
          final punches = (data['punches'] as List?)?.cast<Map<String, dynamic>>() ?? [];
          if (punches.isEmpty) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.event_available, size: 56, color: cs.primary.withAlpha(100)),
                  const SizedBox(height: 16),
                  Text('No punch records yet', style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 8),
                  Text('Punch IN to start tracking your attendance', style: TextStyle(color: cs.onSurfaceVariant, fontSize: 13)),
                ],
              ),
            );
          }

          // Group punches by date
          final grouped = <String, List<Map<String, dynamic>>>{};
          for (final p in punches) {
            final ts = DateTime.tryParse(p['timestampServer'] as String? ?? '') ?? DateTime.now();
            final key = DateFormat('yyyy-MM-dd').format(ts.toLocal());
            grouped.putIfAbsent(key, () => []).add(p);
          }
          final dates = grouped.keys.toList()..sort((a, b) => b.compareTo(a));

          return RefreshIndicator(
            onRefresh: () => ref.refresh(_punchesProvider.future),
            child: ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: dates.length,
              itemBuilder: (context, i) {
                final date = dates[i];
                final dayPunches = grouped[date]!;
                final dt = DateTime.parse(date);
                final isToday = DateFormat('yyyy-MM-dd').format(DateTime.now()) == date;
                return _DayCard(date: dt, isToday: isToday, punches: dayPunches);
              },
            ),
          );
        },
      ),
    );
  }
}

class _DayCard extends StatelessWidget {
  const _DayCard({required this.date, required this.isToday, required this.punches});
  final DateTime date;
  final bool isToday;
  final List<Map<String, dynamic>> punches;

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
        border: Border.all(
          color: isToday ? cs.primary : cs.outlineVariant,
          width: isToday ? 1.5 : 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Date header
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: isToday ? cs.primaryContainer : cs.surfaceContainerHighest,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(15)),
            ),
            child: Row(
              children: [
                Icon(Icons.calendar_today, size: 16, color: isToday ? cs.primary : cs.onSurfaceVariant),
                const SizedBox(width: 8),
                Text(
                  isToday ? 'Today — ${DateFormat('dd MMMM yyyy').format(date)}' : DateFormat('EEEE, dd MMMM yyyy').format(date),
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    color: isToday ? cs.primary : cs.onSurface,
                    fontSize: 13,
                  ),
                ),
                const Spacer(),
                if (inPunch.isNotEmpty && outPunch.isNotEmpty)
                  _DurationBadge(inPunch: inPunch.last, outPunch: outPunch.last),
              ],
            ),
          ),

          // Punch entries
          for (int i = 0; i < punches.length; i++) ...[
            _PunchRow(punch: punches[i], isLast: i == punches.length - 1),
          ],
        ],
      ),
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
      decoration: BoxDecoration(
        color: Colors.green.withAlpha(30),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        '${h}h ${m}m',
        style: const TextStyle(color: Colors.green, fontSize: 12, fontWeight: FontWeight.bold),
      ),
    );
  }
}

class _PunchRow extends StatelessWidget {
  const _PunchRow({required this.punch, required this.isLast});
  final Map<String, dynamic> punch;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final ts = DateTime.tryParse(punch['timestampServer'] as String? ?? '') ?? DateTime.now();
    final type = punch['type'] as String? ?? '';
    final status = punch['approvalStatus'] as String? ?? 'PENDING';
    final isIn = type == 'IN';
    final site = (punch['site'] as Map<String, dynamic>?)?['name'] as String?;

    final typeColor = isIn ? Colors.green : Colors.deepOrange;

    return Padding(
      padding: EdgeInsets.fromLTRB(16, 12, 16, isLast ? 16 : 0),
      child: Row(
        children: [
          // Type indicator
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: typeColor.withAlpha(25),
              shape: BoxShape.circle,
            ),
            child: Icon(
              isIn ? Icons.login_rounded : Icons.logout_rounded,
              color: typeColor,
              size: 20,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      'Punch $type',
                      style: TextStyle(fontWeight: FontWeight.w600, color: typeColor),
                    ),
                    const SizedBox(width: 8),
                    _StatusBadge(status),
                  ],
                ),
                const SizedBox(height: 2),
                Text(
                  DateFormat('hh:mm a').format(ts.toLocal()),
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: cs.onSurface),
                ),
                if (site != null)
                  Text(site, style: TextStyle(fontSize: 12, color: cs.onSurfaceVariant)),
              ],
            ),
          ),
        ],
      ),
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
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 11, color: color),
          const SizedBox(width: 3),
          Text(label, style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}
