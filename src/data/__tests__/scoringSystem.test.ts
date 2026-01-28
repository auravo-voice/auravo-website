import { calculateArchetypeScores, getArchetypeColor, type QuizAnswer } from '../scoringSystem';

describe('scoringSystem', () => {
  describe('calculateArchetypeScores', () => {
    it('calculates scores correctly for all Analyst answers', () => {
      const answers: QuizAnswer[] = [
        { archetype: 'Analyst' },
        { archetype: 'Analyst' },
        { archetype: 'Analyst' },
      ];

      const result = calculateArchetypeScores(answers);

      expect(result.archetype).toBe('Analyst');
      expect(result.scores.Analyst).toBeGreaterThan(0);
      expect(result.totalAnswers).toBe(3);
    });

    it('calculates percentages correctly', () => {
      const answers: QuizAnswer[] = [
        { archetype: 'Analyst' },
        { archetype: 'Connector' },
        { archetype: 'Analyst' },
        { archetype: 'Analyst' },
      ];

      const result = calculateArchetypeScores(answers);

      expect(result.percentages.Analyst).toBeGreaterThan(result.percentages.Connector);
      expect(result.totalAnswers).toBe(4);
    });

    it('handles empty answers array', () => {
      const answers: (QuizAnswer | null)[] = [];
      const result = calculateArchetypeScores(answers);

      expect(result.totalAnswers).toBe(0);
      expect(result.allArchetypes).toHaveLength(4);
    });

    it('handles null answers', () => {
      const answers: (QuizAnswer | null)[] = [
        { archetype: 'Analyst' },
        null,
        { archetype: 'Connector' },
      ];

      const result = calculateArchetypeScores(answers);

      expect(result.totalAnswers).toBe(3);
    });
  });

  describe('getArchetypeColor', () => {
    it('returns correct color for Analyst', () => {
      expect(getArchetypeColor('Analyst')).toBe('#3B82F6');
    });

    it('returns correct color for Connector', () => {
      expect(getArchetypeColor('Connector')).toBe('#F97316');
    });

    it('returns correct color for Leader', () => {
      expect(getArchetypeColor('Leader')).toBe('#8B5CF6');
    });

    it('returns correct color for Hidden Voice', () => {
      expect(getArchetypeColor('Hidden Voice')).toBe('#10B981');
    });

    it('returns default color for unknown archetype', () => {
      expect(getArchetypeColor('Unknown')).toBe('#6B8F71');
    });
  });
});

