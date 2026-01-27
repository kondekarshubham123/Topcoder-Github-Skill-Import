import { ISkillsMatcher, SkillMatch, GithubProfile, Evidence } from './ISkillsMatcher';
import { SkillIndex } from '../topcoder';
import chalk from 'chalk';

/**
 * Analyzes pull request titles, descriptions, and labels
 */
export class PullRequestMatcher implements ISkillsMatcher {
  name = 'Pull Request Matcher';
  description = 'Analyzes PR titles, descriptions, and labels';

  async match(profile: GithubProfile, skillIndex: SkillIndex): Promise<SkillMatch[]> {
    if (!profile.pullRequests || profile.pullRequests.length === 0) {
      console.log(chalk.gray(`   [${this.name}] No pull requests to analyze`));
      return [];
    }
    
    console.log(chalk.gray(`   [${this.name}] Analyzing ${profile.pullRequests.length} pull requests...`));
    
    const skillMatches = new Map<string, {
      skill: any;
      prs: Set<string>;
      labels: Set<string>;
      keywords: Set<string>;
    }>();
    
    for (const pr of profile.pullRequests) {
      // Extract keywords from title and description
      const text = `${pr.title} ${pr.description}`.toLowerCase();
      const keywords = text
        .split(/[\s\-_\.\,\;\:\(\)\[\]]+/)
        .filter(w => w.length > 3);
      
      // Match keywords against skills
      for (const keyword of keywords) {
        const matchedSkills = skillIndex.byKeyword.get(keyword) || [];
        
        for (const skill of matchedSkills) {
          if (!skillMatches.has(skill.id)) {
            skillMatches.set(skill.id, {
              skill,
              prs: new Set(),
              labels: new Set(),
              keywords: new Set()
            });
          }
          
          const match = skillMatches.get(skill.id)!;
          match.prs.add(`${pr.repo}: ${pr.title}`);
          match.keywords.add(keyword);
        }
      }
      
      // Match labels
      for (const label of pr.labels) {
        const labelKeywords = label.toLowerCase().split(/[\s\-_]+/);
        
        for (const keyword of labelKeywords) {
          const matchedSkills = skillIndex.byKeyword.get(keyword) || [];
          
          for (const skill of matchedSkills) {
            if (!skillMatches.has(skill.id)) {
              skillMatches.set(skill.id, {
                skill,
                prs: new Set(),
                labels: new Set(),
                keywords: new Set()
              });
            }
            
            const match = skillMatches.get(skill.id)!;
            match.labels.add(label);
            match.prs.add(`${pr.repo}: ${pr.title}`);
          }
        }
      }
    }
    
    // Convert to SkillMatch array
    const matches: SkillMatch[] = [];
    
    for (const [skillId, match] of skillMatches.entries()) {
      const prCount = match.prs.size;
      const labelCount = match.labels.size;
      const keywordCount = match.keywords.size;
      
      // Calculate confidence
      let confidence = 20 + (prCount * 8) + (labelCount * 5) + (keywordCount * 2);
      confidence = Math.min(confidence, 85);
      
      // Gather evidence
      const evidence: Evidence[] = [
        ...Array.from(match.prs).slice(0, 3).map(pr => ({
          type: 'pr' as const,
          source: pr,
          details: 'Pull request title or description'
        })),
        ...Array.from(match.labels).slice(0, 2).map(label => ({
          type: 'pr' as const,
          source: label,
          details: 'PR label'
        }))
      ];
      
      matches.push({
        skillId: match.skill.id,
        skillName: match.skill.name,
        confidence,
        evidence,
        rationale: `Found in ${prCount} pull requests (${labelCount} labels, ${keywordCount} keywords).`,
        sources: [this.name]
      });
    }
    
    console.log(chalk.gray(`   [${this.name}] Found ${matches.length} skill matches`));
    return matches.sort((a, b) => b.confidence - a.confidence);
  }
}