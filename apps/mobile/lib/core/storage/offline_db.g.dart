// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'offline_db.dart';

// ignore_for_file: type=lint
class $OfflinePunchesTable extends OfflinePunches
    with TableInfo<$OfflinePunchesTable, OfflinePunche> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $OfflinePunchesTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<int> id = GeneratedColumn<int>(
    'id',
    aliasedName,
    false,
    hasAutoIncrement: true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'PRIMARY KEY AUTOINCREMENT',
    ),
  );
  static const VerificationMeta _typeMeta = const VerificationMeta('type');
  @override
  late final GeneratedColumn<String> type = GeneratedColumn<String>(
    'type',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _timestampDeviceMeta = const VerificationMeta(
    'timestampDevice',
  );
  @override
  late final GeneratedColumn<String> timestampDevice = GeneratedColumn<String>(
    'timestamp_device',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _latitudeMeta = const VerificationMeta(
    'latitude',
  );
  @override
  late final GeneratedColumn<double> latitude = GeneratedColumn<double>(
    'latitude',
    aliasedName,
    true,
    type: DriftSqlType.double,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _longitudeMeta = const VerificationMeta(
    'longitude',
  );
  @override
  late final GeneratedColumn<double> longitude = GeneratedColumn<double>(
    'longitude',
    aliasedName,
    true,
    type: DriftSqlType.double,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _accuracyMeta = const VerificationMeta(
    'accuracy',
  );
  @override
  late final GeneratedColumn<double> accuracy = GeneratedColumn<double>(
    'accuracy',
    aliasedName,
    true,
    type: DriftSqlType.double,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _photoPathMeta = const VerificationMeta(
    'photoPath',
  );
  @override
  late final GeneratedColumn<String> photoPath = GeneratedColumn<String>(
    'photo_path',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _photoKeyMeta = const VerificationMeta(
    'photoKey',
  );
  @override
  late final GeneratedColumn<String> photoKey = GeneratedColumn<String>(
    'photo_key',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _retryCountMeta = const VerificationMeta(
    'retryCount',
  );
  @override
  late final GeneratedColumn<int> retryCount = GeneratedColumn<int>(
    'retry_count',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
  );
  static const VerificationMeta _syncedMeta = const VerificationMeta('synced');
  @override
  late final GeneratedColumn<bool> synced = GeneratedColumn<bool>(
    'synced',
    aliasedName,
    false,
    type: DriftSqlType.bool,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'CHECK ("synced" IN (0, 1))',
    ),
    defaultValue: const Constant(false),
  );
  static const VerificationMeta _createdAtMeta = const VerificationMeta(
    'createdAt',
  );
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
    'created_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
    defaultValue: currentDateAndTime,
  );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    type,
    timestampDevice,
    latitude,
    longitude,
    accuracy,
    photoPath,
    photoKey,
    retryCount,
    synced,
    createdAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'offline_punches';
  @override
  VerificationContext validateIntegrity(
    Insertable<OfflinePunche> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    }
    if (data.containsKey('type')) {
      context.handle(
        _typeMeta,
        type.isAcceptableOrUnknown(data['type']!, _typeMeta),
      );
    } else if (isInserting) {
      context.missing(_typeMeta);
    }
    if (data.containsKey('timestamp_device')) {
      context.handle(
        _timestampDeviceMeta,
        timestampDevice.isAcceptableOrUnknown(
          data['timestamp_device']!,
          _timestampDeviceMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_timestampDeviceMeta);
    }
    if (data.containsKey('latitude')) {
      context.handle(
        _latitudeMeta,
        latitude.isAcceptableOrUnknown(data['latitude']!, _latitudeMeta),
      );
    }
    if (data.containsKey('longitude')) {
      context.handle(
        _longitudeMeta,
        longitude.isAcceptableOrUnknown(data['longitude']!, _longitudeMeta),
      );
    }
    if (data.containsKey('accuracy')) {
      context.handle(
        _accuracyMeta,
        accuracy.isAcceptableOrUnknown(data['accuracy']!, _accuracyMeta),
      );
    }
    if (data.containsKey('photo_path')) {
      context.handle(
        _photoPathMeta,
        photoPath.isAcceptableOrUnknown(data['photo_path']!, _photoPathMeta),
      );
    }
    if (data.containsKey('photo_key')) {
      context.handle(
        _photoKeyMeta,
        photoKey.isAcceptableOrUnknown(data['photo_key']!, _photoKeyMeta),
      );
    }
    if (data.containsKey('retry_count')) {
      context.handle(
        _retryCountMeta,
        retryCount.isAcceptableOrUnknown(data['retry_count']!, _retryCountMeta),
      );
    }
    if (data.containsKey('synced')) {
      context.handle(
        _syncedMeta,
        synced.isAcceptableOrUnknown(data['synced']!, _syncedMeta),
      );
    }
    if (data.containsKey('created_at')) {
      context.handle(
        _createdAtMeta,
        createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  OfflinePunche map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return OfflinePunche(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}id'],
      )!,
      type: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}type'],
      )!,
      timestampDevice: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}timestamp_device'],
      )!,
      latitude: attachedDatabase.typeMapping.read(
        DriftSqlType.double,
        data['${effectivePrefix}latitude'],
      ),
      longitude: attachedDatabase.typeMapping.read(
        DriftSqlType.double,
        data['${effectivePrefix}longitude'],
      ),
      accuracy: attachedDatabase.typeMapping.read(
        DriftSqlType.double,
        data['${effectivePrefix}accuracy'],
      ),
      photoPath: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}photo_path'],
      ),
      photoKey: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}photo_key'],
      ),
      retryCount: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}retry_count'],
      )!,
      synced: attachedDatabase.typeMapping.read(
        DriftSqlType.bool,
        data['${effectivePrefix}synced'],
      )!,
      createdAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}created_at'],
      )!,
    );
  }

  @override
  $OfflinePunchesTable createAlias(String alias) {
    return $OfflinePunchesTable(attachedDatabase, alias);
  }
}

