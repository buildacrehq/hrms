import 'package:drift/drift.dart';
import 'package:drift_flutter/drift_flutter.dart';

part 'offline_db.g.dart';

class OfflinePunches extends Table {
  IntColumn get id => integer().autoIncrement()();
  TextColumn get type => text()();
  TextColumn get timestampDevice => text()();
  RealColumn get latitude => real().nullable()();
  RealColumn get longitude => real().nullable()();
  RealColumn get accuracy => real().nullable()();
  TextColumn get photoPath => text().nullable()();
  TextColumn get photoKey => text().nullable()();
  IntColumn get retryCount => integer().withDefault(const Constant(0))();
  BoolColumn get synced => boolean().withDefault(const Constant(false))();
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();
}

@DriftDatabase(tables: [OfflinePunches])
class OfflineDb extends _$OfflineDb {
  OfflineDb() : super(_openConnection());

  @override
  int get schemaVersion => 1;

  static QueryExecutor _openConnection() {
    return driftDatabase(name: 'buildacre_offline');
  }

  Future<List<OfflinePunche>> pendingPunches() =>
      (select(offlinePunches)
            ..where((t) => t.synced.equals(false))
            ..orderBy([(t) => OrderingTerm.asc(t.createdAt)]))
          .get();

  Future<int> enqueue(OfflinePunchesCompanion entry) => into(offlinePunches).insert(entry);

  Future<void> markSynced(int id) => (update(offlinePunches)..where((t) => t.id.equals(id)))
      .write(const OfflinePunchesCompanion(synced: Value(true)));

  Future<void> incrementRetry(int id) async {
    await customUpdate(
      'UPDATE offline_punches SET retry_count = retry_count + 1 WHERE id = ?',
      variables: [Variable.withInt(id)],
      updates: {offlinePunches},
    );
  }
}
