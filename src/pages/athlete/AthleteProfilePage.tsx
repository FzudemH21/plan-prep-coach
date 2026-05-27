import { useNavigate } from 'react-router-dom';
import { User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAthleteApp } from '@/hooks/useAthleteApp';
import { useAuth } from '@/hooks/useAuth';

export default function AthleteProfilePage() {
  const navigate = useNavigate();
  const { connection } = useAthleteApp();
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate('/athlete/login');
  };

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex flex-col items-center text-center pt-4 pb-2">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-3">
          <User className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-xl font-bold">
          {connection?.athleteName ?? 'Athlete'}
        </h1>
        {connection?.athleteEmail && (
          <p className="text-sm text-muted-foreground mt-0.5">{connection.athleteEmail}</p>
        )}
      </div>

      {/* Profile info */}
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground text-center">Profile details coming soon</p>
        </CardContent>
      </Card>

      {/* Sign out */}
      <Button variant="outline" className="w-full text-destructive border-destructive/30 hover:bg-destructive/5" onClick={handleSignOut}>
        Sign Out
      </Button>
    </div>
  );
}
