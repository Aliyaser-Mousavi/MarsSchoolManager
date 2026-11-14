/**
 * Mars School Manager - Official Ministry of Education (MoE) Calculation Engine
 * Pure, deterministic evaluation functions driven entirely by database GradingRule records.
 * Zero hardcoded thresholds.
 */

import {
  FINAL_RESULT_STATUSES,
  FinalResultStatus,
  GRADE_LETTERS,
  GradeLetter,
  MIDTERM_RESULT_STATUSES,
  MidtermResultStatus,
} from '@/constants/canonical-defaults';
import { GradingRule, MarkStatus, StudentAttendance } from '@/types/database';

export interface SubjectMarkEntry {
  gradeSubjectId: string;
  subjectCode: string;
  subjectName: string;
  isActiveInGrade: boolean;
  displayInTemplate: boolean;
  markValue: number | null; // null = pending / unentered; 0 = entered zero; >0 = score
  status: MarkStatus; // 'ENTERED' | 'ABSENT' | 'EXEMPT'
  maxMark: number;
  passMark: number;
}

export interface CombinedSubjectMark {
  gradeSubjectId: string;
  subjectCode: string;
  subjectName: string;
  isActiveInGrade: boolean;
  displayInTemplate: boolean;
  midtermMark: number | null;
  midtermStatus: MarkStatus;
  annualMark: number | null;
  annualStatus: MarkStatus;
  combinedMark: number | null;
  combinedMaxMark: number;
  combinedPassMark: number;
  isPassed: boolean | null; // null if unentered
}

export interface MidtermEvaluationResult {
  totalScore: number;
  averageScore: number;
  activeSubjectsCount: number;
  evaluatedSubjectsCount: number;
  failedSubjectsCount: number;
  failedSubjectNames: string[];
  isComplete: boolean;
  hasDisqualifyingAbsence: boolean;
  resultStatus: MidtermResultStatus;
  gradeLetter: GradeLetter;
}

export interface FinalEvaluationResult {
  combinedSubjectMarks: CombinedSubjectMark[];
  totalScore: number;
  averageScore: number;
  activeSubjectsCount: number;
  evaluatedSubjectsCount: number;
  failedSubjectsCount: number;
  failedSubjectNames: string[];
  isComplete: boolean;
  hasDisqualifyingAbsence: boolean;
  resultStatus: FinalResultStatus;
  gradeLetter: GradeLetter;
}

/**
 * Checks if a student's unexcused absences exceed the official threshold for exam disqualification (محروم).
 */
export function checkAttendanceDisqualification(
  attendance: StudentAttendance | null | undefined,
  rule: GradingRule
): boolean {
  if (!attendance) return false;

  const totalDays = attendance.total_instructional_days ?? 0;
  const absentDays = attendance.absent_days ?? 0;

  if (totalDays <= 0) return false;

  // Check absolute days threshold
  if (rule.mahroom_max_absent_days !== null && rule.mahroom_max_absent_days > 0) {
    if (absentDays >= rule.mahroom_max_absent_days) {
      return true;
    }
  }

  // Check percentage threshold (e.g., 25% absenteeism)
  if (rule.mahroom_max_absent_percentage !== null && rule.mahroom_max_absent_percentage > 0) {
    const percentage = (absentDays / totalDays) * 100;
    if (percentage >= rule.mahroom_max_absent_percentage) {
      return true;
    }
  }

  return false;
}

/**
 * Evaluates the Mid-Year Examination (نمرات وسط سال / چهارونیم ماهه) results for a student.
 */
