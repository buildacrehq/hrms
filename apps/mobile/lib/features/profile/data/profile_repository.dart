import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../../core/api/api_client.dart';

part 'profile_repository.g.dart';

@riverpod
ProfileRepository profileRepository(Ref ref) =>
    ProfileRepository(ref.read(dioProvider));

class ProfileRepository {
  ProfileRepository(this._dio);
  final Dio _dio;

  Future<Map<String, dynamic>> getMyProfile() async {
    final resp = await _dio.get('/employees/me');
    return resp.data['data'] as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> getPayslipData(int year, int month) async {
    final monthKey = '$year-${month.toString().padLeft(2, '0')}';
    final results = await Future.wait([
      _dio.get('/punches/me', queryParameters: {'month': monthKey}),
      _dio.get('/leaves/my-requests'),
      _dio.get('/holidays', queryParameters: {'year': year.toString()}),
    ]);
    final punchData = results[0].data['data'] as Map<String, dynamic>;
    final punches = (punchData['punches'] as List?)?.cast<Map<String, dynamic>>() ?? [];
    final leavesRaw = results[1].data['data'] ?? results[1].data;
    final leaves = (leavesRaw as List?)?.cast<Map<String, dynamic>>() ?? [];
    final holidays = (results[2].data['data'] as List?)?.cast<Map<String, dynamic>>() ?? [];
    return {'punches': punches, 'leaves': leaves, 'holidays': holidays};
  }
}
