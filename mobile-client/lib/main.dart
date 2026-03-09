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
      'subtitle': 'Form a closed FIST to view Recent Apps. Do it now to continue.',
      'requiredGesture': 'FIST',
      'accent': const Color(0xFF10B981),
    },
    {
      'icon': Icons.swap_vert_rounded,
      'title': 'Face Scroll',
      'subtitle': 'Tilt your head UP or DOWN to scroll pages hands-free. Try tilting your head firmly now.',
      'requiredGesture': ['TILT_UP', 'TILT_DOWN'],
      'accent': const Color(0xFFF59E0B),
    },
    {
      'icon': Icons.visibility_off_rounded,
      'title': 'Blink to Close',
      'subtitle': 'A firm, intentional blink acts as a "Close" or "Recents" action. Blink fully now to finish setup.',
      'requiredGesture': 'BLINK',
      'accent': const Color(0xFFEF4444),
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
        await _methodChannel.invokeMethod('startService', {
          'useHand': true,
          'useFace': true,
        });
        
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
    if (requiredGesture is List) {
      if (requiredGesture.contains(gesture)) {
        _triggerSuccessAndAdvance();
      }
    } else {
      if (gesture == requiredGesture) {
        _triggerSuccessAndAdvance();
      }
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
  bool _useHandTracking = true;
  bool _useFaceTracking = false;
  
  Timer? _liveTimer;
  String _currentTime = "";
  bool _showCursor = true;
  String _latestLog = "STANDBY";

  @override
  void initState() {
    super.initState();
    _loadPreferences();
    _updateTime();
    _liveTimer = Timer.periodic(const Duration(milliseconds: 500), (timer) {
      if (mounted) setState(() {
        _updateTime();
        _showCursor = !_showCursor;
      });
    });
  }

  Future<void> _loadPreferences() async {
    final prefs = await SharedPreferences.getInstance();
    if (mounted) {
      setState(() {
        _useHandTracking = prefs.getBool('use_hand_tracking') ?? true;
        _useFaceTracking = prefs.getBool('use_face_tracking') ?? false;
      });
    }
  }

  Future<void> _savePreference(String key, bool value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(key, value);
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

        await _methodChannel.invokeMethod('startService', {
          'useHand': _useHandTracking,
          'useFace': _useFaceTracking,
        });
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
      drawer: Theme(
        data: Theme.of(context).copyWith(
          canvasColor: Colors.transparent, // Required for the glass effect
        ),
        child: Drawer(
          width: 320,
          child: Stack(
            children: [
              // Premium iPhone Glass Blur Backdrop
              Positioned.fill(
                child: BackdropFilter(
                  filter: ImageFilter.blur(sigmaX: 30, sigmaY: 30),
                  child: Container(
                    decoration: BoxDecoration(
                      color: isDark ? const Color(0xFF0F172A).withOpacity(0.65) : Colors.white.withOpacity(0.75),
                      border: Border(right: BorderSide(color: isDark ? Colors.white10 : Colors.black.withOpacity(0.05))),
                    ),
                  ),
                ),
              ),
              
              SafeArea(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Premium User Profile Header
                    Padding(
                      padding: const EdgeInsets.fromLTRB(24, 32, 24, 24),
                      child: Row(
                        children: [
                          Container(
                            width: 50, height: 50,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              border: Border.all(color: const Color(0xFF34D399).withOpacity(0.5), width: 2),
                              image: const DecorationImage(
                                image: AssetImage('assets/images/raj_profile.jpg'),
                                fit: BoxFit.cover,
                              ),
                              boxShadow: [
                                BoxShadow(
                                  color: const Color(0xFF34D399).withOpacity(0.2),
                                  blurRadius: 15, spreadRadius: 2
                                )
                              ]
                            ),
                          ),
                          const SizedBox(width: 16),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  "Biswadeep TEwari",
                                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                                    fontWeight: FontWeight.w800,
                                    letterSpacing: -0.5,
                                    color: textColor,
                                  ),
                                  overflow: TextOverflow.ellipsis,
                                ),
                                Text(
                                  "System Architect",
                                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                    color: const Color(0xFF34D399),
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                          )
                        ],
                      ),
                    ),
                    const Padding(
                      padding: EdgeInsets.symmetric(horizontal: 24),
                      child: Divider(color: Colors.white10, height: 1),
                    ),
                    
                    const SizedBox(height: 16),
                    
                    // 4 Specific Navigation Links (Styled like IDE tabs)
                    _buildSidebarItem(context, Icons.rocket_launch_rounded, "Engine Tutorial", () {
                      Navigator.pop(context);
                      Navigator.push(context, MaterialPageRoute(builder: (_) => const OnboardingScreen()));
                    }, isDark),
                    _buildSidebarItem(context, Icons.video_library_rounded, "Live Broadcasts", () => _launchURL("https://youtube.com/RajTewari01"), isDark),
                    _buildSidebarItem(context, Icons.space_dashboard_rounded, "Creator Hub", () {
                      Navigator.pop(context);
                      Navigator.push(context, MaterialPageRoute(builder: (_) => const CreatorProfileScreen()));
                    }, isDark),
                    _buildSidebarItem(context, Icons.support_agent_rounded, "Deploy Support", () => _launchURL("mailto:tewari765@gmail.com"), isDark),
                    
                    const Spacer(),
                    
                    const Padding(
                      padding: EdgeInsets.symmetric(horizontal: 24.0),
                      child: Divider(color: Colors.white10, height: 1),
                    ),
                    const SizedBox(height: 8),
                    
                    // Independent Engine Toggles
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16.0),
                      child: SwitchListTile(
                        contentPadding: const EdgeInsets.symmetric(horizontal: 16),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                        title: Text("Hand Tracking", style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
                        subtitle: Text("Point, Tap, Snap", style: Theme.of(context).textTheme.bodySmall),
                        secondary: Icon(Icons.back_hand_rounded, size: 20, color: textColor),
                        value: _useHandTracking,
                        activeColor: const Color(0xFF34D399),
                        onChanged: (val) {
                          setState(() => _useHandTracking = val);
                          _savePreference('use_hand_tracking', val);
                          // Restart service if already running
                          if (_isActive) _toggleService().then((_) => _toggleService());
                        },
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16.0),
                      child: SwitchListTile(
                        contentPadding: const EdgeInsets.symmetric(horizontal: 16),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                        title: Text("Face Tracking", style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
                        subtitle: Text("Tilt to scroll, Blink to close", style: Theme.of(context).textTheme.bodySmall),
                        secondary: Icon(Icons.face_rounded, size: 20, color: textColor),
                        value: _useFaceTracking,
                        activeColor: const Color(0xFF34D399),
                        onChanged: (val) {
                          setState(() => _useFaceTracking = val);
                          _savePreference('use_face_tracking', val);
                          // Restart service if already running
                          if (_isActive) _toggleService().then((_) => _toggleService());
                        },
                      ),
                    ),

                    Consumer<ThemeProvider>(
                      builder: (context, themeProvider, child) {
                        return Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 16.0),
                          child: SwitchListTile(
                            contentPadding: const EdgeInsets.symmetric(horizontal: 16),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                            title: Text(themeProvider.isDarkMode ? "Dark Editor" : "Light Editor", style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
                            subtitle: Text("Theme Override", style: Theme.of(context).textTheme.bodySmall),
                            secondary: Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: isDark ? Colors.white10 : Colors.black.withOpacity(0.05),
                                borderRadius: BorderRadius.circular(10)
                              ),
                              child: Icon(themeProvider.isDarkMode ? Icons.dark_mode_rounded : Icons.light_mode_rounded, size: 20, color: textColor),
                            ),
                            value: themeProvider.isDarkMode,
                            activeColor: const Color(0xFF34D399),
                            onChanged: (val) {
                              themeProvider.toggleTheme(val);
                            },
                          ),
                        );
                      },
                    ),
                    
                    const SizedBox(height: 16),
                    
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 32.0, vertical: 16),
                      child: Text(
                        "SPATIAL.TRACER.CORE v1.0\nDAEMON INITIALIZED",
                        style: TextStyle(color: subtitleColor.withOpacity(0.5), fontSize: 10, fontFamily: 'monospace', height: 1.5, letterSpacing: 1.0),
                      ),
                    )
                  ],
                ),
              ),
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

  // ---------------------------------------------------------------------------
  // Build Sidebar List Tile Helper (IDE Styled)
  // ---------------------------------------------------------------------------
  Widget _buildSidebarItem(BuildContext context, IconData icon, String title, VoidCallback onTap, bool isDark) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 4.0),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          hoverColor: (isDark ? Colors.white : Colors.black).withOpacity(0.05),
          splashColor: const Color(0xFF34D399).withOpacity(0.1),
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: Row(
              children: [
                Icon(icon, size: 22, color: isDark ? Colors.white70 : Colors.black87),
                const SizedBox(width: 16),
                Text(
                  title,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                    letterSpacing: -0.2,
                  ),
                ),
              ],
            ),
          ),
        ),
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
