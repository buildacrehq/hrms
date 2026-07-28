import 'dart:async';
import 'dart:io';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../api/api_client.dart';
import '../providers/core_providers.dart';
import '../storage/offline_db.dart';


part 'sync_service.g.dart';

@riverpod
SyncService syncService(Ref ref) => SyncService(ref.read(dioProvider), ref.read(offlineDbProvider));

class SyncService {
  SyncService(this._dio, this._db) {
    Connectivity().onConnectivityChanged.listen((results) {
      if (results.any((r) => r != ConnectivityResult.none)) _flush();
    });
  }

  final Dio _dio;
  final OfflineDb _db;

  Future<void> _flush() async {
    final pending = await _db.pendingPunches();
    for (final punch in pending) {
      if (punch.retryCount >= 5) continue;
      try {
        String? photoKey = punch.photoKey;

        // Upload photo if not yet uploaded
        if (punch.photoPath != null && photoKey == null) {
          final uploadUrlResp = await _dio.post('/punches/upload-url', data: {'ext': 'jpg'});
          final uploadUrl = uploadUrlResp.data['data']['uploadUrl'] as String;
          photoKey = uploadUrlResp.data['data']['key'] as String;

          final file = File(punch.photoPath!);
          await _dio.put(uploadUrl,
              data: file.openRead(),
              options: Options(headers: {'Content-Type': 'image/jpeg', 'Content-Length': file.lengthSync()}));
        }

        await _dio.post('/punches', data: {
          'type': punch.type,
          'timestampDevice': punch.timestampDevice,
          if (punch.latitude != null) 'latitude': punch.latitude,
          if (punch.longitude != null) 'longitude': punch.longitude,
          if (punch.accuracy != null) 'accuracy': punch.accuracy,
          if (photoKey != null) 'photoKey': photoKey,
        });

        await _db.markSynced(punch.id);
      } catch (_) {
        await _db.incrementRetry(punch.id);
      }
    }
  }

  Future<void> flush() => _flush();
}
