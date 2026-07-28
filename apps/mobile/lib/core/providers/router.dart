import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../features/auth/domain/auth_notifier.dart';
import '../../features/auth/presentation/login_screen.dart';
import '../../features/punch/presentation/home_screen.dart';

part 'router.g.dart';

@riverpod
GoRouter router(Ref ref) {
  final authState = ref.watch(authNotifierProvider);

  return GoRouter(
    refreshListenable: _AuthListenable(ref),
    redirect: (context, state) {
      final status = authState.status;
      final path = state.matchedLocation;

      if (status == AuthStatus.unknown) return null;
      if (status == AuthStatus.unauthenticated && path != '/login') return '/login';
      if (status == AuthStatus.authenticated && path == '/login') return '/home';
      return null;
    },
    routes: [
      GoRoute(path: '/login', builder: (_, _) => const LoginScreen()),
      GoRoute(path: '/home', builder: (_, _) => const HomeScreen()),
      GoRoute(path: '/', redirect: (_, _) => '/login'),
    ],
  );
}

class _AuthListenable extends ChangeNotifier {
  _AuthListenable(Ref ref) {
    ref.listen(authNotifierProvider, (_, _) => notifyListeners());
  }
}
