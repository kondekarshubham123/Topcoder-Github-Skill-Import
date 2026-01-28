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
    F --> G6[Semantic Matcher]
    
    G6 --> AI{AI Provider?}
    AI --> AI1[OpenAI Provider<br/>GPT-4o + Embeddings]
    AI --> AI2[Gemini Provider<br/>Gemini Pro + Embeddings]
    AI --> AI3[Ollama Provider<br/>Local LLM]
    AI --> AI4[No Provider<br/>Keyword Matching]
    
    G1 --> H[Results Aggregator]
    G2 --> H
    G3 --> H
    G4 --> H
    G5 --> H
    AI1 --> H
    AI2 --> H
    AI3 --> H
    AI4 --> H
    
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

### 2. AI Provider Architecture

```mermaid
graph TB
    A[CLI with --ai-provider flag] --> B{Provider Selection}
    
    B --> C[OpenAI Provider]
    B --> D[Gemini Provider]
    B --> E[Ollama Provider]
    B --> F[No Provider]
    
    C --> C1[API Key Required]
    D --> D1[API Key Required]
    E --> E1[Local Server Check]
    F --> F1[Keyword Matching]
    
    C1 --> G[ISemanticProvider Interface]
    D1 --> G
    E1 --> G
    
    G --> H{Matching Mode}
    H --> H1[LLM-Based Reasoning<br/>Primary Mode]
    H --> H2[Embedding Similarity<br/>Fallback Mode]
    
    H1 --> I1[OpenAI: GPT-4o-mini]
    H1 --> I2[Gemini: Gemini Pro]
    H1 --> I3[Ollama: llama3.2]
    
    H2 --> J1[OpenAI: text-embedding-3-small]
    H2 --> J2[Gemini: embedding-001]
    H2 --> J3[Ollama: nomic-embed-text]
    
    I1 --> K[GenAI Reasoning Results]
    I2 --> K
    I3 --> K
    J1 --> K
    J2 --> K
    J3 --> K
    F1 --> K
    
    K --> L[Skill Matches with Confidence]
    
    style A fill:#e1f5ff
    style B fill:#fff4e1
    style H fill:#f0ffe1
    style H1 fill:#c8e6c9
    style H2 fill:#ffe1f5
    style K fill:#ffeb99
    style L fill:#c8e6c9
```

**AI Provider Features:**

| Provider | Type | LLM Model | Embedding Model | Privacy | Cost |
|----------|------|-----------|-----------------|---------|------|
| **OpenAI** | Cloud | GPT-4o-mini | text-embedding-3-small | ❌ Cloud | $0.15-$0.20 per analysis |
| **Gemini** | Cloud | Gemini Pro | embedding-001 | ❌ Cloud | $0.10-$0.15 per analysis |
| **Ollama** | Local | llama3.2 | nomic-embed-text | ✅ 100% Local | Free |
| **None** | N/A | N/A | N/A | ✅ No AI | Free |

**Dual-Mode Matching:**
1. **LLM-Based Reasoning (Primary)** - Uses GenAI to understand context and infer skills
2. **Embedding Similarity (Fallback)** - Uses vector embeddings for semantic matching
3. **Keyword Matching (Last Resort)** - Basic text matching when AI unavailable

### 3. Skill Index Structure

```mermaid
graph TD
    A[SkillIndex] --> B["byName: Map&lt;string, Skill&gt;"]
    A --> C["byLowerName: Map&lt;string, Skill array&gt;"]
    A --> D["byKeyword: Map&lt;string, Skill array&gt;"]
    A --> E["all: Skill array"]
    
    B --> B1["'React' → {id, name, desc}"]
    C --> C1["'react' → array of skills"]
    C --> C2["'javascript' → array of skills"]
    D --> D1["'front' → React, Frontend, ..."]
    D --> D2["'web' → React, Vue, ..."]
    
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
    A[Error Handling Strategy]
    A --> B[Rate Limiting]
    A --> C[Authentication Failures]
    A --> D[Network Errors]
    A --> E[Partial Data]
    A --> F[AI Provider Errors]
    
    B --> B1[GitHub 403 Forbidden]
    B1 --> B2[Exponential Backoff]
    B2 --> B3[Retry up to 3 times]
    
    C --> C1[OAuth Token Expired]
    C1 --> C2[Re-authenticate User]
    C2 --> C3[Save New Token]
    
    D --> D1[Topcoder API Down]
    D1 --> D2[Graceful Degradation]
    D2 --> D3[Use Cached Skills]
    
    E --> E1[Some Repos Fail]
    E1 --> E2[Continue with Available Data]
    E2 --> E3[Log Warnings]
    
    F --> F1[OpenAI Invalid Key]
    F --> F2[Gemini 404 Error]
    F --> F3[Ollama Connection Refused]
    F --> F4[Ollama Timeout]
    
    F1 --> F5[Verify API Key]
    F2 --> F6[Check API Endpoint]
    F3 --> F7[Start Ollama Server]
    F4 --> F8[Increase Timeout or Use Smaller Model]
    
    F5 --> F9[Fallback to Keyword Matching]
    F6 --> F9
    F7 --> F9
    F8 --> F9
```