export function calculateMidtermResult(params: {
  marks: SubjectMarkEntry[];
  gradingRule: GradingRule;
  attendance?: StudentAttendance | null;
  administrativeStatusOverride?: MidtermResultStatus | null;
}): MidtermEvaluationResult {
  const { marks, gradingRule, attendance, administrativeStatusOverride } = params;

  // Filter ONLY active subjects for this specific grade
  const activeMarks = marks.filter((m) => m.isActiveInGrade);
  const activeCount = activeMarks.length;

  let totalScore = 0;
  let evaluatedCount = 0;
  let failedCount = 0;
  const failedNames: string[] = [];
  let isComplete = true;

  for (const entry of activeMarks) {
    if (entry.status === 'EXEMPT') {
      // Excused from this subject: does not count in total or denominator
      continue;
    }

    if (entry.status === 'ABSENT') {
      // Absent: counts as 0 mark and fails the subject threshold
      evaluatedCount++;
      failedCount++;
      failedNames.push(entry.subjectName);
      continue;
    }

    if (entry.markValue === null) {
      // Mark has not been entered yet
      isComplete = false;
      continue;
    }

    evaluatedCount++;
    const mark = Math.max(0, Math.min(entry.markValue, entry.maxMark || gradingRule.midterm_max_mark));
    totalScore += mark;

    const passThreshold = entry.passMark || gradingRule.midterm_pass_mark;
    if (mark < passThreshold) {
      failedCount++;
      failedNames.push(entry.subjectName);
    }
  }

  const averageScore = evaluatedCount > 0 ? Number((totalScore / evaluatedCount).toFixed(2)) : 0;
  const hasDisqualifyingAbsence = checkAttendanceDisqualification(attendance, gradingRule);

  // Determine Result Status
  let resultStatus: MidtermResultStatus;
  if (administrativeStatusOverride) {
    resultStatus = administrativeStatusOverride;
  } else if (hasDisqualifyingAbsence) {
    resultStatus = MIDTERM_RESULT_STATUSES.BARRED; // محروم
  } else if (!isComplete && evaluatedCount === 0) {
    resultStatus = MIDTERM_RESULT_STATUSES.NEEDS_IMPROVEMENT;
  } else if (failedCount === 0 && averageScore >= gradingRule.midterm_pass_mark) {
    resultStatus = MIDTERM_RESULT_STATUSES.PASSED; // موفق
  } else {
    resultStatus = MIDTERM_RESULT_STATUSES.NEEDS_IMPROVEMENT; // تلاش بیشتر
  }

  // Determine Grade Letter (الف, ب, ج, د, هـ)
  let gradeLetter: GradeLetter;
  if (failedCount > 0 && gradingRule.force_grade_he_on_any_failed_subject === 1) {
    gradeLetter = GRADE_LETTERS.HE; // هـ
  } else if (averageScore >= gradingRule.midterm_grade_alef_min) {
    gradeLetter = GRADE_LETTERS.ALEF; // الف
  } else if (averageScore >= gradingRule.midterm_grade_be_min) {
    gradeLetter = GRADE_LETTERS.BE; // ب
  } else if (averageScore >= gradingRule.midterm_grade_jim_min) {
    gradeLetter = GRADE_LETTERS.JIM; // ج
  } else if (averageScore >= gradingRule.midterm_grade_dal_min) {
    gradeLetter = GRADE_LETTERS.DAL; // د
  } else {
    gradeLetter = GRADE_LETTERS.HE; // هـ
  }

  return {
    totalScore: Number(totalScore.toFixed(2)),
    averageScore,
    activeSubjectsCount: activeCount,
    evaluatedSubjectsCount: evaluatedCount,
    failedSubjectsCount: failedCount,
    failedSubjectNames: failedNames,
    isComplete,
    hasDisqualifyingAbsence,
    resultStatus,
    gradeLetter,
  };
}

/**
 * Evaluates the Combined Final Results (مجموع نهایی: وسط سال + سالانه) according to official MoE regulations.
 */
