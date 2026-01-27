
import axios from 'axios';
import open from 'open';
import ora from 'ora';

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || '';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '';
console.log('GITHUB_CLIENT_ID:', GITHUB_CLIENT_ID);
console.log('GITHUB_CLIENT_SECRET:', GITHUB_CLIENT_SECRET ? '[set]' : '[missing]');
const GITHUB_API = 'https://api.github.com';
const GITHUB_DEVICE_CODE_URL = 'https://github.com/login/device/code';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';

export interface GithubAuth {
	access_token: string;
	token_type: string;
	scope: string;
}

export interface RateLimitInfo {
	limit: number;
	remaining: number;
	reset: number;
}

let currentRateLimit: RateLimitInfo = { limit: 5000, remaining: 5000, reset: Date.now() };

export async function getDeviceCode(): Promise<{ device_code: string; user_code: string; verification_uri: string; expires_in: number; interval: number; }> {
	try {
		const resp = await axios.post(
			GITHUB_DEVICE_CODE_URL,
			new URLSearchParams({
				client_id: String(GITHUB_CLIENT_ID),
				scope: 'repo read:user user:email',
			}),
			{ headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, validateStatus: () => true }
		);
		console.log('Github device code raw response:', resp.status, resp.data);
		if (resp.status !== 200) {
			throw new Error('Non-200 response from Github device code endpoint');
		}
		// Parse URL-encoded response
		const params = new URLSearchParams(resp.data);
		return {
			device_code: params.get('device_code') || '',
			user_code: params.get('user_code') || '',
			verification_uri: params.get('verification_uri') || '',
			expires_in: Number(params.get('expires_in') || 0),
			interval: Number(params.get('interval') || 5),
		};
	} catch (err: any) {
		if (err.response) {
			console.error('Github device code error:', err.response.status, err.response.data);
		} else {
			console.error('Github device code error:', err.message);
		}
		throw err;
	}
}

export async function pollForToken(device_code: string, interval: number): Promise<GithubAuth> {
	const spinner = ora('Waiting for Github authorization...').start();
	while (true) {
		await new Promise(res => setTimeout(res, interval * 1000));
		try {
			const resp = await axios.post(
				GITHUB_TOKEN_URL,
				new URLSearchParams({
					client_id: String(GITHUB_CLIENT_ID),
					device_code: String(device_code),
					grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
					client_secret: String(GITHUB_CLIENT_SECRET),
				}),
				{ headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' } }
			);
			if (resp.data.access_token) {
				spinner.succeed('Github authorization successful!');
				return resp.data;
			}
			if (resp.data.error !== 'authorization_pending') {
				spinner.fail('Authorization failed: ' + resp.data.error);
				throw new Error(resp.data.error);
			}
		} catch (err: any) {
			spinner.fail('Error during token polling: ' + err.message);
			throw err;
		}
	}
}


async function checkRateLimit(token: string): Promise<void> {
	if (currentRateLimit.remaining < 10) {
		const waitTime = Math.max(0, currentRateLimit.reset - Date.now());
		if (waitTime > 0) {
			console.log(`Rate limit approached. Waiting ${Math.ceil(waitTime / 1000)}s...`);
			await new Promise(res => setTimeout(res, waitTime + 1000));
		}
	}
}

export async function githubRequest<T>(url: string, token: string, params: any = {}): Promise<T> {
	await checkRateLimit(token);
	const resp = await axios.get(url, {
		headers: { Authorization: `Bearer ${token}`, 'Accept': 'application/vnd.github+json' },
		params,
	});
	
	// Update rate limit info
	if (resp.headers['x-ratelimit-remaining']) {
		currentRateLimit = {
			limit: Number(resp.headers['x-ratelimit-limit']),
			remaining: Number(resp.headers['x-ratelimit-remaining']),
			reset: Number(resp.headers['x-ratelimit-reset']) * 1000,
		};
	}
	
	return resp.data;
}

// Fetch authenticated user profile
export async function getAuthenticatedUser(token: string) {
	return githubRequest(GITHUB_API + '/user', token);
}

// Fetch all repos for the authenticated user (owned and contributed)
export async function getUserRepos(token: string, per_page = 100) {
	// This fetches all repos the user has access to (owned, member, etc.)
	let page = 1;
	let repos: any[] = [];
	while (true) {
		const batch = await githubRequest<any[]>(GITHUB_API + '/user/repos', token, { per_page, page });
		repos = repos.concat(batch);
		if (batch.length < per_page) break;
		page++;
	}
	return repos;
}

// Fetch languages for a repo
export async function getRepoLanguages(token: string, owner: string, repo: string) {
	return githubRequest(GITHUB_API + `/repos/${owner}/${repo}/languages`, token);
}

// Deep analysis: Get user's commits in a repo
export async function getUserCommits(token: string, owner: string, repo: string, username: string, per_page = 100) {
	let page = 1;
	let commits: any[] = [];
	try {
		while (page <= 3) { // Limit to 3 pages to avoid excessive API calls
			const batch = await githubRequest<any[]>(
				GITHUB_API + `/repos/${owner}/${repo}/commits`,
				token,
				{ author: username, per_page, page }
			);
			commits = commits.concat(batch);
			if (batch.length < per_page) break;
			page++;
		}
	} catch (err) {
		console.warn(`Could not fetch commits for ${owner}/${repo}`);
	}
	return commits;
}

// Get commit details including files changed
export async function getCommitDetails(token: string, owner: string, repo: string, sha: string) {
	try {
		return await githubRequest(GITHUB_API + `/repos/${owner}/${repo}/commits/${sha}`, token);
	} catch (err) {
		return null;
	}
}

// Get user's pull requests
export async function getUserPullRequests(token: string, owner: string, repo: string, username: string) {
	try {
		const prs = await githubRequest<any[]>(
			GITHUB_API + `/repos/${owner}/${repo}/pulls`,
			token,
			{ state: 'all', per_page: 50 }
		);
		return prs.filter(pr => pr.user.login === username);
	} catch (err) {
		return [];
	}
}

// Get repository topics
export async function getRepoTopics(token: string, owner: string, repo: string) {
	try {
		const data = await githubRequest<any>(
			GITHUB_API + `/repos/${owner}/${repo}/topics`,
			token
		);
		return data.names || [];
	} catch (err) {
		return [];
	}
}

// Get user's contributions to a repo
export async function getUserContributions(token: string, owner: string, repo: string, username: string) {
	try {
		const contributors = await githubRequest<any[]>(
			GITHUB_API + `/repos/${owner}/${repo}/contributors`,
			token
		);
		const userContrib = contributors.find(c => c.login === username);
		return userContrib?.contributions || 0;
	} catch (err) {
		return 0;
	}
}
