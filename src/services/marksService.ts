/**
 * Mars School Manager - Marks & Audit Repository Service
 * Handles mark recording, batch entry, boundary checks, and traceable audit logging.
 */

import * as Crypto from 'expo-crypto';
import { getDbAsync, withTransactionAsync } from '@/db/client';
import { MarkInput, MarkInputSchema } from '@/domain/schemas';
import { Mark, MarkAuditLog } from '@/types/database';

export interface GridSubjectHeader {
  configId: string;
  gradeSubjectId: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  maxMark: number;
  passMark: number;
  isActiveInGrade: boolean;
  displayInTemplate: boolean;
  templateColumnIndex: number;
  sortOrder: number;
}

export interface StudentMarkCell {
  markId: string | null;
  configId: string;
  markValue: number | null;
  status: 'ENTERED' | 'ABSENT' | 'EXEMPT';
  isVerified: boolean;
}

export interface StudentMarksRow {
  enrollmentId: string;
  studentId: string;
  asasNumber: string;
  rollNumber: number | null;
  studentName: string;
  fatherName: string;
  marks: Record<string, StudentMarkCell>; // keyed by configId
}

export interface SectionMarksGrid {
  sectionId: string;
  examPeriodId: string;
  examPeriodCode: string;
  examPeriodName: string;
  subjects: GridSubjectHeader[];
  students: StudentMarksRow[];
}

