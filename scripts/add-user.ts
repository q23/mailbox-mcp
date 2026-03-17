#!/usr/bin/env node

import { readFileSync, writeFileSync } from "fs";
import { createInterface } from "readline";

interface UserConfig {
  api_key: string;
  name: string;
  imap_user: string;
  imap_pass: string;
}

interface UsersFile {
  users: UserConfig[];
}

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

function generateApiKey(name: string): string {
  const sanitized = name.toLowerCase().replace(/[^a-z0-9]/g, "").substring(0, 4);
  const random = Math.random().toString(36).substring(2, 10);
  return `imap-${sanitized}-${random}`;
}

async function main() {
  console.log("Add new user to IMAP MCP Server\n");

  const name = await question("User name: ");
  if (!name.trim()) {
    console.error("Error: Name is required");
    process.exit(1);
  }

  const imapUser = await question("IMAP email (e.g., user@q23.de): ");
  if (!imapUser.trim()) {
    console.error("Error: IMAP email is required");
    process.exit(1);
  }

  const imapPass = await question("IMAP password (app password): ");
  if (!imapPass.trim()) {
    console.error("Error: IMAP password is required");
    process.exit(1);
  }

  const apiKey = generateApiKey(name);

  // Load existing users
  let usersData: UsersFile;
  try {
    const content = readFileSync("users.json", "utf-8");
    usersData = JSON.parse(content);
  } catch (error) {
    console.warn("users.json not found, creating new file");
    usersData = { users: [] };
  }

  // Check if user already exists
  if (usersData.users.some((u) => u.imap_user === imapUser)) {
    console.error(`Error: User with email ${imapUser} already exists`);
    process.exit(1);
  }

  // Add new user
  const newUser: UserConfig = {
    api_key: apiKey,
    name: name.trim(),
    imap_user: imapUser.trim(),
    imap_pass: imapPass.trim(),
  };

  usersData.users.push(newUser);

  // Write back to file
  try {
    writeFileSync("users.json", JSON.stringify(usersData, null, 2));
    console.log("\nUser added successfully!");
    console.log(`\nUser Details:`);
    console.log(`  Name: ${newUser.name}`);
    console.log(`  IMAP Email: ${newUser.imap_user}`);
    console.log(`  API Key: ${newUser.api_key}`);
    console.log(
      `\nTo use this user, include the header: Authorization: Bearer ${newUser.api_key}`
    );
  } catch (error) {
    console.error("Error writing users.json:", error);
    process.exit(1);
  }

  rl.close();
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
