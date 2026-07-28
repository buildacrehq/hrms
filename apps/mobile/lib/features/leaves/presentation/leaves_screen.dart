import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../data/leaves_repository.dart';

const _kGradient = LinearGradient(
  begin: Alignment.topLeft,
  end: Alignment.bottomRight,
  colors: [Color(0xFF1e3a8a), Color(0xFF1d4ed8), Color(0xFF1e40af)],
  stops: [0.0, 0.45, 1.0],
);

class LeavesScreen extends ConsumerStatefulWidget {
  const LeavesScreen({super.key});

  @override
  ConsumerState<LeavesScreen> createState() => _LeavesScreenState();
}

class _LeavesScreenState extends ConsumerState<LeavesScreen> {
  List<Map<String, dynamic>> _types    = [];
  List<Map<String, dynamic>> _requests = [];
  List<Map<String, dynamic>> _balances = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final repo    = ref.read(leavesRepositoryProvider);
      final results = await Future.wait([repo.getLeaveTypes(), repo.getMyRequests(), repo.getMyBalance()]);
      if (!mounted) return;
      setState(() {
        _types    = results[0];
        _requests = results[1];
        _balances = results[2];
        _loading  = false;
      });
    } catch (e) {
      if (mounted) setState(() { _error = e.toString(); _loading = false; });
    }
  }

  Future<void> _cancelLeave(String id) async {
    try {
      await ref.read(leavesRepositoryProvider).cancelLeave(id);
      await _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to cancel: $e'), backgroundColor: Colors.red),
        );
      }
    }
  }

  void _showApplySheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _ApplyLeaveSheet(
        types: _types,
        repo: ref.read(leavesRepositoryProvider),
        onApplied: _load,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final cs     = Theme.of(context).colorScheme;
    final topPad = MediaQuery.of(context).padding.top;

    return Scaffold(
      backgroundColor: cs.surface,
      body: AnnotatedRegion<SystemUiOverlayStyle>(
        value: const SystemUiOverlayStyle(
          statusBarColor: Colors.transparent,
          statusBarIconBrightness: Brightness.light,
        ),
        child: _loading
          ? Container(
              decoration: const BoxDecoration(gradient: _kGradient),
              child: const Center(child: CircularProgressIndicator(color: Colors.white)),
            )
          : _error != null
              ? Scaffold(body: Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
                  Icon(Icons.cloud_off, size: 48, color: cs.error),
                  const SizedBox(height: 12),
                  Text(_error!, textAlign: TextAlign.center),
                  const SizedBox(height: 16),
                  FilledButton(onPressed: _load, child: const Text('Retry')),
                ])))
              : RefreshIndicator(
                  onRefresh: _load,
                  color: const Color(0xFF1d4ed8),
                  child: CustomScrollView(slivers: [
                    // ── Gradient header ──────────────────────────────────────
                    SliverToBoxAdapter(child: Container(
                      decoration: const BoxDecoration(gradient: _kGradient),
                      padding: EdgeInsets.fromLTRB(20, topPad + 16, 20, 24),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Row(children: [
                          const Text('Leaves', style: TextStyle(
                            fontSize: 22, fontWeight: FontWeight.w800, color: Colors.white,
                          )),
                          const Spacer(),
                          IconButton(
                            icon: const Icon(Icons.refresh, color: Colors.white70, size: 20),
                            onPressed: _load,
                            padding: EdgeInsets.zero,
                            constraints: const BoxConstraints(),
                          ),
                          const SizedBox(width: 8),
                          GestureDetector(
                            onTap: _showApplySheet,
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: const Row(mainAxisSize: MainAxisSize.min, children: [
                                Icon(Icons.add, size: 16, color: Color(0xFF1e3a8a)),
                                SizedBox(width: 4),
                                Text('Apply', style: TextStyle(
                                  fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF1e3a8a),
                                )),
                              ]),
                            ),
                          ),
                        ]),

                        // Balance cards — horizontal scroll
                        if (_balances.isNotEmpty) ...[
                          const SizedBox(height: 16),
                          SizedBox(
                            height: 110,
                            child: ListView.separated(
                              scrollDirection: Axis.horizontal,
                              itemCount: _balances.length,
                              separatorBuilder: (_, __) => const SizedBox(width: 10),
                              itemBuilder: (_, i) => _BalanceChip(balance: _balances[i]),
                            ),
                          ),
                        ],
                      ]),
                    )),

                    // ── Requests list ────────────────────────────────────────
                    SliverToBoxAdapter(child: Padding(
                      padding: const EdgeInsets.fromLTRB(16, 20, 16, 0),
                      child: Text('My Requests',
                        style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: cs.onSurface)),
                    )),
                    const SliverToBoxAdapter(child: SizedBox(height: 12)),

                    if (_requests.isEmpty)
                      SliverToBoxAdapter(child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 48),
                        child: Column(children: [
                          Container(
                            width: 64, height: 64,
                            decoration: BoxDecoration(
                              color: cs.primaryContainer.withAlpha(60),
                              shape: BoxShape.circle,
                            ),
                            child: Icon(Icons.eco_outlined, size: 30, color: cs.primary.withAlpha(160)),
                          ),
                          const SizedBox(height: 14),
                          Text('No leave requests yet',
                            style: TextStyle(color: cs.onSurfaceVariant, fontWeight: FontWeight.w500)),
                          const SizedBox(height: 6),
                          Text('Tap Apply to submit one',
                            style: TextStyle(fontSize: 12, color: cs.onSurfaceVariant.withAlpha(160))),
                        ]),
                      ))
                    else
                      SliverList(delegate: SliverChildBuilderDelegate(
                        (_, i) {
                          final isLast = i == _requests.length - 1;
                          return Padding(
                            padding: EdgeInsets.fromLTRB(16, 0, 16, isLast ? 80 : 10),
                            child: _RequestCard(request: _requests[i], onCancel: _cancelLeave),
                          );
                        },
                        childCount: _requests.length,
                      )),
                  ]),
                ),
      ),
    );
  }
}

