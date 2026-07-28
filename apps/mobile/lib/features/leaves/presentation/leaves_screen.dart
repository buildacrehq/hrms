import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../data/leaves_repository.dart';

class LeavesScreen extends ConsumerStatefulWidget {
  const LeavesScreen({super.key});

  @override
  ConsumerState<LeavesScreen> createState() => _LeavesScreenState();
}

class _LeavesScreenState extends ConsumerState<LeavesScreen> {
  List<Map<String, dynamic>> _types = [];
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
      final repo = ref.read(leavesRepositoryProvider);
      final results = await Future.wait([
        repo.getLeaveTypes(),
        repo.getMyRequests(),
        repo.getMyBalance(),
      ]);
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
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => _ApplyLeaveSheet(types: _types, repo: ref.read(leavesRepositoryProvider), onApplied: _load),
    );
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(
        surfaceTintColor: Colors.transparent,
        title: const Text('Leaves', style: TextStyle(fontWeight: FontWeight.bold)),
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _load),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _loading ? null : _showApplySheet,
        icon: const Icon(Icons.add),
        label: const Text('Apply Leave'),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
                  Icon(Icons.cloud_off, size: 48, color: cs.error),
                  const SizedBox(height: 12),
                  Text(_error!, textAlign: TextAlign.center, style: TextStyle(color: cs.onSurfaceVariant)),
                  const SizedBox(height: 16),
                  FilledButton(onPressed: _load, child: const Text('Retry')),
                ]))
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 80),
                    children: [
                      if (_balances.isNotEmpty) ...[
                        Text('Leave Balance', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: cs.onSurface)),
                        const SizedBox(height: 10),
                        ..._balances.map((b) => _BalanceCard(balance: b)),
                        const SizedBox(height: 24),
                      ],
                      Text('My Requests', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: cs.onSurface)),
                      const SizedBox(height: 10),
                      if (_requests.isEmpty)
                        Center(child: Padding(
                          padding: const EdgeInsets.all(32),
                          child: Column(children: [
                            Icon(Icons.eco_outlined, size: 48, color: cs.primary.withAlpha(100)),
                            const SizedBox(height: 12),
                            Text('No leave requests yet', style: TextStyle(color: cs.onSurfaceVariant)),
                          ]),
                        ))
                      else
                        ..._requests.map((r) => _RequestCard(request: r, onCancel: _cancelLeave)),
                    ],
                  ),
                ),
    );
  }
}

// ── Balance card ─────────────────────────────────────────────────────────────

class _BalanceCard extends StatelessWidget {
  const _BalanceCard({required this.balance});
  final Map<String, dynamic> balance;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final type = balance['leaveType'] as Map<String, dynamic>? ?? {};
    final name = type['name'] as String? ?? 'Leave';
    final maxDays = (type['maxDays'] as num?)?.toInt() ?? 0;
    final used = (balance['usedDays'] as num?)?.toInt() ?? 0;
    final remaining = (balance['remainingDays'] as num?)?.toInt() ?? (maxDays - used);
    final pct = maxDays > 0 ? used / maxDays : 0.0;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: cs.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: cs.outlineVariant),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(child: Text(name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14))),
          Text('$remaining left', style: TextStyle(fontWeight: FontWeight.w600, color: remaining > 0 ? Colors.green.shade700 : Colors.red.shade600, fontSize: 13)),
        ]),
        const SizedBox(height: 8),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: pct.clamp(0.0, 1.0),
            backgroundColor: cs.outlineVariant,
            color: remaining > 0 ? Colors.green.shade500 : Colors.red.shade400,
            minHeight: 6,
          ),
        ),
        const SizedBox(height: 6),
        Text('$used used of $maxDays days', style: TextStyle(fontSize: 12, color: cs.onSurfaceVariant)),
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
    final cs = Theme.of(context).colorScheme;
    final id = request['id'] as String? ?? '';
    final type = (request['leaveType'] ?? request['type']) as Map<String, dynamic>? ?? {};
    final typeName = type['name'] as String? ?? 'Leave';
    final status = request['status'] as String? ?? 'PENDING';
    final startDate = (request['fromDate'] ?? request['startDate']) as String? ?? '';
    final endDate = (request['toDate'] ?? request['endDate']) as String? ?? '';
    final reason = request['reason'] as String? ?? '';

    final (statusColor, statusLabel) = switch (status) {
      'APPROVED' => (Colors.green, 'Approved'),
      'REJECTED' => (Colors.red, 'Rejected'),
      _ => (Colors.orange, 'Pending'),
    };

    String fmtDate(String d) {
      try {
        return DateFormat('dd MMM yyyy').format(DateTime.parse(d));
      } catch (_) {
        return d.length >= 10 ? d.substring(0, 10) : d;
      }
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: cs.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: cs.outlineVariant),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: cs.surfaceContainerHighest,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(13)),
          ),
          child: Row(children: [
            Expanded(child: Text(typeName, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14))),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: statusColor.withAlpha(25),
                borderRadius: BorderRadius.circular(6),
                border: Border.all(color: statusColor.withAlpha(80)),
              ),
              child: Text(statusLabel, style: TextStyle(color: statusColor, fontSize: 12, fontWeight: FontWeight.w600)),
            ),
          ]),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(14, 10, 14, 12),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Icon(Icons.date_range_outlined, size: 14, color: cs.onSurfaceVariant),
              const SizedBox(width: 6),
              Text('${fmtDate(startDate)} → ${fmtDate(endDate)}',
                  style: TextStyle(fontSize: 13, color: cs.onSurface, fontWeight: FontWeight.w500)),
            ]),
            if (reason.isNotEmpty) ...[
              const SizedBox(height: 4),
              Text(reason, style: TextStyle(fontSize: 12, color: cs.onSurfaceVariant), maxLines: 2, overflow: TextOverflow.ellipsis),
            ],
            if (status == 'PENDING') ...[
              const SizedBox(height: 10),
              GestureDetector(
                onTap: () => _confirmCancel(context, id),
                child: Text('Cancel request', style: TextStyle(fontSize: 12, color: Colors.red.shade600, fontWeight: FontWeight.w600)),
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
      if (mounted) {
        Navigator.pop(context);
        widget.onApplied();
      }
    } catch (e) {
      if (mounted) setState(() { _error = e.toString(); _submitting = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final fmt = DateFormat('dd MMM yyyy');

    return Padding(
      padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(context).viewInsets.bottom + 20),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Text('Apply for Leave', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
          const Spacer(),
          IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(context)),
        ]),
        const SizedBox(height: 16),

        // Leave type
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

        // Date range
        Row(children: [
          Expanded(child: GestureDetector(
            onTap: () => _pickDate(true),
            child: InputDecorator(
              decoration: const InputDecoration(labelText: 'Start Date', prefixIcon: Icon(Icons.calendar_today, size: 18)),
              child: Text(_startDate != null ? fmt.format(_startDate!) : 'Select', style: TextStyle(color: _startDate != null ? cs.onSurface : cs.onSurfaceVariant)),
            ),
          )),
          const SizedBox(width: 12),
          Expanded(child: GestureDetector(
            onTap: () => _pickDate(false),
            child: InputDecorator(
              decoration: const InputDecoration(labelText: 'End Date', prefixIcon: Icon(Icons.calendar_today, size: 18)),
              child: Text(_endDate != null ? fmt.format(_endDate!) : 'Select', style: TextStyle(color: _endDate != null ? cs.onSurface : cs.onSurfaceVariant)),
            ),
          )),
        ]),
        const SizedBox(height: 14),

        // Reason
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
