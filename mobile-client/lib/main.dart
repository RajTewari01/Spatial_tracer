import 'dart:async';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:provider/provider.dart';
import 'theme.dart';
import 'screens/creator_profile.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final prefs = await SharedPreferences.getInstance();
  final hasSeenOnboarding = prefs.getBool('has_seen_onboarding') ?? false;
  
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(statusBarColor: Colors.transparent),
  );

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => ThemeProvider()),
      ],
      child: SpatialTracerApp(hasSeenOnboarding: hasSeenOnboarding),
    ),
  );
}

class SpatialTracerApp extends StatelessWidget {
  final bool hasSeenOnboarding;
  const SpatialTracerApp({super.key, required this.hasSeenOnboarding});

  @override
  Widget build(BuildContext context) {
    final themeProvider = Provider.of<ThemeProvider>(context);

    return MaterialApp(
      title: 'Spatial Tracer',
      debugShowCheckedModeBanner: false,
      themeMode: themeProvider.themeMode,
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      home: hasSeenOnboarding ? const DashboardScreen() : const OnboardingScreen(),
    );
  }
}

// ═══════════════════════════════════════════════════════════════
//  GLASSMORPHISM HELPER
// ═══════════════════════════════════════════════════════════════

class GlassCard extends StatelessWidget {
  final Widget child;
  final double width;
  final double height;
  final double borderRadius;
  final EdgeInsetsGeometry padding;
  final Color borderColor;