class OfflinePunche extends DataClass implements Insertable<OfflinePunche> {
  final int id;
  final String type;
  final String timestampDevice;
  final double? latitude;
  final double? longitude;
  final double? accuracy;
  final String? photoPath;
  final String? photoKey;
  final int retryCount;
  final bool synced;
  final DateTime createdAt;
  const OfflinePunche({
    required this.id,
    required this.type,
    required this.timestampDevice,
    this.latitude,
    this.longitude,
    this.accuracy,
    this.photoPath,
    this.photoKey,
    required this.retryCount,
    required this.synced,
    required this.createdAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<int>(id);
    map['type'] = Variable<String>(type);
    map['timestamp_device'] = Variable<String>(timestampDevice);
    if (!nullToAbsent || latitude != null) {
      map['latitude'] = Variable<double>(latitude);
    }
    if (!nullToAbsent || longitude != null) {
      map['longitude'] = Variable<double>(longitude);
    }
    if (!nullToAbsent || accuracy != null) {
      map['accuracy'] = Variable<double>(accuracy);
    }
    if (!nullToAbsent || photoPath != null) {
      map['photo_path'] = Variable<String>(photoPath);
    }
    if (!nullToAbsent || photoKey != null) {
      map['photo_key'] = Variable<String>(photoKey);
    }
    map['retry_count'] = Variable<int>(retryCount);
    map['synced'] = Variable<bool>(synced);
    map['created_at'] = Variable<DateTime>(createdAt);
    return map;
  }

  OfflinePunchesCompanion toCompanion(bool nullToAbsent) {
    return OfflinePunchesCompanion(
      id: Value(id),
      type: Value(type),
      timestampDevice: Value(timestampDevice),
      latitude: latitude == null && nullToAbsent
          ? const Value.absent()
          : Value(latitude),
      longitude: longitude == null && nullToAbsent
          ? const Value.absent()
          : Value(longitude),
      accuracy: accuracy == null && nullToAbsent
          ? const Value.absent()
          : Value(accuracy),
      photoPath: photoPath == null && nullToAbsent
          ? const Value.absent()
          : Value(photoPath),
      photoKey: photoKey == null && nullToAbsent
          ? const Value.absent()
          : Value(photoKey),
      retryCount: Value(retryCount),
      synced: Value(synced),
      createdAt: Value(createdAt),
    );
  }

  factory OfflinePunche.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return OfflinePunche(
      id: serializer.fromJson<int>(json['id']),
      type: serializer.fromJson<String>(json['type']),
      timestampDevice: serializer.fromJson<String>(json['timestampDevice']),
      latitude: serializer.fromJson<double?>(json['latitude']),
      longitude: serializer.fromJson<double?>(json['longitude']),
      accuracy: serializer.fromJson<double?>(json['accuracy']),
      photoPath: serializer.fromJson<String?>(json['photoPath']),
      photoKey: serializer.fromJson<String?>(json['photoKey']),
      retryCount: serializer.fromJson<int>(json['retryCount']),
      synced: serializer.fromJson<bool>(json['synced']),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<int>(id),
      'type': serializer.toJson<String>(type),
      'timestampDevice': serializer.toJson<String>(timestampDevice),
      'latitude': serializer.toJson<double?>(latitude),
      'longitude': serializer.toJson<double?>(longitude),
      'accuracy': serializer.toJson<double?>(accuracy),
      'photoPath': serializer.toJson<String?>(photoPath),
      'photoKey': serializer.toJson<String?>(photoKey),
      'retryCount': serializer.toJson<int>(retryCount),
      'synced': serializer.toJson<bool>(synced),
      'createdAt': serializer.toJson<DateTime>(createdAt),
    };
  }