// ── Balance chip (horizontal scroll card) ────────────────────────────────────

class _BalanceChip extends StatelessWidget {
  const _BalanceChip({required this.balance});
  final Map<String, dynamic> balance;

  @override
  Widget build(BuildContext context) {
    final type      = balance['leaveType'] as Map<String, dynamic>? ?? {};
    final name      = type['name']    as String? ?? 'Leave';
    final accrual   = type['accrual'] as String? ?? '';
    final maxDays   = (type['maxDays'] as num?)?.toInt() ?? 0;
    final used      = (balance['usedDays']       as num?)?.toInt() ?? 0;
    final remaining = (balance['remainingDays']  as num?)?.toInt() ?? (maxDays - used);
    final isManual  = accrual == 'MANUAL';
    final pct       = (!isManual && maxDays > 0) ? (used / maxDays).clamp(0.0, 1.0) : 0.0;

    final remainColor = remaining > 0 ? const Color(0xFF4ade80) : const Color(0xFFf87171);

    return Container(
      width: 120,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white.withAlpha(15),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.white.withAlpha(30)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(
          isManual ? '—' : '$remaining',
          style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: isManual ? Colors.white54 : remainColor, height: 1),
        ),
        const SizedBox(height: 2),
        Text(isManual ? 'Admin credits' : 'remaining',
          style: const TextStyle(fontSize: 10, color: Color(0x80FFFFFF))),
        const Spacer(),
        if (!isManual) ...[
          ClipRRect(
            borderRadius: BorderRadius.circular(3),
            child: LinearProgressIndicator(
              value: pct,
              minHeight: 4,
              backgroundColor: Colors.white24,
              color: remainColor,
            ),
          ),
          const SizedBox(height: 5),
        ],
        Text(name,
          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Colors.white),
          maxLines: 1, overflow: TextOverflow.ellipsis),
      ]),
    );
  }
}

// ── Request card ─────────────────────────────────────────────────────────────

class _RequestCard extends StatelessWidget {
  const _RequestCard({required this.request, required this.onCancel});
  final Map<String, dynamic> request;
  final void Function(String id) onCancel;

