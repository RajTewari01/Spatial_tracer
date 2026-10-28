import 'package:flutter_test/flutter_test.dart';
import 'package:motion_web/main.dart';

void main() {
  testWidgets('MotionWebApp loads smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const MotionWebApp());
    expect(find.text('MotionW'), findsOneWidget);
  });
}
