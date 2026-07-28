import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../../core/storage/token_storage.dart';
import '../data/auth_repository.dart';

part 'auth_notifier.g.dart';

enum AuthStatus { unknown, unauthenticated, authenticated }

class AuthState {
  const AuthState({
    this.status = AuthStatus.unknown,
    this.employee,
    this.error,
  });

  final AuthStatus status;
  final Map<String, dynamic>? employee;
  final String? error;

  AuthState copyWith({AuthStatus? status, Map<String, dynamic>? employee, String? error}) {
    return AuthState(
      status: status ?? this.status,
      employee: employee ?? this.employee,
      error: error,
    );
  }
}

@riverpod
class AuthNotifier extends _$AuthNotifier {
  @override
  AuthState build() {
    _init();
    return const AuthState();
  }

  Future<void> _init() async {
    final token = await TokenStorage.getAccessToken();
    if (token == null) {
      state = const AuthState(status: AuthStatus.unauthenticated);
      return;
    }
    try {
      final profile = await ref.read(authRepositoryProvider).getProfile();
      state = AuthState(status: AuthStatus.authenticated, employee: profile);
    } catch (_) {
      state = const AuthState(status: AuthStatus.unauthenticated);
    }
  }

  Future<void> login(String phone, String password) async {
    try {
      final data = await ref.read(authRepositoryProvider).login(phone, password);
      await TokenStorage.saveTokens(
        accessToken: data['accessToken'] as String,
        refreshToken: data['refreshToken'] as String,
      );
      final profile = data['employee'] as Map<String, dynamic>;
      state = AuthState(status: AuthStatus.authenticated, employee: profile);
    } catch (e) {
      state = state.copyWith(status: AuthStatus.unauthenticated, error: _message(e));
    }
  }

  Future<void> logout() async {
    await ref.read(authRepositoryProvider).logout();
    state = const AuthState(status: AuthStatus.unauthenticated);
  }

  String _message(Object e) {
    if (e is Exception) return e.toString().replaceAll('Exception: ', '');
    return 'Something went wrong';
  }
}
