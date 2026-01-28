# Design Flow & Architecture Diagrams

This document provides visual representations of the system's design, data flow, and decision-making processes.

## 1. System Overview

```mermaid
flowchart LR
    User([👤 Developer]) -->|npm start| CLI[📦 Skills Recommender CLI]
    CLI -->|OAuth + Fetch Data| GitHub[(🔗 GitHub API)]
    CLI -->|Download Skills| Topcoder[(🎯 Topcoder API)]
    CLI -->|📊 Results| User
    
    GitHub -.->|Profile, Repos, Commits, PRs| CLI
    Topcoder -.->|10,000+ Skills| CLI
    
    style User fill:#e3f2fd,stroke:#1976d2,stroke-width:3px
    style CLI fill:#fff3e0,stroke:#f57c00,stroke-width:3px
    style GitHub fill:#e8f5e9,stroke:#388e3c,stroke-width:2px
    style Topcoder fill:#fce4ec,stroke:#c2185b,stroke-width:2px
```

### 📋 Process Flow

| Step | Action | Details |
|------|--------|---------|
| **1️⃣ Launch** | User runs `npm start` | Single command execution |
| **2️⃣ Auth** | GitHub OAuth authentication | Device flow, token saved to `.github-token` |
| **3️⃣ Collect** | Fetch GitHub data | Repos, commits, PRs, languages (paginated) |
| **4️⃣ Download** | Get Topcoder skills | ~10,000 skills in one API call |
| **5️⃣ Index** | Build search index | Creates 3 maps: byName, byLowerName, byKeyword |
| **6️⃣ Match** | Run algorithm(s) | 100% local matching, zero additional API calls |
| **7️⃣ Display** | Show results | Ranked skills with confidence scores + evidence |

### 🎯 Key Benefits

- **⚡ Fast**: 2-5 seconds total (vs 30-60s with API-based matching)
- **🔒 Secure**: OAuth token stored locally, reused for future runs
- **📊 Evidence-Based**: Every skill includes verifiable GitHub links
- **🔄 Flexible**: 6+ matching algorithms to choose from

```mermaid
flowchart TB
    Start([User runs CLI]) --> Auth[GitHub OAuth<br/>Device Flow]
    Auth --> SaveToken[Save token to<br/>.github-token]
    
    SaveToken --> FetchProfile[Fetch GitHub Profile]
    FetchProfile --> FetchRepos[Fetch Repositories<br/>Paginated]
    
    FetchRepos --> ParallelRepo{For each repo}
    ParallelRepo --> |Parallel| FetchLang[Fetch Languages]
    ParallelRepo --> |Parallel| FetchCommits[Fetch Commits<br/>Max 100 per repo]
    ParallelRepo --> |Parallel| FetchPRs[Fetch Pull Requests]
    
    FetchLang --> BuildProfile[Build GithubProfile]
    FetchCommits --> BuildProfile
    FetchPRs --> BuildProfile
    
    BuildProfile --> FetchSkills[Fetch All Topcoder Skills<br/>~10,000 skills]
    FetchSkills --> BuildIndex[Build Skill Index<br/>Maps: byName, byLowerName, byKeyword]
    
    BuildIndex --> SelectMatcher{Select Matcher}
    
    SelectMatcher --> |language| LangMatch[Language Matcher]
    SelectMatcher --> |repository| RepoMatch[Repository Matcher]
    SelectMatcher --> |commit| CommitMatch[Commit Matcher]
    SelectMatcher --> |pr| PRMatch[PR Matcher]
    SelectMatcher --> |hybrid| HybridMatch[Hybrid Matcher<br/>Combines all]
    SelectMatcher --> |all| AllMatch[All Matchers<br/>Sequential]
    
    LangMatch --> Aggregate[Aggregate Results]
    RepoMatch --> Aggregate
    CommitMatch --> Aggregate
    PRMatch --> Aggregate
    HybridMatch --> Aggregate
    AllMatch --> Aggregate
    
    Aggregate --> Filter[Filter by<br/>Min Confidence]
    Filter --> Sort[Sort by<br/>Confidence DESC]
    Sort --> Limit[Limit to Top N]
    
    Limit --> FormatCheck{Output Format}
    FormatCheck --> |text| TextFormat[Format as Text<br/>with colors]
    FormatCheck --> |json| JSONFormat[Format as JSON]
    
    TextFormat --> Display[Display Results]
    JSONFormat --> Display
    
    Display --> End([Done])
    
    style Start fill:#e1f5ff
    style Auth fill:#fff4e1
    style BuildProfile fill:#f0ffe1
    style BuildIndex fill:#ffe1f5
    style SelectMatcher fill:#ffeb99
    style Display fill:#c8e6c9
    style End fill:#c8e6c9
```

