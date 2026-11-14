/**
 * Mars School Manager - Canonical Afghan MoE Defaults & Constants
 * Source: Ministry of Education (وزارت معارف) official results sheet structure
 * Verified from workbook: جدول نتایج سافت اکسل1404-1.xlsx
 */

export const WORKBOOK_SHEETS = {
  STUDENT_LIST: "لیست",
  MIDTERM_MARKS: "نمرات وسط سال",
  ANNUAL_MARKS: "نمرات سالانه",
  COMBINED_TOTALS: "مجموع",
  REPORT_CARD: "اطلاعنامه",
  TABULATION_SHEET: "جدول نتایج",
} as const;

export type WorkbookSheetName =
  (typeof WORKBOOK_SHEETS)[keyof typeof WORKBOOK_SHEETS];

export const STUDENT_IDENTITY_LABELS = {
  ROW_NUMBER: "شماره",
  SUPER_HEADER: "شهرت",
  FIRST_NAME: "اسم",
  FATHER_NAME: "ولد",
  GRANDFATHER_NAME: "ولدیت",
  ASAS_NUMBER: "نمبر اساس",
  TAZKIRA_NUMBER: "نمبر تذکره",
} as const;

export interface CanonicalSubjectDefinition {
  code: string;
  name: string;
  defaultSortOrder: number;
  templateColumnIndex: number;
}

/**
 * Exact 15 canonical subjects from workbook Columns F through T
 */
export const CANONICAL_SUBJECTS: readonly CanonicalSubjectDefinition[] = [
  {
    code: "QURAN",
    name: "قرآنکریم",
    defaultSortOrder: 1,
    templateColumnIndex: 1,
  },
  {
    code: "ISLAMIC_STUDIES",
    name: "تعلیمات اسلامی",
    defaultSortOrder: 2,
    templateColumnIndex: 2,
  },
  { code: "DARI", name: "دری", defaultSortOrder: 3, templateColumnIndex: 3 },
  { code: "PASHTO", name: "پشتو", defaultSortOrder: 4, templateColumnIndex: 4 },
  { code: "ARABIC", name: "عربی", defaultSortOrder: 5, templateColumnIndex: 5 },
  {
    code: "ENGLISH",
    name: "انگلیسی",
    defaultSortOrder: 6,
    templateColumnIndex: 6,
  },
  {
    code: "MATHEMATICS",
    name: "ریاضی",
    defaultSortOrder: 7,
    templateColumnIndex: 7,
  },
  {
    code: "PHYSICS",
    name: "فزیک",
    defaultSortOrder: 8,
    templateColumnIndex: 8,
  },
  {
    code: "CHEMISTRY",
    name: "کیمیا",
    defaultSortOrder: 9,
    templateColumnIndex: 9,
  },
  {
    code: "BIOLOGY",
    name: "بیولوژی",
    defaultSortOrder: 10,
    templateColumnIndex: 10,
  },
  {
    code: "HISTORY",
    name: "تاریخ",
    defaultSortOrder: 11,
    templateColumnIndex: 11,
  },
  {
    code: "GEOGRAPHY",
    name: "جغرافیه",
    defaultSortOrder: 12,
    templateColumnIndex: 12,
  },
  {
    code: "VOCATIONAL",
    name: "حرفه",
    defaultSortOrder: 13,
    templateColumnIndex: 13,
  },
  {
    code: "PHYSICAL_EDUCATION",
    name: "تربیت بدنی",
    defaultSortOrder: 14,
    templateColumnIndex: 14,
  },
  {
    code: "CONDUCT",
    name: "تهذیب",
    defaultSortOrder: 15,
    templateColumnIndex: 15,
  },
] as const;

export interface CanonicalGradeDefinition {
  codeLevel: number;
  name: string;
  cycle: "PRIMARY" | "LOWER_SECONDARY" | "UPPER_SECONDARY";
  sortOrder: number;
}

/**
 * Standard Afghanistan school grades (1 through 12)
 */
export const CANONICAL_GRADES: readonly CanonicalGradeDefinition[] = [
  { codeLevel: 1, name: "صنف اول", cycle: "PRIMARY", sortOrder: 1 },
  { codeLevel: 2, name: "صنف دوم", cycle: "PRIMARY", sortOrder: 2 },
  { codeLevel: 3, name: "صنف سوم", cycle: "PRIMARY", sortOrder: 3 },
  { codeLevel: 4, name: "صنف چهارم", cycle: "PRIMARY", sortOrder: 4 },
  { codeLevel: 5, name: "صنف پنجم", cycle: "PRIMARY", sortOrder: 5 },
  { codeLevel: 6, name: "صنف ششم", cycle: "PRIMARY", sortOrder: 6 },
  { codeLevel: 7, name: "صنف هفتم", cycle: "LOWER_SECONDARY", sortOrder: 7 },
  { codeLevel: 8, name: "صنف هشتم", cycle: "LOWER_SECONDARY", sortOrder: 8 },
  { codeLevel: 9, name: "صنف نهم", cycle: "LOWER_SECONDARY", sortOrder: 9 },
  { codeLevel: 10, name: "صنف دهم", cycle: "UPPER_SECONDARY", sortOrder: 10 },
  {
    codeLevel: 11,
    name: "صنف یازدهم",
    cycle: "UPPER_SECONDARY",
    sortOrder: 11,
  },
  {
    codeLevel: 12,
    name: "صنف دوازدهم",
    cycle: "UPPER_SECONDARY",
    sortOrder: 12,
  },
] as const;

