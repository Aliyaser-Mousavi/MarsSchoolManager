/**
 * Mars School Manager - Domain Schemas & Numeral Normalization Utilities
 */

import {
  FINAL_RESULT_STATUSES,
  GRADE_LETTERS,
  MIDTERM_RESULT_STATUSES,
} from "@/constants/canonical-defaults";
import { z } from "zod";

const PERSIAN_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
const ARABIC_INDIC_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

/**
 * Converts Persian (۰-۹) and Arabic-Indic (٠-٩) numeral characters to standard ASCII digits (0-9).
 * Also replaces Arabic/Persian decimal points with a standard dot.
 */
export function toEnglishDigits(
  input: string | number | null | undefined,
): string {
  if (input === null || input === undefined) return "";
  let str = String(input).trim();
  for (let i = 0; i < 10; i++) {
    str = str.replace(new RegExp(PERSIAN_DIGITS[i], "g"), String(i));
    str = str.replace(new RegExp(ARABIC_INDIC_DIGITS[i], "g"), String(i));
  }
  // Replace Persian momayyez (٫) or Arabic comma with ASCII dot
  str = str.replace(/[٫،]/g, ".");
  return str;
}

/**
 * Formats an ASCII number or string into Dari/Persian digits (۰-۹).
 */
export function toPersianDigits(
  input: number | string | null | undefined,
): string {
  if (input === null || input === undefined) return "";
  const str = String(input);
  return str.replace(
    /[0-9]/g,
    (digit) => PERSIAN_DIGITS[parseInt(digit, 10)] ?? digit,
  );
}

/**
 * Safely parses any Persian or English numerical string into a JavaScript number.
 * Returns null if the value is empty, null, undefined, or invalid.
 */
export function parsePersianNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    return isNaN(value) ? null : value;
  }
  const normalized = toEnglishDigits(String(value));
  if (normalized === "") return null;
  const num = Number(normalized);
  return isNaN(num) ? null : num;
}

export const StudentInputSchema = z.object({
  asas_number: z
    .string()
    .min(1, 'نمبر اساس الزامی است')
    .transform((val) => toEnglishDigits(val).trim()),
  first_name: z.string().min(1, 'نام متعلم الزامی است').trim(),
  father_name: z.string().min(1, 'نام پدر الزامی است').trim(),
  grandfather_name: z.string().min(1, 'نام پدرکلان الزامی است').trim(),
  tazkira_id: z
    .string()
    .optional()
    .nullable()
    .default(null)
    .transform((val) => (val ? toEnglishDigits(val).trim() : null)),
  birth_year: z
    .union([z.number(), z.string()])
    .optional()
    .nullable()
    .default(null)
    .transform((val) => (val ? parsePersianNumber(val) : null)),
  gender: z.enum(['M', 'F']).optional().nullable().default(null),
  photo_uri: z.string().optional().nullable().default(null),
  enrollment_year_id: z.string().optional().nullable().default(null),
});

export type StudentInput = z.input<typeof StudentInputSchema>;
export type StudentOutput = z.output<typeof StudentInputSchema>;

export const MarkInputSchema = z.object({
  enrollment_id: z.string().min(1),
  exam_subject_config_id: z.string().min(1),
  mark_value: z
    .union([z.number(), z.string(), z.null(), z.undefined()])
    .transform((val) => {
      if (val === null || val === undefined || val === "") return null;
      return parsePersianNumber(val);
    })
    .refine((val) => val === null || (val >= 0 && val <= 100), {
      message: "نمره باید بین ۰ و ۱۰۰ باشد",
    }),
  status: z.enum(["ENTERED", "ABSENT", "EXEMPT"]).default("ENTERED"),
  entered_by_user_id: z.string().min(1),
});

export type MarkInput = z.input<typeof MarkInputSchema>;

