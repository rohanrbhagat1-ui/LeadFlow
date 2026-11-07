'use server';

import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function signInAction(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(`/login?error=${encodeURIComponent('Email or password was not accepted.')}`);
  redirect('/dashboard');
}

export async function signUpAction(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const businessName = String(formData.get('business_name') ?? '').trim();
  const businessType = String(formData.get('business_type') ?? 'other');
  if (password.length < 10) redirect('/signup?error=Choose a password with at least 10 characters.');
  if (!businessName || businessName.length > 90) redirect('/signup?error=Enter a business name (90 characters maximum).');

  const supabase = await createSupabaseServerClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: {
      data: { business_name: businessName, business_type: businessType },
      emailRedirectTo: `${siteUrl}/auth/callback?next=/dashboard`
    }
  });
  if (error) redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  if (data.session) redirect('/dashboard');
  redirect('/login?message=Check your email to confirm your account, then sign in.');
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect('/login');
}
