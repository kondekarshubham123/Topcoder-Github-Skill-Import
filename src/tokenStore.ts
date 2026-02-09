import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import chalk from 'chalk';

const TOKEN_DIR = path.join(os.homedir(), '.topcoder-skills');
const TOKEN_FILE = path.join(TOKEN_DIR, 'github-token.json');

export interface StoredToken {
  access_token: string;
  token_type: string;
  scope: string;
  created_at: number;
  expires_at?: number;
}

/**
 * Ensure token directory exists
 */
function ensureTokenDirectory(): void {
    try {
        if (!fs.existsSync(TOKEN_DIR)) {
            console.log(chalk.gray(`   Creating directory: ${TOKEN_DIR}`));
            fs.mkdirSync(TOKEN_DIR, { mode: 0o700, recursive: true });
            console.log(chalk.gray(`   ✓ Directory created`));
        } else {
            console.log(chalk.gray(`   ✓ Directory exists`));
        }
    } catch (err) { 
        console.warn(chalk.yellow('   Warning: Failed to create token directory'), err);
        throw err;
    }

}

/**
 * Save token to disk
 */
export function saveToken(token: any): void {
    try {
        // Validate token object
        if (!token || typeof token !== 'object') {
            throw new Error('Invalid token object provided to saveToken');
        }
        
        if (!token.access_token) {
            console.error(chalk.red('   Token object missing access_token'), token);
            throw new Error('Token missing access_token field');
        }
        
        ensureTokenDirectory();
        
        const storedToken: StoredToken = {
            access_token: token.access_token,
            token_type: token.token_type || 'Bearer',
            scope: token.scope || 'repo read:user user:email',
            created_at: Date.now(),
            expires_at: token.expires_in ? Date.now() + (token.expires_in * 1000) : undefined
        };
        
        console.log(chalk.gray(`   Writing to file: ${TOKEN_FILE}`));
        fs.writeFileSync(TOKEN_FILE, JSON.stringify(storedToken, null, 2), { mode: 0o600 });
        
        // Verify file was written
        if (fs.existsSync(TOKEN_FILE)) {
            const stats = fs.statSync(TOKEN_FILE);
            console.log(chalk.gray(`   ✓ File written successfully (${stats.size} bytes)`));
        } else {
            throw new Error('Token file was not created');
        }
    } catch (err) {
        console.error(chalk.red('   Error saving token:'), err instanceof Error ? err.message : err);
        throw err;
    }
  
}

/**
 * Load token from disk
 */
export function loadToken(): StoredToken | null {
  try {
    if (!fs.existsSync(TOKEN_FILE)) {
      return null;
    }
    
    const data = fs.readFileSync(TOKEN_FILE, 'utf-8');
    const token: StoredToken = JSON.parse(data);
    
    // Check if token is expired
    if (token.expires_at && Date.now() > token.expires_at) {
      console.log(chalk.yellow('   Stored token has expired'));
      clearToken();
      return null;
    }
    
    return token;
  } catch (err) {
    console.warn(chalk.yellow('   Failed to load stored token'), err);
    return null;
  }
}

/**
 * Clear stored token
 */
export function clearToken(): void {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      fs.unlinkSync(TOKEN_FILE);
      console.log(chalk.gray('   Token cleared'));
    }
  } catch (err) {
    console.warn(chalk.yellow('   Failed to clear token'), err);
  }
}

/**
 * Check if token exists and is valid
 */
export function hasValidToken(): boolean {
  const token = loadToken();
  return token !== null;
}

