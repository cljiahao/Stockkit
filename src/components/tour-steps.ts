// Pure step config for the dashboard onboarding tour. No driver.js import here
// so it stays node-unit-testable; the controller maps these to driver's Config.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StockStatusIndicator } from './stock-status-indicator';

export type TourStep = {
  /** CSS selector for the element to spotlight. */
  element: string;
  title: string;
  description: string;
};

const sel = (tour: string) => `[data-tour="${tour}"]`;

// Renders the real indicator, not a hand-copied color, so the example can't drift.
const exampleLowStockIndicator = renderToStaticMarkup(
  createElement(StockStatusIndicator, { status: 'low' })
);

// Desktop: nav links are visible, so we can spotlight each landmark.
const DESKTOP: TourStep[] = [
  {
    element: sel('inventory-value'),
    title: 'Your inventory value',
    description:
      "Welcome to StockKit. Once you've added products, your total stock value and low or out-of-stock alerts show up right here, calculated live from what's on hand." +
      `<div class="tour-example"><div class="tour-example-label">Example product</div><div class="tour-example-row" style="margin-top:0.35rem"><strong>Fresh Chicken Thigh, 1kg &middot; 4 kg left</strong><span style="display:inline-flex;align-items:center;gap:0.375rem">${exampleLowStockIndicator}</span></div></div>`,
  },
  {
    element: sel('nav-products'),
    title: 'Start here: Products',
    description:
      'Add the products you stock, set a unit cost and a low-stock threshold. Then log every restock, waste, or adjustment from the same page to keep your stock count accurate.',
  },
  {
    element: sel('nav-account'),
    title: 'Your account',
    description:
      'Update your stall name, profile icon, and social links here. Check your plan from the same menu. Shared across every Merqo kit you use.',
  },
  {
    element: sel('tour-replay'),
    title: 'Replay anytime',
    description:
      'Tap here to run this tour again whenever you like. Ready? Go add your first product.',
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
      'Products and your account menu live in here. Start with Products to log your first restock.',
  },
  DESKTOP[DESKTOP.length - 1],
];

/** The tour steps for the current layout. */
export function tourSteps(isMobile: boolean): TourStep[] {
  return isMobile ? MOBILE : DESKTOP;
}
