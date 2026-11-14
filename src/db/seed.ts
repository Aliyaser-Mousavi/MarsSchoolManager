/**
 * Mars School Manager - Idempotent Initial Database Seeder
 * Populates institutional defaults, 12 grades, 15 canonical subjects,
 * active academic year (1404), default grading rules, and exam periods.
 */

import {
  CANONICAL_GRADES,
  CANONICAL_SUBJECTS,
  DEFAULT_GRADING_RULES,
  INSTITUTIONAL_DEFAULTS,
  OFFICIAL_SIGNATURE_TITLES,
} from "@/constants/canonical-defaults";
import * as Crypto from "expo-crypto";
import { SQLiteDatabase } from "expo-sqlite";

export interface SeedResult {
  seeded: boolean;
  schoolName: string;
  activeYear: string;
  gradesCount: number;
  subjectsCount: number;
  rulesConfigured: boolean;
}

export async function seedInitialDataIfNeeded(
  db: SQLiteDatabase,
): Promise<SeedResult> {
  let seeded = false;

  await db.withTransactionAsync(async () => {
    // 1. School Profile
    const profileCountRow = await db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) as count FROM school_profile;",
    );
    let profileId: string;
    if ((profileCountRow?.count ?? 0) === 0) {
      profileId = Crypto.randomUUID();
      await db.runAsync(
        `INSERT INTO school_profile (
          id, school_name, province, district, village_area, established_year,
          principal_name, ministry_registration_code, logo_uri, report_card_motto,
          sig_class_supervisor_title, sig_headmaster_title, sig_principal_title,
          sig_academic_member_title, sig_district_director_title, sig_supervision_officer_title,
          sig_parent_title
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          profileId,
          INSTITUTIONAL_DEFAULTS.SCHOOL_NAME,
          INSTITUTIONAL_DEFAULTS.PROVINCE,
          INSTITUTIONAL_DEFAULTS.DISTRICT,
          null,
          1350,
          null,
          null,
          null,
          INSTITUTIONAL_DEFAULTS.REPORT_CARD_MOTTO,
          OFFICIAL_SIGNATURE_TITLES.CLASS_SUPERVISOR,
          OFFICIAL_SIGNATURE_TITLES.HEADMASTER,
          OFFICIAL_SIGNATURE_TITLES.PRINCIPAL,
          OFFICIAL_SIGNATURE_TITLES.ACADEMIC_MEMBER,
          OFFICIAL_SIGNATURE_TITLES.DISTRICT_DIRECTOR,
          OFFICIAL_SIGNATURE_TITLES.SUPERVISION_OFFICER,
          OFFICIAL_SIGNATURE_TITLES.PARENT,
        ],
      );
      seeded = true;
    }

    // 2. Active Academic Year (1404 Shamsi / 1447 Qamari)
    const yearCountRow = await db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) as count FROM academic_years;",
    );
    let activeYearId: string;
    if ((yearCountRow?.count ?? 0) === 0) {
      activeYearId = Crypto.randomUUID();
      await db.runAsync(
        `INSERT INTO academic_years (
          id, shamsi_year, qamari_year, name, start_date, end_date, is_active, is_locked
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          activeYearId,
          INSTITUTIONAL_DEFAULTS.ACTIVE_SHAMSI_YEAR,
          INSTITUTIONAL_DEFAULTS.ACTIVE_QAMARI_YEAR,
          INSTITUTIONAL_DEFAULTS.ACTIVE_YEAR_NAME,
          "1404-01-01",
          "1404-12-29",
          1,
          0,
        ],
      );
      seeded = true;
    } else {
      const activeYear = await db.getFirstAsync<{ id: string }>(
        "SELECT id FROM academic_years WHERE is_active = 1 LIMIT 1;",
      );
      activeYearId = activeYear?.id ?? Crypto.randomUUID();
    }

    // 3. Grades (1 to 12)
    const gradesCountRow = await db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) as count FROM grades;",
    );
    if ((gradesCountRow?.count ?? 0) === 0) {
      for (const grade of CANONICAL_GRADES) {
        await db.runAsync(
          `INSERT INTO grades (id, code_level, name, cycle, sort_order) VALUES (?, ?, ?, ?, ?);`,
          [
            Crypto.randomUUID(),
            grade.codeLevel,
            grade.name,
            grade.cycle,
            grade.sortOrder,
          ],
        );
      }
      seeded = true;
    }

    // 4. Subjects (15 Canonical MoE Subjects)
    const subjectsCountRow = await db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) as count FROM subjects;",
    );
    if ((subjectsCountRow?.count ?? 0) === 0) {
      for (const subject of CANONICAL_SUBJECTS) {
        await db.runAsync(
          `INSERT INTO subjects (id, code, name, default_sort_order) VALUES (?, ?, ?, ?);`,
          [
            Crypto.randomUUID(),
            subject.code,
            subject.name,
            subject.defaultSortOrder,
          ],
        );
      }
      seeded = true;
    }

    // 5. Default Grading Rules for Active Year
    const gradingRulesCountRow = await db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) as count FROM grading_rules WHERE academic_year_id = ?;",
      [activeYearId],
    );
    if ((gradingRulesCountRow?.count ?? 0) === 0) {
      await db.runAsync(
        `INSERT INTO grading_rules (
          id, academic_year_id, grade_id,
          midterm_max_mark, midterm_pass_mark,
          annual_max_mark, annual_pass_mark,
          combined_max_mark, combined_pass_mark,
          mashroot_min_failed_subjects, mashroot_max_failed_subjects, nakam_min_failed_subjects,
          midterm_grade_alef_min, midterm_grade_be_min, midterm_grade_jim_min, midterm_grade_dal_min,
          final_grade_alef_min, final_grade_be_min, final_grade_jim_min, final_grade_dal_min,
          force_grade_he_on_any_failed_subject,
          mahroom_max_absent_days, mahroom_max_absent_percentage
        ) VALUES (
          ?, ?, ?,
          ?, ?,
          ?, ?,
          ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?,
          ?, ?
        );`,
        [
          Crypto.randomUUID(),
          activeYearId,
          null, // School-wide baseline rule
          DEFAULT_GRADING_RULES.MIDTERM_MAX_MARK,
          DEFAULT_GRADING_RULES.MIDTERM_PASS_MARK,
          DEFAULT_GRADING_RULES.ANNUAL_MAX_MARK,
          DEFAULT_GRADING_RULES.ANNUAL_PASS_MARK,
          DEFAULT_GRADING_RULES.COMBINED_MAX_MARK,
          DEFAULT_GRADING_RULES.COMBINED_PASS_MARK,
          DEFAULT_GRADING_RULES.MASHROOT_MIN_FAILED_SUBJECTS,
          DEFAULT_GRADING_RULES.MASHROOT_MAX_FAILED_SUBJECTS,
          DEFAULT_GRADING_RULES.NAKAM_MIN_FAILED_SUBJECTS,
          DEFAULT_GRADING_RULES.MIDTERM_ALEF_MIN,
          DEFAULT_GRADING_RULES.MIDTERM_BE_MIN,
          DEFAULT_GRADING_RULES.MIDTERM_JIM_MIN,
          DEFAULT_GRADING_RULES.MIDTERM_DAL_MIN,
          DEFAULT_GRADING_RULES.FINAL_ALEF_MIN,
          DEFAULT_GRADING_RULES.FINAL_BE_MIN,
          DEFAULT_GRADING_RULES.FINAL_JIM_MIN,
          DEFAULT_GRADING_RULES.FINAL_DAL_MIN,
          DEFAULT_GRADING_RULES.FORCE_HE_ON_FAILED,
          30, // Default max unexcused days before Mahroom
          25.0, // Default max 25% absenteeism before Mahroom
        ],
      );
      seeded = true;
    }

    // 6. Default Exam Periods for Active Year
    const examPeriodsCountRow = await db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) as count FROM exam_periods WHERE academic_year_id = ?;",
      [activeYearId],
    );
    if ((examPeriodsCountRow?.count ?? 0) === 0) {
      await db.runAsync(
        `INSERT INTO exam_periods (id, academic_year_id, code, name, max_mark_default, pass_mark_default, is_closed)
         VALUES (?, ?, 'MID_TERM', 'امتحانات چهارونیم ماهه (وسط سال)', 40.0, 16.0, 0);`,
        [Crypto.randomUUID(), activeYearId],
      );
      await db.runAsync(
        `INSERT INTO exam_periods (id, academic_year_id, code, name, max_mark_default, pass_mark_default, is_closed)
         VALUES (?, ?, 'ANNUAL', 'امتحانات سالانه', 60.0, 24.0, 0);`,
        [Crypto.randomUUID(), activeYearId],
      );
      await db.runAsync(
        `INSERT INTO exam_periods (id, academic_year_id, code, name, max_mark_default, pass_mark_default, is_closed)
         VALUES (?, ?, 'RETAKE', 'امتحانات چانس دوم (مشروطی)', 60.0, 24.0, 0);`,
        [Crypto.randomUUID(), activeYearId],
      );
      seeded = true;
    }

    // 7. Table Templates (Mandatory Correction 4)
    const templatesCountRow = await db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) as count FROM table_templates;",
    );
    if ((templatesCountRow?.count ?? 0) === 0) {
      await db.runAsync(
        `INSERT INTO table_templates (
          id, name, sheet_code, columns_json, header_rows_count, rows_per_student, repeating_signature_rows_interval, footer_text, is_default
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          Crypto.randomUUID(),
          "جدول نتایج رسمی وزارت معارف",
          "TABULATION",
          JSON.stringify({
            subjectsCount: 15,
            includesSignatures: true,
            orientation: "landscape",
          }),
          9,
          4, // 4 rows per student (Mid-Year, Annual, Final Total, Remarks)
          5, // Endorsement signature after every 5 students
          "تأیید و مهر آمر لیسه | تأییدی عضونظارت مربوطه | تأییدی آمریت حوزه تعلیمی/ولسوالی",
          1,
        ],
      );

      await db.runAsync(
        `INSERT INTO table_templates (
          id, name, sheet_code, columns_json, header_rows_count, rows_per_student, repeating_signature_rows_interval, footer_text, is_default
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          Crypto.randomUUID(),
          "اطلاعنامه شاگرد",
          "REPORT_CARD",
          JSON.stringify({
            cardColumns: 31,
            includeMotto: true,
            signaturesCount: 4,
          }),
          6,
          1,
          null,
          "امضاء نگران | امضاء سرمعلم | امضاء آمرمکتب | امضاء ولی شاگرد",
          1,
        ],
      );
      seeded = true;
    }

    // 8. Default System Administrator User
    const usersCountRow = await db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) as count FROM users;",
    );
    let adminUserId: string;
    if ((usersCountRow?.count ?? 0) === 0) {
      adminUserId = Crypto.randomUUID();
      await db.runAsync(
        `INSERT INTO users (id, full_name, father_name, phone_number, role, pin_hash, is_active)
         VALUES (?, 'مدیر سیستم', null, null, 'ADMIN', null, 1);`,
        [adminUserId],
      );
      seeded = true;
    } else {
      const u = await db.getFirstAsync<{ id: string }>("SELECT id FROM users LIMIT 1;");
      adminUserId = u?.id ?? Crypto.randomUUID();
    }

    // 9. Canonical Grade Subjects (Curriculum Bindings)
    const gradeSubjectsCountRow = await db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) as count FROM grade_subjects WHERE academic_year_id = ?;",
      [activeYearId],
    );
    if ((gradeSubjectsCountRow?.count ?? 0) === 0) {
      const allGrades = await db.getAllAsync<{ id: string; code_level: number }>(
        "SELECT id, code_level FROM grades ORDER BY code_level ASC;",
      );
      const allSubjects = await db.getAllAsync<{ id: string; code: string; default_sort_order: number }>(
        "SELECT id, code, default_sort_order FROM subjects ORDER BY default_sort_order ASC;",
      );

      for (const grade of allGrades) {
        for (const sub of allSubjects) {
          // Geography is inactive in Grade 8 template as audited in Phase 00
          const isActive = grade.code_level === 8 && sub.code === "GEOGRAPHY" ? 0 : 1;
          await db.runAsync(
            `INSERT INTO grade_subjects (
              id, grade_id, subject_id, academic_year_id,
              is_active_in_grade, display_in_template, template_column_index, sort_order
            ) VALUES (?, ?, ?, ?, ?, 1, ?, ?);`,
            [
              Crypto.randomUUID(),
              grade.id,
              sub.id,
              activeYearId,
              isActive,
              sub.default_sort_order,
              sub.default_sort_order,
            ],
          );
        }
      }
      seeded = true;
    }

    // 10. Exam Subject Configurations (linking grade_subjects to exam_periods)
    const configsCountRow = await db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) as count FROM exam_subject_configs;",
    );
    if ((configsCountRow?.count ?? 0) === 0) {
      const allGradeSubjects = await db.getAllAsync<{ id: string }>(
        "SELECT id FROM grade_subjects WHERE academic_year_id = ?;",
        [activeYearId],
      );
      const allPeriods = await db.getAllAsync<{
        id: string;
        code: string;
        max_mark_default: number;
        pass_mark_default: number;
      }>(
        "SELECT id, code, max_mark_default, pass_mark_default FROM exam_periods WHERE academic_year_id = ?;",
        [activeYearId],
      );

      for (const period of allPeriods) {
        for (const gs of allGradeSubjects) {
          await db.runAsync(
            `INSERT INTO exam_subject_configs (id, exam_period_id, grade_subject_id, max_mark, pass_mark)
             VALUES (?, ?, ?, ?, ?);`,
            [Crypto.randomUUID(), period.id, gs.id, period.max_mark_default, period.pass_mark_default],
          );
        }
      }
      seeded = true;
    }

    // 11. Canonical Sections (e.g. Grade 8 Section 5 from Reference Workbook)
    const sectionsCountRow = await db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) as count FROM sections;",
    );
    let sampleSectionId: string | null = null;
    if ((sectionsCountRow?.count ?? 0) === 0) {
      const g8 = await db.getFirstAsync<{ id: string }>("SELECT id FROM grades WHERE code_level = 8;");
      if (g8) {
        sampleSectionId = Crypto.randomUUID();
        await db.runAsync(
          `INSERT INTO sections (id, grade_id, name, full_name, class_supervisor_teacher_id)
           VALUES (?, ?, '5', 'صنف هشتم - شعبه ۵', ?);`,
          [sampleSectionId, g8.id, adminUserId],
        );
      }
      const g7 = await db.getFirstAsync<{ id: string }>("SELECT id FROM grades WHERE code_level = 7;");
      if (g7) {
        await db.runAsync(
          `INSERT INTO sections (id, grade_id, name, full_name, class_supervisor_teacher_id)
           VALUES (?, ?, '1', 'صنف هفتم - شعبه ۱', ?);`,
          [Crypto.randomUUID(), g7.id, adminUserId],
        );
      }
      seeded = true;
    } else {
      const sec = await db.getFirstAsync<{ id: string }>("SELECT id FROM sections LIMIT 1;");
      sampleSectionId = sec?.id ?? null;
    }

    // 12. Sample Student Cohort for Verification (if no students enrolled)
    const enrollmentsCountRow = await db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) as count FROM student_enrollments;",
    );
    if ((enrollmentsCountRow?.count ?? 0) === 0 && sampleSectionId) {
      const sampleStudents = [
        { asas: '10401', roll: 1, first: 'احمد', father: 'محمد سرور', grand: 'غلام محمد' },
        { asas: '10402', roll: 2, first: 'علی سینا', father: 'رضا', grand: 'حسین' },
        { asas: '10403', roll: 3, first: 'محمود', father: 'عبدالرحیم', grand: 'عبدالحکیم' },
        { asas: '10404', roll: 4, first: 'بلال', father: 'نورالله', grand: 'حبیب الله' },
        { asas: '10405', roll: 5, first: 'فرهاد', father: 'محمد ظاهر', grand: 'شیر احمد' },
        { asas: '10406', roll: 6, first: 'عثمان', father: 'عبدالکریم', grand: 'فضل احمد' },
        { asas: '10407', roll: 7, first: 'مصطفی', father: 'محمد یعقوب', grand: 'غلام فاروق' },
        { asas: '10408', roll: 8, first: 'خالد', father: 'محمد داود', grand: 'محمد انور' },
        { asas: '10409', roll: 9, first: 'زبیر', father: 'محمد اسحاق', grand: 'عبدالصمد' },
        { asas: '10410', roll: 10, first: 'سهراب', father: 'احمد شاه', grand: 'محمد نادر' },
      ];

      const midPeriod = await db.getFirstAsync<{ id: string }>(
        "SELECT id FROM exam_periods WHERE academic_year_id = ? AND code = 'MID_TERM';",
        [activeYearId],
      );
      const annualPeriod = await db.getFirstAsync<{ id: string }>(
        "SELECT id FROM exam_periods WHERE academic_year_id = ? AND code = 'ANNUAL';",
        [activeYearId],
      );

      // Fetch configs for active subjects in this section
      let midConfigs: { id: string }[] = [];
      let annualConfigs: { id: string }[] = [];
      if (midPeriod) {
        midConfigs = await db.getAllAsync<{ id: string }>(
          `SELECT esc.id
           FROM exam_subject_configs esc
           JOIN grade_subjects gs ON esc.grade_subject_id = gs.id
           JOIN sections sec ON sec.grade_id = gs.grade_id
           WHERE sec.id = ? AND esc.exam_period_id = ? AND gs.is_active_in_grade = 1
           ORDER BY gs.sort_order ASC;`,
          [sampleSectionId, midPeriod.id],
        );
      }
      if (annualPeriod) {
        annualConfigs = await db.getAllAsync<{ id: string }>(
          `SELECT esc.id
           FROM exam_subject_configs esc
           JOIN grade_subjects gs ON esc.grade_subject_id = gs.id
           JOIN sections sec ON sec.grade_id = gs.grade_id
           WHERE sec.id = ? AND esc.exam_period_id = ? AND gs.is_active_in_grade = 1
           ORDER BY gs.sort_order ASC;`,
          [sampleSectionId, annualPeriod.id],
        );
      }

      for (const st of sampleStudents) {
        const studentId = Crypto.randomUUID();
        await db.runAsync(
          `INSERT INTO students (id, asas_number, first_name, father_name, grandfather_name, enrollment_year_id, status)
           VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE');`,
          [studentId, st.asas, st.first, st.father, st.grand, activeYearId],
        );

        const enrollmentId = Crypto.randomUUID();
        await db.runAsync(
          `INSERT INTO student_enrollments (id, student_id, section_id, academic_year_id, roll_number, enrollment_status)
           VALUES (?, ?, ?, ?, ?, 'ENROLLED');`,
          [enrollmentId, studentId, sampleSectionId, activeYearId, st.roll],
        );

        // Seed attendance
        if (midPeriod) {
          await db.runAsync(
            `INSERT INTO student_attendance (id, enrollment_id, exam_period_id, total_instructional_days, present_days, absent_days, sick_days, leave_days, recorded_by_user_id)
             VALUES (?, ?, ?, 100, 95, 3, 1, 1, ?);`,
            [Crypto.randomUUID(), enrollmentId, midPeriod.id, adminUserId],
          );
        }
        if (annualPeriod) {
          await db.runAsync(
            `INSERT INTO student_attendance (id, enrollment_id, exam_period_id, total_instructional_days, present_days, absent_days, sick_days, leave_days, recorded_by_user_id)
             VALUES (?, ?, ?, 110, 104, 4, 1, 1, ?);`,
            [Crypto.randomUUID(), enrollmentId, annualPeriod.id, adminUserId],
          );
        }

        // Seed sample marks using exam_subject_configs
        for (let i = 0; i < midConfigs.length; i++) {
          const cfg = midConfigs[i];
          const midMark = Math.min(40, 24 + (((st.roll * 3) + i) % 15));
          await db.runAsync(
            `INSERT INTO marks (id, enrollment_id, exam_subject_config_id, mark_value, status, entered_by_user_id)
             VALUES (?, ?, ?, ?, 'ENTERED', ?);`,
            [Crypto.randomUUID(), enrollmentId, cfg.id, midMark, adminUserId],
          );
        }

        for (let i = 0; i < annualConfigs.length; i++) {
          const cfg = annualConfigs[i];
          const annualMark = Math.min(60, 36 + (((st.roll * 4) + i) % 23));
          await db.runAsync(
            `INSERT INTO marks (id, enrollment_id, exam_subject_config_id, mark_value, status, entered_by_user_id)
             VALUES (?, ?, ?, ?, 'ENTERED', ?);`,
            [Crypto.randomUUID(), enrollmentId, cfg.id, annualMark, adminUserId],
          );
        }
      }
      seeded = true;
    }
  });

  const finalGradesRow = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM grades;",
  );
  const finalSubjectsRow = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM subjects;",
  );

  return {
    seeded,
    schoolName: INSTITUTIONAL_DEFAULTS.SCHOOL_NAME,
    activeYear: INSTITUTIONAL_DEFAULTS.ACTIVE_YEAR_NAME,
    gradesCount: finalGradesRow?.count ?? 0,
    subjectsCount: finalSubjectsRow?.count ?? 0,
    rulesConfigured: true,
  };
}
