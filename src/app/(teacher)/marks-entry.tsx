/**
 * Mars School Manager - High-Speed Mobile Marks Entry Portal
 * Touch-optimized for teachers with custom Persian keypad, real-time boundary validation,
 * automatic student advance, and direct offline .msmp package export.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { marksService } from '@/services/marksService';
import { exchangeService } from '@/services/exchangeService';
import { MarkStatus } from '@/types/database';
import { Colors, Spacing } from '@/constants/theme';
import { toPersianDigits } from '@/domain/schemas';

interface StudentMarkItem {
  enrollmentId: string;
  studentId: string;
  asasNumber: string;
  rollNumber: number | null;
  studentName: string;
  fatherName: string;
  markValue: number | null;
  status: MarkStatus;
  isDirty: boolean;
}

export default function MarksEntryScreen() {
  const params = useLocalSearchParams<{
    sectionId: string;
    gradeSubjectId: string;
    examPeriodId: string;
    subjectName?: string;
  }>();

  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const colors = Colors[isDark ? 'dark' : 'light'];

  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [configId, setConfigId] = useState<string | null>(null);
  const [maxMark, setMaxMark] = useState(40);
  const [passMark, setPassMark] = useState(16);
  const [students, setStudents] = useState<StudentMarkItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [validationError, setValidationError] = useState<string | null>(null);

  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchMarks() {
      if (!params.sectionId || !params.examPeriodId || !params.gradeSubjectId) return;

      try {
        const grid = await marksService.getSectionMarksGridAsync(params.sectionId, params.examPeriodId);
        const subjectHeader = grid.subjects.find((s) => s.gradeSubjectId === params.gradeSubjectId);
        if (!subjectHeader) throw new Error('مضمون انتخابی یافت نشد');

        if (isMounted) {
          setConfigId(subjectHeader.configId);
          setMaxMark(subjectHeader.maxMark);
          setPassMark(subjectHeader.passMark);

          const items: StudentMarkItem[] = grid.students.map((st) => {
            const cell = st.marks[subjectHeader.configId];
            return {
              enrollmentId: st.enrollmentId,
              studentId: st.studentId,
              asasNumber: st.asasNumber,
              rollNumber: st.rollNumber,
              studentName: st.studentName,
              fatherName: st.fatherName,
              markValue: cell?.markValue ?? null,
              status: cell?.status ?? 'ENTERED',
              isDirty: false,
            };
          });

          setStudents(items);
          setSelectedIndex(0);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Error loading marks entry grid:', err);
        Alert.alert('خطا', 'امکان بارگذاری لیست نمرات وجود ندارد');
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchMarks();

    return () => {
      isMounted = false;
    };
  }, [params.sectionId, params.examPeriodId, params.gradeSubjectId]);

  // Current selected student
  const currentStudent = students[selectedIndex] ?? null;

  // Keypad click handler
  const handleKeypadPress = async (key: string) => {
    if (!currentStudent || !configId) return;
    setValidationError(null);

    let currentValueStr = currentStudent.markValue !== null ? String(currentStudent.markValue) : '';

    if (key === 'BACKSPACE') {
      if (currentValueStr.length <= 1) {
        await updateStudentMark(selectedIndex, null, 'ENTERED');
      } else {
        const nextStr = currentValueStr.slice(0, -1);
        const nextVal = Number(nextStr);
        await updateStudentMark(selectedIndex, isNaN(nextVal) ? null : nextVal, 'ENTERED');
      }
      return;
    }

    if (key === '.') {
      if (currentValueStr.includes('.')) return;
      currentValueStr = currentValueStr === '' ? '0.' : `${currentValueStr}.`;
      // Don't commit fractional yet, wait for next digit
      return;
    }

    // Append digit
    const newStr = `${currentValueStr}${key}`;
    const newNum = Number(newStr);

    if (isNaN(newNum)) return;

    if (newNum > maxMark) {
      setValidationError(`نمره نمی‌تواند از حداکثر (${toPersianDigits(maxMark)}) بیشتر باشد`);
      return;
    }

    await updateStudentMark(selectedIndex, newNum, 'ENTERED');

    // Auto-advance if number has reached max potential digits
    if (newNum * 10 > maxMark) {
      advanceToNextStudent();
    }
  };

  // Status button handler (ABSENT, EXEMPT, CLEAR)
  const handleStatusChange = async (status: MarkStatus, markValue: number | null) => {
    if (!currentStudent || !configId) return;
    setValidationError(null);
    await updateStudentMark(selectedIndex, markValue, status);
    advanceToNextStudent();
  };

  // Update mark in state and persist to SQLite
  const updateStudentMark = async (index: number, markValue: number | null, status: MarkStatus) => {
    const student = students[index];
    if (!student || !configId) return;

    // Update local state immediately for zero latency
    setStudents((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...student,
        markValue,
        status,
        isDirty: true,
      };
      return copy;
    });

    try {
      // Background save to SQLite with audit logging
      await marksService.saveMarkAsync(
        {
          enrollment_id: student.enrollmentId,
          exam_subject_config_id: configId,
          mark_value: markValue,
          status,
          entered_by_user_id: 'LOCAL-TEACHER',
        },
        'LOCAL-TEACHER',
        'ورود نمره از پورتال موبایل استاد'
      );
    } catch (err) {
      console.error('Error saving mark:', err);
    }
  };

  const advanceToNextStudent = () => {
    if (selectedIndex < students.length - 1) {
      const next = selectedIndex + 1;
      setSelectedIndex(next);
      flatListRef.current?.scrollToIndex({ index: next, animated: true, viewPosition: 0.5 });
    }
  };

  const advanceToPreviousStudent = () => {
    if (selectedIndex > 0) {
      const prev = selectedIndex - 1;
      setSelectedIndex(prev);
      flatListRef.current?.scrollToIndex({ index: prev, animated: true, viewPosition: 0.5 });
    }
  };

  // Export submission package (.msmp)
  const handleExportPackage = async () => {
    if (!params.sectionId || !params.gradeSubjectId || !params.examPeriodId) return;

    try {
      setIsExporting(true);
      const result = await exchangeService.generateTeacherPackageAsync({
        teacherId: 'LOCAL-TEACHER',
        sectionId: params.sectionId,
        gradeSubjectId: params.gradeSubjectId,
        examPeriodId: params.examPeriodId,
      });

      Alert.alert(
        'بسته نمرات آماده شد',
        `بسته نمرات شاگردان با شناسه زیر صادر شد:\n${result.packageId.slice(0, 8)}...\nمی‌توانید فایل .msmp را از طریق بلوتوث یا پیام‌رسان‌ها برای اداره مکتب ارسال نمایید.`
      );
    } catch (err) {
      console.error('Error exporting package:', err);
      Alert.alert('خطا در صدور بسته', String(err));
    } finally {
      setIsExporting(false);
    }
  };

  // Summary Metrics
  const totalCount = students.length;
  const completedCount = students.filter((s) => s.markValue !== null || s.status !== 'ENTERED').length;
  const absentCount = students.filter((s) => s.status === 'ABSENT').length;
  const missingCount = totalCount - completedCount;

  if (isLoading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color="#1A73E8" />
        <Text style={[styles.loadingText, { color: colors.text }]}>در حال بارگذاری لیست نمرات...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Header & Metrics Strip */}
      <View style={[styles.topHeader, { backgroundColor: colors.backgroundElement }]}>
        <View style={styles.headerTitleRow}>
          <Text style={[styles.headerSubject, { color: colors.text }]}>
            مضمون: {params.subjectName ?? 'نمرات صنف'}
          </Text>
          <TouchableOpacity
            style={[styles.exportBtn, isExporting && { opacity: 0.5 }]}
            onPress={handleExportPackage}
            disabled={isExporting}
          >
            <Text style={styles.exportBtnText}>{isExporting ? 'در حال صدور...' : 'صدور بسته (.msmp)'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.metricsStrip}>
          <Text style={[styles.metricText, { color: colors.textSecondary }]}>
            مجموع: <Text style={styles.boldNum}>{toPersianDigits(totalCount)}</Text>
          </Text>
          <Text style={[styles.metricText, { color: '#0F9D58' }]}>
            تکمیل: <Text style={styles.boldNum}>{toPersianDigits(completedCount)}</Text>
          </Text>
          <Text style={[styles.metricText, { color: '#E53935' }]}>
            غایب: <Text style={styles.boldNum}>{toPersianDigits(absentCount)}</Text>
          </Text>
          <Text style={[styles.metricText, { color: '#F2994A' }]}>
            باقیمانده: <Text style={styles.boldNum}>{toPersianDigits(missingCount)}</Text>
          </Text>
        </View>
      </View>

      {/* Validation Warning Alert */}
      {validationError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{validationError}</Text>
        </View>
      )}

      {/* Virtualized Student List */}
      <FlatList
        ref={flatListRef}
        data={students}
        keyExtractor={(item) => item.enrollmentId}
        extraData={selectedIndex}
        contentContainerStyle={styles.listContent}
        renderItem={({ item, index }) => {
          const isSelected = index === selectedIndex;
          const isPass = item.markValue !== null && item.markValue >= passMark;

          return (
            <TouchableOpacity
              style={[
                styles.studentRow,
                { backgroundColor: colors.backgroundElement },
                isSelected && styles.studentRowSelected,
              ]}
              onPress={() => {
                setSelectedIndex(index);
                setValidationError(null);
              }}
              activeOpacity={0.8}
            >
              {/* Roll Number */}
              <View style={[styles.rollBadge, isSelected && styles.rollBadgeSelected]}>
                <Text style={[styles.rollText, isSelected && styles.rollTextSelected]}>
                  {toPersianDigits(item.rollNumber ?? index + 1)}
                </Text>
              </View>

              {/* Student Particulars */}
              <View style={styles.studentInfo}>
                <Text style={[styles.studentName, { color: colors.text }]}>{item.studentName}</Text>
                <Text style={[styles.fatherName, { color: colors.textSecondary }]}>
                  ولد: {item.fatherName} | اساس: {toPersianDigits(item.asasNumber)}
                </Text>
              </View>

              {/* Mark / Status Display Box */}
              <View style={styles.markContainer}>
                {item.status === 'ABSENT' ? (
                  <View style={styles.badgeAbsent}>
                    <Text style={styles.badgeAbsentText}>غائب</Text>
                  </View>
                ) : item.status === 'EXEMPT' ? (
                  <View style={styles.badgeExempt}>
                    <Text style={styles.badgeExemptText}>معذور</Text>
                  </View>
                ) : item.markValue !== null ? (
                  <View style={[styles.markBadge, isPass ? styles.markPass : styles.markFail]}>
                    <Text style={styles.markBadgeText}>{toPersianDigits(item.markValue)}</Text>
                  </View>
                ) : (
                  <View style={styles.badgeMissing}>
                    <Text style={styles.badgeMissingText}>ثبت نشده</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* Selected Student Active Banner */}
      {currentStudent && (
        <View style={styles.activeStudentBar}>
          <Text style={styles.activeStudentText}>
            ورود نمره برای: <Text style={styles.activeStudentName}>{currentStudent.studentName}</Text> (حداکثر:{' '}
            {toPersianDigits(maxMark)})
          </Text>
          <View style={styles.activeScoreBox}>
            <Text style={styles.activeScoreText}>
              {currentStudent.status === 'ABSENT'
                ? 'غائب'
                : currentStudent.status === 'EXEMPT'
                ? 'معذور'
                : currentStudent.markValue !== null
                ? toPersianDigits(currentStudent.markValue)
                : '—'}
            </Text>
          </View>
        </View>
      )}

      {/* Quick Action Toggles */}
      <View style={styles.actionsToolbar}>
        <TouchableOpacity style={styles.toolBtn} onPress={advanceToPreviousStudent}>
          <Text style={styles.toolBtnText}>⬆ قبلی</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toolBtn, styles.toolBtnAbsent]}
          onPress={() => handleStatusChange('ABSENT', 0)}
        >
          <Text style={styles.toolBtnAbsentText}>غائب</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toolBtn, styles.toolBtnExempt]}
          onPress={() => handleStatusChange('EXEMPT', null)}
        >
          <Text style={styles.toolBtnExemptText}>معذور</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toolBtn, styles.toolBtnClear]}
          onPress={() => handleStatusChange('ENTERED', null)}
        >
          <Text style={styles.toolBtnClearText}>پاک کردن</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.toolBtn} onPress={advanceToNextStudent}>
          <Text style={styles.toolBtnText}>بعدی ⬇</Text>
        </TouchableOpacity>
      </View>

      {/* Custom Persian Numeric Keypad */}
      <View style={styles.keypadContainer}>
        <View style={styles.keypadRow}>
          {['۷', '۸', '۹'].map((key) => (
            <TouchableOpacity key={key} style={styles.keypadKey} onPress={() => handleKeypadPress(key)}>
              <Text style={styles.keypadText}>{key}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.keypadRow}>
          {['۴', '۵', '۶'].map((key) => (
            <TouchableOpacity key={key} style={styles.keypadKey} onPress={() => handleKeypadPress(key)}>
              <Text style={styles.keypadText}>{key}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.keypadRow}>
          {['۱', '۲', '۳'].map((key) => (
            <TouchableOpacity key={key} style={styles.keypadKey} onPress={() => handleKeypadPress(key)}>
              <Text style={styles.keypadText}>{key}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.keypadRow}>
          <TouchableOpacity style={styles.keypadKey} onPress={() => handleKeypadPress('.')}>
            <Text style={styles.keypadText}>٫</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.keypadKey} onPress={() => handleKeypadPress('۰')}>
            <Text style={styles.keypadText}>۰</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.keypadKey, styles.keypadBackspace]}
            onPress={() => handleKeypadPress('BACKSPACE')}
          >
            <Text style={styles.keypadBackspaceText}>⌫</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
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
  },
  loadingText: {
    marginTop: Spacing.two,
    fontSize: 14,
  },
  topHeader: {
    padding: Spacing.three,
    gap: 8,
  },
  headerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerSubject: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'right',
  },
  exportBtn: {
    backgroundColor: '#0F9D58',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  exportBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  metricsStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  metricText: {
    fontSize: 12,
  },
  boldNum: {
    fontWeight: '800',
  },
  errorBanner: {
    backgroundColor: '#FFEBEE',
    paddingVertical: 6,
    paddingHorizontal: Spacing.four,
    borderBottomWidth: 1,
    borderBottomColor: '#EF5350',
  },
  errorBannerText: {
    color: '#C62828',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  listContent: {
    padding: Spacing.three,
    gap: 6,
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 10,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  studentRowSelected: {
    borderColor: '#1A73E8',
    backgroundColor: '#E8F0FE',
  },
  rollBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rollBadgeSelected: {
    backgroundColor: '#1A73E8',
  },
  rollText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#424242',
  },
  rollTextSelected: {
    color: '#FFFFFF',
  },
  studentInfo: {
    flex: 1,
    alignItems: 'flex-start',
  },
  studentName: {
    fontSize: 14,
    fontWeight: '700',
  },
  fatherName: {
    fontSize: 11,
    marginTop: 2,
  },
  markContainer: {},
  markBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 50,
    alignItems: 'center',
  },
  markPass: {
    backgroundColor: '#E8F5E9',
  },
  markFail: {
    backgroundColor: '#FFEBEE',
  },
  markBadgeText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#2E7D32',
  },
  badgeAbsent: {
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  badgeAbsentText: {
    color: '#C62828',
    fontSize: 12,
    fontWeight: '700',
  },
  badgeExempt: {
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  badgeExemptText: {
    color: '#E65100',
    fontSize: 12,
    fontWeight: '700',
  },
  badgeMissing: {
    backgroundColor: '#FFF8E1',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  badgeMissingText: {
    color: '#F57F17',
    fontSize: 11,
    fontWeight: '600',
  },
  activeStudentBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0D47A1',
    paddingHorizontal: Spacing.four,
    paddingVertical: 8,
  },
  activeStudentText: {
    color: '#FFFFFF',
    fontSize: 13,
  },
  activeStudentName: {
    fontWeight: '800',
    color: '#90CAF9',
  },
  activeScoreBox: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
  },
  activeScoreText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0D47A1',
  },
  actionsToolbar: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: Spacing.three,
    paddingVertical: 6,
    backgroundColor: '#EEEEEE',
  },
  toolBtn: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    alignItems: 'center',
  },
  toolBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#424242',
  },
  toolBtnAbsent: {
    backgroundColor: '#FFEBEE',
  },
  toolBtnAbsentText: {
    color: '#C62828',
    fontSize: 12,
    fontWeight: '700',
  },
  toolBtnExempt: {
    backgroundColor: '#FFF3E0',
  },
  toolBtnExemptText: {
    color: '#E65100',
    fontSize: 12,
    fontWeight: '700',
  },
  toolBtnClear: {
    backgroundColor: '#FAFAFA',
  },
  toolBtnClearText: {
    color: '#757575',
    fontSize: 12,
    fontWeight: '600',
  },
  keypadContainer: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
    paddingTop: 4,
    backgroundColor: '#FAFAFA',
    gap: 6,
  },
  keypadRow: {
    flexDirection: 'row',
    gap: 6,
  },
  keypadKey: {
    flex: 1,
    height: 48,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  keypadText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#212121',
  },
  keypadBackspace: {
    backgroundColor: '#ECEFF1',
  },
  keypadBackspaceText: {
    fontSize: 18,
    color: '#455A64',
  },
});