  @override
  Widget build(BuildContext context) {
    final cs       = Theme.of(context).colorScheme;
    final id       = request['id'] as String? ?? '';
    final type     = (request['leaveType'] ?? request['type']) as Map<String, dynamic>? ?? {};
    final typeName = type['name'] as String? ?? 'Leave';
    final status   = request['status'] as String? ?? 'PENDING';
    final from     = (request['fromDate'] ?? request['startDate']) as String? ?? '';
    final to       = (request['toDate']   ?? request['endDate'])   as String? ?? '';
    final reason   = request['reason']   as String? ?? '';

    final (statusColor, statusBg, statusLabel) = switch (status) {
      'APPROVED'  => (const Color(0xFF15803d), const Color(0xFFdcfce7), 'Approved'),
      'REJECTED'  => (const Color(0xFFb91c1c), const Color(0xFFfee2e2), 'Rejected'),
      'CANCELLED' => (const Color(0xFF64748b), const Color(0xFFf1f5f9), 'Cancelled'),
      _           => (const Color(0xFFb45309), const Color(0xFFfef9c3), 'Pending'),
    };

    String fmtDate(String d) {
      try { return DateFormat('dd MMM yy').format(DateTime.parse(d.substring(0, 10))); }
      catch (_) { return d.length >= 10 ? d.substring(0, 10) : d; }
    }

    int diffDays() {
      try {
        final a = DateTime.parse(from.substring(0, 10));
        final b = DateTime.parse(to.substring(0, 10));
        return b.difference(a).inDays + 1;
      } catch (_) { return 1; }
    }

    final days = (from.isNotEmpty && to.isNotEmpty) ? diffDays() : 0;

    return Container(
      decoration: BoxDecoration(
        color: cs.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: cs.outlineVariant),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        // Header bar
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: cs.surfaceContainerHighest,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(15)),
          ),
          child: Row(children: [
            Expanded(child: Text(typeName,
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14))),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
              decoration: BoxDecoration(
                color: statusBg,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(statusLabel,
                style: TextStyle(color: statusColor, fontSize: 11, fontWeight: FontWeight.w700)),
            ),
          ]),
        ),

        // Body
        Padding(
          padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Icon(Icons.date_range_outlined, size: 14, color: cs.onSurfaceVariant),
              const SizedBox(width: 6),
              Text(
                from.isNotEmpty
                  ? (from.substring(0,10) == to.substring(0,10)
                      ? fmtDate(from)
                      : '${fmtDate(from)}  →  ${fmtDate(to)}')
                  : '—',
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
              ),
              if (days > 0) ...[
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                  decoration: BoxDecoration(
                    color: cs.secondaryContainer,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text('$days day${days != 1 ? 's' : ''}',
                    style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: cs.onSecondaryContainer)),
                ),
              ],
            ]),
            if (reason.isNotEmpty) ...[
              const SizedBox(height: 6),
              Text('"$reason"',
                style: TextStyle(fontSize: 12, color: cs.onSurfaceVariant, fontStyle: FontStyle.italic),
                maxLines: 2, overflow: TextOverflow.ellipsis),
            ],
            if (status == 'PENDING') ...[
              const SizedBox(height: 10),
              GestureDetector(
                onTap: () => _confirmCancel(context, id),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Icon(Icons.cancel_outlined, size: 14, color: Colors.red.shade600),
                  const SizedBox(width: 4),
                  Text('Cancel request',
                    style: TextStyle(fontSize: 12, color: Colors.red.shade600, fontWeight: FontWeight.w600)),
                ]),
              ),
            ],
          ]),
        ),
      ]),
    );
  }

  void _confirmCancel(BuildContext context, String id) {
    showDialog(
      context: context,
      useRootNavigator: true,
      builder: (dlgCtx) => AlertDialog(
        title: const Text('Cancel Leave'),
        content: const Text('Are you sure you want to cancel this leave request?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dlgCtx), child: const Text('No')),
          TextButton(
            onPressed: () { Navigator.pop(dlgCtx); onCancel(id); },
            child: Text('Yes, Cancel', style: TextStyle(color: Colors.red.shade600)),
          ),
        ],
      ),
    );
  }
}

// ── Apply leave bottom sheet ──────────────────────────────────────────────────

class _ApplyLeaveSheet extends StatefulWidget {
  const _ApplyLeaveSheet({required this.types, required this.repo, required this.onApplied});
  final List<Map<String, dynamic>> types;
  final LeavesRepository repo;
  final VoidCallback onApplied;

