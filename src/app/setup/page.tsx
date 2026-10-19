import { redirect } from 'next/navigation';
import { isSetup } from '@/lib/auth';
import { setupAction } from '../auth-actions';
import { AuthForm } from '../AuthForm';

export const dynamic = 'force-dynamic';

export default function SetupPage() {
  if (isSetup()) redirect('/login');
  return <AuthForm mode="setup" action={setupAction} />;
}
