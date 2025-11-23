import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Shield, ShieldAlert } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';

type LoginMode = 'user' | 'admin';

export default function Login() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [loginMode, setLoginMode] = useState<LoginMode>('user');
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email || !formData.password) {
      toast({ title: 'Error', description: 'Email and password are required', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/email-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }

      // Invalidate admin sessions cache to update dashboard immediately
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sessions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reports"] });

      toast({ title: 'Success', description: 'Logged in! Redirecting...' });
      setTimeout(() => {
        window.location.href = '/';
      }, 500);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Login failed', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.email || !formData.password) {
      toast({ title: 'Error', description: 'Email and password are required', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email, password: formData.password }),
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        toast({
          title: 'Login failed',
          description: error.message || 'Invalid credentials',
          variant: 'destructive',
        });
        return;
      }

      const data = await response.json();
      if (data.success) {
        toast({
          title: 'Welcome',
          description: 'Admin login successful',
        });
        setTimeout(() => {
          navigate('/admin-panel');
        }, 500);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Login failed. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = loginMode === 'user' ? handleUserSubmit : handleAdminSubmit;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-6 space-y-6">
        <div className="flex items-center gap-2 justify-center">
          <Shield className="h-6 w-6 text-primary" />
          <span className="text-lg font-bold">Crime Report Portal</span>
        </div>

        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">
            {loginMode === 'user' ? 'Sign In' : 'Admin Login'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {loginMode === 'user' ? 'Access your account' : 'Secure access for administrators only'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="email"
            placeholder="Email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            disabled={isLoading}
            data-testid="input-email"
          />
          <Input
            type="password"
            placeholder="Password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            disabled={isLoading}
            data-testid="input-password"
          />
          <Button 
            type="submit" 
            className="w-full" 
            disabled={isLoading} 
            data-testid={loginMode === 'user' ? 'button-login' : 'button-admin-login'}
          >
            {isLoading ? 'Signing In...' : loginMode === 'user' ? 'Sign In' : 'Admin Login'}
          </Button>
        </form>

        {/* Toggle Button */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground px-2">Or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {loginMode === 'user' ? (
          <Button 
            type="button"
            variant="outline"
            className="w-full gap-2"
            onClick={() => {
              setLoginMode('admin');
              setFormData({ email: '', password: '' });
            }}
            data-testid="button-switch-to-admin"
          >
            <ShieldAlert className="h-4 w-4" />
            System Admin Login
          </Button>
        ) : (
          <Button 
            type="button"
            variant="outline"
            className="w-full gap-2"
            onClick={() => {
              setLoginMode('user');
              setFormData({ email: '', password: '' });
            }}
            data-testid="button-switch-to-user"
          >
            <Shield className="h-4 w-4" />
            Back to User Login
          </Button>
        )}

        {loginMode === 'user' && (
          <div className="text-center text-sm">
            Don't have an account?{' '}
            <button onClick={() => navigate('/signup')} className="text-primary hover:underline font-semibold" data-testid="link-signup">
              Sign Up
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}
