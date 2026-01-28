import axios from 'axios';
import chalk from 'chalk';

const BASE = 'https://api.topcoder-dev.com/v5/standardized-skills';

export interface TopcoderSkill {
  id: string;
  name: string;
  description?: string;
  metadata?: {
    category?: string;
    subcategory?: string;
  };
}

/**
 * Fetch all standardized skills from Topcoder API
 * This is the ONLY API we need - we'll do all matching locally
 */
export async function fetchAllSkills(): Promise<TopcoderSkill[]> {
  console.log(chalk.gray('   Fetching all Topcoder skills...'));
  
  try {
    const resp = await axios.get(`${BASE}/skills`, {
      params: { 
        page: 1,
        perPage: 10000 // Get all skills in one call
      },
      timeout: 30000, // 30 seconds timeout
      headers: {
        'Accept': 'application/json'
      }
    });
    
    // Validate response
    if (!resp.data || !Array.isArray(resp.data)) {
      throw new Error('Invalid response from Topcoder skills API: expected an array of skills');
    }

    const skills = resp.data;
    console.log(chalk.green(`   ✓ Loaded ${skills.length} skills from Topcoder`));
    
    return skills;
  } catch (err: any) {
    if (err.code === 'ECONNABORTED' || err.message.includes('timeout')) {
      console.error(chalk.red('   ✗ Request to Topcoder skills API timed out. Please check your network connection and try again.'));
    } else if (err.response) {
      console.error(chalk.red(`   ✗ Topcoder skills API returned error ${err.response.status}: ${err.response.statusText}`));
    } else {
      console.error(chalk.red(`   ✗ Error fetching Topcoder skills: ${err.message || err}`));
    }
    throw err;
  }
}


/**
 * Build a searchable index for fast skill matching
 */
export function buildSkillIndex(skills: TopcoderSkill[]) {
  // Validate input
  if (!skills || !Array.isArray(skills) || skills.length === 0) {
    throw new Error('Invalid skills input: expected an array of non-empty TopcoderSkill array');
  }
  const index = {
    byName: new Map<string, TopcoderSkill>(),
    byLowerName: new Map<string, TopcoderSkill[]>(),
    byKeyword: new Map<string, TopcoderSkill[]>(),
    all: skills
  };
  
  skills.forEach(skill => {
    // Exact name match
    index.byName.set(skill.name, skill);
    
    // Lowercase name match
    const lowerName = skill.name.toLowerCase();
    if (!index.byLowerName.has(lowerName)) {
      index.byLowerName.set(lowerName, []);
    }
    index.byLowerName.get(lowerName)!.push(skill);
    
    // Keywords from name and description
    const keywords = [
      ...skill.name.toLowerCase().split(/[\s\-_\.\/]+/),
      ...(skill.description?.toLowerCase().split(/[\s\-_\.\/]+/) || [])
    ].filter(k => k.length > 2); // Filter out short words
    
    keywords.forEach(keyword => {
      if (!index.byKeyword.has(keyword)) {
        index.byKeyword.set(keyword, []);
      }
      index.byKeyword.get(keyword)!.push(skill);
    });
  });
  
  console.log(chalk.gray(`   Built skill index with ${index.byKeyword.size} keywords`));
  
  return index;
}

export type SkillIndex = ReturnType<typeof buildSkillIndex>;