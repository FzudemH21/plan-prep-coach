/**
 * New password + repeat, with the rule shown as a small checklist while typing (lib/passwordPolicy).
 */
import { useTranslation } from 'react-i18next';
import { Check, Circle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { passwordRules } from '@/lib/passwordPolicy';

export function NewPasswordFields({ password, repeat, onPassword, onRepeat, idPrefix = 'new-password' }: {
  password: string;
  repeat: string;
  onPassword: (v: string) => void;
  onRepeat: (v: string) => void;
  idPrefix?: string;
}) {
  const { t } = useTranslation();
  const rules = passwordRules(password);
  const Rule = ({ ok, label }: { ok: boolean; label: string }) => (
    <li className={cn('flex items-center gap-1.5 text-xs', ok ? 'text-emerald-600' : 'text-muted-foreground')}>
      {ok ? <Check className="h-3 w-3" /> : <Circle className="h-2.5 w-2.5" />}{label}
    </li>
  );
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-1`}>{t('auth.pw.new')}</Label>
        <Input id={`${idPrefix}-1`} type="password" autoComplete="new-password" value={password}
          onChange={(e) => onPassword(e.target.value)} required />
        <ul className="flex flex-wrap gap-x-4 gap-y-1 pt-0.5">
          <Rule ok={rules.length} label={t('auth.pw.ruleLength')} />
          <Rule ok={rules.mix} label={t('auth.pw.ruleMix')} />
        </ul>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-2`}>{t('auth.pw.repeat')}</Label>
        <Input id={`${idPrefix}-2`} type="password" autoComplete="new-password" value={repeat}
          onChange={(e) => onRepeat(e.target.value)} required />
      </div>
    </div>
  );
}
