# Architecture Documentation

## System Overview

The Topcoder Skills Recommender is a CLI tool that analyzes GitHub user profiles and recommends Topcoder standardized skills based on deep analysis of repositories, commits, pull requests, and code contributions.

## High-Level Architecture

```mermaid
graph TB
    A[CLI Entry Point] --> B[GitHub OAuth]
    B --> C[GitHub Profile Analyzer]
    C --> D[Topcoder Skills Fetcher]
    D --> E[Skill Index Builder]
    E --> F{Matcher Selection}
    
    F --> G1[Language Matcher]
    F --> G2[Repository Matcher]
    F --> G3[Commit Matcher]
    F --> G4[Pull Request Matcher]
    F --> G5[Hybrid Matcher]
    F --> G6[Fuzzy/Semantic Matcher]
    
    G1 --> H[Results Aggregator]
    G2 --> H
    G3 --> H
    G4 --> H
    G5 --> H
    G6 --> H
    
    H --> I[Confidence Filtering]
    I --> J[Output Formatter]
    J --> K[Display Results]
    
    style A fill:#e1f5ff
    style F fill:#fff4e1
    style H fill:#f0ffe1
    style K fill:#ffe1f5
```

## Data Flow

```mermaid
sequenceDiagram
    participant User
    participant CLI
    participant GitHub API
    participant Topcoder API
    participant Matcher
    participant Output

    User->>CLI: Run command with username
    CLI->>GitHub API: Authenticate (OAuth Device Flow)
    GitHub API-->>CLI: Access Token
    
    CLI->>GitHub API: Fetch User Profile
    GitHub API-->>CLI: User Data
    
    CLI->>GitHub API: Fetch Repositories (paginated)
    GitHub API-->>CLI: Repository List
    
    loop For each repo
        CLI->>GitHub API: Fetch Languages
        CLI->>GitHub API: Fetch Commits
        CLI->>GitHub API: Fetch Pull Requests
    end
    
    CLI->>Topcoder API: Fetch All Skills (once)
    Topcoder API-->>CLI: ~10,000 skills
    
    CLI->>CLI: Build Skill Index (maps)
    
    CLI->>Matcher: match(profile, skillIndex)
    Matcher->>Matcher: Analyze GitHub data
    Matcher->>Matcher: Search skill index
    Matcher->>Matcher: Calculate confidence
    Matcher->>Matcher: Collect evidence
    Matcher-->>CLI: SkillMatch[] with Evidence
    
    CLI->>CLI: Filter by min confidence
    CLI->>Output: Format results
    Output->>User: Display recommendations
```

## Component Architecture

### 1. Core Components

```mermaid
graph LR
    A[src/cli.ts] --> B[src/github.ts]
    A --> C[src/topcoder.ts]
    A --> D[src/matchers/]
    
    B --> B1[authenticateWithGitHub]
    B --> B2[analyzeGithubProfile]
    B --> B3[fetchRepositories]
    B --> B4[fetchCommits]
    B --> B5[fetchPullRequests]
    
    C --> C1[fetchAllSkills]
    C --> C2[buildSkillIndex]
    
    D --> D1[ISkillsMatcher]
    D --> D2[LanguageMatcher]
    D --> D3[RepositoryMatcher]
    D --> D4[CommitMatcher]
    D --> D5[PullRequestMatcher]
    D --> D6[HybridMatcher]
    
    style A fill:#ff9999
    style B fill:#99ccff
    style C fill:#99ff99
    style D fill:#ffcc99
```

### 2. Skill Index Structure

```mermaid
graph TD
    A[SkillIndex] --> B["byName: Map&lt;string, Skill&gt;"]
    A --> C["byLowerName: Map&lt;string, Skill&gt;"]
    A --> D["byKeyword: Map&lt;string, Skill&gt;"]
    A --> E["all: Skill array"]
    
    B --> B1["'React' → {id, name, desc}"]
    C --> C1["'react' → [{...}]"]
    C --> C2["'javascript' → [{...}]"]
    D --> D1["'front' → [React, Frontend, ...]"]
    D --> D2["'web' → [React, Vue, ...]"]
    
    style A fill:#ffeb99
    style B fill:#99d6ff
    style C fill:#99d6ff
    style D fill:#99d6ff
    style E fill:#99d6ff
```

