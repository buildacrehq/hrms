import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:path_provider/path_provider.dart';

// macOS Keychain requires signing certs in debug — use plain file storage on desktop.
// On Android/iOS, flutter_secure_storage uses the platform keystore (safe).
class TokenStorage {
  static const _keyAccess = 'access_token';
  static const _keyRefresh = 'refresh_token';

  static bool get _useFile => !kIsWeb && (Platform.isMacOS || Platform.isLinux || Platform.isWindows);

  // --- file-based (macOS/desktop dev) ---
  static Future<File> _file(String key) async {
    final dir = await getApplicationSupportDirectory();
    return File('${dir.path}/$key.tok');
  }

  static Future<String?> _fileRead(String key) async {
    try {
      final f = await _file(key);
      return await f.exists() ? await f.readAsString() : null;
    } catch (_) { return null; }
  }

  static Future<void> _fileWrite(String key, String value) async {
    final f = await _file(key);
    await f.writeAsString(value);
  }

  static Future<void> _fileDelete(String key) async {
    final f = await _file(key);
    if (await f.exists()) await f.delete();
  }

  // --- secure storage (iOS / Android) ---
  static const _store = FlutterSecureStorage();

  // --- public API ---
  static Future<String?> getAccessToken() =>
      _useFile ? _fileRead(_keyAccess) : _store.read(key: _keyAccess);

  static Future<String?> getRefreshToken() =>
      _useFile ? _fileRead(_keyRefresh) : _store.read(key: _keyRefresh);

  static Future<void> saveTokens({required String accessToken, required String refreshToken}) async {
    if (_useFile) {
      await _fileWrite(_keyAccess, accessToken);
      await _fileWrite(_keyRefresh, refreshToken);
    } else {
      await _store.write(key: _keyAccess, value: accessToken);
      await _store.write(key: _keyRefresh, value: refreshToken);
    }
  }

  static Future<void> clear() async {
    if (_useFile) {
      await _fileDelete(_keyAccess);
      await _fileDelete(_keyRefresh);
    } else {
      await _store.deleteAll();
    }
  }
}
