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

  Future<Map<String, dynamic>> getMyPunches({String? cursor}) async {
    final resp = await _dio.get('/punches/me', queryParameters: {
      if (cursor != null) 'cursor': cursor,
    });
    return resp.data['data'] as Map<String, dynamic>;
  }

  /// Returns the most recent punch record for this employee, or null if none.
  Future<Map<String, dynamic>?> getLastPunch() async {
    try {
      final resp = await _dio.get('/punches/me');
      final data = resp.data['data'] as Map<String, dynamic>;
      // API returns { punches: [...], nextCursor: "..." } sorted desc by timestampServer
      final punches = data['punches'] as List<dynamic>;
      return punches.isNotEmpty ? punches.first as Map<String, dynamic> : null;
    } catch (_) {
      return null;
    }
  }
}
