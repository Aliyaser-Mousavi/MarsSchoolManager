/**
 * Mars School Manager - System Status & Portal Shell
 * Displays real-time database initialization status, seed metrics, and navigation portals.
 */

import React from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useDatabase } from '@/providers/DatabaseProvider';
import { Colors, Spacing } from '@/constants/theme';
import { toPersianDigits } from '@/domain/schemas';

export default function HomeScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const colors = Colors[isDark ? 'dark' : 'light'];
  const { isLoading, error, health, schemaVersion, seedResult } = useDatabase();

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color="#208AEF" />
        <Text style={[styles.loadingText, { color: colors.text }]}>
          در حال بارگذاری پایگاه داده و پیکربندی سیستم...
        </Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>خطا در راه‌اندازی پایگاه داده</Text>
          <Text style={styles.errorMessage}>{error.message}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header Hero */}
        <View style={styles.heroCard}>
          <Text style={styles.appTitle}>مدیریت مکتب مارس</Text>
          <Text style={styles.appSubtitle}>Mars School Manager — سیستم محلی مدیریت نتایج و سوابق تعلیمی</Text>
          <View style={styles.badgeRow}>
            <View style={styles.badgeSuccess}>
              <Text style={styles.badgeText}>آفلاین / بدون اینترنت</Text>
            </View>
            <View style={styles.badgeInfo}>
              <Text style={styles.badgeText}>نسخه اسکیمای دیتابیس: {toPersianDigits(schemaVersion)}</Text>
            </View>
          </View>
        </View>

        {/* System Diagnostics & Integrity Status */}
        <View style={[styles.sectionCard, { backgroundColor: colors.backgroundElement }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>وضعیت هسته پایگاه داده (SQLite WAL)</Text>
          
          <View style={styles.statusRow}>
            <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>سلامت ساختار دیتابیس:</Text>
            <Text style={health?.isHealthy ? styles.statusOk : styles.statusFail}>
              {health?.isHealthy ? 'تأیید شد (PRAGMA integrity_check: ok)' : 'خطا در سلامت داده‌ها'}
            </Text>
          </View>

          <View style={styles.statusRow}>
            <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>مکتب فعال:</Text>
            <Text style={[styles.statusValue, { color: colors.text }]}>
              {seedResult?.schoolName ?? 'در حال بارگذاری'}
            </Text>
          </View>

          <View style={styles.statusRow}>
            <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>سال تعلیمی جاری:</Text>
            <Text style={[styles.statusValue, { color: colors.text }]}>
              {seedResult?.activeYear ?? '۱۴۰۴ هـ ش'}
            </Text>
          </View>
        </View>

        {/* Seed Metrics Grid */}
        <View style={styles.metricsGrid}>
          <View style={[styles.metricCard, { backgroundColor: colors.backgroundElement }]}>
            <Text style={styles.metricNumber}>{toPersianDigits(seedResult?.gradesCount ?? 12)}</Text>
            <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>صنوف فعال (۱ الی ۱۲)</Text>
          </View>

          <View style={[styles.metricCard, { backgroundColor: colors.backgroundElement }]}>
            <Text style={styles.metricNumber}>{toPersianDigits(seedResult?.subjectsCount ?? 15)}</Text>
            <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>مضامین رسمی وزارت معارف</Text>
          </View>
        </View>

        {/* Configured Domain Rules Preview */}
        <View style={[styles.sectionCard, { backgroundColor: colors.backgroundElement }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>قواعد نمره‌دهی و ارتقای صنف (تأیید شده)</Text>
          
          <View style={styles.ruleItem}>
            <Text style={[styles.ruleBullet, { color: colors.textSecondary }]}>•</Text>
            <Text style={[styles.ruleText, { color: colors.text }]}>
              نمرات وسط سال: حداکثر نمره ۴۰ | حد قبولی: ۱۶ (۴۰٪)
            </Text>
          </View>

          <View style={styles.ruleItem}>
            <Text style={[styles.ruleBullet, { color: colors.textSecondary }]}>•</Text>
            <Text style={[styles.ruleText, { color: colors.text }]}>
              نمرات سالانه: حداکثر نمره ۶۰ | حد قبولی: ۲۴ (۴۰٪)
            </Text>
          </View>

          <View style={styles.ruleItem}>
            <Text style={[styles.ruleBullet, { color: colors.textSecondary }]}>•</Text>
            <Text style={[styles.ruleText, { color: colors.text }]}>
              مجموع نهایی: حداکثر ۱۰۰ | حد قبولی مضمون: ۴۰ (۴۰٪)
            </Text>
          </View>

          <View style={styles.ruleItem}>
            <Text style={[styles.ruleBullet, { color: colors.textSecondary }]}>•</Text>
            <Text style={[styles.ruleText, { color: colors.text }]}>
              مشروطی (چانس دوم): ۱ الی ۳ مضمون کمتر از ۴۰
            </Text>
          </View>

          <View style={styles.ruleItem}>
            <Text style={[styles.ruleBullet, { color: colors.textSecondary }]}>•</Text>
            <Text style={[styles.ruleText, { color: colors.text }]}>
              تکرار صنف (ناکامی): بیشتر از ۳ مضمون کمتر از ۴۰ یا اوسط کمتر از ۴۰
            </Text>
          </View>
        </View>

        {/* Portal Shortcuts */}
        <Text style={[styles.portalsHeader, { color: colors.text }]}>بخش‌های عملیاتی مکتب</Text>

        <View style={styles.portalsContainer}>
          <TouchableOpacity
            style={[styles.portalButton, { backgroundColor: '#0F9D58' }]}
            activeOpacity={0.8}
            onPress={() => router.push('/(teacher)/classes')}
          >
            <Text style={styles.portalButtonTitle}>پورتال ثبت نمرات اساتید</Text>
            <Text style={styles.portalButtonDesc}>ورود نمرات چهارونیم ماهه و سالانه با صفحه‌کلید سریع دری و صدور .msmp</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.portalButton, { backgroundColor: '#1A73E8' }]}
            activeOpacity={0.8}
            onPress={() => router.push('/(teacher)/import-package')}
          >
            <Text style={styles.portalButtonTitle}>دریافت و تطبیق بسته نمرات همکاران</Text>
            <Text style={styles.portalButtonDesc}>بررسی فایل‌های .msmp دریافتی از طریق بلوتوث/پیام‌رسان و رفع تداخل نمرات</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.portalButton, { backgroundColor: '#F2994A' }]}
            activeOpacity={0.8}
            onPress={() => router.push('/(admin)/tabulation-sheet')}
          >
            <Text style={styles.portalButtonTitle}>جدول نتایج و چاپ اسناد</Text>
            <Text style={styles.portalButtonDesc}>تولید اکسل ۶ شیته، جدول نتایج A4 افقی و اطلاعنامه‌ها</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  loadingText: {
    marginTop: Spacing.three,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  errorBox: {
    backgroundColor: '#FFEBEE',
    padding: Spacing.four,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EF5350',
    maxWidth: 400,
    width: '100%',
  },
  errorTitle: {
    color: '#C62828',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: Spacing.two,
    textAlign: 'right',
  },
  errorMessage: {
    color: '#B71C1C',
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'right',
  },
  scrollContent: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  heroCard: {
    backgroundColor: '#0D47A1',
    borderRadius: 16,
    padding: Spacing.four,
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  appTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'right',
  },
  appSubtitle: {
    color: '#BBDEFB',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'right',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.two,
    flexWrap: 'wrap',
  },
  badgeSuccess: {
    backgroundColor: '#2E7D32',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeInfo: {
    backgroundColor: '#1565C0',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  sectionCard: {
    borderRadius: 14,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'right',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  statusLabel: {
    fontSize: 14,
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  statusOk: {
    color: '#2E7D32',
    fontWeight: '700',
    fontSize: 13,
  },
  statusFail: {
    color: '#C62828',
    fontWeight: '700',
    fontSize: 13,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  metricCard: {
    flex: 1,
    borderRadius: 14,
    padding: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricNumber: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1A73E8',
  },
  metricLabel: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 4,
  },
  ruleItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 2,
  },
  ruleBullet: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  ruleText: {
    fontSize: 13,
    lineHeight: 22,
    flex: 1,
    textAlign: 'right',
  },
  portalsHeader: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: Spacing.two,
    textAlign: 'right',
  },
  portalsContainer: {
    gap: Spacing.two,
  },
  portalButton: {
    borderRadius: 14,
    padding: Spacing.three,
    gap: 4,
  },
  portalButtonTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'right',
  },
  portalButtonDesc: {
    color: '#E8F0FE',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'right',
  },
});
