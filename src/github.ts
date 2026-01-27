
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


export async function githubRequest<T>(url: string, token: string, params: any = {}): Promise<T> {
	const resp = await axios.get(url, {
		headers: { Authorization: `Bearer ${token}`, 'Accept': 'application/vnd.github+json' },
		params,
	});
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