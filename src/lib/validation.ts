import { z } from "zod";

// ============================================
// Shared Input Validation Schemas
// These schemas provide consistent validation across the application
// ============================================

// Organization validation
export const organizationNameSchema = z.string()
  .trim()
  .min(1, "Organization name is required")
  .max(100, "Organization name must be less than 100 characters");

export const organizationSlugSchema = z.string()
  .trim()
  .min(1, "Slug is required")
  .max(50, "Slug must be less than 50 characters")
  .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens");

// Site validation
export const siteNameSchema = z.string()
  .trim()
  .min(1, "Site name is required")
  .max(100, "Site name must be less than 100 characters");

export const addressSchema = z.string()
  .trim()
  .max(200, "Address must be less than 200 characters")
  .optional()
  .or(z.literal(""));

export const citySchema = z.string()
  .trim()
  .max(100, "City must be less than 100 characters")
  .optional()
  .or(z.literal(""));

export const stateSchema = z.string()
  .trim()
  .max(50, "State must be less than 50 characters")
  .optional()
  .or(z.literal(""));

export const postalCodeSchema = z.string()
  .trim()
  .max(20, "Postal code must be less than 20 characters")
  .optional()
  .or(z.literal(""));

// Area validation
export const areaNameSchema = z.string()
  .trim()
  .min(1, "Area name is required")
  .max(100, "Area name must be less than 100 characters");

export const areaDescriptionSchema = z.string()
  .trim()
  .max(500, "Description must be less than 500 characters")
  .optional()
  .or(z.literal(""));

// Unit validation
export const unitNameSchema = z.string()
  .trim()
  .min(1, "Unit name is required")
  .max(100, "Unit name must be less than 100 characters");

// Temperature validation - reasonable range for refrigeration (-100°F to 200°F)
export const temperatureSchema = z.number()
  .min(-100, "Temperature cannot be below -100°F")
  .max(200, "Temperature cannot exceed 200°F");

export const temperatureStringSchema = z.string()
  .trim()
  .min(1, "Temperature is required")
  .refine((val) => !isNaN(parseFloat(val)), "Invalid temperature value")
  .transform((val) => parseFloat(val))
  .pipe(temperatureSchema);

// Notes validation
export const notesSchema = z.string()
  .trim()
  .max(500, "Notes must be less than 500 characters")
  .optional()
  .or(z.literal(""));

// Text description validation (for corrective actions, etc.)
export const descriptionSchema = z.string()
  .trim()
  .min(1, "Description is required")
  .max(2000, "Description must be less than 2000 characters");

// Generic text field validation
export const genericTextSchema = (maxLength: number = 500) => z.string()
  .trim()
  .max(maxLength, `Text must be less than ${maxLength} characters`);

// ============================================
// Validation Helper Functions
// ============================================

export type ValidationResult<T> = { success: true; data: T } | { success: false; error: string };

export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): ValidationResult<T> {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error.errors[0]?.message || "Invalid input" };
}

// Helper to get error message from validation result
export function getValidationError<T>(result: ValidationResult<T>): string | null {
  if (result.success) return null;
  return (result as { success: false; error: string }).error;
}

// Sanitize string for safe display (basic XSS prevention)
export function sanitizeString(input: string): string {
  return input
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

// ============================================
// Sensor Downlink Configuration Validation
// ============================================

/** Uplink interval: 60s (1 min) to 86400s (24h) */
export const uplinkIntervalSecondsSchema = z.number()
  .int("Interval must be a whole number")
  .min(60, "Minimum interval is 60 seconds (1 minute)")
  .max(86400, "Maximum interval is 86,400 seconds (24 hours)");

/** Uplink interval entered as minutes string from form input */
export const uplinkIntervalMinutesSchema = z.string()
  .trim()
  .min(1, "Interval is required")
  .refine((v) => !isNaN(parseFloat(v)), "Must be a number")
  .transform((v) => parseFloat(v))
  .pipe(z.number()
    .min(1, "Minimum interval is 1 minute")
    .max(1440, "Maximum interval is 1,440 minutes (24 hours)")
  );

/** Alarm temperature in °F: -40 to 150 */
export const alarmTempFSchema = z.number()
  .min(-40, "Temperature cannot be below -40°F")
  .max(150, "Temperature cannot exceed 150°F");

/** Alarm temperature entered as string from form input */
export const alarmTempStringSchema = z.string()
  .trim()
  .min(1, "Temperature is required")
  .refine((v) => !isNaN(parseFloat(v)), "Invalid temperature")
  .transform((v) => parseFloat(v))
  .pipe(alarmTempFSchema);

/** Alarm check interval: 1–65535 minutes */
export const alarmCheckMinutesSchema = z.string()
  .trim()
  .min(1, "Check interval is required")
  .refine((v) => !isNaN(parseInt(v)), "Must be a number")
  .transform((v) => parseInt(v))
  .pipe(z.number()
    .int("Must be a whole number")
    .min(1, "Minimum is 1 minute")
    .max(65535, "Maximum is 65,535 minutes")
  );

/** Time sync days: 1–30 */
export const timeSyncDaysSchema = z.string()
  .trim()
  .min(1, "Days is required")
  .refine((v) => !isNaN(parseInt(v)), "Must be a number")
  .transform((v) => parseInt(v))
  .pipe(z.number()
    .int("Must be a whole number")
    .min(1, "Minimum is 1 day")
    .max(30, "Maximum is 30 days")
  );

/** Full alarm form validation (validates high > low + 1°F gap) */
export const alarmFormSchema = z.object({
  enabled: z.boolean(),
  lowF: alarmTempStringSchema,
  highF: alarmTempStringSchema,
  checkMinutes: alarmCheckMinutesSchema,
}).refine(
  (data) => data.highF > data.lowF + 1,
  { message: "High must be at least 1°F above Low", path: ["highF"] }
);
