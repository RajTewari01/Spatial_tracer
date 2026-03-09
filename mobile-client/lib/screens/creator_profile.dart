import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

class CreatorProfileScreen extends StatefulWidget {
  const CreatorProfileScreen({super.key});

  @override
  State<CreatorProfileScreen> createState() => _CreatorProfileScreenState();
}

class _CreatorProfileScreenState extends State<CreatorProfileScreen> {
  final ScrollController _scrollController = ScrollController();
  double _scrollOffset = 0.0;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(() {
      setState(() {
        _scrollOffset = _scrollController.offset;
      });
    });
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _launchURL(String urlString) async {
    final Uri url = Uri.parse(urlString);
    if (!await launchUrl(url, mode: LaunchMode.externalApplication)) {
      debugPrint("Could not launch $urlString");
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    // Aesthetic colors
    final bgDark = const Color(0xFF0F172A);
    final bgLight = const Color(0xFFF1F5F9);
    final accent = const Color(0xFF34D399);

    return Scaffold(
      backgroundColor: isDark ? bgDark : bgLight,
      body: Stack(
        children: [
          // Background 3-Layer Chinese Mirror Mountains Parallax
          _buildParallaxMountains(isDark),

          // Scrollable Content
          CustomScrollView(
            controller: _scrollController,
            physics: const BouncingScrollPhysics(),
            slivers: [
              SliverAppBar(
                expandedHeight: 380,
                pinned: true,
                stretch: true,
                backgroundColor: Colors.transparent,
                elevation: 0,
                iconTheme: Theme.of(context).iconTheme.copyWith(
                  color: isDark ? Colors.white : Colors.black87
                ),
                flexibleSpace: FlexibleSpaceBar(
                  stretchModes: const [StretchMode.zoomBackground, StretchMode.blurBackground],
                  background: Stack(
                    fit: StackFit.expand,
                    children: [
                      // Subdued gradient behind avatar
                      Container(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: [
                              Colors.transparent,
                              (isDark ? bgDark : bgLight).withOpacity(0.9),
                            ],
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                          )
                        ),
                      ),
                      
                      // Floating Chinese Characters Parallax
                      Positioned(
                        top: 100 - (_scrollOffset * 0.4),
                        right: 40,
                        child: Text("禅", style: TextStyle(fontSize: 80, color: (isDark ? Colors.white : Colors.black).withOpacity(0.05), fontWeight: FontWeight.bold)),
                      ),
                      Positioned(
                        top: 200 - (_scrollOffset * 0.6),
                        left: 30,
                        child: Text("道", style: TextStyle(fontSize: 100, color: (isDark ? Colors.white : Colors.black).withOpacity(0.03), fontWeight: FontWeight.bold)),
                      ),

                      // Avatar & Name Container
                      Positioned(
                        bottom: 40,
                        left: 0, right: 0,
                        child: Column(
                          children: [
                            Hero(
                              tag: 'creator_avatar',
                              child: Container(
                                width: 140, height: 140,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  border: Border.all(color: Colors.white.withOpacity(0.8), width: 3),
                                  image: const DecorationImage(
                                    image: AssetImage('assets/images/raj_profile.jpg'),
                                    fit: BoxFit.cover,
                                  ),
                                  boxShadow: [
                                    BoxShadow(
                                      color: accent.withOpacity(isDark ? 0.3 : 0.4),
                                      blurRadius: 30, spreadRadius: 5
                                    )
                                  ]
                                ),
                              ),
                            ),
                            const SizedBox(height: 16),
                            Text(
                              "Biswadeep TEwari (Raj)",
                              style: TextStyle(
                                fontSize: 28,
                                fontWeight: FontWeight.w900,
                                letterSpacing: -0.5,
                                color: isDark ? Colors.white : Colors.black87,
                                shadows: [
                                  Shadow(color: isDark ? Colors.black54 : Colors.white70, blurRadius: 10)
                                ]
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              "CREATE • ITERATE • TRANSCEND",
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                                letterSpacing: 3.0,
                                color: accent,
                              ),
                            ),
                          ],
                        ),
                      )
                    ],
                  ),
                ),
              ),
              
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20.0),
                  child: Column(
                    children: [
                      const SizedBox(height: 20),
                      // iPhone Premium Glass Layer 1
                      _buildIphoneGlassCard(
                        context: context,
                        isDark: isDark,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            _buildSectionHeader(context, "The Architect", Icons.auto_awesome_rounded),
                            const SizedBox(height: 16),
                            Text(
                              "I am Biswadeep TEwari, an AI/ML and Full-Stack innovator. I weave the fabric between human intention and raw machine logic, replacing traditional interfaces with spatial air gestures and localized neural networks. This engine is a step toward zero-latency thought-to-screen pipelines.",
                              style: TextStyle(height: 1.6, fontSize: 15, color: isDark ? Colors.white70 : Colors.black87),
                            ),
                            const SizedBox(height: 20),
                            Wrap(
                              spacing: 8, runSpacing: 8,
                              children: ["LangChain", "Flutter", "Python", "MediaPipe", "Kotlin", "FastAPI"].map((e) => _buildGlassChip(context, e, isDark)).toList(),
                            )
                          ]
                        ),
                      ),
                      
                      const SizedBox(height: 24),
                      // Layer 2
                      _buildIphoneGlassCard(
                        context: context,
                        isDark: isDark,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            _buildSectionHeader(context, "Spatial Engine Core", Icons.memory_rounded),
                            const SizedBox(height: 16),
                            Text(
                              "An ultra-premium tracking heuristic using raw OS-level accessibility injection and daemon-managed pipelines. No hardware. No gloves. Just pure geometric logic and EMA filtering.",
                              style: TextStyle(height: 1.6, fontSize: 15, color: isDark ? Colors.white70 : Colors.black87),
                            ),
                          ]
                        ),
                      ),

                      const SizedBox(height: 24),
                      // Layer 3
                      _buildIphoneGlassCard(
                        context: context,
                        isDark: isDark,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.center,
                          children: [
                            Text(
                              "悟",
                              style: TextStyle(fontSize: 48, color: accent.withOpacity(0.5)),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              "Stay Empty. Stay Infinite.",
                              style: TextStyle(
                                fontStyle: FontStyle.italic,
                                color: isDark ? Colors.white60 : Colors.black54
                              ),
                            ),
                          ]
                        ),
                      ),

