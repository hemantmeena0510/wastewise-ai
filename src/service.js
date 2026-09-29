import { predictDemand } from './engine.js';

export const predictionService = {
  predict(input) {
    return Promise.resolve().then(() => predictDemand(input));
  },
};

export const apiContract = {
  predictDemand: { method: 'POST', path: '/api/predict-demand' },
  simulate: { method: 'POST', path: '/api/simulate' },
  uploadData: { method: 'POST', path: '/api/upload-data' },
  analytics: { method: 'GET', path: '/api/analytics' },
  predictions: { method: 'GET', path: '/api/predictions' },
  recommendations: { method: 'GET', path: '/api/recommendations' },
  impact: { method: 'GET', path: '/api/impact' },
  insights: { method: 'GET', path: '/api/insights' },
};
