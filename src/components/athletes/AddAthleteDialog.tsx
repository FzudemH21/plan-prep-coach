import { useEffect, useState } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SportTagInput } from './SportTagInput';
import {
  ACTIVITY_LEVEL_LABELS,
  Athlete,
  BillingAddress,
  DailyActivityLevel,
  EMPTY_BILLING_ADDRESS,
  SEX_LABELS,
  Sex,
  normalizeBillingAddress,
} from '@/types/athlete';

export type NewAthleteData = Omit<Athlete, 'id' | 'createdAt' | 'updatedAt'>;

interface AddAthleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Group the athlete is added to (when created via a group's "+" button). */
  groupId?: string | null;
  onSubmit: (data: NewAthleteData, continueWithAnamnesis: boolean) => Promise<void>;
}

interface FormState {
  firstName: string;
  middleName: string;
  lastName: string;
  birthday: string;
  sex: Sex | '';
  sports: string[];
  team: string;
  occupation: string;
  dailyActivityLevel: DailyActivityLevel | '';
  billingAddress: BillingAddress;
}

const EMPTY_FORM: FormState = {
  firstName: '',
  middleName: '',
  lastName: '',
  birthday: '',
  sex: '',
  sports: [],
  team: '',
  occupation: '',
  dailyActivityLevel: '',
  billingAddress: EMPTY_BILLING_ADDRESS,
};

export function AddAthleteDialog({ open, onOpenChange, groupId, onSubmit }: AddAthleteDialogProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState<'save' | 'anamnesis' | null>(null);

  // Fresh form every time the dialog opens
  useEffect(() => {
    if (open) {
      setForm(EMPTY_FORM);
      setSubmitting(null);
    }
  }, [open]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const setAddress = (key: keyof BillingAddress, value: string) =>
    setForm((prev) => ({ ...prev, billingAddress: { ...prev.billingAddress, [key]: value } }));

  const hasName = form.firstName.trim() !== '' || form.lastName.trim() !== '';

  const submit = async (continueWithAnamnesis: boolean) => {
    if (!hasName || submitting) return;
    setSubmitting(continueWithAnamnesis ? 'anamnesis' : 'save');
    try {
      await onSubmit(
        {
          firstName: form.firstName.trim(),
          middleName: form.middleName.trim() || null,
          lastName: form.lastName.trim(),
          birthday: form.birthday || null,
          sex: form.sex || null,
          sports: form.sports,
          sport: form.sports[0] ?? null, // keep legacy single-sport field in sync
          team: form.team.trim() || null,
          occupation: form.occupation.trim() || null,
          dailyActivityLevel: form.dailyActivityLevel || null,
          billingAddress: normalizeBillingAddress(form.billingAddress),
          groupIds: groupId ? [groupId] : [],
          isArchived: false,
        },
        continueWithAnamnesis,
      );
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!submitting) onOpenChange(next); }}>
      <DialogContent className="max-w-[640px] w-full max-h-[90vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
          <DialogTitle>Add Athlete</DialogTitle>
          <DialogDescription>
            Basic information is stored once on the athlete profile. You can continue straight into an anamnesis or skip it for now.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-4 space-y-5">
          {/* Name */}
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="new-athlete-first">First Name *</Label>
              <Input
                id="new-athlete-first"
                autoFocus
                value={form.firstName}
                onChange={(e) => set('firstName', e.target.value)}
                placeholder="First Name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-athlete-middle">Middle Name</Label>
              <Input
                id="new-athlete-middle"
                value={form.middleName}
                onChange={(e) => set('middleName', e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-athlete-last">Last Name *</Label>
              <Input
                id="new-athlete-last"
                value={form.lastName}
                onChange={(e) => set('lastName', e.target.value)}
                placeholder="Last Name"
              />
            </div>
          </div>

          {/* Personal details */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="new-athlete-birthday">Birthday</Label>
              <Input
                id="new-athlete-birthday"
                type="date"
                value={form.birthday}
                onChange={(e) => set('birthday', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Sex</Label>
              <Select value={form.sex} onValueChange={(v) => set('sex', v as Sex)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select sex" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SEX_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Sport(s)</Label>
              <SportTagInput value={form.sports} onChange={(sports) => set('sports', sports)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-athlete-team">Team</Label>
              <Input
                id="new-athlete-team"
                value={form.team}
                onChange={(e) => set('team', e.target.value)}
                placeholder="e.g., National Junior Squad"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-athlete-occupation">Occupation</Label>
              <Input
                id="new-athlete-occupation"
                value={form.occupation}
                onChange={(e) => set('occupation', e.target.value)}
                placeholder="e.g., Student, Professional"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Daily Activity Level</Label>
              <Select
                value={form.dailyActivityLevel}
                onValueChange={(v) => set('dailyActivityLevel', v as DailyActivityLevel)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select activity level" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ACTIVITY_LEVEL_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Billing address */}
          <div className="space-y-3 pt-4 border-t">
            <Label className="text-sm font-semibold">Billing Address</Label>
            <div className="space-y-1.5">
              <Label htmlFor="new-athlete-street" className="text-xs text-muted-foreground">Street & Number</Label>
              <Input
                id="new-athlete-street"
                value={form.billingAddress.street}
                onChange={(e) => setAddress('street', e.target.value)}
                placeholder="e.g., Main Street 12"
              />
            </div>
            <div className="grid grid-cols-[1fr_2fr] gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="new-athlete-postal" className="text-xs text-muted-foreground">Postal Code</Label>
                <Input
                  id="new-athlete-postal"
                  value={form.billingAddress.postalCode}
                  onChange={(e) => setAddress('postalCode', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-athlete-city" className="text-xs text-muted-foreground">City</Label>
                <Input
                  id="new-athlete-city"
                  value={form.billingAddress.city}
                  onChange={(e) => setAddress('city', e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-athlete-country" className="text-xs text-muted-foreground">Country</Label>
              <Input
                id="new-athlete-country"
                value={form.billingAddress.country}
                onChange={(e) => setAddress('country', e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t shrink-0 gap-2 sm:gap-2">
          {!hasName && (
            <p className="text-xs text-muted-foreground mr-auto self-center">Enter a first or last name to continue.</p>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting !== null}>
            Cancel
          </Button>
          <Button variant="outline" onClick={() => submit(false)} disabled={!hasName || submitting !== null}>
            {submitting === 'save' && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Save
          </Button>
          <Button onClick={() => submit(true)} disabled={!hasName || submitting !== null}>
            {submitting === 'anamnesis'
              ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              : null}
            Continue with anamnesis
            {submitting !== 'anamnesis' && <ArrowRight className="h-4 w-4 ml-1.5" />}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
