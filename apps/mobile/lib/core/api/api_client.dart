import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../storage/token_storage.dart';

part 'api_client.g.dart';

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

  // Shared lock so concurrent 401s don't all try to refresh simultaneously
  static Future<void>? _refreshFuture;

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
        if (refreshToken == null) {
          await TokenStorage.clear();
          return handler.next(err);
        }

        // If a refresh is already in flight, wait for it then retry with the new token
        if (_refreshFuture != null) {
          try {
            await _refreshFuture;
          } catch (_) {
            return handler.next(err);
          }
          final newToken = await TokenStorage.getAccessToken();
          if (newToken == null) return handler.next(err);
          final opts = err.requestOptions;
          opts.headers['Authorization'] = 'Bearer $newToken';
          return handler.resolve(await _ref.read(dioProvider).fetch(opts));
        }

        // Start refresh — assign future so concurrent callers wait on it
        _refreshFuture = _doRefresh(refreshToken);
        try {
          await _refreshFuture;
        } finally {
          _refreshFuture = null;
        }

        final newToken = await TokenStorage.getAccessToken();
        if (newToken == null) return handler.next(err);
        final opts = err.requestOptions;
        opts.headers['Authorization'] = 'Bearer $newToken';
        return handler.resolve(await _ref.read(dioProvider).fetch(opts));
      } catch (_) {
        await TokenStorage.clear();
        return handler.next(err);
      }
    }
    handler.next(err);
  }

  Future<void> _doRefresh(String refreshToken) async {
    final dio = Dio(BaseOptions(baseUrl: _baseUrl));
    final resp = await dio.post('/auth/refresh', data: {'refreshToken': refreshToken});
    final newAccess  = resp.data['data']['accessToken']  as String;
    final newRefresh = resp.data['data']['refreshToken'] as String;
    await TokenStorage.saveTokens(accessToken: newAccess, refreshToken: newRefresh);
  }
}
