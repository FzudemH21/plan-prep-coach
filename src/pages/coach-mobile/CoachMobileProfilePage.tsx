import { useNavigate } from 'react-router-dom';
import { Monitor, LogOut, ChevronRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCoachProfile } from '@/hooks/useCoachProfile';
import { supabase } from '@/lib/supabase';
import { useTranslation } from 'react-i18next';

export default function CoachMobileProfilePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useCoachProfile();

  const name     = profile?.name ?? user?.email ?? 'Coach';
  const initials = name.trim().split(/\s+/).map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="px-4 pt-5 pb-4">
        <h1 className="text-2xl font-bold">{t('coachMobile.profile.heading')}</h1>
      </div>

      {/* Avatar + name */}
      <div className="flex flex-col items-center gap-2 pb-6">
        <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center overflow-hidden">
          {profile?.avatarBase64 ? (
            <img src={profile.avatarBase64} alt="Coach" className="w-full h-full object-cover" />
          ) : (
            <span className="text-2xl font-bold text-primary-foreground">{initials}</span>
          )}
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold">{name}</p>
          {user?.email && name !== user.email && (
            <p className="text-sm text-muted-foreground">{user.email}</p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 space-y-2">

        {/* Desktop app link */}
        <button
          onClick={() => navigate('/')}
          className="w-full flex items-center gap-3 rounded-xl border bg-card px-4 py-3 text-left active:bg-accent/50"
        >
          <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
            <Monitor className="h-4 w-4 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{t('coachMobile.profile.switchToDesktop')}</p>
            <p className="text-xs text-muted-foreground">{t('coachMobile.profile.switchToDesktopDesc')}</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </button>

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 rounded-xl border bg-card px-4 py-3 text-left active:bg-accent/50"
        >
          <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <LogOut className="h-4 w-4 text-red-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-destructive">{t('coachMobile.profile.signOut')}</p>
          </div>
        </button>
      </div>

      <div className="h-8" />
    </div>
  );
}
