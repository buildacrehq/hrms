import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../storage/offline_db.dart';

part 'core_providers.g.dart';

@riverpod
OfflineDb offlineDb(Ref ref) => OfflineDb();
