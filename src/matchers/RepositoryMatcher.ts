import { ISkillsMatcher, SkillMatch, GithubProfile, Evidence } from './ISkillsMatcher';
import { SkillIndex } from '../topcoder';
import chalk from 'chalk';

/**
 * Matches skills based on repository names, descriptions, and topics
 */
export class RepositoryMatcher implements ISkillsMatcher {
  name = 'Repository Matcher';
  description = 'Analyzes repository metadata (names, descriptions, topics)';

  async match(profile: GithubProfile, skillIndex: SkillIndex): Promise<SkillMatch[]> {
    console.log(chalk.gray(`   [${this.name}] Analyzing ${profile.repos.length} repositories...`));
    
    const skillMatches = new Map<string, {
      skill: any;
      repos: Set<string>;
      topics: Set<string>;
      descriptions: Set<string>;
    }>();
    
    for (const repo of profile.repos) {
      // Extract keywords from repo name, description, and topics
      const keywords = new Set<string>();
      
      // From repo name
      repo.name.toLowerCase().split(/[\s\-_\.]+/).forEach(k => keywords.add(k));
      
      // From description
      if (repo.description) {
        repo.description.toLowerCase()
          .split(/[\s\-_\.\,\;]+/)
          .filter(w => w.length > 3)
          .forEach(k => keywords.add(k));
      }
      
      // From topics
      repo.topics.forEach(t => {
        t.toLowerCase().split(/[\s\-_]+/).forEach(k => keywords.add(k));
      });
      
      // Match keywords against skill index
      for (const keyword of keywords) {
        const matchedSkills = skillIndex.byKeyword.get(keyword) || [];
        
        for (const skill of matchedSkills) {
          if (!skillMatches.has(skill.id)) {
            skillMatches.set(skill.id, {
              skill,
              repos: new Set(),
              topics: new Set(),
              descriptions: new Set()
            });
          }
          
          const match = skillMatches.get(skill.id)!;
          match.repos.add(repo.fullName);
          
          if (repo.topics.some(t => t.toLowerCase().includes(keyword))) {
            match.topics.add(keyword);
          }
          if (repo.description?.toLowerCase().includes(keyword)) {
            match.descriptions.add(keyword);
          }
        }
      }
    }
    
    // Convert to SkillMatch array
    const matches: SkillMatch[] = [];
    
    for (const [skillId, match] of skillMatches.entries()) {
      const repoCount = match.repos.size;
      const topicCount = match.topics.size;
      const descCount = match.descriptions.size;
      
      // Calculate confidence
      let confidence = 30 + (repoCount * 5) + (topicCount * 8) + (descCount * 3);
      confidence = Math.min(confidence, 95);
      
      // Gather evidence
      const evidence: Evidence[] = [
        ...Array.from(match.repos).slice(0, 3).map(repo => ({
          type: 'repo' as const,
          source: repo,
          details: 'Repository name or description match',
          url: `https://github.com/${repo}`
        })),
        ...Array.from(match.topics).slice(0, 2).map(topic => ({
          type: 'topic' as const,
          source: topic,
          details: 'Repository topic'
        }))
      ];
      
      matches.push({
        skillId: match.skill.id,
        skillName: match.skill.name,
        confidence,
        evidence,
        rationale: `Found in ${repoCount} repository metadata (${topicCount} topics, ${descCount} descriptions).`,
        sources: [this.name]
      });
    }
    
    console.log(chalk.gray(`   [${this.name}] Found ${matches.length} skill matches`));
    return matches.sort((a, b) => b.confidence - a.confidence);
  }
}