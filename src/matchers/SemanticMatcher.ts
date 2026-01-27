import { ISkillsMatcher, SkillMatch, GithubProfile, Evidence } from './ISkillsMatcher';
import { SkillIndex } from '../topcoder';

export class SemanticMatcher implements ISkillsMatcher {
  name = 'Semantic Matcher';
  description = 'Legacy semantic matching (deprecated - use HybridMatcher instead)';
  
  async match(profile: GithubProfile, skillIndex: SkillIndex): Promise<SkillMatch[]> {
    // Build rich profile text
    const languages = Array.from(profile.languages.keys()).join(', ');
    const topics = Array.from(
      new Set(profile.repos.flatMap(r => r.topics || []))
    ).join(', ');
    
    const repoDescriptions = profile.repos
      .filter(r => r.description)
      .map(r => r.description)
      .join('. ');
    
    // Use keyword-based matching from skill index
    const matches: SkillMatch[] = [];
    const allKeywords = new Set<string>([
      ...languages.toLowerCase().split(/[\s,]+/),
      ...topics.toLowerCase().split(/[\s,]+/),
      ...repoDescriptions.toLowerCase().split(/[\s\.\,]+/)
    ].filter(k => k.length > 3));
    
    const skillMatches = new Map<string, { skill: any; score: number; keywords: Set<string> }>();
    
    for (const keyword of allKeywords) {
      const matchedSkills = skillIndex.byKeyword.get(keyword) || [];
      
      for (const skill of matchedSkills) {
        if (!skillMatches.has(skill.id)) {
          skillMatches.set(skill.id, {
            skill,
            score: 0,
            keywords: new Set()
          });
        }
        
        const match = skillMatches.get(skill.id)!;
        match.score += 10;
        match.keywords.add(keyword);
      }
    }
    
    for (const [skillId, match] of skillMatches.entries()) {
      const confidence = Math.min(30 + match.score, 90);
      
      const evidence: Evidence[] = [
        {
          type: 'topic' as const,
          source: Array.from(match.keywords).slice(0, 5).join(', '),
          details: 'Semantic keyword match'
        }
      ];
      
      matches.push({
        skillId: match.skill.id,
        skillName: match.skill.name,
        confidence,
        evidence,
        rationale: `Semantic match based on ${match.keywords.size} keywords from profile.`,
        sources: [this.name]
      });
    }
    
    return matches.sort((a, b) => b.confidence - a.confidence).slice(0, 20);
  }
}