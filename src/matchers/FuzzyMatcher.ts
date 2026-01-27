
import { ISkillsMatcher, SkillMatch, GithubProfile, Evidence } from './ISkillsMatcher';
import { SkillIndex } from '../topcoder';

export class FuzzyMatcher implements ISkillsMatcher {
  name = 'Fuzzy Matcher';
  description = 'Legacy fuzzy matching (deprecated - use LanguageMatcher instead)';

  async match(profile: GithubProfile, skillIndex: SkillIndex): Promise<SkillMatch[]> {
    const skillScores: Map<string, SkillMatch> = new Map();
    
    // Extract all unique languages
    const languages = Array.from(profile.languages.keys());
    
    for (const lang of languages) {
      const frequency = profile.languages.get(lang) || 0;
      const term = lang.split(' ')[0];
      
      if (!term) continue;
      
      // Use skill index instead of API call
      const languageNormalized = term.toLowerCase();
      const matchedSkills = skillIndex.byLowerName.get(languageNormalized) || 
                           skillIndex.byKeyword.get(languageNormalized) || [];
      
      for (const skill of matchedSkills) {
        let score = 50;
        
        // Direct match
        if (skill.name.toLowerCase() === lang.toLowerCase()) {
          score = 100;
        } else if (skill.name.toLowerCase().includes(lang.toLowerCase())) {
          score = 80;
        } else if (lang.toLowerCase().includes(skill.name.toLowerCase())) {
          score = 70;
        }
        
        // Boost by frequency (more repos = higher confidence)
        score += Math.min(frequency * 5, 20);
        score = Math.min(score, 100);
        
        // Find evidence repos
        const evidence: Evidence[] = profile.repos
          .filter(repo => repo.languages && Object.keys(repo.languages).includes(lang))
          .map(repo => ({
            type: 'language' as const,
            source: repo.fullName,
            details: `${repo.contributions || 0} contributions`,
            url: `https://github.com/${repo.fullName}`
          }))
          .slice(0, 5);
        
        const existingMatch = skillScores.get(skill.id);
        if (!existingMatch || existingMatch.confidence < score) {
          skillScores.set(skill.id, {
            skillId: skill.id,
            skillName: skill.name,
            confidence: score,
            evidence,
            rationale: `Fuzzy matched via language '${lang}'. Found in ${frequency} repositories. Match type: ${score >= 100 ? 'exact' : score >= 80 ? 'contains' : 'related'}.`,
            sources: [this.name]
          });
        }
      }
    }
    
    return Array.from(skillScores.values()).sort((a, b) => b.confidence - a.confidence);
  }
}