  @override
  State<_ApplyLeaveSheet> createState() => _ApplyLeaveSheetState();
}

class _ApplyLeaveSheetState extends State<_ApplyLeaveSheet> {
  String? _selectedTypeId;
  DateTime? _startDate;
  DateTime? _endDate;
  final _reasonCtrl = TextEditingController();
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _reasonCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickDate(bool isStart) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime.now(),
      firstDate: DateTime(DateTime.now().year - 1),
      lastDate: DateTime(DateTime.now().year + 1),
    );
    if (picked == null) return;
    setState(() {
      if (isStart) {
        _startDate = picked;
        if (_endDate != null && _endDate!.isBefore(picked)) _endDate = picked;
      } else {
        _endDate = picked;
      }
    });
  }

  Future<void> _submit() async {
    if (_selectedTypeId == null) return setState(() => _error = 'Select a leave type');
    if (_startDate == null || _endDate == null) return setState(() => _error = 'Select start and end dates');
    if (_reasonCtrl.text.trim().isEmpty) return setState(() => _error = 'Enter a reason');
    setState(() { _submitting = true; _error = null; });
    try {
      await widget.repo.applyLeave(
        typeId: _selectedTypeId!,
        startDate: DateFormat('yyyy-MM-dd').format(_startDate!),
        endDate: DateFormat('yyyy-MM-dd').format(_endDate!),
        reason: _reasonCtrl.text.trim(),
      );
      if (mounted) { Navigator.pop(context); widget.onApplied(); }
    } catch (e) {
      if (mounted) setState(() { _error = e.toString(); _submitting = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs  = Theme.of(context).colorScheme;
    final fmt = DateFormat('dd MMM yyyy');

    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: EdgeInsets.fromLTRB(20, 8, 20, MediaQuery.of(context).viewInsets.bottom + 24),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        // Handle
        Center(child: Container(
          width: 36, height: 4,
          margin: const EdgeInsets.only(bottom: 16),
          decoration: BoxDecoration(color: cs.outlineVariant, borderRadius: BorderRadius.circular(2)),
        )),
        Row(children: [
          Text('Apply for Leave', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
          const Spacer(),
          IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(context)),
        ]),
        const SizedBox(height: 16),

        DropdownButtonFormField<String>(
          value: _selectedTypeId,
          decoration: const InputDecoration(labelText: 'Leave Type', prefixIcon: Icon(Icons.eco_outlined)),
          items: widget.types.map((t) => DropdownMenuItem<String>(
            value: t['id'] as String?,
            child: Text(t['name'] as String? ?? ''),
          )).toList(),
          onChanged: (v) => setState(() => _selectedTypeId = v),
        ),
        const SizedBox(height: 14),

        Row(children: [
          Expanded(child: GestureDetector(
            onTap: () => _pickDate(true),
            child: InputDecorator(
              decoration: const InputDecoration(labelText: 'Start Date', prefixIcon: Icon(Icons.calendar_today, size: 18)),
              child: Text(
                _startDate != null ? fmt.format(_startDate!) : 'Select',
                style: TextStyle(color: _startDate != null ? cs.onSurface : cs.onSurfaceVariant),
              ),
            ),
          )),
          const SizedBox(width: 12),
          Expanded(child: GestureDetector(
            onTap: () => _pickDate(false),
            child: InputDecorator(
              decoration: const InputDecoration(labelText: 'End Date', prefixIcon: Icon(Icons.calendar_today, size: 18)),
              child: Text(
                _endDate != null ? fmt.format(_endDate!) : 'Select',
                style: TextStyle(color: _endDate != null ? cs.onSurface : cs.onSurfaceVariant),
              ),
            ),
          )),
        ]),
        const SizedBox(height: 14),

        TextField(
          controller: _reasonCtrl,
          maxLines: 2,
          decoration: const InputDecoration(labelText: 'Reason', prefixIcon: Icon(Icons.notes)),
        ),

        if (_error != null) ...[
          const SizedBox(height: 10),
          Text(_error!, style: TextStyle(color: cs.error, fontSize: 13)),
        ],
        const SizedBox(height: 20),

        FilledButton(
          onPressed: _submitting ? null : _submit,
          child: _submitting
              ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
              : const Text('Submit Request'),
        ),
      ]),
    );
  }
}
