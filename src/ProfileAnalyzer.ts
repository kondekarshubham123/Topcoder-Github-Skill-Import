import ora from 'ora';
import chalk from 'chalk';
import { GithubProfile, RepoData, CommitData, PullRequestData } from './matchers/ISkillsMatcher';
import * as github from './github';

export interface AnalysisStats {
  reposScanned: number;
  commitsAnalyzed: number;
  pullRequestsAnalyzed: number;
  apiCallsMade: number;
  elapsedTimeMs: number;
}

export interface AnalysisOptions {
  maxRepos?: number;
  maxCommitsPerRepo?: number;
  deepAnalysis?: boolean;
  verbose?: boolean;
}

export class ProfileAnalyzer {
  private apiCalls = 0;
  private options: AnalysisOptions;
  
  constructor(options: AnalysisOptions = {}) {
    this.options = {
      maxRepos: options.maxRepos || 50,
      maxCommitsPerRepo: options.maxCommitsPerRepo || 30,
      deepAnalysis: options.deepAnalysis !== false,
      verbose: options.verbose || false
    };
  }
  
  private log(message: string) {
    if (this.options.verbose) {
      console.log(chalk.gray(`   [Analyzer] ${message}`));
    }
  }
  
  async analyzeProfile(token: string, user: any): Promise<{ profile: GithubProfile, stats: AnalysisStats }> {
    const startTime = Date.now();
    const spinner = ora('Analyzing Github profile...').start();
    
    try {
      // Fetch repositories
      spinner.text = 'Fetching repositories...';
      this.log('Fetching user repositories...');
      const allRepos = await github.getUserRepos(token);
      this.apiCalls++;
      
      const repos = allRepos.slice(0, this.options.maxRepos);
      this.log(`Limiting analysis to ${repos.length} of ${allRepos.length} repositories`);
      
      spinner.text = `Analyzing ${repos.length} repositories...`;
      
      const repoDataPromises = repos.map(repo => this.analyzeRepo(token, repo, user.login));
      const repoData = await Promise.all(repoDataPromises);
      
      // Aggregate languages
      const languageMap = new Map<string, number>();
      repoData.forEach(repo => {
        Object.keys(repo.languages).forEach(lang => {
          languageMap.set(lang, (languageMap.get(lang) || 0) + 1);
        });
      });
      
      this.log(`Found ${languageMap.size} unique languages`);
      
      // Collect all commits and PRs
      const allCommits: CommitData[] = [];
      const allPRs: PullRequestData[] = [];
      
      if (this.options.deepAnalysis) {
        const deepAnalysisRepos = repoData
          .sort((a, b) => (b.contributions || 0) - (a.contributions || 0))
          .slice(0, 10);
        
        for (const repo of deepAnalysisRepos) {
          spinner.text = `Deep analysis of ${repo.name}...`;
          this.log(`Analyzing commits and PRs in ${repo.fullName}`);
          
          const commits = await this.analyzeCommits(token, repo, user.login);
          allCommits.push(...commits);
          
          const prs = await this.analyzePullRequests(token, repo, user.login);
          allPRs.push(...prs);
        }
      }
      
      spinner.succeed(`Profile analysis complete!`);
      
      const profile: GithubProfile = {
        username: user.login,
        repos: repoData,
        languages: languageMap,
        commits: allCommits,
        pullRequests: allPRs
      };
      
      const stats: AnalysisStats = {
        reposScanned: repos.length,
        commitsAnalyzed: allCommits.length,
        pullRequestsAnalyzed: allPRs.length,
        apiCallsMade: this.apiCalls,
        elapsedTimeMs: Date.now() - startTime
      };
      
      return { profile, stats };
    } catch (err) {
      spinner.fail('Profile analysis failed');
      throw err;
    }
  }
  
  private async analyzeRepo(token: string, repo: any, username: string): Promise<RepoData> {
    try {
      this.log(`Analyzing repo: ${repo.full_name}`);
      const [languages, topics, contributions] = await Promise.all([
        github.getRepoLanguages(token, repo.owner.login, repo.name),
        github.getRepoTopics(token, repo.owner.login, repo.name),
        github.getUserContributions(token, repo.owner.login, repo.name, username)
      ]);
      this.apiCalls += 3;
      
      return {
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description,
        languages: languages as { [key: string]: number },
        topics: topics as string[],
        stars: repo.stargazers_count,
        contributions
      };
    } catch (err) {
      this.log(`Failed to analyze repo ${repo.full_name}`);
      return {
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description,
        languages: {},
        topics: [],
        stars: 0,
        contributions: 0
      };
    }
  }
  
  private async analyzeCommits(token: string, repo: RepoData, username: string): Promise<CommitData[]> {
    try {
      const [owner, repoName] = repo.fullName.split('/');
      const commits = await github.getUserCommits(token, owner, repoName, username, this.options.maxCommitsPerRepo);
      this.apiCalls++;
      
      this.log(`Found ${commits.length} commits in ${repo.fullName}`);
      
      const commitDetails: CommitData[] = [];
      
      for (const commit of commits.slice(0, 10)) { // Analyze top 10 commits
        const details = await github.getCommitDetails(token, owner, repoName, commit.sha);
        this.apiCalls++;
        
        if (details && typeof details === 'object' && 'commit' in details) {
          commitDetails.push({
            repo: repo.fullName,
            message: (details as any).commit.message,
            files: (details as any).files?.map((f: any) => f.filename) || [],
            additions: (details as any).stats?.additions || 0,
            deletions: (details as any).stats?.deletions || 0
          });
        }
      }
      
      return commitDetails;
    } catch (err) {
      return [];
    }
  }
  
  private async analyzePullRequests(token: string, repo: RepoData, username: string): Promise<PullRequestData[]> {
    try {
      const [owner, repoName] = repo.fullName.split('/');
      const prs = await github.getUserPullRequests(token, owner, repoName, username);
      this.apiCalls++;
      
      this.log(`Found ${prs.length} pull requests in ${repo.fullName}`);
      
      return prs.map(pr => ({
        repo: repo.fullName,
        title: pr.title,
        description: pr.body || '',
        labels: pr.labels?.map((l: any) => l.name) || []
      }));
    } catch (err) {
      return [];
    }
  }
}
