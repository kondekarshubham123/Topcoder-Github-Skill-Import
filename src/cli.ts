import 'dotenv/config';
import inquirer from 'inquirer';
import ora from 'ora';
import chalk from 'chalk';
import open from 'open';
import { getDeviceCode, pollForToken, getAuthenticatedUser, getUserRepos } from './github';

async function main() {
	console.log(chalk.green('Welcome to the Topcoder Skills Recommender CLI!'));

	// Step 1: Github OAuth Device Flow
	const { device_code, user_code, verification_uri, interval } = await getDeviceCode();
	console.log(chalk.yellow(`\nTo authorize, visit: ${verification_uri}`));
	console.log(chalk.yellow(`And enter code: ${user_code}\n`));
	await open(verification_uri);

	const auth = await pollForToken(device_code, interval);
	console.log(chalk.green('Authenticated with Github!'));

	// Step 2: Fetch Github user data
	const user = await getAuthenticatedUser(auth.access_token);
	console.log(chalk.cyan(`Authenticated as: ${(user as any).login} (${(user as any).html_url})`));

	const spinner = ora('Fetching repositories...').start();
	const repos = await getUserRepos(auth.access_token);
	spinner.succeed(`Fetched ${repos.length} repositories.`);

	// Step 3: Fetch languages for each repo
	const { getRepoLanguages } = await import('./github');
	const repoLangSummary: { [repo: string]: string[] } = {};
	for (const repo of repos) {
		try {
			const langObj = await getRepoLanguages(auth.access_token, repo.owner.login, repo.name);
			const langKeys = Object.keys(langObj as Record<string, unknown>);
			repoLangSummary[repo.full_name] = langKeys;
			console.log(chalk.gray(`Repo: ${repo.full_name} | Languages: ${langKeys.join(', ')}`));
		} catch (err) {
			console.warn(chalk.yellow(`Warning: Failed to fetch languages for repo ${repo.full_name}. Skipping.`));
		}
	}


	const { fuzzyMatchSkills } = await import('./topcoder');
	const allLanguages = Array.from(new Set(Object.values(repoLangSummary).flat()));
	console.log(chalk.blue(`\nRunning fuzzy match for skills using detected languages: ${allLanguages.join(', ')}`));
	let fuzzySkillsList: { [lang: string]: any[] } = {};
	if (allLanguages.length > 0) {
		try {
			for (let lang of allLanguages) {
				const term = lang.split(' ')[0];
				if (!term) continue;
				const fuzzyResults = await fuzzyMatchSkills(term, 10);
				fuzzySkillsList[lang] = fuzzyResults;
			}
			// Use AI matching algorithm
			// Use named import for matchSkills
			const { matchSkills } = await import('./skillsMatcher');
			const matches = matchSkills({ repoLangSummary, fuzzySkillsList });
			if (matches.length > 0) {
				console.log(chalk.green(`\nTop recommended skills with confidence and evidence:`));
				matches.slice(0, 10).forEach((match: import('./skillsMatcher').SkillMatch, idx: number) => {
					console.log(`${idx + 1}. ${match.skillName} (ID: ${match.skillId}) - Confidence: ${match.confidence}`);
					console.log(`   Evidence: ${match.evidence.join(', ')}`);
					console.log(`   Rationale: ${match.rationale}`);
				});
			} else {
				console.log(chalk.yellow('No skills recommended by fuzzy match.'));
			}
		} catch (err) {
			console.error(chalk.red('Fuzzy match failed:'), err);
		}
	} else {
		console.log(chalk.yellow('No languages detected in repos to use for skill matching.'));
	}

	// Step 6: Semantic AI/ML skill matching
	const { fetchAllSkills } = await import('./topcoder');
	const { matchSkillsSemantic } = await import('./skillsMatcher');
	const skills = await fetchAllSkills();
	console.log(chalk.magenta(`Fetched ${skills.length} Topcoder standardized skills.`));

	const semanticMatches = await matchSkillsSemantic({ repoLangSummary, skills });
	if (semanticMatches.length > 0) {
		console.log(chalk.cyan(`\nTop semantic AI/ML recommended skills:`));
		semanticMatches.slice(0, 10).forEach((match, idx) => {
			console.log(`${idx + 1}. ${match.skillName} (ID: ${match.skillId}) - Confidence: ${match.confidence}`);
			console.log(`   Evidence: ${match.evidence.join(', ')}`);
			console.log(`   Rationale: ${match.rationale}`);
		});
	} else {
		console.log(chalk.yellow('No skills recommended by semantic AI/ML match.'));
	}

	// TODO: Output recommendations and run summary
}

main().catch(err => {
	console.error(chalk.red('Error:'), err);
	process.exit(1);
});
