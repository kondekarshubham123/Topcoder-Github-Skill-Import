process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
import 'dotenv/config';
import chalk from 'chalk';
import open from 'open';
import { Command } from 'commander';
import { getDeviceCode, pollForToken, getAuthenticatedUser } from './github';
import { fetchAllSkills, buildSkillIndex } from './topcoder';
import { ProfileAnalyzer } from './ProfileAnalyzer';
import { LanguageMatcher } from './matchers/LanguageMatcher';
import { RepositoryMatcher } from './matchers/RepositoryMatcher';
import { CommitMatcher } from './matchers/CommitMatcher';
import { PullRequestMatcher } from './matchers/PullRequestMatcher';
import { HybridMatcher } from './matchers/HybridMatcher';
import { ISkillsMatcher } from './matchers/ISkillsMatcher';
import * as fs from 'fs';

// Setup CLI
const program = new Command();

program
  .name('topcoder-skills')
  .description('Analyze Github profiles and recommend Topcoder skills')
  .version('1.0.0')
  .option('-m, --matcher <type>', 'Matcher: language, repository, commit, pr, hybrid, all', 'hybrid')
  .option('-r, --max-repos <number>', 'Maximum repos to analyze', '50')
  .option('-c, --max-commits <number>', 'Maximum commits per repo', '30')
  .option('-s, --max-skills <number>', 'Maximum skills to display', '15')
  .option('--no-deep-analysis', 'Skip deep commit/PR analysis')
  .option('--min-confidence <number>', 'Minimum confidence threshold (0-100)', '30')
  .option('-v, --verbose', 'Verbose logging')
  .option('-o, --output <format>', 'Output format: text, json', 'text')
  .option('--output-file <path>', 'Save results to file');

program.parse();

const options = program.opts();

async function main() {
  console.log(chalk.green.bold('🚀 Topcoder Skills Recommender CLI\n'));
  
  if (options.verbose) {
    console.log(chalk.gray('Configuration:'));
    console.log(chalk.gray(`  • Matcher: ${options.matcher}`));
    console.log(chalk.gray(`  • Max Repos: ${options.maxRepos}`));
    console.log(chalk.gray(`  • Max Commits: ${options.maxCommits}`));
    console.log(chalk.gray(`  • Max Skills: ${options.maxSkills}`));
    console.log(chalk.gray(`  • Deep Analysis: ${options.deepAnalysis}`));
    console.log(chalk.gray(`  • AI Provider: ${options.aiProvider}`));
    console.log(chalk.gray(`  • Min Confidence: ${options.minConfidence}%`));
  }

  // Step 1: Github OAuth Device Flow
  console.log(chalk.cyan('Step 1: Authenticating with Github...'));
  const { device_code, user_code, verification_uri, interval } = await getDeviceCode();
  console.log(chalk.yellow(`\n📱 Visit: ${verification_uri}`));
  console.log(chalk.yellow(`🔑 Enter code: ${user_code}\n`));
  await open(verification_uri);

  const auth = await pollForToken(device_code, interval);
  const user = await getAuthenticatedUser(auth.access_token);
  console.log(chalk.green(`✅ Authenticated as: ${(user as any).login}\n`));

  // Step 2: Fetch Topcoder Skills (ONLY API CALL NEEDED)
  console.log(chalk.cyan('Step 2: Loading Topcoder skills database...'));
  const skills = await fetchAllSkills();
  const skillIndex = buildSkillIndex(skills);
  console.log(chalk.green(`✅ Loaded ${skills.length} standardized skills\n`));

  // Step 3: Deep Profile Analysis
  console.log(chalk.cyan('Step 3: Analyzing Github profile...'));
  const analyzer = new ProfileAnalyzer({
    maxRepos: parseInt(options.maxRepos),
    maxCommitsPerRepo: parseInt(options.maxCommits),
    deepAnalysis: options.deepAnalysis,
    verbose: options.verbose
  });
  
  const { profile, stats } = await analyzer.analyzeProfile(auth.access_token, user);
  
  console.log(chalk.gray('\n📊 Analysis Summary:'));
  console.log(chalk.gray(`   • Repositories scanned: ${stats.reposScanned}`));
  console.log(chalk.gray(`   • Commits analyzed: ${stats.commitsAnalyzed}`));
  console.log(chalk.gray(`   • Pull requests analyzed: ${stats.pullRequestsAnalyzed}`));
  console.log(chalk.gray(`   • API calls made: ${stats.apiCallsMade}`));
  console.log(chalk.gray(`   • Elapsed time: ${(stats.elapsedTimeMs / 1000).toFixed(2)}s\n`));

  // Step 4: Skills Matching
  console.log(chalk.cyan('Step 4: Matching skills with multiple algorithms...'));
  
  let matcher: ISkillsMatcher;
  
  switch (options.matcher.toLowerCase()) {
    case 'language':
      matcher = new LanguageMatcher();
      break;
    case 'repository':
      matcher = new RepositoryMatcher();
      break;
    case 'commit':
      matcher = new CommitMatcher();
      break;
    case 'pr':
      matcher = new PullRequestMatcher();
      break;
    case 'all':
      matcher = new HybridMatcher([
        new LanguageMatcher(),
        new RepositoryMatcher(),
        new CommitMatcher(),
        new PullRequestMatcher()
      ]);
      break;
    case 'hybrid':
    default:
      // Use top 3 matchers for best balance of speed and accuracy
      matcher = new HybridMatcher([
        new LanguageMatcher(),
        new RepositoryMatcher(),
        new CommitMatcher()
      ]);
      break;
  }
  
  const allRecommendations = await matcher.match(profile, skillIndex);
  
  // Filter by confidence threshold
  const minConfidence = parseInt(options.minConfidence);
  const recommendations = allRecommendations.filter(r => r.confidence >= minConfidence);
  
  console.log(chalk.green(`✅ Found ${recommendations.length} skills above ${minConfidence}% confidence\n`));
  
  const maxSkills = parseInt(options.maxSkills);
  const topRecommendations = recommendations.slice(0, maxSkills);
  
  // Step 5: Output
  if (options.output === 'json') {
    outputJSON(profile, stats, topRecommendations, options.outputFile);
  } else {
    outputText(topRecommendations, options.verbose, options.outputFile);
  }
  
  console.log(chalk.green.bold('✨ Analysis complete!\n'));
}