## 2. Complete Data Flow

```mermaid
flowchart TB
    Start([User runs CLI]) --> Auth[GitHub OAuth<br/>Device Flow]
    Auth --> SaveToken[Save token to<br/>.github-token]
    
    SaveToken --> FetchProfile[Fetch GitHub Profile]
    FetchProfile --> FetchRepos[Fetch Repositories<br/>Paginated]
    
    FetchRepos --> ParallelRepo{For each repo}
    ParallelRepo --> |Parallel| FetchLang[Fetch Languages]
    ParallelRepo --> |Parallel| FetchCommits[Fetch Commits<br/>Max 100 per repo]
    ParallelRepo --> |Parallel| FetchPRs[Fetch Pull Requests]
    
    FetchLang --> BuildProfile[Build GithubProfile]
    FetchCommits --> BuildProfile
    FetchPRs --> BuildProfile
    
    BuildProfile --> FetchSkills[Fetch All Topcoder Skills<br/>~10,000 skills]
    FetchSkills --> BuildIndex[Build Skill Index<br/>Maps: byName, byLowerName, byKeyword]
    
    BuildIndex --> SelectMatcher{Select Matcher}
    
    SelectMatcher --> |language| LangMatch[Language Matcher]
    SelectMatcher --> |repository| RepoMatch[Repository Matcher]
    SelectMatcher --> |commit| CommitMatch[Commit Matcher]
    SelectMatcher --> |pr| PRMatch[PR Matcher]
    SelectMatcher --> |hybrid| HybridMatch[Hybrid Matcher<br/>Combines all]
    SelectMatcher --> |all| AllMatch[All Matchers<br/>Sequential]
    
    LangMatch --> Aggregate[Aggregate Results]
    RepoMatch --> Aggregate
    CommitMatch --> Aggregate
    PRMatch --> Aggregate
    HybridMatch --> Aggregate
    AllMatch --> Aggregate
    
    Aggregate --> Filter[Filter by<br/>Min Confidence]
    Filter --> Sort[Sort by<br/>Confidence DESC]
    Sort --> Limit[Limit to Top N]
    
    Limit --> FormatCheck{Output Format}
    FormatCheck --> |text| TextFormat[Format as Text<br/>with colors]
    FormatCheck --> |json| JSONFormat[Format as JSON]
    
    TextFormat --> Display[Display Results]
    JSONFormat --> Display
    
    Display --> End([Done])
    
    style Start fill:#e1f5ff
    style Auth fill:#fff4e1
    style BuildProfile fill:#f0ffe1
    style BuildIndex fill:#ffe1f5
    style SelectMatcher fill:#ffeb99
    style Display fill:#c8e6c9
    style End fill:#c8e6c9
```


## 3. AI Provider Selection Flow

