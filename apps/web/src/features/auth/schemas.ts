import { emailSchema, logInSchema, passwordSchema, signUpSchema } from '@sarrif/core';
import { type CountryCode, parsePhoneNumberFromString } from 'libphonenumber-js';
import { z } from 'zod';

// The auth forms' own shapes. The rules come from @sarrif/core (the same ones
// the server applies, with the same messages); only the phone differs: the
// form has a country and a number, which become one E.164 phone on submit.

export interface PhoneInput {
  country: CountryCode;
  number: string;
}

/** "+254712345678", or null when the number isn't valid for that country. */
export function toE164({ country, number }: PhoneInput): string | null {
  const parsed = parsePhoneNumberFromString(number, country);
  return parsed?.isValid() ? parsed.number : null;
}

export const phoneInput = z
  .object({ country: z.custom<CountryCode>((value) => typeof value === 'string'), number: z.string() })
  .superRefine((value, ctx) => {
    if (!value.number.trim()) ctx.addIssue({ code: 'custom', message: 'validation.phoneRequired' });
    else if (!toE164(value)) ctx.addIssue({ code: 'custom', message: 'validation.phone' });
  });

/** An empty field says what's missing; a filled one gets core's rule (too short, too long). */
const required = (key: string) => z.string().trim().min(1, key);
const email = required('validation.emailRequired').pipe(emailSchema);
/** Never trimmed: spaces count in a password. */
const newPassword = z.string().min(1, 'validation.passwordRequired').pipe(passwordSchema);
// A checkbox starts unticked, so the form holds a boolean; core's rule is "must be true".
const acceptTerms = z.boolean().refine((value) => value, 'validation.terms');

export const signUpFormSchema = z.object({
  firstName: required('validation.firstNameRequired').pipe(signUpSchema.shape.firstName),
  email,
  password: newPassword,
  phone: phoneInput,
  acceptTerms,
});

export const logInFormSchema = z.object({ email, password: logInSchema.shape.password });

export const emailFormSchema = z.object({ email });

export const newPasswordFormSchema = z.object({ password: newPassword });

export const completeProfileFormSchema = z.object({ phone: phoneInput, acceptTerms });

export type SignUpFormInput = z.input<typeof signUpFormSchema>;
export type SignUpFormValues = z.output<typeof signUpFormSchema>;
export type LogInFormValues = z.output<typeof logInFormSchema>;
export type EmailFormValues = z.output<typeof emailFormSchema>;
export type NewPasswordFormValues = z.output<typeof newPasswordFormSchema>;
export type CompleteProfileFormInput = z.input<typeof completeProfileFormSchema>;
export type CompleteProfileFormValues = z.output<typeof completeProfileFormSchema>;
