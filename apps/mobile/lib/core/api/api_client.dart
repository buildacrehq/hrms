import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../storage/token_storage.dart';

part 'api_client.g.dart';

// 10.0.2.2 = Android emulator → host machine; localhost = macOS desktop / physical device via USB
const _baseUrl = String.fromEnvironment('API_BASE_URL', defaultValue: 'https://hrms-nydc.onrender.com/api/v1');

@riverpod
Dio dio(Ref ref) {
  final dio = Dio(BaseOptions(baseUrl: _baseUrl, connectTimeout: const Duration(seconds: 10)));
  dio.interceptors.add(_AuthInterceptor(ref));
  return dio;
}

class _AuthInterceptor extends Interceptor {
  _AuthInterceptor(this._ref);
  final Ref _ref;

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    final token = await TokenStorage.getAccessToken();
    if (token != null) options.headers['Authorization'] = 'Bearer $token';
    handler.next(options);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    if (err.response?.statusCode == 401) {
      try {
        final refreshToken = await TokenStorage.getRefreshToken();
        if (refreshToken == null) return handler.next(err);

        final dio = Dio(BaseOptions(baseUrl: _baseUrl));
        final resp = await dio.post('/auth/refresh', data: {'refreshToken': refreshToken});
        final newAccess = resp.data['data']['accessToken'] as String;
        final newRefresh = resp.data['data']['refreshToken'] as String;
        await TokenStorage.saveTokens(accessToken: newAccess, refreshToken: newRefresh);

        // Retry original request
        final opts = err.requestOptions;
        opts.headers['Authorization'] = 'Bearer $newAccess';
        final retryResp = await _ref.read(dioProvider).fetch(opts);
        return handler.resolve(retryResp);
      } catch (_) {
        await TokenStorage.clear();
        return handler.next(err);
      }
    }
    handler.next(err);
  }
}
