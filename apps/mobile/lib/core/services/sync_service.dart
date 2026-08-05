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
        String photoKey = punch.photoKey ?? '';

        // Upload photo only if we have a local file and no key yet
        if (punch.photoPath != null && photoKey.isEmpty) {
          final file = File(punch.photoPath!);
          if (await file.exists()) {
            try {
              final uploadUrlResp = await _dio.post(
                '/punches/upload-url',
                data: {'type': punch.type},
              );
              final uploadUrl  = uploadUrlResp.data['data']['uploadUrl'] as String;
              final uploadToken = uploadUrlResp.data['data']['uploadToken'] as String? ?? '';
              photoKey = uploadUrlResp.data['data']['photoKey'] as String;

              final bytes = await file.readAsBytes();
              final uploadClient = Dio();
              await uploadClient.put(
                uploadUrl,
                data: bytes,
                options: Options(headers: {
                  'Content-Type': 'image/jpeg',
                  'Authorization': 'Bearer $uploadToken',
                }),
              );
            } catch (_) {
              // Photo upload failed — submit punch without photo rather than lose it
              photoKey = '';
            }
          }
          // File missing — submit punch without photo rather than abandon it
        }

        await _dio.post('/punches', data: {
          'type':            punch.type,
          'timestampDevice': punch.timestampDevice,
          'lat':             punch.latitude  ?? 0,
          'long':            punch.longitude ?? 0,
          'accuracy':        punch.accuracy  ?? 0,
          'photoKey':        photoKey,
          'syncedOffline':   true,
        });

        await _db.markSynced(punch.id);
      } catch (_) {
        await _db.incrementRetry(punch.id);
      }
    }
    await _db.purgeSynced();
  }

  Future<void> flush() => _flush();
}