  OfflinePunche copyWith({
    int? id,
    String? type,
    String? timestampDevice,
    Value<double?> latitude = const Value.absent(),
    Value<double?> longitude = const Value.absent(),
    Value<double?> accuracy = const Value.absent(),
    Value<String?> photoPath = const Value.absent(),
    Value<String?> photoKey = const Value.absent(),
    int? retryCount,
    bool? synced,
    DateTime? createdAt,
  }) => OfflinePunche(
    id: id ?? this.id,
    type: type ?? this.type,
    timestampDevice: timestampDevice ?? this.timestampDevice,
    latitude: latitude.present ? latitude.value : this.latitude,
    longitude: longitude.present ? longitude.value : this.longitude,
    accuracy: accuracy.present ? accuracy.value : this.accuracy,
    photoPath: photoPath.present ? photoPath.value : this.photoPath,
    photoKey: photoKey.present ? photoKey.value : this.photoKey,
    retryCount: retryCount ?? this.retryCount,
    synced: synced ?? this.synced,
    createdAt: createdAt ?? this.createdAt,
  );
  OfflinePunche copyWithCompanion(OfflinePunchesCompanion data) {
    return OfflinePunche(
      id: data.id.present ? data.id.value : this.id,
      type: data.type.present ? data.type.value : this.type,
      timestampDevice: data.timestampDevice.present
          ? data.timestampDevice.value
          : this.timestampDevice,
      latitude: data.latitude.present ? data.latitude.value : this.latitude,
      longitude: data.longitude.present ? data.longitude.value : this.longitude,
      accuracy: data.accuracy.present ? data.accuracy.value : this.accuracy,
      photoPath: data.photoPath.present ? data.photoPath.value : this.photoPath,
      photoKey: data.photoKey.present ? data.photoKey.value : this.photoKey,
      retryCount: data.retryCount.present
          ? data.retryCount.value
          : this.retryCount,
      synced: data.synced.present ? data.synced.value : this.synced,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('OfflinePunche(')
          ..write('id: $id, ')
          ..write('type: $type, ')
          ..write('timestampDevice: $timestampDevice, ')
          ..write('latitude: $latitude, ')
          ..write('longitude: $longitude, ')
          ..write('accuracy: $accuracy, ')
          ..write('photoPath: $photoPath, ')
          ..write('photoKey: $photoKey, ')
          ..write('retryCount: $retryCount, ')
          ..write('synced: $synced, ')
          ..write('createdAt: $createdAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    id,
    type,
    timestampDevice,
    latitude,
    longitude,
    accuracy,
    photoPath,
    photoKey,
    retryCount,
    synced,
    createdAt,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is OfflinePunche &&
          other.id == this.id &&
          other.type == this.type &&
          other.timestampDevice == this.timestampDevice &&
          other.latitude == this.latitude &&
          other.longitude == this.longitude &&
          other.accuracy == this.accuracy &&
          other.photoPath == this.photoPath &&
          other.photoKey == this.photoKey &&
          other.retryCount == this.retryCount &&
          other.synced == this.synced &&
          other.createdAt == this.createdAt);
}

class OfflinePunchesCompanion extends UpdateCompanion<OfflinePunche> {
  final Value<int> id;
  final Value<String> type;
  final Value<String> timestampDevice;
  final Value<double?> latitude;
  final Value<double?> longitude;
  final Value<double?> accuracy;
  final Value<String?> photoPath;
  final Value<String?> photoKey;
  final Value<int> retryCount;
  final Value<bool> synced;
  final Value<DateTime> createdAt;
  const OfflinePunchesCompanion({
    this.id = const Value.absent(),
    this.type = const Value.absent(),
    this.timestampDevice = const Value.absent(),
    this.latitude = const Value.absent(),
    this.longitude = const Value.absent(),
    this.accuracy = const Value.absent(),
    this.photoPath = const Value.absent(),
    this.photoKey = const Value.absent(),
    this.retryCount = const Value.absent(),
    this.synced = const Value.absent(),
    this.createdAt = const Value.absent(),
  });
  OfflinePunchesCompanion.insert({
    this.id = const Value.absent(),
    required String type,
    required String timestampDevice,
    this.latitude = const Value.absent(),
    this.longitude = const Value.absent(),
    this.accuracy = const Value.absent(),
    this.photoPath = const Value.absent(),
    this.photoKey = const Value.absent(),
    this.retryCount = const Value.absent(),
    this.synced = const Value.absent(),
    this.createdAt = const Value.absent(),
  }) : type = Value(type),
       timestampDevice = Value(timestampDevice);
  static Insertable<OfflinePunche> custom({
    Expression<int>? id,
    Expression<String>? type,
    Expression<String>? timestampDevice,
    Expression<double>? latitude,
    Expression<double>? longitude,
    Expression<double>? accuracy,
    Expression<String>? photoPath,
    Expression<String>? photoKey,
    Expression<int>? retryCount,
    Expression<bool>? synced,
    Expression<DateTime>? createdAt,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (type != null) 'type': type,
      if (timestampDevice != null) 'timestamp_device': timestampDevice,
      if (latitude != null) 'latitude': latitude,
      if (longitude != null) 'longitude': longitude,
      if (accuracy != null) 'accuracy': accuracy,
      if (photoPath != null) 'photo_path': photoPath,
      if (photoKey != null) 'photo_key': photoKey,
      if (retryCount != null) 'retry_count': retryCount,
      if (synced != null) 'synced': synced,
      if (createdAt != null) 'created_at': createdAt,
    });
  }

  OfflinePunchesCompanion copyWith({
    Value<int>? id,
    Value<String>? type,
    Value<String>? timestampDevice,
    Value<double?>? latitude,
    Value<double?>? longitude,
    Value<double?>? accuracy,
    Value<String?>? photoPath,
    Value<String?>? photoKey,
    Value<int>? retryCount,
    Value<bool>? synced,
    Value<DateTime>? createdAt,
  }) {
    return OfflinePunchesCompanion(
      id: id ?? this.id,
      type: type ?? this.type,
      timestampDevice: timestampDevice ?? this.timestampDevice,
      latitude: latitude ?? this.latitude,
      longitude: longitude ?? this.longitude,
      accuracy: accuracy ?? this.accuracy,
      photoPath: photoPath ?? this.photoPath,
      photoKey: photoKey ?? this.photoKey,
      retryCount: retryCount ?? this.retryCount,
      synced: synced ?? this.synced,
      createdAt: createdAt ?? this.createdAt,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<int>(id.value);
    }
    if (type.present) {
      map['type'] = Variable<String>(type.value);
    }
    if (timestampDevice.present) {
      map['timestamp_device'] = Variable<String>(timestampDevice.value);
    }
    if (latitude.present) {
      map['latitude'] = Variable<double>(latitude.value);
    }
    if (longitude.present) {
      map['longitude'] = Variable<double>(longitude.value);
    }
    if (accuracy.present) {
      map['accuracy'] = Variable<double>(accuracy.value);
    }
    if (photoPath.present) {
      map['photo_path'] = Variable<String>(photoPath.value);
    }
    if (photoKey.present) {
      map['photo_key'] = Variable<String>(photoKey.value);
    }
    if (retryCount.present) {
      map['retry_count'] = Variable<int>(retryCount.value);
    }
    if (synced.present) {
      map['synced'] = Variable<bool>(synced.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('OfflinePunchesCompanion(')
          ..write('id: $id, ')
          ..write('type: $type, ')
          ..write('timestampDevice: $timestampDevice, ')
          ..write('latitude: $latitude, ')
          ..write('longitude: $longitude, ')
          ..write('accuracy: $accuracy, ')
          ..write('photoPath: $photoPath, ')
          ..write('photoKey: $photoKey, ')
          ..write('retryCount: $retryCount, ')
          ..write('synced: $synced, ')
          ..write('createdAt: $createdAt')
          ..write(')'))
        .toString();
  }
}

abstract class _$OfflineDb extends GeneratedDatabase {
  _$OfflineDb(QueryExecutor e) : super(e);
  $OfflineDbManager get managers => $OfflineDbManager(this);
  late final $OfflinePunchesTable offlinePunches = $OfflinePunchesTable(this);
  @override
  Iterable<TableInfo<Table, Object?>> get allTables =>
      allSchemaEntities.whereType<TableInfo<Table, Object?>>();
  @override
  List<DatabaseSchemaEntity> get allSchemaEntities => [offlinePunches];
}

typedef $$OfflinePunchesTableCreateCompanionBuilder =
    OfflinePunchesCompanion Function({
      Value<int> id,
      required String type,
      required String timestampDevice,
      Value<double?> latitude,
      Value<double?> longitude,
      Value<double?> accuracy,
      Value<String?> photoPath,
      Value<String?> photoKey,
      Value<int> retryCount,
      Value<bool> synced,
      Value<DateTime> createdAt,
    });
typedef $$OfflinePunchesTableUpdateCompanionBuilder =
    OfflinePunchesCompanion Function({
      Value<int> id,
      Value<String> type,
      Value<String> timestampDevice,
      Value<double?> latitude,
      Value<double?> longitude,
      Value<double?> accuracy,
      Value<String?> photoPath,
      Value<String?> photoKey,
      Value<int> retryCount,
      Value<bool> synced,
      Value<DateTime> createdAt,
    });

class $$OfflinePunchesTableFilterComposer
    extends Composer<_$OfflineDb, $OfflinePunchesTable> {
  $$OfflinePunchesTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<int> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get type => $composableBuilder(
    column: $table.type,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get timestampDevice => $composableBuilder(
    column: $table.timestampDevice,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<double> get latitude => $composableBuilder(
    column: $table.latitude,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<double> get longitude => $composableBuilder(
    column: $table.longitude,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<double> get accuracy => $composableBuilder(
    column: $table.accuracy,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get photoPath => $composableBuilder(
    column: $table.photoPath,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get photoKey => $composableBuilder(
    column: $table.photoKey,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get retryCount => $composableBuilder(
    column: $table.retryCount,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<bool> get synced => $composableBuilder(
    column: $table.synced,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$OfflinePunchesTableOrderingComposer
    extends Composer<_$OfflineDb, $OfflinePunchesTable> {
  $$OfflinePunchesTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<int> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get type => $composableBuilder(
    column: $table.type,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get timestampDevice => $composableBuilder(
    column: $table.timestampDevice,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<double> get latitude => $composableBuilder(
    column: $table.latitude,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<double> get longitude => $composableBuilder(
    column: $table.longitude,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<double> get accuracy => $composableBuilder(
    column: $table.accuracy,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get photoPath => $composableBuilder(
    column: $table.photoPath,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get photoKey => $composableBuilder(
    column: $table.photoKey,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get retryCount => $composableBuilder(
    column: $table.retryCount,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<bool> get synced => $composableBuilder(
    column: $table.synced,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$OfflinePunchesTableAnnotationComposer
    extends Composer<_$OfflineDb, $OfflinePunchesTable> {
  $$OfflinePunchesTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<int> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get type =>
      $composableBuilder(column: $table.type, builder: (column) => column);

  GeneratedColumn<String> get timestampDevice => $composableBuilder(
    column: $table.timestampDevice,
    builder: (column) => column,
  );

  GeneratedColumn<double> get latitude =>
      $composableBuilder(column: $table.latitude, builder: (column) => column);

  GeneratedColumn<double> get longitude =>
      $composableBuilder(column: $table.longitude, builder: (column) => column);

  GeneratedColumn<double> get accuracy =>
      $composableBuilder(column: $table.accuracy, builder: (column) => column);

  GeneratedColumn<String> get photoPath =>
      $composableBuilder(column: $table.photoPath, builder: (column) => column);

  GeneratedColumn<String> get photoKey =>
      $composableBuilder(column: $table.photoKey, builder: (column) => column);

  GeneratedColumn<int> get retryCount => $composableBuilder(
    column: $table.retryCount,
    builder: (column) => column,
  );

  GeneratedColumn<bool> get synced =>
      $composableBuilder(column: $table.synced, builder: (column) => column);

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);
}

class $$OfflinePunchesTableTableManager
    extends
        RootTableManager<
          _$OfflineDb,
          $OfflinePunchesTable,
          OfflinePunche,
          $$OfflinePunchesTableFilterComposer,
          $$OfflinePunchesTableOrderingComposer,
          $$OfflinePunchesTableAnnotationComposer,
          $$OfflinePunchesTableCreateCompanionBuilder,
          $$OfflinePunchesTableUpdateCompanionBuilder,
          (
            OfflinePunche,
            BaseReferences<_$OfflineDb, $OfflinePunchesTable, OfflinePunche>,
          ),
          OfflinePunche,
          PrefetchHooks Function()
        > {
  $$OfflinePunchesTableTableManager(_$OfflineDb db, $OfflinePunchesTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$OfflinePunchesTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$OfflinePunchesTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$OfflinePunchesTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<int> id = const Value.absent(),
                Value<String> type = const Value.absent(),
                Value<String> timestampDevice = const Value.absent(),
                Value<double?> latitude = const Value.absent(),
                Value<double?> longitude = const Value.absent(),
                Value<double?> accuracy = const Value.absent(),
                Value<String?> photoPath = const Value.absent(),
                Value<String?> photoKey = const Value.absent(),
                Value<int> retryCount = const Value.absent(),
                Value<bool> synced = const Value.absent(),
                Value<DateTime> createdAt = const Value.absent(),
              }) => OfflinePunchesCompanion(
                id: id,
                type: type,
                timestampDevice: timestampDevice,
                latitude: latitude,
                longitude: longitude,
                accuracy: accuracy,
                photoPath: photoPath,
                photoKey: photoKey,
                retryCount: retryCount,
                synced: synced,
                createdAt: createdAt,
              ),
          createCompanionCallback:
              ({
                Value<int> id = const Value.absent(),
                required String type,
                required String timestampDevice,
                Value<double?> latitude = const Value.absent(),
                Value<double?> longitude = const Value.absent(),
                Value<double?> accuracy = const Value.absent(),
                Value<String?> photoPath = const Value.absent(),
                Value<String?> photoKey = const Value.absent(),
                Value<int> retryCount = const Value.absent(),
                Value<bool> synced = const Value.absent(),
                Value<DateTime> createdAt = const Value.absent(),
              }) => OfflinePunchesCompanion.insert(
                id: id,
                type: type,
                timestampDevice: timestampDevice,
                latitude: latitude,
                longitude: longitude,
                accuracy: accuracy,
                photoPath: photoPath,
                photoKey: photoKey,
                retryCount: retryCount,
                synced: synced,
                createdAt: createdAt,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$OfflinePunchesTableProcessedTableManager =
    ProcessedTableManager<
      _$OfflineDb,
      $OfflinePunchesTable,
      OfflinePunche,
      $$OfflinePunchesTableFilterComposer,
      $$OfflinePunchesTableOrderingComposer,
      $$OfflinePunchesTableAnnotationComposer,
      $$OfflinePunchesTableCreateCompanionBuilder,
      $$OfflinePunchesTableUpdateCompanionBuilder,
      (
        OfflinePunche,
        BaseReferences<_$OfflineDb, $OfflinePunchesTable, OfflinePunche>,
      ),
      OfflinePunche,
      PrefetchHooks Function()
    >;

class $OfflineDbManager {
  final _$OfflineDb _db;
  $OfflineDbManager(this._db);
  $$OfflinePunchesTableTableManager get offlinePunches =>
      $$OfflinePunchesTableTableManager(_db, _db.offlinePunches);
}
