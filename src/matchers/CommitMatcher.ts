
import { ISkillsMatcher, SkillMatch, GithubProfile, Evidence } from './ISkillsMatcher';
import { SkillIndex } from '../topcoder';
import chalk from 'chalk';

/**
 * Analyzes commit messages and file changes to infer skills
 */
export class CommitMatcher implements ISkillsMatcher {
  name = 'Commit Matcher';
  description = 'Analyzes commit messages and file changes';

  async match(profile: GithubProfile, skillIndex: SkillIndex): Promise<SkillMatch[]> {
    if (!profile.commits || profile.commits.length === 0) {
      console.log(chalk.gray(`   [${this.name}] No commits to analyze`));
      return [];
    }
    
    console.log(chalk.gray(`   [${this.name}] Analyzing ${profile.commits.length} commits...`));
    
    const skillMatches = new Map<string, {
      skill: any;
      commits: Set<string>;
      files: Set<string>;
      keywords: Set<string>;
    }>();
    
    // File extension to skill mapping
    const extensionSkills = this.buildExtensionMap(skillIndex);
    
    for (const commit of profile.commits) {
      // Extract keywords from commit message
      const messageKeywords = commit.message.toLowerCase()
        .split(/[\s\-_\.\,\;\:\(\)\[\]]+/)
        .filter(w => w.length > 3);
      
      // Analyze file extensions
      const extensions = commit.files
        .map(f => f.split('.').pop()?.toLowerCase())
        .filter(Boolean);
      
      // Match commit message keywords
      for (const keyword of messageKeywords) {
        const matchedSkills = skillIndex.byKeyword.get(keyword) || [];
        
        for (const skill of matchedSkills) {
          if (!skillMatches.has(skill.id)) {
            skillMatches.set(skill.id, {
              skill,
              commits: new Set(),
              files: new Set(),
              keywords: new Set()
            });
          }
          
          const match = skillMatches.get(skill.id)!;
          match.commits.add(`${commit.repo}:${commit.message.substring(0, 50)}`);
          match.keywords.add(keyword);
        }
      }
      
      // Match file extensions
      for (const ext of extensions) {
        const skills = extensionSkills.get(ext!) || [];
        
        for (const skill of skills) {
          if (!skillMatches.has(skill.id)) {
            skillMatches.set(skill.id, {
              skill,
              commits: new Set(),
              files: new Set(),
              keywords: new Set()
            });
          }
          
          const match = skillMatches.get(skill.id)!;
          match.files.add(ext!);
          commit.files.forEach(f => match.commits.add(`${commit.repo}:${f}`));
        }
      }
    }
    
    // Convert to SkillMatch array
    const matches: SkillMatch[] = [];
    
    for (const [skillId, match] of skillMatches.entries()) {
      const commitCount = match.commits.size;
      const fileTypeCount = match.files.size;
      const keywordCount = match.keywords.size;
      
      // Calculate confidence
      let confidence = 25 + (commitCount * 3) + (fileTypeCount * 10) + (keywordCount * 5);
      confidence = Math.min(confidence, 90);
      
      // Gather evidence
      const evidence: Evidence[] = [
        ...Array.from(match.commits).slice(0, 3).map(commit => ({
          type: 'commit' as const,
          source: commit,
          details: 'Commit message or file change'
        })),
        ...Array.from(match.files).map(ext => ({
          type: 'file' as const,
          source: `.${ext}`,
          details: 'File extension'
        }))
      ];
      
      matches.push({
        skillId: match.skill.id,
        skillName: match.skill.name,
        confidence,
        evidence,
        rationale: `Found in ${commitCount} commits (${fileTypeCount} file types, ${keywordCount} keywords).`,
        sources: [this.name]
      });
    }
    
    console.log(chalk.gray(`   [${this.name}] Found ${matches.length} skill matches`));
    return matches.sort((a, b) => b.confidence - a.confidence);
  }
  
  private buildExtensionMap(skillIndex: SkillIndex): Map<string, any[]> {
    const map = new Map<string, any[]>();
    
    // Common file extension mappings
    const extensionMappings: { [key: string]: string[] } = {
      'js': ['javascript', 'nodejs', 'node'],
      'ts': ['typescript'],
      'py': ['python'],
      'java': ['java'],
      'rb': ['ruby'],
      'go': ['golang', 'go'],
      'rs': ['rust'],
      'cpp': ['c++', 'cpp'],
      'c': ['c'],
      'cs': ['c#', 'csharp'],
      'php': ['php'],
      'swift': ['swift'],
      'kt': ['kotlin'],
      'scala': ['scala'],
      'html': ['html'],
      'css': ['css'],
      'scss': ['sass', 'scss'],
      'sql': ['sql'],
      'json': ['json'],
      'xml': ['xml'],
      'yaml': ['yaml'],
      'yml': ['yaml'],
      'md': ['markdown'],
      'sh': ['bash', 'shell'],
      'dockerfile': ['docker'],
      'tf': ['terraform']
    };
    
    for (const [ext, keywords] of Object.entries(extensionMappings)) {
      const skills: any[] = [];
      
      for (const keyword of keywords) {
        const matched = skillIndex.byKeyword.get(keyword) || [];
        skills.push(...matched);
      }
      
      if (skills.length > 0) {
        map.set(ext, skills);
      }
    }
    
    return map;
  }
}