import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../domain/punch_notifier.dart';
import '../data/punch_repository.dart';
import '../../auth/domain/auth_notifier.dart';
import 'punch_camera_screen.dart';

const _kGradient = LinearGradient(
  begin: Alignment.topLeft,
  end: Alignment.bottomRight,
  colors: [Color(0xFF1e3a8a), Color(0xFF1d4ed8), Color(0xFF1e40af)],
  stops: [0.0, 0.45, 1.0],
);

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
        if (hasIn && !hasOut) { _nextType = 'OUT'; }
        else if (!hasIn)      { _nextType = 'IN'; }
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
    final siteName = (employee?['defaultSite'] as Map<String, dynamic>?)?['name'] as String? ?? '';
    final topPad = MediaQuery.of(context).padding.top;

    return Scaffold(
      backgroundColor: const Color(0xFF1e3a8a),
      body: AnnotatedRegion<SystemUiOverlayStyle>(
        value: const SystemUiOverlayStyle(
          statusBarColor: Colors.transparent,
          statusBarIconBrightness: Brightness.light,
          statusBarBrightness: Brightness.dark,
        ),
        child: Stack(children: [
          // Full gradient background
          Positioned.fill(child: Container(decoration: const BoxDecoration(gradient: _kGradient))),

          // Decorative circles
          Positioned(top: 0, right: -50, child: Container(
            width: 190, height: 190,
            decoration: const BoxDecoration(shape: BoxShape.circle, color: Color(0x0FFFFFFF)),
          )),
          Positioned(bottom: 140, left: 10, child: Container(
            width: 80, height: 80,
            decoration: const BoxDecoration(shape: BoxShape.circle, color: Color(0x0AFFFFFF)),
          )),

          // Scrollable content
          Positioned.fill(child: RefreshIndicator(
            onRefresh: _loadTodayPunches,
            color: Colors.white,
            backgroundColor: const Color(0xFF1d4ed8),
            child: CustomScrollView(
              slivers: [SliverToBoxAdapter(child: Padding(
                padding: EdgeInsets.fromLTRB(20, topPad + 20, 20, 0),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  // Brand row + avatar
                  Row(children: [
                    const Text('BA WORKFORCE', style: TextStyle(
                      fontSize: 11, fontWeight: FontWeight.w800,
                      color: Color(0x80FFFFFF), letterSpacing: 2.0,
                    )),
                    const Spacer(),
                    _AvatarCircle(name: name),
                  ]),
                  const SizedBox(height: 22),

                  // Live clock
                  const _ClockWidget(),
                  const SizedBox(height: 10),

                  // Date
                  Text(
                    DateFormat('EEEE, d MMMM yyyy').format(DateTime.now()),
                    style: const TextStyle(fontSize: 14, color: Color(0xA6FFFFFF), fontWeight: FontWeight.w500),
                  ),

                  // Site
                  if (siteName.isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Row(children: [
                      const Icon(Icons.location_on, size: 12, color: Color(0x6BFFFFFF)),
                      const SizedBox(width: 3),
                      Expanded(child: Text(siteName,
                        style: const TextStyle(fontSize: 12, color: Color(0x6BFFFFFF)),
                        overflow: TextOverflow.ellipsis)),
                    ]),
                  ],

                  // Daily greeting bubble
                  const SizedBox(height: 18),
                  _DailyWishBubble(name: name),
                  const SizedBox(height: 16),

                  // Clocked-in status
                  if (!_loadingState && _nextType == 'OUT' && !_bothDone) ...[
                    const _ClockedInBanner(),
                    const SizedBox(height: 10),
                  ],

                  // Today's punches
                  if (_todayPunches.isNotEmpty)
                    _TodayPunchesCard(punches: _todayPunches),

                  // Bottom space for floating punch button
                  const SizedBox(height: 140),
                ]),
              ))],
            ),
          )),

          // Floating punch button
          Positioned(
            bottom: 0, left: 0, right: 0,
            child: _PunchButtonArea(
              bothDone: _bothDone,
              loading: _loadingState,
              busy: busy,
              isIn: _nextType == 'IN',
              onTap: _doPunch,
              statusText: switch (punchState.status) {
                PunchStatus.uploadingPhoto => 'Uploading photo…',
                PunchStatus.submitting => 'Submitting…',
                _ => 'Please wait…',
              },
            ),
          ),
        ]),
      ),
    );
  }
}

// ── Avatar ────────────────────────────────────────────────────────────────────

class _AvatarCircle extends StatelessWidget {
  const _AvatarCircle({required this.name});
  final String name;

  @override
  Widget build(BuildContext context) {
    final initials = name.trim().split(' ').map((w) => w.isNotEmpty ? w[0] : '').take(2).join().toUpperCase();
    return Container(
      width: 42, height: 42,
      decoration: const BoxDecoration(shape: BoxShape.circle, color: Color(0x33FFFFFF)),
      child: Center(child: Text(initials.isNotEmpty ? initials : '?',
        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15))),
    );
  }
}