**Index Building Process:**
1. Exact name: `"React"` → Direct O(1) lookup
2. Case-insensitive: `"react"` → Array of matches
3. Keywords: Split skill name and description into words → Map word to skills
4. Enables multi-strategy matching without repeated API calls

### 3. Matcher Interface

```mermaid
classDiagram
    class ISkillsMatcher {
        <<interface>>
        +name: string
        +description: string
        +match(profile, skillIndex): Promise~SkillMatch[]~
    }
    
    class SkillMatch {
        +skillId: string
        +skillName: string
        +confidence: number
        +evidence: Evidence[]
        +rationale: string
        +sources: string[]
    }
    
    class Evidence {
        +type: EvidenceType
        +source: string
        +details?: string
        +url?: string
    }
    
    class EvidenceType {
        <<enumeration>>
        repo
        commit
        pr
        language
        topic
        file
    }
    
    ISkillsMatcher --> SkillMatch : returns
    SkillMatch --> Evidence : contains
    Evidence --> EvidenceType : uses
```

**Key Interfaces:**
- **ISkillsMatcher**: Contract all matchers must implement
- **SkillMatch**: Skill recommendation with confidence score
- **Evidence**: Proof from GitHub (repos, commits, PRs)
- **EvidenceType**: Classification of evidence source

## Matcher Algorithms

### 1. Language Matcher (Most Reliable)

```mermaid
flowchart TD
    A[Start: GitHub Profile] --> B[Extract Languages Map]
    B --> C[For each language]
    C --> D{Exact Match?}
    D -->|Yes| E[Confidence = 95%]
    D -->|No| F{Contains Match?}
    F -->|Yes| G[Confidence = 75%]
    F -->|No| H{Keyword Match?}
    H -->|Yes| I[Confidence = 60%]
    H -->|No| C
    
    E --> J[Boost by Repo Count]
    G --> J
    I --> J
    
    J --> K[Collect Evidence Repos]
    K --> L[Create SkillMatch]
    L --> M[Continue to next language]
    M --> C
    
    C --> N[Return Sorted Results]
    
    style A fill:#e1f5ff
    style N fill:#c8e6c9
```

**Algorithm:**
```
1. Extract: profile.languages → Map<string, number>
2. For each language:
   a. Exact match: "JavaScript" === skill.name → 95%
   b. Partial: "JavaScript" in skill.name → 75%
   c. Related: skill keywords contain "javascript" → 60%
3. Boost: +2% per repo (max +20%)
4. Evidence: List top 5 repos using this language
5. Return: Sorted by confidence (desc)
```

### 2. Repository Matcher

```mermaid
flowchart TD
    A[Start: GitHub Profile] --> B[For each repository]
    B --> C[Extract Metadata]
    C --> D[Repo Name]
    C --> E[Description]
    C --> F[Topics]
    
    D --> G[Tokenize Words]
    E --> G
    F --> G
    
    G --> H[For each token]
    H --> I{Token in skillIndex.byKeyword?}
    I -->|Yes| J[Add to skill matches]
    I -->|No| H
    
    J --> K[Calculate Confidence]
    K --> L[Base = 30]
    L --> M[+ repos × 5]
    M --> N[+ topics × 8]
    N --> O[+ descriptions × 3]
    
    O --> P[Cap at 85%]
    P --> Q[Collect Evidence]
    Q --> R[Return Results]
    
    style A fill:#e1f5ff
    style R fill:#c8e6c9
```

**Confidence Formula:**
```
confidence = min(30 + (matching_repos × 5) + (topics × 8) + (descriptions × 3), 85)
```

### 3. Commit Matcher

