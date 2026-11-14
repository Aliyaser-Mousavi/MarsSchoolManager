/**
 * Mars School Manager - Official Report & Printing Spooler Service
 * Generates Ministry-compliant Landscape A4 Tabulation Sheets (جدول نتایج)
 * and Student Report Cards (اطلاعنامه) with direct printing support via expo-print.
 */

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { configService } from './configService';
import { studentService } from './studentService';
import { marksService } from './marksService';
import { attendanceService } from './attendanceService';
import { calculateFinalResult, calculateMidtermResult, SubjectMarkEntry } from '@/domain/calculations';
import { INSTITUTIONAL_DEFAULTS, OFFICIAL_SIGNATURE_TITLES } from '@/constants/canonical-defaults';
import { toPersianDigits } from '@/domain/schemas';
import { MarkStatus, StudentAttendance } from '@/types/database';

export interface TabulationDataBundle {
  schoolProfile: Awaited<ReturnType<typeof configService.getSchoolProfileAsync>>;
  academicYear: Awaited<ReturnType<typeof configService.getActiveAcademicYearAsync>>;
  section: { id: string; name: string; full_name: string; grade_name: string; grade_id: string };
  gradingRule: Awaited<ReturnType<typeof configService.getGradingRuleAsync>>;
  subjects: Awaited<ReturnType<typeof configService.getGradeSubjectsAsync>>;
  studentsData: {
    enrollmentId: string;
    rollNumber: number | null;
    asasNumber: string;
    tazkiraId: string | null;
    firstName: string;
    fatherName: string;
    grandfatherName: string;
    midtermMarks: Record<string, number | null>;
    annualMarks: Record<string, number | null>;
    finalMarks: Record<string, number | null>;
    midtermEvaluation: ReturnType<typeof calculateMidtermResult>;
    finalEvaluation: ReturnType<typeof calculateFinalResult>;
    midtermAttendance: StudentAttendance | null;
    annualAttendance: StudentAttendance | null;
    totalAttendance: {
      totalDays: number;
      presentDays: number;
      absentDays: number;
      sickDays: number;
      leaveDays: number;
    };
    remarks: string | null;
  }[];
  summaryCounters: {
    enrolled: number;
    midtermSat: number;
    midtermPassed: number;
    midtermConditional: number;
    midtermFailed: number;
    midtermExcused: number;
    midtermBarred: number;
    midtermTransferred: number;
    annualSat: number;
    annualPassed: number;
    annualConditional: number;
    annualFailed: number;
    annualExcused: number;
    annualBarred: number;
    annualTransferred: number;
  };
}

