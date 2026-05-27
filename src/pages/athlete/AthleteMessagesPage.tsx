import { MessageCircle } from 'lucide-react';

export default function AthleteMessagesPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full py-20 px-4 text-center">
      <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
        <MessageCircle className="h-7 w-7 text-primary" />
      </div>
      <h2 className="text-lg font-semibold mb-1">Messages</h2>
      <p className="text-sm text-muted-foreground">Messages coming soon</p>
    </div>
  );
}
