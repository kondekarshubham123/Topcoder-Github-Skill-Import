import { ISkillsMatcher, SkillMatch, GithubProfile, Evidence } from './ISkillsMatcher';
import { SkillIndex } from '../topcoder';
import chalk from 'chalk';

/**
 * Direct language matching - most reliable method
 * Matches programming languages from repos to Topcoder skills
 */
export class LanguageMatcher implements ISkillsMatcher {
  name = 'Language Matcher';
  description = 'Matches programming languages from repositories to skills';

  async match(profile: GithubProfile, skillIndex: SkillIndex): Promise<SkillMatch[]> {
    // Input Validation
    if (!profile || !profile.languages ) {
      throw new Error('Invalid profile: missing languages data');
    }
    if (!skillIndex || !skillIndex.byLowerName || !skillIndex.byKeyword) {
      throw new Error('Invalid skill index: missing required indexes');
    }
    console.log(chalk.gray(`   [${this.name}] Analyzing ${profile.languages.size} languages...`));
    
    const matches: SkillMatch[] = [];
    
    for (const [language, repoCount] of profile.languages.entries()) {
      // Sanitize language input
      if (typeof language !== 'string' || language.trim().length === 0) {
        continue;
      }
      if(typeof repoCount !== 'number' || repoCount <= 0) {
        continue;
      }

      const languageNormalized = language.trim().toLowerCase().substring(0, 100);
      
      // Try exact match first
      let matchedSkills = skillIndex.byLowerName.get(languageNormalized) || [];
      
      // If no exact match, try partial matches
      if (matchedSkills.length === 0) {
        const keyword = languageNormalized.split(/[\s\-_]+/)[0];
        matchedSkills = skillIndex.byKeyword.get(keyword) || [];
      }
      
      for (const skill of matchedSkills) {
        // Calculate confidence based on:
        // 1. Match quality (exact vs partial)
        // 2. Number of repos using this language
        // 3. Contribution activity
        
        const isExactMatch = skill.name.toLowerCase() === languageNormalized;
        const isContainsMatch = skill.name.toLowerCase().includes(languageNormalized);
        
        let confidence = 40; // Base score
        
        if (isExactMatch) {
          confidence = 95;
        } else if (isContainsMatch) {
          confidence = 75;
        } else if (languageNormalized.includes(skill.name.toLowerCase())) {
          confidence = 60;
        }
        
        // Boost by number of repos (max +20)
        confidence += Math.min(repoCount * 3, 20);
        confidence = Math.min(confidence, 100);
        
        // Gather evidence
        const evidence: Evidence[] = profile.repos
          .filter(repo => Object.keys(repo.languages).some(
            lang => lang.toLowerCase() === languageNormalized
          ))
          .map(repo => ({
            type: 'language' as const,
            source: repo.fullName,
            details: `${repo.contributions || 0} contributions`,
            url: `https://github.com/${repo.fullName}`
          }))
          .slice(0, 5);
        
        matches.push({
          skillId: skill.id,
          skillName: skill.name,
          confidence,
          evidence,
          rationale: `Programming language '${language}' found in ${repoCount} repositories. Match type: ${
            isExactMatch ? 'exact' : isContainsMatch ? 'contains' : 'related'
          }.`,
          sources: [this.name]
        });
      }
    }
    
    console.log(chalk.gray(`   [${this.name}] Found ${matches.length} skill matches`));
    return matches.sort((a, b) => b.confidence - a.confidence);
  }
}