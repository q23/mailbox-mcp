import { readFileSync } from "fs";
import { z } from "zod";

// Zod schema for user configuration
const UserConfigSchema = z.object({
  api_key: z.string(),
  name: z.string(),
  imap_user: z.string(),
  imap_pass: z.string(),
});

const UsersFileSchema = z.object({
  users: z.array(UserConfigSchema),
});

export type UserConfig = z.infer<typeof UserConfigSchema>;

class AuthManager {
  private users: UserConfig[] = [];

  /**
   * Load users from users.json file
   */
  loadUsers(filePath: string = "users.json"): void {
    try {
      const content = readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(content);
      const validated = UsersFileSchema.parse(parsed);
      this.users = validated.users;

      if (this.users.length === 0) {
        console.warn("No users found in users.json");
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to load users.json: ${msg}`);
    }
  }

  /**
   * Get user by API key
   */
  getUserByApiKey(apiKey: string): UserConfig | null {
    return this.users.find((u) => u.api_key === apiKey) || null;
  }

  /**
   * Get all users (for admin purposes)
   */
  getAllUsers(): UserConfig[] {
    return this.users;
  }

  /**
   * Generate a random API key in the format: imap-<name>-<random>
   */
  static generateApiKey(name: string): string {
    const sanitized = name.toLowerCase().replace(/[^a-z0-9]/g, "");
    const random = Math.random().toString(36).substring(2, 10);
    return `imap-${sanitized}-${random}`;
  }
}

export const authManager = new AuthManager();
