import 'dart:async';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final prefs = await SharedPreferences.getInstance();
  final hasSeenOnboarding = prefs.getBool('has_seen_onboarding') ?? false;
  
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(statusBarColor: Colors.transparent),
  );

  runApp(SpatialTracerApp(hasSeenOnboarding: hasSeenOnboarding));
}

class SpatialTracerApp extends StatelessWidget {
  final bool hasSeenOnboarding;
  const SpatialTracerApp({super.key, required this.hasSeenOnboarding});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Spatial Tracer',
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark().copyWith(
        scaffoldBackgroundColor: const Color(0xFF09090B), // Deep sleek black
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFFF4F4F5),
          secondary: Color(0xFFA1A1AA),
          surface: Color(0xFF18181B),
        ),
        textTheme: const TextTheme(
          bodyLarge: TextStyle(fontFamily: 'Roboto', color: Color(0xFFF4F4F5)),
          bodyMedium: TextStyle(fontFamily: 'Roboto', color: Color(0xFFA1A1AA)),
        ),
      ),
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

  const GlassCard({
    super.key,
    required this.child,
    this.width = double.infinity,
    this.height = double.infinity,
    this.borderRadius = 24.0,
    this.padding = const EdgeInsets.all(24.0),
  });

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(borderRadius),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 16.0, sigmaY: 16.0),
        child: Container(
          width: width,
          height: height,
          padding: padding,
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.05),
            borderRadius: BorderRadius.circular(borderRadius),
            border: Border.all(
              color: Colors.white.withOpacity(0.1),
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
//  ONBOARDING SCREEN
// ═══════════════════════════════════════════════════════════════

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final PageController _pageController = PageController();
  int _currentPage = 0;

  final List<Map<String, dynamic>> _pages = [
    {
      'icon': Icons.back_hand_rounded,
      'title': 'Spatial Control.\nUnbound.',
      'subtitle': 'Navigate your entire OS with invisible air gestures. A premium devops approach to mobility.',
    },
    {
      'icon': Icons.pan_tool_alt_rounded,
      'title': 'Precision Pointing',
      'subtitle': 'Index finger to move the global cursor. Pinch to execute a perfect tap.',
    },
    {
      'icon': Icons.swipe_rounded,
      'title': 'System Navigation',
      'subtitle': 'Closed fist to go Back. Peace sign for Home. Three fingers for Recents. Thumbs for scrolling.',
    },
  ];

  Future<void> _completeOnboarding() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('has_seen_onboarding', true);
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
                    child: const Text('Skip', style: TextStyle(color: Colors.white, fontSize: 16)),
                  ),
                ),
                Expanded(
                  child: PageView.builder(
                    controller: _pageController,
                    onPageChanged: (idx) => setState(() => _currentPage = idx),
                    itemCount: _pages.length,
                    itemBuilder: (context, index) {
                      final page = _pages[index];
                      return Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 40.0),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            GlassCard(
                              width: 140,
                              height: 140,
                              padding: EdgeInsets.zero,
                              borderRadius: 40,
                              child: Center(
                                child: Icon(page['icon'], size: 70, color: Colors.white),
                              ),
                            ),
                            const SizedBox(height: 60),
                            Text(
                              page['title'],
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                fontSize: 32,
                                height: 1.2,
                                fontWeight: FontWeight.w600,
                                letterSpacing: -1,
                                color: Colors.white,
                              ),
                            ),
                            const SizedBox(height: 20),
                            Text(
                              page['subtitle'],
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                fontSize: 16,
                                color: Color(0xFFA1A1AA),
                                height: 1.5,
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.only(bottom: 60.0, left: 40.0, right: 40.0),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: List.generate(_pages.length, (index) {
                          return AnimatedContainer(
                            duration: const Duration(milliseconds: 300),
                            margin: const EdgeInsets.only(right: 8),
                            height: 6,
                            width: _currentPage == index ? 24 : 6,
                            decoration: BoxDecoration(
                              color: _currentPage == index ? Colors.white : Colors.white24,
                              borderRadius: BorderRadius.circular(3),
                            ),
                          );
                        }),
                      ),
                      GestureDetector(
                        onTap: () {
                          if (_currentPage == _pages.length - 1) {
                            _completeOnboarding();
                          } else {
                            _pageController.nextPage(
                              duration: const Duration(milliseconds: 400),
                              curve: Curves.easeInOut,
                            );
                          }
                        },
                        child: GlassCard(
                          width: 120,
                          height: 56,
                          borderRadius: 28,
                          padding: EdgeInsets.zero,
                          child: Center(
                            child: Text(
                              _currentPage == _pages.length - 1 ? "Start" : "Next",
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 16,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ),
                      )
                    ],
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
//  DASHBOARD SCREEN (Apple + Linux)
// ═══════════════════════════════════════════════════════════════

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  static const _channel = MethodChannel('com.rajtewari/hand_tracker');
  bool _isActive = false;
  final List<String> _terminalLogs = [];
  Timer? _cursorBlinkTimer;
  bool _showCursor = true;

  @override
  void initState() {
    super.initState();
    _addLog("systemctl status spatial-tracer.service");
    _addLog("Loaded: loaded (/etc/systemd/system/spatial-tracer.service)");
    _addLog("Active: inactive (dead)");
    
    _cursorBlinkTimer = Timer.periodic(const Duration(milliseconds: 500), (timer) {
      if (mounted) setState(() => _showCursor = !_showCursor);
    });
  }

  @override
  void dispose() {
    _cursorBlinkTimer?.cancel();
    super.dispose();
  }

  void _addLog(String msg) {
    if (!mounted) return;
    setState(() {
      _terminalLogs.add("[root@spatial_tracer] ~ # $msg");
      if (_terminalLogs.length > 8) _terminalLogs.removeAt(0);
    });
  }

  Future<void> _toggleService() async {
    try {
      if (_isActive) {
        _addLog("Sending SIGTERM to tracker process...");
        await _channel.invokeMethod('stopService');
        setState(() => _isActive = false);
        _addLog("Service stopped successfully. (exit 0)");
      } else {
        _addLog("Verifying overlay & accessibility permissions...");
        
        // Let the Android code request permissions if needed.
        await _channel.invokeMethod('startService');
        setState(() => _isActive = true);
        _addLog("Process forked. Tracker daemon running...");
        _addLog("Global Cursor Overlay initialized.");
      }
    } on PlatformException catch (e) {
      if (e.code == 'PERMISSION_DENIED') {
        _addLog("ERR: Overlay permission missing.");
      } else {
        _addLog("ERR: Failed to start hardware stream.");
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
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

          SafeArea(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 16.0),
              child: Column(
                children: [
                  // App Header
                  const Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        "Spatial Tracer",
                        style: TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.w700,
                          letterSpacing: -1,
                          color: Colors.white,
                        ),
                      ),
                      Icon(Icons.radar_rounded, color: Colors.white54),
                    ],
                  ),
                  const SizedBox(height: 32),

                  // Prominent User Profile Card (Glassmorphism)
                  GlassCard(
                    height: 120,
                    padding: const EdgeInsets.all(20),
                    child: Row(
                      children: [
                        Container(
                          width: 64,
                          height: 64,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            border: Border.all(color: Colors.white24, width: 2),
                            image: const DecorationImage(
                              image: AssetImage("assets/images/profile.png"), // Uses the generated cover image
                              fit: BoxFit.cover,
                            ),
                          ),
                        ),
                        const SizedBox(width: 16),
                        const Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                "Biswadeep Tewari",
                                style: TextStyle(
                                  fontSize: 18,
                                  fontWeight: FontWeight.w600,
                                  color: Colors.white,
                                ),
                              ),
                              SizedBox(height: 4),
                              Text(
                                "AI/ML Architect & Devops",
                                style: TextStyle(
                                  fontSize: 13,
                                  color: Color(0xFFA1A1AA),
                                ),
                              ),
                              SizedBox(height: 8),
                              Text(
                                "build → ship → learn → repeat",
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w500,
                                  color: Color(0xFF38BDF8),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),

                  const Spacer(),

                  // Apple-like Glowing Engine Toggle
                  GestureDetector(
                    onTap: _toggleService,
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 400),
                      curve: Curves.fastOutSlowIn,
                      width: 200,
                      height: 200,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: _isActive 
                          ? Colors.white.withOpacity(0.1) 
                          : Colors.black.withOpacity(0.3),
                        border: Border.all(
                          color: _isActive 
                            ? const Color(0xFF34D399) 
                            : Colors.white.withOpacity(0.1),
                          width: _isActive ? 4 : 1,
                        ),
                        boxShadow: [
                          if (_isActive)
                            BoxShadow(
                              color: const Color(0xFF34D399).withOpacity(0.3),
                              blurRadius: 40,
                              spreadRadius: 10,
                            ),
                          if (!_isActive)
                            BoxShadow(
                              color: Colors.black.withOpacity(0.5),
                              blurRadius: 20,
                              spreadRadius: 5,
                            )
                        ],
                      ),
                      child: Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              _isActive ? Icons.power_rounded : Icons.power_settings_new_rounded,
                              size: 48,
                              color: _isActive ? const Color(0xFF34D399) : Colors.white54,
                            ),
                            const SizedBox(height: 12),
                            Text(
                              _isActive ? "ACTIVE" : "STANDBY",
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w700,
                                letterSpacing: 2,
                                color: _isActive ? const Color(0xFF34D399) : Colors.white54,
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
                    height: 200,
                    borderRadius: 16,
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const Row(
                          children: [
                            Icon(Icons.terminal_rounded, size: 16, color: Colors.white54),
                            SizedBox(width: 8),
                            Text(
                              "tty1 - system logs",
                              style: TextStyle(fontSize: 12, color: Colors.white54, fontFamily: 'monospace'),
                            ),
                          ],
                        ),
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 8.0),
                          child: Divider(color: Colors.white10, height: 1),
                        ),
                        Expanded(
                          child: ListView.builder(
                            physics: const NeverScrollableScrollPhysics(),
                            itemCount: _terminalLogs.length + 1,
                            itemBuilder: (context, index) {
                              if (index == _terminalLogs.length) {
                                return Text(
                                  "root@tracer:~# " + (_showCursor ? "_" : ""),
                                  style: const TextStyle(
                                    fontFamily: 'monospace',
                                    fontSize: 12,
                                    color: Color(0xFF34D399),
                                    height: 1.5,
                                  ),
                                );
                              }
                              return Text(
                                _terminalLogs[index],
                                style: const TextStyle(
                                  fontFamily: 'monospace',
                                  fontSize: 12,
                                  color: Color(0xFFA1A1AA),
                                  height: 1.5,
                                ),
                              );
                            },
                          ),
                        ),
                      ],
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

// Extension to cleanly wrap the backdrop blur around specific widgets before they hit the Canvas
extension BlurExtension on Widget {
  Widget blurred(double sigma) {
    return ImageFiltered(
      imageFilter: ImageFilter.blur(sigmaX: sigma, sigmaY: sigma),
      child: this,
    );
  }
}
