export type OccupancySnapshot = {
  occupiedReaders: number;
  occupancyRatio: number;
  expectedNewSessions: number;
  avgSessionMinutes: number;
  machineFailureProbability: number;
};

export function computeOccupancy(params: {
  demandIndex: number;
  totalReaders: number;
  avgSessionMinutes: number;
  mtbfMinutes: number;
  rng: () => number;
}): OccupancySnapshot {
  const { demandIndex, totalReaders, avgSessionMinutes, mtbfMinutes, rng } = params;
  const dynamicRatio = Math.min(0.98, Math.max(0.05, 0.2 + demandIndex * 0.28 + rng() * 0.1));
  const occupiedReaders = Math.max(0, Math.min(totalReaders, Math.round(totalReaders * dynamicRatio)));
  const sessionTurnover = Math.max(0.2, 60 / Math.max(6, avgSessionMinutes));
  const expectedNewSessions = Math.max(0, Math.round(occupiedReaders * sessionTurnover));
  const machineFailureProbability = Math.max(0.0001, Math.min(0.15, 1 / Math.max(30, mtbfMinutes)));

  return {
    occupiedReaders,
    occupancyRatio: dynamicRatio,
    expectedNewSessions,
    avgSessionMinutes,
    machineFailureProbability,
  };
}
