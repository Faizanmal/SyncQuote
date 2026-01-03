import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class StatisticalAnalysisService {
  private readonly logger = new Logger(StatisticalAnalysisService.name);

  // Calculate standard error for a proportion
  calculateStandardError(proportion: number, sampleSize: number): number {
    if (sampleSize === 0) return 0;
    return Math.sqrt((proportion * (1 - proportion)) / sampleSize);
  }

  // Calculate confidence interval
  calculateConfidenceInterval(
    proportion: number,
    sampleSize: number,
    confidenceLevel: number = 0.95,
  ): { lower: number; upper: number } {
    if (sampleSize === 0) return { lower: 0, upper: 0 };

    const zScore = this.getZScore(confidenceLevel);
    const standardError = this.calculateStandardError(proportion, sampleSize);
    const marginOfError = zScore * standardError;

    return {
      lower: Math.max(0, proportion - marginOfError),
      upper: Math.min(1, proportion + marginOfError),
    };
  }

  // Calculate p-value using two-proportion z-test
  calculatePValue(
    conversionsA: number,
    impressionsA: number,
    conversionsB: number,
    impressionsB: number,
  ): number {
    if (impressionsA === 0 || impressionsB === 0) return 1;

    const p1 = conversionsA / impressionsA;
    const p2 = conversionsB / impressionsB;

    // Pooled proportion
    const pPooled = (conversionsA + conversionsB) / (impressionsA + impressionsB);

    // Standard error of difference
    const se = Math.sqrt(pPooled * (1 - pPooled) * (1 / impressionsA + 1 / impressionsB));

    if (se === 0) return 1;

    // Z-score
    const z = Math.abs(p1 - p2) / se;

    // Two-tailed p-value using normal approximation
    return 2 * (1 - this.normalCDF(z));
  }

  // Calculate statistical power
  calculateStatisticalPower(variants: any[], minSampleSize: number): number {
    const control = variants.find((v) => v.isControl);
    if (!control || control.conversions < 10) return 0;

    const treatments = variants.filter((v) => !v.isControl);
    if (treatments.length === 0) return 0;

    // Estimate effect size from observed data
    const avgTreatmentRate =
      treatments.reduce((sum, t) => sum + t.conversionRate, 0) / treatments.length;
    const effectSize = Math.abs(avgTreatmentRate - control.conversionRate);

    // Cohen's h (effect size for proportions)
    const h =
      2 * Math.asin(Math.sqrt(avgTreatmentRate)) - 2 * Math.asin(Math.sqrt(control.conversionRate));
    const absH = Math.abs(h);

    // Approximate power calculation
    const avgSampleSize = variants.reduce((sum, v) => sum + v.impressions, 0) / variants.length;

    // Power increases with sample size and effect size
    const ncp = absH * Math.sqrt(avgSampleSize / 2); // Non-centrality parameter

    // Simplified power approximation
    const power = this.normalCDF(ncp - 1.96);

    return Math.min(1, Math.max(0, power));
  }

  // Chi-square test for goodness of fit
  calculateChiSquare(
    observed: number[],
    expected: number[],
  ): { chiSquare: number; pValue: number } {
    if (observed.length !== expected.length || observed.length < 2) {
      return { chiSquare: 0, pValue: 1 };
    }

    let chiSquare = 0;
    for (let i = 0; i < observed.length; i++) {
      if (expected[i] > 0) {
        chiSquare += Math.pow(observed[i] - expected[i], 2) / expected[i];
      }
    }

    const df = observed.length - 1;
    const pValue = 1 - this.chiSquareCDF(chiSquare, df);

    return { chiSquare, pValue };
  }

  // Calculate minimum sample size needed
  calculateMinSampleSize(
    baselineRate: number,
    minimumDetectableEffect: number, // As percentage change
    power: number = 0.8,
    alpha: number = 0.05,
  ): number {
    const targetRate = baselineRate * (1 + minimumDetectableEffect / 100);

    // Cohen's h
    const h = 2 * Math.asin(Math.sqrt(targetRate)) - 2 * Math.asin(Math.sqrt(baselineRate));

    // Z-scores for alpha and power
    const zAlpha = this.getZScore(1 - alpha / 2);
    const zBeta = this.getZScore(power);

    // Sample size per group
    const n = Math.ceil(2 * Math.pow((zAlpha + zBeta) / h, 2));

    return Math.max(100, n);
  }

  // Calculate Bayesian probability of being best
  calculateBayesianProbability(variants: any[]): Map<string, number> {
    const probabilities = new Map<string, number>();
    const numSimulations = 10000;
    const wins = new Map<string, number>();

    variants.forEach((v) => wins.set(v.variantId, 0));

    // Monte Carlo simulation
    for (let i = 0; i < numSimulations; i++) {
      let bestVariant = '';
      let bestValue = -1;

      for (const variant of variants) {
        // Sample from Beta distribution (Bayesian)
        const alpha = variant.conversions + 1;
        const beta = variant.impressions - variant.conversions + 1;
        const sample = this.betaSample(alpha, beta);

        if (sample > bestValue) {
          bestValue = sample;
          bestVariant = variant.variantId;
        }
      }

      if (bestVariant) {
        wins.set(bestVariant, (wins.get(bestVariant) || 0) + 1);
      }
    }

    variants.forEach((v) => {
      probabilities.set(v.variantId, (wins.get(v.variantId) || 0) / numSimulations);
    });

    return probabilities;
  }

  // Helper: Get Z-score for confidence level
  private getZScore(confidenceLevel: number): number {
    // Common z-scores
    const zScores: Record<number, number> = {
      0.9: 1.645,
      0.95: 1.96,
      0.99: 2.576,
      0.8: 1.282,
      0.85: 1.44,
    };

    const rounded = Math.round(confidenceLevel * 100) / 100;
    return zScores[rounded] || 1.96;
  }

  // Helper: Normal CDF approximation
  private normalCDF(x: number): number {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return 0.5 * (1.0 + sign * y);
  }

  // Helper: Chi-square CDF approximation
  private chiSquareCDF(x: number, df: number): number {
    if (x <= 0) return 0;
    if (df <= 0) return 0;

    // Using Wilson-Hilferty approximation
    const z = Math.pow(x / df, 1 / 3) - (1 - 2 / (9 * df));
    const denom = Math.sqrt(2 / (9 * df));

    return this.normalCDF(z / denom);
  }

  // Helper: Beta distribution sample using Box-Muller + gamma
  private betaSample(alpha: number, beta: number): number {
    const x = this.gammaSample(alpha);
    const y = this.gammaSample(beta);
    return x / (x + y);
  }

  // Helper: Gamma distribution sample (Marsaglia and Tsang's method)
  private gammaSample(shape: number): number {
    if (shape < 1) {
      return this.gammaSample(1 + shape) * Math.pow(Math.random(), 1 / shape);
    }

    const d = shape - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);

    while (true) {
      let x, v;
      do {
        x = this.normalSample();
        v = 1 + c * x;
      } while (v <= 0);

      v = v * v * v;
      const u = Math.random();

      if (u < 1 - 0.0331 * x * x * x * x) return d * v;
      if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
    }
  }

  // Helper: Standard normal sample using Box-Muller
  private normalSample(): number {
    const u1 = Math.random();
    const u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }
}