```mermaid
graph TD
    Start([User runs CLI]) --> CheckFlag{--ai-provider<br/>specified?}
    
    CheckFlag --> |No| NoAI[No AI Provider<br/>Keyword Matching]
    CheckFlag --> |Yes| Which{Which provider?}
    
    Which --> |openai| OpenAICheck{OPENAI_API_KEY<br/>exists?}
    Which --> |gemini| GeminiCheck{GEMINI_API_KEY<br/>exists?}
    Which --> |ollama| OllamaCheck{Ollama server<br/>available?}
    
    OpenAICheck --> |Yes| InitOpenAI[Initialize OpenAI Provider]
    OpenAICheck --> |No| Error1[❌ Error: Missing API key]
    
    GeminiCheck --> |Yes| InitGemini[Initialize Gemini Provider]
    GeminiCheck --> |No| Error2[❌ Error: Missing API key]
    
    OllamaCheck --> |Yes| InitOllama[Initialize Ollama Provider]
    OllamaCheck --> |No| Warn[⚠️  Warning: Ollama not available<br/>Fall back to keyword matching]
    
    InitOpenAI --> ModeCheck{Provider supports<br/>LLM?}
    InitGemini --> ModeCheck
    InitOllama --> ModeCheck
    Warn --> NoAI
    
    ModeCheck --> |Yes| LLMMode[🤖 LLM-Based Reasoning<br/>Primary Mode]
    ModeCheck --> |Fallback| EmbedMode[📊 Embedding Similarity<br/>Fallback Mode]
    
    LLMMode --> OpenAILLM[OpenAI: GPT-4o-mini<br/>$0.15/1M tokens]
    LLMMode --> GeminiLLM[Gemini: Gemini Pro<br/>$0.075/1M tokens]
    LLMMode --> OllamaLLM[Ollama: llama3.2<br/>Free, local]
    
    EmbedMode --> OpenAIEmbed[OpenAI: text-embedding-3-small<br/>$0.02/1M tokens]
    EmbedMode --> GeminiEmbed[Gemini: embedding-001<br/>Free]
    EmbedMode --> OllamaEmbed[Ollama: nomic-embed-text<br/>Free, local]
    
    OpenAILLM --> Results[Skill Matches with Confidence]
    GeminiLLM --> Results
    OllamaLLM --> Results
    OpenAIEmbed --> Results
    GeminiEmbed --> Results
    OllamaEmbed --> Results
    NoAI --> Results
    
    Results --> Cache{Results cached?}
    Cache --> |Yes| UseCache[Use Cached Results<br/>No API call]
    Cache --> |No| SaveCache[Save to Cache<br/>For future use]
    
    UseCache --> Display[Display Results]
    SaveCache --> Display
    
    style Start fill:#e1f5ff
    style LLMMode fill:#c8e6c9
    style EmbedMode fill:#fff4e1
    style Results fill:#ffeb99
    style Display fill:#c8e6c9
    style Error1 fill:#ffcdd2
    style Error2 fill:#ffcdd2
    style Warn fill:#fff9c4
```

**Key Decision Points:**

1. **Provider Selection** - User chooses OpenAI, Gemini, Ollama, or none
2. **Credential Validation** - API keys checked for cloud providers
3. **Availability Check** - Ollama server connectivity tested
4. **Matching Mode** - LLM reasoning preferred over embeddings
5. **Caching** - Results cached to minimize API costs

**Matching Quality Hierarchy:**
```
🥇 LLM-Based Reasoning (OpenAI/Gemini/Ollama)
   ↓ (if unavailable or rate limited)
🥈 Embedding Similarity (Vector search)
   ↓ (if provider unavailable)
🥉 Keyword Matching (Basic text search)
```

## 4. Matcher Selection Decision Tree

