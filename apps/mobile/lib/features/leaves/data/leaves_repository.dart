import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../../core/api/api_client.dart';

part 'leaves_repository.g.dart';

@riverpod
LeavesRepository leavesRepository(Ref ref) =>
    LeavesRepository(ref.read(dioProvider));

class LeavesRepository {
  LeavesRepository(this._dio);
  final Dio _dio;

  Future<List<Map<String, dynamic>>> getLeaveTypes() async {
    final resp = await _dio.get('/leaves/types');
    return (resp.data['data'] as List?)?.cast<Map<String, dynamic>>() ?? [];
  }

  Future<List<Map<String, dynamic>>> getMyRequests() async {
    final resp = await _dio.get('/leaves/my-requests');
    final data = resp.data['data'] ?? resp.data;
    return (data as List?)?.cast<Map<String, dynamic>>() ?? [];
  }

  Future<List<Map<String, dynamic>>> getMyBalance() async {
    try {
      final resp = await _dio.get('/leaves/my-balances');
      final data = resp.data['data'] ?? resp.data ?? [];
      return (data as List?)?.cast<Map<String, dynamic>>() ?? [];
    } catch (_) {
      return [];
    }
  }

  Future<void> applyLeave({
    required String typeId,
    required String startDate,
    required String endDate,
    required String reason,
  }) async {
    await _dio.post('/leaves/my-requests', data: {
      'leaveTypeId': typeId,
      'fromDate': startDate,
      'toDate': endDate,
      'reason': reason,
    });
  }

  Future<void> cancelLeave(String id) async {
    await _dio.delete('/leaves/my-requests/$id');
  }
}
