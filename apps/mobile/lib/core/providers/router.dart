import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../features/auth/domain/auth_notifier.dart';
import '../../features/auth/presentation/login_screen.dart';
import '../../features/punch/presentation/home_screen.dart';
import '../../features/punch/presentation/history_screen.dart';
import '../../features/leaves/presentation/leaves_screen.dart';
import '../../features/profile/presentation/profile_screen.dart';
import '../../widgets/main_scaffold.dart';

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
      GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
      GoRoute(path: '/', redirect: (_, __) => '/login'),
      StatefulShellRoute.indexedStack(
        builder: (ctx, state, shell) => MainScaffold(navigationShell: shell),
        branches: [
          StatefulShellBranch(routes: [
            GoRoute(path: '/home', builder: (_, __) => const HomeScreen()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/history', builder: (_, __) => const HistoryScreen()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/leaves', builder: (_, __) => const LeavesScreen()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/profile', builder: (_, __) => const ProfileScreen()),
          ]),
        ],
      ),
    ],
  );
}

class _AuthListenable extends ChangeNotifier {
  _AuthListenable(Ref ref) {
    ref.listen(authNotifierProvider, (_, __) => notifyListeners());
  }
}
