import { ISkillsMatcher, SkillMatch, GithubProfile, Evidence } from './ISkillsMatcher';
import { SkillIndex } from '../topcoder';
import { ISemanticProvider } from './providers/OpenAIProvider';
import chalk from 'chalk';

export class SemanticMatcher implements ISkillsMatcher {
  name = 'Semantic Matcher';
  description = 'AI-powered semantic matching with embeddings';
  private aiProvider?: ISemanticProvider;
  
  constructor(aiProvider?: ISemanticProvider) {
    this.aiProvider = aiProvider;
    if (aiProvider) {
      this.description = `Semantic matching using ${aiProvider.name}`;
    } else {
      this.description = 'Keyword-based semantic matching (no AI)';
    }
  }
  
  async match(profile: GithubProfile, skillIndex: SkillIndex): Promise<SkillMatch[]> {
    if (this.aiProvider) {
      return this.matchWithAI(profile, skillIndex);
    } else {
      return this.matchWithKeywords(profile, skillIndex);
    }
  }
  
  private async matchWithAI(profile: GithubProfile, skillIndex: SkillIndex): Promise<SkillMatch[]> {
    console.log(chalk.gray(`   [${this.name}] Using ${this.aiProvider!.name} for semantic matching...`));
    
    // Build rich profile text
    const languages = Array.from(profile.languages.keys()).join(', ');
    const topics = Array.from(
      new Set(profile.repos.flatMap(r => r.topics || []))
    ).join(', ');
    
    const repoDescriptions = profile.repos
      .filter(r => r.description)
      .slice(0, 10) // Limit to avoid huge API costs
      .map(r => r.description)
      .join('. ');
    
    const profileText = `Programming languages: ${languages}. Topics: ${topics}. Projects: ${repoDescriptions}`;
    
    // Try LLM-based matching first if available (more accurate)
    if (this.aiProvider!.supportsLLM && this.aiProvider!.matchSkillsWithLLM) {
      console.log(chalk.gray(`   Using LLM-based skill matching (GenAI)...`));
      return this.matchWithLLM(profileText, skillIndex);
    }
    
    // Fallback to embedding-based matching
    console.log(chalk.gray(`   Using embedding-based similarity matching...`));
    return this.matchWithEmbeddings(profileText, skillIndex);
  }
  
  // LLM-based matching - uses AI reasoning for better accuracy
  private async matchWithLLM(profileText: string, skillIndex: SkillIndex): Promise<SkillMatch[]> {
    const topSkills = skillIndex.all.slice(0, 50); // Limit for LLM context
    
    console.log(chalk.gray(`   Analyzing ${topSkills.length} skills with GenAI...`));
    
    const llmResults = await this.aiProvider!.matchSkillsWithLLM!(
      profileText,
      topSkills.map(s => ({ id: s.id, name: s.name, description: s.description }))
    );
    
    const matches: SkillMatch[] = llmResults.map(result => ({
      skillId: result.skillId,
      skillName: skillIndex.all.find(s => s.id === result.skillId)?.name || 'Unknown',
      confidence: result.confidence,
      evidence: [
        {
          type: 'topic' as const,
          source: `${this.aiProvider!.name} LLM Analysis`,
          details: result.reasoning
        }
      ],
      rationale: `GenAI analysis: ${result.reasoning}`,
      sources: [this.name]
    }));
    
    console.log(chalk.green(`   ✓ Found ${matches.length} skills via LLM matching`));
    return matches.sort((a, b) => b.confidence - a.confidence);
  }
  
  // Embedding-based matching - traditional semantic similarity
  private async matchWithEmbeddings(profileText: string, skillIndex: SkillIndex): Promise<SkillMatch[]> {
    const matches: SkillMatch[] = [];
    const topSkills = skillIndex.all.slice(0, 100); // Limit skills to check for cost
    
    console.log(chalk.gray(`   Computing semantic similarity for ${topSkills.length} skills...`));
    
    // Compute similarities in batches
    const batchSize = 10;
    for (let i = 0; i < topSkills.length; i += batchSize) {
      const batch = topSkills.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (skill) => {
        const skillText = `${skill.name}. ${skill.description || ''}`;
        const similarity = await this.aiProvider!.computeSimilarity(profileText, skillText);
        
        // Convert similarity (0-1) to confidence (0-100)
        const confidence = Math.round(similarity * 100);
        
        if (confidence >= 30) { // Only include reasonable matches
          const evidence: Evidence[] = [
            {
              type: 'topic' as const,
              source: `AI Similarity: ${similarity.toFixed(3)}`,
              details: `Semantic match with ${this.aiProvider!.name}`
            }
          ];
          
          matches.push({
            skillId: skill.id,
            skillName: skill.name,
            confidence,
            evidence,
            rationale: `AI-powered semantic match (${similarity.toFixed(3)} similarity) based on profile analysis.`,
            sources: [this.name]
          });
        }
      }));
      
      // Simple progress without verbose check
      if (i % batchSize === 0 && i > 0) {
        console.log(chalk.gray(`   Processed ${i}/${topSkills.length} skills`));
      }
    }
    
    return matches.sort((a, b) => b.confidence - a.confidence).slice(0, 20);
  }
  
  private async matchWithKeywords(profile: GithubProfile, skillIndex: SkillIndex): Promise<SkillMatch[]> {
    console.log(chalk.gray(`   [${this.name}] Using keyword-based matching...`));
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