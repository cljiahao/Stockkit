import { Benefits } from '@/components/landing/benefits';
import { Faq } from '@/components/landing/faq';
import { Hero } from '@/components/landing/hero';
import { HowItWorks } from '@/components/landing/how-it-works';
import { createServerClient } from '@/lib/supabase/server';

export const revalidate = 0;

export default async function Home() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const authed = !!user;

  return (
    <div id="top">
      <Hero authed={authed} />
      <HowItWorks />
      <Benefits />
      <Faq />
    </div>
  );
}
