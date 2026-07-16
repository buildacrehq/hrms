import 'dart:io';
import 'package:flutter_image_compress/flutter_image_compress.dart';
import 'package:geolocator/geolocator.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../data/punch_repository.dart';

part 'punch_notifier.g.dart';

enum PunchStatus { idle, uploadingPhoto, submitting, success, error }

class PunchState {
  const PunchState({this.status = PunchStatus.idle, this.message});
  final PunchStatus status;
  final String? message;
}

@riverpod
class PunchNotifier extends _$PunchNotifier {
  @override
  PunchState build() => const PunchState();

  /// [photo], [position], and [address] come from PunchCameraScreen.
  Future<void> submitPunch({
    required String type,
    required XFile photo,
    required Position position,
    required String address,
  }) async {
    // Step 1: Compress and upload photo
    state = const PunchState(status: PunchStatus.uploadingPhoto);
    String? photoKey;
    File? photoFile;

    try {
      final repo = ref.read(punchRepositoryProvider);
      final urlData = await repo.getUploadUrl(type);
      final uploadUrl = urlData['uploadUrl'] as String;
      final uploadToken = urlData['uploadToken'] as String? ?? '';
      photoKey = urlData['photoKey'] as String;

      final compressed = await FlutterImageCompress.compressAndGetFile(
        photo.path,
        '${photo.path}_compressed.jpg',
        quality: 75,
        minWidth: 800,
        minHeight: 800,
      );
      photoFile =
          compressed != null ? File(compressed.path) : File(photo.path);
      await repo.uploadPhoto(uploadUrl, photoFile, uploadToken);
    } catch (_) {
      // Upload failed — punch still submitted without photo key (admin will see no photo)
    }

    // Step 2: Submit punch record
    state = const PunchState(status: PunchStatus.submitting);
    try {
      await ref.read(punchRepositoryProvider).submitPunch(
            type: type,
            timestampDevice: DateTime.now(),
            position: position,
            address: address,
            photo: photoFile,
            photoKey: photoKey,
          );
      state = PunchState(status: PunchStatus.success, message: 'Punch $type recorded');
    } catch (e) {
      final msg = e
          .toString()
          .replaceAll('Exception: ', '')
          .replaceAll('DioException [bad response]: ', '');
      state = PunchState(status: PunchStatus.error, message: msg);
    }
  }

  void reset() => state = const PunchState();
}
