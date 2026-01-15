import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Thermometer, Mail, Lock, User, Loader2, Eye, EyeOff } from "lucide-react";
import { Link } from "react-router-dom";
import { z } from "zod";

const emailSchema = z.string().email("Please enter a valid email address");
const passwordSchema = z.string().min(8, "Password must be at least 8 characters");

const Auth = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(searchParams.get("mode") === "signup" ? "signup" : "signin");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");

  // Reset password mode state
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetForm, setResetForm] = useState({ newPassword: "", confirmPassword: "" });

  // Sign up confirmation state
  const [signUpComplete, setSignUpComplete] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");

  // Password visibility states
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [signInForm, setSignInForm] = useState({ email: "", password: "" });
  const [signUpForm, setSignUpForm] = useState({ email: "", password: "", fullName: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Password strength calculator
  const getPasswordStrength = (password: string) => {
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++;

    if (score <= 1) return { level: "Weak", color: "bg-red-500", textColor: "text-red-500", width: "25%" };
    if (score <= 2) return { level: "Fair", color: "bg-yellow-500", textColor: "text-yellow-500", width: "50%" };
    if (score <= 3) return { level: "Good", color: "bg-blue-500", textColor: "text-blue-500", width: "75%" };
    return { level: "Strong", color: "bg-green-500", textColor: "text-green-500", width: "100%" };
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // If we're in reset mode and have a session, show reset form instead of redirecting
      if (searchParams.get("mode") === "reset" && session?.user) {
        setShowResetPassword(true);
        return;
      }
      if (session?.user) {
        navigate("/auth/callback", { replace: true });
      }
    });

    // Also check on initial load
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (searchParams.get("mode") === "reset" && session?.user) {
        setShowResetPassword(true);
        return;
      }
      if (session?.user) {
        navigate("/auth/callback", { replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, searchParams]);

  const validateForm = (type: "signin" | "signup" | "reset") => {
    const newErrors: Record<string, string> = {};

    if (type === "reset") {
      try {
        passwordSchema.parse(resetForm.newPassword);
      } catch (err) {
        if (err instanceof z.ZodError) {
          newErrors.newPassword = err.errors[0].message;
        }
      }
      if (resetForm.newPassword !== resetForm.confirmPassword) {
        newErrors.confirmPassword = "Passwords do not match";
      }
    } else {
      const form = type === "signin" ? signInForm : signUpForm;

      try {
        emailSchema.parse(form.email);
      } catch (e) {
        if (e instanceof z.ZodError) newErrors.email = e.errors[0].message;
      }

      try {
        passwordSchema.parse(form.password);
      } catch (e) {
        if (e instanceof z.ZodError) newErrors.password = e.errors[0].message;
      }

      if (type === "signup" && !signUpForm.fullName.trim()) {
        newErrors.fullName = "Full name is required";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm("signin")) return;

    setIsLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: signInForm.email,
      password: signInForm.password,
    });

    if (error) {
      toast({
        title: "Sign in failed",
        description: error.message,
        variant: "destructive",
      });
    }
    setIsLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      emailSchema.parse(forgotPasswordEmail);
    } catch (err) {
      if (err instanceof z.ZodError) {
        setErrors({ forgotEmail: err.errors[0].message });
        return;
      }
    }
    
    setIsLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotPasswordEmail, {
      redirectTo: `${window.location.origin}/auth?mode=reset`,
    });

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Check your email",
        description: "We've sent you a password reset link.",
      });
      setShowForgotPassword(false);
      setForgotPasswordEmail("");
    }
    setIsLoading(false);
  };

  const checkPasswordBreach = async (password: string): Promise<{ breached: boolean; count: number }> => {
    try {
      const { data, error } = await supabase.functions.invoke('check-password-breach', {
        body: { password },
      });
      
      if (error) {
        console.error('Password breach check failed:', error);
        return { breached: false, count: 0 };
      }
      
      return data as { breached: boolean; count: number };
    } catch (err) {
      console.error('Password breach check error:', err);
      return { breached: false, count: 0 };
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm("reset")) return;

    setIsLoading(true);

    // Check for breached passwords
    const breachResult = await checkPasswordBreach(resetForm.newPassword);
    if (breachResult.breached) {
      setErrors({
        newPassword: `This password has been exposed in ${breachResult.count.toLocaleString()} data breaches. Please choose a different password.`
      });
      setIsLoading(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({
      password: resetForm.newPassword
    });

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Password updated",
        description: "Your password has been successfully updated.",
      });
      setShowResetPassword(false);
      navigate("/dashboard");
    }
    setIsLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm("signup")) return;

    setIsLoading(true);
    
    // Check password against HaveIBeenPwned database
    const breachResult = await checkPasswordBreach(signUpForm.password);
    if (breachResult.breached) {
      toast({
        title: "Password compromised",
        description: `This password has appeared in ${breachResult.count.toLocaleString()} data breaches. Please choose a different password for your security.`,
        variant: "destructive",
      });
      setErrors(prev => ({ ...prev, password: "This password has been found in data breaches. Please choose a stronger, unique password." }));
      setIsLoading(false);
      return;
    }
    
    const redirectUrl = `${window.location.origin}/auth/callback`;

    const { error } = await supabase.auth.signUp({
      email: signUpForm.email,
      password: signUpForm.password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: signUpForm.fullName,
        },
      },
    });

    if (error) {
      if (error.message.includes('leaked') || error.message.includes('pwned')) {
        toast({
          title: "Password compromised",
          description: "This password has been found in a data breach. Please choose a different password.",
          variant: "destructive",
        });
        setErrors(prev => ({ ...prev, password: "This password has been found in data breaches." }));
      } else {
        toast({
          title: "Sign up failed",
          description: error.message,
          variant: "destructive",
        });
      }
    } else {
      setPendingEmail(signUpForm.email);
      setSignUpComplete(true);
      toast({
        title: "Account created!",
        description: "Please check your email to verify your account.",
        variant: "success",
      });
    }
    setIsLoading(false);
  };

  const signUpStrength = getPasswordStrength(signUpForm.password);
  const resetStrength = getPasswordStrength(resetForm.newPassword);

  const handleResendConfirmation = async () => {
    setIsLoading(true);
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: pendingEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Email sent", description: "Check your inbox for the confirmation link.", variant: "success" });
    }
    setIsLoading(false);
  };

  // Preview mode for testing email confirmation UI
  const previewMode = searchParams.get('preview');
  const previewEmail = searchParams.get('email') || 'preview@example.com';

  // Show Email Confirmation UI after signup OR in preview mode
  if (signUpComplete || previewMode === 'confirmation') {
    const displayEmail = signUpComplete ? pendingEmail : previewEmail;
    return (
      <div className="min-h-screen bg-gradient-frost flex flex-col items-center justify-center p-4">
        <Link to="/" className="flex items-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-primary flex items-center justify-center">
            <Thermometer className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-bold text-foreground">FrostGuard</span>
        </Link>

        <Card className="w-full max-w-md shadow-lg text-center">
          <CardHeader>
            <div className="mx-auto w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mb-4">
              <Mail className="w-8 h-8 text-accent" />
            </div>
            <CardTitle className="text-2xl">Check your email</CardTitle>
            <CardDescription>
              We've sent a confirmation link to<br />
              <strong className="text-foreground">{displayEmail}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Click the link in the email to verify your account and get started.
            </p>
            <Button 
              variant="outline" 
              onClick={handleResendConfirmation}
              disabled={isLoading || previewMode === 'confirmation'}
              className="w-full"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Resend confirmation email
            </Button>
            <button
              type="button"
              onClick={() => { setSignUpComplete(false); setActiveTab("signin"); navigate('/auth'); }}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Back to sign in
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show Reset Password UI
  if (showResetPassword) {
    return (
      <div className="min-h-screen bg-gradient-frost flex flex-col items-center justify-center p-4">
        <Link to="/" className="flex items-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-primary flex items-center justify-center">
            <Thermometer className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-bold text-foreground">FrostGuard</span>
        </Link>

        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Set New Password</CardTitle>
            <CardDescription>
              Enter your new password below
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="new-password"
                    type={showNewPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="pl-10 pr-10"
                    value={resetForm.newPassword}
                    onChange={(e) => setResetForm({ ...resetForm, newPassword: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {resetForm.newPassword && (
                  <div className="space-y-1">
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full ${resetStrength.color} transition-all duration-300`}
                        style={{ width: resetStrength.width }}
                      />
                    </div>
                    <p className={`text-xs ${resetStrength.textColor}`}>
                      Password strength: {resetStrength.level}
                    </p>
                  </div>
                )}
                {errors.newPassword && <p className="text-sm text-destructive">{errors.newPassword}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="pl-10 pr-10"
                    value={resetForm.confirmPassword}
                    onChange={(e) => setResetForm({ ...resetForm, confirmPassword: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword}</p>}
              </div>

              <Button type="submit" className="w-full bg-accent hover:bg-accent/90" disabled={isLoading}>
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Update Password
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-frost flex flex-col items-center justify-center p-4">
      <Link to="/" className="flex items-center gap-2 mb-8">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-primary flex items-center justify-center">
          <Thermometer className="w-6 h-6 text-white" />
        </div>
        <span className="text-2xl font-bold text-foreground">FrostGuard</span>
      </Link>

      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Welcome</CardTitle>
          <CardDescription>
            Sign in to your account or create a new one
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="you@company.com"
                      className="pl-10"
                      value={signInForm.email}
                      onChange={(e) => setSignInForm({ ...signInForm, email: e.target.value })}
                    />
                  </div>
                  {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="signin-password"
                      type={showSignInPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="pl-10 pr-10"
                      value={signInForm.password}
                      onChange={(e) => setSignInForm({ ...signInForm, password: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => setShowSignInPassword(!showSignInPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showSignInPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                </div>
                <Button type="submit" className="w-full bg-accent hover:bg-accent/90" disabled={isLoading}>
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Sign In
                </Button>
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors mt-2"
                >
                  Forgot password?
                </button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="John Smith"
                      className="pl-10"
                      value={signUpForm.fullName}
                      onChange={(e) => setSignUpForm({ ...signUpForm, fullName: e.target.value })}
                    />
                  </div>
                  {errors.fullName && <p className="text-sm text-destructive">{errors.fullName}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="you@company.com"
                      className="pl-10"
                      value={signUpForm.email}
                      onChange={(e) => setSignUpForm({ ...signUpForm, email: e.target.value })}
                    />
                  </div>
                  {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="signup-password"
                      type={showSignUpPassword ? "text" : "password"}
                      placeholder="Min. 8 characters"
                      className="pl-10 pr-10"
                      value={signUpForm.password}
                      onChange={(e) => setSignUpForm({ ...signUpForm, password: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => setShowSignUpPassword(!showSignUpPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showSignUpPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {signUpForm.password && (
                    <div className="space-y-1">
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full ${signUpStrength.color} transition-all duration-300`}
                          style={{ width: signUpStrength.width }}
                        />
                      </div>
                      <p className={`text-xs ${signUpStrength.textColor}`}>
                        Password strength: {signUpStrength.level}
                      </p>
                    </div>
                  )}
                  {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                </div>
                <Button type="submit" className="w-full bg-accent hover:bg-accent/90" disabled={isLoading}>
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Create Account
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  By signing up, you agree to our Terms of Service and Privacy Policy.
                </p>
              </form>
            </TabsContent>
          </Tabs>

          {showForgotPassword && (
            <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
              <Card className="w-full max-w-md">
                <CardHeader>
                  <CardTitle>Reset Password</CardTitle>
                  <CardDescription>
                    Enter your email and we'll send you a reset link
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="forgot-email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="forgot-email"
                          type="email"
                          placeholder="you@company.com"
                          className="pl-10"
                          value={forgotPasswordEmail}
                          onChange={(e) => setForgotPasswordEmail(e.target.value)}
                        />
                      </div>
                      {errors.forgotEmail && <p className="text-sm text-destructive">{errors.forgotEmail}</p>}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          setShowForgotPassword(false);
                          setForgotPasswordEmail("");
                          setErrors({});
                        }}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" className="flex-1 bg-accent hover:bg-accent/90" disabled={isLoading}>
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        Send Link
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