function outputText(recommendations: any[], verbose: boolean, outputFile?: string) {
  const output: string[] = [];
  
  output.push(chalk.green.bold(`\n🎯 Top ${recommendations.length} Recommended Skills:\n`));
  
  recommendations.forEach((match, idx) => {
    output.push(chalk.bold(`${idx + 1}. ${match.skillName}`));
    output.push(chalk.gray(`   ID: ${match.skillId}`));
    output.push(chalk.yellow(`   Confidence: ${match.confidence}%`));
    output.push(chalk.magenta(`   Sources: ${match.sources.join(', ')}`));
    output.push(chalk.cyan(`   Evidence (${match.evidence.length}):`));
    
    match.evidence.slice(0, 5).forEach((ev: any) => {
      const icon = ev.type === 'language' ? '💻' : ev.type === 'repo' ? '📁' : 
                   ev.type === 'commit' ? '📝' : ev.type === 'pr' ? '🔀' : 
                   ev.type === 'topic' ? '🏷️' : '📄';
      output.push(chalk.gray(`     ${icon} [${ev.type}] ${ev.source}`));
      if (verbose && ev.details) {
        output.push(chalk.gray(`        ${ev.details}`));
      }
    });
    
    if (verbose) {
      output.push(chalk.blue(`   Rationale:`));
      match.rationale.split('\n').forEach((line: string) => {
        output.push(chalk.gray(`     ${line}`));
      });
    } else {
      output.push(chalk.blue(`   Rationale: ${match.rationale.split('\n')[0]}`));
    }
    output.push('');
  });
  
  const textOutput = output.map(line => 
    // Strip ANSI codes if saving to file
    outputFile ? line.replace(/\x1b\[[0-9;]*m/g, '') : line
  ).join('\n');
  
  if (outputFile) {
    fs.writeFileSync(outputFile, textOutput);
    console.log(chalk.green(`✅ Results saved to ${outputFile}`));
  } else {
    console.log(textOutput);
  }
}

function outputJSON(profile: any, stats: any, recommendations: any[], outputFile?: string) {
  const output = {
    user: {
      username: profile.username,
      analyzedAt: new Date().toISOString()
    },
    stats,
    recommendations: recommendations.map(r => ({
      skillId: r.skillId,
      skillName: r.skillName,
      confidence: r.confidence,
      sources: r.sources,
      evidence: r.evidence.map((e: any) => ({
        type: e.type,
        source: e.source,
        details: e.details,
        url: e.url
      })),
      rationale: r.rationale
    })),
    profile: {
      reposCount: profile.repos.length,
      languagesCount: profile.languages.size,
      topLanguages: Array.from(profile.languages.entries())
        .sort((a: any, b: any) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, count]: any) => ({ name, repoCount: count })),
      commitsAnalyzed: stats.commitsAnalyzed,
      pullRequestsAnalyzed: stats.pullRequestsAnalyzed
    }
  };
  
  const jsonOutput = JSON.stringify(output, null, 2);
  
  if (outputFile) {
    fs.writeFileSync(outputFile, jsonOutput);
    console.log(chalk.green(`✅ Results saved to ${outputFile}`));
  } else {
    console.log(jsonOutput);
  }
}

main().catch(err => {
  console.error(chalk.red('Error:'), err);
  process.exit(1);
});