export interface SkillMatch {
  skillId: string;
  skillName: string;
  confidence: number;
  evidence: Evidence[];
  rationale: string;
  sources: string[]; // Which matcher(s) found this
}

export interface Evidence {
  type: 'repo' | 'commit' | 'pr' | 'language' | 'topic' | 'file';
  source: string;
  details?: string;
  url?: string;
}

export interface GithubProfile {
  username: string;
  repos: RepoData[];
  languages: Map<string, number>;
  commits?: CommitData[];
  pullRequests?: PullRequestData[];
}

export interface RepoData {
  name: string;
  fullName: string;
  description?: string;
  languages: { [key: string]: number };
  topics: string[];
  stars: number;
  contributions?: number;
  url?: string;
}

export interface CommitData {
  repo: string;
  message: string;
  files: string[];
  additions: number;
  deletions: number;
  sha?: string;
  url?: string;
}

export interface PullRequestData {
  repo: string;
  title: string;
  description: string;
  labels: string[];
  number?: number;
  url?: string;
}

export interface ISkillsMatcher {
  name: string;
  description: string;
  match(profile: GithubProfile, skillIndex: any): Promise<SkillMatch[]>;
}