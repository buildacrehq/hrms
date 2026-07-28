import 'dart:io';
import 'package:dio/dio.dart';
import 'package:drift/drift.dart' as drift;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../../core/api/api_client.dart';
import '../../../core/providers/core_providers.dart';
import '../../../core/storage/offline_db.dart';

part 'punch_repository.g.dart';

@riverpod
PunchRepository punchRepository(Ref ref) =>
    PunchRepository(ref.read(dioProvider), ref.read(offlineDbProvider));

class PunchRepository {
  PunchRepository(this._dio, this._db);
  final Dio _dio;
  final OfflineDb _db;

  /// Gets a Supabase signed upload URL + token. [type] must be 'IN' or 'OUT'.
  Future<Map<String, dynamic>> getUploadUrl(String type) async {
    final resp = await _dio.post('/punches/upload-url', data: {'type': type});
    return resp.data['data'] as Map<String, dynamic>;
  }

  /// Uploads photo directly to Supabase Storage using the signed upload token.
  /// Uses a clean Dio (no auth interceptor) so the employee JWT is NOT sent.
  Future<void> uploadPhoto(String uploadUrl, File photo, String uploadToken) async {
    final uploadClient = Dio(BaseOptions(
      connectTimeout: const Duration(seconds: 30),
      sendTimeout: const Duration(seconds: 60),
    ));
    final bytes = await photo.readAsBytes();
    await uploadClient.put(
      uploadUrl,
      data: bytes,
      options: Options(
        headers: {
          'Content-Type': 'image/jpeg',
          'Authorization': 'Bearer $uploadToken',
        },
      ),
    );
  }

  Future<void> submitPunch({
    required String type,
    required DateTime timestampDevice,
    Position? position,
    String address = '',
    File? photo,
    String? photoKey,
  }) async {
    try {
      await _dio.post('/punches', data: {
        'type': type,
        'timestampDevice': timestampDevice.toIso8601String(),
        'lat': position?.latitude ?? 0,
        'long': position?.longitude ?? 0,
        'accuracy': position?.accuracy ?? 0,
        'address': address,
        'photoKey': photoKey ?? '',
      });
    } on DioException catch (e) {
      // Server rejected the punch (4xx) — surface the error so the user knows
      if (e.response != null) {
        final msg = (e.response!.data as Map<String, dynamic>?)?['message']
            as String? ?? 'Punch failed';
        throw Exception(msg);
      }
      // Network error — save offline for later sync
      await _db.enqueue(OfflinePunchesCompanion(
        type: drift.Value(type),
        timestampDevice: drift.Value(timestampDevice.toIso8601String()),
        latitude: drift.Value(position?.latitude),
        longitude: drift.Value(position?.longitude),
        accuracy: drift.Value(position?.accuracy),
        photoPath: drift.Value(photo?.path),
        photoKey: drift.Value(photoKey),
      ));
    }
  }

  Future<List<Map<String, dynamic>>> getTodayPunches() async {
    try {
      final resp = await _dio.get('/punches/today');
      return (resp.data['data'] as List?)?.cast<Map<String, dynamic>>() ?? [];
    } catch (_) {
      return [];
    }
  }

  Future<Map<String, dynamic>> getMonthPunches(String month) async {
    final resp = await _dio.get('/punches/me', queryParameters: {'month': month});
    return resp.data['data'] as Map<String, dynamic>;
  }

  Future<String?> getPunchPhotoUrl(String punchId) async {
    try {
      final resp = await _dio.get('/punches/$punchId/photo-url');
      return (resp.data['data'] as Map<String, dynamic>?)?['signedUrl'] as String?;
    } catch (_) {
      return null;
    }
  }

  Future<List<Map<String, dynamic>>> getHolidays(int year) async {
    try {
      final resp = await _dio.get('/holidays', queryParameters: {'year': '$year'});
      final data = resp.data['data'] ?? resp.data;
      return (data as List?)?.cast<Map<String, dynamic>>() ?? [];
    } catch (_) {
      return [];
    }
  }

  Future<List<Map<String, dynamic>>> getMyLeaves() async {
    try {
      final resp = await _dio.get('/leaves/my-requests');
      final data = resp.data['data'] ?? resp.data;
      return (data as List?)?.cast<Map<String, dynamic>>() ?? [];
    } catch (_) {
      return [];
    }
  }

  Future<List<Map<String, dynamic>>> getRegularizations() async {
    try {
      final resp = await _dio.get('/regularizations/my-requests');
      final data = resp.data['data'] ?? resp.data;
      final list = (data as List?)?.cast<Map<String, dynamic>>() ?? [];
      list.sort((a, b) => (b['createdAt'] as String? ?? '').compareTo(a['createdAt'] as String? ?? ''));
      return list;
    } catch (_) {
      return [];
    }
  }

  Future<Map<String, dynamic>> submitRegularization({
    required String date,
    required String requestType,
    String? punchInTime,
    String? punchOutTime,
    required String reason,
  }) async {
    final resp = await _dio.post('/regularizations', data: {
      'date': date,
      'requestType': requestType,
      if (punchInTime != null && punchInTime.isNotEmpty) 'punchInTime': punchInTime,
      if (punchOutTime != null && punchOutTime.isNotEmpty) 'punchOutTime': punchOutTime,
      'reason': reason,
    });
    return resp.data['data'] as Map<String, dynamic>;
  }

  Future<void> cancelRegularization(String id) async {
    await _dio.delete('/regularizations/$id');
  }
}
