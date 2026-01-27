import 'dotenv/config';
import inquirer from 'inquirer';
import ora from 'ora';
import chalk from 'chalk';
import open from 'open';
import { getDeviceCode, pollForToken, getAuthenticatedUser, getUserRepos } from './github';



async function main() {
    console.log(chalk.green('Welcome to the Topcoder GitHub Skill Importer CLI!'));

    const { device_code, user_code, verification_uri, expires_in, interval } = await getDeviceCode();
    console.log(chalk.yellow(`\nTo authorize, please visit: ${verification_uri}`));
    console.log(chalk.yellow(`And enter the code: ${user_code}\n`));

    // Open the verification URL in the default browser
    await open(verification_uri);

    const auth = await pollForToken(device_code, interval);
    console.log(chalk.green('\nAuthorization successful!'));

    // Step 2: Fetch Github user data
    const user = await getAuthenticatedUser(auth.access_token);
    console.log(chalk.blue(`\nAuthenticated as GitHub user: ${(user as any).login} (${(user as any).html_url || 'no public email'})`));

    const spinner = ora('Fetching your repositories...').start();
    const repos = await getUserRepos(auth.access_token);
    spinner.succeed(`Fetched ${repos.length} repositories.`);

    // Step 3: Fetch languages for each repository
    const { getRepoLanguages } = await import('./github');
    const repoLangSummary: { [repo: string]: string[] } = {};
    
    for (const repo of repos) {
        try {
            const langObj = await getRepoLanguages(auth.access_token, repo.owner.login, repo.name);
            const langKeys = Object.keys(langObj as Record<string, unknown>);
            repoLangSummary[repo.full_name] = langKeys;
            console.log(chalk.gray(`Repo: ${repo.full_name} | Languages: ${langKeys.join(', ') || 'None'}`));
        } catch (err) {
            console.warn(chalk.yellow(`Warning: Failed to featch languages for repo ${repo.full_name}: ${err} skipping...`));
        }

    }

    const { fetchAllSkills } = await import('./topcoder');
    const topcoderSkills = await fetchAllSkills();
    console.log(chalk.green(`\nFetched ${topcoderSkills.length} Topcoder standardized skills.`));

    // TODO: Match GitHub languages to Topcoder skills
    // TODO: Output recommendations and run summary
}

main().catch(err => {
    console.error(chalk.red(`Error: ${err}`));
    process.exit(1);
});