  const GlassCard({
    super.key,
    required this.child,
    this.width = double.infinity,
    this.height = double.infinity,
    this.borderRadius = 24.0,
    this.padding = const EdgeInsets.all(24.0),
    this.borderColor = Colors.white10,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final effectiveBorderColor = borderColor == Colors.white10 
        ? (isDark ? Colors.white10 : Colors.black12) 
        : borderColor;

    return ClipRRect(
      borderRadius: BorderRadius.circular(borderRadius),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 16.0, sigmaY: 16.0),
        child: Container(
          width: width,
          height: height,
          padding: padding,
          decoration: BoxDecoration(
            color: Colors.black.withOpacity(0.8),
            borderRadius: BorderRadius.circular(borderRadius),
            border: Border.all(
              color: effectiveBorderColor,
              width: 1.0,
            ),
          ),
          child: child,
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════
//  INTERACTIVE ONBOARDING SCREEN
// ═══════════════════════════════════════════════════════════════

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final PageController _pageController = PageController();
  int _currentPage = 0;
  
  static const _methodChannel = MethodChannel('com.rajtewari/hand_tracker');
  static const _eventChannel = EventChannel('com.rajtewari/gesture_stream');
  StreamSubscription? _gestureSubscription;

  bool _isSuccessAnim = false;

  final List<Map<String, dynamic>> _pages = [
    {
      'icon': Icons.pan_tool_alt_rounded,
      'title': 'Form a Pointer',
      'subtitle': 'Hold up your index finger to control the physical pointer. Point your finger to the camera now to continue.',
      'requiredGesture': 'POINTING',
      'accent': const Color(0xFF0EA5E9),
    },
    {
      'icon': Icons.back_hand_rounded,
      'title': 'The Peace Tap',
      'subtitle': 'A tap is triggered by making a Peace Sign. (Index & Middle). Tap the camera with a peace sign now.',
      'requiredGesture': 'PEACE',
      'accent': const Color(0xFF8B5CF6),
    },
    {
      'icon': Icons.swipe_rounded,
      'title': 'System Control',
      'subtitle': 'Form a closed FIST to view Recent Apps. Do it now to finish setup.',
      'requiredGesture': 'FIST',
      'accent': const Color(0xFF10B981),
    },
  ];

  @override
  void initState() {
    super.initState();
    _startTrackerForOnboarding();
  }

  Future<void> _startTrackerForOnboarding() async {
    try {
      // Must have permissions to demonstrate the cursor
      final status = await Permission.camera.request();
      if (status.isGranted) {
        await _methodChannel.invokeMethod('startService');
        
        _gestureSubscription = _eventChannel.receiveBroadcastStream().listen((gesture) {
          _handleLiveGesture(gesture.toString());
        });
      } else {
        debugPrint("Camera permission denied during onboarding.");
      }
    } catch (e) {
      debugPrint("Onboarding Tracker Error: $e");
    }
  }

  void _handleLiveGesture(String gesture) {
    if (_isSuccessAnim) return; // Prevent double-triggers during transition

    final requiredGesture = _pages[_currentPage]['requiredGesture'];
    if (gesture == requiredGesture) {
      _triggerSuccessAndAdvance();
    }
  }

  Future<void> _triggerSuccessAndAdvance() async {
    setState(() => _isSuccessAnim = true);
    
    // Smooth haptic success feedback (visual)
    await Future.delayed(const Duration(milliseconds: 600));
    
    if (!mounted) return;
    
    if (_currentPage == _pages.length - 1) {
      _completeOnboarding();
    } else {
      _pageController.nextPage(
        duration: const Duration(milliseconds: 600),
        curve: Curves.fastOutSlowIn,
      );
      setState(() {
        _isSuccessAnim = false;
      });
    }
  }

  @override
  void dispose() {
    _gestureSubscription?.cancel();
    _pageController.dispose();
    super.dispose();
  }

  Future<void> _completeOnboarding() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('has_seen_onboarding', true);
    // Tracker is already running, just transition
    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      PageRouteBuilder(
        pageBuilder: (context, animation, secondaryAnimation) => const DashboardScreen(),
        transitionsBuilder: (context, animation, secondaryAnimation, child) {
          return FadeTransition(opacity: animation, child: child);
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textColor = isDark ? Colors.white : Colors.black87;
    final subtitleColor = isDark ? const Color(0xFFA1A1AA) : Colors.black54;

    return Scaffold(
      body: Stack(
        children: [
          // Background Gradient Mesh
          Positioned(
            top: -100,
            right: -100,
            child: Container(
              width: 300,
              height: 300,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                color: Color(0xFF2563EB),
              ),
            ).blurred(80),
          ),
          Positioned(
            bottom: -50,
            left: -50,
            child: Container(
              width: 250,
              height: 250,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                color: Color(0xFF7C3AED),
              ),
            ).blurred(80),
          ),
          
          SafeArea(
            child: Column(
              children: [
                Align(
                  alignment: Alignment.topRight,
                  child: TextButton(
                    onPressed: _completeOnboarding,
                    child: Text('Skip', style: TextStyle(color: textColor, fontSize: 16)),
                  ),
                ),
                Expanded(
                  child: PageView.builder(
                    controller: _pageController,
                    physics: const NeverScrollableScrollPhysics(), // Force them to do the gesture
                    onPageChanged: (idx) => setState(() => _currentPage = idx),
                    itemCount: _pages.length,
                    itemBuilder: (context, index) {
                      final page = _pages[index];
                      return Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 40.0),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            AnimatedContainer(
                              duration: const Duration(milliseconds: 400),
                              curve: Curves.easeOutBack,
                              transform: _isSuccessAnim ? Matrix4.diagonal3Values(1.1, 1.1, 1.0) : Matrix4.identity(),
                              child: GlassCard(
                                width: 140,
                                height: 140,
                                padding: EdgeInsets.zero,
                                borderRadius: 40,
                                borderColor: _isSuccessAnim ? page['accent'] : (isDark ? Colors.white10 : Colors.black12),
                                child: Center(
                                  child: Icon(
                                    _isSuccessAnim ? Icons.check_circle_rounded : page['icon'], 
                                    size: 70, 
                                    color: _isSuccessAnim ? page['accent'] : textColor
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(height: 60),
                            Text(
                              _isSuccessAnim ? "Perfect!" : page['title'],
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: 32,
                                height: 1.2,
                                fontWeight: FontWeight.w600,
                                letterSpacing: -1,
                                color: _isSuccessAnim ? page['accent'] : textColor,
                              ),
                            ),
                            const SizedBox(height: 20),
                            Text(
                              _isSuccessAnim ? "Gesture Recognized" : page['subtitle'],
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: 16,
                                color: subtitleColor,
                                height: 1.5,
                              ),
                            ),
                            
                            const SizedBox(height: 40),
                            if (!_isSuccessAnim)
                              Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  SizedBox(
                                    width: 16,
                                    height: 16,
                                    child: CircularProgressIndicator(strokeWidth: 2, color: subtitleColor),
                                  ),
                                  const SizedBox(width: 12),
                                  Text("Awaiting gesture...", style: TextStyle(color: subtitleColor, fontStyle: FontStyle.italic)),
                                ],
                              )
                          ],
                        ),
                      );
                    },
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.only(bottom: 60.0, left: 40.0, right: 40.0),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: List.generate(_pages.length, (index) {
                      return AnimatedContainer(
                        duration: const Duration(milliseconds: 300),
                        margin: const EdgeInsets.symmetric(horizontal: 4),
                        height: 6,
                        width: _currentPage == index ? 24 : 6,
                        decoration: BoxDecoration(
                          color: _currentPage == index ? textColor : subtitleColor.withOpacity(0.3),
                          borderRadius: BorderRadius.circular(3),
                        ),
                      );
                    }),
                  ),
                )
              ],
            ),
          )
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════
//  DASHBOARD SCREEN (Apple + Linux Sidebar Hub)
// ═══════════════════════════════════════════════════════════════

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  static const _methodChannel = MethodChannel('com.rajtewari/hand_tracker');
  bool _isActive = false;
  
  Timer? _liveTimer;
  String _currentTime = "";
  bool _showCursor = true;
  String _latestLog = "STANDBY";

  @override
  void initState() {
    super.initState();
    _updateTime();
    _liveTimer = Timer.periodic(const Duration(milliseconds: 500), (timer) {
      if (mounted) setState(() {
        _updateTime();
        _showCursor = !_showCursor;
      });
    });
  }

  void _updateTime() {
    final t = DateTime.now();
    _currentTime = "${t.year}-${t.month.toString().padLeft(2,'0')}-${t.day.toString().padLeft(2,'0')} "
                   "${t.hour.toString().padLeft(2,'0')}:${t.minute.toString().padLeft(2,'0')}:${t.second.toString().padLeft(2,'0')}";
  }

  @override
  void dispose() {
    _liveTimer?.cancel();
    super.dispose();
  }

  void _addLog(String msg) {
    if (!mounted) return;
    setState(() {
      _latestLog = msg;
    });
  }

  Future<void> _toggleService() async {
    try {
      if (_isActive) {
        _addLog("Sending SIGTERM to tracker process...");
        await _methodChannel.invokeMethod('stopService');
        setState(() => _isActive = false);
        _addLog("Service stopped. (exit 0)");
      } else {
        _addLog("Verifying camera permissions...");
        
        final cameraStatus = await Permission.camera.request();
        if (!cameraStatus.isGranted) {
          _addLog("ERR: Camera permission denied.");
          return;
        }

        await _methodChannel.invokeMethod('startService');
        setState(() => _isActive = true);
        _addLog("Daemon running. Intercepting inputs.");
      }
    } on PlatformException catch (e) {
      if (e.code == 'PERMISSION_DENIED') {
        _addLog("ERR: Overlay permission missing.");
      } else {
        _addLog("ERR: Start failed - ${e.message}");
      }
    }
  }

  // Links for Sidebar Profile
  Future<void> _launchURL(String urlString) async {
    final Uri url = Uri.parse(urlString);
    if (!await launchUrl(url, mode: LaunchMode.externalApplication)) {
      _addLog("ERR: Unable to open intent $urlString");
    }
  }

  Widget _buildLegendRow(IconData icon, String gesture, String action) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 8.0),
      child: Row(
        children: [
          Icon(icon, color: const Color(0xFF34D399), size: 18),
          const SizedBox(width: 12),
          Text(gesture, style: Theme.of(context).textTheme.bodyMedium!.copyWith(fontSize: 13, fontWeight: FontWeight.w500)),
          const Spacer(),
          Text(action, style: Theme.of(context).textTheme.bodySmall!.copyWith(fontSize: 12)),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textColor = isDark ? Colors.white : Colors.black87;
    final subtitleColor = isDark ? Colors.white54 : Colors.black54;

    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: IconThemeData(color: textColor),
        title: Text(
          "Spatial Tracer",
          style: TextStyle(fontWeight: FontWeight.w700, letterSpacing: -1, color: textColor),
        ),
        actions: [
          IconButton(
            icon: Icon(Icons.settings_accessibility_rounded, color: subtitleColor),
            onPressed: () {
              _methodChannel.invokeMethod('openAccessibilitySettings');
              _addLog("Opened Accessibility settings intent.");
            },
          )
        ],
      ),
      drawer: Drawer(
        backgroundColor: Theme.of(context).drawerTheme.backgroundColor?.withOpacity(0.95),
        surfaceTintColor: Colors.transparent,
        child: SafeArea(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Beautiful Sidebar Minimal Header
              Container(
                padding: const EdgeInsets.fromLTRB(24, 48, 24, 24),
                child: Text(
                  "Spatial Tracer",
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontSize: 28,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -1,
                    color: const Color(0xFF34D399),
                  ),
                ),
              ),
              const Divider(color: Colors.white10, height: 1),
              
              // 4 Specific Navigation Links
              ListTile(
                leading: Icon(Icons.school_rounded, color: Theme.of(context).iconTheme.color),
                title: Text("Tutorial", style: Theme.of(context).textTheme.bodyMedium),
                onTap: () {
                  Navigator.pop(context); // close drawer
                  Navigator.push(context, MaterialPageRoute(builder: (_) => const OnboardingScreen()));
                },
              ),
              ListTile(
                leading: Icon(Icons.live_tv_rounded, color: Theme.of(context).iconTheme.color),
                title: Text("Live Tutorials", style: Theme.of(context).textTheme.bodyMedium),
                onTap: () => _launchURL("https://youtube.com/RajTewari01"),
              ),
              ListTile(
                leading: Icon(Icons.person_rounded, color: Theme.of(context).iconTheme.color),
                title: Text("About Creator", style: Theme.of(context).textTheme.bodyMedium),
                onTap: () {
                  Navigator.pop(context); // close drawer
                  Navigator.push(context, MaterialPageRoute(builder: (_) => const CreatorProfileScreen()));
                },
              ),
              ListTile(
                leading: Icon(Icons.email_rounded, color: Theme.of(context).iconTheme.color),
                title: Text("Contact Support", style: Theme.of(context).textTheme.bodyMedium),
                onTap: () => _launchURL("mailto:tewari765@gmail.com"),
              ),
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 24.0, vertical: 8.0),
                child: Divider(color: Colors.white10, height: 1),
              ),
              Consumer<ThemeProvider>(
                builder: (context, themeProvider, child) {
                  return SwitchListTile(
                    title: Text(themeProvider.isDarkMode ? "Dark Mode" : "Light Mode", style: Theme.of(context).textTheme.bodyMedium),
                    subtitle: Text("Manual theme override", style: Theme.of(context).textTheme.bodySmall),
                    secondary: Icon(themeProvider.isDarkMode ? Icons.dark_mode_rounded : Icons.light_mode_rounded, color: Theme.of(context).iconTheme.color),
                    value: themeProvider.isDarkMode,
                    activeColor: const Color(0xFF3FB950),
                    onChanged: (val) {
                      themeProvider.toggleTheme(val);
                    },
                  );
                },
              ),
              
              const SizedBox(height: 8),
              Padding(
                padding: const EdgeInsets.only(left: 24.0, top: 16, bottom: 8),
                child: Text("GESTURE LEGEND", style: Theme.of(context).textTheme.bodySmall!.copyWith(fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 1.5)),
              ),
              _buildLegendRow(Icons.pan_tool_alt_rounded, "Index Point", "Move Cursor"),
              _buildLegendRow(Icons.back_hand_rounded, "Peace Sign", "Tap / Click"),
              _buildLegendRow(Icons.swipe_rounded, "Closed Fist", "Recent Apps"),
              _buildLegendRow(Icons.pinch_rounded, "Pinch", "Go Back"),
              _buildLegendRow(Icons.swap_vert_rounded, "Thumbs Up/Down", "Scroll Page"),
              
              const Spacer(),
              const Padding(
                padding: EdgeInsets.all(24.0),
                child: Text(
                  "Spatial_Tracer Core v1.0\nLinux Engine Hooked",
                  style: TextStyle(color: Colors.white38, fontSize: 11, fontFamily: 'monospace'),
                ),
              )
            ],
          ),
        ),
      ),
      body: Stack(
        children: [
          // Sleek ambient background
          Positioned(
            top: -150,
            left: -50,
            child: Container(
              width: 300,
              height: 300,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                color: Color(0xFF2563EB),
              ),
            ).blurred(100),
          ),
          Positioned(
            bottom: -100,
            right: -100,
            child: Container(
              width: 350,
              height: 350,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                color: Color(0xFF0D9488),
              ),
            ).blurred(120),
          ),

          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 16.0),
            child: Column(
              children: [
                const Spacer(),

                // Apple-like Glowing Engine Toggle
                GestureDetector(
                  onTap: _toggleService,
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 400),
                    curve: Curves.fastOutSlowIn,
                    width: 220,
                    height: 220,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: _isActive 
                        ? (isDark ? Colors.white.withOpacity(0.1) : Colors.black.withOpacity(0.05))
                        : (isDark ? Colors.black.withOpacity(0.3) : Colors.white.withOpacity(0.5)),
                      border: Border.all(
                        color: _isActive 
                          ? const Color(0xFF34D399) 
                          : (isDark ? Colors.white.withOpacity(0.1) : Colors.black.withOpacity(0.1)),
                        width: _isActive ? 4 : 1,
                      ),
                      boxShadow: [
                        if (_isActive)
                          BoxShadow(
                            color: const Color(0xFF34D399).withOpacity(0.3),
                            blurRadius: 50,
                            spreadRadius: 15,
                          ),
                        if (!_isActive)
                          BoxShadow(
                            color: Colors.black.withOpacity(0.6),
                            blurRadius: 30,
                            spreadRadius: 8,
                          )
                      ],
                    ),
                    child: Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            _isActive ? Icons.power_rounded : Icons.power_settings_new_rounded,
                            size: 64,
                            color: _isActive ? const Color(0xFF34D399) : subtitleColor,
                          ),
                          const SizedBox(height: 16),
                          Text(
                            _isActive ? "DAEMON UP" : "STANDBY",
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 2,
                              color: _isActive ? const Color(0xFF34D399) : subtitleColor,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),

                const Spacer(),

                // Linux Commanding Terminal Bottom Panel
                GlassCard(
                  height: 180,
                  borderRadius: 16,
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Row(
                        children: [
                          Icon(Icons.terminal_rounded, size: 16, color: Colors.white70),
                          const SizedBox(width: 8),
                          const Text(
                            "LIVE SYSTEM CLOCK",
                            style: TextStyle(fontSize: 11, color: Colors.white70, fontFamily: 'monospace', letterSpacing: 1.5),
                          ),
                        ],
                      ),
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 12.0),
                        child: Divider(color: Colors.white24, height: 1),
                      ),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              "$_currentTime" + (_showCursor ? "_" : ""),
                              style: const TextStyle(
                                fontFamily: 'monospace',
                                fontSize: 24,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF34D399),
                                height: 1.2,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              "Status: $_latestLog",
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontFamily: 'monospace',
                                fontSize: 11,
                                color: Colors.white54,
                                height: 1.5,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// Extension to cleanly wrap the backdrop blur around specific widgets before they hit the Canvas
extension BlurExtension on Widget {
  Widget blurred(double sigma) {
    return ImageFiltered(
      imageFilter: ImageFilter.blur(sigmaX: sigma, sigmaY: sigma),
      child: this,
    );
  }
}
