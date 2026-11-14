/**
 * Mars School Manager - Configuration & Institutional Repository Service
 * Manages school profile, academic calendar, grading rules, grades, sections, and curriculum bindings.
 */

import * as Crypto from 'expo-crypto';
import { getDbAsync } from '@/db/client';
import {
  GradingRuleInput,
  GradingRuleInputSchema,
  SchoolProfileInput,
  SchoolProfileInputSchema,
} from '@/domain/schemas';
import {
  AcademicYear,
  ExamPeriod,
  Grade,
  GradeSubject,
  GradingRule,
  SchoolProfile,
  Section,
  Subject,
} from '@/types/database';

export const configService = {
  /**
   * Retrieves the current school profile.
   */
  async getSchoolProfileAsync(): Promise<SchoolProfile> {
    const db = await getDbAsync();
    const profile = await db.getFirstAsync<SchoolProfile>('SELECT * FROM school_profile LIMIT 1;');
    if (!profile) {
      throw new Error('مشخصات مکتب یافت نشد');
    }
    return profile;
  },

  /**
   * Updates institutional school profile details.
   */
  async updateSchoolProfileAsync(input: SchoolProfileInput): Promise<SchoolProfile> {
    const validated = SchoolProfileInputSchema.parse(input);
    const db = await getDbAsync();

    await db.runAsync(
      `UPDATE school_profile SET
        school_name = ?,
        province = ?,
        district = ?,
        village_area = ?,
        established_year = ?,
        principal_name = ?,
        ministry_registration_code = ?,
        logo_uri = ?,
        report_card_motto = ?,
        sig_class_supervisor_title = ?,
        sig_headmaster_title = ?,
        sig_principal_title = ?,
        sig_academic_member_title = ?,
        sig_district_director_title = ?,
        sig_supervision_officer_title = ?,
        sig_parent_title = ?,
        updated_at = datetime('now');`,
      [
        validated.school_name,
        validated.province,
        validated.district,
        validated.village_area ?? null,
        validated.established_year ?? null,
        validated.principal_name ?? null,
        validated.ministry_registration_code ?? null,
        validated.logo_uri ?? null,
        validated.report_card_motto,
        validated.sig_class_supervisor_title,
        validated.sig_headmaster_title,
        validated.sig_principal_title,
        validated.sig_academic_member_title,
        validated.sig_district_director_title,
        validated.sig_supervision_officer_title,
        validated.sig_parent_title,
      ]
    );

    return await this.getSchoolProfileAsync();
  },

  /**
   * Retrieves the current active academic year.
   */
  async getActiveAcademicYearAsync(): Promise<AcademicYear> {
    const db = await getDbAsync();
    const year = await db.getFirstAsync<AcademicYear>(
      'SELECT * FROM academic_years WHERE is_active = 1 LIMIT 1;'
    );
    if (!year) {
      throw new Error('سال تعلیمی فعال یافت نشد');
    }
    return year;
  },

  /**
   * Retrieves all academic years.
   */
  async getAllAcademicYearsAsync(): Promise<AcademicYear[]> {
    const db = await getDbAsync();
    return await db.getAllAsync<AcademicYear>('SELECT * FROM academic_years ORDER BY shamsi_year DESC;');
  },

  /**
   * Retrieves the applicable grading rule for a grade and year.
   * Priority: Grade-specific rule > School-wide year rule.
   */
  async getGradingRuleAsync(academicYearId: string, gradeId?: string | null): Promise<GradingRule> {
    const db = await getDbAsync();

    if (gradeId) {
      const gradeRule = await db.getFirstAsync<GradingRule>(
        'SELECT * FROM grading_rules WHERE academic_year_id = ? AND grade_id = ?;',
        [academicYearId, gradeId]
      );
      if (gradeRule) return gradeRule;
    }

    // Fall back to school-wide baseline rule for that year
    const defaultRule = await db.getFirstAsync<GradingRule>(
      'SELECT * FROM grading_rules WHERE academic_year_id = ? AND grade_id IS NULL;',
      [academicYearId]
    );

    if (!defaultRule) {
      throw new Error(`قواعد نمره‌دهی برای سال تعلیمی ${academicYearId} تعریف نشده است`);
    }

    return defaultRule;
  },

  /**
   * Saves or updates a grading rule.
   */
  async saveGradingRuleAsync(input: GradingRuleInput): Promise<GradingRule> {
    const validated = GradingRuleInputSchema.parse(input);
    const db = await getDbAsync();

    const existing = await db.getFirstAsync<GradingRule>(
      `SELECT * FROM grading_rules 
       WHERE academic_year_id = ? AND (${validated.grade_id ? 'grade_id = ?' : 'grade_id IS NULL'});`,
      validated.grade_id ? [validated.academic_year_id, validated.grade_id] : [validated.academic_year_id]
    );

    let ruleId: string;

    if (!existing) {
      ruleId = Crypto.randomUUID();
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
          ruleId,
          validated.academic_year_id,
          validated.grade_id ?? null,
          validated.midterm_max_mark,
          validated.midterm_pass_mark,
          validated.annual_max_mark,
          validated.annual_pass_mark,
          validated.combined_max_mark,
          validated.combined_pass_mark,
          validated.mashroot_min_failed_subjects,
          validated.mashroot_max_failed_subjects,
          validated.nakam_min_failed_subjects,
          validated.midterm_grade_alef_min,
          validated.midterm_grade_be_min,
          validated.midterm_grade_jim_min,
          validated.midterm_grade_dal_min,
          validated.final_grade_alef_min,
          validated.final_grade_be_min,
          validated.final_grade_jim_min,
          validated.final_grade_dal_min,
          validated.force_grade_he_on_any_failed_subject,
          validated.mahroom_max_absent_days ?? null,
          validated.mahroom_max_absent_percentage ?? null,
        ]
      );
    } else {
      ruleId = existing.id;
      await db.runAsync(
        `UPDATE grading_rules SET
          midterm_max_mark = ?, midterm_pass_mark = ?,
          annual_max_mark = ?, annual_pass_mark = ?,
          combined_max_mark = ?, combined_pass_mark = ?,
          mashroot_min_failed_subjects = ?, mashroot_max_failed_subjects = ?, nakam_min_failed_subjects = ?,
          midterm_grade_alef_min = ?, midterm_grade_be_min = ?, midterm_grade_jim_min = ?, midterm_grade_dal_min = ?,
          final_grade_alef_min = ?, final_grade_be_min = ?, final_grade_jim_min = ?, final_grade_dal_min = ?,
          force_grade_he_on_any_failed_subject = ?,
          mahroom_max_absent_days = ?, mahroom_max_absent_percentage = ?,
          updated_at = datetime('now')
         WHERE id = ?;`,
        [
          validated.midterm_max_mark,
          validated.midterm_pass_mark,
          validated.annual_max_mark,
          validated.annual_pass_mark,
          validated.combined_max_mark,
          validated.combined_pass_mark,
          validated.mashroot_min_failed_subjects,
          validated.mashroot_max_failed_subjects,
          validated.nakam_min_failed_subjects,
          validated.midterm_grade_alef_min,
          validated.midterm_grade_be_min,
          validated.midterm_grade_jim_min,
          validated.midterm_grade_dal_min,
          validated.final_grade_alef_min,
          validated.final_grade_be_min,
          validated.final_grade_jim_min,
          validated.final_grade_dal_min,
          validated.force_grade_he_on_any_failed_subject,
          validated.mahroom_max_absent_days ?? null,
          validated.mahroom_max_absent_percentage ?? null,
          ruleId,
        ]
      );
    }

    const saved = await db.getFirstAsync<GradingRule>('SELECT * FROM grading_rules WHERE id = ?;', [ruleId]);
    if (!saved) throw new Error('خطا در ذخیره قواعد نمره‌دهی');
    return saved;
  },

  /**
   * Retrieves all 12 grades ordered by code level.
   */
  async getAllGradesAsync(): Promise<Grade[]> {
    const db = await getDbAsync();
    return await db.getAllAsync<Grade>('SELECT * FROM grades ORDER BY code_level ASC;');
  },

  /**
   * Retrieves sections for a specific grade.
   */
  async getSectionsByGradeAsync(gradeId: string): Promise<Section[]> {
    const db = await getDbAsync();
    return await db.getAllAsync<Section>('SELECT * FROM sections WHERE grade_id = ? ORDER BY name ASC;', [gradeId]);
  },

  /**
   * Retrieves all subjects in the system catalog.
   */
  async getAllSubjectsAsync(): Promise<Subject[]> {
    const db = await getDbAsync();
    return await db.getAllAsync<Subject>('SELECT * FROM subjects ORDER BY default_sort_order ASC;');
  },

  /**
   * Retrieves grade-subject curriculum bindings with template column indexes.
   */
  async getGradeSubjectsAsync(
    gradeId: string,
    academicYearId: string
  ): Promise<(GradeSubject & { subject_name: string; subject_code: string })[]> {
    const db = await getDbAsync();
    return await db.getAllAsync<GradeSubject & { subject_name: string; subject_code: string }>(
      `SELECT gs.*, s.name as subject_name, s.code as subject_code
       FROM grade_subjects gs
       JOIN subjects s ON gs.subject_id = s.id
       WHERE gs.grade_id = ? AND gs.academic_year_id = ?
       ORDER BY gs.sort_order ASC, gs.template_column_index ASC;`,
      [gradeId, academicYearId]
    );
  },

  /**
   * Retrieves exam periods for a given academic year.
   */
  async getExamPeriodsForYearAsync(academicYearId: string): Promise<ExamPeriod[]> {
    const db = await getDbAsync();
    return await db.getAllAsync<ExamPeriod>(
      'SELECT * FROM exam_periods WHERE academic_year_id = ? ORDER BY code ASC;',
      [academicYearId]
    );
  },
};