export const marksService = {
  /**
   * Fetches the complete marks grid for a section and exam period.
   */
  async getSectionMarksGridAsync(sectionId: string, examPeriodId: string): Promise<SectionMarksGrid> {
    const db = await getDbAsync();

    // 1. Get Section info and Grade
    const sectionRow = await db.getFirstAsync<{ id: string; grade_id: string }>(
      'SELECT id, grade_id FROM sections WHERE id = ?;',
      [sectionId]
    );
    if (!sectionRow) throw new Error('صنف یافت نشد');

    // 2. Get Exam Period info
    const examPeriod = await db.getFirstAsync<{ id: string; code: string; name: string; academic_year_id: string }>(
      'SELECT id, code, name, academic_year_id FROM exam_periods WHERE id = ?;',
      [examPeriodId]
    );
    if (!examPeriod) throw new Error('دوره امتحانات یافت نشد');

    // 3. Get Subjects configured for this Grade and Exam Period
    const subjects = await db.getAllAsync<{
      config_id: string;
      grade_subject_id: string;
      subject_id: string;
      subject_code: string;
      subject_name: string;
      max_mark: number;
      pass_mark: number;
      is_active_in_grade: number;
      display_in_template: number;
      template_column_index: number;
      sort_order: number;
    }>(
      `SELECT 
        esc.id as config_id,
        gs.id as grade_subject_id,
        s.id as subject_id,
        s.code as subject_code,
        s.name as subject_name,
        esc.max_mark,
        esc.pass_mark,
        gs.is_active_in_grade,
        gs.display_in_template,
        gs.template_column_index,
        gs.sort_order
       FROM exam_subject_configs esc
       JOIN grade_subjects gs ON esc.grade_subject_id = gs.id
       JOIN subjects s ON gs.subject_id = s.id
       WHERE esc.exam_period_id = ? AND gs.grade_id = ? AND gs.academic_year_id = ?
       ORDER BY gs.sort_order ASC, gs.template_column_index ASC;`,
      [examPeriodId, sectionRow.grade_id, examPeriod.academic_year_id]
    );

    // 4. Get enrolled students in section
    const enrolledStudents = await db.getAllAsync<{
      enrollment_id: string;
      student_id: string;
      asas_number: string;
      roll_number: number | null;
      first_name: string;
      father_name: string;
    }>(
      `SELECT 
        e.id as enrollment_id,
        s.id as student_id,
        s.asas_number,
        e.roll_number,
        s.first_name,
        s.father_name
       FROM student_enrollments e
       JOIN students s ON e.student_id = s.id
       WHERE e.section_id = ? AND e.academic_year_id = ?
       ORDER BY 
         CASE WHEN e.roll_number IS NULL THEN 1 ELSE 0 END,
         e.roll_number ASC,
         s.first_name ASC;`,
      [sectionId, examPeriod.academic_year_id]
    );

    // 5. Get all existing marks for these enrollments in this exam period
    const existingMarks = await db.getAllAsync<{
      id: string;
      enrollment_id: string;
      exam_subject_config_id: string;
      mark_value: number | null;
      status: 'ENTERED' | 'ABSENT' | 'EXEMPT';
      is_verified: number;
    }>(
      `SELECT m.id, m.enrollment_id, m.exam_subject_config_id, m.mark_value, m.status, m.is_verified
       FROM marks m
       JOIN exam_subject_configs esc ON m.exam_subject_config_id = esc.id
       WHERE esc.exam_period_id = ?;`,
      [examPeriodId]
    );

    const marksMap = new Map<string, (typeof existingMarks)[0]>();
    for (const m of existingMarks) {
      marksMap.set(`${m.enrollment_id}_${m.exam_subject_config_id}`, m);
    }

    const students: StudentMarksRow[] = enrolledStudents.map((st) => {
      const marksCells: Record<string, StudentMarkCell> = {};
      for (const sub of subjects) {
        const key = `${st.enrollment_id}_${sub.config_id}`;
        const found = marksMap.get(key);
        marksCells[sub.config_id] = {
          markId: found ? found.id : null,
          configId: sub.config_id,
          markValue: found ? found.mark_value : null,
          status: found ? found.status : 'ENTERED',
          isVerified: found ? found.is_verified === 1 : false,
        };
      }

      return {
        enrollmentId: st.enrollment_id,
        studentId: st.student_id,
        asasNumber: st.asas_number,
        rollNumber: st.roll_number,
        studentName: st.first_name,
        fatherName: st.father_name,
        marks: marksCells,
      };
    });

    return {
      sectionId,
      examPeriodId,
      examPeriodCode: examPeriod.code,
      examPeriodName: examPeriod.name,
      subjects: subjects.map((s) => ({
        configId: s.config_id,
        gradeSubjectId: s.grade_subject_id,
        subjectId: s.subject_id,
        subjectCode: s.subject_code,
        subjectName: s.subject_name,
        maxMark: s.max_mark,
        passMark: s.pass_mark,
        isActiveInGrade: s.is_active_in_grade === 1,
        displayInTemplate: s.display_in_template === 1,
        templateColumnIndex: s.template_column_index,
        sortOrder: s.sort_order,
      })),
      students,
    };
  },

  /**
   * Saves or updates a single mark with an automatic audit trail entry if changed.
   */
  async saveMarkAsync(input: MarkInput, changedByUserId: string, changeReason: string = 'ثبت/ویرایش نمره'): Promise<Mark> {
    const validated = MarkInputSchema.parse(input);
    const db = await getDbAsync();

    return await withTransactionAsync(async () => {
      const existing = await db.getFirstAsync<Mark>(
        'SELECT * FROM marks WHERE enrollment_id = ? AND exam_subject_config_id = ?;',
        [validated.enrollment_id, validated.exam_subject_config_id]
      );

      let markId: string;

      if (!existing) {
        markId = Crypto.randomUUID();
        await db.runAsync(
          `INSERT INTO marks (
            id, enrollment_id, exam_subject_config_id, mark_value, status, entered_by_user_id
          ) VALUES (?, ?, ?, ?, ?, ?);`,
          [
            markId,
            validated.enrollment_id,
            validated.exam_subject_config_id,
            validated.mark_value,
            validated.status,
            changedByUserId,
          ]
        );

        // Record initial creation in audit log
        await db.runAsync(
          `INSERT INTO marks_audit_log (
            id, mark_id, old_value, old_status, new_value, new_status, changed_by_user_id, change_reason
          ) VALUES (?, ?, null, null, ?, ?, ?, ?);`,
          [
            Crypto.randomUUID(),
            markId,
            validated.mark_value,
            validated.status,
            changedByUserId,
            changeReason,
          ]
        );
      } else {
        markId = existing.id;
        const hasValueChanged = existing.mark_value !== validated.mark_value || existing.status !== validated.status;

        if (hasValueChanged) {
          await db.runAsync(
            `UPDATE marks SET
              mark_value = ?,
              status = ?,
              entered_by_user_id = ?,
              updated_at = datetime('now')
             WHERE id = ?;`,
            [validated.mark_value, validated.status, changedByUserId, markId]
          );

          await db.runAsync(
            `INSERT INTO marks_audit_log (
              id, mark_id, old_value, old_status, new_value, new_status, changed_by_user_id, change_reason
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
            [
              Crypto.randomUUID(),
              markId,
              existing.mark_value,
              existing.status,
              validated.mark_value,
              validated.status,
              changedByUserId,
              changeReason,
            ]
          );
        }
      }

      const refreshed = await db.getFirstAsync<Mark>('SELECT * FROM marks WHERE id = ?;', [markId]);
      if (!refreshed) throw new Error('خطا در ذخیره نمره');
      return refreshed;
    });
  },

  /**
   * Batch records an array of marks inside an atomic transaction.
   */
  async batchSaveMarksAsync(
    marksList: MarkInput[],
    changedByUserId: string,
    changeReason: string = 'ورود گروهی نمرات'
  ): Promise<number> {
    let savedCount = 0;
    await withTransactionAsync(async () => {
      for (const item of marksList) {
        await this.saveMarkAsync(item, changedByUserId, changeReason);
        savedCount++;
      }
    });
    return savedCount;
  },

  /**
   * Counts missing (unentered) marks for active subjects in a section and exam period.
   */
  async getMissingMarksCountAsync(sectionId: string, examPeriodId: string): Promise<number> {
    const grid = await this.getSectionMarksGridAsync(sectionId, examPeriodId);
    let missing = 0;

    const activeConfigIds = new Set(grid.subjects.filter((s) => s.isActiveInGrade).map((s) => s.configId));

    for (const st of grid.students) {
      for (const configId of activeConfigIds) {
        const cell = st.marks[configId];
        if (!cell || (cell.markValue === null && cell.status === 'ENTERED')) {
          missing++;
        }
      }
    }

    return missing;
  },

  /**
   * Retrieves the full audit history for a specific mark.
   */
  async getMarksAuditHistoryAsync(markId: string): Promise<MarkAuditLog[]> {
    const db = await getDbAsync();
    return await db.getAllAsync<MarkAuditLog>(
      'SELECT * FROM marks_audit_log WHERE mark_id = ? ORDER BY timestamp DESC;',
      [markId]
    );
  },
};

