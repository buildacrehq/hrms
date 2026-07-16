import 'package:camera/camera.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';

class PunchCaptureResult {
  final XFile photo;
  final Position position;
  final String address;
  const PunchCaptureResult({required this.photo, required this.position, required this.address});
}

class PunchCameraScreen extends StatefulWidget {
  const PunchCameraScreen({super.key});

  @override
  State<PunchCameraScreen> createState() => _PunchCameraScreenState();
}

class _PunchCameraScreenState extends State<PunchCameraScreen>
    with WidgetsBindingObserver {
  List<CameraDescription> _cameras = [];
  int _camIndex = 0;
  CameraController? _ctrl;
  bool _cameraReady = false;
  bool _cameraError = false;
  bool _switching = false;
  bool _capturing = false;

  Position? _position;
  String _gpsText = 'Getting location…';
  bool _gpsReady = false;
  bool _gpsFailed = false;

  FlashMode _flash = FlashMode.off;

  bool _requireFaceDetection = true; // default safe — overridden by API setting
  bool _detecting = false;
  bool _faceError = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _initCamera();
    _startGps();
    _fetchFaceSetting();
  }

  Future<void> _fetchFaceSetting() async {
    try {
      final baseUrl = const String.fromEnvironment(
        'API_BASE_URL',
        defaultValue: 'http://localhost:3000/api/v1',
      );
      final resp = await Dio().get(
        '$baseUrl/settings/mobile',
        options: Options(receiveTimeout: const Duration(seconds: 5)),
      );
      final data = resp.data['data'] as Map<String, dynamic>? ?? resp.data as Map<String, dynamic>? ?? {};
      if (mounted) {
        setState(() {
          _requireFaceDetection = (data['require_face_detection'] as String? ?? 'true') == 'true';
        });
      }
    } catch (_) {
      // Keep default: true
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _ctrl?.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (_ctrl == null || !(_ctrl?.value.isInitialized ?? false)) return;
    if (state == AppLifecycleState.inactive) {
      _ctrl?.dispose();
      _ctrl = null;
    } else if (state == AppLifecycleState.resumed) {
      _startController(_cameras.isNotEmpty ? _cameras[_camIndex] : null);
    }
  }

  Future<void> _initCamera() async {
    try {
      final all = await availableCameras();
      if (all.isEmpty) {
        if (mounted) setState(() => _cameraError = true);
        return;
      }
      // Sort: front cameras first so index 0 = front by default
      all.sort((a, b) {
        final aFront = a.lensDirection == CameraLensDirection.front ? 0 : 1;
        final bFront = b.lensDirection == CameraLensDirection.front ? 0 : 1;
        return aFront.compareTo(bFront);
      });
      _cameras = all;
      _camIndex = 0;
      await _startController(_cameras[0]);
    } catch (_) {
      if (mounted) setState(() => _cameraError = true);
    }
  }

  Future<void> _startController(CameraDescription? cam) async {
    if (cam == null) return;
    await _ctrl?.dispose();
    _ctrl = null;
    if (mounted) setState(() => _cameraReady = false);
    try {
      final ctrl = CameraController(
        cam,
        ResolutionPreset.high,
        enableAudio: false,
        imageFormatGroup: ImageFormatGroup.jpeg,
      );
      await ctrl.initialize();
      if (!mounted) {
        ctrl.dispose();
        return;
      }
      setState(() {
        _ctrl = ctrl;
        _cameraReady = true;
        _cameraError = false;
      });
    } catch (_) {
      if (mounted) setState(() => _cameraError = true);
    }
  }

  Future<void> _flipCamera() async {
    if (_cameras.length < 2 || _switching) return;
    setState(() => _switching = true);
    _camIndex = (_camIndex + 1) % _cameras.length;
    await _startController(_cameras[_camIndex]);
    if (mounted) setState(() => _switching = false);
  }

  Future<void> _startGps() async {
    if (mounted) {
      setState(() {
        _gpsReady = false;
        _gpsFailed = false;
        _gpsText = 'Getting location…';
      });
    }
    try {
      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) {
        perm = await Geolocator.requestPermission();
      }
      if (perm == LocationPermission.deniedForever ||
          perm == LocationPermission.denied) {
        if (mounted) {
          setState(() {
            _gpsFailed = true;
            _gpsText = 'Location permission denied. Enable in Settings.';
          });
        }
        return;
      }

      final pos = await Geolocator.getCurrentPosition(
        locationSettings:
            const LocationSettings(accuracy: LocationAccuracy.high),
      ).timeout(const Duration(seconds: 15));

      if (!mounted) return;
      setState(() {
        _position = pos;
        _gpsText = '${pos.latitude.toStringAsFixed(5)}°, ${pos.longitude.toStringAsFixed(5)}°';
        _gpsReady = true;
      });

      // Reverse-geocode in background for human-readable address
      _reverseGeocode(pos);
    } catch (_) {
      if (mounted) {
        setState(() {
          _gpsFailed = true;
          _gpsText = 'Could not get location. Tap retry.';
        });
      }
    }
  }

  Future<void> _reverseGeocode(Position pos) async {
    try {
      final resp = await Dio().get(
        'https://nominatim.openstreetmap.org/reverse',
        queryParameters: {
          'lat': pos.latitude,
          'lon': pos.longitude,
          'format': 'json',
          'addressdetails': 1,
        },
        options: Options(
          headers: {
            'User-Agent': 'BA-Workforce/1.0',
            'Accept-Language': 'en',
          },
          receiveTimeout: const Duration(seconds: 8),
        ),
      );
      final data = resp.data as Map<String, dynamic>;
      final addr = data['address'] as Map<String, dynamic>? ?? {};

      final parts = <String>[];
      // Include amenity (shop/restaurant name), house number, road, suburb, city
      for (final key in [
        'amenity',
        'house_number',
        'road',
        'suburb',
        'neighbourhood',
        'city_district',
        'city',
        'town',
        'village',
      ]) {
        final v = addr[key] as String?;
        if (v != null && v.isNotEmpty && !parts.contains(v)) parts.add(v);
        if (parts.length == 5) break;
      }
      final postcode = addr['postcode'] as String? ?? '';
      final state = addr['state'] as String? ?? '';
      final line = parts.join(', ');
      String full = line;
      if (postcode.isNotEmpty) full += ' - $postcode';
      if (state.isNotEmpty && !full.contains(state)) full += ', $state';

      if (mounted && full.isNotEmpty) {
        setState(() => _gpsText = full);
      }
    } catch (_) {
      // Keep showing coordinates if geocoding fails
    }
  }

  Future<void> _toggleFlash() async {
    if (_ctrl == null || !_cameraReady) return;
    final next = _flash == FlashMode.off ? FlashMode.torch : FlashMode.off;
    await _ctrl!.setFlashMode(next);
    if (mounted) setState(() => _flash = next);
  }

  Future<void> _capture() async {
    if (!_cameraReady || _capturing || _ctrl == null || !_gpsReady) return;
    HapticFeedback.mediumImpact();
    setState(() { _capturing = true; _faceError = false; });

    try {
      final photo = await _ctrl!.takePicture();

      // ── Face detection ──────────────────────────────────────────────────────
      if (_requireFaceDetection) {
        setState(() => _detecting = true);
        try {
          final inputImage = InputImage.fromFilePath(photo.path);
          final detector = FaceDetector(
            options: FaceDetectorOptions(
              performanceMode: FaceDetectorMode.fast,
              enableClassification: false,
              enableLandmarks: false,
              enableContours: false,
              enableTracking: false,
              minFaceSize: 0.1,
            ),
          );
          final faces = await detector.processImage(inputImage);
          await detector.close();

          if (faces.isEmpty) {
            if (mounted) {
              setState(() { _capturing = false; _detecting = false; _faceError = true; });
            }
            return;
          }
        } catch (_) {
          // Detection failed (model loading) — allow punch through
        }
        if (mounted) setState(() => _detecting = false);
      }
      // ────────────────────────────────────────────────────────────────────────

      if (mounted) {
        Navigator.of(context).pop(PunchCaptureResult(
          photo: photo,
          position: _position!,
          address: _gpsText,
        ));
      }
    } catch (_) {
      if (mounted) setState(() { _capturing = false; _detecting = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final isFront = _cameras.isNotEmpty &&
        _cameras[_camIndex].lensDirection == CameraLensDirection.front;

    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        fit: StackFit.expand,
        children: [
          // ── Camera preview — use native aspect ratio to avoid face distortion ──
          if (_cameraReady && _ctrl != null)
            Center(
              child: AspectRatio(
                aspectRatio: 1 / _ctrl!.value.aspectRatio,
                child: CameraPreview(_ctrl!),
              ),
            )
          else if (_cameraError)
            const Center(
              child: Text('Camera unavailable',
                  style: TextStyle(color: Colors.white60, fontSize: 16)),
            )
          else
            const Center(
                child: CircularProgressIndicator(color: Colors.white)),

          // ── Top bar ──
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: SafeArea(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
                child: Row(
                  children: [
                    IconButton(
                      onPressed: () => Navigator.pop(context),
                      icon: const Icon(Icons.close, color: Colors.white, size: 26),
                    ),
                    const Expanded(
                      child: Text(
                        'Mark Attendance',
                        style: TextStyle(
                            color: Colors.white,
                            fontSize: 17,
                            fontWeight: FontWeight.bold),
                      ),
                    ),
                    // Flash toggle
                    if (_cameraReady && !isFront)
                      IconButton(
                        onPressed: _toggleFlash,
                        icon: Icon(
                          _flash == FlashMode.off
                              ? Icons.flash_off
                              : Icons.flash_on,
                          color: Colors.white,
                        ),
                      ),
                    // Flip camera
                    if (_cameras.length > 1)
                      IconButton(
                        onPressed: _switching ? null : _flipCamera,
                        icon: _switching
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                    strokeWidth: 2, color: Colors.white))
                            : const Icon(Icons.flip_camera_android,
                                color: Colors.white),
                      ),
                  ],
                ),
              ),
            ),
          ),

          // ── Bottom controls ──
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.bottomCenter,
                  end: Alignment.topCenter,
                  colors: [Colors.black.withAlpha(230), Colors.transparent],
                ),
              ),
              padding: const EdgeInsets.fromLTRB(24, 28, 24, 52),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // GPS / address line
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        _gpsFailed
                            ? Icons.location_off
                            : _gpsReady
                                ? Icons.location_on
                                : Icons.gps_not_fixed,
                        size: 14,
                        color: _gpsFailed
                            ? Colors.redAccent
                            : _gpsReady
                                ? Colors.greenAccent
                                : Colors.white70,
                      ),
                      const SizedBox(width: 6),
                      Flexible(
                        child: Text(
                          _gpsText,
                          style: TextStyle(
                            color: _gpsFailed
                                ? Colors.redAccent
                                : _gpsReady
                                    ? Colors.greenAccent
                                    : Colors.white70,
                            fontSize: 12,
                          ),
                          textAlign: TextAlign.center,
                          maxLines: 2,
                        ),
                      ),
                      if (!_gpsReady && !_gpsFailed) ...[
                        const SizedBox(width: 8),
                        const SizedBox(
                          width: 12,
                          height: 12,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white70),
                        ),
                      ],
                    ],
                  ),

                  if (_gpsFailed)
                    TextButton.icon(
                      onPressed: _startGps,
                      icon: const Icon(Icons.refresh,
                          color: Colors.white, size: 16),
                      label: const Text('Retry Location',
                          style: TextStyle(color: Colors.white)),
                    ),

                  const SizedBox(height: 16),

                  // ── Face error ──
                  if (_faceError)
                    Container(
                      margin: const EdgeInsets.only(bottom: 12),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 10),
                      decoration: BoxDecoration(
                        color: Colors.red.shade700.withAlpha(220),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: const [
                          Icon(Icons.face_retouching_off,
                              color: Colors.white, size: 18),
                          SizedBox(width: 8),
                          Flexible(
                            child: Text(
                              'No face detected — please look at the camera',
                              style: TextStyle(
                                  color: Colors.white, fontSize: 13),
                              textAlign: TextAlign.center,
                            ),
                          ),
                        ],
                      ),
                    ),

                  // ── Detecting indicator ──
                  if (_detecting)
                    const Padding(
                      padding: EdgeInsets.only(bottom: 12),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          SizedBox(
                            width: 14, height: 14,
                            child: CircularProgressIndicator(
                                strokeWidth: 2, color: Colors.white70),
                          ),
                          SizedBox(width: 8),
                          Text('Verifying face…',
                              style: TextStyle(
                                  color: Colors.white70, fontSize: 12)),
                        ],
                      ),
                    ),

                  // Capture button
                  GestureDetector(
                    onTap: _gpsReady && !_capturing && !_detecting ? _capture : null,
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 150),
                      width: 76,
                      height: 76,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white, width: 4),
                        color: (_capturing || !_gpsReady)
                            ? Colors.white.withAlpha(50)
                            : Colors.white,
                      ),
                      child: (_capturing || (!_gpsReady && !_gpsFailed))
                          ? Padding(
                              padding: const EdgeInsets.all(20),
                              child: CircularProgressIndicator(
                                color: _capturing
                                    ? Colors.black
                                    : Colors.white60,
                                strokeWidth: 3,
                              ),
                            )
                          : null,
                    ),
                  ),

                  if (!_gpsReady && !_gpsFailed)
                    const Padding(
                      padding: EdgeInsets.only(top: 10),
                      child: Text(
                        'Waiting for GPS…',
                        style: TextStyle(color: Colors.white54, fontSize: 11),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
