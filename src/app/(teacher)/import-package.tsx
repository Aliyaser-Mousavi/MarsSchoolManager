/**
 * Mars School Manager - Offline Package Reconciliation & Import Screen (.msmp)
 * Allows administrators or colleagues to import signed teacher submission files,
 * preview side-by-side diffs, resolve conflicts, and commit atomically into the local SQLite database.
 */

import React, { useState } from 'react';
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
import * as DocumentPicker from 'expo-document-picker';
import { exchangeService, PackageImportPreview } from '@/services/exchangeService';
import { Colors, Spacing } from '@/constants/theme';
import { toPersianDigits } from '@/domain/schemas';

export default function ImportPackageScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const colors = Colors[isDark ? 'dark' : 'light'];

  const [isLoading, setIsLoading] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [preview, setPreview] = useState<PackageImportPreview | null>(null);
  const [conflictResolutions, setConflictResolutions] = useState<Record<string, 'OVERWRITE_INCOMING' | 'KEEP_LOCAL'>>({});

  // Pick .msmp file
  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const file = result.assets[0];
      setIsLoading(true);

      const previewData = await exchangeService.previewTeacherPackageImportAsync(file.uri);
      setPreview(previewData);

      // Default conflict resolutions to accept incoming
      const defaultResolutions: Record<string, 'OVERWRITE_INCOMING' | 'KEEP_LOCAL'> = {};
      for (const item of previewData.diffItems) {
        if (item.resolutionType === 'CONFLICT') {
          defaultResolutions[item.asasNumber] = 'OVERWRITE_INCOMING';
        }
      }
      setConflictResolutions(defaultResolutions);
    } catch (err) {
      console.error('Error previewing package:', err);
      Alert.alert('خطا در بررسی فایل', String(err));
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle conflict resolution choice for a student
  const toggleResolution = (asasNumber: string) => {
    setConflictResolutions((prev) => ({
      ...prev,
      [asasNumber]: prev[asasNumber] === 'KEEP_LOCAL' ? 'OVERWRITE_INCOMING' : 'KEEP_LOCAL',
    }));
  };

  // Commit package import to SQLite
  const handleCommitImport = async () => {
    if (!preview) return;

    try {
      setIsCommitting(true);
      const res = await exchangeService.commitPackageImportAsync({
        preview,
        adminUserId: 'LOCAL-ADMIN',
        conflictResolutions,
      });

      Alert.alert(
        'ثبت موفقیت‌آمیز',
        `تعداد ${toPersianDigits(res.appliedCount)} نمره از بسته ارسالی با موفقیت در پایگاه داده ذخیره و در تاریخچه ثبت شد.`,
        [
          {
            text: 'تأیید',
            onPress: () => {
              setPreview(null);
            },
          },
        ]
      );
    } catch (err) {
      console.error('Error committing package:', err);
      Alert.alert('خطا در اعمال بسته', String(err));
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* File Picker Header Card */}
      <View style={[styles.card, { backgroundColor: colors.backgroundElement }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>دریافت فایل نمرات آفلاین (.msmp)</Text>
        <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>
          فایل‌های خروجی گرفته شده توسط اساتید را از حافظه گوشی انتخاب نمایید تا پس از بررسی اختلافات، در سیستم ثبت گردند.
        </Text>

        <TouchableOpacity style={styles.pickBtn} onPress={handlePickFile} disabled={isLoading || isCommitting}>
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.pickBtnText}>📁 انتخاب فایل بسته نمرات (.msmp)</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Package Header Preview */}
      {preview && (
        <View style={styles.previewContainer}>
          <View style={[styles.packageDetailsCard, { backgroundColor: colors.backgroundElement }]}>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>استاد فرستنده:</Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>{preview.header.senderUserName}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>صنف و مضمون:</Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>
                {preview.header.sectionName} — {preview.header.subjectName}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>دوره امتحان:</Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>{preview.header.examPeriodName}</Text>
            </View>

            <View style={styles.badgeRow}>
              <View style={styles.tagNew}>
                <Text style={styles.tagNewText}>جدید: {toPersianDigits(preview.newRecordsCount)}</Text>
              </View>
              <View style={styles.tagIdentical}>
                <Text style={styles.tagIdenticalText}>یکسان: {toPersianDigits(preview.identicalRecordsCount)}</Text>
              </View>
              <View style={styles.tagConflict}>
                <Text style={styles.tagConflictText}>متعارض: {toPersianDigits(preview.conflictRecordsCount)}</Text>
              </View>
            </View>
          </View>

          {/* Diff Roster */}
          <FlatList
            data={preview.diffItems}
            keyExtractor={(item) => item.asasNumber}
            contentContainerStyle={styles.diffList}
            renderItem={({ item }) => {
              const resolution = conflictResolutions[item.asasNumber] ?? 'OVERWRITE_INCOMING';
              const isConflict = item.resolutionType === 'CONFLICT';

              return (
                <View style={[styles.diffCard, { backgroundColor: colors.backgroundElement }]}>
                  <View style={styles.diffHeader}>
                    <View style={styles.diffStudentInfo}>
                      <Text style={[styles.diffName, { color: colors.text }]}>{item.studentName}</Text>
                      <Text style={[styles.diffFather, { color: colors.textSecondary }]}>
                        ولد: {item.fatherName} | اساس: {toPersianDigits(item.asasNumber)}
                      </Text>
                    </View>

                    <View style={styles.diffStatusBadge}>
                      {item.resolutionType === 'NEW' ? (
                        <View style={styles.badgeNewItem}>
                          <Text style={styles.badgeNewItemText}>ثبت جدید</Text>
                        </View>
                      ) : item.resolutionType === 'IDENTICAL' ? (
                        <View style={styles.badgeIdenticalItem}>
                          <Text style={styles.badgeIdenticalItemText}>یکسان</Text>
                        </View>
                      ) : (
                        <View style={styles.badgeConflictItem}>
                          <Text style={styles.badgeConflictItemText}>اختلاف نمره</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Marks Comparison Row */}
                  <View style={styles.comparisonRow}>
                    <View style={styles.scoreCompareBox}>
                      <Text style={styles.scoreLabel}>نمره فعلی سیستم:</Text>
                      <Text style={styles.scoreVal}>
                        {item.localMark !== null ? toPersianDigits(item.localMark) : 'ثبت نشده'}
                      </Text>
                    </View>

                    <Text style={styles.compareArrow}>➔</Text>

                    <View style={styles.scoreCompareBox}>
                      <Text style={styles.scoreLabel}>نمره ارسالی استاد:</Text>
                      <Text style={[styles.scoreVal, { color: '#0F9D58' }]}>
                        {item.incomingStatus === 'ABSENT'
                          ? 'غائب'
                          : item.incomingMark !== null
                          ? toPersianDigits(item.incomingMark)
                          : '—'}
                      </Text>
                    </View>
                  </View>

                  {/* Conflict Decision Toggle */}
                  {isConflict && (
                    <TouchableOpacity
                      style={[
                        styles.toggleBtn,
                        resolution === 'OVERWRITE_INCOMING' ? styles.toggleAccept : styles.toggleKeep,
                      ]}
                      onPress={() => toggleResolution(item.asasNumber)}
                    >
                      <Text style={styles.toggleBtnText}>
                        {resolution === 'OVERWRITE_INCOMING'
                          ? '✓ استفاده از نمره جدید بسته (جایگزین شود)'
                          : '🔒 حفظ نمره فعلی سیستم (بسته نادیده گرفته شود)'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            }}
          />

          {/* Commit Button */}
          <View style={styles.commitFooter}>
            <TouchableOpacity
              style={[styles.commitBtn, isCommitting && { opacity: 0.5 }]}
              onPress={handleCommitImport}
              disabled={isCommitting}
            >
              {isCommitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.commitBtnText}>تأیید و اعمال نمرات در پایگاه داده</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.three,
  },
  card: {
    padding: Spacing.three,
    borderRadius: 12,
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'right',
  },
  cardDesc: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'right',
  },
  pickBtn: {
    backgroundColor: '#1A73E8',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  pickBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  previewContainer: {
    flex: 1,
    marginTop: Spacing.three,
  },
  packageDetailsCard: {
    padding: Spacing.three,
    borderRadius: 12,
    gap: 6,
    marginBottom: Spacing.two,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontSize: 13,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  tagNew: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tagNewText: {
    color: '#2E7D32',
    fontSize: 12,
    fontWeight: '700',
  },
  tagIdentical: {
    backgroundColor: '#EEEEEE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tagIdenticalText: {
    color: '#616161',
    fontSize: 12,
    fontWeight: '600',
  },
  tagConflict: {
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tagConflictText: {
    color: '#E65100',
    fontSize: 12,
    fontWeight: '700',
  },
  diffList: {
    gap: 8,
    paddingBottom: 70,
  },
  diffCard: {
    padding: Spacing.three,
    borderRadius: 10,
    gap: 8,
  },
  diffHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  diffStudentInfo: {
    flex: 1,
    alignItems: 'flex-start',
  },
  diffName: {
    fontSize: 14,
    fontWeight: '700',
  },
  diffFather: {
    fontSize: 11,
    marginTop: 2,
  },
  diffStatusBadge: {},
  badgeNewItem: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeNewItemText: {
    color: '#2E7D32',
    fontSize: 11,
    fontWeight: '700',
  },
  badgeIdenticalItem: {
    backgroundColor: '#EEEEEE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeIdenticalItemText: {
    color: '#757575',
    fontSize: 11,
  },
  badgeConflictItem: {
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeConflictItemText: {
    color: '#C62828',
    fontSize: 11,
    fontWeight: '700',
  },
  comparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#FAFAFA',
    paddingVertical: 8,
    borderRadius: 8,
  },
  scoreCompareBox: {
    alignItems: 'center',
  },
  scoreLabel: {
    fontSize: 11,
    color: '#757575',
  },
  scoreVal: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
  },
  compareArrow: {
    fontSize: 16,
    color: '#9E9E9E',
  },
  toggleBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  toggleAccept: {
    backgroundColor: '#E8F5E9',
  },
  toggleKeep: {
    backgroundColor: '#ECEFF1',
  },
  toggleBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#37474F',
  },
  commitFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
  },
  commitBtn: {
    backgroundColor: '#0F9D58',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  commitBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});

