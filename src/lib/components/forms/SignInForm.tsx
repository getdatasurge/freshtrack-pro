import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { typography, text as textTokens } from '@/lib/design-system/tokens';
import { InputGroup, StyledInput } from './InputGroup';
import { Button } from '../elements/Button';

export interface SignInFormProps extends React.FormHTMLAttributes<HTMLFormElement> {
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  title?: string;
  description?: string;
  loading?: boolean;
  error?: string;
  footer?: React.ReactNode;
}

export const SignInForm = React.forwardRef<HTMLFormElement, SignInFormProps>(
  ({ className, onSubmit, title = 'Sign in', description, loading, error, footer, ...props }, ref) => {
    return (
      <div className="w-full max-w-sm mx-auto">
        <div className="text-center mb-6">
          <h1 className={typography.h2}>{title}</h1>
          {description && <p className={cn('mt-1', typography.body)}>{description}</p>}
        </div>
        <form ref={ref} onSubmit={onSubmit} className={cn('space-y-4', className)} {...props}>
          <InputGroup label="Email" htmlFor="email">
            <StyledInput id="email" name="email" type="email" placeholder="you@example.com" required autoComplete="email" />
          </InputGroup>
          <InputGroup label="Password" htmlFor="password">
            <StyledInput id="password" name="password" type="password" placeholder="Enter your password" required autoComplete="current-password" />
          </InputGroup>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button type="submit" variant="primary" loading={loading} className="w-full">
            Sign in
          </Button>
        </form>
        {footer && <div className={cn('mt-4 text-center text-sm', textTokens.tertiary)}>{footer}</div>}
      </div>
    );
  },
);
SignInForm.displayName = 'SignInForm';
