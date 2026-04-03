#!/usr/bin/env bun

/**
 * CLI tool to encrypt IMAP credentials for use with the MCP server.
 *
 * Usage:
 *   # Encrypt credentials
 *   bun run scripts/encrypt-credentials.ts --user <email> --pass <password> --key <encryption-key>
 *
 *   # Generate a new encryption key
 *   bun run scripts/encrypt-credentials.ts --generate-key
 */

import { encrypt } from '../src/crypto';
import { randomBytes } from 'crypto';

function printUsage(): void {
  console.log(`
Usage: bun run scripts/encrypt-credentials.ts [OPTIONS]

OPTIONS:
  --user <email>              IMAP email address
  --pass <password>           IMAP password or app-specific password
  --key <encryption-key>      AES-256 encryption key (256-bit hex string)
  --generate-key              Generate and display a new encryption key
  --help, -h                  Show this help message

EXAMPLES:

  # Encrypt credentials with a known key
  bun run scripts/encrypt-credentials.ts \\
    --user user@example.com \\
    --pass MyPassword123 \\
    --key a1b2c3d4e5f6...

  # Generate a new encryption key
  bun run scripts/encrypt-credentials.ts --generate-key

SECURITY:
  - The generated encrypted token grants access to your email account
  - Store it securely (e.g., in your MCP config, not in public repositories)
  - You can safely reuse the same encrypted token for multiple requests
  - The ENCRYPTION_KEY should be set as an environment variable on the server
`);
}

function parseArgs(): Record<string, string> {
  const args: Record<string, string> = {};
  const processArgs = process.argv.slice(2);

  for (let i = 0; i < processArgs.length; i++) {
    const arg = processArgs[i];

    if (arg === '--help' || arg === '-h') {
      args.help = 'true';
    } else if (arg === '--generate-key') {
      args['generate-key'] = 'true';
    } else if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const value = processArgs[i + 1];
      if (!value || value.startsWith('--')) {
        console.error(`Error: Option ${arg} requires a value`);
        process.exit(1);
      }
      args[key] = value;
      i++;
    }
  }

  return args;
}

async function main(): Promise<void> {
  const args = parseArgs();

  if (args.help) {
    printUsage();
    process.exit(0);
  }

  if (args['generate-key']) {
    const newKey = randomBytes(32).toString('hex');
    console.log('\n✓ Generated new encryption key:\n');
    console.log(newKey);
    console.log('\nSet this as ENCRYPTION_KEY in your .env file or environment variables.\n');
    process.exit(0);
  }

  const user = args.user;
  const pass = args.pass;
  const key = args.key;

  if (!user || !pass || !key) {
    console.error('Error: Missing required options (--user, --pass, --key)');
    console.error('Use --help for usage information');
    process.exit(1);
  }

  // Validate key format (should be 64 hex characters = 256 bits)
  if (!/^[0-9a-f]{64}$/i.test(key)) {
    console.error('Error: Invalid encryption key format');
    console.error('Key must be a 256-bit hex string (64 hexadecimal characters)');
    console.error('Generate one with: bun run scripts/encrypt-credentials.ts --generate-key');
    process.exit(1);
  }

  try {
    const credentials = JSON.stringify({ user, pass });
    const encrypted = encrypt(credentials, key);

    console.log('\n✓ Credentials encrypted successfully!\n');
    console.log('Encrypted token:');
    console.log(encrypted);
    console.log('\nHow to use:');
    console.log('1. Copy the encrypted token above');
    console.log('2. Use it as the "credentials" parameter in any IMAP tool call');
    console.log('3. Example:');
    console.log('   {');
    console.log('     "credentials": "' + encrypted.slice(0, 40) + '...",');
    console.log('     "folder": "INBOX"');
    console.log('   }');
    console.log('\n');
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`Error: Failed to encrypt credentials: ${msg}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
