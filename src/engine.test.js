import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateRecordMetrics, predictDemand } from './engine.js';

const baseInput = {
  attendance: 800,
  temperature: 34,
  menu: 'Rajma + Rice + Roti',
  dayOfWeek: 'Wednesday',
  holiday: false,
  event: false,
  plannedProduction: 800,
};

test('demo predictions are deterministic and match the dashboard example', () => {
  assert.deepEqual(predictDemand(baseInput), predictDemand(baseInput));
  assert.equal(predictDemand(baseInput).predictedConsumption, 687);
  assert.equal(predictDemand(baseInput).recommendedProduction, 700);
  const lowerAttendance = predictDemand({ ...baseInput, attendance: 600 });
  assert.equal(lowerAttendance.predictedConsumption, 558);
  assert.equal(lowerAttendance.recommendedProduction, 570);
  assert.equal(lowerAttendance.recommendedSurplus, 12);
});

test('attendance and conditions affect predicted demand', () => {
  assert.ok(predictDemand({ ...baseInput, attendance: 600 }).predictedConsumption < predictDemand(baseInput).predictedConsumption);
  assert.ok(predictDemand({ ...baseInput, event: true }).predictedConsumption > predictDemand(baseInput).predictedConsumption);
});

test('waste risk reflects the current plan surplus thresholds', () => {
  assert.equal(predictDemand({ ...baseInput, plannedProduction: 700 }).wasteRisk, 'LOW');
  assert.equal(predictDemand({ ...baseInput, plannedProduction: 800 }).wasteRisk, 'MEDIUM');
  assert.equal(predictDemand({ ...baseInput, plannedProduction: 1000 }).wasteRisk, 'HIGH');
});

test('invalid prediction inputs are rejected', () => {
  assert.throws(() => predictDemand({ ...baseInput, attendance: -1 }), /valid/);
  assert.throws(() => predictDemand({ ...baseInput, temperature: 90 }), /valid/);
  assert.throws(() => predictDemand({ ...baseInput, attendance: '' }), /Enter attendance/);
  assert.throws(() => predictDemand({ ...baseInput, safetyBufferPercent: 26 }), /safety buffer from 0% to 25%/);
  assert.equal(predictDemand({ ...baseInput, safetyBufferPercent: 0 }).recommendedProduction, 687);
  assert.equal(predictDemand({ ...baseInput, safetyBufferPercent: 5 }).recommendedProduction, 720);
});

test('record metrics calculate leftovers and reject inconsistent consumption', () => {
  assert.deepEqual(calculateRecordMetrics({ plannedQuantity: 800, actualConsumption: 720 }), { leftover: 80, wastePercent: 10 });
  assert.throws(() => calculateRecordMetrics({ plannedQuantity: 500, actualConsumption: 520 }), /cannot exceed/);
});
