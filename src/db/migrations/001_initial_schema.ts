/**
 * Migration 001 - Initial Production Schema for Mars School Manager
 * Version 1: Core Institutional Hierarchy, Curriculum, Marks, Attendance,
 * Grading Rules, Table Templates, and Offline Exchange Envelope.
 */

import { SQLiteDatabase } from 'expo-sqlite';

export const migration001 = {
  version: 1,
  description: 'Initial production schema with grading rules, table templates, and exchange packages',
  up: async (db: SQLiteDatabase): Promise<void> => {
    await db.execAsync(`
      -- 1. Institutional Configuration
      CREATE TABLE IF NOT EXISTS school_profile (
        id TEXT PRIMARY KEY NOT NULL,
        school_name TEXT NOT NULL,
        province TEXT NOT NULL,
        district TEXT NOT NULL,
        village_area TEXT,
        established_year INTEGER,
        principal_name TEXT,
        ministry_registration_code TEXT,
        logo_uri TEXT,
        report_card_motto TEXT NOT NULL,
        sig_class_supervisor_title TEXT NOT NULL,
        sig_headmaster_title TEXT NOT NULL,
        sig_principal_title TEXT NOT NULL,
        sig_academic_member_title TEXT NOT NULL,
        sig_district_director_title TEXT NOT NULL,
        sig_supervision_officer_title TEXT NOT NULL,
        sig_parent_title TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      -- 2. Academic Calendar (Dual Solar Hijri & Lunar Hijri)
      CREATE TABLE IF NOT EXISTS academic_years (
        id TEXT PRIMARY KEY NOT NULL,
        shamsi_year INTEGER NOT NULL UNIQUE,
        qamari_year INTEGER,
        name TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 0,
        is_locked INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      -- 3. Grades & Sections
      CREATE TABLE IF NOT EXISTS grades (
        id TEXT PRIMARY KEY NOT NULL,
        code_level INTEGER NOT NULL UNIQUE,
        name TEXT NOT NULL,
        cycle TEXT NOT NULL CHECK(cycle IN ('PRIMARY', 'LOWER_SECONDARY', 'UPPER_SECONDARY')),
        sort_order INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sections (
        id TEXT PRIMARY KEY NOT NULL,
        grade_id TEXT NOT NULL,
        name TEXT NOT NULL,
        full_name TEXT NOT NULL,
        class_supervisor_teacher_id TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (grade_id) REFERENCES grades(id) ON DELETE RESTRICT,
        FOREIGN KEY (class_supervisor_teacher_id) REFERENCES users(id) ON DELETE SET NULL,
        UNIQUE(grade_id, name)
      );

      -- 4. Dynamic Subjects Catalog
      CREATE TABLE IF NOT EXISTS subjects (
        id TEXT PRIMARY KEY NOT NULL,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        default_sort_order INTEGER NOT NULL DEFAULT 0
      );

      -- Grade Curriculum Binding with Active vs Template Preservation Flag
      CREATE TABLE IF NOT EXISTS grade_subjects (
        id TEXT PRIMARY KEY NOT NULL,
        grade_id TEXT NOT NULL,
        subject_id TEXT NOT NULL,
        academic_year_id TEXT NOT NULL,
        is_active_in_grade INTEGER NOT NULL DEFAULT 1,
        display_in_template INTEGER NOT NULL DEFAULT 1,
        template_column_index INTEGER NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (grade_id) REFERENCES grades(id) ON DELETE CASCADE,
        FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
        FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE,
        UNIQUE(grade_id, subject_id, academic_year_id)
      );

      -- 5. Personnel & Teacher Assignments
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY NOT NULL,
        full_name TEXT NOT NULL,
        father_name TEXT,
        phone_number TEXT,
        role TEXT NOT NULL CHECK(role IN ('ADMIN', 'HEADMASTER', 'EXAM_COMMITTEE', 'TEACHER')),
        pin_hash TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS teacher_assignments (
        id TEXT PRIMARY KEY NOT NULL,
        teacher_id TEXT NOT NULL,
        section_id TEXT NOT NULL,
        grade_subject_id TEXT NOT NULL,
        academic_year_id TEXT NOT NULL,
        assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE,
        FOREIGN KEY (grade_subject_id) REFERENCES grade_subjects(id) ON DELETE CASCADE,
        FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE,
        UNIQUE(teacher_id, section_id, grade_subject_id, academic_year_id)
      );

      -- 6. Student Master Directory & Yearly Enrollments
      CREATE TABLE IF NOT EXISTS students (
        id TEXT PRIMARY KEY NOT NULL,
        asas_number TEXT NOT NULL UNIQUE,
        first_name TEXT NOT NULL,
        father_name TEXT NOT NULL,
        grandfather_name TEXT NOT NULL,
        tazkira_id TEXT,
        birth_year INTEGER,
        gender TEXT CHECK(gender IN ('M', 'F')),
        photo_uri TEXT,
        enrollment_year_id TEXT,
        status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'TRANSFERRED', 'DROPPED', 'GRADUATED')),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (enrollment_year_id) REFERENCES academic_years(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS student_enrollments (
        id TEXT PRIMARY KEY NOT NULL,
        student_id TEXT NOT NULL,
        section_id TEXT NOT NULL,
        academic_year_id TEXT NOT NULL,
        roll_number INTEGER,
        enrollment_status TEXT NOT NULL DEFAULT 'ENROLLED' CHECK(enrollment_status IN ('ENROLLED', 'LEFT', 'DROPPED')),
        midterm_result_status TEXT CHECK(midterm_result_status IN ('موفق', 'تلاش بیشتر', 'معذرتی', 'محروم', 'نقل مکان')),
        midterm_grade_letter TEXT CHECK(midterm_grade_letter IN ('الف', 'ب', 'ج', 'د', 'هـ')),
        final_result_status TEXT CHECK(final_result_status IN ('ارتقای صنف', 'مشروط', 'تکرارصنف', 'معذرتی', 'محروم', 'نقل مکان')),
        final_grade_letter TEXT CHECK(final_grade_letter IN ('الف', 'ب', 'ج', 'د', 'هـ')),
        total_score REAL,
        average_score REAL,
        rank_in_section INTEGER,
        remarks TEXT,
        is_finalized INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT,
        FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE RESTRICT,
        FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE RESTRICT,
        UNIQUE(student_id, academic_year_id)
      );

      -- 7. Configurable Examination Periods & Subject Boundaries
      CREATE TABLE IF NOT EXISTS exam_periods (
        id TEXT PRIMARY KEY NOT NULL,
        academic_year_id TEXT NOT NULL,
        code TEXT NOT NULL CHECK(code IN ('MID_TERM', 'ANNUAL', 'RETAKE')),
        name TEXT NOT NULL,
        max_mark_default REAL NOT NULL,
        pass_mark_default REAL NOT NULL,
        is_closed INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE,
        UNIQUE(academic_year_id, code)
      );

      CREATE TABLE IF NOT EXISTS exam_subject_configs (
        id TEXT PRIMARY KEY NOT NULL,
        exam_period_id TEXT NOT NULL,
        grade_subject_id TEXT NOT NULL,
        max_mark REAL NOT NULL,
        pass_mark REAL NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (exam_period_id) REFERENCES exam_periods(id) ON DELETE CASCADE,
        FOREIGN KEY (grade_subject_id) REFERENCES grade_subjects(id) ON DELETE CASCADE,
        UNIQUE(exam_period_id, grade_subject_id)
      );

      -- 8. Marks Recording & Immutable Audit Trail
      CREATE TABLE IF NOT EXISTS marks (
        id TEXT PRIMARY KEY NOT NULL,
        enrollment_id TEXT NOT NULL,
        exam_subject_config_id TEXT NOT NULL,
        mark_value REAL,
        status TEXT NOT NULL DEFAULT 'ENTERED' CHECK(status IN ('ENTERED', 'ABSENT', 'EXEMPT')),
        entered_by_user_id TEXT NOT NULL,
        is_verified INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (enrollment_id) REFERENCES student_enrollments(id) ON DELETE CASCADE,
        FOREIGN KEY (exam_subject_config_id) REFERENCES exam_subject_configs(id) ON DELETE CASCADE,
        FOREIGN KEY (entered_by_user_id) REFERENCES users(id) ON DELETE RESTRICT,
        UNIQUE(enrollment_id, exam_subject_config_id)
      );

      CREATE TABLE IF NOT EXISTS marks_audit_log (
        id TEXT PRIMARY KEY NOT NULL,
        mark_id TEXT NOT NULL,
        old_value REAL,
        old_status TEXT,
        new_value REAL,
        new_status TEXT,
        changed_by_user_id TEXT NOT NULL,
        change_reason TEXT NOT NULL,
        timestamp TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (mark_id) REFERENCES marks(id) ON DELETE CASCADE,
        FOREIGN KEY (changed_by_user_id) REFERENCES users(id) ON DELETE RESTRICT
      );

      -- 9. Attendance Models
      CREATE TABLE IF NOT EXISTS student_attendance (
        id TEXT PRIMARY KEY NOT NULL,
        enrollment_id TEXT NOT NULL,
        exam_period_id TEXT NOT NULL,
        total_instructional_days INTEGER NOT NULL DEFAULT 0 CHECK(total_instructional_days >= 0),
        present_days INTEGER NOT NULL DEFAULT 0 CHECK(present_days >= 0),
        absent_days INTEGER NOT NULL DEFAULT 0 CHECK(absent_days >= 0),
        sick_days INTEGER NOT NULL DEFAULT 0 CHECK(sick_days >= 0),
        leave_days INTEGER NOT NULL DEFAULT 0 CHECK(leave_days >= 0),
        recorded_by_user_id TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (enrollment_id) REFERENCES student_enrollments(id) ON DELETE CASCADE,
        FOREIGN KEY (exam_period_id) REFERENCES exam_periods(id) ON DELETE CASCADE,
        FOREIGN KEY (recorded_by_user_id) REFERENCES users(id) ON DELETE RESTRICT,
        UNIQUE(enrollment_id, exam_period_id),
        CHECK(present_days <= total_instructional_days)
      );

      -- 10. Summary Statistics Cache (خلص نتایج)
      CREATE TABLE IF NOT EXISTS section_exam_summaries (
        id TEXT PRIMARY KEY NOT NULL,
        section_id TEXT NOT NULL,
        academic_year_id TEXT NOT NULL,
        exam_period_id TEXT NOT NULL,
        total_enrolled INTEGER NOT NULL DEFAULT 0,
        total_sat_exam INTEGER NOT NULL DEFAULT 0,
        total_passed INTEGER NOT NULL DEFAULT 0,
        total_conditional INTEGER NOT NULL DEFAULT 0,
        total_failed INTEGER NOT NULL DEFAULT 0,
        total_excused INTEGER NOT NULL DEFAULT 0,
        total_barred INTEGER NOT NULL DEFAULT 0,
        total_transferred INTEGER NOT NULL DEFAULT 0,
        last_computed_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE,
        FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE,
        FOREIGN KEY (exam_period_id) REFERENCES exam_periods(id) ON DELETE CASCADE,
        UNIQUE(section_id, academic_year_id, exam_period_id)
      );

      -- 11. Configurable Grading & Promotion Rules (Mandatory Correction 2)
      CREATE TABLE IF NOT EXISTS grading_rules (
        id TEXT PRIMARY KEY NOT NULL,
        academic_year_id TEXT NOT NULL,
        grade_id TEXT,
        midterm_max_mark REAL NOT NULL DEFAULT 40.0,
        midterm_pass_mark REAL NOT NULL DEFAULT 16.0,
        annual_max_mark REAL NOT NULL DEFAULT 60.0,
        annual_pass_mark REAL NOT NULL DEFAULT 24.0,
        combined_max_mark REAL NOT NULL DEFAULT 100.0,
        combined_pass_mark REAL NOT NULL DEFAULT 40.0,
        mashroot_min_failed_subjects INTEGER NOT NULL DEFAULT 1,
        mashroot_max_failed_subjects INTEGER NOT NULL DEFAULT 3,
        nakam_min_failed_subjects INTEGER NOT NULL DEFAULT 4,
        midterm_grade_alef_min REAL NOT NULL DEFAULT 36.0,
        midterm_grade_be_min REAL NOT NULL DEFAULT 30.0,
        midterm_grade_jim_min REAL NOT NULL DEFAULT 24.0,
        midterm_grade_dal_min REAL NOT NULL DEFAULT 20.0,
        final_grade_alef_min REAL NOT NULL DEFAULT 90.0,
        final_grade_be_min REAL NOT NULL DEFAULT 75.0,
        final_grade_jim_min REAL NOT NULL DEFAULT 60.0,
        final_grade_dal_min REAL NOT NULL DEFAULT 50.0,
        force_grade_he_on_any_failed_subject INTEGER NOT NULL DEFAULT 1 CHECK(force_grade_he_on_any_failed_subject IN (0, 1)),
        mahroom_max_absent_days INTEGER,
        mahroom_max_absent_percentage REAL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE,
        FOREIGN KEY (grade_id) REFERENCES grades(id) ON DELETE CASCADE,
        UNIQUE(academic_year_id, grade_id)
      );

      -- 12. Custom Table & Sheet Structure Metadata (Mandatory Correction 4)
      CREATE TABLE IF NOT EXISTS table_templates (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        sheet_code TEXT NOT NULL UNIQUE,
        columns_json TEXT NOT NULL,
        header_rows_count INTEGER NOT NULL DEFAULT 3,
        rows_per_student INTEGER NOT NULL DEFAULT 1,
        repeating_signature_rows_interval INTEGER,
        footer_text TEXT,
        is_default INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      -- 13. Offline Multi-Device Exchange Packages (Mandatory Correction 1)
      CREATE TABLE IF NOT EXISTS exchange_packages (
        id TEXT PRIMARY KEY NOT NULL,
        package_type TEXT NOT NULL CHECK(package_type IN ('TEACHER_SUBMISSION', 'FULL_BACKUP', 'CLASS_ROSTER')),
        sender_device_id TEXT NOT NULL,
        sender_user_id TEXT NOT NULL,
        academic_year_id TEXT NOT NULL,
        section_id TEXT,
        subject_id TEXT,
        exam_period_id TEXT,
        records_count INTEGER NOT NULL,
        checksum_sha256 TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        imported_at TEXT,
        imported_by_user_id TEXT,
        status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'CONFLICT_RESOLVED')),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (sender_user_id) REFERENCES users(id) ON DELETE RESTRICT
      );

      -- 14. Essential Indexes for Query Performance and Relational Integrity
      CREATE INDEX IF NOT EXISTS idx_students_asas ON students(asas_number);
      CREATE INDEX IF NOT EXISTS idx_enrollments_student ON student_enrollments(student_id);
      CREATE INDEX IF NOT EXISTS idx_enrollments_section ON student_enrollments(section_id, academic_year_id);
      CREATE INDEX IF NOT EXISTS idx_marks_enrollment ON marks(enrollment_id);
      CREATE INDEX IF NOT EXISTS idx_marks_config ON marks(exam_subject_config_id);
      CREATE INDEX IF NOT EXISTS idx_audit_mark ON marks_audit_log(mark_id);
      CREATE INDEX IF NOT EXISTS idx_attendance_enrollment ON student_attendance(enrollment_id, exam_period_id);
      CREATE INDEX IF NOT EXISTS idx_grade_subjects ON grade_subjects(grade_id, academic_year_id);
      CREATE INDEX IF NOT EXISTS idx_teacher_assignments ON teacher_assignments(teacher_id, academic_year_id);
      CREATE INDEX IF NOT EXISTS idx_exchange_status ON exchange_packages(status);
    `);
  },
};

