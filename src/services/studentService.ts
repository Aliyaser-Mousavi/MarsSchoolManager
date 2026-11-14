/**
 * Mars School Manager - Student & Enrollment Repository Service
 * Handles 6-field student lineage, Asas registry, yearly enrollments, and transfers.
 */

import * as Crypto from 'expo-crypto';
import { getDbAsync } from '@/db/client';
import { StudentInput, StudentInputSchema } from '@/domain/schemas';
import { Student, StudentEnrollment } from '@/types/database';

export interface EnrolledStudentRow {
  enrollmentId: string;
  studentId: string;
  asasNumber: string;
  rollNumber: number | null;
  firstName: string;
  fatherName: string;
  grandfatherName: string;
  tazkiraId: string | null;
  gender: 'M' | 'F' | null;
  birthYear: number | null;
  photoUri: string | null;
  enrollmentStatus: string;
  midtermResultStatus: string | null;
  midtermGradeLetter: string | null;
  finalResultStatus: string | null;
  finalGradeLetter: string | null;
  totalScore: number | null;
  averageScore: number | null;
  rankInSection: number | null;
  remarks: string | null;
  isFinalized: boolean;
}

export const studentService = {
  /**
   * Creates a new student record in the master directory.
   */
  async createStudentAsync(input: StudentInput): Promise<Student> {
    const validated = StudentInputSchema.parse(input);
    const db = await getDbAsync();
    const id = Crypto.randomUUID();

    await db.runAsync(
      `INSERT INTO students (
        id, asas_number, first_name, father_name, grandfather_name,
        tazkira_id, birth_year, gender, photo_uri, enrollment_year_id, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE');`,
      [
        id,
        validated.asas_number,
        validated.first_name,
        validated.father_name,
        validated.grandfather_name,
        validated.tazkira_id ?? null,
        validated.birth_year ?? null,
        validated.gender ?? null,
        validated.photo_uri ?? null,
        validated.enrollment_year_id ?? null,
      ]
    );

    const created = await this.getStudentByIdAsync(id);
    if (!created) {
      throw new Error('خطا در ذخیره شاگرد جدید');
    }
    return created;
  },

  /**
   * Retrieves a student by internal ID.
   */
  async getStudentByIdAsync(id: string): Promise<Student | null> {
    const db = await getDbAsync();
    return await db.getFirstAsync<Student>('SELECT * FROM students WHERE id = ?;', [id]);
  },

  /**
   * Retrieves a student by immutable Asas Number (نمبر اساس).
   */
  async getStudentByAsasAsync(asasNumber: string): Promise<Student | null> {
    const db = await getDbAsync();
    return await db.getFirstAsync<Student>('SELECT * FROM students WHERE asas_number = ?;', [asasNumber.trim()]);
  },

  /**
   * Searches students across name, father name, grandfather name, and Asas number.
   */
  async searchStudentsAsync(query: string, limit: number = 50): Promise<Student[]> {
    const db = await getDbAsync();
    const term = `%${query.trim()}%`;
    return await db.getAllAsync<Student>(
      `SELECT * FROM students 
       WHERE asas_number LIKE ? 
          OR first_name LIKE ? 
          OR father_name LIKE ? 
          OR grandfather_name LIKE ? 
          OR tazkira_id LIKE ?
       ORDER BY first_name ASC
       LIMIT ?;`,
      [term, term, term, term, term, limit]
    );
  },

  /**
   * Enrolls an existing student into a specific grade section for an academic year.
   */
  async enrollStudentAsync(
    studentId: string,
    sectionId: string,
    academicYearId: string,
    rollNumber?: number | null
  ): Promise<StudentEnrollment> {
    const db = await getDbAsync();

    // Check if already enrolled in this academic year
    const existing = await db.getFirstAsync<StudentEnrollment>(
      'SELECT * FROM student_enrollments WHERE student_id = ? AND academic_year_id = ?;',
      [studentId, academicYearId]
    );

    if (existing) {
      if (existing.section_id !== sectionId) {
        // Transfer student to the new section
        await db.runAsync(
          'UPDATE student_enrollments SET section_id = ?, roll_number = ? WHERE id = ?;',
          [sectionId, rollNumber ?? existing.roll_number, existing.id]
        );
        existing.section_id = sectionId;
        if (rollNumber !== undefined) existing.roll_number = rollNumber;
      }
      return existing;
    }

    const enrollmentId = Crypto.randomUUID();
    await db.runAsync(
      `INSERT INTO student_enrollments (
        id, student_id, section_id, academic_year_id, roll_number, enrollment_status
      ) VALUES (?, ?, ?, ?, ?, 'ENROLLED');`,
      [enrollmentId, studentId, sectionId, academicYearId, rollNumber ?? null]
    );

    const enrollment = await db.getFirstAsync<StudentEnrollment>(
      'SELECT * FROM student_enrollments WHERE id = ?;',
      [enrollmentId]
    );

    if (!enrollment) {
      throw new Error('خطا در ثبت نام شاگرد در صنف');
    }
    return enrollment;
  },

  /**
   * Fetches the complete student roster for a section and academic year, joined with personal details.
   */
  async getSectionEnrollmentsAsync(sectionId: string, academicYearId: string): Promise<EnrolledStudentRow[]> {
    const db = await getDbAsync();
    const rows = await db.getAllAsync<{
      enrollment_id: string;
      student_id: string;
      asas_number: string;
      roll_number: number | null;
      first_name: string;
      father_name: string;
      grandfather_name: string;
      tazkira_id: string | null;
      gender: 'M' | 'F' | null;
      birth_year: number | null;
      photo_uri: string | null;
      enrollment_status: string;
      midterm_result_status: string | null;
      midterm_grade_letter: string | null;
      final_result_status: string | null;
      final_grade_letter: string | null;
      total_score: number | null;
      average_score: number | null;
      rank_in_section: number | null;
      remarks: string | null;
      is_finalized: number;
    }>(
      `SELECT 
        e.id as enrollment_id,
        s.id as student_id,
        s.asas_number,
        e.roll_number,
        s.first_name,
        s.father_name,
        s.grandfather_name,
        s.tazkira_id,
        s.gender,
        s.birth_year,
        s.photo_uri,
        e.enrollment_status,
        e.midterm_result_status,
        e.midterm_grade_letter,
        e.final_result_status,
        e.final_grade_letter,
        e.total_score,
        e.average_score,
        e.rank_in_section,
        e.remarks,
        e.is_finalized
       FROM student_enrollments e
       JOIN students s ON e.student_id = s.id
       WHERE e.section_id = ? AND e.academic_year_id = ?
       ORDER BY 
         CASE WHEN e.roll_number IS NULL THEN 1 ELSE 0 END,
         e.roll_number ASC,
         s.first_name ASC;`,
      [sectionId, academicYearId]
    );

    return rows.map((r) => ({
      enrollmentId: r.enrollment_id,
      studentId: r.student_id,
      asasNumber: r.asas_number,
      rollNumber: r.roll_number,
      firstName: r.first_name,
      fatherName: r.father_name,
      grandfatherName: r.grandfather_name,
      tazkiraId: r.tazkira_id,
      gender: r.gender,
      birthYear: r.birth_year,
      photoUri: r.photo_uri,
      enrollmentStatus: r.enrollment_status,
      midtermResultStatus: r.midterm_result_status,
      midtermGradeLetter: r.midterm_grade_letter,
      finalResultStatus: r.final_result_status,
      finalGradeLetter: r.final_grade_letter,
      totalScore: r.total_score,
      averageScore: r.average_score,
      rankInSection: r.rank_in_section,
      remarks: r.remarks,
      isFinalized: r.is_finalized === 1,
    }));
  },

  /**
   * Updates an existing student's particulars.
   */
  async updateStudentAsync(id: string, updates: Partial<StudentInput>): Promise<Student> {
    const db = await getDbAsync();
    const existing = await this.getStudentByIdAsync(id);
    if (!existing) {
      throw new Error(`شاگرد با شناسه ${id} یافت نشد`);
    }

    const updated = {
      asas_number: updates.asas_number ?? existing.asas_number,
      first_name: updates.first_name ?? existing.first_name,
      father_name: updates.father_name ?? existing.father_name,
      grandfather_name: updates.grandfather_name ?? existing.grandfather_name,
      tazkira_id: updates.tazkira_id !== undefined ? updates.tazkira_id : existing.tazkira_id,
      birth_year: updates.birth_year !== undefined ? updates.birth_year : existing.birth_year,
      gender: updates.gender !== undefined ? updates.gender : existing.gender,
      photo_uri: updates.photo_uri !== undefined ? updates.photo_uri : existing.photo_uri,
      enrollment_year_id:
        updates.enrollment_year_id !== undefined ? updates.enrollment_year_id : existing.enrollment_year_id,
    };

    const validated = StudentInputSchema.parse(updated);

    await db.runAsync(
      `UPDATE students SET
        asas_number = ?,
        first_name = ?,
        father_name = ?,
        grandfather_name = ?,
        tazkira_id = ?,
        birth_year = ?,
        gender = ?,
        photo_uri = ?,
        enrollment_year_id = ?,
        updated_at = datetime('now')
       WHERE id = ?;`,
      [
        validated.asas_number,
        validated.first_name,
        validated.father_name,
        validated.grandfather_name,
        validated.tazkira_id ?? null,
        validated.birth_year ?? null,
        validated.gender ?? null,
        validated.photo_uri ?? null,
        validated.enrollment_year_id ?? null,
        id,
      ]
    );

    const refreshed = await this.getStudentByIdAsync(id);
    if (!refreshed) {
      throw new Error('خطا در بروزرسانی مشخصات شاگرد');
    }
    return refreshed;
  },

  /**
   * Helper for Excel imports: finds existing student by Asas number, or creates one if not found.
   */
  async findOrCreateStudentFromWorkbookAsync(row: {
    asasNumber: string;
    firstName: string;
    fatherName: string;
    grandfatherName: string;
    tazkiraId?: string | null;
    enrollmentYearId?: string | null;
  }): Promise<Student> {
    const existing = await this.getStudentByAsasAsync(row.asasNumber);
    if (existing) {
      return existing;
    }

    return await this.createStudentAsync({
      asas_number: row.asasNumber,
      first_name: row.firstName,
      father_name: row.fatherName,
      grandfather_name: row.grandfatherName,
      tazkira_id: row.tazkiraId ?? null,
      enrollment_year_id: row.enrollmentYearId ?? null,
    });
  },

  /**
   * Archives a student (e.g. transferred out or dropped) without deleting past academic history.
   */
  async archiveStudentAsync(id: string, status: 'TRANSFERRED' | 'DROPPED' | 'GRADUATED'): Promise<void> {
    const db = await getDbAsync();
    await db.runAsync("UPDATE students SET status = ?, updated_at = datetime('now') WHERE id = ?;", [status, id]);
  },
};
