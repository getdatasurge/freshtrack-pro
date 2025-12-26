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