// ── Live clock ────────────────────────────────────────────────────────────────

class _ClockWidget extends StatefulWidget {
  const _ClockWidget();

  @override
  State<_ClockWidget> createState() => _ClockWidgetState();
}

class _ClockWidgetState extends State<_ClockWidget> {
  late DateTime _now;
  late Timer _timer;

  @override
  void initState() {
    super.initState();
    _now = DateTime.now();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() => _now = DateTime.now());
    });
  }

  @override
  void dispose() {
    _timer.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Text(
      DateFormat('hh:mm:ss a').format(_now),
      style: const TextStyle(
        color: Colors.white, fontSize: 44, fontWeight: FontWeight.w800,
        letterSpacing: -2, height: 1,
        fontFeatures: [FontFeature.tabularFigures()],
      ),
    );
  }
}

// ── Daily wish ────────────────────────────────────────────────────────────────

class _DailyWishBubble extends StatelessWidget {
  const _DailyWishBubble({required this.name});
  final String name;

  static const _wishes = [
    'Hello {Name}, top of the {Time}! Ready to make it the best? 🚀',
    'Hey {Name}, warm {Time} greetings! Great to see you. 😊',
    '{Time} check, {Name}! Coffee strong, focus sharp. ☕',
    'Hello {Name}, awesome {Time}! Let\'s conquer the checklist. ✅',
    'Happy {Time}, {Name}! Sending high energy your way. ⚡',
    'Good {Time}, {Name}! Time to work your magic. ✨',
    'Hey {Name}, great {Time}! Let\'s turn goals into wins today. 🎯',
    'Hello {Name}, pleasant {Time}! Hope your shift runs smoothly. 🌿',
    '{Time} vibes, {Name}! Let\'s crush those targets. 💪',
    'Hey {Name}, cheerful {Time}! Ready to shine today? 🙌',
    'Good {Time}, {Name}! Fresh start, let\'s roll. 🌊',
    'Hello {Name}, lovely {Time}! Time to bring your best. 🔥',
    'Hey {Name}, fantastic {Time}! Wishing you effortless progress today. 📈',
    '{Time} alert, {Name}! Let\'s make this session count. 📊',
    'Good {Time}, {Name}! One win at a time. 🏆',
    'Hello {Name}, inspiring {Time}! Let\'s create big things. 💡',
    'Hey {Name}, productive {Time}! Let\'s get down to business. 👊',
    'Good {Time}, {Name}! May your workflow be fast and light. ⚡',
    'Hello {Name}, smooth {Time} ahead! You\'ve got this handled. 🛡️',
    'Hey {Name}, vibrant {Time}! Hope you\'re feeling locked in. 🔐',
    '{Time} greetings, {Name}! Small steps lead to big results. 🐾',
    'Hello {Name}, bright {Time}! Ready to show off your skills? 🎨',
    'Hey {Name}, welcome to this {Time} shift! Glad you\'re here. 🤝',
    'Good {Time}, {Name}! Let\'s keep the momentum going. 🎢',
    'Hello {Name}, calm {Time}! Stay steady and focused. 🧘',
    'Hey {Name}, power {Time}! Let\'s make every minute count. ⏱️',
    'Good {Time}, {Name}! Positive vibes for your workday ahead. 🌟',
    'Hello {Name}, quick {Time} check-in! Let\'s smash today\'s goals. 📝',
    'Hey {Name}, golden {Time}! Hope your day runs like clockwork. ⚙️',
    'Good {Time}, {Name}! Time to turn caffeine into results. 💻',
    'Hello {Name}, peaceful {Time}! Finish strong and own the day. 🏁',
  ];

  @override
  Widget build(BuildContext context) {
    final day = DateTime.now().day;
    final h = DateTime.now().hour;
    final time = h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening';
    final tpl = _wishes[(day - 1) % _wishes.length];
    final wish = tpl.replaceAll('{Name}', name).replaceAll('{Time}', time);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
      decoration: BoxDecoration(color: const Color(0x1CFFFFFF), borderRadius: BorderRadius.circular(14)),
      child: Text(wish, style: const TextStyle(
        fontSize: 13, color: Color(0xEBFFFFFF), fontWeight: FontWeight.w500, height: 1.55,
      )),
    );
  }
}

// ── Clocked-in banner ─────────────────────────────────────────────────────────

class _ClockedInBanner extends StatelessWidget {
  const _ClockedInBanner();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
      decoration: BoxDecoration(
        color: const Color(0x1EFFFFFF),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0x33FFFFFF)),
      ),
      child: Row(children: [
        Container(
          width: 10, height: 10,
          decoration: const BoxDecoration(
            shape: BoxShape.circle,
            color: Color(0xFF4ade80),
            boxShadow: [BoxShadow(color: Color(0x404ade80), blurRadius: 0, spreadRadius: 4)],
          ),
        ),
        const SizedBox(width: 12),
        const Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text("You're clocked in",
            style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Colors.white)),
          SizedBox(height: 1),
          Text('Remember to punch out at end of shift',
            style: TextStyle(fontSize: 11, color: Color(0xA6FFFFFF))),
        ]),
      ]),
    );
  }
}

