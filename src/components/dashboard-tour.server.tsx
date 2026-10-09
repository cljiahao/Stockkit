import { DashboardTour } from './dashboard-tour';
import { renderTourExample } from './tour-example';
export function DashboardTourServer({ seen }: { seen: boolean }) {
  return <DashboardTour seen={seen} exampleIndicator={renderTourExample()} />;
}
