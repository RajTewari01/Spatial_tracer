import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

class CreatorProfileScreen extends StatelessWidget {
  const CreatorProfileScreen({super.key});

  Future<void> _launchURL(String urlString) async {
    final Uri url = Uri.parse(urlString);
    if (!await launchUrl(url, mode: LaunchMode.externalApplication)) {
      debugPrint("Could not launch $urlString");
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: CustomScrollView(
        physics: const BouncingScrollPhysics(),
        slivers: [
          SliverAppBar(
            expandedHeight: 320,
            pinned: true,
            stretch: true,
            backgroundColor: Theme.of(context).appBarTheme.backgroundColor,
            iconTheme: Theme.of(context).iconTheme,
            flexibleSpace: FlexibleSpaceBar(
              titlePadding: const EdgeInsets.only(left: 16, bottom: 16),
              background: Stack(
                fit: StackFit.expand,
                children: [
                  Container(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: isDark 
                          ? [const Color(0xFF0D1117), const Color(0xFF161B22)] 
                          : [Colors.white, const Color(0xFFF3F4F6)],
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                      )
                    ),
                  ),
                  Positioned(
                    top: -100, right: -50,
                    child: Container(
                      width: 250, height: 250,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: Theme.of(context).colorScheme.primary.withOpacity(isDark ? 0.15 : 0.05)
                      )
                    )
                  ),
                  Center(
                    child: Hero(
                      tag: 'creator_avatar',
                      child: Container(
                        width: 140, height: 140,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(color: Theme.of(context).colorScheme.primary, width: 3),
                          image: const DecorationImage(
                            image: AssetImage('assets/images/app_icon.png'),
                            fit: BoxFit.cover,
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: Theme.of(context).colorScheme.primary.withOpacity(0.4),
                              blurRadius: 40, spreadRadius: 5
                            )
                          ]
                        ),
                      ),
                    ),
                  )
                ],
              ),
            ),
          ),
          
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(24.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Layer 1
                  AnimatedOpacity(
                    opacity: 1.0, duration: const Duration(milliseconds: 500),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _buildSectionHeader(context, "About the Creator", Icons.person_rounded),
                        const SizedBox(height: 16),
                        _buildGlassCard(context, [
                          Text("Full-Stack & AI/ML Engineer based in West Bengal, India. Specializing in LangChain systems, Local LLMs, and multi-platform Flutter apps.", style: Theme.of(context).textTheme.bodyMedium?.copyWith(height: 1.6)),
                          const SizedBox(height: 16),
                          Wrap(
                            spacing: 8, runSpacing: 8,
                            children: ["Python", "Dart", "Kotlin", "FastAPI", "TensorFlow", "Kubernetes"].map((e) => _buildChip(context, e)).toList(),
                          )
                        ]),
                      ]
                    )
                  ),
                  
                  const SizedBox(height: 32),
                  
                  // Layer 2
                  AnimatedOpacity(
                    opacity: 1.0, duration: const Duration(milliseconds: 700),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _buildSectionHeader(context, "The Builds", Icons.architecture_rounded),
                        const SizedBox(height: 16),
                        _buildGlassCard(context, [
                          Text("Spatial Tracer Engine", style: Theme.of(context).textTheme.titleLarge),
                          const SizedBox(height: 8),
                          Text("A multi-platform air gesture engine executing 13 unique ML-accelerated gestures across Android, Desktop, and Web. Replaces the mouse and keyboard entirely using MediaPipe Hand Tracking.", style: Theme.of(context).textTheme.bodyMedium?.copyWith(height: 1.6)),
                        ]),
                      ]
                    )
                  ),
                  
                  const SizedBox(height: 32),
                  
                  // Layer 3
                  AnimatedOpacity(
                    opacity: 1.0, duration: const Duration(milliseconds: 900),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _buildSectionHeader(context, "Accomplishments & Vision", Icons.auto_awesome_rounded),
                        const SizedBox(height: 16),
                        _buildGlassCard(context, [
                          Text("Control your computer and phone with nothing but your hands. No hardware. No gloves.", style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontStyle: FontStyle.italic)),
                          const SizedBox(height: 32),
                          Center(
                            child: Text("build > ship > learn > repeat", style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Theme.of(context).colorScheme.primary, fontWeight: FontWeight.bold, fontSize: 16, letterSpacing: 1.2)),
                          )
                        ]),
                      ]
                    )
                  ),
                  
                  const SizedBox(height: 64),
                  
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                    children: [
                      IconButton(icon: Icon(Icons.code_rounded, color: Theme.of(context).iconTheme.color), onPressed: () => _launchURL("https://github.com/RajTewari01")),
                      IconButton(icon: Icon(Icons.email_rounded, color: Theme.of(context).iconTheme.color), onPressed: () => _launchURL("mailto:tewari765@gmail.com")),
                      IconButton(icon: Icon(Icons.language_rounded, color: Theme.of(context).iconTheme.color), onPressed: () => _launchURL("https://biswadeep.pythonanywhere.com")),
                    ],
                  ),
                  const SizedBox(height: 48),
                ],
              ),
            ),
          )
        ],
      )
    );
  }

  Widget _buildSectionHeader(BuildContext context, String title, IconData icon) {
    return Row(
      children: [
        Icon(icon, color: Theme.of(context).colorScheme.primary),
        const SizedBox(width: 12),
        Text(title, style: Theme.of(context).textTheme.titleLarge?.copyWith(fontSize: 22, letterSpacing: -0.5)),
      ],
    );
  }

  Widget _buildGlassCard(BuildContext context, List<Widget> children) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(28),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface.withOpacity(isDark ? 0.6 : 1.0),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: isDark ? Colors.white10 : Colors.black.withOpacity(0.05)),
        boxShadow: isDark ? [] : [
          BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 20, spreadRadius: 5)
        ]
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: children,
      ),
    );
  }

  Widget _buildChip(BuildContext context, String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.primary.withOpacity(0.1),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Theme.of(context).colorScheme.primary.withOpacity(0.3))
      ),
      child: Text(label, style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Theme.of(context).colorScheme.primary, fontWeight: FontWeight.bold)),
    );
  }
}
