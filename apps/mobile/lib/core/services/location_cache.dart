import 'package:geolocator/geolocator.dart';

/// App-wide location cache — avoids repeated GPS fetches within 60 seconds.
class LocationCache {
  LocationCache._();

  static Position? _position;
  static String?   _address;
  static DateTime? _fetchedAt;

  static const _ttl        = Duration(minutes: 1);
  static const _nearbyMeters = 50.0;

  static bool get isValid {
    if (_position == null || _fetchedAt == null) return false;
    return DateTime.now().difference(_fetchedAt!) < _ttl;
  }

  static Position? get position => _position;
  static String?   get address  => _address;

  static void update(Position pos, {String? address}) {
    _position  = pos;
    _address   = address ?? _address;
    _fetchedAt = DateTime.now();
  }

  static void updateAddress(String address) {
    _address = address;
    // don't reset fetchedAt — address is just an enrichment
  }

  /// True if [newPos] is within 50 m of the cached position — address is still valid.
  static bool isNearCached(Position newPos) {
    if (_position == null) return false;
    return Geolocator.distanceBetween(
      _position!.latitude, _position!.longitude,
      newPos.latitude,     newPos.longitude,
    ) < _nearbyMeters;
  }

  static void invalidate() => _fetchedAt = null;
}
