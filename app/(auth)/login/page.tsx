import { LoginForm } from './ui';

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-md rounded-md border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
      <h1 className="mb-4 text-2xl font-semibold">Sign in to FlipForge</h1>
      <LoginForm />
    </div>
  );
}