**Error Recovery Strategies:**

| Error Type | Detection | Recovery | Fallback |
|------------|-----------|----------|----------|
| **Rate Limiting** | HTTP 403 | Exponential backoff, retry | Wait and continue |
| **Auth Failure** | Invalid token | Re-authenticate | Request new OAuth |
| **Network Error** | Connection timeout | Retry with timeout | Use cached data |
| **Partial Data** | Some requests fail | Continue processing | Log warnings only |
| **AI Provider** | Various | Provider-specific | Keyword matching |

**AI Provider Error Handling:**

- **OpenAI Invalid Key**: Verify key at platform.openai.com → Fallback to keyword matching
- **Gemini 404**: Check API endpoint version → Fallback to keyword matching  
- **Ollama Connection Refused**: Check `ollama serve` running → Fallback to keyword matching
- **Ollama Timeout**: Increase timeout (`--ollama-timeout 300`), use smaller model (`llama3.2:1b`), or reduce data (`--max-repos 10`)


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

---

## AI Provider Deep Dive

### LLM-Based vs Embedding-Based Matching

```mermaid
graph LR
    A[GitHub Profile Data] --> B{Matching Strategy}
    
    B --> C[LLM-Based Reasoning<br/>Primary Mode]
    B --> D[Embedding Similarity<br/>Fallback Mode]
    B --> E[Keyword Matching<br/>Last Resort]
    
    C --> C1[GPT-4o-mini<br/>Contextual understanding]
    C --> C2[Gemini Pro<br/>Google's reasoning]
    C --> C3[llama3.2<br/>Local inference]
    
    D --> D1[text-embedding-3-small<br/>1536 dimensions]
    D --> D2[embedding-001<br/>768 dimensions]
    D --> D3[nomic-embed-text<br/>Local vectors]
    
    E --> E1[Simple text matching<br/>No AI required]
    
    C1 --> F[Skill Recommendations]
    C2 --> F
    C3 --> F
    D1 --> F
    D2 --> F
    D3 --> F
    E1 --> F
    
    F --> G[Confidence Scores<br/>Evidence Links<br/>Reasoning]
    
    style C fill:#c8e6c9
    style D fill:#fff4e1
    style E fill:#ffcdd2
    style F fill:#e1f5ff
```

### Provider Implementation Details

#### OpenAI Provider
```typescript
class OpenAIProvider implements ISemanticProvider {
  name = 'OpenAI';
  supportsLLM = true;
  
  // LLM-based reasoning (primary)
  async matchSkillsWithLLM(profile: string, skills: string[]) {
    const prompt = `Analyze this GitHub profile and match to skills...`;
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      messages: [{ role: 'user', content: prompt }]
    });
    // Returns: [{skill, confidence, reasoning}]
  }
  
  // Embedding fallback
  async computeSimilarity(text1: string, text2: string) {
    const embeddings = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: [text1, text2]
    });
    return cosineSimilarity(embeddings[0], embeddings[1]);
  }
}
```

**Costs (as of 2026):**
- GPT-4o-mini: $0.15 per 1M input tokens, $0.60 per 1M output tokens
- text-embedding-3-small: $0.02 per 1M tokens
- **Typical analysis**: ~$0.15-$0.20 per user

#### Gemini Provider
```typescript
class GeminiProvider implements ISemanticProvider {
  name = 'Google Gemini';
  supportsLLM = true;
  
  // LLM-based reasoning (primary)
  async matchSkillsWithLLM(profile: string, skills: string[]) {
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',
      {
        method: 'POST',
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );
    // Parse structured response
  }
  
  // Embedding fallback
  async computeSimilarity(text1: string, text2: string) {
    const embeddings = await generateEmbeddings('embedding-001', [text1, text2]);
    return cosineSimilarity(embeddings[0], embeddings[1]);
  }
}
```

