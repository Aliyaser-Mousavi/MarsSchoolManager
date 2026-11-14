/**
 * Mars School Manager - Offline Multi-Device Exchange Service (.msmp)
 * Packs, cryptographically hashes, exports, and safely reconciles teacher mark submissions.
 */

import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { getDbAsync, withTransactionAsync } from '@/db/client';
import { marksService } from './marksService';
import { ExchangePackage, MarkStatus } from '@/types/database';

export const MSMP_PROTOCOL_VERSION = '1.0';

export interface TeacherPackageHeader {
  protocolVersion: string;
  packageType: 'TEACHER_SUBMISSION';
  packageId: string;
  createdAt: string;
  senderDeviceId: string;
  senderUserId: string;
  senderUserName: string;
  academicYearId: string;
  academicYearName: string;
  gradeId: string;
  gradeName: string;
  sectionId: string;
  sectionName: string;
  gradeSubjectId: string;
  subjectCode: string;
  subjectName: string;
  examPeriodId: string;
  examPeriodCode: string;
  examPeriodName: string;
  recordsCount: number;
}

export interface TeacherPackageStudentPayload {
  enrollmentId: string;
  asasNumber: string;
  studentName: string;
  fatherName: string;
  grandfatherName: string;
  rollNumber: number | null;
  markValue: number | null;
  status: MarkStatus;
  maxMark: number;
  passMark: number;
  lastModifiedTimestamp: string;
}

export interface TeacherPackageFile {
  header: TeacherPackageHeader;
  payload: TeacherPackageStudentPayload[];
  security: {
    contentHashSha256: string;
  };
}

export interface ConflictDiffItem {
  enrollmentId: string;
  studentName: string;
  fatherName: string;
  asasNumber: string;
  rollNumber: number | null;
  localMark: number | null;
  localStatus: MarkStatus;
  incomingMark: number | null;
  incomingStatus: MarkStatus;
  resolutionType: 'NEW' | 'IDENTICAL' | 'CONFLICT';
}

export interface PackageImportPreview {
  header: TeacherPackageHeader;
  totalRecords: number;
  newRecordsCount: number;
  identicalRecordsCount: number;
  conflictRecordsCount: number;
  diffItems: ConflictDiffItem[];
  isVerified: boolean;
}