```mermaid
graph TD
    Start{User specifies<br/>--matcher flag?}
    
    Start --> |No| Default[Use Hybrid Matcher]
    Start --> |Yes| Check{Which matcher?}
    
    Check --> |language| UseLang[Language Matcher<br/>✓ Most reliable<br/>✓ Fast<br/>✓ Based on code languages]
    
    Check --> |repository| UseRepo[Repository Matcher<br/>✓ Considers metadata<br/>✓ Topics & descriptions<br/>✓ Good for project types]
    
    Check --> |commit| UseCommit[Commit Matcher<br/>✓ Deep analysis<br/>✓ File extensions<br/>✓ Slower but detailed]
    
    Check --> |pr| UsePR[Pull Request Matcher<br/>✓ Collaboration focus<br/>✓ Labels & titles<br/>✓ Open source contributors]
    
    Check --> |hybrid| UseHybrid[Hybrid Matcher<br/>✓ RECOMMENDED<br/>✓ Weighted combination<br/>✓ Best accuracy]
    
    Check --> |all| UseAll[All Matchers<br/>✓ Maximum coverage<br/>✓ Multiple perspectives<br/>✓ Longest runtime]
    Check --> |semantic| UseSemantic{AI Provider?}
    UseSemantic --> |openai| UseOpenAI[OpenAI Provider<br/>GPT-4o-mini + Embeddings]
    UseSemantic --> |gemini| UseGemini[Gemini Provider<br/>Gemini Pro + Embeddings]
    UseSemantic --> |ollama| UseOllama[Ollama Provider<br/>llama3.2 Local LLM]
    UseSemantic --> |none| UseKeyword[Keyword Matching<br/>No AI]

    Default --> Execute[Execute Matching]
    UseLang --> Execute
    UseRepo --> Execute
    UseCommit --> Execute
    UsePR --> Execute
    UseHybrid --> Execute
    UseAll --> Execute
    UseOpenAI --> Execute
    UseOllama --> Execute
    UseKeyword --> Execute
    
    Execute --> Return[Return SkillMatch Array]
    
    style Default fill:#c8e6c9
    style UseHybrid fill:#c8e6c9
    style Execute fill:#ffeb99
    style Return fill:#e1f5ff
```

## 4. Language Matcher Algorithm

```mermaid
flowchart TD
    Start([LanguageMatcher.match]) --> ExtractLangs[Extract Languages Map<br/>from profile]
    
    ExtractLangs --> LoopLang{For each language}
    
    LoopLang --> SearchExact[Search: skillIndex.byName.get]
    SearchExact --> ExactFound{Exact match?}
    ExactFound --> |Yes| Conf95[Confidence = 95%]
    ExactFound --> |No| SearchLower[Search: skillIndex.byLowerName.get]
    
    SearchLower --> LowerFound{Contains match?}
    LowerFound --> |Yes| Conf75[Confidence = 75%]
    LowerFound --> |No| SearchKeyword[Search: skillIndex.byKeyword.get]
    
    SearchKeyword --> KeywordFound{Keyword match?}
    KeywordFound --> |Yes| Conf60[Confidence = 60%]
    KeywordFound --> |No| LoopLang
    
    Conf95 --> BoostFreq[Boost by repo frequency<br/>+2% per repo, max +20%]
    Conf75 --> BoostFreq
    Conf60 --> BoostFreq
    
    BoostFreq --> CollectEvidence[Collect Evidence:<br/>Top 5 repos using language]
    
    CollectEvidence --> CreateMatch[Create SkillMatch with:<br/>- skillId<br/>- skillName<br/>- confidence<br/>- evidence array<br/>- rationale<br/>- sources]
    
    CreateMatch --> CheckDupe{Already matched<br/>this skill?}
    CheckDupe --> |Yes, lower conf| Skip[Skip]
    CheckDupe --> |Yes, higher conf| Update[Update existing match]
    CheckDupe --> |No| Add[Add to results]
    
    Skip --> LoopLang
    Update --> LoopLang
    Add --> LoopLang
    
    LoopLang --> |Done| SortResults[Sort by confidence DESC]
    SortResults --> Return([Return SkillMatch array])
    
    style Start fill:#e1f5ff
    style Conf95 fill:#c8e6c9
    style Conf75 fill:#fff4e1
    style Conf60 fill:#ffe1f5
    style Return fill:#e1f5ff
```

## 5. Hybrid Matcher Weighted Combination

