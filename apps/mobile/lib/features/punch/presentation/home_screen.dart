import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../domain/punch_notifier.dart';
import '../data/punch_repository.dart';
import '../../auth/domain/auth_notifier.dart';
import 'punch_camera_screen.dart';

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  List<Map<String, dynamic>> _todayPunches = [];
  bool _loadingState = true;
  String _nextType = 'IN';
  bool _isPunching = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadTodayPunches());
  }

  Future<void> _loadTodayPunches() async {
    try {
      final punches = await ref.read(punchRepositoryProvider).getTodayPunches();
      if (!mounted) return;
      final hasIn  = punches.any((p) => p['type'] == 'IN'  && p['approvalStatus'] != 'REJECTED');
      final hasOut = punches.any((p) => p['type'] == 'OUT' && p['approvalStatus'] != 'REJECTED');
      setState(() {
        _todayPunches = punches;
        if (hasIn && !hasOut) _nextType = 'OUT';
        else if (!hasIn)      _nextType = 'IN';
        _loadingState = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loadingState = false);
    }
  }

  bool get _bothDone {
    final hasIn  = _todayPunches.any((p) => p['type'] == 'IN'  && p['approvalStatus'] != 'REJECTED');
    final hasOut = _todayPunches.any((p) => p['type'] == 'OUT' && p['approvalStatus'] != 'REJECTED');
    return hasIn && hasOut;
  }

  Future<void> _doPunch() async {
    if (_isPunching) return;
    setState(() => _isPunching = true);
    try {
      final result = await Navigator.of(context).push<PunchCaptureResult>(
        MaterialPageRoute(
          fullscreenDialog: true,
          builder: (_) => const PunchCameraScreen(),
        ),
      );
      if (!mounted || result == null) return;

      await ref.read(punchNotifierProvider.notifier).submitPunch(
            type: _nextType,
            photo: result.photo,
            position: result.position,
            address: result.address,
          );

      if (!mounted) return;
      final s = ref.read(punchNotifierProvider);
      if (s.status == PunchStatus.success) {
        HapticFeedback.mediumImpact();
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Row(children: [
            const Icon(Icons.check_circle, color: Colors.white, size: 18),
            const SizedBox(width: 8),
            Text('Punch $_nextType recorded!'),
          ]),
          backgroundColor: Colors.green.shade700,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          duration: const Duration(seconds: 3),
        ));
        await _loadTodayPunches();
      } else {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(s.message ?? 'Punch failed. Try again.'),
          backgroundColor: Colors.red.shade700,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ));
      }
      ref.read(punchNotifierProvider.notifier).reset();
    } finally {
      if (mounted) setState(() => _isPunching = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final employee = ref.watch(authNotifierProvider).employee;
    final punchState = ref.watch(punchNotifierProvider);
    final isSubmitting = punchState.status != PunchStatus.idle &&
        punchState.status != PunchStatus.success &&
        punchState.status != PunchStatus.error;
    final busy = _isPunching || isSubmitting;
    final name = employee?['name'] as String? ?? 'Employee';
    final siteName = (employee?['defaultSite'] as Map<String, dynamic>?)?['name'] as String? ?? '—';

    return Scaffold(
      backgroundColor: Theme.of(context).colorScheme.surface,
      appBar: AppBar(
        surfaceTintColor: Colors.transparent,
        title: Row(children: [
          Container(
            width: 32, height: 32,
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.primary,
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(Icons.construction, color: Colors.white, size: 18),
          ),
          const SizedBox(width: 10),
          const Text('BA Workforce', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        ]),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout_rounded),
            tooltip: 'Sign out',
            onPressed: busy ? null : () => ref.read(authNotifierProvider.notifier).logout(),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _loadTodayPunches,
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _GreetingCard(name: name, siteName: siteName),
                    const SizedBox(height: 20),
                    const _ClockCard(),
                    const SizedBox(height: 20),
                    _loadingState
                        ? const Center(child: Padding(padding: EdgeInsets.all(32), child: CircularProgressIndicator()))
                        : _bothDone
                            ? _AttendanceCompleteCard()
                            : _PunchButton(
                                isIn: _nextType == 'IN',
                                busy: busy,
                                statusText: switch (punchState.status) {
                                  PunchStatus.uploadingPhoto => 'Uploading photo…',
                                  PunchStatus.submitting => 'Submitting…',
                                  _ => 'Please wait…',
                                },
                                onTap: _doPunch,
                              ),
                    const SizedBox(height: 8),
                    if (!_loadingState && !_bothDone)
                      Center(
                        child: Row(mainAxisSize: MainAxisSize.min, children: [
                          Icon(Icons.info_outline, size: 13, color: Colors.grey.shade400),
                          const SizedBox(width: 4),
                          Text('Camera + GPS required for each punch',
                              style: TextStyle(color: Colors.grey.shade400, fontSize: 12)),
                        ]),
                      ),
                    if (_todayPunches.isNotEmpty) ...[
                      const SizedBox(height: 24),
                      _TodayPunchesList(punches: _todayPunches),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Attendance complete ───────────────────────────────────────────────────────

class _AttendanceCompleteCard extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
      decoration: BoxDecoration(
        color: Colors.green.shade50,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.green.shade200, width: 1.5),
      ),
      child: Row(children: [
        Container(
          width: 52, height: 52,
          decoration: BoxDecoration(color: Colors.green.shade600, borderRadius: BorderRadius.circular(14)),
          child: const Icon(Icons.check_rounded, color: Colors.white, size: 30),
        ),
        const SizedBox(width: 16),
        Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Attendance Complete', style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold, color: Colors.green.shade800)),
          const SizedBox(height: 2),
          Text('Both IN and OUT recorded for today', style: TextStyle(fontSize: 12, color: Colors.green.shade600)),
        ]),
      ]),
    );
  }
}

