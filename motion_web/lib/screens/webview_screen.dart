import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';

class WebViewScreen extends StatefulWidget {
  const WebViewScreen({super.key});

  static const String initialUrl = 'https://spatial-tracer-mgxz.vercel.app';

  @override
  State<WebViewScreen> createState() => _WebViewScreenState();
}

class _WebViewScreenState extends State<WebViewScreen> {
  WebViewController? _controller;
  bool _isWebLoaded = false;
  bool _splashAnimDone = false;
  bool _hasError = false;
  String _errorMessage = '';
  bool _isControlsVisible = false;

  @override
  void initState() {
    super.initState();
    // Splash screen is completely excluded - runs naturally edge-to-edge
    _startSplashSequence();
    _initWebViewSync();
    _requestPermissionsAsync();
  }

  void _startSplashSequence() {
    // 4.6 seconds for the full wipe reveal, hold, and zoom through animation
    Future.delayed(const Duration(milliseconds: 4600), () {
      if (mounted) {
        setState(() {
          _splashAnimDone = true;
        });
      }
    });
  }

  void _initWebViewSync() {
    try {
      final PlatformWebViewControllerCreationParams params =
          const PlatformWebViewControllerCreationParams();

      final WebViewController controller =
          WebViewController.fromPlatformCreationParams(params);

      controller
        ..setJavaScriptMode(JavaScriptMode.unrestricted)
        ..setBackgroundColor(const Color(0xFF070103))
        ..setNavigationDelegate(
          NavigationDelegate(
            onProgress: (int progress) {
              if (progress >= 100) {
                _onPageReady();
              }
            },
            onPageStarted: (String url) {
              if (mounted) {
                setState(() {
                  _hasError = false;
                });
              }
            },
            onPageFinished: (String url) {
              _onPageReady();
            },
            onWebResourceError: (WebResourceError error) {
              if (error.isForMainFrame ?? true) {
                if (mounted) {
                  setState(() {
                    _hasError = true;
                    _errorMessage = error.description;
                  });
                }
              }
            },
          ),
        );

      if (controller.platform is AndroidWebViewController) {
        final androidController = controller.platform as AndroidWebViewController;
        AndroidWebViewController.enableDebugging(false);
        androidController.setMediaPlaybackRequiresUserGesture(false);
        androidController.setOnPlatformPermissionRequest(
          (PlatformWebViewPermissionRequest request) {
            request.grant();
          },
        );
      }

      controller.loadRequest(Uri.parse(WebViewScreen.initialUrl));

      setState(() {
        _controller = controller;
      });
    } catch (e) {
      debugPrint('WebView init error: $e');
      setState(() {
        _hasError = true;
        _errorMessage = e.toString();
      });
    }
  }

  void _onPageReady() {
    if (!mounted) return;
    setState(() {
      _isWebLoaded = true;
    });
  }

  Future<void> _requestPermissionsAsync() async {
    try {
      await [
        Permission.camera,
        Permission.microphone,
      ].request();
    } catch (e) {
      debugPrint('Permission error: $e');
    }
  }

  Future<void> _reload() async {
    if (_controller == null) return;
    setState(() {
      _isControlsVisible = false;
    });
    try {
      await _controller!.reload();
    } catch (e) {
      debugPrint('Reload error: $e');
    }
  }

  Future<void> _loadHome() async {
    if (_controller == null) return;
    setState(() {
      _isControlsVisible = false;
    });
    try {
      await _controller!.loadRequest(Uri.parse(WebViewScreen.initialUrl));
    } catch (e) {
      debugPrint('LoadHome error: $e');
    }
  }

