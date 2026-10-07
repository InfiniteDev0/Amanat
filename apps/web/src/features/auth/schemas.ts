import { signUpSchema } from '@sarrif/core';
import { type CountryCode, parsePhoneNumberFromString } from 'libphonenumber-js';
import { z } from 'zod';

// The auth forms' own shapes. The rules come from @sarrif/core's signUpSchema
// (same messages as the server); only the phone differs: the form has a
// country and a number, which become one E.164 phone on submit.

export interface PhoneInput {
  country: CountryCode;
  number: string;
}

/** "+254712345678", or null when the number isn't valid for that country. */
export function toE164({ country, number }: PhoneInput): string | null {
  const parsed = parsePhoneNumberFromString(number, country);
  return parsed?.isValid() ? parsed.number : null;
}

const phoneInput = z
  .object({ country: z.custom<CountryCode>((value) => typeof value === 'string'), number: z.string() })
  .superRefine((value, ctx) => {
    if (!value.number.trim()) ctx.addIssue({ code: 'custom', message: 'validation.phoneRequired' });
    else if (!toE164(value)) ctx.addIssue({ code: 'custom', message: 'validation.phone' });
  });

/** An empty field says what's missing; a filled one gets core's rule (too short, too long). */
const required = (key: string) => z.string().trim().min(1, key);

export const signUpFormSchema = z.object({
  firstName: required('validation.firstNameRequired').pipe(signUpSchema.shape.firstName),
  email: required('validation.emailRequired').pipe(signUpSchema.shape.email),
  phone: phoneInput,
  currencies: signUpSchema.shape.currencies,
  // A checkbox starts unticked, so the form holds a boolean; core's rule is "must be true".
  acceptTerms: z.boolean().refine((value) => value, 'validation.terms'),
});

export const logInFormSchema = z.object({ phone: phoneInput });

export type SignUpFormInput = z.input<typeof signUpFormSchema>;
export type SignUpFormValues = z.output<typeof signUpFormSchema>;
export type LogInFormValues = z.output<typeof logInFormSchema>;
