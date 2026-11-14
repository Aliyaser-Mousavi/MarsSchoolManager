/**
 * Mars School Manager - Database Entity Types & Domain Interfaces
 */

import {
  FinalResultStatus,
  GradeLetter,
  MidtermResultStatus,
} from "@/constants/canonical-defaults";

export type UserRole = "ADMIN" | "HEADMASTER" | "EXAM_COMMITTEE" | "TEACHER";
export type StudentStatus = "ACTIVE" | "TRANSFERRED" | "DROPPED" | "GRADUATED";
export type EnrollmentStatus = "ENROLLED" | "LEFT" | "DROPPED";
export type MarkStatus = "ENTERED" | "ABSENT" | "EXEMPT";
export type ExamPeriodCode = "MID_TERM" | "ANNUAL" | "RETAKE";
export type EducationCycle = "PRIMARY" | "LOWER_SECONDARY" | "UPPER_SECONDARY";
export type ExchangePackageType =
  | "TEACHER_SUBMISSION"
  | "FULL_BACKUP"
  | "CLASS_ROSTER";
export type ExchangePackageStatus =
  | "PENDING"
  | "ACCEPTED"
  | "REJECTED"
  | "CONFLICT_RESOLVED";

export interface SchoolProfile {
  id: string;
  school_name: string;
  province: string;
  district: string;
  village_area: string | null;
  established_year: number | null;
  principal_name: string | null;
  ministry_registration_code: string | null;
  logo_uri: string | null;
  report_card_motto: string;
  sig_class_supervisor_title: string;
  sig_headmaster_title: string;
  sig_principal_title: string;
  sig_academic_member_title: string;
  sig_district_director_title: string;
  sig_supervision_officer_title: string;
  sig_parent_title: string;
  created_at: string;
  updated_at: string;
}

export interface AcademicYear {
  id: string;
  shamsi_year: number;
  qamari_year: number | null;
  name: string;
  start_date: string;
  end_date: string;
  is_active: number; // 0 or 1
  is_locked: number; // 0 or 1
  created_at: string;
}

export interface Grade {
  id: string;
  code_level: number; // 1 to 12
  name: string;
  cycle: EducationCycle;
  sort_order: number;
}

export interface Section {
  id: string;
  grade_id: string;
  name: string; // '1', '2', 'الف', 'ب'
  full_name: string; // 'هشتم 5'
  class_supervisor_teacher_id: string | null;
  created_at: string;
}

export interface Subject {
  id: string;
  code: string;
  name: string;
  default_sort_order: number;
}

export interface GradeSubject {
  id: string;
  grade_id: string;
  subject_id: string;
  academic_year_id: string;
  is_active_in_grade: number; // 0 or 1
  display_in_template: number; // 0 or 1
  template_column_index: number;
  sort_order: number;
}

export interface User {
  id: string;
  full_name: string;
  father_name: string | null;
  phone_number: string | null;
  role: UserRole;
  pin_hash: string | null;
  is_active: number; // 0 or 1
  created_at: string;
}

export interface TeacherAssignment {
  id: string;
  teacher_id: string;
  section_id: string;
  grade_subject_id: string;
  academic_year_id: string;
  assigned_at?: string;
}

export interface Student {
  id: string;
  asas_number: string;
  first_name: string;
  father_name: string;
  grandfather_name: string;
  tazkira_id: string | null;
  birth_year: number | null;
  gender: "M" | "F" | null;
  photo_uri: string | null;
  enrollment_year_id: string | null;
  status: StudentStatus;
  created_at: string;
  updated_at: string;
}

export interface StudentEnrollment {
  id: string;
  student_id: string;
  section_id: string;
  academic_year_id: string;
  roll_number: number | null;
  enrollment_status: EnrollmentStatus;
  midterm_result_status: MidtermResultStatus | null;
  midterm_grade_letter: GradeLetter | null;
  final_result_status: FinalResultStatus | null;
  final_grade_letter: GradeLetter | null;
  total_score: number | null;
  average_score: number | null;
  rank_in_section: number | null;
  remarks: string | null;
  is_finalized: number; // 0 or 1
  created_at: string;
}

