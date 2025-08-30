import { DISTANCE_CALCULATION } from '@rtm/shared';

export class TravelAllowanceCalculator {
  calculateAllowance(distanceKm: number): number {
    if (distanceKm < DISTANCE_CALCULATION.MINIMUM_DISTANCE_KM) {
      return 0;
    }
    return distanceKm * DISTANCE_CALCULATION.ALLOWANCE_PER_KM;
  }
}
