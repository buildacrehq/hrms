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

// keepAlive: GoRouter is created ONCE and never recreated.
// The redirect reads auth state fresh via ref.read each time it's triggered
// by _AuthListenable, so there is no stale closure and no login/splash flash.
@Riverpod(keepAlive: true)
GoRouter router(Ref ref) {
  return GoRouter(
    initialLocation: '/splash',
    refreshListenable: _AuthListenable(ref),
    redirect: (context, state) {
      final status = ref.read(authNotifierProvider).status;
      final path = state.matchedLocation;
      // Still checking stored token — hold on splash, never show login
      if (status == AuthStatus.unknown) {
        return path == '/splash' ? null : '/splash';
      }
      if (status == AuthStatus.unauthenticated && path != '/login') return '/login';
      if (status == AuthStatus.authenticated && path == '/login') return '/home';
      if (status == AuthStatus.authenticated && path == '/splash') return '/home';
      return null;
    },
    routes: [
      GoRoute(path: '/splash', builder: (_, _) => const _SplashScreen()),
      GoRoute(path: '/login', builder: (_, _) => const LoginScreen()),
      GoRoute(path: '/', redirect: (_, _) => '/splash'),
      StatefulShellRoute.indexedStack(
        builder: (ctx, state, shell) => MainScaffold(navigationShell: shell),
        branches: [
          StatefulShellBranch(routes: [
            GoRoute(path: '/home', builder: (_, _) => const HomeScreen()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/history', builder: (_, _) => const HistoryScreen()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/leaves', builder: (_, _) => const LeavesScreen()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/profile', builder: (_, _) => const ProfileScreen()),
          ]),
        ],
      ),
    ],
  );
}

class _AuthListenable extends ChangeNotifier {
  _AuthListenable(Ref ref) {
    ref.listen(authNotifierProvider, (_, _) => notifyListeners());
  }
}

class _SplashScreen extends StatelessWidget {
  const _SplashScreen();
  @override
  Widget build(BuildContext context) {
    return const Scaffold(body: Center(child: CircularProgressIndicator()));
  }
}