// ── Today's punches list ─────────────────────────────────────────────────────

class _TodayPunchesList extends StatelessWidget {
  const _TodayPunchesList({required this.punches});
  final List<Map<String, dynamic>> punches;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text("Today's Punches", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: cs.onSurface)),
        const SizedBox(height: 10),
        ...punches.map((p) => _TodayPunchRow(punch: p)),
      ],
    );
  }
}

class _TodayPunchRow extends StatelessWidget {
  const _TodayPunchRow({required this.punch});
  final Map<String, dynamic> punch;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final type = punch['type'] as String? ?? '';
    final ts = DateTime.tryParse(punch['timestampServer'] as String? ?? '')?.toLocal();
    final status = punch['approvalStatus'] as String? ?? 'PENDING';
    final address = punch['address'] as String? ?? '';
    final isIn = type == 'IN';
    final color = isIn ? Colors.green : Colors.deepOrange;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: cs.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: cs.outlineVariant),
      ),
      child: Row(children: [
        Container(
          width: 38, height: 38,
          decoration: BoxDecoration(color: color.withAlpha(25), shape: BoxShape.circle),
          child: Icon(isIn ? Icons.login_rounded : Icons.logout_rounded, color: color, size: 20),
        ),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Text('Punch $type', style: TextStyle(fontWeight: FontWeight.w600, color: color, fontSize: 13)),
            const SizedBox(width: 8),
            _StatusChip(status),
          ]),
          if (ts != null)
            Text(DateFormat('hh:mm a').format(ts),
                style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
          if (address.isNotEmpty)
            Text(address, style: TextStyle(fontSize: 11, color: cs.onSurfaceVariant), maxLines: 1, overflow: TextOverflow.ellipsis),
        ])),
      ]),
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip(this.status);
  final String status;

  @override
  Widget build(BuildContext context) {
    final (color, label) = switch (status) {
      'APPROVED' => (Colors.green, 'Approved'),
      'REJECTED' => (Colors.red, 'Rejected'),
      _ => (Colors.orange, 'Pending'),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(
        color: color.withAlpha(25),
        borderRadius: BorderRadius.circular(5),
        border: Border.all(color: color.withAlpha(80)),
      ),
      child: Text(label, style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.w600)),
    );
  }
}

// ── Greeting card ────────────────────────────────────────────────────────────

