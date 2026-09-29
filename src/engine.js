const DAY_ADJUSTMENTS = {
  Monday: -1,
  Tuesday: 2,
  Wednesday: -1,
  Thursday: 3,
  Friday: 9,
  Saturday: -12,
  Sunday: -24,
};

const MENU_ADJUSTMENTS = {
  'Rajma + Rice + Roti': 0,
  'Paneer Bowl + Salad': 24,
  'Dal Khichdi + Curd': -28,
  'Veg Biryani + Raita': 18,
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function predictDemand(input) {
  if ([input.attendance, input.temperature, input.plannedProduction, input.safetyBufferPercent].some((value) => typeof value === 'string' && value.trim() === '')) {
    throw new Error('Enter attendance, temperature, production, and safety buffer before calculating a prediction.');
  }
  const attendance = Number(input.attendance);
  const temperature = Number(input.temperature);
  const plannedProduction = Number(input.plannedProduction);
  const safetyBufferPercent = Number(input.safetyBufferPercent ?? 2);
  if (![attendance, temperature, plannedProduction, safetyBufferPercent].every(Number.isFinite) || attendance < 0 || temperature < -20 || temperature > 60 || plannedProduction < 0 || safetyBufferPercent < 0 || safetyBufferPercent > 25) {
    throw new Error('Enter valid, non-negative attendance and production, a safety buffer from 0% to 25%, and a temperature between -20°C and 60°C.');
  }

  const dayAdjustment = DAY_ADJUSTMENTS[input.dayOfWeek] ?? 0;
  const menuAdjustment = MENU_ADJUSTMENTS[input.menu] ?? 0;
  const weatherAdjustment = temperature >= 35 ? -8 : temperature <= 15 ? -4 : 0;
  const holidayAdjustment = input.holiday ? -55 : 0;
  const eventAdjustment = input.event ? 32 : 0;
  const baseServiceDemand = 172;
  const attendanceContribution = Math.round(attendance * 0.645);
  const predictedConsumption = Math.max(0, Math.round(baseServiceDemand + attendanceContribution + dayAdjustment + menuAdjustment + weatherAdjustment + holidayAdjustment + eventAdjustment));
  const safetyBuffer = Math.floor(predictedConsumption * safetyBufferPercent / 100);
  const unroundedTarget = predictedConsumption + safetyBuffer;
  const recommendedProduction = safetyBufferPercent === 0
    ? predictedConsumption
    : Math.max(predictedConsumption, Math.round(unroundedTarget / 10) * 10);
  const estimatedSurplus = Math.max(0, plannedProduction - predictedConsumption);
  const recommendedSurplus = Math.max(0, recommendedProduction - predictedConsumption);
  const surplusRate = plannedProduction === 0 ? 0 : estimatedSurplus / plannedProduction;
  const wasteRisk = surplusRate >= 0.18 ? 'HIGH' : surplusRate >= 0.08 ? 'MEDIUM' : 'LOW';
  const rangeWidth = Math.max(28, Math.round(predictedConsumption * 0.05));

  return {
    predictedConsumption,
    lowerBound: Math.max(0, predictedConsumption - rangeWidth),
    upperBound: predictedConsumption + rangeWidth,
    confidence: 87,
    recommendedProduction,
    recommendedSurplus,
    safetyBufferPercent,
    estimatedSurplus,
    wasteRisk,
    costImpact: Math.round((plannedProduction - recommendedProduction) * 28),
    factors: {
      baseDemand: baseServiceDemand,
      attendance: attendanceContribution,
      menu: menuAdjustment,
      day: dayAdjustment,
      weather: weatherAdjustment,
      holiday: holidayAdjustment,
      event: eventAdjustment,
    },
  };
}

export function calculateRecordMetrics(record) {
  const planned = Number(record.plannedQuantity);
  const consumed = Number(record.actualConsumption);
  if (!Number.isFinite(planned) || !Number.isFinite(consumed) || planned < 0 || consumed < 0 || consumed > planned) {
    throw new Error('Consumption and planned quantity must be valid non-negative numbers, and consumption cannot exceed production.');
  }
  const leftover = planned - consumed;
  return { leftover, wastePercent: planned === 0 ? 0 : (leftover / planned) * 100 };
}

export function formatRiskFromSurplus(planned, consumed) {
  if (!planned) return 'LOW';
  const rate = Math.max(0, planned - consumed) / planned;
  return rate >= 0.18 ? 'HIGH' : rate >= 0.08 ? 'MEDIUM' : 'LOW';
}

export const DEMO_MODEL_LABEL = 'Deterministic demo model';