export function calculateFinalResult(params: {
  midtermMarks: SubjectMarkEntry[];
  annualMarks: SubjectMarkEntry[];
  gradingRule: GradingRule;
  annualAttendance?: StudentAttendance | null;
  totalAttendance?: StudentAttendance | null;
  administrativeStatusOverride?: FinalResultStatus | null;
}): FinalEvaluationResult {
  const {
    midtermMarks,
    annualMarks,
    gradingRule,
    annualAttendance,
    totalAttendance,
    administrativeStatusOverride,
  } = params;

  // Build map of annual marks by gradeSubjectId
  const annualMap = new Map<string, SubjectMarkEntry>();
  for (const a of annualMarks) {
    annualMap.set(a.gradeSubjectId, a);
  }

  const combinedSubjectMarks: CombinedSubjectMark[] = [];
  let totalScore = 0;
  let evaluatedCount = 0;
  let failedCount = 0;
  const failedNames: string[] = [];
  let isComplete = true;

  // Process all subjects from midterm roster
  for (const mid of midtermMarks) {
    const ann = annualMap.get(mid.gradeSubjectId);
    const isActive = mid.isActiveInGrade;
    const displayInTemplate = mid.displayInTemplate;

    const midVal = mid.status === 'ABSENT' ? 0 : mid.markValue;
    const annVal = ann?.status === 'ABSENT' ? 0 : ann?.markValue ?? null;

    let combinedMark: number | null = null;
    let isPassed: boolean | null = null;

    if (isActive) {
      if (mid.status === 'EXEMPT' || ann?.status === 'EXEMPT') {
        // Exempt subject handling
        combinedMark = null;
      } else if (midVal === null || annVal === null) {
        // Mark missing in either exam
        isComplete = false;
        combinedMark = null;
      } else {
        // Both exams entered
        const m1 = Math.max(0, Math.min(midVal, mid.maxMark || gradingRule.midterm_max_mark));
        const m2 = Math.max(0, Math.min(annVal, ann?.maxMark || gradingRule.annual_max_mark));
        combinedMark = Number((m1 + m2).toFixed(2));
        totalScore += combinedMark;
        evaluatedCount++;

        const passThreshold = gradingRule.combined_pass_mark;
        isPassed = combinedMark >= passThreshold;
        if (!isPassed) {
          failedCount++;
          failedNames.push(mid.subjectName);
        }
      }
    }

    combinedSubjectMarks.push({
      gradeSubjectId: mid.gradeSubjectId,
      subjectCode: mid.subjectCode,
      subjectName: mid.subjectName,
      isActiveInGrade: isActive,
      displayInTemplate,
      midtermMark: mid.status === 'ABSENT' ? 0 : mid.markValue,
      midtermStatus: mid.status,
      annualMark: ann?.status === 'ABSENT' ? 0 : ann?.markValue ?? null,
      annualStatus: ann?.status ?? 'ENTERED',
      combinedMark,
      combinedMaxMark: gradingRule.combined_max_mark,
      combinedPassMark: gradingRule.combined_pass_mark,
      isPassed,
    });
  }

  const averageScore = evaluatedCount > 0 ? Number((totalScore / evaluatedCount).toFixed(2)) : 0;
  const activeCount = midtermMarks.filter((m) => m.isActiveInGrade).length;

  // Check attendance disqualification on either annual or combined attendance
  const hasDisqualifyingAbsence =
    checkAttendanceDisqualification(annualAttendance, gradingRule) ||
    checkAttendanceDisqualification(totalAttendance, gradingRule);

  // Evaluate Final Promotion / Result Status
  let resultStatus: FinalResultStatus;
  if (administrativeStatusOverride) {
    resultStatus = administrativeStatusOverride;
  } else if (hasDisqualifyingAbsence) {
    resultStatus = FINAL_RESULT_STATUSES.BARRED; // محروم
  } else if (!isComplete && evaluatedCount === 0) {
    resultStatus = FINAL_RESULT_STATUSES.REPEAT_GRADE;
  } else if (failedCount === 0 && averageScore >= gradingRule.combined_pass_mark) {
    resultStatus = FINAL_RESULT_STATUSES.PROMOTED; // ارتقای صنف
  } else if (
    failedCount >= gradingRule.mashroot_min_failed_subjects &&
    failedCount <= gradingRule.mashroot_max_failed_subjects
  ) {
    resultStatus = FINAL_RESULT_STATUSES.CONDITIONAL; // مشروط
  } else {
    // 4 or more failed subjects, or overall average < combined_pass_mark
    resultStatus = FINAL_RESULT_STATUSES.REPEAT_GRADE; // تکرارصنف
  }

  // Evaluate Final Grade Letter (الف, ب, ج, د, هـ)
  let gradeLetter: GradeLetter;
  if (failedCount > 0 && gradingRule.force_grade_he_on_any_failed_subject === 1) {
    gradeLetter = GRADE_LETTERS.HE; // Any failed subject forces grade 'هـ'
  } else if (averageScore >= gradingRule.final_grade_alef_min) {
    gradeLetter = GRADE_LETTERS.ALEF; // الف (>= 90%)
  } else if (averageScore >= gradingRule.final_grade_be_min) {
    gradeLetter = GRADE_LETTERS.BE; // ب (75% - 89.9%)
  } else if (averageScore >= gradingRule.final_grade_jim_min) {
    gradeLetter = GRADE_LETTERS.JIM; // ج (60% - 74.9%)
  } else if (averageScore >= gradingRule.final_grade_dal_min) {
    gradeLetter = GRADE_LETTERS.DAL; // د (50% - 59.9%)
  } else {
    gradeLetter = GRADE_LETTERS.HE; // هـ (< 50%)
  }

  return {
    combinedSubjectMarks,
    totalScore: Number(totalScore.toFixed(2)),
    averageScore,
    activeSubjectsCount: activeCount,
    evaluatedSubjectsCount: evaluatedCount,
    failedSubjectsCount: failedCount,
    failedSubjectNames: failedNames,
    isComplete,
    hasDisqualifyingAbsence,
    resultStatus,
    gradeLetter,
  };
}

