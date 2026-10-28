import 'dart:async';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'webview_screen.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    _startBootSequence();
  }

  void _startBootSequence() {
    // Wipe Reveal (2.5s) -> Hold (0.5s) -> Zoom Through (1.2s) -> Buffer (0.4s) = 4.6s
    Future.delayed(const Duration(milliseconds: 4600), () {
      if (mounted) {
        _navigateToHome();
      }
    });
  }

  void _navigateToHome() {
    if (mounted) {
      Navigator.of(context).pushReplacement(
        PageRouteBuilder(
          pageBuilder: (context, animation, secondaryAnimation) =>
              const WebViewScreen(),
          transitionsBuilder: (context, animation, secondaryAnimation, child) {
            return FadeTransition(opacity: animation, child: child);
          },
          transitionDuration: const Duration(milliseconds: 500),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        fit: StackFit.expand,
        children: [
          // Background River Artwork
          Image.asset(
            'assets/images/splash_bg.png',
            fit: BoxFit.cover,
            width: double.infinity,
            height: double.infinity,
          ),

          // Cinematic Atmosphere Scrim
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

          // Animated MotionW Title with High-Contrast Distinctions
          Center(
            child: Text(
              "MotionW",
              style: GoogleFonts.pacifico(
                fontSize: 58,
                fontWeight: FontWeight.w400,
                color: Colors.white,
                letterSpacing: 2.5,
                shadows: [
                  // Tight crisp black outline for razor definition
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
                  // Deep, heavy spread drop shadow to punch through light river paths
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
                  // Electric cyan luminescence complementing the river
                  Shadow(
                    color: const Color(0xFF00E5FF).withValues(alpha: 0.60),
                    blurRadius: 30,
                    offset: const Offset(0, 0),
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

          // Brand Tag at Bottom with Crisp Legibility
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
      ),
    );
  }
}
