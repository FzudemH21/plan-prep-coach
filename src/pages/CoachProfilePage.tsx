import { useState, useEffect, ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useCoachProfile } from "@/hooks/useCoachProfile";
import { DocumentsSection } from "@/components/coach/DocumentsSection";
import { TrainingPlanEnricher } from "@/components/coach/TrainingPlanEnricher";
import {
  Save,
  MessageSquarePlus,
  AlertTriangle,
  UserCircle,
  Plus,
  X,
  User,
  Files,
  Settings,
  Lock,
  CreditCard,
  Globe,
  Moon,
  Image,
  Mail,
  BookOpen,
  ClipboardList,
  Palette,
  Upload,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────
// Skipped / no-profile warning banner
// ─────────────────────────────────────────────

function SkippedBanner({ onStart }: { onStart: () => void }) {
  return (
    <div className="rounded-lg border border-amber-400 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-600 p-5 space-y-3">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
        <div className="space-y-1">
          <p className="font-semibold text-amber-800 dark:text-amber-300">
            No coach profile found
          </p>
          <p className="text-sm text-amber-700 dark:text-amber-400 leading-relaxed">
            Without a profile, the AI cannot provide personalized training recommendations,
            method suggestions, or meaningful periodization support.
          </p>
        </div>
      </div>
      <Button
        className="bg-amber-600 hover:bg-amber-700 text-white"
        onClick={onStart}
      >
        <UserCircle className="h-4 w-4 mr-2" />
        Set up coach profile now
      </Button>
    </div>
  );
}

// ─────────────────────────────────────────────
// Editable sports badge list
// ─────────────────────────────────────────────

interface SportEditorProps {
  sports: string[];
  onChange: (sports: string[]) => void;
}

function SportEditor({ sports, onChange }: SportEditorProps) {
  const [input, setInput] = useState("");

  const add = () => {
    const t = input.trim();
    if (t && !sports.includes(t)) onChange([...sports, t]);
    setInput("");
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          placeholder="Add sport…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          className="flex-1"
        />
        <Button type="button" variant="outline" size="icon" onClick={add} disabled={!input.trim()}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {sports.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {sports.map((s) => (
            <Badge key={s} variant="secondary" className="gap-1">
              {s}
              <button
                onClick={() => onChange(sports.filter((x) => x !== s))}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Small reusable textarea field
// ─────────────────────────────────────────────

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Textarea
        className="min-h-[80px] resize-y"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

// ─────────────────────────────────────────────
// Coming soon badge
// ─────────────────────────────────────────────

function ComingSoon() {
  return (
    <Badge variant="outline" className="text-xs text-muted-foreground">
      Coming soon
    </Badge>
  );
}

// ─────────────────────────────────────────────
// Tab: Profile
// ─────────────────────────────────────────────

function ProfileTab() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile, saveProfile } = useCoachProfile();

  const [name, setName] = useState(profile?.name ?? "");
  const [sports, setSports] = useState<string[]>(profile?.sports ?? []);
  const [philosophy, setPhilosophy] = useState(profile?.structured?.philosophy ?? "");
  const [methods, setMethods] = useState(profile?.structured?.methods ?? "");
  const [targetGroup, setTargetGroup] = useState(profile?.structured?.targetGroup ?? "");
  const [experience, setExperience] = useState(profile?.structured?.experience ?? "");
  const [summary, setSummary] = useState(profile?.summary ?? "");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setName(profile.name ?? "");
    setSports(profile.sports ?? []);
    setPhilosophy(profile.structured?.philosophy ?? "");
    setMethods(profile.structured?.methods ?? "");
    setTargetGroup(profile.structured?.targetGroup ?? "");
    setExperience(profile.structured?.experience ?? "");
    setSummary(profile.summary ?? "");
  }, [profile]);

  const markDirty = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setDirty(true);
  };

  const handleSave = () => {
    if (!profile) return;
    saveProfile({
      ...profile,
      name,
      sports,
      structured: { philosophy, methods, targetGroup, experience },
      summary,
    });
    setDirty(false);
    toast({ title: "Profile saved" });
  };

  // No profile at all or skipped
  if (!profile || profile.skipped) {
    return (
      <div className="space-y-4">
        <SkippedBanner onStart={() => navigate("/onboarding")} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Action row */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-muted-foreground">
          AI-generated profile – all fields directly editable
        </p>
        <div className="flex gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm">
                <MessageSquarePlus className="h-4 w-4 mr-2" />
                Start AI Conversation
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Start new AI conversation?</AlertDialogTitle>
                <AlertDialogDescription>
                  The new conversation will be merged with your existing profile.
                  Fields mentioned in the new conversation will be updated –
                  everything else will be kept.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => navigate("/onboarding?mode=refresh")}>
                  Start conversation
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Button size="sm" onClick={handleSave} disabled={!dirty}>
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
        </div>
      </div>

      {/* Identity */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Identity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => markDirty(setName)(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Sport(s)</Label>
            <SportEditor sports={sports} onChange={markDirty(setSports)} />
          </div>
        </CardContent>
      </Card>

      {/* Structured fields */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Coaching Profile</CardTitle>
          <CardDescription>Extracted by AI – directly editable</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Field
            label="Philosophy"
            value={philosophy}
            onChange={markDirty(setPhilosophy)}
            placeholder="Your coaching philosophy…"
          />
          <Separator />
          <Field
            label="Training Methods"
            value={methods}
            onChange={markDirty(setMethods)}
            placeholder="Preferred methods and approaches…"
          />
          <Separator />
          <Field
            label="Target Group"
            value={targetGroup}
            onChange={markDirty(setTargetGroup)}
            placeholder="Your typical athletes…"
          />
          <Separator />
          <Field
            label="Experience"
            value={experience}
            onChange={markDirty(setExperience)}
            placeholder="Your background and experience…"
          />
        </CardContent>
      </Card>

      {/* Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Summary</CardTitle>
          <CardDescription>AI-generated free text – directly editable</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            className="min-h-[140px] resize-y"
            value={summary}
            onChange={(e) => markDirty(setSummary)(e.target.value)}
            placeholder="A summary of your coaching approach…"
          />
        </CardContent>
      </Card>

      {/* Sticky save hint */}
      {dirty && (
        <div className={cn(
          "fixed bottom-6 right-6 z-50",
          "flex items-center gap-3 rounded-lg border bg-card shadow-lg px-4 py-3"
        )}>
          <span className="text-sm text-muted-foreground">Unsaved changes</span>
          <Button size="sm" onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Branding card (inside Settings tab)
// ─────────────────────────────────────────────

function BrandingCard() {
  const { profile, saveProfile } = useCoachProfile();
  const { toast } = useToast();

  const [businessName, setBusinessName] = useState(profile?.branding?.businessName ?? "");
  const [primaryColor, setPrimaryColor] = useState(profile?.branding?.primaryColor ?? "#2563eb");
  const [logoBase64, setLogoBase64] = useState<string | undefined>(
    profile?.branding?.logoBase64
  );
  const [dirty, setDirty] = useState(false);

  // Sync with profile once it loads from Supabase
  useEffect(() => {
    if (!profile?.branding) return;
    setBusinessName(profile.branding.businessName ?? "");
    setPrimaryColor(profile.branding.primaryColor ?? "#2563eb");
    setLogoBase64(profile.branding.logoBase64);
  }, [profile]);

  const handleLogoUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setLogoBase64(ev.target?.result as string);
      setDirty(true);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!profile) return;
    await saveProfile({
      ...profile,
      branding: { logoBase64, primaryColor, businessName },
    });
    setDirty(false);
    toast({ title: "Branding saved" });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Palette className="h-4 w-4" />
          Report Branding
        </CardTitle>
        <CardDescription>
          Your logo and colors appear on exported training plan PDFs.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Business name */}
        <div className="space-y-1.5">
          <Label>Business / Organisation Name</Label>
          <Input
            placeholder="e.g. Elite Performance Coaching"
            value={businessName}
            onChange={(e) => { setBusinessName(e.target.value); setDirty(true); }}
          />
          <p className="text-xs text-muted-foreground">
            Shown in the PDF footer and cover page.
          </p>
        </div>

        {/* Accent color */}
        <div className="space-y-1.5">
          <Label>Accent Color</Label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => { setPrimaryColor(e.target.value); setDirty(true); }}
              className="h-9 w-16 cursor-pointer rounded border border-input p-0.5"
            />
            <span className="text-sm font-mono text-muted-foreground">{primaryColor}</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => { setPrimaryColor("#2563eb"); setDirty(true); }}
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Reset
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Used as the header and highlight color in exported PDFs.
          </p>
        </div>

        {/* Logo */}
        <div className="space-y-1.5">
          <Label>Logo</Label>
          {logoBase64 ? (
            <div className="flex items-center gap-3">
              <img
                src={logoBase64}
                alt="Logo preview"
                className="h-12 max-w-[140px] rounded border bg-muted object-contain p-1"
              />
              <div className="flex gap-2">
                <Label htmlFor="logo-upload" className="cursor-pointer">
                  <Button variant="outline" size="sm" asChild>
                    <span>Replace</span>
                  </Button>
                </Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => { setLogoBase64(undefined); setDirty(true); }}
                >
                  Remove
                </Button>
              </div>
            </div>
          ) : (
            <Label htmlFor="logo-upload" className="cursor-pointer">
              <div className="flex h-20 items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 transition-colors hover:border-primary/50">
                <div className="text-center">
                  <Upload className="mx-auto mb-1 h-5 w-5 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">
                    Click to upload PNG, JPG, or SVG
                  </p>
                </div>
              </div>
            </Label>
          )}
          <input
            id="logo-upload"
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
            className="sr-only"
            onChange={handleLogoUpload}
          />
          <p className="text-xs text-muted-foreground">
            Displayed in the top-right corner of the PDF cover page.
          </p>
        </div>

        <Button size="sm" onClick={handleSave} disabled={!dirty || !profile}>
          <Save className="h-4 w-4 mr-2" />
          Save Branding
        </Button>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────
// Tab: Settings
// ─────────────────────────────────────────────

function SettingsTab() {
  return (
    <div className="space-y-6">
      {/* Branding */}
      <BrandingCard />

      {/* Personal data */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" />
            Personal Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="flex items-center gap-2">
              <Image className="h-3.5 w-3.5 text-muted-foreground" />
              Profile Picture
            </Label>
            <div className="flex items-center gap-3">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center border">
                <User className="h-8 w-8 text-muted-foreground" />
              </div>
              <Button variant="outline" size="sm" disabled>
                Upload picture
                <ComingSoon />
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input placeholder="Your name" disabled />
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-2">
              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
              Email
            </Label>
            <Input type="email" placeholder="your@email.com" disabled />
          </div>
          <p className="text-xs text-muted-foreground">
            Personal information will be available once login is enabled.{" "}
            <ComingSoon />
          </p>
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Security
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Reset password</p>
              <p className="text-xs text-muted-foreground">Requires an active account</p>
            </div>
            <div className="flex items-center gap-2">
              <ComingSoon />
              <Button variant="outline" size="sm" disabled>
                Reset
              </Button>
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Two-factor authentication</p>
              <p className="text-xs text-muted-foreground">Extra security for your account</p>
            </div>
            <div className="flex items-center gap-2">
              <ComingSoon />
              <Button variant="outline" size="sm" disabled>
                Set up
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Billing */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Subscription & Billing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Current plan</p>
              <p className="text-xs text-muted-foreground">Free Beta</p>
            </div>
            <ComingSoon />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Payment method</p>
              <p className="text-xs text-muted-foreground">Stripe integration</p>
            </div>
            <div className="flex items-center gap-2">
              <ComingSoon />
              <Button variant="outline" size="sm" disabled>
                Manage
              </Button>
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Invoices</p>
              <p className="text-xs text-muted-foreground">Past transactions</p>
            </div>
            <div className="flex items-center gap-2">
              <ComingSoon />
              <Button variant="outline" size="sm" disabled>
                View
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* App settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="h-4 w-4" />
            App Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Language</p>
                <p className="text-xs text-muted-foreground">English / Deutsch</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ComingSoon />
              <Button variant="outline" size="sm" disabled>
                Change
              </Button>
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Moon className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Theme</p>
                <p className="text-xs text-muted-foreground">Light / Dark / System</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ComingSoon />
              <Button variant="outline" size="sm" disabled>
                Customize
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────

export default function CoachProfilePage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6 py-6">
      {/* Title */}
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <UserCircle className="h-6 w-6 text-primary" />
        Coach Profile
      </h1>

      <Tabs defaultValue="profile">
        <TabsList className="mb-2">
          <TabsTrigger value="profile" className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="documents" className="flex items-center gap-1.5">
            <Files className="h-3.5 w-3.5" />
            Documents
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-1.5">
            <Settings className="h-3.5 w-3.5" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <ProfileTab />
        </TabsContent>

        <TabsContent value="documents">
          <Tabs defaultValue="docs">
            <TabsList className="mb-4">
              <TabsTrigger value="docs" className="gap-1.5">
                <BookOpen className="h-3.5 w-3.5" />
                Documents
              </TabsTrigger>
              <TabsTrigger value="plans" className="gap-1.5">
                <ClipboardList className="h-3.5 w-3.5" />
                Training Plans
              </TabsTrigger>
            </TabsList>
            <TabsContent value="docs">
              <DocumentsSection />
            </TabsContent>
            <TabsContent value="plans">
              <TrainingPlanEnricher />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="settings">
          <SettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
