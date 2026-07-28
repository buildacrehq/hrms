import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../../core/api/api_client.dart';
import '../../../core/storage/token_storage.dart';

part 'auth_repository.g.dart';

@riverpod
AuthRepository authRepository(Ref ref) => AuthRepository(ref.read(dioProvider));

class AuthRepository {
  AuthRepository(this._dio);
  final Dio _dio;

  Future<Map<String, dynamic>> login(String phone, String password) async {
    final resp = await _dio.post('/auth/employee/login', data: {'phone': phone, 'password': password});
    return resp.data['data'] as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> getProfile() async {
    final resp = await _dio.get('/employees/me');
    return resp.data['data'] as Map<String, dynamic>;
  }

  Future<void> logout() async {
    await TokenStorage.clear();
  }
}