export interface ExamPeriod {
  id: string;
  academic_year_id: string;
  code: ExamPeriodCode;
  name: string;
  max_mark_default: number;
  pass_mark_default: number;
  is_closed: number; // 0 or 1
  created_at?: string;
}

export interface ExamSubjectConfig {
  id: string;
  exam_period_id: string;
  grade_subject_id: string;
  max_mark: number;
  pass_mark: number;
  created_at?: string;
}

export interface Mark {
  id: string;
  enrollment_id: string;
  exam_subject_config_id: string;
  mark_value: number | null; // null = pending / not entered; 0.00 = entered zero; > 0 = score
  status: MarkStatus;
  entered_by_user_id: string;
  is_verified: number; // 0 or 1
  created_at: string;
  updated_at: string;
}

export interface MarkAuditLog {
  id: string;
  mark_id: string;
  old_value: number | null;
  old_status: string | null;
  new_value: number | null;
  new_status: string | null;
  changed_by_user_id: string;
  change_reason: string;
  timestamp: string;
}

export interface StudentAttendance {
  id: string;
  enrollment_id: string;
  exam_period_id: string;
  total_instructional_days: number;
  present_days: number;
  absent_days: number;
  sick_days: number;
  leave_days: number;
  recorded_by_user_id: string;
  created_at: string;
  updated_at: string;
}

export interface SectionExamSummary {
  id: string;
  section_id: string;
  academic_year_id: string;
  exam_period_id: string;
  total_enrolled: number;
  total_sat_exam: number;
  total_passed: number;
  total_conditional: number;
  total_failed: number;
  total_excused: number;
  total_barred: number;
  total_transferred: number;
  last_computed_at: string;
}

export interface GradingRule {
  id: string;
  academic_year_id: string;
  grade_id: string | null; // null = school-wide default for that year; non-null = grade-specific override
  midterm_max_mark: number; // default 40.0
  midterm_pass_mark: number; // default 16.0
  annual_max_mark: number; // default 60.0
  annual_pass_mark: number; // default 24.0
  combined_max_mark: number; // default 100.0
  combined_pass_mark: number; // default 40.0
  mashroot_min_failed_subjects: number; // default 1
  mashroot_max_failed_subjects: number; // default 3
  nakam_min_failed_subjects: number; // default 4
  midterm_grade_alef_min: number; // 36.0
  midterm_grade_be_min: number; // 30.0
  midterm_grade_jim_min: number; // 24.0
  midterm_grade_dal_min: number; // 20.0
  final_grade_alef_min: number; // 90.0
  final_grade_be_min: number; // 75.0
  final_grade_jim_min: number; // 60.0
  final_grade_dal_min: number; // 50.0
  force_grade_he_on_any_failed_subject: number; // 1 or 0
  mahroom_max_absent_days: number | null;
  mahroom_max_absent_percentage: number | null;
  created_at: string;
  updated_at: string;
}

export interface TableTemplate {
  id: string;
  name: string; // e.g., 'افغانستان - فارمت معیاری وزارت معارف'
  sheet_code: string; // 'MIDTERM', 'ANNUAL', 'COMBINED', 'TABULATION', 'REPORT_CARD'
  columns_json: string; // JSON array of column definitions, widths, titles
  header_rows_count: number;
  rows_per_student: number; // 4 for tabulation sheet, 1 for simple lists
  repeating_signature_rows_interval: number | null; // 5 for tabulation sheet
  footer_text: string | null;
  is_default: number; // 0 or 1
  created_at: string;
}

export interface ExchangePackage {
  id: string;
  package_type: ExchangePackageType;
  sender_device_id: string;
  sender_user_id: string;
  academic_year_id: string;
  section_id: string | null;
  subject_id: string | null;
  exam_period_id: string | null;
  records_count: number;
  checksum_sha256: string;
  payload_json: string;
  imported_at: string | null;
  imported_by_user_id: string | null;
  status: ExchangePackageStatus;
  created_at: string;
}
