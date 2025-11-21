import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Signup() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    password: '',
    confirmPassword: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email || !formData.password || !formData.firstName || !formData.lastName) {
      toast({ title: 'Error', description: 'All fields are required', variant: 'destructive' });
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast({ title: 'Error', description: 'Passwords do not match', variant: 'destructive' });
      return;
    }

    if (formData.password.length < 6) {
      toast({ title: 'Error', description: 'Password must be at least 6 characters', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }

      toast({ title: 'Success', description: 'Account created! Redirecting...' });
      setTimeout(() => {
        window.location.href = '/';
      }, 500);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Signup failed', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-6 space-y-6">
        <div className="flex items-center gap-2 justify-center">
          <Shield className="h-6 w-6 text-primary" />
          <span className="text-lg font-bold">Crime Report Portal</span>
        </div>

        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">Create Account</h1>
          <p className="text-sm text-muted-foreground">Join us to stay safe</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            placeholder="First Name"
            name="firstName"
            value={formData.firstName}
            onChange={handleChange}
            disabled={isLoading}
            data-testid="input-firstname"
          />
          <Input
            placeholder="Last Name"
            name="lastName"
            value={formData.lastName}
            onChange={handleChange}
            disabled={isLoading}
            data-testid="input-lastname"
          />
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
          <Input
            type="password"
            placeholder="Confirm Password"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleChange}
            disabled={isLoading}
            data-testid="input-confirm-password"
          />
          <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-signup">
            {isLoading ? 'Creating Account...' : 'Sign Up'}
          </Button>
        </form>

        <div className="text-center text-sm">
          Already have an account?{' '}
          <Button variant="link" onClick={() => navigate('/login')} data-testid="link-login">
            Sign In
          </Button>
        </div>
      </Card>
    </div>
  );
}
