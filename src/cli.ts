import 'dotenv/config';
import chalk from 'chalk';
import open from 'open';
import { Command } from 'commander';
import { getDeviceCode, pollForToken, getAuthenticatedUser, verifyToken } from './github';
import { fetchAllSkills, buildSkillIndex } from './topcoder';
import { ProfileAnalyzer } from './ProfileAnalyzer';
import { LanguageMatcher } from './matchers/LanguageMatcher';
import { RepositoryMatcher } from './matchers/RepositoryMatcher';
import { CommitMatcher } from './matchers/CommitMatcher';
import { PullRequestMatcher } from './matchers/PullRequestMatcher';
import { HybridMatcher } from './matchers/HybridMatcher';
import { SemanticMatcher } from './matchers/SemanticMatcher';
import { ISkillsMatcher } from './matchers/ISkillsMatcher';
import { OpenAIProvider } from './matchers/providers/OpenAIProvider';
import { GeminiProvider } from './matchers/providers/GeminiProvider';
import { OllamaProvider } from './matchers/providers/OllamaProvider';
import { saveToken, loadToken, clearToken, hasValidToken } from './tokenStore';
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
  .option('--include-forks', 'Include forked repositories in analysis')
  .option('--min-confidence <number>', 'Minimum confidence threshold (0-100)', '30')
  .option('--ai-provider <provider>', 'AI provider: openai, gemini, ollama (requires semantic matcher)')
  .option('--openai-key <key>', 'OpenAI API key (overrides env)')
  .option('--gemini-key <key>', 'Google Gemini API key (overrides env)')
  .option('--ollama-url <url>', 'Ollama base URL (default: http://localhost:11434)')
  .option('--ollama-model <model>', 'Ollama model name (default: llama3.2)')
  .option('--ollama-timeout <seconds>', 'Ollama timeout in seconds (default: 180)', '180')
  .option('-v, --verbose', 'Verbose logging')
  .option('-o, --output <format>', 'Output format: text, json', 'text')
  .option('--output-file <path>', 'Save results to file')
  .option('--force-login', 'Force new Github login (ignore stored token)')
  .option('--logout', 'Clear stored Github token and exit');

program.parse();

const options = program.opts();

// Input validation
function validateOptions(options: any) {
  const errors: string[] = [];

  // validate matcher
  const validMatchers = ['language', 'repository', 'commit', 'pr', 'hybrid', 'semantic', 'all'];
  if (!validMatchers.includes(options.matcher.toLowerCase())) {
    errors.push(`Invalid matcher: ${options.matcher}. Valid options are: ${validMatchers.join(', ')}`);
  }

  // Validate AI provider if specified
  if (options.aiProvider) {
    const validProviders = ['openai', 'gemini', 'ollama'];
    if (!validProviders.includes(options.aiProvider.toLowerCase())) {
      errors.push(`Invalid AI provider: ${options.aiProvider}. Must be one of: ${validProviders.join(', ')}`);
    }
    
    // Check if semantic matcher is used with AI provider
    if (options.matcher.toLowerCase() !== 'semantic' && options.matcher.toLowerCase() !== 'hybrid' && options.matcher.toLowerCase() !== 'all') {
      errors.push('AI provider can only be used with semantic, hybrid, or all matchers');
    }
    
    // Validate API keys for cloud providers
    if (options.aiProvider.toLowerCase() === 'openai') {
      const apiKey = options.openaiKey || process.env.OPENAI_API_KEY;
      if (!apiKey) {
        errors.push('OpenAI API key required: set OPENAI_API_KEY in .env or use --openai-key');
      }
    }

    if (options.aiProvider.toLowerCase() === 'gemini') {
      const apiKey = options.geminiKey || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        errors.push('Gemini API key required: set GEMINI_API_KEY in .env or use --gemini-key');
      }
    }
  }


  // validate numeric options
  const maxRepos = parseInt(options.maxRepos);
  if (isNaN(maxRepos) || maxRepos < 1 || maxRepos > 1000) {
    errors.push('Invalid max-repos. Must be a number between 1 and 1000.');
  }

  const maxCommits = parseInt(options.maxCommits);
  if (isNaN(maxCommits) || maxCommits < 1 || maxCommits > 500) {
    errors.push('Invalid max-commits. Must be a number between 1 and 500.');
  }

  const maxSkills = parseInt(options.maxSkills);
  if (isNaN(maxSkills) || maxSkills < 1 || maxSkills > 100) {
    errors.push('Invalid max-skills. Must be a number between 1 and 100.');
  }

  const minConfidence = parseInt(options.minConfidence);
  if (isNaN(minConfidence) || minConfidence < 0 || minConfidence > 100) {
    errors.push('Invalid min-confidence. Must be a number between 0 and 100.');
  }

  // validate output format
  const validOutputs = ['text', 'json'];
  if (!validOutputs.includes(options.output.toLowerCase())) {
    errors.push(`Invalid output format: ${options.output}. Valid options are: ${validOutputs.join(', ')}`);
  }

  // validate output file path if specified
  if (options.outputFile) {
    const path = require('path');
    const sanitizedPath = path.normalize(options.outputFile).replace(/^(\.\.[/\\]?)+/, '');
    if (sanitizedPath !== options.outputFile) {
      errors.push('Invalid output file path. Path contains invalid characters or directory traversal.');
    }
  }

  if (errors.length > 0) {
    throw new Error(`Validation errors:\n- ${errors.join('\n- ')}`);
  }
}