class _GreetingCard extends StatelessWidget {
  const _GreetingCard({required this.name, required this.siteName});
  final String name;
  final String siteName;

  String get _greeting {
    final h = DateTime.now().hour;
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }

  @override
  Widget build(BuildContext context) {
    final initials = name.trim().split(' ').map((w) => w.isNotEmpty ? w[0] : '').take(2).join().toUpperCase();
    return Row(children: [
      CircleAvatar(
        radius: 22,
        backgroundColor: Theme.of(context).colorScheme.primaryContainer,
        child: Text(initials.isNotEmpty ? initials : '?',
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15,
                color: Theme.of(context).colorScheme.onPrimaryContainer)),
      ),
      const SizedBox(width: 12),
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(_greeting, style: TextStyle(color: Colors.grey.shade500, fontSize: 12, fontWeight: FontWeight.w500)),
        Text(name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        Row(children: [
          Icon(Icons.location_on_outlined, size: 12, color: Colors.grey.shade400),
          const SizedBox(width: 2),
          Text(siteName, style: TextStyle(color: Colors.grey.shade400, fontSize: 12)),
        ]),
      ])),
    ]);
  }
}

// ── Clock card ───────────────────────────────────────────────────────────────

class _ClockCard extends StatefulWidget {
  const _ClockCard();

  @override
  State<_ClockCard> createState() => _ClockCardState();
}

class _ClockCardState extends State<_ClockCard> {
  late DateTime _now;
  late Timer _timer;

  @override
  void initState() {
    super.initState();
    _now = DateTime.now();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) => setState(() => _now = DateTime.now()));
  }

  @override
  void dispose() {
    _timer.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [cs.primary, cs.primary.withAlpha(200)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [BoxShadow(color: cs.primary.withAlpha(80), blurRadius: 20, offset: const Offset(0, 8))],
      ),
      child: Column(children: [
        Text(DateFormat('hh:mm:ss a').format(_now),
            style: const TextStyle(color: Colors.white, fontSize: 34, fontWeight: FontWeight.bold,
                letterSpacing: 1, fontFeatures: [FontFeature.tabularFigures()])),
        const SizedBox(height: 4),
        Text(DateFormat('EEEE, d MMMM yyyy').format(_now),
            style: TextStyle(color: Colors.white.withAlpha(200), fontSize: 13)),
      ]),
    );
  }
}

// ── Punch button ─────────────────────────────────────────────────────────────

class _PunchButton extends StatelessWidget {
  const _PunchButton({required this.isIn, required this.busy, required this.statusText, required this.onTap});
  final bool isIn;
  final bool busy;
  final String statusText;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = isIn ? const Color(0xFF16A34A) : const Color(0xFFEA580C);
    final icon = isIn ? Icons.login_rounded : Icons.logout_rounded;
    final label = isIn ? 'Punch In' : 'Punch Out';
    final sub = isIn ? 'Tap to mark your arrival' : 'Tap to mark your departure';

    if (busy) {
      return Container(
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const SizedBox(width: 28, height: 28, child: CircularProgressIndicator(strokeWidth: 3)),
          const SizedBox(height: 12),
          Text(statusText, style: TextStyle(color: Colors.grey.shade600, fontWeight: FontWeight.w500)),
        ]),
      );
    }

    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
        decoration: BoxDecoration(
          color: color.withAlpha(12),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: color.withAlpha(80), width: 1.5),
        ),
        child: Row(children: [
          Container(
            width: 52, height: 52,
            decoration: BoxDecoration(
              color: color, borderRadius: BorderRadius.circular(14),
              boxShadow: [BoxShadow(color: color.withAlpha(80), blurRadius: 12, offset: const Offset(0, 4))],
            ),
            child: Icon(icon, color: Colors.white, size: 26),
          ),
          const SizedBox(width: 16),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(label, style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: color)),
            const SizedBox(height: 2),
            Text(sub, style: TextStyle(fontSize: 12.5, color: Colors.grey.shade500)),
          ])),
          Icon(Icons.arrow_forward_ios_rounded, size: 16, color: color.withAlpha(160)),
        ]),
      ),
    );
  }
}
