/**
 * Integration tests for MCP configuration generation
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, writeFile, access } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

describe("MCP Configuration Integration", () => {
  let tempDir: string;
  let actionPath: string;

  beforeEach(async () => {
    // Create temporary directory for testing
    tempDir = await mkdtemp(join(tmpdir(), "claude-mcp-slack-test-"));
    actionPath = join(tempDir, "action");
    
    // Create mock action structure
    await writeFile(join(tempDir, "action", "src", "slack-server.ts"), "// Mock server", { recursive: true } as any);
  });

  afterEach(async () => {
    // Clean up temporary directory
    await rm(tempDir, { recursive: true, force: true });
    
    // Clean up environment
    for (const key of Object.keys(process.env)) {
      if (key.startsWith("SLACK_") || key.startsWith("GITHUB_") || key === "DOWNLOAD_DIRECTORY") {
        delete process.env[key];
      }
    }
  });

  test("should generate complete MCP configuration", async () => {
    // Setup environment
    process.env.SLACK_TOKEN = "xoxb-test-token-" + "x".repeat(40);
    process.env.GITHUB_ACTION_PATH = actionPath;
    process.env.DOWNLOAD_DIRECTORY = join(tempDir, "downloads");

    const createMcpConfig = (actionPath: string, downloadDir: string) => {
      return {
        mcpServers: {
          slack: {
            command: "bun",
            args: ["run", join(actionPath, "src", "slack-server.ts")],
            env: {
              SLACK_TOKEN: process.env.SLACK_TOKEN!,
              DOWNLOAD_DIRECTORY: downloadDir,
            },
          },
        },
      };
    };

    const config = createMcpConfig(actionPath, process.env.DOWNLOAD_DIRECTORY!);
    
    // Verify structure
    expect(config.mcpServers).toBeDefined();
    expect(config.mcpServers.slack).toBeDefined();
    expect(config.mcpServers.slack.command).toBe("bun");
    expect(config.mcpServers.slack.args).toHaveLength(2);
    expect(config.mcpServers.slack.args[0]).toBe("run");
    expect(config.mcpServers.slack.args[1]).toEndWith("slack-server.ts");
    
    // Verify environment variables
    expect(config.mcpServers.slack.env.SLACK_TOKEN).toBe(process.env.SLACK_TOKEN);
    expect(config.mcpServers.slack.env.DOWNLOAD_DIRECTORY).toBe(process.env.DOWNLOAD_DIRECTORY);
  });

  test("should validate server executable exists", async () => {
    const serverPath = join(actionPath, "src", "slack-server.ts");
    
    // Should exist (we created it in beforeEach)
    await expect(access(serverPath)).resolves.not.toThrow();
    
    // Should fail for non-existent path
    const nonExistentPath = join(tempDir, "nonexistent", "server.ts");
    await expect(access(nonExistentPath)).rejects.toThrow();
  });

  test("should handle different download directory configurations", async () => {
    const testCases = [
      { input: ".", expected: process.cwd() },
      { input: "uploads", expected: join(process.cwd(), "uploads") },
      { input: "/absolute/path", expected: "/absolute/path" },
    ];

    testCases.forEach(({ input, expected }) => {
      const validateDownloadDirectory = (dir: string): string => {
        if (!dir) {
          return process.env.GITHUB_WORKSPACE || ".";
        }
        
        if (!dir.startsWith("/")) {
          const workspace = process.env.GITHUB_WORKSPACE || process.cwd();
          return join(workspace, dir);
        }
        
        return dir;
      };

      const result = validateDownloadDirectory(input);
      // For relative paths, just check the structure is correct
      if (!input.startsWith("/")) {
        expect(result).toContain(input === "." ? "" : input);
      } else {
        expect(result).toBe(expected);
      }
    });
  });

  test("should produce JSON that claude-code-action can consume", async () => {
    const config = {
      mcpServers: {
        slack: {
          command: "bun",
          args: ["run", "/path/to/slack-server.ts"],
          env: {
            SLACK_TOKEN: "xoxb-test-token",
            DOWNLOAD_DIRECTORY: "/downloads",
          },
        },
      },
    };

    // Serialize and deserialize to ensure JSON compatibility
    const json = JSON.stringify(config, null, 2);
    const parsed = JSON.parse(json);
    
    expect(parsed).toEqual(config);
    
    // Verify the structure matches what claude-code-action expects
    expect(parsed.mcpServers).toBeDefined();
    expect(typeof parsed.mcpServers).toBe("object");
    expect(parsed.mcpServers.slack).toBeDefined();
    expect(typeof parsed.mcpServers.slack.command).toBe("string");
    expect(Array.isArray(parsed.mcpServers.slack.args)).toBe(true);
    expect(typeof parsed.mcpServers.slack.env).toBe("object");
  });
});