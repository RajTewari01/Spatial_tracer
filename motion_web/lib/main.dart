import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'screens/webview_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();

  // Transparent status bar overlay for splash screen
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
      systemNavigationBarColor: Colors.transparent,
      systemNavigationBarIconBrightness: Brightness.light,
    ),
  );

  runApp(const MotionWebApp());
}

class MotionWebApp extends StatelessWidget {
  const MotionWebApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'MotionW',
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark().copyWith(
        scaffoldBackgroundColor: const Color(0xFF070103),
        primaryColor: const Color(0xFF070103),
        colorScheme: const ColorScheme.dark(
          primary: Colors.white,
          surface: Color(0xFF070103),
        ),
        textTheme: GoogleFonts.interTextTheme(
          ThemeData.dark().textTheme,
        ),
      ),
      home: const WebViewScreen(),
    );
  }
}
