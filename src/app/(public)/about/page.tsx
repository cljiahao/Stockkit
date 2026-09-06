import { Button } from '@/components/ui/button';
import { AboutMerqo } from '@merqo/ui';
import Link from 'next/link';

export const metadata = { title: 'About' };

export default function AboutPage() {
  return (
    <AboutMerqo kitName="stockkit">
      <Button asChild size="lg">
        <Link href="/">See stockkit</Link>
      </Button>
    </AboutMerqo>
  );
}
