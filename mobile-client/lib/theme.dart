import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';

class ThemeProvider with ChangeNotifier {
  ThemeMode _themeMode = ThemeMode.system;

  ThemeMode get themeMode => _themeMode;

  bool get isDarkMode => _themeMode == ThemeMode.dark ||
      (_themeMode == ThemeMode.system &&
          WidgetsBinding.instance.platformDispatcher.platformBrightness == Brightness.dark);

  ThemeProvider() {
    _loadThemePreference();
  }

  void toggleTheme(bool isOn) async {
    _themeMode = isOn ? ThemeMode.dark : ThemeMode.light;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('isDarkMode', isOn);
  }

  Future<void> _loadThemePreference() async {
    final prefs = await SharedPreferences.getInstance();
    final isDark = prefs.getBool('isDarkMode');
    if (isDark != null) {
      _themeMode = isDark ? ThemeMode.dark : ThemeMode.light;
      notifyListeners();
    }
  }
}

class AppTheme {
  static ThemeData get lightTheme {
    return ThemeData(
      brightness: Brightness.light,
      primaryColor: Colors.white,
      scaffoldBackgroundColor: const Color(0xFFF3F4F6),
      colorScheme: const ColorScheme.light(
        primary: Color(0xFF58A6FF),
        secondary: Color(0xFF3FB950),
        surface: Colors.white,
        background: Color(0xFFF3F4F6),
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: IconThemeData(color: Colors.black87),
        titleTextStyle: TextStyle(color: Colors.black87, fontSize: 20, fontWeight: FontWeight.bold),
      ),
      textTheme: GoogleFonts.interTextTheme(ThemeData.light().textTheme).copyWith(
        displayLarge: GoogleFonts.inter(fontWeight: FontWeight.w800, color: Colors.black87),
        titleLarge: GoogleFonts.inter(fontWeight: FontWeight.bold, color: Colors.black87),
        bodyMedium: GoogleFonts.inter(color: Colors.black87),
        bodySmall: GoogleFonts.robotoMono(color: Colors.black54),
      ),
      drawerTheme: const DrawerThemeData(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
      ),
    );
  }

  static ThemeData get darkTheme {
    return ThemeData(
      brightness: Brightness.dark,
      primaryColor: const Color(0xFF0D1117), // GitHub dark theme background
      scaffoldBackgroundColor: const Color(0xFF0D1117),
      colorScheme: const ColorScheme.dark(
        primary: Color(0xFF58A6FF), // Dev blue
        secondary: Color(0xFF3FB950), // Dev green
        surface: Color(0xFF161B22), // Elevated surface
        background: Color(0xFF0D1117),
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: IconThemeData(color: Colors.white),
        titleTextStyle: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold),
      ),
      textTheme: GoogleFonts.interTextTheme(ThemeData.dark().textTheme).copyWith(
        displayLarge: GoogleFonts.inter(fontWeight: FontWeight.w800, color: Colors.white),
        titleLarge: GoogleFonts.inter(fontWeight: FontWeight.bold, color: Colors.white),
        bodyMedium: GoogleFonts.inter(color: const Color(0xFFC9D1D9)),
        bodySmall: GoogleFonts.robotoMono(color: const Color(0xFF8B949E)),
      ),
      drawerTheme: const DrawerThemeData(
        backgroundColor: Color(0xFF0D1117), // Pitch black/dark grey
        surfaceTintColor: Colors.transparent,
      ),
    );
  }
}