export const reportService = {
  /**
   * Aggregates all necessary relational records to build official reports for a section.
   */
  async buildSectionTabulationDataAsync(sectionId: string, academicYearId: string): Promise<TabulationDataBundle> {
    const schoolProfile = await configService.getSchoolProfileAsync();
    const academicYear = await configService.getActiveAcademicYearAsync();
    const allGrades = await configService.getAllGradesAsync();

    const db = await (await import('@/db/client')).getDbAsync();
    const sectionRow = await db.getFirstAsync<{ id: string; name: string; full_name: string; grade_id: string }>(
      'SELECT id, name, full_name, grade_id FROM sections WHERE id = ?;',
      [sectionId]
    );
    if (!sectionRow) throw new Error('صنف یافت نشد');

    const grade = allGrades.find((g) => g.id === sectionRow.grade_id);
    const section = {
      ...sectionRow,
      grade_name: grade?.name ?? 'صنف',
    };

    const gradingRule = await configService.getGradingRuleAsync(academicYearId, section.grade_id);
    const subjects = await configService.getGradeSubjectsAsync(section.grade_id, academicYearId);
    const examPeriods = await configService.getExamPeriodsForYearAsync(academicYearId);

    const midtermPeriod = examPeriods.find((p) => p.code === 'MID_TERM') ?? examPeriods[0];
    const annualPeriod = examPeriods.find((p) => p.code === 'ANNUAL') ?? examPeriods[1] ?? examPeriods[0];

    const students = await studentService.getSectionEnrollmentsAsync(sectionId, academicYearId);

    const midtermGrid = await marksService.getSectionMarksGridAsync(sectionId, midtermPeriod.id);
    const annualGrid = await marksService.getSectionMarksGridAsync(sectionId, annualPeriod.id);

    const midtermAttendanceRoster = await attendanceService.getSectionAttendanceRosterAsync(sectionId, midtermPeriod.id);
    const annualAttendanceRoster = await attendanceService.getSectionAttendanceRosterAsync(sectionId, annualPeriod.id);

    const midtermAttMap = new Map(midtermAttendanceRoster.map((a) => [a.enrollmentId, a]));
    const annualAttMap = new Map(annualAttendanceRoster.map((a) => [a.enrollmentId, a]));

    const midtermStudentMap = new Map(midtermGrid.students.map((s) => [s.enrollmentId, s]));
    const annualStudentMap = new Map(annualGrid.students.map((s) => [s.enrollmentId, s]));

    // Track Summary Statistics for خلص نتایج
    const summaryCounters = {
      enrolled: students.length,
      midtermSat: 0,
      midtermPassed: 0,
      midtermConditional: 0,
      midtermFailed: 0,
      midtermExcused: 0,
      midtermBarred: 0,
      midtermTransferred: 0,
      annualSat: 0,
      annualPassed: 0,
      annualConditional: 0,
      annualFailed: 0,
      annualExcused: 0,
      annualBarred: 0,
      annualTransferred: 0,
    };

    const studentsData = students.map((st) => {
      const midStudent = midtermStudentMap.get(st.enrollmentId);
      const annStudent = annualStudentMap.get(st.enrollmentId);

      const midAtt = midtermAttMap.get(st.enrollmentId);
      const annAtt = annualAttMap.get(st.enrollmentId);

      const midtermAttendance: StudentAttendance | null = midAtt
        ? {
            id: midAtt.attendanceId ?? '',
            enrollment_id: st.enrollmentId,
            exam_period_id: midtermPeriod.id,
            total_instructional_days: midAtt.totalDays,
            present_days: midAtt.presentDays,
            absent_days: midAtt.absentDays,
            sick_days: midAtt.sickDays,
            leave_days: midAtt.leaveDays,
            recorded_by_user_id: '',
            created_at: '',
            updated_at: '',
          }
        : null;

      const annualAttendance: StudentAttendance | null = annAtt
        ? {
            id: annAtt.attendanceId ?? '',
            enrollment_id: st.enrollmentId,
            exam_period_id: annualPeriod.id,
            total_instructional_days: annAtt.totalDays,
            present_days: annAtt.presentDays,
            absent_days: annAtt.absentDays,
            sick_days: annAtt.sickDays,
            leave_days: annAtt.leaveDays,
            recorded_by_user_id: '',
            created_at: '',
            updated_at: '',
          }
        : null;

      const totalAttendance = {
        totalDays: (midAtt?.totalDays ?? 0) + (annAtt?.totalDays ?? 0),
        presentDays: (midAtt?.presentDays ?? 0) + (annAtt?.presentDays ?? 0),
        absentDays: (midAtt?.absentDays ?? 0) + (annAtt?.absentDays ?? 0),
        sickDays: (midAtt?.sickDays ?? 0) + (annAtt?.sickDays ?? 0),
        leaveDays: (midAtt?.leaveDays ?? 0) + (annAtt?.leaveDays ?? 0),
      };

      // Build calculation inputs
      const midtermEntries: SubjectMarkEntry[] = subjects.map((sub) => {
        const header = midtermGrid.subjects.find((h) => h.gradeSubjectId === sub.id);
        const cell = header && midStudent ? midStudent.marks[header.configId] : null;

        return {
          gradeSubjectId: sub.id,
          subjectCode: sub.subject_code,
          subjectName: sub.subject_name,
          isActiveInGrade: sub.is_active_in_grade === 1,
          displayInTemplate: sub.display_in_template === 1,
          markValue: cell?.markValue ?? null,
          status: (cell?.status as MarkStatus) ?? 'ENTERED',
          maxMark: header?.maxMark ?? gradingRule.midterm_max_mark,
          passMark: header?.passMark ?? gradingRule.midterm_pass_mark,
        };
      });

      const annualEntries: SubjectMarkEntry[] = subjects.map((sub) => {
        const header = annualGrid.subjects.find((h) => h.gradeSubjectId === sub.id);
        const cell = header && annStudent ? annStudent.marks[header.configId] : null;

        return {
          gradeSubjectId: sub.id,
          subjectCode: sub.subject_code,
          subjectName: sub.subject_name,
          isActiveInGrade: sub.is_active_in_grade === 1,
          displayInTemplate: sub.display_in_template === 1,
          markValue: cell?.markValue ?? null,
          status: (cell?.status as MarkStatus) ?? 'ENTERED',
          maxMark: header?.maxMark ?? gradingRule.annual_max_mark,
          passMark: header?.passMark ?? gradingRule.annual_pass_mark,
        };
      });

      const midtermEvaluation = calculateMidtermResult({
        marks: midtermEntries,
        gradingRule,
        attendance: midtermAttendance,
      });

      const finalEvaluation = calculateFinalResult({
        midtermMarks: midtermEntries,
        annualMarks: annualEntries,
        gradingRule,
        annualAttendance,
      });

      // Update summary counters
      if (midtermEvaluation.evaluatedSubjectsCount > 0) summaryCounters.midtermSat++;
      if (midtermEvaluation.resultStatus === 'موفق') summaryCounters.midtermPassed++;
      if (midtermEvaluation.resultStatus === 'تلاش بیشتر') summaryCounters.midtermConditional++;
      if (midtermEvaluation.resultStatus === 'معذرتی') summaryCounters.midtermExcused++;
      if (midtermEvaluation.resultStatus === 'محروم') summaryCounters.midtermBarred++;
      if (midtermEvaluation.resultStatus === 'نقل مکان') summaryCounters.midtermTransferred++;

      if (finalEvaluation.evaluatedSubjectsCount > 0) summaryCounters.annualSat++;
      if (finalEvaluation.resultStatus === 'ارتقای صنف') summaryCounters.annualPassed++;
      if (finalEvaluation.resultStatus === 'مشروط') summaryCounters.annualConditional++;
      if (finalEvaluation.resultStatus === 'تکرارصنف') summaryCounters.annualFailed++;
      if (finalEvaluation.resultStatus === 'معذرتی') summaryCounters.annualExcused++;
      if (finalEvaluation.resultStatus === 'محروم') summaryCounters.annualBarred++;
      if (finalEvaluation.resultStatus === 'نقل مکان') summaryCounters.annualTransferred++;

      const midtermMarks: Record<string, number | null> = {};
      const annualMarks: Record<string, number | null> = {};
      const finalMarks: Record<string, number | null> = {};

      for (const m of midtermEntries) {
        midtermMarks[m.gradeSubjectId] = m.status === 'ABSENT' ? 0 : m.markValue;
      }
      for (const a of annualEntries) {
        annualMarks[a.gradeSubjectId] = a.status === 'ABSENT' ? 0 : a.markValue;
      }
      for (const f of finalEvaluation.combinedSubjectMarks) {
        finalMarks[f.gradeSubjectId] = f.combinedMark;
      }

      return {
        enrollmentId: st.enrollmentId,
        rollNumber: st.rollNumber,
        asasNumber: st.asasNumber,
        tazkiraId: st.tazkiraId,
        firstName: st.firstName,
        fatherName: st.fatherName,
        grandfatherName: st.grandfatherName,
        midtermMarks,
        annualMarks,
        finalMarks,
        midtermEvaluation,
        finalEvaluation,
        midtermAttendance,
        annualAttendance,
        totalAttendance,
        remarks: st.remarks,
      };
    });

    return {
      schoolProfile,
      academicYear,
      section,
      gradingRule,
      subjects,
      studentsData,
      summaryCounters,
    };
  },

  /**
   * Generates the complete HTML string for the Landscape A4 Official Results Table (جدول نتایج).
   */
  generateTabulationSheetHtml(bundle: TabulationDataBundle): string {
    const { schoolProfile, academicYear, section, subjects, studentsData, summaryCounters } = bundle;

    // Filter subjects that are designated to display in template
    const displaySubjects = subjects.filter((s) => s.display_in_template === 1);

    const studentsHtmlRows: string[] = [];

    studentsData.forEach((st, idx) => {
      // Periodic signature row after every 5 students
      if (idx > 0 && idx % 5 === 0) {
        studentsHtmlRows.push(`
          <tr class="sig-row">
            <td colspan="${7 + displaySubjects.length + 8}" class="sig-cell">
              <div class="sig-row-content">
                <span><strong>${schoolProfile.sig_class_supervisor_title}:</strong> .........................</span>
                <span><strong>${schoolProfile.sig_principal_title}:</strong> .........................</span>
                <span><strong>${schoolProfile.sig_academic_member_title}:</strong> .........................</span>
                <span><strong>${schoolProfile.sig_district_director_title}:</strong> .........................</span>
              </div>
            </td>
          </tr>
        `);
      }

      const midtermCells = displaySubjects
        .map((sub) => {
          if (sub.is_active_in_grade === 0) return '<td class="mark-cell blank-cell"></td>';
          const val = st.midtermMarks[sub.id];
          return `<td class="mark-cell">${val !== null ? toPersianDigits(val) : ''}</td>`;
        })
        .join('');

      const annualCells = displaySubjects
        .map((sub) => {
          if (sub.is_active_in_grade === 0) return '<td class="mark-cell blank-cell"></td>';
          const val = st.annualMarks[sub.id];
          return `<td class="mark-cell">${val !== null ? toPersianDigits(val) : ''}</td>`;
        })
        .join('');

      const finalCells = displaySubjects
        .map((sub) => {
          if (sub.is_active_in_grade === 0) return '<td class="mark-cell blank-cell"></td>';
          const val = st.finalMarks[sub.id];
          const isFail = val !== null && val < 40;
          return `<td class="mark-cell ${isFail ? 'failed-mark' : ''}">${val !== null ? toPersianDigits(val) : ''}</td>`;
        })
        .join('');

      studentsHtmlRows.push(`
        <!-- Student Block: ${st.firstName} ولد ${st.fatherName} -->
        <tr class="student-row-midterm">
          <td rowspan="4" class="col-num">${toPersianDigits(st.rollNumber ?? idx + 1)}</td>
          <td rowspan="4" class="col-name">${st.firstName}</td>
          <td rowspan="4" class="col-father">${st.fatherName}</td>
          <td rowspan="4" class="col-gfather">${st.grandfatherName}</td>
          <td rowspan="4" class="col-asas">${toPersianDigits(st.asasNumber)}</td>
          <td rowspan="4" class="col-tazkira">${toPersianDigits(st.tazkiraId ?? '')}</td>
          <td class="col-exam-title">وسط سال</td>
          ${midtermCells}
          <td class="col-calc">${toPersianDigits(st.midtermEvaluation.totalScore)}</td>
          <td class="col-calc">${toPersianDigits(st.midtermEvaluation.averageScore)}</td>
          <td class="col-status">${st.midtermEvaluation.resultStatus}</td>
          <td class="col-grade">${st.midtermEvaluation.gradeLetter}</td>
          <td class="col-att">${toPersianDigits(st.midtermAttendance?.total_instructional_days ?? 0)}</td>
          <td class="col-att">${toPersianDigits(st.midtermAttendance?.present_days ?? 0)}</td>
          <td class="col-att">${toPersianDigits(st.midtermAttendance?.absent_days ?? 0)}</td>
          <td class="col-att">${toPersianDigits(st.midtermAttendance?.sick_days ?? 0)}</td>
          <td class="col-att">${toPersianDigits(st.midtermAttendance?.leave_days ?? 0)}</td>
        </tr>
        <tr class="student-row-annual">
          <td class="col-exam-title">سالانه</td>
          ${annualCells}
          <td class="col-calc">${toPersianDigits(st.finalEvaluation.totalScore - st.midtermEvaluation.totalScore)}</td>
          <td class="col-calc">—</td>
          <td class="col-status">—</td>
          <td class="col-grade">—</td>
          <td class="col-att">${toPersianDigits(st.annualAttendance?.total_instructional_days ?? 0)}</td>
          <td class="col-att">${toPersianDigits(st.annualAttendance?.present_days ?? 0)}</td>
          <td class="col-att">${toPersianDigits(st.annualAttendance?.absent_days ?? 0)}</td>
          <td class="col-att">${toPersianDigits(st.annualAttendance?.sick_days ?? 0)}</td>
          <td class="col-att">${toPersianDigits(st.annualAttendance?.leave_days ?? 0)}</td>
        </tr>
        <tr class="student-row-final">
          <td class="col-exam-title final-title">نمرات نهایی</td>
          ${finalCells}
          <td class="col-calc final-calc">${toPersianDigits(st.finalEvaluation.totalScore)}</td>
          <td class="col-calc final-calc">${toPersianDigits(st.finalEvaluation.averageScore)}</td>
          <td class="col-status final-status">${st.finalEvaluation.resultStatus}</td>
          <td class="col-grade final-grade">${st.finalEvaluation.gradeLetter}</td>
          <td class="col-att">${toPersianDigits(st.totalAttendance.totalDays)}</td>
          <td class="col-att">${toPersianDigits(st.totalAttendance.presentDays)}</td>
          <td class="col-att">${toPersianDigits(st.totalAttendance.absentDays)}</td>
          <td class="col-att">${toPersianDigits(st.totalAttendance.sickDays)}</td>
          <td class="col-att">${toPersianDigits(st.totalAttendance.leaveDays)}</td>
        </tr>
        <tr class="student-row-remarks">
          <td colspan="${displaySubjects.length + 10}" class="remarks-cell">
            <strong>ملاحظات:</strong> ${st.remarks ?? ''}
          </td>
        </tr>
      `);
    });

    return `
      <!DOCTYPE html>
      <html dir="rtl" lang="fa">
      <head>
        <meta charset="utf-8" />
        <title>جدول نتایج صنف ${section.full_name}</title>
        <style>
          @page {
            size: A4 landscape;
            margin: 6mm;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          body {
            font-family: 'B Nazanin', 'Vazirmatn', Tahoma, sans-serif;
            margin: 0;
            padding: 0;
            font-size: 9pt;
            direction: rtl;
          }
          .header-container {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 6px;
            border-bottom: 2px solid #000;
            padding-bottom: 4px;
          }
          .header-left, .header-center, .header-right {
            flex: 1;
          }
          .header-left {
            text-align: right;
            font-size: 8pt;
            line-height: 1.4;
          }
          .header-center {
            text-align: center;
          }
          .header-center h1 {
            font-size: 14pt;
            margin: 0 0 2px 0;
          }
          .header-center h2 {
            font-size: 11pt;
            margin: 0 0 2px 0;
          }
          .header-center h3 {
            font-size: 10pt;
            margin: 0;
          }
          .header-right {
            display: flex;
            justify-content: flex-end;
          }
          .summary-table {
            border-collapse: collapse;
            font-size: 7.5pt;
            text-align: center;
          }
          .summary-table th, .summary-table td {
            border: 1px solid #000;
            padding: 2px 4px;
          }
          .summary-table th {
            background-color: #E0E0E0;
          }
          table.tabulation-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 8pt;
            text-align: center;
          }
          table.tabulation-table th, table.tabulation-table td {
            border: 1px solid #000;
            padding: 2px;
          }
          thead {
            display: table-header-group;
          }
          tr {
            page-break-inside: avoid;
          }
          .col-num { width: 22px; }
          .col-name { width: 75px; text-align: right; padding-right: 4px; }
          .col-father { width: 65px; text-align: right; padding-right: 4px; }
          .col-gfather { width: 65px; text-align: right; padding-right: 4px; }
          .col-asas { width: 38px; }
          .col-tazkira { width: 45px; }
          .col-exam-title { width: 55px; font-weight: 700; background-color: #FAFAFA; }
          .mark-cell { width: 24px; font-size: 8.5pt; font-weight: 700; }
          .blank-cell { background-color: #F5F5F5; }
          .failed-mark { color: #C62828; font-weight: 900; }
          .col-calc { width: 34px; font-weight: 700; }
          .col-status { width: 45px; font-weight: 700; }
          .col-grade { width: 22px; font-weight: 700; }
          .col-att { width: 20px; font-size: 7.5pt; }
          .final-title { background-color: #E8F0FE; font-weight: 800; }
          .final-calc { background-color: #E8F0FE; }
          .final-status { background-color: #E8F0FE; }
          .final-grade { background-color: #E8F0FE; }
          .remarks-cell {
            text-align: right;
            padding: 2px 6px;
            font-size: 7.5pt;
            background-color: #FFFDE7;
          }
          .sig-row td {
            background-color: #F5F5F5;
            padding: 6px;
          }
          .sig-row-content {
            display: flex;
            justify-content: space-around;
            font-size: 8.5pt;
          }
          .master-footer {
            margin-top: 15px;
            display: flex;
            justify-content: space-between;
            font-size: 9pt;
            font-weight: 700;
            padding: 0 20px;
            page-break-inside: avoid;
          }
        </style>
      </head>
      <body>
        <!-- Header -->
        <div class="header-container">
          <div class="header-left">
            <div>${schoolProfile.province}</div>
            <div>${schoolProfile.district}</div>
            <div>${schoolProfile.school_name}</div>
            <div><strong>صنف:</strong> ${section.full_name}</div>
            <div><strong>سال تعلیمی:</strong> ${academicYear.name} مطابق سال (${toPersianDigits(academicYear.qamari_year ?? 1447)}) هـ ق</div>
          </div>

          <div class="header-center">
            <h1>${INSTITUTIONAL_DEFAULTS.COUNTRY}</h1>
            <h2>${INSTITUTIONAL_DEFAULTS.MINISTRY}</h2>
            <h3>جدول نتایج صنف (${section.full_name}) سال تعلیمی (${toPersianDigits(academicYear.shamsi_year)})</h3>
          </div>

          <div class="header-right">
            <table class="summary-table">
              <tr>
                <th>شماره</th>
                <th>خلص نتایج</th>
                <th>وسط سال</th>
                <th>سالانه</th>
              </tr>
              <tr><td>۱</td><td>تعداد داخله</td><td>${toPersianDigits(summaryCounters.enrolled)}</td><td>${toPersianDigits(summaryCounters.enrolled)}</td></tr>
              <tr><td>۲</td><td>شامل امتحان</td><td>${toPersianDigits(summaryCounters.midtermSat)}</td><td>${toPersianDigits(summaryCounters.annualSat)}</td></tr>
              <tr><td>۳</td><td>موفق/ارتقای صنف</td><td>${toPersianDigits(summaryCounters.midtermPassed)}</td><td>${toPersianDigits(summaryCounters.annualPassed)}</td></tr>
              <tr><td>۴</td><td>تلاش بیشتر/مشروط</td><td>${toPersianDigits(summaryCounters.midtermConditional)}</td><td>${toPersianDigits(summaryCounters.annualConditional)}</td></tr>
              <tr><td>۵</td><td>تکرارصنف</td><td>${toPersianDigits(summaryCounters.midtermFailed)}</td><td>${toPersianDigits(summaryCounters.annualFailed)}</td></tr>
              <tr><td>۶</td><td>معذرتی</td><td>${toPersianDigits(summaryCounters.midtermExcused)}</td><td>${toPersianDigits(summaryCounters.annualExcused)}</td></tr>
              <tr><td>۷</td><td>محروم</td><td>${toPersianDigits(summaryCounters.midtermBarred)}</td><td>${toPersianDigits(summaryCounters.annualBarred)}</td></tr>
              <tr><td>۸</td><td>نقل مکان</td><td>${toPersianDigits(summaryCounters.midtermTransferred)}</td><td>${toPersianDigits(summaryCounters.annualTransferred)}</td></tr>
            </table>
          </div>
        </div>

        <!-- Master Tabulation Table -->
        <table class="tabulation-table">
          <thead>
            <tr>
              <th rowspan="2" class="col-num">شماره</th>
              <th rowspan="2" class="col-name">اسم</th>
              <th rowspan="2" class="col-father">ولد</th>
              <th rowspan="2" class="col-gfather">ولدیت</th>
              <th rowspan="2" class="col-asas">نمبر اساس</th>
              <th rowspan="2" class="col-tazkira">نمبر تذکره</th>
              <th rowspan="2" class="col-exam-title">امتحانات</th>
              <th colspan="${displaySubjects.length}">مضامین درسی</th>
              <th rowspan="2" class="col-calc">مجموعه</th>
              <th rowspan="2" class="col-calc">فیصدی</th>
              <th rowspan="2" class="col-status">نتیجه</th>
              <th rowspan="2" class="col-grade">درجه</th>
              <th colspan="5">ضوابط حاضری</th>
            </tr>
            <tr>
              ${displaySubjects.map((s) => `<th class="mark-cell">${s.subject_name}</th>`).join('')}
              <th class="col-att">ایام</th>
              <th class="col-att">حاضر</th>
              <th class="col-att">غائب</th>
              <th class="col-att">مریض</th>
              <th class="col-att">رخصت</th>
            </tr>
          </thead>
          <tbody>
            ${studentsHtmlRows.join('')}
          </tbody>
        </table>

        <!-- Master 3-Tier Footer -->
        <div class="master-footer">
          <div>${OFFICIAL_SIGNATURE_TITLES.PRINCIPAL}: ........................................</div>
          <div>${OFFICIAL_SIGNATURE_TITLES.SUPERVISION_OFFICER}: ........................................</div>
          <div>${OFFICIAL_SIGNATURE_TITLES.DISTRICT_DIRECTORATE}: ........................................</div>
        </div>
      </body>
      </html>
    `;
  },

  /**
   * Generates the complete HTML string for the Student Report Card (اطلاعنامه).
   */
  generateReportCardsHtml(bundle: TabulationDataBundle, singleStudentId?: string): string {
    const { schoolProfile, academicYear, section, subjects, studentsData } = bundle;
    const activeSubjects = subjects.filter((s) => s.is_active_in_grade === 1);

    const filteredStudents = singleStudentId
      ? studentsData.filter((s) => s.enrollmentId === singleStudentId)
      : studentsData;

    const cardsHtml = filteredStudents
      .map((st) => {
        const subjectRows = activeSubjects
          .map((sub, sIdx) => {
            const mVal = st.midtermMarks[sub.id];
            const aVal = st.annualMarks[sub.id];
            const fVal = st.finalMarks[sub.id];

            return `
              <tr>
                <td>${toPersianDigits(sIdx + 1)}</td>
                <td style="text-align: right; padding-right: 6px;">${sub.subject_name}</td>
                <td>${toPersianDigits(40)}</td>
                <td>${mVal !== null ? toPersianDigits(mVal) : '—'}</td>
                <td>${toPersianDigits(60)}</td>
                <td>${aVal !== null ? toPersianDigits(aVal) : '—'}</td>
                <td>${toPersianDigits(100)}</td>
                <td style="font-weight: 700; ${fVal !== null && fVal < 40 ? 'color: red;' : ''}">
                  ${fVal !== null ? toPersianDigits(fVal) : '—'}
                </td>
              </tr>
            `;
          })
          .join('');

        return `
          <div class="report-card-page">
            <div class="report-card-container">
              <!-- Header -->
              <div class="rc-header">
                <div class="rc-school-info">
                  <div>${schoolProfile.province}</div>
                  <div>${schoolProfile.district}</div>
                  <div class="rc-school-name">${schoolProfile.school_name}</div>
                </div>

                <div class="rc-title-box">
                  <div class="rc-title">اطلاعنامه سالانه</div>
                  <div class="rc-year">سال تعلیمی ${academicYear.name}</div>
                </div>

                <div class="rc-motto-box">
                  <div class="rc-motto">${schoolProfile.report_card_motto}</div>
                </div>
              </div>

              <!-- Student Particulars -->
              <div class="rc-student-grid">
                <div><strong>نام متعلم:</strong> ${st.firstName}</div>
                <div><strong>نام پدر:</strong> ${st.fatherName}</div>
                <div><strong>نام پدرکلان:</strong> ${st.grandfatherName}</div>
                <div><strong>نمبر اساس:</strong> ${toPersianDigits(st.asasNumber)}</div>
                <div><strong>صنف:</strong> ${section.full_name}</div>
                <div><strong>شماره حاضری:</strong> ${toPersianDigits(st.rollNumber ?? '—')}</div>
              </div>

              <!-- Marks Table -->
              <table class="rc-table">
                <thead>
                  <tr>
                    <th rowspan="2">شماره</th>
                    <th rowspan="2">مضمون</th>
                    <th colspan="2">وسط سال</th>
                    <th colspan="2">سالانه</th>
                    <th colspan="2">نمره نهایی</th>
                  </tr>
                  <tr>
                    <th>اعظمی</th>
                    <th>اخذ شده</th>
                    <th>اعظمی</th>
                    <th>اخذ شده</th>
                    <th>اعظمی</th>
                    <th>اخذ شده</th>
                  </tr>
                </thead>
                <tbody>
                  ${subjectRows}
                  <!-- Totals Row -->
                  <tr class="rc-total-row">
                    <td colspan="2">مجموع نمرات</td>
                    <td>${toPersianDigits(activeSubjects.length * 40)}</td>
                    <td>${toPersianDigits(st.midtermEvaluation.totalScore)}</td>
                    <td>${toPersianDigits(activeSubjects.length * 60)}</td>
                    <td>${toPersianDigits(st.finalEvaluation.totalScore - st.midtermEvaluation.totalScore)}</td>
                    <td>${toPersianDigits(activeSubjects.length * 100)}</td>
                    <td>${toPersianDigits(st.finalEvaluation.totalScore)}</td>
                  </tr>
                  <tr class="rc-total-row">
                    <td colspan="2">فیصدی / اوسط نمرات</td>
                    <td colspan="2">${toPersianDigits(st.midtermEvaluation.averageScore)}٪</td>
                    <td colspan="2">—</td>
                    <td colspan="2">${toPersianDigits(st.finalEvaluation.averageScore)}٪</td>
                  </tr>
                  <tr class="rc-total-row">
                    <td colspan="2">نتیجه و درجه نهایی</td>
                    <td colspan="2">${st.midtermEvaluation.resultStatus} (${st.midtermEvaluation.gradeLetter})</td>
                    <td colspan="2">—</td>
                    <td colspan="2" style="font-weight: 800; font-size: 11pt;">${st.finalEvaluation.resultStatus} (${st.finalEvaluation.gradeLetter})</td>
                  </tr>
                </tbody>
              </table>

              <!-- Attendance Table -->
              <div class="rc-att-section">
                <div class="rc-section-title">ضوابط حاضری</div>
                <table class="rc-att-table">
                  <tr>
                    <th>دوره</th>
                    <th>ایام درسی</th>
                    <th>حاضر</th>
                    <th>غیرحاضر</th>
                    <th>مریض</th>
                    <th>رخصت</th>
                  </tr>
                  <tr>
                    <td>وسط سال</td>
                    <td>${toPersianDigits(st.midtermAttendance?.total_instructional_days ?? 0)}</td>
                    <td>${toPersianDigits(st.midtermAttendance?.present_days ?? 0)}</td>
                    <td>${toPersianDigits(st.midtermAttendance?.absent_days ?? 0)}</td>
                    <td>${toPersianDigits(st.midtermAttendance?.sick_days ?? 0)}</td>
                    <td>${toPersianDigits(st.midtermAttendance?.leave_days ?? 0)}</td>
                  </tr>
                  <tr>
                    <td>سالانه</td>
                    <td>${toPersianDigits(st.annualAttendance?.total_instructional_days ?? 0)}</td>
                    <td>${toPersianDigits(st.annualAttendance?.present_days ?? 0)}</td>
                    <td>${toPersianDigits(st.annualAttendance?.absent_days ?? 0)}</td>
                    <td>${toPersianDigits(st.annualAttendance?.sick_days ?? 0)}</td>
                    <td>${toPersianDigits(st.annualAttendance?.leave_days ?? 0)}</td>
                  </tr>
                  <tr style="font-weight: 700; background-color: #FAFAFA;">
                    <td>مجموعه</td>
                    <td>${toPersianDigits(st.totalAttendance.totalDays)}</td>
                    <td>${toPersianDigits(st.totalAttendance.presentDays)}</td>
                    <td>${toPersianDigits(st.totalAttendance.absentDays)}</td>
                    <td>${toPersianDigits(st.totalAttendance.sickDays)}</td>
                    <td>${toPersianDigits(st.totalAttendance.leaveDays)}</td>
                  </tr>
                </table>
              </div>

              <!-- Remarks Box -->
              <div class="rc-remarks-box">
                <strong>${INSTITUTIONAL_DEFAULTS.ADMIN_REMARKS_TITLE}:</strong>
                <span>${st.remarks ?? 'نظم و دسپلین نامبرده در طول سال تعلیمی قناعت‌بخش بوده است.'}</span>
              </div>

              <!-- Signatures Row -->
              <div class="rc-signatures">
                <div>${schoolProfile.sig_class_supervisor_title}: ....................</div>
                <div>${schoolProfile.sig_headmaster_title}: ....................</div>
                <div>${schoolProfile.sig_principal_title}: ....................</div>
                <div>${schoolProfile.sig_parent_title}: ....................</div>
              </div>
            </div>
          </div>
        `;
      })
      .join('');

    return `
      <!DOCTYPE html>
      <html dir="rtl" lang="fa">
      <head>
        <meta charset="utf-8" />
        <title>اطلاعنامه‌های صنف ${section.full_name}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 8mm;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          body {
            font-family: 'B Nazanin', 'Vazirmatn', Tahoma, sans-serif;
            margin: 0;
            padding: 0;
            direction: rtl;
          }
          .report-card-page {
            page-break-after: always;
            padding-bottom: 10px;
          }
          .report-card-container {
            border: 2px solid #000;
            padding: 10px;
            border-radius: 6px;
          }
          .rc-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #000;
            padding-bottom: 6px;
            margin-bottom: 8px;
          }
          .rc-school-info {
            font-size: 8.5pt;
            line-height: 1.3;
          }
          .rc-school-name {
            font-size: 11pt;
            font-weight: 800;
          }
          .rc-title-box {
            text-align: center;
          }
          .rc-title {
            font-size: 15pt;
            font-weight: 900;
          }
          .rc-year {
            font-size: 10pt;
            font-weight: 700;
          }
          .rc-motto-box {
            max-width: 200px;
            text-align: left;
            font-size: 8pt;
            font-style: italic;
          }
          .rc-student-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 6px;
            font-size: 9.5pt;
            background-color: #F9F9F9;
            padding: 6px 10px;
            border: 1px solid #CCC;
            margin-bottom: 8px;
          }
          table.rc-table {
            width: 100%;
            border-collapse: collapse;
            text-align: center;
            font-size: 8.5pt;
            margin-bottom: 8px;
          }
          table.rc-table th, table.rc-table td {
            border: 1px solid #000;
            padding: 2.5px;
          }
          table.rc-table th {
            background-color: #EEEEEE;
          }
          .rc-total-row td {
            font-weight: 700;
            background-color: #F5F5F5;
          }
          .rc-att-section {
            margin-bottom: 8px;
          }
          .rc-section-title {
            font-weight: 700;
            font-size: 9pt;
            margin-bottom: 3px;
          }
          table.rc-att-table {
            width: 100%;
            border-collapse: collapse;
            text-align: center;
            font-size: 8pt;
          }
          table.rc-att-table th, table.rc-att-table td {
            border: 1px solid #000;
            padding: 2px 4px;
          }
          table.rc-att-table th {
            background-color: #EEEEEE;
          }
          .rc-remarks-box {
            border: 1px solid #999;
            padding: 6px;
            font-size: 8.5pt;
            margin-bottom: 12px;
            background-color: #FFFDE7;
          }
          .rc-signatures {
            display: flex;
            justify-content: space-between;
            font-size: 8.5pt;
            font-weight: 700;
            padding: 0 10px;
          }
        </style>
      </head>
      <body>
        ${cardsHtml}
      </body>
      </html>
    `;
  },

  /**
   * Directly sends the Landscape A4 Tabulation Sheet to the Android Print Spooler.
   */
  async printTabulationSheetAsync(sectionId: string, academicYearId: string): Promise<void> {
    const bundle = await this.buildSectionTabulationDataAsync(sectionId, academicYearId);
    const html = this.generateTabulationSheetHtml(bundle);

    await Print.printAsync({
      html,
      orientation: 'landscape',
    });
  },

  /**
   * Directly sends the Portrait A4 Student Report Cards to the Android Print Spooler.
   */
  async printReportCardsAsync(sectionId: string, academicYearId: string, singleStudentId?: string): Promise<void> {
    const bundle = await this.buildSectionTabulationDataAsync(sectionId, academicYearId);
    const html = this.generateReportCardsHtml(bundle, singleStudentId);

    await Print.printAsync({
      html,
      orientation: 'portrait',
    });
  },

  /**
   * Generates a portable PDF file for the Tabulation Sheet and opens native share sheet.
   */
  async shareTabulationPdfAsync(sectionId: string, academicYearId: string): Promise<string> {
    const bundle = await this.buildSectionTabulationDataAsync(sectionId, academicYearId);
    const html = this.generateTabulationSheetHtml(bundle);

    const { uri } = await Print.printToFileAsync({
      html,
      width: 842, // A4 landscape width points (11.69 inches * 72)
      height: 595, // A4 landscape height points (8.27 inches * 72)
    });

    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `چاپ جدول نتایج ${bundle.section.full_name}`,
      });
    }

    return uri;
  },

  /**
   * Generates a portable PDF file for the Student Report Cards and opens native share sheet.
   */
  async shareReportCardsPdfAsync(sectionId: string, academicYearId: string, singleStudentId?: string): Promise<string> {
    const bundle = await this.buildSectionTabulationDataAsync(sectionId, academicYearId);
    const html = this.generateReportCardsHtml(bundle, singleStudentId);

    const { uri } = await Print.printToFileAsync({
      html,
      width: 595, // A4 portrait width points (8.27 inches * 72)
      height: 842, // A4 portrait height points (11.69 inches * 72)
    });

    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `اطلاعنامه‌های ${bundle.section.full_name}`,
      });
    }

    return uri;
  },
};