```mermaid
flowchart TD
    Start([HybridMatcher.match]) --> RunParallel[Run all matchers in parallel]
    
    RunParallel --> Lang[Language Matcher<br/>Weight: 1.0]
    RunParallel --> Repo[Repository Matcher<br/>Weight: 0.7]
    RunParallel --> Commit[Commit Matcher<br/>Weight: 0.5]
    RunParallel --> PR[PR Matcher<br/>Weight: 0.4]
    
    Lang --> WaitAll[await Promise.all]
    Repo --> WaitAll
    Commit --> WaitAll
    PR --> WaitAll
    
    WaitAll --> Group[Group by Skill ID]
    
    Group --> LoopSkill{For each unique skill}
    
    LoopSkill --> CalcWeighted[Calculate weighted confidence:<br/>Σ confidence × weight<br/>―――――――――――――――――<br/>Σ weights used]
    
    CalcWeighted --> Example[Example:<br/>Lang: 95 × 1.0 = 95<br/>Repo: 80 × 0.7 = 56<br/>Total: 151 ÷ 1.7 = 88.8%]
    
    Example --> MergeEvidence[Merge evidence from all matchers]
    
    MergeEvidence --> DedupeSources[Deduplicate sources array]
    
    DedupeSources --> UpdateRationale[Update rationale:<br/>Found by N matchers]
    
    UpdateRationale --> AddResult[Add to merged results]
    
    AddResult --> LoopSkill
    
    LoopSkill --> |Done| SortMerged[Sort by weighted confidence]
    
    SortMerged --> Return([Return SkillMatch array])
    
    style Start fill:#e1f5ff
    style RunParallel fill:#fff4e1
    style CalcWeighted fill:#ffeb99
    style Example fill:#c8e6c9
    style Return fill:#e1f5ff
```

## 6. Skill Index Lookup Performance

```mermaid
graph TD
    Query[User Query: JavaScript] --> Strategy{Lookup Strategy}
    
    Strategy --> Exact[Exact Name Match<br/>O1 lookup]
    Strategy --> Lower[Case-Insensitive<br/>O1 lookup]
    Strategy --> Keyword[Keyword Search<br/>O1 per keyword]
    
    Exact --> Map1[byName.get'JavaScript']
    Lower --> Map2[byLowerName.get'javascript']
    Keyword --> Map3[byKeyword.get'javascript'<br/>byKeyword.get'script'<br/>byKeyword.get'web']
    
    Map1 --> Result1[Single exact skill]
    Map2 --> Result2[Array of matching skills]
    Map3 --> Result3[Array of related skills]
    
    Result1 --> Combine[Combine & Deduplicate]
    Result2 --> Combine
    Result3 --> Combine
    
    Combine --> Final[Final Skill List]
    
    style Query fill:#e1f5ff
    style Exact fill:#c8e6c9
    style Lower fill:#c8e6c9
    style Keyword fill:#c8e6c9
    style Final fill:#ffe1f5
```

**Performance Comparison:**

| Approach | API Calls | Time | Reliability |
|----------|-----------|------|-------------|
| **Old (API-based)** | 100+ per user | 30-60s | Low (network dependent) |
| **New (Index-based)** | 1 per session | 2-5s | High (local lookup) |

## 7. Confidence Score Calculation

```mermaid
flowchart LR
    Base[Base Score] --> Indicators[Quality Indicators]
    Indicators --> Cap[Cap at Maximum]
    
    Base --> B1[Language Match: 40-95]
    Base --> B2[Repo Metadata: 30-85]
    Base --> B3[Commit Analysis: 40-80]
    Base --> B4[PR Analysis: 20-75]
    
    Indicators --> I1[+ Repo Frequency<br/>5% per repo]
    Indicators --> I2[+ Stars/Forks<br/>5-10% bonus]
    Indicators --> I3[+ Contributions<br/>10-20% bonus]
    Indicators --> I4[+ Multiple Matchers<br/>Weighted average]
    
    Cap --> C1[Language Max: 100%]
    Cap --> C2[Repo Max: 85%]
    Cap --> C3[Commit Max: 80%]
    Cap --> C4[PR Max: 75%]
    
    style Base fill:#e1f5ff
    style Indicators fill:#fff4e1
    style Cap fill:#c8e6c9
```

## 8. Evidence Collection Process

