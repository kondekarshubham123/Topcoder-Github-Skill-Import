// Fast, explainable AI-based matching algorithm:
export function matchSkills({ repoLangSummary, fuzzySkillsList }: {
  repoLangSummary: { [repo: string]: string[] },
  fuzzySkillsList: { [lang: string]: any[] }
}): SkillMatch[] {
  const skillScores: { [skillId: string]: SkillMatch } = {};
  // Count language frequency
  const langCounts: { [lang: string]: number } = {};
  Object.values(repoLangSummary).flat().forEach(lang => {
    langCounts[lang] = (langCounts[lang] || 0) + 1;
  });
  // For each language, aggregate fuzzy matches
  for (const [lang, skills] of Object.entries(fuzzySkillsList)) {
    for (const skill of skills) {
      // Score: direct match gets 100, partial gets 70, otherwise 50
      let score = 50;
      if (skill.name.toLowerCase() === lang.toLowerCase()) score = 100;
      else if (skill.name.toLowerCase().includes(lang.toLowerCase())) score = 70;
      // Boost by frequency
      score += Math.min(langCounts[lang] * 10, 30);
      score = Math.min(score, 100);
      // Evidence: repo names containing the language
      const evidence = Object.entries(repoLangSummary)
        .filter(([repo, langs]) => langs.includes(lang))
        .map(([repo]) => repo);
      skillScores[skill.id] = {
        skillId: skill.id,
        skillName: skill.name,
        confidence: score,
        evidence,
        rationale: `Matched via fuzzy search for '${lang}'. Frequency: ${langCounts[lang]}. Direct match: ${score === 100}. Evidence repos: ${evidence.join(', ')}`
      };
    }
  }
  // Return sorted by confidence
  return Object.values(skillScores).sort((a, b) => b.confidence - a.confidence);
}

// Semantic similarity matching using Universal Sentence Encoder
export type SkillMatch = {
  skillId: string;
  skillName: string;
  confidence: number;
  evidence: string[];
  rationale: string;
};

export async function matchSkillsSemantic({ repoLangSummary, skills }: {
  repoLangSummary: { [repo: string]: string[] },
  skills: { id: string, name: string, description?: string }[]
}): Promise<SkillMatch[]> {
  const use = await import('@tensorflow-models/universal-sentence-encoder');
  const tf = await import('@tensorflow/tfjs');
  const model = await use.load();
  // Prepare texts
  console.log(skills);
  const repoLangs = Array.from(new Set(Object.values(repoLangSummary).flat()));
  const repoText = repoLangs.join(', ');
  const skillTexts = skills.map(s => s.name + (s.description ? ' ' + s.description : ''));
  // Embed
  const embeddings = await model.embed([repoText, ...skillTexts]);
  const embeddingArray = await embeddings.array();
  const [repoEmbedding, ...skillEmbeddings] = embeddingArray;
  // Compute cosine similarity
  function cosine(a: number[], b: number[]) {
    const dot = a.reduce((sum, v, i) => sum + v * b[i], 0);
    const normA = Math.sqrt(a.reduce((sum, v) => sum + v * v, 0));
    const normB = Math.sqrt(b.reduce((sum, v) => sum + v * v, 0));
    return dot / (normA * normB);
  }
  // Score and return
  return skills.map((skill, i) => ({
    skillId: skill.id,
    skillName: skill.name,
    confidence: Math.round(cosine(repoEmbedding, skillEmbeddings[i]) * 100),
    evidence: repoLangs,
    rationale: `Cosine similarity between repo languages and skill name/description.`
  })).sort((a, b) => b.confidence - a.confidence);
}