export const AttendanceInputSchema = z
  .object({
    enrollment_id: z.string().min(1),
    exam_period_id: z.string().min(1),
    total_instructional_days: z
      .union([z.number(), z.string()])
      .transform((val) => parsePersianNumber(val) ?? 0)
      .refine((val) => val >= 0, "روزهای تعلیمی نمی‌تواند منفی باشد"),
    present_days: z
      .union([z.number(), z.string()])
      .transform((val) => parsePersianNumber(val) ?? 0)
      .refine((val) => val >= 0, "روزهای حاضر نمی‌تواند منفی باشد"),
    absent_days: z
      .union([z.number(), z.string()])
      .transform((val) => parsePersianNumber(val) ?? 0)
      .refine((val) => val >= 0, "روزهای غیرحاضر نمی‌تواند منفی باشد"),
    sick_days: z
      .union([z.number(), z.string()])
      .transform((val) => parsePersianNumber(val) ?? 0)
      .refine((val) => val >= 0, "روزهای مریض نمی‌تواند منفی باشد"),
    leave_days: z
      .union([z.number(), z.string()])
      .transform((val) => parsePersianNumber(val) ?? 0)
      .refine((val) => val >= 0, "روزهای رخصت نمی‌تواند منفی باشد"),
    recorded_by_user_id: z.string().min(1),
  })
  .refine((data) => data.present_days <= data.total_instructional_days, {
    message: "تعداد روزهای حاضر نمی‌تواند از مجموع روزهای تعلیمی بیشتر باشد",
    path: ["present_days"],
  });

export type AttendanceInput = z.input<typeof AttendanceInputSchema>;

export const GradingRuleInputSchema = z.object({
  academic_year_id: z.string().min(1),
  grade_id: z.string().optional().nullable(),
  midterm_max_mark: z.number().positive().default(40.0),
  midterm_pass_mark: z.number().positive().default(16.0),
  annual_max_mark: z.number().positive().default(60.0),
  annual_pass_mark: z.number().positive().default(24.0),
  combined_max_mark: z.number().positive().default(100.0),
  combined_pass_mark: z.number().positive().default(40.0),
  mashroot_min_failed_subjects: z.number().int().nonnegative().default(1),
  mashroot_max_failed_subjects: z.number().int().positive().default(3),
  nakam_min_failed_subjects: z.number().int().positive().default(4),
  midterm_grade_alef_min: z.number().default(36.0),
  midterm_grade_be_min: z.number().default(30.0),
  midterm_grade_jim_min: z.number().default(24.0),
  midterm_grade_dal_min: z.number().default(20.0),
  final_grade_alef_min: z.number().default(90.0),
  final_grade_be_min: z.number().default(75.0),
  final_grade_jim_min: z.number().default(60.0),
  final_grade_dal_min: z.number().default(50.0),
  force_grade_he_on_any_failed_subject: z
    .number()
    .int()
    .min(0)
    .max(1)
    .default(1),
  mahroom_max_absent_days: z.number().int().optional().nullable(),
  mahroom_max_absent_percentage: z.number().optional().nullable(),
});

export type GradingRuleInput = z.input<typeof GradingRuleInputSchema>;

export const SchoolProfileInputSchema = z.object({
  school_name: z.string().min(1, "نام مکتب الزامی است").trim(),
  province: z.string().min(1, "نام ولایت الزامی است").trim(),
  district: z.string().min(1, "نام ولسوالی/حوزه تعلیمی الزامی است").trim(),
  village_area: z.string().optional().nullable(),
  established_year: z.number().int().optional().nullable(),
  principal_name: z.string().optional().nullable(),
  ministry_registration_code: z.string().optional().nullable(),
  logo_uri: z.string().optional().nullable(),
  report_card_motto: z.string().min(1),
  sig_class_supervisor_title: z.string().min(1),
  sig_headmaster_title: z.string().min(1),
  sig_principal_title: z.string().min(1),
  sig_academic_member_title: z.string().min(1),
  sig_district_director_title: z.string().min(1),
  sig_supervision_officer_title: z.string().min(1),
  sig_parent_title: z.string().min(1),
});

export type SchoolProfileInput = z.input<typeof SchoolProfileInputSchema>;

export const MidtermStatusEnum = z.enum([
  MIDTERM_RESULT_STATUSES.PASSED,
  MIDTERM_RESULT_STATUSES.NEEDS_IMPROVEMENT,
  MIDTERM_RESULT_STATUSES.EXCUSED,
  MIDTERM_RESULT_STATUSES.BARRED,
  MIDTERM_RESULT_STATUSES.TRANSFERRED,
]);

export const FinalStatusEnum = z.enum([
  FINAL_RESULT_STATUSES.PROMOTED,
  FINAL_RESULT_STATUSES.CONDITIONAL,
  FINAL_RESULT_STATUSES.REPEAT_GRADE,
  FINAL_RESULT_STATUSES.EXCUSED,
  FINAL_RESULT_STATUSES.BARRED,
  FINAL_RESULT_STATUSES.TRANSFERRED,
]);

export const GradeLetterEnum = z.enum([
  GRADE_LETTERS.ALEF,
  GRADE_LETTERS.BE,
  GRADE_LETTERS.JIM,
  GRADE_LETTERS.DAL,
  GRADE_LETTERS.HE,
]);
