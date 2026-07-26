// Pure step config for the dashboard onboarding tour. No driver.js import here
// so it stays node-unit-testable; the controller maps these to driver's Config.

export type TourStep = {
  /** CSS selector for the element to spotlight. */
  element: string;
  title: string;
  description: string;
};

const sel = (tour: string) => `[data-tour="${tour}"]`;

// Desktop: nav links are visible, so we can spotlight each landmark.
const DESKTOP: TourStep[] = [
  {
    element: sel('inventory-value'),
    title: 'Your inventory value',
    description:
      "Welcome to StockKit. Once you've added products, your total stock value and low/out-of-stock alerts show up right here, calculated live from what's on hand.",
  },
  {
    element: sel('nav-products'),
    title: 'Start here: Products',
    description:
      'Add the products you stock, set a unit cost and a low-stock threshold. This is step one to tracking your stock.',
  },
  {
    element: sel('nav-account'),
    title: 'Your account',
    description:
      'Update your stall name, profile icon, and social links here — shared across every Merqo kit you use.',
  },
  {
    element: sel('tour-replay'),
    title: 'Replay anytime',
    description:
      'Tap here to run this tour again whenever you like. Now — go add your first product →',
  },
];

// Mobile: nav is collapsed behind the hamburger, so spotlight that instead of
// the hidden links (driver can't highlight an off-screen element).
const MOBILE: TourStep[] = [
  DESKTOP[0],
  {
    element: sel('nav-menu'),
    title: 'Your sections',
    description:
      'Products and your account menu live in here. Start with Products to set up your stock.',
  },
  DESKTOP[DESKTOP.length - 1],
];

/** The tour steps for the current layout. */
export function tourSteps(isMobile: boolean): TourStep[] {
  return isMobile ? MOBILE : DESKTOP;
}