**Costs (as of 2026):**
- Gemini Pro: $0.075 per 1M input tokens, $0.30 per 1M output tokens
- embedding-001: Free up to quota
- **Typical analysis**: ~$0.10-$0.15 per user

#### Ollama Provider (Local)
```typescript
class OllamaProvider implements ISemanticProvider {
  name = 'Ollama (Local)';
  supportsLLM = true;
  
  // Check availability
  async isAvailable(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/tags`, { timeout: 5000 });
      return response.status === 200;
    } catch {
      return false;
    }
  }
  
  // LLM-based reasoning (primary)
  async matchSkillsWithLLM(profile: string, skills: string[]) {
    const response = await axios.post(`${this.baseUrl}/api/generate`, {
      model: this.model, // llama3.2
      prompt: `Analyze this profile and match skills...`,
      stream: false
    }, { timeout: 60000 });
    // Parse response
  }
  
  // Embedding fallback
  async computeSimilarity(text1: string, text2: string) {
    const embeddings = await this.generateEmbeddings([text1, text2]);
    return cosineSimilarity(embeddings[0], embeddings[1]);
  }
}
```

**Benefits:**
- ✅ 100% local - no data leaves your machine
- ✅ Free - no API costs
- ✅ Privacy-focused
- ✅ No internet required (after model download)
- ✅ Customizable models

### Caching Strategy

```mermaid
flowchart TD
    A[Skill Matching Request] --> B{Check LLM Cache}
    
    B --> |Hit| C[Return Cached LLM Results<br/>$0 cost]
    B --> |Miss| D{Provider supports LLM?}
    
    D --> |Yes| E[Call LLM API<br/>$$$ cost]
    D --> |No| F{Check Embedding Cache}
    
    E --> G[Cache LLM Results<br/>TTL: 24 hours]
    G --> H[Return Results]
    
    F --> |Hit| I[Return Cached Embeddings<br/>$ cost saved]
    F --> |Miss| J[Compute Embeddings<br/>$ cost]
    
    J --> K[Cache Embeddings<br/>TTL: 7 days]
    K --> H
    I --> H
    C --> H
    
    style C fill:#c8e6c9
    style E fill:#ffcdd2
    style G fill:#fff4e1
    style H fill:#e1f5ff
```

**Cache Keys:**
- LLM: `llm:${provider}:${profileHash}:${skillsHash}`
- Embeddings: `embed:${provider}:${textHash}`

**TTL Strategy:**
- LLM results: 24 hours (profiles change frequently)
- Embeddings: 7 days (skill descriptions stable)

### Performance Comparison

| Provider | Cold Start | Cached | Accuracy | Privacy | Cost |
|----------|-----------|--------|----------|---------|------|
| **OpenAI** | 3-5s | <1s | ⭐⭐⭐⭐⭐ | ❌ Cloud | $0.20 |
| **Gemini** | 2-4s | <1s | ⭐⭐⭐⭐ | ❌ Cloud | $0.15 |
| **Ollama** | 5-10s | <1s | ⭐⭐⭐⭐ | ✅ Local | Free |
| **Keyword** | <1s | <1s | ⭐⭐⭐ | ✅ Local | Free |

### Batch Processing

```mermaid
sequenceDiagram
    participant CLI
    participant Matcher
    participant Provider
    participant Cache
    participant API
    
    CLI->>Matcher: Match 50 skills
    Matcher->>Cache: Check cached results
    Cache-->>Matcher: 30 hits, 20 misses
    
    Note over Matcher,Provider: Batch processing (10 skills/batch)
    
    Matcher->>Provider: Batch 1 (10 skills)
    Provider->>API: Single API call
    API-->>Provider: 10 embeddings
    Provider->>Cache: Store results
    Provider-->>Matcher: Return 10 matches
    
    Matcher->>Provider: Batch 2 (10 skills)
    Provider->>API: Single API call
    API-->>Provider: 10 embeddings
    Provider->>Cache: Store results
    Provider-->>Matcher: Return 10 matches
    
    Matcher->>Matcher: Combine all results
    Matcher-->>CLI: 50 skill matches
```

**Optimization:**
- ✅ Batch embeddings (10 skills per API call)
- ✅ Cache aggressively
- ✅ Parallel processing where possible
- ✅ Fallback gracefully (LLM → Embedding → Keyword)