```mermaid
flowchart TD
    A[Start: GitHub Profile] --> B[For each repository]
    B --> C[Fetch Commit Messages]
    C --> D[Extract File Extensions]
    
    D --> E{Extension in mapping?}
    E -->|Yes| F[Map to skill: .js→JavaScript]
    E -->|No| G[Extract commit keywords]
    
    F --> H[Search skillIndex]
    G --> H
    
    H --> I[Calculate Confidence]
    I --> J[Base = 40]
    J --> K[+ commits × 3]
    K --> L[+ file changes × 2]
    
    L --> M[Cap at 80%]
    M --> N[Collect Evidence]
    N --> O[Return Results]
    
    style A fill:#e1f5ff
    style O fill:#c8e6c9
```

**File Extension Mapping:**
```typescript
'.js' | '.jsx' → 'JavaScript'
'.ts' | '.tsx' → 'TypeScript'
'.py' → 'Python'
'.java' → 'Java'
'.go' → 'Go'
'.rs' → 'Rust'
// ... etc
```

### 4. Pull Request Matcher

```mermaid
flowchart TD
    A[Start: GitHub Profile] --> B[For each repository]
    B --> C[Fetch Pull Requests]
    C --> D[Extract PR Metadata]
    
    D --> E[PR Title]
    D --> F[PR Description]
    D --> G[PR Labels]
    
    E --> H[Tokenize Words]
    F --> H
    G --> H
    
    H --> I{Token in skillIndex?}
    I -->|Yes| J[Add to matches]
    I -->|No| H
    
    J --> K[Calculate Confidence]
    K --> L[Base = 20]
    L --> M[+ PRs × 8]
    M --> N[+ labels × 5]
    
    N --> O[Cap at 75%]
    O --> P[Collect Evidence]
    P --> Q[Return Results]
    
    style A fill:#e1f5ff
    style Q fill:#c8e6c9
```

### 5. Hybrid Matcher (Recommended)

```mermaid
flowchart TD
    A[Start: GitHub Profile] --> B[Run All Matchers in Parallel]
    
    B --> C1[Language: Weight 1.0]
    B --> C2[Repository: Weight 0.7]
    B --> C3[Commit: Weight 0.5]
    B --> C4[PR: Weight 0.4]
    
    C1 --> D[Aggregate Results]
    C2 --> D
    C3 --> D
    C4 --> D
    
    D --> E[Group by Skill ID]
    E --> F[Weighted Confidence]
    F --> G[Formula: Σ confidence × weight / Σ weights]
    
    G --> H[Merge Evidence]
    H --> I[Deduplicate Sources]
    I --> J[Sort by Confidence]
    J --> K[Return Top Results]
    
    style A fill:#e1f5ff
    style K fill:#c8e6c9
```

**Weighted Combination:**
```
For each skill found by multiple matchers:
weighted_confidence = (
    language_confidence × 1.0 +
    repo_confidence × 0.7 +
    commit_confidence × 0.5 +
    pr_confidence × 0.4
) / total_weights_used
```

## Confidence Scoring System

```mermaid
graph LR
    A[Confidence Scale] --> B[90-100%: Expert]
    A --> C[75-89%: Advanced]
    A --> D[60-74%: Intermediate]
    A --> E[40-59%: Beginner]
    A --> F[0-39%: Exposure]
    
    B --> B1[Direct language matches<br/>10+ repos with skill]
    C --> C1[Strong keyword matches<br/>5-9 repos]
    D --> D1[Partial matches<br/>3-4 repos]
    E --> E1[Related keywords<br/>1-2 repos]
    F --> F1[Weak associations<br/>Mentioned in commits]
    
    style B fill:#4caf50
    style C fill:#8bc34a
    style D fill:#ffc107
    style E fill:#ff9800
    style F fill:#f44336
```

## Performance Optimization

### Skill Index Strategy

```mermaid
graph TD
    A[Optimization Strategy] --> B[Single API Call]
    A --> C[In-Memory Indexing]
    A --> D[O1 Lookups]
    
    B --> B1[fetchAllSkills once<br/>~10,000 skills<br/>1-2 seconds]
    
    C --> C1[byName Map<br/>Exact matches]
    C --> C2[byLowerName Map<br/>Case-insensitive]
    C --> C3[byKeyword Map<br/>Tokenized search]
    
    D --> D1[No repeated API calls]
    D --> D2[Instant skill lookup]
    D --> D3[Parallel matcher execution]
    
    style A fill:#ffeb99
    style B fill:#99ff99
    style C fill:#99d6ff
    style D fill:#ff99cc
```