export const MIDTERM_RESULT_STATUSES = {
  PASSED: "موفق",
  NEEDS_IMPROVEMENT: "تلاش بیشتر",
  EXCUSED: "معذرتی",
  BARRED: "محروم",
  TRANSFERRED: "نقل مکان",
} as const;

export type MidtermResultStatus =
  (typeof MIDTERM_RESULT_STATUSES)[keyof typeof MIDTERM_RESULT_STATUSES];

export const FINAL_RESULT_STATUSES = {
  PROMOTED: "ارتقای صنف",
  CONDITIONAL: "مشروط",
  REPEAT_GRADE: "تکرارصنف",
  EXCUSED: "معذرتی",
  BARRED: "محروم",
  TRANSFERRED: "نقل مکان",
} as const;

export type FinalResultStatus =
  (typeof FINAL_RESULT_STATUSES)[keyof typeof FINAL_RESULT_STATUSES];

export const GRADE_LETTERS = {
  ALEF: "الف",
  BE: "ب",
  JIM: "ج",
  DAL: "د",
  HE: "هـ",
} as const;

export type GradeLetter = (typeof GRADE_LETTERS)[keyof typeof GRADE_LETTERS];

export const ATTENDANCE_LABELS = {
  TOTAL_DAYS: "ایام سال تعلیمی",
  PRESENT: "حاضر",
  ABSENT: "غیرحاضر",
  SICK: "مریض",
  LEAVE: "رخصت",
} as const;

export const OFFICIAL_SIGNATURE_TITLES = {
  CLASS_SUPERVISOR: "تائید نگران صنف",
  HEADMASTER: "امضاء سرمعلم",
  PRINCIPAL: "تائیدومهرآمر لیسه",
  ACADEMIC_MEMBER: "تائید عضو علمی انکشاف مسلکی",
  DISTRICT_DIRECTOR: "تائید آمریت معارف شهر",
  SUPERVISION_OFFICER: "تأییدی عضونظارت مربوطه",
  DISTRICT_DIRECTORATE: "تأییدی آمریت حوزه تعلیمی/ولسوالی",
  PARENT: "امضاء ولی شاگرد",
} as const;

export const INSTITUTIONAL_DEFAULTS = {
  COUNTRY: "امارت اسلامی افغانستان",
  MINISTRY: "وزارت معارف",
  PROVINCE: "ریاست معارف ولایت هرات",
  DISTRICT: "آمریت عمومی معارف شهر",
  SCHOOL_NAME: "لیسه پسرانه سید محمد قناد",
  REPORT_CARD_MOTTO:
    "دانش چوگوهریست که عمرش بود بها / باید گران خــــرید که ارزان نمی شود",
  ADMIN_REMARKS_TITLE: "نظریه اداره مکتب",
  ACTIVE_SHAMSI_YEAR: 1404,
  ACTIVE_QAMARI_YEAR: 1447,
  ACTIVE_YEAR_NAME: "1404 هـ ش",
} as const;

export const DEFAULT_GRADING_RULES = {
  MIDTERM_MAX_MARK: 40.0,
  MIDTERM_PASS_MARK: 16.0,
  ANNUAL_MAX_MARK: 60.0,
  ANNUAL_PASS_MARK: 24.0,
  COMBINED_MAX_MARK: 100.0,
  COMBINED_PASS_MARK: 40.0,
  MASHROOT_MIN_FAILED_SUBJECTS: 1,
  MASHROOT_MAX_FAILED_SUBJECTS: 3,
  NAKAM_MIN_FAILED_SUBJECTS: 4,
  MIDTERM_ALEF_MIN: 36.0,
  MIDTERM_BE_MIN: 30.0,
  MIDTERM_JIM_MIN: 24.0,
  MIDTERM_DAL_MIN: 20.0,
  FINAL_ALEF_MIN: 90.0,
  FINAL_BE_MIN: 75.0,
  FINAL_JIM_MIN: 60.0,
  FINAL_DAL_MIN: 50.0,
  FORCE_HE_ON_FAILED: 1,
} as const;
