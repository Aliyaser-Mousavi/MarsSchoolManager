/**
 * Mars School Manager - Official Tabulation Sheet & Document Spooler
 * Displays live section results summary, student roster preview,
 * and handles official MoE printing, PDF sharing, and 6-sheet Excel export.
 */

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { configService } from '@/services/configService';
import { reportService, TabulationDataBundle } from '@/services/reportService';
import { excelExportService } from '@/services/excelExportService';
import { AcademicYear, Grade, Section } from '@/types/database';
import { Colors } from '@/constants/theme';
import { toPersianDigits } from '@/domain/schemas';

export default function TabulationSheetScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const colors = Colors[isDark ? 'dark' : 'light'];

  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processMessage, setProcessMessage] = useState('');

  const [activeYear, setActiveYear] = useState<AcademicYear | null>(null);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [selectedGradeId, setSelectedGradeId] = useState<string | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);

  const [bundle, setBundle] = useState<TabulationDataBundle | null>(null);
  const [activeTab, setActiveTab] = useState<'SUMMARY' | 'ROSTER'>('SUMMARY');

  // Load initial metadata
  useEffect(() => {
    let isMounted = true;
    async function init() {
      try {
        setIsLoading(true);
        const year = await configService.getActiveAcademicYearAsync();
        const allGrades = await configService.getAllGradesAsync();

        if (!isMounted) return;
        setActiveYear(year);
        setGrades(allGrades);

        // Default to Grade 8 (code level 8) or first
        const defaultGrade = allGrades.find((g) => g.code_level === 8) ?? allGrades[0];
        if (defaultGrade) {
          setSelectedGradeId(defaultGrade.id);
          const gradeSections = await configService.getSectionsByGradeAsync(defaultGrade.id);
          if (!isMounted) return;
          setSections(gradeSections);
          if (gradeSections.length > 0) {
            setSelectedSectionId(gradeSections[0].id);
          }
        }
      } catch (err) {
        console.error('Error loading tabulation metadata:', err);
        Alert.alert('خطا', 'عدم توانایی در بارگذاری اطلاعات اولیه صنف');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    init();
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch bundle whenever selected section changes
  useEffect(() => {
    let isCancelled = false;
    async function fetchData() {
      if (!selectedSectionId || !activeYear) return;
      try {
        const data = await reportService.buildSectionTabulationDataAsync(selectedSectionId, activeYear.id);
        if (!isCancelled) {
          setBundle(data);
        }
      } catch (err) {
        if (!isCancelled) {
          console.error('Error loading tabulation bundle:', err);
          Alert.alert('خطا', 'عدم توانایی در محاسبه نتایج جدول');
        }
      }
    }

    void fetchData();
    return () => {
      isCancelled = true;
    };
  }, [selectedSectionId, activeYear]);

  // Handle grade selection
  const handleSelectGrade = async (gradeId: string) => {
    setSelectedGradeId(gradeId);
    try {
      const gradeSections = await configService.getSectionsByGradeAsync(gradeId);
      setSections(gradeSections);
      if (gradeSections.length > 0) {
        setSelectedSectionId(gradeSections[0].id);
      } else {
        setSelectedSectionId(null);
        setBundle(null);
      }
    } catch (err) {
      console.error('Error changing grade:', err);
    }
  };

  // 1. Direct Print Tabulation Sheet (Landscape A4)
  const handlePrintTabulation = async () => {
    if (!selectedSectionId || !activeYear) return;
    try {
      setIsProcessing(true);
      setProcessMessage('در حال آماده‌سازی جدول نتایج برای چاپ A4 افقی...');
      await reportService.printTabulationSheetAsync(selectedSectionId, activeYear.id);
    } catch (err) {
      console.error('Print Tabulation Error:', err);
      Alert.alert('خطا در چاپ', 'مشکلی در ارسال سند به سرویس چاپ رخ داد');
    } finally {
      setIsProcessing(false);
    }
  };

  // 2. Share PDF Tabulation Sheet
  const handleShareTabulationPdf = async () => {
    if (!selectedSectionId || !activeYear) return;
    try {
      setIsProcessing(true);
      setProcessMessage('در حال ایجاد فایل PDF جدول نتایج...');
      await reportService.shareTabulationPdfAsync(selectedSectionId, activeYear.id);
    } catch (err) {
      console.error('PDF Tabulation Error:', err);
      Alert.alert('خطا در تولید PDF', 'مشکلی در صدور فایل PDF رخ داد');
    } finally {
      setIsProcessing(false);
    }
  };

  // 3. Print Report Cards Batch
  const handlePrintReportCards = async () => {
    if (!selectedSectionId || !activeYear) return;
    try {
      setIsProcessing(true);
      setProcessMessage('در حال آماده‌سازی اطلاعنامه‌های دسته‌جمعی صنف برای چاپ...');
      await reportService.printReportCardsAsync(selectedSectionId, activeYear.id);
    } catch (err) {
      console.error('Print Report Cards Error:', err);
      Alert.alert('خطا در چاپ اطلاعنامه', 'مشکلی در سرویس چاپ رخ داد');
    } finally {
      setIsProcessing(false);
    }
  };

  // 4. Share Report Cards PDF Batch
  const handleShareReportCardsPdf = async () => {
    if (!selectedSectionId || !activeYear) return;
    try {
      setIsProcessing(true);
      setProcessMessage('در حال ایجاد PDF دسته‌جمعی اطلاعنامه‌ها...');
      await reportService.shareReportCardsPdfAsync(selectedSectionId, activeYear.id);
    } catch (err) {
      console.error('PDF Report Cards Error:', err);
      Alert.alert('خطا در صدور PDF', 'مشکلی در تولید فایل اطلاعنامه رخ داد');
    } finally {
      setIsProcessing(false);
    }
  };

  // 5. Export 6-Sheet Official Excel
  const handleExportExcel = async () => {
    if (!selectedSectionId || !activeYear) return;
    try {
      setIsProcessing(true);
      setProcessMessage('در حال تولید فایل اکسل ۶ شیته وزارت معارف (.xlsx)...');
      await excelExportService.exportOfficial6SheetWorkbookAsync(selectedSectionId, activeYear.id);
    } catch (err) {
      console.error('Excel Export Error:', err);
      Alert.alert('خطا در صدور اکسل', 'مشکلی در ساخت فایل اکسل ایجاد شد');
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading && !bundle) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color="#208AEF" />
        <Text style={[styles.loadingText, { color: colors.text }]}>در حال آماده‌سازی جدول نتایج...</Text>
      </View>
    );
  }

  const counters = bundle?.summaryCounters;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom', 'left', 'right']}>
      {/* Overlay during file generation */}
      {isProcessing && (
        <View style={styles.processingOverlay}>
          <View style={[styles.processingModal, { backgroundColor: colors.backgroundElement }]}>
            <ActivityIndicator size="large" color="#208AEF" />
            <Text style={[styles.processingText, { color: colors.text }]}>{processMessage}</Text>
          </View>
        </View>
      )}

      {/* Grade Selector Chips */}
      <View style={styles.filterBar}>
        <Text style={[styles.filterTitle, { color: colors.textSecondary }]}>صنف:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
          {grades.map((grade) => {
            const isSelected = grade.id === selectedGradeId;
            return (
              <TouchableOpacity
                key={grade.id}
                style={[styles.chip, isSelected ? styles.chipSelected : { backgroundColor: colors.backgroundElement }]}
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

      {/* Section Selector Chips */}
      {sections.length > 0 ? (
        <View style={styles.filterBar}>
          <Text style={[styles.filterTitle, { color: colors.textSecondary }]}>شعبه:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
            {sections.map((section) => {
              const isSelected = section.id === selectedSectionId;
              return (
                <TouchableOpacity
                  key={section.id}
                  style={[styles.chip, isSelected ? styles.chipSelected : { backgroundColor: colors.backgroundElement }]}
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
            شعبه‌ای برای این صنف تعریف نشده است.
          </Text>
        </View>
      )}

      {/* Tab Selector (Summary vs Roster) */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'SUMMARY' && styles.tabButtonActive]}
          onPress={() => setActiveTab('SUMMARY')}
        >
          <Text style={[styles.tabText, activeTab === 'SUMMARY' && styles.tabTextActive]}>
            خلص نتایج (خلاصه احصائیوی)
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'ROSTER' && styles.tabButtonActive]}
          onPress={() => setActiveTab('ROSTER')}
        >
          <Text style={[styles.tabText, activeTab === 'ROSTER' && styles.tabTextActive]}>
            لیست شاگردان ({toPersianDigits(bundle?.studentsData.length ?? 0)})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Main Content View */}
      {activeTab === 'SUMMARY' ? (
        <ScrollView style={styles.mainScroll} contentContainerStyle={styles.mainScrollContent}>
          {/* Header Info Banner */}
          <View style={[styles.infoBanner, { backgroundColor: colors.backgroundElement }]}>
            <View style={styles.bannerRow}>
              <Text style={[styles.bannerSchool, { color: colors.text }]}>
                {bundle?.schoolProfile.school_name}
              </Text>
              <Text style={[styles.bannerYear, { color: colors.textSecondary }]}>
                سال تعلیمی: {toPersianDigits(bundle?.academicYear.shamsi_year ?? 1404)} هـ ش
              </Text>
            </View>
            <Text style={[styles.bannerSection, { color: '#208AEF' }]}>
              {bundle?.section.full_name || bundle?.section.name}
            </Text>
          </View>

          {/* Official 8-Row MoE Summary Table */}
          <View style={[styles.summaryTableCard, { backgroundColor: colors.backgroundElement }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              جدول احصائیوی خلص نتایج (مقررات رسمی وزارت معارف)
            </Text>

            <View style={styles.tableHeaderRow}>
              <Text style={[styles.colHeader, styles.colIndicator]}>شاخص احصائیوی</Text>
              <Text style={[styles.colHeader, styles.colPeriod]}>وسط سال</Text>
              <Text style={[styles.colHeader, styles.colPeriod]}>سالانه</Text>
            </View>

            <View style={styles.tableRow}>
              <Text style={styles.cellIndicator}>تعداد شاملین صنف</Text>
              <Text style={styles.cellValue}>{toPersianDigits(counters?.enrolled ?? 0)}</Text>
              <Text style={styles.cellValue}>{toPersianDigits(counters?.enrolled ?? 0)}</Text>
            </View>

            <View style={[styles.tableRow, styles.tableRowAlt]}>
              <Text style={styles.cellIndicator}>شامل امتحان</Text>
              <Text style={styles.cellValue}>{toPersianDigits(counters?.midtermSat ?? 0)}</Text>
              <Text style={styles.cellValue}>{toPersianDigits(counters?.annualSat ?? 0)}</Text>
            </View>

            <View style={styles.tableRow}>
              <Text style={[styles.cellIndicator, { color: '#0F9D58', fontWeight: '700' }]}>
                کامیاب / ارتقای صنف
              </Text>
              <Text style={[styles.cellValue, { color: '#0F9D58', fontWeight: '700' }]}>
                {toPersianDigits(counters?.midtermPassed ?? 0)}
              </Text>
              <Text style={[styles.cellValue, { color: '#0F9D58', fontWeight: '700' }]}>
                {toPersianDigits(counters?.annualPassed ?? 0)}
              </Text>
            </View>

            <View style={[styles.tableRow, styles.tableRowAlt]}>
              <Text style={[styles.cellIndicator, { color: '#E65100', fontWeight: '700' }]}>
                مشروط (چانس دوم)
              </Text>
              <Text style={[styles.cellValue, { color: '#E65100', fontWeight: '700' }]}>
                {toPersianDigits(counters?.midtermConditional ?? 0)}
              </Text>
              <Text style={[styles.cellValue, { color: '#E65100', fontWeight: '700' }]}>
                {toPersianDigits(counters?.annualConditional ?? 0)}
              </Text>
            </View>

            <View style={styles.tableRow}>
              <Text style={[styles.cellIndicator, { color: '#D93025', fontWeight: '700' }]}>
                ناکام / تکرار صنف
              </Text>
              <Text style={[styles.cellValue, { color: '#D93025', fontWeight: '700' }]}>
                {toPersianDigits(counters?.midtermFailed ?? 0)}
              </Text>
              <Text style={[styles.cellValue, { color: '#D93025', fontWeight: '700' }]}>
                {toPersianDigits(counters?.annualFailed ?? 0)}
              </Text>
            </View>

            <View style={[styles.tableRow, styles.tableRowAlt]}>
              <Text style={styles.cellIndicator}>معذرتی</Text>
              <Text style={styles.cellValue}>{toPersianDigits(counters?.midtermExcused ?? 0)}</Text>
              <Text style={styles.cellValue}>{toPersianDigits(counters?.annualExcused ?? 0)}</Text>
            </View>

            <View style={styles.tableRow}>
              <Text style={[styles.cellIndicator, { color: '#B71C1C' }]}>محروم (غیرحاضری)</Text>
              <Text style={[styles.cellValue, { color: '#B71C1C' }]}>
                {toPersianDigits(counters?.midtermBarred ?? 0)}
              </Text>
              <Text style={[styles.cellValue, { color: '#B71C1C' }]}>
                {toPersianDigits(counters?.annualBarred ?? 0)}
              </Text>
            </View>

            <View style={[styles.tableRow, styles.tableRowAlt]}>
              <Text style={styles.cellIndicator}>نقل مکان</Text>
              <Text style={styles.cellValue}>{toPersianDigits(counters?.midtermTransferred ?? 0)}</Text>
              <Text style={styles.cellValue}>{toPersianDigits(counters?.annualTransferred ?? 0)}</Text>
            </View>
          </View>
        </ScrollView>
      ) : (
        /* Roster Tab */
        <FlatList
          data={bundle?.studentsData ?? []}
          keyExtractor={(item) => item.enrollmentId}
          contentContainerStyle={styles.rosterList}
          renderItem={({ item, index }) => (
            <View style={[styles.rosterCard, { backgroundColor: colors.backgroundElement }]}>
              <View style={styles.rosterHeader}>
                <View style={styles.rosterIndexBadge}>
                  <Text style={styles.rosterIndexText}>{toPersianDigits(index + 1)}</Text>
                </View>
                <View style={styles.rosterDetails}>
                  <Text style={[styles.rosterName, { color: colors.text }]}>{item.firstName}</Text>
                  <Text style={[styles.rosterLineage, { color: colors.textSecondary }]}>
                    ولد: {item.fatherName} | ولدیت: {item.grandfatherName}
                  </Text>
                </View>
                <View style={styles.rosterAsas}>
                  <Text style={styles.rosterAsasLabel}>نمبر اساس</Text>
                  <Text style={styles.rosterAsasValue}>{toPersianDigits(item.asasNumber)}</Text>
                </View>
              </View>

              <View style={styles.rosterMarksRow}>
                <View style={styles.rosterMarkBadge}>
                  <Text style={styles.rosterMarkTitle}>وسط سال:</Text>
                  <Text style={styles.rosterMarkScore}>
                    {item.midtermEvaluation.totalScore !== null
                      ? toPersianDigits(item.midtermEvaluation.totalScore.toFixed(1))
                      : '—'}
                  </Text>
                  <Text
                    style={[
                      styles.rosterStatusText,
                      item.midtermEvaluation.resultStatus === 'موفق' ? styles.statusSuccess : styles.statusWarning,
                    ]}
                  >
                    {item.midtermEvaluation.resultStatus}
                  </Text>
                </View>

                <View style={styles.rosterMarkBadge}>
                  <Text style={styles.rosterMarkTitle}>سالانه و نهایی:</Text>
                  <Text style={styles.rosterMarkScore}>
                    {item.finalEvaluation.totalScore !== null
                      ? toPersianDigits(item.finalEvaluation.totalScore.toFixed(1))
                      : '—'}
                  </Text>
                  <Text
                    style={[
                      styles.rosterStatusText,
                      item.finalEvaluation.resultStatus === 'ارتقای صنف'
                        ? styles.statusSuccess
                        : item.finalEvaluation.resultStatus === 'مشروط'
                        ? styles.statusWarning
                        : styles.statusDanger,
                    ]}
                  >
                    {item.finalEvaluation.resultStatus}
                  </Text>
                </View>
              </View>
            </View>
          )}
        />
      )}

      {/* Action Buttons Footer Panel */}
      <View style={[styles.actionsFooter, { backgroundColor: colors.backgroundElement }]}>
        <View style={styles.buttonGrid}>
          {/* Print Tabulation Button */}
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#1A73E8' }]}
            activeOpacity={0.8}
            onPress={handlePrintTabulation}
          >
            <Text style={styles.actionBtnText}>🖨️ چاپ جدول نتایج (A4 افقی)</Text>
          </TouchableOpacity>

          {/* Share Tabulation PDF Button */}
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#0F9D58' }]}
            activeOpacity={0.8}
            onPress={handleShareTabulationPdf}
          >
            <Text style={styles.actionBtnText}>📄 اشتراک‌گذاری PDF جدول</Text>
          </TouchableOpacity>

          {/* Print Report Cards Button */}
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#6200EE' }]}
            activeOpacity={0.8}
            onPress={handlePrintReportCards}
          >
            <Text style={styles.actionBtnText}>📇 چاپ اطلاعنامه‌ها (دسته‌جمعی)</Text>
          </TouchableOpacity>

          {/* Share Report Cards PDF Button */}
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#8E24AA' }]}
            activeOpacity={0.8}
            onPress={handleShareReportCardsPdf}
          >
            <Text style={styles.actionBtnText}>📤 PDF اطلاعنامه‌ها</Text>
          </TouchableOpacity>

          {/* 6-Sheet Official Excel Export Button */}
          <TouchableOpacity
            style={[styles.actionBtnFull, { backgroundColor: '#0B8043' }]}
            activeOpacity={0.8}
            onPress={handleExportExcel}
          >
            <Text style={styles.actionBtnText}>📊 صدور اکسل رسمی ۶ شیته (.xlsx)</Text>
          </TouchableOpacity>
        </View>
      </View>
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
    padding: 24,
  },
  loadingText: {
    fontSize: 15,
    marginTop: 16,
    fontFamily: 'System',
    textAlign: 'center',
  },
  processingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.6)',
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingModal: {
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    maxWidth: '85%',
  },
  processingText: {
    marginTop: 16,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  filterBar: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginRight: 8,
  },
  chipsScroll: {
    paddingVertical: 4,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipSelected: {
    backgroundColor: '#208AEF',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  emptyNotice: {
    padding: 16,
    alignItems: 'center',
  },
  emptyNoticeText: {
    fontSize: 13,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150,150,150,0.2)',
    marginTop: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: '#208AEF',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#757575',
  },
  tabTextActive: {
    color: '#208AEF',
    fontWeight: '700',
  },
  mainScroll: {
    flex: 1,
  },
  mainScrollContent: {
    padding: 16,
    gap: 16,
  },
  infoBanner: {
    padding: 16,
    borderRadius: 12,
  },
  bannerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  bannerSchool: {
    fontSize: 15,
    fontWeight: '700',
  },
  bannerYear: {
    fontSize: 12,
  },
  bannerSection: {
    fontSize: 14,
    fontWeight: '600',
  },
  summaryTableCard: {
    borderRadius: 12,
    padding: 16,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 6,
    marginBottom: 4,
  },
  colHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  colIndicator: {
    flex: 2,
    textAlign: 'right',
    paddingRight: 6,
  },
  colPeriod: {
    flex: 1,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150,150,150,0.1)',
  },
  tableRowAlt: {
    backgroundColor: 'rgba(150,150,150,0.05)',
  },
  cellIndicator: {
    flex: 2,
    fontSize: 13,
    paddingRight: 6,
    textAlign: 'right',
  },
  cellValue: {
    flex: 1,
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '600',
  },
  rosterList: {
    padding: 16,
    gap: 8,
  },
  rosterCard: {
    borderRadius: 12,
    padding: 16,
  },
  rosterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  rosterIndexBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#208AEF',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  rosterIndexText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  rosterDetails: {
    flex: 1,
  },
  rosterName: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'right',
  },
  rosterLineage: {
    fontSize: 12,
    marginTop: 2,
    textAlign: 'right',
  },
  rosterAsas: {
    alignItems: 'flex-start',
  },
  rosterAsasLabel: {
    fontSize: 10,
    color: '#757575',
  },
  rosterAsasValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  rosterMarksRow: {
    flexDirection: 'row',
    gap: 16,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(150,150,150,0.15)',
  },
  rosterMarkBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rosterMarkTitle: {
    fontSize: 11,
    color: '#757575',
  },
  rosterMarkScore: {
    fontSize: 13,
    fontWeight: '700',
  },
  rosterStatusText: {
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusSuccess: {
    backgroundColor: '#E8F5E9',
    color: '#1B5E20',
  },
  statusWarning: {
    backgroundColor: '#FFF3E0',
    color: '#E65100',
  },
  statusDanger: {
    backgroundColor: '#FFEBEE',
    color: '#B71C1C',
  },
  actionsFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(150,150,150,0.15)',
  },
  buttonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionBtn: {
    flexBasis: '48%',
    flexGrow: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnFull: {
    width: '100%',
    paddingVertical: 13,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
});