async function main() {
  try {
    if (options.logout) {
      console.log(chalk.cyan('Logging out and clearing stored token...'));
      clearToken();
      console.log(chalk.green('✅ Logged out successfully'));
      return;
    }

    // Validate options
    validateOptions(options);
  
  console.log(chalk.green.bold('🚀 Topcoder Skills Recommender CLI\n'));



  if (options.verbose) {
    console.log(chalk.gray('Configuration:'));
    console.log(chalk.gray(`  • Matcher: ${options.matcher}`));
    console.log(chalk.gray(`  • Max Repos: ${options.maxRepos}`));
    console.log(chalk.gray(`  • Max Commits: ${options.maxCommits}`));
    console.log(chalk.gray(`  • Max Skills: ${options.maxSkills}`));
    console.log(chalk.gray(`  • Deep Analysis: ${options.deepAnalysis}`));
    console.log(chalk.gray(`  • Include Forks: ${options.includeForks || false}`));
    console.log(chalk.gray(`  • AI Provider: ${options.aiProvider || 'none'}`));
    console.log(chalk.gray(`  • Min Confidence: ${options.minConfidence}%\n`));
    console.log(chalk.gray(`  • Force Login: ${options.forceLogin || false}`));
  }


  // Step 1: Github Authentication (with token persistence)
  console.log(chalk.cyan('Step 1: Authenticating with Github...'));

  let token: string | null = null;

  // Try to load existing token unless --force-login is used
  if(!options.forceLogin) {
    const storedToken = loadToken();
    if (storedToken) {
      console.log(chalk.cyan('Found stored Github token...'));
      const isValid = await verifyToken(storedToken.access_token);
      if (isValid) {
        console.log(chalk.green('✅ Using stored token\n'));
        token = storedToken.access_token;
      } else {
        console.log(chalk.yellow('⚠️  Stored token is invalid'));
        clearToken();
      }
    } 
  } else {
    console.log(chalk.grey('--force-login specified, ignoring stored token'));
    clearToken();
  }

  // If no valid token, initiate login flow
  if (!token) {
    console.log(chalk.cyan(' Starting Github OAuth device flow...'));
    const { device_code, user_code, verification_uri, interval } = await getDeviceCode();
    console.log(chalk.yellow(`\n📱 Visit: ${verification_uri}`));
    console.log(chalk.yellow(`🔑 Enter code: ${user_code}\n`));
    await open(verification_uri);
    const auth = await pollForToken(device_code, interval);
    
    if (options.verbose) {
      console.log(chalk.gray(`Debug: Auth response keys: ${Object.keys(auth).join(', ')}`));
      console.log(chalk.gray(`Debug: Auth object: ${JSON.stringify(auth)}`));
    }
    
    token = auth.access_token;

    // Save token to disk for future use
    console.log(chalk.blue('💾 Saving token for future use...'));
    try {
      console.log(chalk.gray(`   Directory: ~/.topcoder-skills/`));
      console.log(chalk.gray(`   File: github-token.json`));
      saveToken(auth);
      console.log(chalk.green('   ✅ Token saved successfully'));
    } catch (err) {
      console.error(chalk.red('   ❌ Failed to save token'));
      console.warn(chalk.yellow('⚠️  Warning: Could not save token locally for future use'));
      console.warn(chalk.yellow('   You will need to authenticate again on next run'));
      if (options.verbose) {
        console.warn(chalk.gray((err as Error).message));
      }
    }
  }
  const user = await getAuthenticatedUser(token);
  console.log(chalk.green(`✅ Authenticated as ${(user as any).login}\n`));

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
    includeForks: options.includeForks || false,
    verbose: options.verbose
  });
  
  const { profile, stats } = await analyzer.analyzeProfile(token, user);
  
  console.log(chalk.gray('\n📊 Analysis Summary:'));
  console.log(chalk.gray(`   • Repositories scanned: ${stats.reposScanned}`));
  if(stats.reposFiltered > 0) {
    console.log(chalk.gray(`   • Repositories filtered out: ${stats.reposFiltered}`));
  }
  console.log(chalk.gray(`   • Commits analyzed: ${stats.commitsAnalyzed}`));
  console.log(chalk.gray(`   • Pull requests analyzed: ${stats.pullRequestsAnalyzed}`));
  console.log(chalk.gray(`   • API calls made: ${stats.apiCallsMade}`));
  console.log(chalk.gray(`   • Elapsed time: ${(stats.elapsedTimeMs / 1000).toFixed(2)}s\n`));

  // Step 4: Skills Matching
  console.log(chalk.cyan('Step 4: Matching skills with multiple algorithms...'));
  
  let matcher: ISkillsMatcher;
  
  // Initialize AI provider if specified
  let aiProvider = null;
  if (options.aiProvider) {
    const providerName = options.aiProvider.toLowerCase();
    
    if (providerName === 'openai') {
      const apiKey = options.openaiKey || process.env.OPENAI_API_KEY;
      if (apiKey) {
        aiProvider = new OpenAIProvider(apiKey);
        console.log(chalk.cyan(`   🤖 AI Provider: ${aiProvider.name} (GPT-4o-mini + Embeddings)`));
        console.log(chalk.gray(`   Mode: GenAI reasoning + semantic embeddings\n`));
      }
    } else if (providerName === 'gemini') {
      const apiKey = options.geminiKey || process.env.GEMINI_API_KEY;
      if (apiKey) {
        aiProvider = new GeminiProvider(apiKey);
        console.log(chalk.cyan(`   🤖 AI Provider: ${aiProvider.name} (Gemini Pro)`));
        console.log(chalk.gray(`   Mode: GenAI reasoning + semantic embeddings\n`));
      }
    } else if (providerName === 'ollama') {
      const baseUrl = options.ollamaUrl || 'http://localhost:11434';
      const model = options.ollamaModel || 'llama3.2';
      const timeout = parseInt(options.ollamaTimeout) * 1000 || 180000;
      aiProvider = new OllamaProvider(baseUrl, model, timeout);
      
      // Check if Ollama is available
      const available = await aiProvider.isAvailable();
      if (available) {
        console.log(chalk.cyan(`   🤖 AI Provider: ${aiProvider.name} (${model})`));
        console.log(chalk.gray(`   Mode: Local GenAI reasoning (privacy-focused)\n`));
      } else {
        console.log(chalk.yellow(`   ⚠️  Ollama not available at ${baseUrl}`));
        console.log(chalk.yellow(`   Start Ollama with: ollama serve`));
        console.log(chalk.yellow(`   Falling back to keyword-based matching\n`));
        aiProvider = null;
      }
    }
  }

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
    case 'semantic':
      if (aiProvider) {
        matcher = new SemanticMatcher(aiProvider);
      } else {
        console.log(chalk.yellow('   ⚠️  No AI provider specified, using keyword-based semantic matching'));
        matcher = new SemanticMatcher();
      }
      break;
    case 'all':
      const allMatchers = [
        new LanguageMatcher(),
        new RepositoryMatcher(),
        new CommitMatcher(),
        new PullRequestMatcher()
      ];
      if (aiProvider) {
        allMatchers.push(new SemanticMatcher(aiProvider));
      }
      matcher = new HybridMatcher(allMatchers);
      break;
    case 'hybrid':
    default:
      // Use top 3 matchers for best balance of speed and accuracy
      const hybridMatchers = [
        new LanguageMatcher(),
        new RepositoryMatcher(),
        new CommitMatcher()
      ];
      if (aiProvider) {
        hybridMatchers.push(new SemanticMatcher(aiProvider));
      }
      matcher = new HybridMatcher(hybridMatchers);
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

  // Show fork filtering tip if forks were excluded
  if(!options.includeForks && stats.reposFiltered > 0) {
    console.log(chalk.gray(`\nTip: Use --include-forks to include forked repositories in the analysis (filtered out ${stats.reposFiltered} repos)`));
  }
  
  console.log(chalk.green.bold('✨ Analysis complete!\n'));
  } catch (err: any) {
    console.error(chalk.red('\n Error during analysis:'));
    if (options.verbose) {
      console.error(chalk.red(err.stack || err.message || err));
    } else {
      console.error(chalk.red(err.message || err));
      console.error(chalk.gray('Run with --verbose for more details.'));
    }
    throw err;
  }
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