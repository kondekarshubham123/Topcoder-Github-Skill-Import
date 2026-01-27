# Topcoder Github Skills Recommender 🎯

A powerful CLI tool that analyzes GitHub user profiles and recommends matching skills from Topcoder's standardized skill database. Uses multiple sophisticated matching algorithms to provide evidence-based skill recommendations.

## 🌟 Features

- **Deep GitHub Analysis**: Analyzes repositories, commits, pull requests, languages, and topics
- **Multiple Matching Algorithms**: Choose from 6+ specialized matchers or use hybrid mode
- **Evidence-Based Recommendations**: Every skill match includes verifiable evidence from your GitHub activity
- **Confidence Scoring**: Intelligent scoring system (0-100%) based on contribution patterns
- **Flexible CLI**: Extensive configuration options for customized analysis
- **Fast & Efficient**: Local skill matching with O(1) lookups (~2-5 seconds per user)
- **Plug-and-Play Architecture**: Easy to add custom matching algorithms

## 📊 Quick Example

```bash
npm start -- --username octocat --matcher hybrid --min-confidence 60
```

Output:
```
🎯 Topcoder Skill Recommendations for octocat
═══════════════════════════════════════════════

1. JavaScript (98% confidence) ⭐⭐⭐
   Evidence:
   • Language: frontend-app (42 contributions)
   • Language: backend-api (38 contributions)
   • Repository: js-toolkit (topic: javascript)
   Found by: Language Matcher, Repository Matcher

2. React (95% confidence) ⭐⭐⭐
   Evidence:
   • Language: react-dashboard (56 contributions)
   • Repository: react-components (description: "React UI library")
   Found by: Language Matcher, Hybrid Matcher
```

## 🚀 Quick Start

### Installation

```bash
git clone <repository-url>
cd Topcoder
npm install
npm run build
```

### Configuration

Create a `.env` file with your GitHub OAuth credentials:

```env
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
```

**Getting OAuth Credentials:**
1. Visit https://github.com/settings/developers
2. Click "New OAuth App"
3. Set Homepage URL: `http://localhost`
4. Set Authorization callback URL: `http://localhost`
5. Copy Client ID and Client Secret to `.env`

### First Run

```bash
npm start -- --username octocat
```

The CLI will:
1. Authenticate via GitHub OAuth (first time only)
2. Fetch your GitHub profile and repositories
3. Download Topcoder's skill database (~10,000 skills)
4. Run the hybrid matcher (recommended)
5. Display skill recommendations with evidence

## 📖 Usage

### Basic Command

```bash
npm start -- --username <github-username> [options]
```

### Matcher Algorithms

| Matcher | Description | Best For | Speed |
|---------|-------------|----------|-------|
| **hybrid** (default) | Combines all matchers with weighted scoring | Most accurate, recommended | Medium |
| **language** | Matches based on programming languages | Developers with clear language focus | Fast |
| **repository** | Analyzes repo names, descriptions, topics | Project-based analysis | Fast |
| **commit** | Deep analysis of commit messages and files | Detailed code contribution patterns | Slow |
| **pr** | Analyzes pull request metadata | Open source contributors | Medium |
| **all** | Runs all matchers sequentially | Maximum coverage | Slowest |

### Examples

**Analyze a user with hybrid matcher:**
```bash
npm start -- --username torvalds --matcher hybrid
```

**Language-only matching (fastest):**
```bash
npm start -- --username gvanrossum --matcher language
```

**High-confidence skills only:**
```bash
npm start -- --username octocat --min-confidence 75
```

**Limit number of results:**
```bash
npm start -- --username octocat --max-skills 10
```

**JSON output for integration:**
```bash
npm start -- --username octocat --output json --output-file results.json
```

**Analyze top repos only (faster):**
```bash
npm start -- --username octocat --max-repos 20
```

**Skip deep analysis (much faster):**
```bash
npm start -- --username octocat --no-deep-analysis
```

**Verbose logging:**
```bash
npm start -- --username octocat --verbose
```

### All CLI Options

```
-m, --matcher <type>         Matcher algorithm (default: hybrid)
                             Options: language, repository, commit, pr, hybrid, all

-r, --max-repos <number>     Maximum repositories to analyze (default: 50)

-c, --max-commits <number>   Maximum commits per repo (default: 30)

-s, --max-skills <number>    Maximum skills to display (default: 15)

--no-deep-analysis           Skip commit/PR analysis (faster)

--min-confidence <number>    Filter results by confidence 0-100 (default: 30)

-v, --verbose                Show detailed logging

-o, --output <format>        Output format: text or json (default: text)

--output-file <path>         Save results to file

-h, --help                   Show help
```

## 🏗️ Architecture

### System Design

```
GitHub User
    ↓
[OAuth Authentication]
    ↓
[Profile Analyzer] → Repos, Commits, PRs, Languages
    ↓
[Topcoder API] → Fetch all skills (once)
    ↓
[Skill Index Builder] → Fast O(1) lookups
    ↓
[Matcher Selection] → Choose algorithm
    ↓
[Local Matching] → No API calls, pure speed
    ↓
[Evidence Collection] → Traceable recommendations
    ↓
[Confidence Scoring] → 0-100% accuracy
    ↓
Results with Evidence
```

### Matching Algorithms

**1. Language Matcher** (Most Reliable)
- Matches programming languages to skills
- Exact match: 95% confidence
- Partial match: 75% confidence
- Keyword match: 60% confidence
- Boosted by repository frequency

**2. Repository Matcher**
- Analyzes repo names, descriptions, topics
- Keyword extraction and mapping
- Confidence based on repo count and quality

**3. Commit Matcher**
- Deep analysis of commit messages
- File extension mapping (.js → JavaScript)
- Commit frequency and patterns