// ── Today's punches card ──────────────────────────────────────────────────────

class _TodayPunchesCard extends StatelessWidget {
  const _TodayPunchesCard({required this.punches});
  final List<Map<String, dynamic>> punches;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0x1AFFFFFF),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0x2EFFFFFF)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('TODAY', style: TextStyle(
          fontSize: 11, fontWeight: FontWeight.w700,
          color: Color(0x80FFFFFF), letterSpacing: 1.5,
        )),
        const SizedBox(height: 10),
        ...punches.map((p) => _DarkPunchRow(punch: p)),
      ]),
    );
  }
}

class _DarkPunchRow extends StatelessWidget {
  const _DarkPunchRow({required this.punch});
  final Map<String, dynamic> punch;

  @override
  Widget build(BuildContext context) {
    final type = punch['type'] as String? ?? '';
    final ts = DateTime.tryParse(punch['timestampServer'] as String? ?? '')?.toLocal();
    final status = punch['approvalStatus'] as String? ?? 'PENDING';
    final address = punch['address'] as String? ?? '';
    final isIn = type == 'IN';
    final typeColor = isIn ? const Color(0xFF4ade80) : const Color(0xFFf87171);
    final statusIcon = status == 'APPROVED' ? '✓' : status == 'REJECTED' ? '✗' : '⏳';
    final statusColor = status == 'APPROVED'
        ? const Color(0xFF4ade80)
        : status == 'REJECTED'
            ? const Color(0xFFf87171)
            : const Color(0x66FFFFFF);

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(children: [
        Container(
          width: 38, height: 38,
          decoration: BoxDecoration(
            color: typeColor.withAlpha(38),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Center(child: Text(type,
            style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: typeColor))),
        ),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            if (ts != null)
              Text(DateFormat('hh:mm a').format(ts),
                style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Colors.white)),
            const Spacer(),
            Text(statusIcon, style: TextStyle(fontSize: 13, color: statusColor)),
          ]),
          if (address.isNotEmpty)
            Text(address,
              style: const TextStyle(fontSize: 11, color: Color(0x8CFFFFFF)),
              maxLines: 1, overflow: TextOverflow.ellipsis),
        ])),
      ]),
    );
  }
}

// ── Floating punch button ─────────────────────────────────────────────────────

class _PunchButtonArea extends StatelessWidget {
  const _PunchButtonArea({
    required this.bothDone,
    required this.loading,
    required this.busy,
    required this.isIn,
    required this.onTap,
    required this.statusText,
  });
  final bool bothDone;
  final bool loading;
  final bool busy;
  final bool isIn;
  final VoidCallback onTap;
  final String statusText;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0x001e3a8a), Color(0xFF1e3a8a)],
          stops: [0.0, 0.55],
        ),
      ),
      padding: const EdgeInsets.fromLTRB(16, 24, 16, 16),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        _buildButton(),
        if (!bothDone && !loading) ...[
          const SizedBox(height: 6),
          const Text('Selfie · GPS required',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 12, color: Color(0x8CFFFFFF))),
        ],
      ]),
    );
  }

  Widget _buildButton() {
    if (loading) {
      return _shell(
        color: const Color(0x55FFFFFF),
        child: const Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5)),
          SizedBox(width: 12),
          Text('Loading…', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
        ]),
      );
    }
    if (bothDone) {
      return _shell(
        color: const Color(0xFFd1fae5),
        child: const Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          Icon(Icons.check_circle_rounded, color: Color(0xFF059669), size: 26),
          SizedBox(width: 10),
          Text('Attendance Complete',
            style: TextStyle(color: Color(0xFF065f46), fontSize: 18, fontWeight: FontWeight.bold)),
        ]),
      );
    }
    if (busy) {
      return _shell(
        color: const Color(0xFF6b7280),
        child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5)),
          const SizedBox(width: 12),
          Text(statusText, style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
        ]),
      );
    }
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 18),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: isIn
                ? [const Color(0xFF16a34a), const Color(0xFF15803d)]
                : [const Color(0xFFdc2626), const Color(0xFFb91c1c)],
          ),
          borderRadius: BorderRadius.circular(16),
          boxShadow: [BoxShadow(
            color: (isIn ? Colors.green : Colors.red).withAlpha(80),
            blurRadius: 18, offset: const Offset(0, 4),
          )],
        ),
        child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          Icon(isIn ? Icons.login_rounded : Icons.logout_rounded, color: Colors.white, size: 24),
          const SizedBox(width: 12),
          Text(isIn ? 'Punch IN' : 'Punch OUT',
            style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
        ]),
      ),
    );
  }

  Widget _shell({required Color color, required Widget child}) => Container(
    width: double.infinity,
    padding: const EdgeInsets.symmetric(vertical: 18),
    decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(16)),
    child: child,
  );
}
