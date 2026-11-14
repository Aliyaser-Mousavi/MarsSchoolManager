/**
 * Mars School Manager - Official 6-Sheet Excel Generator (.xlsx)
 * Generates Ministry-compliant 6-sheet workbooks with active-subject formula isolation.
 */

import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { reportService, TabulationDataBundle } from './reportService';
import { CANONICAL_SUBJECTS, WORKBOOK_SHEETS, INSTITUTIONAL_DEFAULTS } from '@/constants/canonical-defaults';
import { toPersianDigits } from '@/domain/schemas';

// Helper to convert 0-indexed column number to Excel column letters (0 -> A, 25 -> Z, 26 -> AA)
function colToLetter(colIndex: number): string {
  let temp = colIndex;
  let letter = '';
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

export const excelExportService = {
  /**
   * Builds and exports the official 6-sheet workbook matching Ministry specifications.
   */
  async exportOfficial6SheetWorkbookAsync(sectionId: string, academicYearId: string): Promise<string> {
    const bundle = await reportService.buildSectionTabulationDataAsync(sectionId, academicYearId);
    const wb = XLSX.utils.book_new();

    // 1. Build Sheet 1: لیست (Student Base Directory)
    const ws1 = this.buildSheet1StudentList(bundle);
    XLSX.utils.book_append_sheet(wb, ws1, WORKBOOK_SHEETS.STUDENT_LIST);

    // 2. Build Sheet 2: نمرات وسط سال (Midterm Marks - 29 Columns)
    const ws2 = this.buildSheet2Midterm(bundle);
    XLSX.utils.book_append_sheet(wb, ws2, WORKBOOK_SHEETS.MIDTERM_MARKS);

    // 3. Build Sheet 3: نمرات سالانه (Annual Marks - 27 Columns)
    const ws3 = this.buildSheet3Annual(bundle);
    XLSX.utils.book_append_sheet(wb, ws3, WORKBOOK_SHEETS.ANNUAL_MARKS);

    // 4. Build Sheet 4: مجموع (Combined Totals & Promotion Rules)
    const ws4 = this.buildSheet4Combined(bundle);
    XLSX.utils.book_append_sheet(wb, ws4, WORKBOOK_SHEETS.COMBINED_TOTALS);

    // 5. Build Sheet 5: اطلاعنامه (Student Report Cards)
    const ws5 = this.buildSheet5ReportCards(bundle);
    XLSX.utils.book_append_sheet(wb, ws5, WORKBOOK_SHEETS.REPORT_CARD);

    // 6. Build Sheet 6: جدول نتایج (Official Master Class Tabulation Sheet)
    const ws6 = this.buildSheet6Tabulation(bundle);
    XLSX.utils.book_append_sheet(wb, ws6, WORKBOOK_SHEETS.TABULATION_SHEET);

    // Convert workbook to base64 binary string
    const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

    const fileName = `mars_results_${bundle.section.grade_name}_${bundle.section.name}_${Date.now()}.xlsx`;
    const docDir = FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? '';
    const filePath = `${docDir}${fileName}`;

    await FileSystem.writeAsStringAsync(filePath, wbout, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(filePath, {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: `صدور فایل اکسل جدول نتایج ${bundle.section.full_name}`,
        UTI: 'com.microsoft.excel.xlsx',
      });
    }

    return filePath;
  },

  /**
   * Sheet 1: لیست
   */
  buildSheet1StudentList(bundle: TabulationDataBundle): XLSX.WorkSheet {
    const wsData: unknown[][] = [
      [`صنف (${bundle.section.full_name})`],
      ['شماره', 'شـــــــــــــــهرت', null, null, 'نمبراساس', 'نمبر تذکره'],
      [null, 'اسم', 'ولد', 'ولديت', null, null],
    ];

    bundle.studentsData.forEach((st, idx) => {
      wsData.push([
        idx + 1,
        st.firstName,
        st.fatherName,
        st.grandfatherName,
        st.asasNumber,
        st.tazkiraId ?? '',
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }, // A1:F1
      { s: { r: 1, c: 0 }, e: { r: 2, c: 0 } }, // A2:A3 شماره
      { s: { r: 1, c: 1 }, e: { r: 1, c: 3 } }, // B2:D2 شهرت
      { s: { r: 1, c: 4 }, e: { r: 2, c: 4 } }, // E2:E3 اساس
      { s: { r: 1, c: 5 }, e: { r: 2, c: 5 } }, // F2:F3 تذکره
    ];

    return ws;
  },

  /**
   * Sheet 2: نمرات وسط سال
   */
  buildSheet2Midterm(bundle: TabulationDataBundle): XLSX.WorkSheet {
    const wsData: unknown[][] = [];

    // Row 1: Merged title
    const row1: unknown[] = new Array(29).fill(null);
    row1[5] = 'نمرات وسط سال';
    wsData.push(row1);

    // Row 2: Sequential numbers 1..15 for subjects
    const row2: unknown[] = new Array(29).fill(null);
    for (let i = 0; i < 15; i++) {
      row2[5 + i] = i + 1;
    }
    wsData.push(row2);

    // Row 3: Headers
    const row3: unknown[] = [
      'شماره',
      'اسم',
      'ولد',
      'ولدیت',
      'نمبراساس',
      ...CANONICAL_SUBJECTS.map((s) => s.name),
      'مجموعه',
      'اوسط نمرات',
      'نتیجه',
      'درجه',
      'سال تعلیمی',
      'حاضر',
      'غیرحاضر',
      'مریض',
      'رخصت',
    ];
    wsData.push(row3);

    // Identify active subject column letters for dynamic formula generation
    const activeSubjectColLetters: string[] = [];
    CANONICAL_SUBJECTS.forEach((canSub, cIdx) => {
      const match = bundle.subjects.find((s) => s.subject_code === canSub.code);
      if (match && match.is_active_in_grade === 1) {
        activeSubjectColLetters.push(colToLetter(5 + cIdx));
      }
    });

    bundle.studentsData.forEach((st, sIdx) => {
      const rNum = sIdx + 4; // 1-indexed row number in Excel
      const row: unknown[] = [
        sIdx + 1,
        st.firstName,
        st.fatherName,
        st.grandfatherName,
        st.asasNumber,
      ];

      // 15 Canonical subject marks
      CANONICAL_SUBJECTS.forEach((canSub) => {
        const match = bundle.subjects.find((s) => s.subject_code === canSub.code);
        if (match && match.is_active_in_grade === 1) {
          const val = st.midtermMarks[match.id];
          row.push(val !== null ? val : 0);
        } else {
          row.push(null); // Inactive subject left blank
        }
      });

      // Formulas
      const sumFormula = `SUM(F${rNum}:T${rNum})`;
      const avgFormula =
        activeSubjectColLetters.length > 0
          ? `AVERAGE(${activeSubjectColLetters.map((l) => `${l}${rNum}`).join(',')})`
          : `AVERAGE(F${rNum}:T${rNum})`;

      const resultFormula = `IF(COUNTIF(F${rNum}:T${rNum},"<16")>=1,"تلاش بیشتر",IF(V${rNum}>=16,"موفق","تلاش بیشتر"))`;
      const gradeFormula = `IF(COUNTIF(F${rNum}:T${rNum},"<16")>=1,"هـ",IF(V${rNum}>=36,"الف",IF(V${rNum}>=30,"ب",IF(V${rNum}>=24,"ج",IF(V${rNum}>=20,"د","هـ")))))`;
      const presentFormula = `Y${rNum}-(AC${rNum}+AB${rNum}+AA${rNum})`;

      row.push(
        { f: sumFormula, v: st.midtermEvaluation.totalScore },
        { f: avgFormula, v: st.midtermEvaluation.averageScore },
        { f: resultFormula, v: st.midtermEvaluation.resultStatus },
        { f: gradeFormula, v: st.midtermEvaluation.gradeLetter },
        st.midtermAttendance?.total_instructional_days ?? 0,
        { f: presentFormula, v: st.midtermAttendance?.present_days ?? 0 },
        st.midtermAttendance?.absent_days ?? 0,
        st.midtermAttendance?.sick_days ?? 0,
        st.midtermAttendance?.leave_days ?? 0
      );

      wsData.push(row);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    return ws;
  },

  /**
   * Sheet 3: نمرات سالانه
   */
  buildSheet3Annual(bundle: TabulationDataBundle): XLSX.WorkSheet {
    const wsData: unknown[][] = [];

    // Row 1: Merged title
    const row1: unknown[] = new Array(27).fill(null);
    row1[5] = 'نمرات سالانه';
    wsData.push(row1);

    // Row 2: Numbers 1..15
    const row2: unknown[] = new Array(27).fill(null);
    for (let i = 0; i < 15; i++) {
      row2[5 + i] = i + 1;
    }
    wsData.push(row2);

    // Row 3: Headers
    const row3: unknown[] = [
      'شماره',
      'اسم',
      'ولد',
      'ولدیت',
      'نمبراساس',
      ...CANONICAL_SUBJECTS.map((s) => s.name),
      'مجموعه',
      'اوسط نمرات',
      'سال تعلیمی',
      'حاضر',
      'غیرحاضر',
      'مریض',
      'رخصت',
    ];
    wsData.push(row3);

    const activeSubjectColLetters: string[] = [];
    CANONICAL_SUBJECTS.forEach((canSub, cIdx) => {
      const match = bundle.subjects.find((s) => s.subject_code === canSub.code);
      if (match && match.is_active_in_grade === 1) {
        activeSubjectColLetters.push(colToLetter(5 + cIdx));
      }
    });

    bundle.studentsData.forEach((st, sIdx) => {
      const rNum = sIdx + 4;
      const row: unknown[] = [
        sIdx + 1,
        st.firstName,
        st.fatherName,
        st.grandfatherName,
        st.asasNumber,
      ];

      CANONICAL_SUBJECTS.forEach((canSub) => {
        const match = bundle.subjects.find((s) => s.subject_code === canSub.code);
        if (match && match.is_active_in_grade === 1) {
          const val = st.annualMarks[match.id];
          row.push(val !== null ? val : 0);
        } else {
          row.push(null);
        }
      });

      const sumFormula = `SUM(F${rNum}:T${rNum})`;
      const avgFormula =
        activeSubjectColLetters.length > 0
          ? `AVERAGE(${activeSubjectColLetters.map((l) => `${l}${rNum}`).join(',')})`
          : `AVERAGE(F${rNum}:T${rNum})`;

      const annualTotalScore = st.finalEvaluation.totalScore - st.midtermEvaluation.totalScore;

      row.push(
        { f: sumFormula, v: annualTotalScore },
        { f: avgFormula, v: Number((annualTotalScore / Math.max(1, activeSubjectColLetters.length)).toFixed(2)) },
        st.annualAttendance?.total_instructional_days ?? 0,
        st.annualAttendance?.present_days ?? 0,
        st.annualAttendance?.absent_days ?? 0,
        st.annualAttendance?.sick_days ?? 0,
        st.annualAttendance?.leave_days ?? 0
      );

      wsData.push(row);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    return ws;
  },

  /**
   * Sheet 4: مجموع (Combined)
   */
  buildSheet4Combined(bundle: TabulationDataBundle): XLSX.WorkSheet {
    const wsData: unknown[][] = [];

    // Row 1: Merged Title
    const row1: unknown[] = new Array(29).fill(null);
    row1[5] = `نتیجه نهایی صنف (${bundle.section.full_name}) سال ${bundle.academicYear.shamsi_year}`;
    row1[20] = 'نگران: ';
    wsData.push(row1);

    // Row 2: Subject index numbers
    const row2: unknown[] = new Array(29).fill(null);
    for (let i = 0; i < 15; i++) {
      row2[5 + i] = i + 1;
    }
    wsData.push(row2);

    // Row 3: Headers
    const row3: unknown[] = [
      'شماره',
      'اسم',
      'ولد',
      'ولدیت',
      'نمبراساس',
      ...CANONICAL_SUBJECTS.map((s) => s.name),
      'مجموعه',
      'اوسط نمرات',
      'نتیجه',
      'درجه',
      'سال تعلیمی',
      'حاضر',
      'غیرحاضر',
      'مریض',
      'رخصت',
    ];
    wsData.push(row3);

    const activeSubjectColLetters: string[] = [];
    CANONICAL_SUBJECTS.forEach((canSub, cIdx) => {
      const match = bundle.subjects.find((s) => s.subject_code === canSub.code);
      if (match && match.is_active_in_grade === 1) {
        activeSubjectColLetters.push(colToLetter(5 + cIdx));
      }
    });

    bundle.studentsData.forEach((st, sIdx) => {
      const rNum = sIdx + 4;
      const row: unknown[] = [
        sIdx + 1,
        { f: `'${WORKBOOK_SHEETS.STUDENT_LIST}'!B${rNum}`, v: st.firstName },
        { f: `'${WORKBOOK_SHEETS.STUDENT_LIST}'!C${rNum}`, v: st.fatherName },
        { f: `'${WORKBOOK_SHEETS.STUDENT_LIST}'!D${rNum}`, v: st.grandfatherName },
        { f: `'${WORKBOOK_SHEETS.STUDENT_LIST}'!E${rNum}`, v: st.asasNumber },
      ];

      // 15 Subject Totals: Midterm + Annual
      CANONICAL_SUBJECTS.forEach((canSub, cIdx) => {
        const colLet = colToLetter(5 + cIdx);
        const match = bundle.subjects.find((s) => s.subject_code === canSub.code);
        if (match && match.is_active_in_grade === 1) {
          const finalVal = st.finalMarks[match.id];
          row.push({
            f: `'${WORKBOOK_SHEETS.MIDTERM_MARKS}'!${colLet}${rNum}+'${WORKBOOK_SHEETS.ANNUAL_MARKS}'!${colLet}${rNum}`,
            v: finalVal ?? 0,
          });
        } else {
          row.push(null);
        }
      });

      // Formulas for combined total, average, result, grade
      const sumFormula = `SUM(F${rNum}:T${rNum})`;
      const avgFormula =
        activeSubjectColLetters.length > 0
          ? `AVERAGE(${activeSubjectColLetters.map((l) => `${l}${rNum}`).join(',')})`
          : `AVERAGE(F${rNum}:T${rNum})`;

      const resultFormula = `IF(COUNTIF(F${rNum}:T${rNum},"<40")>3,"تکرارصنف",IF(COUNTIF(F${rNum}:T${rNum},"<40")>=1,"مشروط",IF(V${rNum}>=40,"ارتقای صنف","تکرارصنف")))`;
      const gradeFormula = `IF(COUNTIF(F${rNum}:T${rNum},"<40"),"هـ",IF(V${rNum}>=90,"الف",IF(V${rNum}>=75,"ب",IF(V${rNum}>=60,"ج",IF(V${rNum}>=50,"د","هـ")))))`;

      row.push(
        { f: sumFormula, v: st.finalEvaluation.totalScore },
        { f: avgFormula, v: st.finalEvaluation.averageScore },
        { f: resultFormula, v: st.finalEvaluation.resultStatus },
        { f: gradeFormula, v: st.finalEvaluation.gradeLetter },
        { f: `'${WORKBOOK_SHEETS.ANNUAL_MARKS}'!W${rNum}`, v: st.annualAttendance?.total_instructional_days ?? 0 },
        { f: `'${WORKBOOK_SHEETS.ANNUAL_MARKS}'!X${rNum}`, v: st.annualAttendance?.present_days ?? 0 },
        { f: `'${WORKBOOK_SHEETS.ANNUAL_MARKS}'!Y${rNum}`, v: st.annualAttendance?.absent_days ?? 0 },
        { f: `'${WORKBOOK_SHEETS.ANNUAL_MARKS}'!Z${rNum}`, v: st.annualAttendance?.sick_days ?? 0 },
        { f: `'${WORKBOOK_SHEETS.ANNUAL_MARKS}'!AA${rNum}`, v: st.annualAttendance?.leave_days ?? 0 }
      );

      wsData.push(row);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    return ws;
  },

  /**
   * Sheet 5: اطلاعنامه (Horizontal blocks across columns)
   */
  buildSheet5ReportCards(bundle: TabulationDataBundle): XLSX.WorkSheet {
    const wsData: unknown[][] = [];
    for (let r = 0; r < 14; r++) {
      wsData.push([]);
    }

    // For each student, populate a 31-column horizontal block
    bundle.studentsData.slice(0, 10).forEach((st, sIdx) => {
      const colOffset = sIdx * 31;

      wsData[1][colOffset + 0] = bundle.schoolProfile.province;
      wsData[1][colOffset + 1] = bundle.schoolProfile.district;
      wsData[1][colOffset + 2] = bundle.schoolProfile.school_name;
      wsData[1][colOffset + 3] = `اطلاعنامه سالانه سال تعلیمی ${bundle.academicYear.name}`;
      wsData[1][colOffset + 4] = 'صنف';
      wsData[1][colOffset + 5] = bundle.section.full_name;

      wsData[3][colOffset + 4] = 'ولدیت';
      wsData[3][colOffset + 5] = st.grandfatherName;

      wsData[6][colOffset + 4] = 'نام پدر';
      wsData[6][colOffset + 5] = st.fatherName;

      wsData[8][colOffset + 4] = 'نام';
      wsData[8][colOffset + 5] = st.firstName;

      // Attendance headers
      wsData[4][colOffset + 7] = 'ضوابط حاضری';
      wsData[4][colOffset + 9] = 'حاضر';
      wsData[4][colOffset + 10] = 'غیرحاضر';
      wsData[4][colOffset + 11] = 'مریض';
      wsData[4][colOffset + 12] = 'رخصت';
      wsData[4][colOffset + 13] = 'ایام سال تعلیمی';

      // Midterm Attendance
      wsData[3][colOffset + 7] = 'وسط سال';
      wsData[3][colOffset + 9] = st.midtermAttendance?.present_days ?? 0;
      wsData[3][colOffset + 10] = st.midtermAttendance?.absent_days ?? 0;
      wsData[3][colOffset + 11] = st.midtermAttendance?.sick_days ?? 0;
      wsData[3][colOffset + 12] = st.midtermAttendance?.leave_days ?? 0;
      wsData[3][colOffset + 13] = st.midtermAttendance?.total_instructional_days ?? 0;

      // Annual Attendance
      wsData[2][colOffset + 7] = 'سالانه';
      wsData[2][colOffset + 9] = st.annualAttendance?.present_days ?? 0;
      wsData[2][colOffset + 10] = st.annualAttendance?.absent_days ?? 0;
      wsData[2][colOffset + 11] = st.annualAttendance?.sick_days ?? 0;
      wsData[2][colOffset + 12] = st.annualAttendance?.leave_days ?? 0;
      wsData[2][colOffset + 13] = st.annualAttendance?.total_instructional_days ?? 0;

      // Total Attendance
      wsData[1][colOffset + 7] = 'مجموعه';
      wsData[1][colOffset + 9] = st.totalAttendance.presentDays;
      wsData[1][colOffset + 10] = st.totalAttendance.absentDays;
      wsData[1][colOffset + 11] = st.totalAttendance.sickDays;
      wsData[1][colOffset + 12] = st.totalAttendance.leaveDays;
      wsData[1][colOffset + 13] = st.totalAttendance.totalDays;

      // 15 Subjects
      wsData[9][colOffset + 7] = 'مضامین';
      CANONICAL_SUBJECTS.forEach((sub, cIdx) => {
        wsData[9][colOffset + 9 + cIdx] = sub.name;
        wsData[10][colOffset + 9 + cIdx] = cIdx + 1;

        const match = bundle.subjects.find((s) => s.subject_code === sub.code);
        const mVal = match ? st.midtermMarks[match.id] : null;
        const aVal = match ? st.annualMarks[match.id] : null;
        const fVal = match ? st.finalMarks[match.id] : null;

        wsData[8][colOffset + 9 + cIdx] = mVal ?? 0; // وسط سال
        wsData[7][colOffset + 9 + cIdx] = aVal ?? 0; // سالانه
        wsData[6][colOffset + 9 + cIdx] = fVal ?? 0; // مجموعه
      });

      // Totals
      wsData[9][colOffset + 25] = 'مجموعه';
      wsData[9][colOffset + 26] = 'نتیجه';
      wsData[9][colOffset + 27] = 'درجه';
      wsData[9][colOffset + 28] = 'فیصدی';

      wsData[6][colOffset + 25] = st.finalEvaluation.totalScore;
      wsData[6][colOffset + 26] = st.finalEvaluation.resultStatus;
      wsData[6][colOffset + 27] = st.finalEvaluation.gradeLetter;
      wsData[6][colOffset + 28] = st.finalEvaluation.averageScore;

      // Signatures
      wsData[1][colOffset + 30] =
        'امضاء نگران:-               امضاء سرمعلم:-                 امضاء آمرمکتب:-              امضاء ولی شاگرد:-';
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    return ws;
  },

  /**
   * Sheet 6: جدول نتایج
   */
  buildSheet6Tabulation(bundle: TabulationDataBundle): XLSX.WorkSheet {
    const wsData: unknown[][] = [];

    // Header block
    wsData.push([
      bundle.schoolProfile.province,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      INSTITUTIONAL_DEFAULTS.COUNTRY,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      'شماره',
      'خلص نتایج',
      null,
      'وسط سال',
      null,
      'سالانه',
    ]);
    wsData.push([
      bundle.schoolProfile.district,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      INSTITUTIONAL_DEFAULTS.MINISTRY,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      1,
      'تعداد داخله',
      null,
      bundle.summaryCounters.enrolled,
      null,
      bundle.summaryCounters.enrolled,
    ]);
    wsData.push([
      bundle.schoolProfile.school_name,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      bundle.schoolProfile.school_name,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      2,
      'شامل امتحان',
      null,
      bundle.summaryCounters.midtermSat,
      null,
      bundle.summaryCounters.annualSat,
    ]);
    wsData.push([
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      3,
      'موفق/ارتقای صنف',
      null,
      bundle.summaryCounters.midtermPassed,
      null,
      bundle.summaryCounters.annualPassed,
    ]);
    wsData.push([
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      4,
      'تلاش بیشتر/مشروط',
      null,
      bundle.summaryCounters.midtermConditional,
      null,
      bundle.summaryCounters.annualConditional,
    ]);
    wsData.push([
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      5,
      'تکرارصنف',
      null,
      bundle.summaryCounters.midtermFailed,
      null,
      bundle.summaryCounters.annualFailed,
    ]);
    wsData.push([
      null,
      `جدول نتایج صنف (${bundle.section.full_name}) سال تعلیمی (${toPersianDigits(bundle.academicYear.shamsi_year)})`,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      6,
      'معذرتی',
      null,
      bundle.summaryCounters.midtermExcused,
      null,
      bundle.summaryCounters.annualExcused,
    ]);
    wsData.push([
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      7,
      'محروم',
      null,
      bundle.summaryCounters.midtermBarred,
      null,
      bundle.summaryCounters.annualBarred,
    ]);
    wsData.push([
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      8,
      'نقل مکان',
      null,
      bundle.summaryCounters.midtermTransferred,
      null,
      bundle.summaryCounters.annualTransferred,
    ]);

    // Table Header
    wsData.push([
      'شماره',
      'شماره',
      'اسم',
      'ولد',
      'ولدیت',
      'نمبر اساس',
      'نمبر تذکره',
      'امتحانات',
      ...CANONICAL_SUBJECTS.map((s) => s.name),
      'مجموعه',
      'فیصدی نمرات',
      'نتیجه',
      'درجه',
      'روزهای تعلیمی',
      'حاضر',
      'غیر حاضر',
      'مریض',
      'رخصت',
    ]);

    // Students 4-row blocks
    bundle.studentsData.forEach((st, sIdx) => {
      // Periodic signature row every 5 students
      if (sIdx > 0 && sIdx % 5 === 0) {
        wsData.push([
          null,
          'تائید نگران صنف:                                تائیدومهرآمر لیسه:                                تائید عضو علمی انکشاف مسلکی:                                تائید آمریت معارف شهر:',
        ]);
      }

      const midtermMarks = CANONICAL_SUBJECTS.map((canSub) => {
        const match = bundle.subjects.find((s) => s.subject_code === canSub.code);
        return match && match.is_active_in_grade === 1 ? st.midtermMarks[match.id] ?? 0 : null;
      });

      const annualMarks = CANONICAL_SUBJECTS.map((canSub) => {
        const match = bundle.subjects.find((s) => s.subject_code === canSub.code);
        return match && match.is_active_in_grade === 1 ? st.annualMarks[match.id] ?? 0 : null;
      });

      const finalMarks = CANONICAL_SUBJECTS.map((canSub) => {
        const match = bundle.subjects.find((s) => s.subject_code === canSub.code);
        return match && match.is_active_in_grade === 1 ? st.finalMarks[match.id] ?? 0 : null;
      });

      // Row 1: وسط سال
      wsData.push([
        null,
        sIdx + 1,
        st.firstName,
        st.fatherName,
        st.grandfatherName,
        st.asasNumber,
        st.tazkiraId ?? '',
        'وسط سال',
        ...midtermMarks,
        st.midtermEvaluation.totalScore,
        st.midtermEvaluation.averageScore,
        st.midtermEvaluation.resultStatus,
        st.midtermEvaluation.gradeLetter,
        st.midtermAttendance?.total_instructional_days ?? 0,
        st.midtermAttendance?.present_days ?? 0,
        st.midtermAttendance?.absent_days ?? 0,
        st.midtermAttendance?.sick_days ?? 0,
        st.midtermAttendance?.leave_days ?? 0,
      ]);

      // Row 2: سالانه
      wsData.push([
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        'سالانه',
        ...annualMarks,
        st.finalEvaluation.totalScore - st.midtermEvaluation.totalScore,
        '—',
        '—',
        '—',
        st.annualAttendance?.total_instructional_days ?? 0,
        st.annualAttendance?.present_days ?? 0,
        st.annualAttendance?.absent_days ?? 0,
        st.annualAttendance?.sick_days ?? 0,
        st.annualAttendance?.leave_days ?? 0,
      ]);

      // Row 3: نمرات نهایی
      wsData.push([
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        'نمرات نهایی',
        ...finalMarks,
        st.finalEvaluation.totalScore,
        st.finalEvaluation.averageScore,
        st.finalEvaluation.resultStatus,
        st.finalEvaluation.gradeLetter,
        st.totalAttendance.totalDays,
        st.totalAttendance.presentDays,
        st.totalAttendance.absentDays,
        st.totalAttendance.sickDays,
        st.totalAttendance.leaveDays,
      ]);

      // Row 4: ملاحظات
      wsData.push([
        null,
        'ملاحظات:',
        st.remarks ?? '',
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    return ws;
  },
};
