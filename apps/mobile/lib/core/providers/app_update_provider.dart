import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../api/api_client.dart';

part 'app_update_provider.g.dart';

class UpdateInfo {
  const UpdateInfo({required this.latestVersion, required this.downloadUrl});
  final String latestVersion;
  final String downloadUrl;
}

@riverpod
Future<UpdateInfo?> appUpdate(Ref ref) async {
  try {
    final dio = ref.read(dioProvider);
    // Public endpoint — no auth required
    final resp = await dio.get(
      '/settings/mobile',
      options: Options(extra: {'skipAuth': true}),
    );
    final data = (resp.data as Map<String, dynamic>?) ?? {};
    final latestStr = data['app_latest_version'] as String?;
    final apkUrl    = data['app_apk_url']         as String?;
    if (latestStr == null || latestStr.isEmpty) return null;
    if (apkUrl    == null || apkUrl.isEmpty)    return null;

    final info       = await PackageInfo.fromPlatform();
    final currentStr = info.version; // from pubspec version field

    if (_isNewer(latestStr, currentStr)) {
      return UpdateInfo(latestVersion: latestStr, downloadUrl: apkUrl);
    }
    return null;
  } catch (_) {
    // Never block the app — silent failure is correct here
    return null;
  }
}

/// Returns true if [latest] is a higher semantic version than [current].
bool _isNewer(String latest, String current) {
  List<int> parse(String v) =>
      v.split('.').map((p) => int.tryParse(p.trim()) ?? 0).toList();
  final a = parse(latest);
  final b = parse(current);
  for (var i = 0; i < 3; i++) {
    final ai = i < a.length ? a[i] : 0;
    final bi = i < b.length ? b[i] : 0;
    if (ai > bi) return true;
    if (ai < bi) return false;
  }
  return false;
}
