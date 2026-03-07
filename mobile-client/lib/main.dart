import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const SpatialTracerApp());
}

class SpatialTracerApp extends StatelessWidget {
  const SpatialTracerApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Spatial Tracer',
      theme: ThemeData.dark().copyWith(
        scaffoldBackgroundColor: const Color(0xFF0F172A),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFF7C6AFF),
          secondary: Color(0xFF34D399),
          surface: Color(0xFF1E293B),
        ),
      ),
      home: const ControlPanelPage(),
    );
  }
}

class ControlPanelPage extends StatefulWidget {
  const ControlPanelPage({super.key});

  @override
  State<ControlPanelPage> createState() => _ControlPanelPageState();
}

class _ControlPanelPageState extends State<ControlPanelPage> {
  static const _channel = MethodChannel('com.rajtewari/hand_tracker');
  
  bool _isActive = false;
  bool _hasOverlayPermission = false;

  @override
  void initState() {
    super.initState();
    _checkPermissions();
  }

  Future<void> _checkPermissions() async {
    try {
      final hasPerm = await _channel.invokeMethod<bool>('checkOverlayPermission');
      if (mounted) {
        setState(() {
          _hasOverlayPermission = hasPerm ?? false;
        });
      }
    } catch (e) {
      debugPrint("Permission check error: $e");
    }
  }

  Future<void> _toggleService() async {
    try {
      if (_isActive) {
        await _channel.invokeMethod('stopService');
        setState(() => _isActive = false);
      } else {
        await _channel.invokeMethod('startService');
        setState(() => _isActive = true);
      }
    } on PlatformException catch (e) {
      if (e.code == 'PERMISSION_DENIED') {
        _showWarningSnackBar("Overlay permission required. Please enable it in Settings.");
        _checkPermissions(); // Re-check after returning from settings
      } else {
        _showWarningSnackBar("Error: ${e.message}");
      }
    }
  }

  Future<void> _openAccessibilitySettings() async {
    try {
      await _channel.invokeMethod('openAccessibilitySettings');
      _showWarningSnackBar("Enable 'Spatial Tracer' under Installed Services.");
    } catch (e) {
      _showWarningSnackBar("Could not open settings.");
    }
  }

  void _showWarningSnackBar(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message, style: const TextStyle(color: Colors.white)),
        backgroundColor: Colors.redAccent,
      )
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text("Spatial Tracer Control Panel"),
        elevation: 0,
        backgroundColor: Colors.transparent,
      ),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(
                Icons.waving_hand_rounded,
                size: 80,
                color: Color(0xFF7C6AFF),
              ),
              const SizedBox(height: 24),
              const Text(
                "System-Wide Air Gestures",
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
              const SizedBox(height: 12),
              const Text(
                "Control your entire Android device using hand tracking in the background. The camera stays active even when this app is closed.",
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white70, fontSize: 16),
              ),
              const SizedBox(height: 48),

              // Permissions Section
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFF1E293B),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFF334155)),
                ),
                child: Column(
                  children: [
                    ListTile(
                      leading: Icon(
                        _hasOverlayPermission ? Icons.check_circle : Icons.warning,
                        color: _hasOverlayPermission ? Colors.greenAccent : Colors.amber,
                      ),
                      title: const Text("Display Over Other Apps"),
                      subtitle: const Text("Required for floating cursor"),
                      trailing: _hasOverlayPermission 
                          ? null 
                          : TextButton(
                              onPressed: () => _channel.invokeMethod('startService'), // Triggers permission prompt
                              child: const Text("GRANT"),
                            ),
                    ),
                    const Divider(color: Color(0xFF334155)),
                    ListTile(
                      leading: const Icon(Icons.accessibility_new, color: Colors.amber),
                      title: const Text("Accessibility Service"),
                      subtitle: const Text("Required to simulate clicks/swipes"),
                      trailing: TextButton(
                        onPressed: _openAccessibilitySettings,
                        child: const Text("ENABLE"),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 48),

              // Main Toggle Button
              GestureDetector(
                onTap: _toggleService,
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 300),
                  width: 200,
                  height: 200,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: _isActive ? const Color(0xFFEF4444) : const Color(0xFF34D399),
                    boxShadow: [
                      BoxShadow(
                        color: (_isActive ? const Color(0xFFEF4444) : const Color(0xFF34D399)).withOpacity(0.4),
                        blurRadius: 30,
                        spreadRadius: 10,
                      )
                    ],
                  ),
                  child: Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          _isActive ? Icons.stop_rounded : Icons.play_arrow_rounded,
                          size: 64,
                          color: Colors.white,
                        ),
                        const SizedBox(height: 8),
                        Text(
                          _isActive ? "STOP" : "START",
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 24,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 2,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