export const exchangeService = {
  /**
   * Generates a signed, portable `.msmp` exchange package and triggers the native Android share sheet.
   */
  async generateTeacherPackageAsync(params: {
    teacherId: string;
    sectionId: string;
    gradeSubjectId: string;
    examPeriodId: string;
  }): Promise<{ filePath: string; packageId: string }> {
    const { teacherId, sectionId, gradeSubjectId, examPeriodId } = params;
    const db = await getDbAsync();

    // 1. Fetch metadata
    const user = await db.getFirstAsync<{ full_name: string }>('SELECT full_name FROM users WHERE id = ?;', [
      teacherId,
    ]);
    const teacherName = user?.full_name ?? 'استاد';

    const section = await db.getFirstAsync<{
      name: string;
      full_name: string;
      grade_id: string;
      grade_name: string;
    }>(
      `SELECT s.name, s.full_name, s.grade_id, g.name as grade_name
       FROM sections s
       JOIN grades g ON s.grade_id = g.id
       WHERE s.id = ?;`,
      [sectionId]
    );
    if (!section) throw new Error('صنف یافت نشد');

    const examPeriod = await db.getFirstAsync<{
      code: string;
      name: string;
      academic_year_id: string;
      year_name: string;
    }>(
      `SELECT ep.code, ep.name, ep.academic_year_id, ay.name as year_name
       FROM exam_periods ep
       JOIN academic_years ay ON ep.academic_year_id = ay.id
       WHERE ep.id = ?;`,
      [examPeriodId]
    );
    if (!examPeriod) throw new Error('دوره امتحانات یافت نشد');

    const subjectConfig = await db.getFirstAsync<{
      config_id: string;
      subject_code: string;
      subject_name: string;
      max_mark: number;
      pass_mark: number;
    }>(
      `SELECT esc.id as config_id, s.code as subject_code, s.name as subject_name, esc.max_mark, esc.pass_mark
       FROM exam_subject_configs esc
       JOIN grade_subjects gs ON esc.grade_subject_id = gs.id
       JOIN subjects s ON gs.subject_id = s.id
       WHERE esc.exam_period_id = ? AND gs.id = ?;`,
      [examPeriodId, gradeSubjectId]
    );
    if (!subjectConfig) throw new Error('تنظیمات مضمون امتحانی یافت نشد');

    // 2. Fetch enrolled students and their current marks
    const rows = await db.getAllAsync<{
      enrollment_id: string;
      asas_number: string;
      first_name: string;
      father_name: string;
      grandfather_name: string;
      roll_number: number | null;
      mark_value: number | null;
      status: MarkStatus | null;
      updated_at: string | null;
    }>(
      `SELECT 
        e.id as enrollment_id,
        s.asas_number,
        s.first_name,
        s.father_name,
        s.grandfather_name,
        e.roll_number,
        m.mark_value,
        m.status,
        m.updated_at
       FROM student_enrollments e
       JOIN students s ON e.student_id = s.id
       LEFT JOIN marks m ON m.enrollment_id = e.id AND m.exam_subject_config_id = ?
       WHERE e.section_id = ? AND e.academic_year_id = ?
       ORDER BY 
         CASE WHEN e.roll_number IS NULL THEN 1 ELSE 0 END,
         e.roll_number ASC,
         s.first_name ASC;`,
      [subjectConfig.config_id, sectionId, examPeriod.academic_year_id]
    );

    const payload: TeacherPackageStudentPayload[] = rows.map((r) => ({
      enrollmentId: r.enrollment_id,
      asasNumber: r.asas_number,
      studentName: r.first_name,
      fatherName: r.father_name,
      grandfatherName: r.grandfather_name,
      rollNumber: r.roll_number,
      markValue: r.mark_value,
      status: r.status ?? 'ENTERED',
      maxMark: subjectConfig.max_mark,
      passMark: subjectConfig.pass_mark,
      lastModifiedTimestamp: r.updated_at ?? new Date().toISOString(),
    }));

    const packageId = Crypto.randomUUID();
    const payloadJson = JSON.stringify(payload);
    const contentHashSha256 = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, payloadJson);

    const header: TeacherPackageHeader = {
      protocolVersion: MSMP_PROTOCOL_VERSION,
      packageType: 'TEACHER_SUBMISSION',
      packageId,
      createdAt: new Date().toISOString(),
      senderDeviceId: 'ANDROID-LOCAL',
      senderUserId: teacherId,
      senderUserName: teacherName,
      academicYearId: examPeriod.academic_year_id,
      academicYearName: examPeriod.year_name,
      gradeId: section.grade_id,
      gradeName: section.grade_name,
      sectionId,
      sectionName: section.full_name,
      gradeSubjectId,
      subjectCode: subjectConfig.subject_code,
      subjectName: subjectConfig.subject_name,
      examPeriodId,
      examPeriodCode: examPeriod.code,
      examPeriodName: examPeriod.name,
      recordsCount: payload.length,
    };

    const packageFileContent: TeacherPackageFile = {
      header,
      payload,
      security: {
        contentHashSha256,
      },
    };

    // 3. Write package to filesystem
    const fileName = `mars_package_${section.grade_name}_${section.name}_${subjectConfig.subject_name}_${Date.now()}.msmp`;
    const docDir = FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? '';
    const filePath = `${docDir}${fileName}`;

    await FileSystem.writeAsStringAsync(filePath, JSON.stringify(packageFileContent, null, 2), {
      encoding: FileSystem.EncodingType.UTF8,
    });

    // 4. Log in exchange_packages ledger
    await db.runAsync(
      `INSERT INTO exchange_packages (
        id, package_type, sender_device_id, sender_user_id, academic_year_id,
        section_id, subject_id, exam_period_id, records_count, checksum_sha256,
        payload_json, status
      ) VALUES (?, 'TEACHER_SUBMISSION', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING');`,
      [
        packageId,
        'ANDROID-LOCAL',
        teacherId,
        examPeriod.academic_year_id,
        sectionId,
        subjectConfig.config_id,
        examPeriodId,
        payload.length,
        contentHashSha256,
        payloadJson,
      ]
    );

    // 5. Open native Android share sheet if available
    const isSharingAvailable = await Sharing.isAvailableAsync();
    if (isSharingAvailable) {
      await Sharing.shareAsync(filePath, {
        mimeType: 'application/json',
        dialogTitle: `ارسال بسته نمرات ${subjectConfig.subject_name} (${section.full_name})`,
        UTI: 'public.json',
      });
    }

    return { filePath, packageId };
  },

  /**
   * Parses and validates a `.msmp` package file, returning a side-by-side conflict diff preview.
   */
  async previewTeacherPackageImportAsync(fileUri: string): Promise<PackageImportPreview> {
    const contentStr = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const parsed: TeacherPackageFile = JSON.parse(contentStr);
    if (!parsed.header || !parsed.payload || !parsed.security) {
      throw new Error('فرمت فایل بسته نمرات (.msmp) نامعتبر است');
    }

    // Verify SHA-256 integrity checksum
    const computedHash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      JSON.stringify(parsed.payload)
    );
    const isVerified = computedHash.toLowerCase() === parsed.security.contentHashSha256.toLowerCase();
    if (!isVerified) {
      throw new Error('هش امنیتی بسته نمرات مطابقت ندارد. فایل ممکن است آسیب دیده یا تغییر یافته باشد.');
    }

    const db = await getDbAsync();

    // Fetch existing local subject configuration
    const subjectConfig = await db.getFirstAsync<{ id: string }>(
      `SELECT esc.id 
       FROM exam_subject_configs esc
       WHERE esc.exam_period_id = ? AND esc.grade_subject_id = ?;`,
      [parsed.header.examPeriodId, parsed.header.gradeSubjectId]
    );
    if (!subjectConfig) {
      throw new Error(`مضمون ${parsed.header.subjectName} در پایگاه داده مرکزی برای این صنف و امتحان یافت نشد.`);
    }

    // Compare incoming marks with local marks
    const diffItems: ConflictDiffItem[] = [];
    let newCount = 0;
    let identicalCount = 0;
    let conflictCount = 0;

    for (const item of parsed.payload) {
      // Find local enrollment by Asas number and academic year
      const localEnrollment = await db.getFirstAsync<{
        enrollment_id: string;
        mark_value: number | null;
        status: MarkStatus | null;
      }>(
        `SELECT e.id as enrollment_id, m.mark_value, m.status
         FROM student_enrollments e
         JOIN students s ON e.student_id = s.id
         LEFT JOIN marks m ON m.enrollment_id = e.id AND m.exam_subject_config_id = ?
         WHERE s.asas_number = ? AND e.academic_year_id = ?;`,
        [subjectConfig.id, item.asasNumber, parsed.header.academicYearId]
      );

      const localMark = localEnrollment?.mark_value ?? null;
      const localStatus = localEnrollment?.status ?? 'ENTERED';

      let resolutionType: 'NEW' | 'IDENTICAL' | 'CONFLICT';

      if (localMark === null && localStatus === 'ENTERED') {
        resolutionType = 'NEW';
        newCount++;
      } else if (localMark === item.markValue && localStatus === item.status) {
        resolutionType = 'IDENTICAL';
        identicalCount++;
      } else {
        resolutionType = 'CONFLICT';
        conflictCount++;
      }

      diffItems.push({
        enrollmentId: localEnrollment?.enrollment_id ?? item.enrollmentId,
        studentName: item.studentName,
        fatherName: item.fatherName,
        asasNumber: item.asasNumber,
        rollNumber: item.rollNumber,
        localMark,
        localStatus,
        incomingMark: item.markValue,
        incomingStatus: item.status,
        resolutionType,
      });
    }

    return {
      header: parsed.header,
      totalRecords: parsed.payload.length,
      newRecordsCount: newCount,
      identicalRecordsCount: identicalCount,
      conflictRecordsCount: conflictCount,
      diffItems,
      isVerified,
    };
  },

  /**
   * Commits the reviewed package marks into the master database inside an atomic transaction.
   */
  async commitPackageImportAsync(params: {
    preview: PackageImportPreview;
    adminUserId: string;
    conflictResolutions?: Record<string, 'OVERWRITE_INCOMING' | 'KEEP_LOCAL'>;
  }): Promise<{ appliedCount: number }> {
    const { preview, adminUserId, conflictResolutions = {} } = params;
    const db = await getDbAsync();

    const subjectConfig = await db.getFirstAsync<{ id: string }>(
      `SELECT esc.id 
       FROM exam_subject_configs esc
       WHERE esc.exam_period_id = ? AND esc.grade_subject_id = ?;`,
      [preview.header.examPeriodId, preview.header.gradeSubjectId]
    );
    if (!subjectConfig) throw new Error('تنظیمات مضمون امتحانی یافت نشد');

    let applied = 0;

    await withTransactionAsync(async () => {
      for (const item of preview.diffItems) {
        let shouldApply = false;

        if (item.resolutionType === 'NEW') {
          shouldApply = true;
        } else if (item.resolutionType === 'IDENTICAL') {
          shouldApply = false;
        } else if (item.resolutionType === 'CONFLICT') {
          const choice = conflictResolutions[item.asasNumber] ?? 'OVERWRITE_INCOMING';
          shouldApply = choice === 'OVERWRITE_INCOMING';
        }

        if (shouldApply) {
          await marksService.saveMarkAsync(
            {
              enrollment_id: item.enrollmentId,
              exam_subject_config_id: subjectConfig.id,
              mark_value: item.incomingMark,
              status: item.incomingStatus,
              entered_by_user_id: adminUserId,
            },
            adminUserId,
            `وارد شده از بسته ارسالی استاد (${preview.header.senderUserName}) - شناسه: ${preview.header.packageId}`
          );
          applied++;
        }
      }

      // Record in exchange ledger
      const existingLedger = await db.getFirstAsync<ExchangePackage>(
        'SELECT * FROM exchange_packages WHERE id = ?;',
        [preview.header.packageId]
      );

      if (existingLedger) {
        await db.runAsync(
          `UPDATE exchange_packages SET
            status = 'ACCEPTED',
            imported_at = datetime('now'),
            imported_by_user_id = ?
           WHERE id = ?;`,
          [adminUserId, preview.header.packageId]
        );
      } else {
        await db.runAsync(
          `INSERT INTO exchange_packages (
            id, package_type, sender_device_id, sender_user_id, academic_year_id,
            section_id, subject_id, exam_period_id, records_count, checksum_sha256,
            payload_json, status, imported_at, imported_by_user_id
          ) VALUES (?, 'TEACHER_SUBMISSION', ?, ?, ?, ?, ?, ?, ?, ?, '', 'ACCEPTED', datetime('now'), ?);`,
          [
            preview.header.packageId,
            preview.header.senderDeviceId,
            preview.header.senderUserId,
            preview.header.academicYearId,
            preview.header.sectionId,
            subjectConfig.id,
            preview.header.examPeriodId,
            preview.totalRecords,
            'VERIFIED',
            adminUserId,
          ]
        );
      }
    });

    return { appliedCount: applied };
  },
};