```mermaid
flowchart TD
    Start[Skill Match Found] --> Check{Evidence Type?}
    
    Check --> |Language| LangEv[Language Evidence]
    Check --> |Repository| RepoEv[Repository Evidence]
    Check --> |Commit| CommitEv[Commit Evidence]
    Check --> |PR| PREv[Pull Request Evidence]
    Check --> |Topic| TopicEv[Topic Evidence]
    Check --> |File| FileEv[File Evidence]
    
    LangEv --> L1[type: 'language'<br/>source: repo name<br/>details: N contributions<br/>url: github.com/user/repo]
    
    RepoEv --> R1[type: 'repo'<br/>source: repo name<br/>details: stars, forks<br/>url: github.com/user/repo]
    
    CommitEv --> C1[type: 'commit'<br/>source: commit SHA7<br/>details: message<br/>url: github.com/.../commit/SHA]
    
    PREv --> P1[type: 'pr'<br/>source: #123<br/>details: PR title<br/>url: github.com/.../pull/123]
    
    TopicEv --> T1[type: 'topic'<br/>source: topic name<br/>details: matched keywords]
    
    FileEv --> F1[type: 'file'<br/>source: file path<br/>details: extension/changes]
    
    L1 --> Collect[Collect into Evidence Array]
    R1 --> Collect
    C1 --> Collect
    P1 --> Collect
    T1 --> Collect
    F1 --> Collect
    
    Collect --> Limit[Limit to top 5-10 pieces]
    Limit --> Sort[Sort by relevance]
    Sort --> Return[Return with SkillMatch]
    
    style Start fill:#e1f5ff
    style Check fill:#fff4e1
    style Collect fill:#ffeb99
    style Return fill:#c8e6c9
```

## 9. Error Handling & Retry Logic

```mermaid
flowchart TD
    Start[Make API Call] --> Try{Try Request}
    
    Try --> Success[Success 200]
    Try --> RateLimit[429 Rate Limit]
    Try --> Auth[401 Unauthorized]
    Try --> NotFound[404 Not Found]
    Try --> Server[500 Server Error]
    Try --> Network[Network Error]
    
    RateLimit --> Wait[Exponential Backoff<br/>Wait: 2^attempt seconds]
    Wait --> Retry{Retry < 3?}
    Retry --> |Yes| Try
    Retry --> |No| Fail
    
    Auth --> Reauth[Re-authenticate OAuth]
    Reauth --> Try
    
    NotFound --> Log[Log Warning]
    Log --> Continue[Continue with partial data]
    
    Server --> Wait
    
    Network --> Wait
    
    Success --> Return[Return Data]
    Fail[Max Retries Exceeded] --> Error[Throw Error]
    Continue --> Return
    
    style Success fill:#c8e6c9
    style Fail fill:#ffcccc
    style Error fill:#ff9999
    style Return fill:#e1f5ff
```

## 10. CLI Execution Flow

```mermaid
stateDiagram-v2
    [*] --> ParseArgs: npm start
    ParseArgs --> ValidateFlags
    ValidateFlags --> CheckAuth: Valid
    ValidateFlags --> ShowHelp: Invalid
    
    CheckAuth --> Authenticate: No token
    CheckAuth --> LoadToken: Token exists
    
    Authenticate --> DeviceFlow
    DeviceFlow --> AwaitAuth: Show code
    AwaitAuth --> SaveToken
    
    LoadToken --> VerifyToken
    VerifyToken --> FetchProfile: Valid
    VerifyToken --> Authenticate: Expired
    
    FetchProfile --> AnalyzeProfile
    AnalyzeProfile --> FetchSkills
    FetchSkills --> BuildIndex
    BuildIndex --> SelectMatcher
    
    SelectMatcher --> RunMatcher
    RunMatcher --> FilterResults
    FilterResults --> FormatOutput
    
    FormatOutput --> DisplayText: --output text
    FormatOutput --> DisplayJSON: --output json
    
    DisplayText --> [*]
    DisplayJSON --> [*]
    ShowHelp --> [*]
```

## 11. Plugin Architecture

