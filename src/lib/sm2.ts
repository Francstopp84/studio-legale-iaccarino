export interface SM2Card {
  easiness: number;
  interval: number;
  repetitions: number;
}

export interface SM2Result extends SM2Card {
  nextReview: Date;
}

/**
 * SM-2 Algorithm for spaced repetition
 * quality: 0-5 (0=complete blackout, 5=perfect response)
 */
export function sm2(card: SM2Card, quality: number): SM2Result {
  let { easiness, interval, repetitions } = card;

  // Clamp quality 0-5
  quality = Math.max(0, Math.min(5, quality));

  // Update easiness factor
  easiness = Math.max(1.3, easiness + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));

  if (quality < 3) {
    // Failed: reset
    repetitions = 0;
    interval = 0;
  } else {
    // Passed
    repetitions += 1;
    if (repetitions === 1) {
      interval = 1;
    } else if (repetitions === 2) {
      interval = 6;
    } else {
      interval = Math.round(interval * easiness);
    }
  }

  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + interval);

  return { easiness, interval, repetitions, nextReview };
}

export function qualityFromScore(correct: boolean, timeMs: number): number {
  if (!correct) return 1;
  if (timeMs < 3000) return 5;
  if (timeMs < 6000) return 4;
  if (timeMs < 12000) return 3;
  return 3;
}
