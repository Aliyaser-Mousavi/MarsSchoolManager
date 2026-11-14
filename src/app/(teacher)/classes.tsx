/**
 * Mars School Manager - Teacher Section & Subject Selector
 * Allows teachers to select an assigned class, subject, and exam period to enter marks.
 */

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { configService } from '@/services/configService';
import { AcademicYear, ExamPeriod, Grade, GradeSubject, Section } from '@/types/database';
import { Colors, Spacing } from '@/constants/theme';
import { toPersianDigits } from '@/domain/schemas';

export default function TeacherClassesScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const colors = Colors[isDark ? 'dark' : 'light'];

  const [isLoading, setIsLoading] = useState(true);
  const [activeYear, setActiveYear] = useState<AcademicYear | null>(null);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [selectedGradeId, setSelectedGradeId] = useState<string | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [examPeriods, setExamPeriods] = useState<ExamPeriod[]>([]);
  const [selectedExamPeriodId, setSelectedExamPeriodId] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<(GradeSubject & { subject_name: string; subject_code: string })[]>([]);

  useEffect(() => {
    async function init() {
      try {
        setIsLoading(true);
        const year = await configService.getActiveAcademicYearAsync();
        setActiveYear(year);

        const allGrades = await configService.getAllGradesAsync();
        setGrades(allGrades);

        const periods = await configService.getExamPeriodsForYearAsync(year.id);
        setExamPeriods(periods);
        if (periods.length > 0) {
          // Default to Mid-term or first period
          const midTerm = periods.find((p) => p.code === 'MID_TERM') ?? periods[0];
          setSelectedExamPeriodId(midTerm.id);
        }

        // Default to Grade 8 (Grade code level 8) if present, else first
        const defaultGrade = allGrades.find((g) => g.code_level === 8) ?? allGrades[0];
        if (defaultGrade) {
          setSelectedGradeId(defaultGrade.id);
          const gradeSections = await configService.getSectionsByGradeAsync(defaultGrade.id);
          setSections(gradeSections);
          if (gradeSections.length > 0) {
            setSelectedSectionId(gradeSections[0].id);
          }

          const gradeSubs = await configService.getGradeSubjectsAsync(defaultGrade.id, year.id);
          setSubjects(gradeSubs);
        }
      } catch (err) {
        console.error('Error loading teacher classes:', err);
      } finally {
        setIsLoading(false);
      }
    }

    init();
  }, []);

  // Handle grade change
  const handleSelectGrade = async (gradeId: string) => {
    setSelectedGradeId(gradeId);
    if (!activeYear) return;
    try {
      const gradeSections = await configService.getSectionsByGradeAsync(gradeId);
      setSections(gradeSections);
      setSelectedSectionId(gradeSections.length > 0 ? gradeSections[0].id : null);

      const gradeSubs = await configService.getGradeSubjectsAsync(gradeId, activeYear.id);
      setSubjects(gradeSubs);
    } catch (err) {
      console.error('Error changing grade:', err);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color="#1A73E8" />
        <Text style={[styles.loadingText, { color: colors.text }]}>در حال بارگذاری لیست صنوف...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Banner & Offline Import Button */}
      <View style={styles.topActionsRow}>
        <View style={styles.yearTag}>
          <Text style={styles.yearText}>سال تعلیمی: {activeYear?.name}</Text>
        </View>

        <TouchableOpacity
          style={styles.importPackageBtn}
          onPress={() => router.push('/(teacher)/import-package')}
          activeOpacity={0.8}
        >
          <Text style={styles.importPackageText}>دریافت بسته (.msmp)</Text>
        </TouchableOpacity>
      </View>

      {/* Grade Selector (Horizontal Chips) */}
      <View style={styles.filterSection}>
        <Text style={[styles.filterTitle, { color: colors.textSecondary }]}>انتخاب صنف:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
          {grades.map((grade) => {
            const isSelected = grade.id === selectedGradeId;
            return (
              <TouchableOpacity
                key={grade.id}
                style={[
                  styles.chip,
                  isSelected ? styles.chipSelected : { backgroundColor: colors.backgroundElement },
                ]}
                onPress={() => handleSelectGrade(grade.id)}
              >
                <Text style={[styles.chipText, isSelected ? styles.chipTextSelected : { color: colors.text }]}>
                  {grade.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Section Selector */}
      {sections.length > 0 ? (
        <View style={styles.filterSection}>
          <Text style={[styles.filterTitle, { color: colors.textSecondary }]}>شعبه / سکشن:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
            {sections.map((section) => {
              const isSelected = section.id === selectedSectionId;
              return (
                <TouchableOpacity
                  key={section.id}
                  style={[
                    styles.chip,
                    isSelected ? styles.chipSelected : { backgroundColor: colors.backgroundElement },
                  ]}
                  onPress={() => setSelectedSectionId(section.id)}
                >
                  <Text style={[styles.chipText, isSelected ? styles.chipTextSelected : { color: colors.text }]}>
                    {section.full_name || `شعبه ${section.name}`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      ) : (
        <View style={styles.emptyNotice}>
          <Text style={[styles.emptyNoticeText, { color: colors.textSecondary }]}>
            هنوز شعبه‌ای برای این صنف ایجاد نشده است.
          </Text>
        </View>
      )}

      {/* Exam Period Selector */}
      <View style={styles.filterSection}>
        <Text style={[styles.filterTitle, { color: colors.textSecondary }]}>دوره امتحان:</Text>
        <View style={styles.periodRow}>
          {examPeriods.map((period) => {
            const isSelected = period.id === selectedExamPeriodId;
            return (
              <TouchableOpacity
                key={period.id}
                style={[
                  styles.periodTab,
                  isSelected ? styles.periodTabSelected : { backgroundColor: colors.backgroundElement },
                ]}
                onPress={() => setSelectedExamPeriodId(period.id)}
              >
                <Text
                  style={[styles.periodTabText, isSelected ? styles.periodTabTextSelected : { color: colors.text }]}
                >
                  {period.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Subjects Grid Header */}
      <View style={styles.subjectListHeader}>
        <Text style={[styles.subjectListTitle, { color: colors.text }]}>
          مضامین درسی ({toPersianDigits(subjects.length)})
        </Text>
        <Text style={[styles.subjectListSubtitle, { color: colors.textSecondary }]}>
          برای ورود نمرات روی مضمون مورد نظر ضربه بزنید
        </Text>
      </View>

      {/* Subjects Cards List */}
      <FlatList
        data={subjects}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.subjectsContainer}
        renderItem={({ item, index }) => {
          const isActive = item.is_active_in_grade === 1;
          const currentPeriod = examPeriods.find((p) => p.id === selectedExamPeriodId);
          const maxMark = currentPeriod?.code === 'ANNUAL' ? 60 : 40;
          const passMark = currentPeriod?.code === 'ANNUAL' ? 24 : 16;

          return (
            <TouchableOpacity
              style={[
                styles.subjectCard,
                { backgroundColor: colors.backgroundElement },
                !isActive && styles.subjectCardInactive,
              ]}
              disabled={!isActive || !selectedSectionId || !selectedExamPeriodId}
              onPress={() => {
                if (selectedSectionId && selectedExamPeriodId) {
                  router.push({
                    pathname: '/(teacher)/marks-entry',
                    params: {
                      sectionId: selectedSectionId,
                      gradeSubjectId: item.id,
                      examPeriodId: selectedExamPeriodId,
                      subjectName: item.subject_name,
                    },
                  });
                }
              }}
              activeOpacity={0.7}
            >
              <View style={styles.subjectIndexBadge}>
                <Text style={styles.subjectIndexText}>{toPersianDigits(index + 1)}</Text>
              </View>

              <View style={styles.subjectDetails}>
                <Text style={[styles.subjectName, { color: colors.text }]}>{item.subject_name}</Text>
                <Text style={[styles.subjectSubText, { color: colors.textSecondary }]}>
                  حداکثر نمره: {toPersianDigits(maxMark)} | حد قبولی: {toPersianDigits(passMark)}
                </Text>
              </View>

              <View style={styles.subjectActionBadge}>
                {isActive ? (
                  <View style={styles.activeTag}>
                    <Text style={styles.activeTagText}>ورود نمرات ➔</Text>
                  </View>
                ) : (
                  <View style={styles.inactiveTag}>
                    <Text style={styles.inactiveTagText}>غیرفعال در این صنف</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        }}
      />
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
  topActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  yearTag: {
    backgroundColor: '#E8F0FE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  yearText: {
    color: '#1A73E8',
    fontWeight: '700',
    fontSize: 13,
  },
  importPackageBtn: {
    backgroundColor: '#0F9D58',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  importPackageText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  filterSection: {
    paddingHorizontal: Spacing.four,
    marginTop: Spacing.two,
  },
  filterTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    textAlign: 'right',
  },
  chipsScroll: {
    gap: 8,
    flexDirection: 'row-reverse',
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipSelected: {
    backgroundColor: '#1A73E8',
    borderColor: '#1565C0',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  periodRow: {
    flexDirection: 'row',
    gap: 8,
  },
  periodTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  periodTabSelected: {
    backgroundColor: '#1A73E8',
  },
  periodTabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  periodTabTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  emptyNotice: {
    paddingHorizontal: Spacing.four,
    paddingVertical: 10,
  },
  emptyNoticeText: {
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'right',
  },
  subjectListHeader: {
    paddingHorizontal: Spacing.four,
    marginTop: Spacing.three,
    marginBottom: Spacing.two,
  },
  subjectListTitle: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'right',
  },
  subjectListSubtitle: {
    fontSize: 12,
    marginTop: 2,
    textAlign: 'right',
  },
  subjectsContainer: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
    gap: 8,
  },
  subjectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: 12,
    gap: 12,
  },
  subjectCardInactive: {
    opacity: 0.5,
  },
  subjectIndexBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E8F0FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  subjectIndexText: {
    color: '#1A73E8',
    fontWeight: '700',
    fontSize: 13,
  },
  subjectDetails: {
    flex: 1,
    alignItems: 'flex-start',
  },
  subjectName: {
    fontSize: 15,
    fontWeight: '700',
  },
  subjectSubText: {
    fontSize: 12,
    marginTop: 2,
  },
  subjectActionBadge: {},
  activeTag: {
    backgroundColor: '#E8F0FE',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  activeTagText: {
    color: '#1A73E8',
    fontWeight: '700',
    fontSize: 12,
  },
  inactiveTag: {
    backgroundColor: '#EEEEEE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  inactiveTagText: {
    color: '#9E9E9E',
    fontSize: 11,
  },
});

