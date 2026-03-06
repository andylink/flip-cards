'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/Common/Input';
import { Button } from '@/components/Common/Button';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>(searchParams.get('mode') === 'signup' ? 'signup' : 'signin');
  const [status, setStatus] = useState('');

  const authRedirectUrl = `${(process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin).replace(/\/$/, '')}/auth/callback`;

  const signInWithEmailPassword = async () => {
    const supabase = createClient();
    if (!email || !password) {
      setStatus('Email and password are required.');
      return;
    }

    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setStatus(error.message);
        return;
      }

      setStatus('Signed in successfully. Redirecting...');
      router.push('/dashboard');
      router.refresh();
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: authRedirectUrl
      }
    });

    setStatus(error ? error.message : 'Account created. Confirm your email if required, then sign in.');
  };

  const signInWithGithub = async () => {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: authRedirectUrl
      }
    });

    if (error) setStatus(error.message);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Button
          className="w-full"
          onClick={() => setMode('signin')}
          variant={mode === 'signin' ? 'primary' : 'secondary'}
        >
          Sign in
        </Button>
        <Button
          className="w-full"
          onClick={() => setMode('signup')}
          variant={mode === 'signup' ? 'primary' : 'secondary'}
        >
          Create account
        </Button>
      </div>
      <Input
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@example.com"
      />
      <Input
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="Password"
      />
      <Button className="w-full" onClick={signInWithEmailPassword}>
        {mode === 'signin' ? 'Sign in with password' : 'Create account'}
      </Button>
      <Button className="w-full" onClick={signInWithGithub} variant="secondary">
        Continue with GitHub
      </Button>
      {status ? <p className="text-sm text-slate-600 dark:text-slate-300">{status}</p> : null}
    </div>
  );
}
