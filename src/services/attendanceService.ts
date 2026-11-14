/**
 * Mars School Manager - Student Attendance Repository Service
 * Enforces period isolation, non-negative values, and present_days <= total_days constraints.
 */

import * as Crypto from 'expo-crypto';
import { getDbAsync, withTransactionAsync } from '@/db/client';
import { AttendanceInput, AttendanceInputSchema } from '@/domain/schemas';
import { StudentAttendance } from '@/types/database';

export interface StudentAttendanceRosterRow {
  enrollmentId: string;
  studentId: string;
  asasNumber: string;
  rollNumber: number | null;
  studentName: string;
  fatherName: string;
  attendanceId: string | null;
  totalDays: number;
  presentDays: number;
  absentDays: number;
  sickDays: number;
  leaveDays: number;
}

export interface StudentAnnualAttendanceSummary {
  enrollmentId: string;
  midterm: StudentAttendance | null;
  annual: StudentAttendance | null;
  totalInstructionalDays: number;
  totalPresentDays: number;
  totalAbsentDays: number;
  totalSickDays: number;
  totalLeaveDays: number;
}

export const attendanceService = {
  /**
   * Fetches the attendance roster for a section and specific exam period.
   */
  async getSectionAttendanceRosterAsync(
    sectionId: string,
    examPeriodId: string
  ): Promise<StudentAttendanceRosterRow[]> {
    const db = await getDbAsync();

    const examPeriod = await db.getFirstAsync<{ academic_year_id: string }>(
      'SELECT academic_year_id FROM exam_periods WHERE id = ?;',
      [examPeriodId]
    );
    if (!examPeriod) throw new Error('دوره امتحانات یافت نشد');

    const rows = await db.getAllAsync<{
      enrollment_id: string;
      student_id: string;
      asas_number: string;
      roll_number: number | null;
      first_name: string;
      father_name: string;
      attendance_id: string | null;
      total_days: number | null;
      present_days: number | null;
      absent_days: number | null;
      sick_days: number | null;
      leave_days: number | null;
    }>(
      `SELECT 
        e.id as enrollment_id,
        s.id as student_id,
        s.asas_number,
        e.roll_number,
        s.first_name,
        s.father_name,
        sa.id as attendance_id,
        sa.total_instructional_days as total_days,
        sa.present_days,
        sa.absent_days,
        sa.sick_days,
        sa.leave_days
       FROM student_enrollments e
       JOIN students s ON e.student_id = s.id
       LEFT JOIN student_attendance sa ON sa.enrollment_id = e.id AND sa.exam_period_id = ?
       WHERE e.section_id = ? AND e.academic_year_id = ?
       ORDER BY 
         CASE WHEN e.roll_number IS NULL THEN 1 ELSE 0 END,
         e.roll_number ASC,
         s.first_name ASC;`,
      [examPeriodId, sectionId, examPeriod.academic_year_id]
    );

    return rows.map((r) => ({
      enrollmentId: r.enrollment_id,
      studentId: r.student_id,
      asasNumber: r.asas_number,
      rollNumber: r.roll_number,
      studentName: r.first_name,
      fatherName: r.father_name,
      attendanceId: r.attendance_id,
      totalDays: r.total_days ?? 0,
      presentDays: r.present_days ?? 0,
      absentDays: r.absent_days ?? 0,
      sickDays: r.sick_days ?? 0,
      leaveDays: r.leave_days ?? 0,
    }));
  },

  /**
   * Saves or updates a student's attendance record for an exam period.
   */
  async saveStudentAttendanceAsync(input: AttendanceInput): Promise<StudentAttendance> {
    const validated = AttendanceInputSchema.parse(input);
    const db = await getDbAsync();

    return await withTransactionAsync(async () => {
      const existing = await db.getFirstAsync<StudentAttendance>(
        'SELECT * FROM student_attendance WHERE enrollment_id = ? AND exam_period_id = ?;',
        [validated.enrollment_id, validated.exam_period_id]
      );

      let recordId: string;

      if (!existing) {
        recordId = Crypto.randomUUID();
        await db.runAsync(
          `INSERT INTO student_attendance (
            id, enrollment_id, exam_period_id, total_instructional_days,
            present_days, absent_days, sick_days, leave_days, recorded_by_user_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            recordId,
            validated.enrollment_id,
            validated.exam_period_id,
            validated.total_instructional_days,
            validated.present_days,
            validated.absent_days,
            validated.sick_days,
            validated.leave_days,
            validated.recorded_by_user_id,
          ]
        );
      } else {
        recordId = existing.id;
        await db.runAsync(
          `UPDATE student_attendance SET
            total_instructional_days = ?,
            present_days = ?,
            absent_days = ?,
            sick_days = ?,
            leave_days = ?,
            recorded_by_user_id = ?,
            updated_at = datetime('now')
           WHERE id = ?;`,
          [
            validated.total_instructional_days,
            validated.present_days,
            validated.absent_days,
            validated.sick_days,
            validated.leave_days,
            validated.recorded_by_user_id,
            recordId,
          ]
        );
      }

      const refreshed = await db.getFirstAsync<StudentAttendance>(
        'SELECT * FROM student_attendance WHERE id = ?;',
        [recordId]
      );
      if (!refreshed) throw new Error('خطا در ذخیره حاضری شاگرد');
      return refreshed;
    });
  },

  /**
   * Batch saves attendance records inside an atomic transaction.
   */
  async batchSaveAttendanceAsync(attendanceList: AttendanceInput[]): Promise<number> {
    let saved = 0;
    await withTransactionAsync(async () => {
      for (const item of attendanceList) {
        await this.saveStudentAttendanceAsync(item);
        saved++;
      }
    });
    return saved;
  },

  /**
   * Aggregates attendance records across Midterm and Annual periods for a student.
   */
  async getStudentAnnualAttendanceSummaryAsync(
    enrollmentId: string
  ): Promise<StudentAnnualAttendanceSummary> {
    const db = await getDbAsync();

    const records = await db.getAllAsync<{
      attendance_record: StudentAttendance;
      code: string;
    }>(
      `SELECT sa.*, ep.code
       FROM student_attendance sa
       JOIN exam_periods ep ON sa.exam_period_id = ep.id
       WHERE sa.enrollment_id = ?;`,
      [enrollmentId]
    );

    let midterm: StudentAttendance | null = null;
    let annual: StudentAttendance | null = null;

    let totalInstructionalDays = 0;
    let totalPresentDays = 0;
    let totalAbsentDays = 0;
    let totalSickDays = 0;
    let totalLeaveDays = 0;

    for (const r of records) {
      if (r.code === 'MID_TERM') midterm = r as unknown as StudentAttendance;
      if (r.code === 'ANNUAL') annual = r as unknown as StudentAttendance;

      totalInstructionalDays += r.attendance_record?.total_instructional_days ?? 0;
      totalPresentDays += r.attendance_record?.present_days ?? 0;
      totalAbsentDays += r.attendance_record?.absent_days ?? 0;
      totalSickDays += r.attendance_record?.sick_days ?? 0;
      totalLeaveDays += r.attendance_record?.leave_days ?? 0;
    }

    return {
      enrollmentId,
      midterm,
      annual,
      totalInstructionalDays,
      totalPresentDays,
      totalAbsentDays,
      totalSickDays,
      totalLeaveDays,
    };
  },
};

