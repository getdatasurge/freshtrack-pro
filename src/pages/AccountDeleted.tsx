import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function AccountDeleted() {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate('/', { replace: true });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="pb-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <CheckCircle2 className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Account Deleted</CardTitle>
          <CardDescription className="text-base">
            Your account and all associated data have been permanently removed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Thank you for using FrostGuard. If you have any questions or need assistance,
            please contact our support team.
          </p>

          <div className="pt-4 border-t">
            <Button onClick={() => navigate('/', { replace: true })} className="w-full">
              Return to Home
            </Button>
            <p className="text-xs text-muted-foreground mt-3">
              Redirecting in {countdown} second{countdown !== 1 ? 's' : ''}...
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