**4. Pull Request Matcher**
- PR titles, descriptions, labels
- Collaboration patterns
- Open source contribution focus

**5. Hybrid Matcher** (Recommended)
- Combines all matchers with weights:
  - Language: 1.0 (most reliable)
  - Repository: 0.7
  - Commit: 0.5
  - PR: 0.4
- Merges evidence from multiple sources

**6. All Matchers**
- Runs matchers sequentially
- Maximum coverage
- Comprehensive analysis

### Skill Index Performance

**Before (API-based):**
- 100+ API calls per user
- 30-60 seconds
- Network-dependent reliability

**After (Local index):**
- 1 API call per session
- 2-5 seconds
- 100% reliability

### Adding Custom Matchers

The system is **plug-and-play**. See [PLUGIN_GUIDE.md](docs/PLUGIN_GUIDE.md) for step-by-step instructions.

Quick example:

```typescript
import { ISkillsMatcher, SkillMatch, GithubProfile, Evidence } from './ISkillsMatcher';
import { SkillIndex } from '../topcoder';

export class YourMatcher implements ISkillsMatcher {
  name = 'Your Matcher';
  description = 'Your matching strategy';
  
  async match(profile: GithubProfile, skillIndex: SkillIndex): Promise<SkillMatch[]> {
    // 1. Analyze GitHub data
    // 2. Search skillIndex.byName / byLowerName / byKeyword
    // 3. Calculate confidence
    // 4. Collect evidence
    // 5. Return matches
    return matches;
  }
}
```

Add to CLI in `src/cli.ts`:
```typescript
case 'yourmatcher':
  matcher = new YourMatcher();
  break;
```

Done! No other changes needed.

## 📚 Documentation

- **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** - Detailed system architecture with Mermaid diagrams
- **[DESIGN_FLOW.md](docs/DESIGN_FLOW.md)** - Visual flows and decision trees
- **[PLUGIN_GUIDE.md](docs/PLUGIN_GUIDE.md)** - Step-by-step guide to add custom matchers
- **[QUICK_REFERENCE.md](docs/QUICK_REFERENCE.md)** - Command cheatsheet and quick reference
- **[CLI_USAGE.md](docs/CLI_USAGE.md)** - Comprehensive CLI documentation
- **[IMPLEMENTATION.md](docs/IMPLEMENTATION.md)** - Implementation details

## 🔧 API Reference

### Topcoder Standardized Skills API

Base URL: `https://api.topcoder-dev.com/v5/standardized-skills`

**Endpoint Used:**
- `GET /skills?page=1&perPage=10000` - Fetch all skills (single call)

**Documentation:**
https://api.topcoder-dev.com/v5/standardized-skills/docs/#/Skills

### GitHub API

Uses GitHub REST API v3 with OAuth authentication:
- `/user` - User profile
- `/user/repos` - Repositories (paginated)
- `/repos/{owner}/{repo}/languages` - Language statistics
- `/repos/{owner}/{repo}/commits` - Commit history
- `/repos/{owner}/{repo}/pulls` - Pull requests

**Rate Limits:**
- Authenticated: 5,000 requests/hour
- Unauthenticated: 60 requests/hour

## 🎯 Use Cases

1. **Personal Skill Assessment**: Discover your strengths based on GitHub activity
2. **Resume Building**: Find verified skills for your resume/portfolio
3. **Topcoder Onboarding**: Quickly identify relevant skills for Topcoder challenges
4. **Team Analysis**: Analyze team members' skills (run for each member)
5. **Hiring & Recruiting**: Assess candidate skills from their public GitHub
6. **Open Source Contribution**: Find skills demonstrated in OSS projects

## 🚦 Confidence Levels

| Range | Level | Description |
|-------|-------|-------------|
| 90-100% | ⭐⭐⭐ Expert | Direct language matches, 10+ repos |
| 75-89% | ⭐⭐ Advanced | Strong keyword matches, 5-9 repos |
| 60-74% | ⭐ Intermediate | Partial matches, 3-4 repos |
| 40-59% | Beginner | Related keywords, 1-2 repos |
| 0-39% | Exposure | Weak associations, mentioned in commits |

## 🔍 Evidence Types

Every skill recommendation includes verifiable evidence:

- **Language**: Direct language usage in repositories
- **Repository**: Repo names, descriptions, topics
- **Commit**: Commit messages and file changes
- **Pull Request**: PR titles, descriptions, labels
- **Topic**: Repository topics/tags
- **File**: File extensions and patterns

## 🛠️ Troubleshooting

**Authentication failed:**
- Check `.env` file has correct OAuth credentials
- Visit https://github.com/settings/developers to verify app settings
- Delete `.github-token` and re-authenticate

**Rate limit errors:**
- GitHub limits to 5,000 requests/hour (authenticated)
- Use `--max-repos` to reduce API calls
- Wait for rate limit to reset (check headers)

**No skills found:**
- Lower `--min-confidence` threshold (try 20-30)
- Use `--matcher all` for maximum coverage
- Check if user has public repositories

**Slow performance:**
- Use `--no-deep-analysis` to skip commits/PRs
- Reduce `--max-repos` (default 50)
- Reduce `--max-commits` (default 30)
- Use `--matcher language` for fastest results

## 🤝 Contributing

Contributions welcome! Here's how:

1. **Add a new matcher**: See [PLUGIN_GUIDE.md](docs/PLUGIN_GUIDE.md)
2. **Improve algorithms**: Submit PRs with enhanced confidence scoring
3. **Documentation**: Help improve docs and examples
4. **Bug fixes**: Report issues or submit fixes

## 📝 License

MIT

## 🙏 Acknowledgments

- **Topcoder** for the Standardized Skills API
- **GitHub** for the comprehensive REST API
- **Open Source Community** for inspiration and support