**Before vs After:**
- **Before**: 100+ API calls per user (fuzzy match, semantic search for each language)
- **After**: 1 API call per session (fetch all skills once, match locally)
- **Speed**: 10-30 seconds → 2-5 seconds
- **Reliability**: Network failures → None (local matching)

## Error Handling

```mermaid
flowchart TD
    A[Error Handling Strategy] --> B[Rate Limiting]
    A --> C[Authentication Failures]
    A --> D[Network Errors]
    A --> E[Partial Data]
    
    B --> B1[GitHub: 403 Forbidden]
    B1 --> B2[Exponential Backoff]
    B2 --> B3[Retry up to 3 times]
    
    C --> C1[OAuth Token Expired]
    C1 --> C2[Re-authenticate]
    C2 --> C3[Save new token]
    
    D --> D1[Topcoder API Down]
    D1 --> D2[Graceful Degradation]
    D2 --> D3[Use cached skills if available]
    
    E --> E1[Some repos fail]
    E1 --> E2[Continue with available data]
    E2 --> E3[Log warnings, not errors]
    
    style A fill:#ff9999
    style B fill:#ffcc99
    style C fill:#ffff99
    style D fill:#ccff99
    style E fill:#99ffcc
```

## Output Formats

### Text Format
```
🎯 Topcoder Skill Recommendations for octocat
═══════════════════════════════════════════

1. JavaScript (98% confidence)
   Evidence:
   • Language: frontend-app (42 contributions)
   • Language: backend-api (38 contributions)
   • Repository: js-toolkit (topic: javascript)
   Found by: Language Matcher, Repository Matcher

2. React (95% confidence)
   Evidence:
   • Language: react-dashboard (56 contributions)
   • Repository: react-components (description: "React UI library")
   Found by: Language Matcher, Hybrid Matcher
```

### JSON Format
```json
{
  "username": "octocat",
  "matcher": "hybrid",
  "minConfidence": 50,
  "recommendations": [
    {
      "skillId": "abc123",
      "skillName": "JavaScript",
      "confidence": 98,
      "evidence": [
        {
          "type": "language",
          "source": "frontend-app",
          "details": "42 contributions",
          "url": "https://github.com/octocat/frontend-app"
        }
      ],
      "rationale": "Exact language match with high frequency",
      "sources": ["Language Matcher", "Repository Matcher"]
    }
  ]
}
```

## CLI Interface

```mermaid
graph TD
    A[CLI Commands] --> B[Flags]
    
    B --> C1[--username<br/>GitHub username]
    B --> C2[--matcher<br/>Algorithm selection]
    B --> C3[--min-confidence<br/>Filter threshold]
    B --> C4[--max-repos<br/>Analysis limit]
    B --> C5[--output<br/>Format: text/json]
    B --> C6[--top-n<br/>Max results]
    
    C2 --> D1[language]
    C2 --> D2[repository]
    C2 --> D3[commit]
    C2 --> D4[pr]
    C2 --> D5[hybrid default]
    C2 --> D6[all combine]
    
    style A fill:#e1f5ff
    style C2 fill:#fff4e1
```

**Example Usage:**
```bash
# Default (hybrid matcher, min 50% confidence)
npm start -- --username octocat

# Language-only matching
npm start -- --username octocat --matcher language

# High confidence only
npm start -- --username octocat --min-confidence 75

# JSON output for API integration
npm start -- --username octocat --output json > results.json

# Run all matchers and combine
npm start -- --username octocat --matcher all --top-n 20
```

## Security & Privacy

- **OAuth Token Storage**: Stored in `.github-token` file (gitignored)
- **No Data Persistence**: GitHub profile data not stored, processed in-memory only
- **API Keys**: Environment variables for any optional AI providers
- **Rate Limits**: Respects GitHub API limits (5000/hour authenticated)

## Extensibility

The architecture supports easy addition of new matchers - see [PLUGIN_GUIDE.md](PLUGIN_GUIDE.md) for step-by-step instructions.
