import { redirect } from 'next/navigation';
import { isAuthenticated, isSetup, totpSecret } from '@/lib/auth';
import { loginAction } from '../auth-actions';
import { AuthForm } from '../AuthForm';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  if (!isSetup()) redirect('/setup');
  if (await isAuthenticated()) redirect('/');
  return <AuthForm mode="login" action={loginAction} needOtp={!!totpSecret()} />;
}
