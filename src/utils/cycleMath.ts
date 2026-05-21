import { PeriodRecord } from '../types';

export interface CyclePrediction {
  avgCycleLength: number;
  nextPeriodStart: Date;
  predictedOvulation: Date;
  fertileWindowStart: Date;
  fertileWindowEnd: Date;
  currentPhase: 'Menstruation' | 'Follicular' | 'Ovulation' | 'Luteal' | 'Unknown';
}

export function calculateCyclePredictions(historicalPeriods: PeriodRecord[], standardCycleLength = 28): CyclePrediction | null {
  if (!historicalPeriods || historicalPeriods.length === 0) return null;
  
  // Sort records chronologically by start date
  const sorted = [...historicalPeriods].sort((a, b) => 
    new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
  );
  
  let avgCycleLength = standardCycleLength;
  
  if (sorted.length >= 2) {
    let totalCycleDays = 0;
    let intervalsCount = 0;
    
    for (let i = 1; i < sorted.length; i++) {
      const startCurrent = new Date(sorted[i].start_date);
      const startPrev = new Date(sorted[i - 1].start_date);
      
      const diffTime = Math.abs(startCurrent.getTime() - startPrev.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      // Sanitization: Only include realistic cycle ranges (e.g. 15 to 45 days)
      if (diffDays >= 15 && diffDays <= 45) {
        totalCycleDays += diffDays;
        intervalsCount++;
      }
    }
    
    if (intervalsCount > 0) {
      avgCycleLength = Math.round(totalCycleDays / intervalsCount);
    }
  }
  
  const latestPeriod = sorted[sorted.length - 1];
  const latestStartDate = new Date(latestPeriod.start_date);
  
  // Predict next period start
  const nextPeriodStart = new Date(latestStartDate);
  nextPeriodStart.setDate(latestStartDate.getDate() + avgCycleLength);
  
  // Ovulation typically occurs 14 days before the next period starts (luteal phase is relatively fixed at 14 days)
  const predictedOvulation = new Date(nextPeriodStart.getTime() - (14 * 24 * 60 * 60 * 1000));
  
  // Fertile window is typically 5 days before ovulation plus the day of ovulation
  const fertileWindowStart = new Date(predictedOvulation.getTime() - (5 * 24 * 60 * 60 * 1000));
  const fertileWindowEnd = new Date(predictedOvulation.getTime() + (1 * 24 * 60 * 60 * 1000));
  
  // Determine current active phase today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cycleDayNumber = Math.ceil((today.getTime() - latestStartDate.getTime()) / (1000 * 60 * 60 * 24)) % avgCycleLength;
  
  let currentPhase: CyclePrediction['currentPhase'] = 'Unknown';
  
  const standardPeriodLength = 5; // default estimation
  
  if (cycleDayNumber >= 0 && cycleDayNumber <= standardPeriodLength) {
    currentPhase = 'Menstruation';
  } else if (cycleDayNumber > standardPeriodLength && cycleDayNumber < (avgCycleLength - 16)) {
    currentPhase = 'Follicular';
  } else if (cycleDayNumber >= (avgCycleLength - 16) && cycleDayNumber <= (avgCycleLength - 12)) {
    currentPhase = 'Ovulation';
  } else if (cycleDayNumber > (avgCycleLength - 12) && cycleDayNumber < avgCycleLength) {
    currentPhase = 'Luteal';
  }
  
  return {
    avgCycleLength,
    nextPeriodStart,
    predictedOvulation,
    fertileWindowStart,
    fertileWindowEnd,
    currentPhase
  };
}
