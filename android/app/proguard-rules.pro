# Keep the PostgreSQL JDBC driver and its SCRAM auth dependency intact.
-keep class org.postgresql.** { *; }
-keep class com.ongres.** { *; }
-dontwarn org.postgresql.**
-dontwarn com.ongres.**
# The driver references a handful of desktop-JVM classes that do not exist on
# Android but are never touched on the code paths this app uses.
-dontwarn java.beans.**
-dontwarn javax.naming.**
-dontwarn javax.transaction.**
-dontwarn org.slf4j.**
-dontwarn org.ietf.jgss.**
