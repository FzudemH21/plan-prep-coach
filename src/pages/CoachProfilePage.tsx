import { useState, useEffect, useRef, ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES } from "@/i18n";
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
import { useAthleteConnections } from "@/hooks/useAthleteConnections";
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
  Camera,
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
// Image resize helper (avatar upload)
// ─────────────────────────────────────────────

function resizeImageToBase64(file: File, maxPx: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("canvas context unavailable")); return; }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = reject;
    img.src = url;
  });
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
  const [avatarBase64, setAvatarBase64] = useState(profile?.avatarBase64 ?? "");
  const [dirty, setDirty] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!profile) return;
    setName(profile.name ?? "");
    setSports(profile.sports ?? []);
    setPhilosophy(profile.structured?.philosophy ?? "");
    setMethods(profile.structured?.methods ?? "");
    setTargetGroup(profile.structured?.targetGroup ?? "");
    setExperience(profile.structured?.experience ?? "");
    setSummary(profile.summary ?? "");
    setAvatarBase64(profile.avatarBase64 ?? "");
  }, [profile]);

  const markDirty = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setDirty(true);
  };

  const handleAvatarUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const base64 = await resizeImageToBase64(file, 200);
    setAvatarBase64(base64);
    if (profile) {
      saveProfile({ ...profile, name, sports, structured: { philosophy, methods, targetGroup, experience }, summary, avatarBase64: base64 });
    }
  };

  const handleSave = () => {
    if (!profile) return;
    saveProfile({
      ...profile,
      name,
      sports,
      structured: { philosophy, methods, targetGroup, experience },
      summary,
      avatarBase64,
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
          {/* Avatar upload */}
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              className="relative group shrink-0 w-16 h-16 rounded-full overflow-hidden border-2 border-border focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              title="Change profile photo"
            >
              {avatarBase64 ? (
                <img src={avatarBase64} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-muted text-muted-foreground font-semibold text-xl select-none">
                  {name ? name.trim().split(/\s+/).map((w) => w[0]).join("").toUpperCase().slice(0, 2) : "?"}
                </div>
              )}
              {/* Camera overlay */}
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="h-5 w-5 text-white" />
              </div>
            </button>
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium">Profile Photo</span>
              <span className="text-xs text-muted-foreground">Click the circle to upload a photo.</span>
              {avatarBase64 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-destructive hover:text-destructive w-fit"
                  onClick={() => { setAvatarBase64(""); setDirty(true); }}
                >
                  Remove photo
                </Button>
              )}
            </div>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
            />
          </div>
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
  const { connections, syncProfileToConnection } = useAthleteConnections();
  const { toast } = useToast();

  const [businessName, setBusinessName] = useState(profile?.branding?.businessName ?? "");
  const [primaryColor, setPrimaryColor] = useState(profile?.branding?.primaryColor ?? "#2563eb");
  const [welcomeMessage, setWelcomeMessage] = useState(profile?.branding?.welcomeMessage ?? "");
  const [logoBase64, setLogoBase64] = useState<string | undefined>(
    profile?.branding?.logoBase64
  );
  const [dirty, setDirty] = useState(false);

  // Sync with profile once it loads from Supabase
  useEffect(() => {
    if (!profile?.branding) return;
    setBusinessName(profile.branding.businessName ?? "");
    setPrimaryColor(profile.branding.primaryColor ?? "#2563eb");
    setWelcomeMessage(profile.branding.welcomeMessage ?? "");
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
      branding: { logoBase64, primaryColor, businessName, welcomeMessage },
    });
    // Sync logo + welcome message to every athlete connection so the
    // athlete app splash screen can read it without extra RLS queries.
    const coachBranding = { logoBase64, welcomeMessage };
    await Promise.all(
      connections.map((conn) =>
        syncProfileToConnection(conn.id, { ...conn.profileData, coachBranding })
      )
    );
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

        {/* Athlete app welcome message */}
        <div className="space-y-1.5">
          <Label>Athlete App Welcome Message</Label>
          <Textarea
            placeholder="e.g. Welcome! Let's make today count. 💪"
            value={welcomeMessage}
            onChange={(e) => { setWelcomeMessage(e.target.value); setDirty(true); }}
            className="min-h-[72px] resize-y"
          />
          <p className="text-xs text-muted-foreground">
            Shown on the athlete app loading screen alongside your logo.
            Leave blank to show no message.
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
  const { i18n } = useTranslation();
  const currentLang = i18n.language as string;

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
                <p className="text-xs text-muted-foreground">
                  {SUPPORTED_LANGUAGES.find(l => l.code === currentLang)?.label ?? 'English'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {SUPPORTED_LANGUAGES.map(lang => (
                <Button
                  key={lang.code}
                  variant={currentLang === lang.code ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => i18n.changeLanguage(lang.code)}
                >
                  {lang.flag} {lang.label}
                </Button>
              ))}
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
    <div className="h-full overflow-y-auto">
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
    </div>
  );
}