                      const SizedBox(height: 40),
                      
                      // Action Row
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                        children: [
                          _buildGlassIconButton(Icons.code_rounded, () => _launchURL("https://github.com/RajTewari01"), isDark),
                          _buildGlassIconButton(Icons.email_rounded, () => _launchURL("mailto:tewari765@gmail.com"), isDark),
                          _buildGlassIconButton(Icons.language_rounded, () => _launchURL("https://biswadeep.pythonanywhere.com"), isDark),
                        ],
                      ),
                      const SizedBox(height: 80),
                    ],
                  ),
                ),
              )
            ],
          )
        ],
      ),
    );
  }

  // -------------------------------------------------------------
  // CUSTOM PREMIUM IPHONE GLASS UI COMPONENTS
  // -------------------------------------------------------------

  Widget _buildIphoneGlassCard({required BuildContext context, required bool isDark, required Widget child}) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(28),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 30, sigmaY: 30),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.all(28),
          decoration: BoxDecoration(
            color: isDark ? Colors.white.withOpacity(0.04) : Colors.white.withOpacity(0.4),
            borderRadius: BorderRadius.circular(28),
            border: Border.all(
              color: isDark ? Colors.white.withOpacity(0.1) : Colors.white.withOpacity(0.6),
              width: 1.5,
            ),
            boxShadow: isDark ? [] : [
              BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 20, spreadRadius: -5)
            ]
          ),
          child: child,
        ),
      ),
    );
  }

  Widget _buildGlassChip(BuildContext context, String label, bool isDark) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: isDark ? Colors.white.withOpacity(0.05) : Colors.black.withOpacity(0.04),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: isDark ? Colors.white.withOpacity(0.1) : Colors.black.withOpacity(0.1))
      ),
      child: Text(label, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12)),
    );
  }

  Widget _buildSectionHeader(BuildContext context, String title, IconData icon) {
    return Row(
      children: [
        Icon(icon, color: const Color(0xFF34D399), size: 22),
        const SizedBox(width: 10),
        Text(title, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, letterSpacing: -0.5)),
      ],
    );
  }
  
  Widget _buildGlassIconButton(IconData icon, VoidCallback onTap, bool isDark) {
    return GestureDetector(
      onTap: onTap,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(20),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
          child: Container(
            height: 64, width: 64,
            decoration: BoxDecoration(
              color: isDark ? Colors.white.withOpacity(0.05) : Colors.white.withOpacity(0.5),
              border: Border.all(color: isDark ? Colors.white.withOpacity(0.1) : Colors.white),
              borderRadius: BorderRadius.circular(20)
            ),
            child: Icon(icon, size: 28, color: isDark ? Colors.white : Colors.black87),
          ),
        ),
      ),
    );
  }

  // -------------------------------------------------------------
  // PARALLAX MIRROR MOUNTAIN GENERATOR
  // -------------------------------------------------------------
  Widget _buildParallaxMountains(bool isDark) {
    // Math to slowly move the mountains based on scroll
    // Layer 1 is back (moves slowest), Layer 3 is front (moves fastest)
    double l1Offset = _scrollOffset * -0.1;
    double l2Offset = _scrollOffset * -0.25;
    double l3Offset = _scrollOffset * -0.4;
    
    final mountainColor = isDark ? const Color(0xFF1E293B) : const Color(0xFFCBD5E1);

    return SizedBox.expand(
      child: Stack(
        children: [
          // Deepest Layer
          Positioned(
            top: 200 + l1Offset, left: -50, right: -50,
            height: 400,
            child: CustomPaint(painter: _MountainPainter(color: mountainColor.withOpacity(0.3))),
          ),
          // Middle Layer
          Positioned(
            top: 250 + l2Offset, left: -100, right: 0,
            height: 350,
            child: CustomPaint(painter: _MountainPainter(color: mountainColor.withOpacity(0.6))),
          ),
          // Foreground Mirror Lake & Reflection
          Positioned(
            top: 320 + l3Offset, left: -20, right: -120,
            height: 300,
            child: Column(
              children: [
                Expanded(child: CustomPaint(painter: _MountainPainter(color: mountainColor))),
                // The mirror effect via reversed painter and blur
                Expanded(
                  child: Opacity(
                    opacity: 0.3,
                    child: Transform(
                      alignment: Alignment.center,
                      transform: Matrix4.rotationX(3.14159), // Flip Upside Down
                      child: ClipRect(
                        child: BackdropFilter(
                          filter: ImageFilter.blur(sigmaX: 2.0, sigmaY: 5.0), // Mirror blur
                          child: CustomPaint(painter: _MountainPainter(color: mountainColor)),
                        ),
                      ),
                    ),
                  )
                )
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _MountainPainter extends CustomPainter {
  final Color color;
  _MountainPainter({required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.fill;
    
    final path = Path();
    path.moveTo(0, size.height);
    path.lineTo(0, size.height * 0.5);
    // Draw mountain peaks using bezier curves
    path.quadraticBezierTo(size.width * 0.2, size.height * 0.1, size.width * 0.4, size.height * 0.6);
    path.quadraticBezierTo(size.width * 0.7, size.height * 0.2, size.width, size.height * 0.8);
    path.lineTo(size.width, size.height);
    path.close();

    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