  bool get _shouldShowSplash => (!_splashAnimDone || !_isWebLoaded) && !_hasError;

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) async {
        if (didPop) return;
        if (_controller != null) {
          final canGoBack = await _controller!.canGoBack();
          if (canGoBack) {
            await _controller!.goBack();
            return;
          }
        }
        SystemNavigator.pop();
      },
      child: Scaffold(
        backgroundColor: Colors.black,
        body: Stack(
          fit: StackFit.expand,
          children: [
            // 1. Live Web View (Protected with SafeArea top padding so battery & camera notch never hide lettering)
            if (_controller != null)
              Positioned.fill(
                child: SafeArea(
                  top: true,
                  bottom: false,
                  child: WebViewWidget(controller: _controller!),
                ),
              ),

            // 2. Splash Screen as Loader (Completely excluded from SafeArea - full edge-to-edge artwork)
            IgnorePointer(
              ignoring: !_shouldShowSplash,
              child: AnimatedOpacity(
                duration: const Duration(milliseconds: 650),
                curve: Curves.easeInOut,
                opacity: _shouldShowSplash ? 1.0 : 0.0,
                child: const SplashLoaderView(),
              ),
            ),

            // 3. Error / Offline Screen (Shown only if network fails)
            if (_hasError)
              Positioned.fill(
                child: Container(
                  color: const Color(0xFF070103),
                  padding: const EdgeInsets.symmetric(horizontal: 32),
                  child: Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Container(
                          padding: const EdgeInsets.all(20),
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: Colors.white.withValues(alpha: 0.1),
                            border: Border.all(
                              color: Colors.white.withValues(alpha: 0.25),
                            ),
                          ),
                          child: const Icon(
                            Icons.wifi_off_rounded,
                            size: 48,
                            color: Colors.white,
                          ),
                        ),
                        const SizedBox(height: 24),
                        Text(
                          "Unable to Connect",
                          style: GoogleFonts.inter(
                            fontSize: 22,
                            fontWeight: FontWeight.w700,
                            color: Colors.white,
                          ),
                        ),
                        const SizedBox(height: 10),
                        Text(
                          "Could not reach spatial-tracer-mgxz.vercel.app.\nPlease check your connection.",
                          textAlign: TextAlign.center,
                          style: GoogleFonts.inter(
                            fontSize: 14,
                            color: Colors.white70,
                            height: 1.5,
                          ),
                        ),
                        if (_errorMessage.isNotEmpty) ...[
                          const SizedBox(height: 8),
                          Text(
                            _errorMessage,
                            textAlign: TextAlign.center,
                            style: GoogleFonts.jetBrainsMono(
                              fontSize: 11,
                              color: Colors.white38,
                            ),
                          ),
                        ],
                        const SizedBox(height: 28),
                        ElevatedButton.icon(
                          onPressed: _reload,
                          icon: const Icon(Icons.refresh_rounded, color: Colors.white),
                          label: Text(
                            "Retry Connection",
                            style: GoogleFonts.inter(
                              fontWeight: FontWeight.w600,
                              color: Colors.white,
                            ),
                          ),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.white.withValues(alpha: 0.2),
                            side: BorderSide(color: Colors.white.withValues(alpha: 0.5)),
                            padding: const EdgeInsets.symmetric(
                              horizontal: 24,
                              vertical: 14,
                            ),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                            elevation: 4,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),

            // 4. Subtle Floating Controls (Minimalist Dark Pill — Elevated above bottom dock to prevent overlap)
            if (!_shouldShowSplash && !_hasError)
              Positioned(
                bottom: 88,
                right: 16,
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 250),
                  padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 6),
                  decoration: BoxDecoration(
                    color: const Color(0xFF070103).withValues(alpha: 0.85),
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(
                      color: Colors.white.withValues(alpha: 0.25),
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.6),
                        blurRadius: 12,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (_isControlsVisible) ...[
                        IconButton(
                          icon: const Icon(Icons.home_rounded, size: 18),
                          color: Colors.white70,
                          tooltip: 'Home',
                          onPressed: _loadHome,
                        ),
                        IconButton(
                          icon: const Icon(Icons.refresh_rounded, size: 18),
                          color: Colors.white70,
                          tooltip: 'Reload',
                          onPressed: _reload,
                        ),
                      ],
                      IconButton(
                        icon: Icon(
                          _isControlsVisible
                              ? Icons.close_rounded
                              : Icons.tune_rounded,
                          size: 18,
                        ),
                        color: Colors.white,
                        tooltip: _isControlsVisible ? 'Close' : 'Controls',
                        onPressed: () {
                          setState(() {
                            _isControlsVisible = !_isControlsVisible;
                          });
                        },
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Splash Loader View (100% Fullscreen Edge-to-Edge - Excluded from SafeArea)
// ─────────────────────────────────────────────────────────────────────────────

class SplashLoaderView extends StatelessWidget {
  const SplashLoaderView({super.key});

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        // Wallpaper Artwork - Full edge to edge
        Image.asset(
          'assets/images/splash_bg.png',
          fit: BoxFit.cover,
          width: double.infinity,
          height: double.infinity,
        ),

        // Atmospheric Contrast Scrim
        Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                Colors.black.withValues(alpha: 0.40),
                Colors.black.withValues(alpha: 0.15),
                Colors.black.withValues(alpha: 0.65),
              ],
              stops: const [0.0, 0.5, 1.0],
            ),
          ),
        ),

        // MotionW Title with High-Contrast Distinctions
        Center(
          child: Text(
            "MotionW",
            style: GoogleFonts.pacifico(
              fontSize: 58,
              fontWeight: FontWeight.w400,
              color: Colors.white,
              letterSpacing: 2.5,
              shadows: [
                const Shadow(
                  color: Color(0xFF000000),
                  blurRadius: 3,
                  offset: Offset(0, 1),
                ),
                const Shadow(
                  color: Color(0xFF000000),
                  blurRadius: 6,
                  offset: Offset(0, 3),
                ),
                Shadow(
                  color: Colors.black.withValues(alpha: 0.98),
                  blurRadius: 20,
                  offset: const Offset(0, 8),
                ),
                Shadow(
                  color: Colors.black.withValues(alpha: 0.95),
                  blurRadius: 40,
                  offset: const Offset(0, 16),
                ),
              ],
            ),
          )
          .animate()
          .slideX(
            begin: -0.05,
            end: 0.0,
            duration: 2000.ms,
            curve: Curves.easeOutCubic,
          )
          .custom(
            duration: 2500.ms,
            curve: Curves.easeInOutCubic,
            builder: (context, value, child) {
              return ShaderMask(
                blendMode: BlendMode.dstIn,
                shaderCallback: (bounds) {
                  return LinearGradient(
                    colors: const [Colors.black, Colors.black87, Colors.transparent],
                    stops: const [0.0, 0.1, 1.0],
                    begin: Alignment(-1.5 + (value * 2.5), 0.0),
                    end: Alignment(-1.4 + (value * 2.5), 0.0),
                  ).createShader(bounds);
                },
                child: child,
              );
            },
          )
          .then(delay: 500.ms)
          .scale(
            duration: 1200.ms,
            curve: Curves.easeInExpo,
            begin: const Offset(1, 1),
            end: const Offset(50, 50),
          )
          .fadeOut(
            duration: 1000.ms,
            curve: Curves.easeInQuad,
          ),
        ),

        // ALYPION Brand Tag
        Align(
          alignment: Alignment.bottomCenter,
          child: Padding(
            padding: const EdgeInsets.only(bottom: 44),
            child: Text(
              "ALYPION",
              style: GoogleFonts.inter(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: Colors.white.withValues(alpha: 0.92),
                letterSpacing: 8.0,
                shadows: [
                  const Shadow(
                    color: Color(0xFF000000),
                    blurRadius: 4,
                    offset: Offset(0, 1),
                  ),
                  Shadow(
                    color: Colors.black.withValues(alpha: 0.9),
                    blurRadius: 16,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
            )
            .animate()
            .fadeIn(delay: 1500.ms, duration: 1000.ms, curve: Curves.easeIn)
            .then(delay: 0.ms)
            .fadeOut(duration: 600.ms, curve: Curves.easeOut),
          ),
        ),
      ],
    );
  }
}
