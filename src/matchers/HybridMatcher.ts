


import { ISkillsMatcher, SkillMatch, GithubProfile } from './ISkillsMatcher';
import chalk from 'chalk';

export class HybridMatcher implements ISkillsMatcher {
  name = 'Hybrid Matcher';
  description = 'Combines multiple matchers with weighted scoring';
  
  constructor(private matchers: ISkillsMatcher[]) {}
  
  async match(profile: GithubProfile, skillIndex: any): Promise<SkillMatch[]> {
    console.log(chalk.cyan(`\n   Running ${this.matchers.length} matching algorithms...\n`));
    
    // Run all matchers in parallel
    const results = await Promise.all(
      this.matchers.map(async matcher => {
        const startTime = Date.now();
        const matches = await matcher.match(profile, skillIndex);
        const elapsed = Date.now() - startTime;
        console.log(chalk.gray(`   [${matcher.name}] Completed in ${(elapsed / 1000).toFixed(2)}s`));
        return matches;
      })
    );
    
    console.log(chalk.gray('\n   Combining results...\n'));
    
    // Combine results with weighted scoring
    const skillMap: Map<string, SkillMatch> = new Map();
    
    // Assign weights to matchers (Language is most reliable)
    const weights = [1.0, 0.7, 0.5, 0.4]; // Decrease weight for each subsequent matcher
    
    results.forEach((matches, matcherIdx) => {
      const weight = weights[matcherIdx] || 0.3;
      const matcherName = this.matchers[matcherIdx].name;
      
      matches.forEach(match => {
        const existing = skillMap.get(match.skillId);
        
        if (!existing) {
          skillMap.set(match.skillId, {
            ...match,
            confidence: Math.round(match.confidence * weight),
            sources: [matcherName]
          });
        } else {
          // Combine scores with diminishing returns
          const additionalScore = match.confidence * weight * 0.4;
          existing.confidence = Math.min(100, existing.confidence + Math.round(additionalScore));
          
          // Merge evidence (unique only)
          const existingEvidenceKeys = new Set(
            existing.evidence.map(e => `${e.type}:${e.source}`)
          );
          match.evidence.forEach(ev => {
            const key = `${ev.type}:${ev.source}`;
            if (!existingEvidenceKeys.has(key)) {
              existing.evidence.push(ev);
              existingEvidenceKeys.add(key);
            }
          });
          
          // Combine sources
          if (!existing.sources.includes(matcherName)) {
            existing.sources.push(matcherName);
          }
          
          // Update rationale
          existing.rationale += `\n[${matcherName}] ${match.rationale}`;
        }
      });
    });
    
    const finalMatches = Array.from(skillMap.values())
      .sort((a, b) => b.confidence - a.confidence);
    
    console.log(chalk.green(`   ✓ Combined into ${finalMatches.length} unique skill matches\n`));
    
    return finalMatches;
  }
}
