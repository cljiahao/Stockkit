'use client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FORM_ERROR_CLASS, FORM_LABEL_CLASS } from '@/lib/utils';
export function PasswordFields({
  password,
  confirm,
  onPasswordChange,
  onConfirmChange,
  error,
  inputClassName,
}: {
  password: string;
  confirm: string;
  onPasswordChange: (value: string) => void;
  onConfirmChange: (value: string) => void;
  error: string | null;
  inputClassName?: string;
}) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="new-password" className={FORM_LABEL_CLASS}>
          New password
        </Label>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          value={password}
          className={inputClassName}
          onChange={(e) => onPasswordChange(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm-password" className={FORM_LABEL_CLASS}>
          Confirm new password
        </Label>
        <Input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          value={confirm}
          className={inputClassName}
          onChange={(e) => onConfirmChange(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? 'confirm-password-error' : undefined}
        />
        {error && (
          <p role="alert" id="confirm-password-error" className={FORM_ERROR_CLASS}>
            {error}
          </p>
        )}
      </div>
    </>
  );
}