```mermaid
graph TD
    Interface[ISkillsMatcher Interface] --> Contract{Contract}
    
    Contract --> Name[name: string]
    Contract --> Desc[description: string]
    Contract --> Match[match method]
    
    Match --> Input[Input: GithubProfile,<br/>SkillIndex]
    Match --> Output[Output: SkillMatch Array]
    
    Interface --> Impl1[LanguageMatcher]
    Interface --> Impl2[RepositoryMatcher]
    Interface --> Impl3[CommitMatcher]
    Interface --> Impl4[PullRequestMatcher]
    Interface --> Impl5[HybridMatcher]
    Interface --> Impl6[YourCustomMatcher]
    
    Impl1 --> CLI[CLI Registers All]
    Impl2 --> CLI
    Impl3 --> CLI
    Impl4 --> CLI
    Impl5 --> CLI
    Impl6 --> CLI
    
    CLI --> Selection{User Selects}
    Selection --> Execute[Execute Chosen Matcher]
    Execute --> Results[Return Results]
    
    style Interface fill:#e1f5ff
    style Impl6 fill:#c8e6c9
    style CLI fill:#fff4e1
    style Results fill:#ffe1f5
```

**Adding a new matcher:**
1. Create class implementing `ISkillsMatcher`
2. Add to CLI switch statement
3. Optionally add to `HybridMatcher`
4. Done! No other code changes needed.

## 12. Rate Limiting Strategy

```mermaid
sequenceDiagram
    participant CLI
    participant GitHub
    participant RateHandler
    
    CLI->>GitHub: Fetch repos (page 1)
    GitHub-->>CLI: 200 OK + 4999 remaining
    
    CLI->>GitHub: Fetch repos (page 2)
    GitHub-->>CLI: 200 OK + 4998 remaining
    
    CLI->>GitHub: Fetch commits repo 1
    GitHub-->>CLI: 429 Rate Limited
    
    CLI->>RateHandler: Handle 429 Error
    RateHandler->>RateHandler: Calculate backoff: 2^1 = 2s
    RateHandler->>RateHandler: Wait 2 seconds
    
    RateHandler->>GitHub: Retry request
    GitHub-->>RateHandler: 200 OK
    RateHandler-->>CLI: Return data
    
    Note over CLI,GitHub: If retry fails again, backoff doubles: 4s, 8s...
```

## 13. Memory & Performance

```mermaid
graph TD
    Memory[Memory Management] --> Skills[Skills Database]
    Memory --> Profile[GitHub Profile]
    Memory --> Results[Match Results]
    
    Skills --> S1[~10,000 skills<br/>~5 MB]
    Skills --> S2[Index Maps<br/>~2 MB]
    
    Profile --> P1[User data<br/>~1 KB]
    Profile --> P2[Repositories<br/>~50 KB per 50 repos]
    Profile --> P3[Commits<br/>~200 KB per 50 repos]
    
    Results --> R1[Skill matches<br/>~10-50 KB]
    Results --> R2[Evidence arrays<br/>~20-100 KB]
    
    Total[Total: ~10-15 MB] --> Efficient[Efficient for CLI]
    
    style Memory fill:#e1f5ff
    style Total fill:#c8e6c9
```

**Performance Targets:**
- Full analysis: 2-5 seconds
- Memory usage: <50 MB
- API calls: 10-50 (depending on repo count)
- Output generation: <100ms

## 14. Future Enhancements

```mermaid
mindmap
    root((Future Features))
        Caching
            Local skill cache
            Profile cache TTL
            Incremental updates
        AI Integration
            OpenAI embeddings
            Custom ML models
            Semantic similarity
        Advanced Matchers
            Certification parser
            Blog post analyzer
            Social media integration
        Performance
            Parallel processing
            GraphQL API
            WebAssembly matchers
        Output
            HTML reports
            PDF generation
            Interactive dashboard
        Collaboration
            Team analysis
            Org-wide skills
            Skill gap detection
```

---

## Summary

This system is designed for:
- ✅ **Speed**: Local matching with O(1) lookups
- ✅ **Accuracy**: Multiple specialized matchers
- ✅ **Extensibility**: Plug-and-play architecture
- ✅ **Evidence**: Traceable recommendations
- ✅ **Flexibility**: CLI flags for customization

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed component documentation.
