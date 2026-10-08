import type { LucideIcon } from 'lucide-react';
import type { ComponentProps } from 'react';

import { Field, FieldLabel } from '@/components/ui/field';
import { FieldAlert } from '@/components/ui/field-alert';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';

/**
 * A filled field with an icon and the label as placeholder (the label stays
 * for screen readers). An error shows as a small bubble underneath (FieldAlert).
 */
export function TextField({
  id,
  label,
  icon: Icon,
  error,
  ...input
}: {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Already translated. */
  error?: string | null;
} & Omit<ComponentProps<typeof InputGroupInput>, 'id' | 'placeholder'>) {
  return (
    <Field data-invalid={Boolean(error)} className="relative">
      <FieldLabel htmlFor={id} className="sr-only">
        {label}
      </FieldLabel>
      <InputGroup>
        <InputGroupAddon>
          <Icon />
        </InputGroupAddon>
        <InputGroupInput
          {...input}
          id={id}
          placeholder={label}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
        />
      </InputGroup>
      <FieldAlert id={`${id}-error`}>{error}</FieldAlert>
    </Field>
  );
}
