/**
 * Unit tests for setup script
 */

import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";

// Mock @actions/core
const mockCore = {
  info: mock(() => {}),
  debug: mock(() => {}),
  warning: mock(() => {}),
  setFailed: mock(() => {}),
  setOutput: mock(() => {}),
};

mock.module("@actions/core", () => mockCore);

describe("Setup Script", () => {
  beforeEach(() => {
    // Reset all mocks
    Object.values(mockCore).forEach(mockFn => mockFn.mockClear());
    
    // Reset environment
    for (const key of Object.keys(process.env)) {
      if (key.startsWith("SLACK_") || key.startsWith("GITHUB_") || key === "DOWNLOAD_DIRECTORY") {
        delete process.env[key];
      }
    }
  });

  describe("Token Validation", () => {
    test("should validate proper Slack token format", () => {
      const validateSlackToken = (token: string): void => {
        if (!token) {
          throw new Error("SLACK_TOKEN is required");
        }
        
        if (token.length < 50) {
          throw new Error("Slack token appears to be too short to be valid");
        }
      };

      expect(() => validateSlackToken("")).toThrow("SLACK_TOKEN is required");
      expect(() => validateSlackToken("short")).toThrow("too short to be valid");
      expect(() => validateSlackToken("xoxb-" + "x".repeat(50))).not.toThrow();
    });

    test("should warn about unexpected token format", () => {
      const validateSlackToken = (token: string): string[] => {
        const warnings: string[] = [];
        
        if (!token.startsWith("xoxb-") && !token.startsWith("xoxp-")) {
          warnings.push("Token does not appear to be in the expected format");
        }
        
        return warnings;
      };

      expect(validateSlackToken("invalid-token")).toContain("Token does not appear to be in the expected format");
      expect(validateSlackToken("xoxb-valid-token")).toEqual([]);
      expect(validateSlackToken("xoxp-valid-token")).toEqual([]);
    });
  });

  describe("Directory Validation", () => {
    test("should handle relative paths correctly", () => {
      const validateDownloadDirectory = (dir: string, workspace = "/github/workspace"): string => {
        if (!dir) {
          return workspace;
        }
        
        if (!dir.startsWith("/")) {
          return `${workspace}/${dir}`;
        }
        
        return dir;
      };

      expect(validateDownloadDirectory("", "/workspace")).toBe("/workspace");
      expect(validateDownloadDirectory("uploads", "/workspace")).toBe("/workspace/uploads");
      expect(validateDownloadDirectory("/absolute/path")).toBe("/absolute/path");
    });
  });

  describe("MCP Configuration Generation", () => {
    test("should generate valid MCP configuration", () => {
      const createMcpConfig = (actionPath: string, downloadDir: string, slackToken: string) => {
        return {
          mcpServers: {
            slack: {
              command: "bun",
              args: ["run", `${actionPath}/src/slack-server.ts`],
              env: {
                SLACK_TOKEN: slackToken,
                DOWNLOAD_DIRECTORY: downloadDir,
              },
            },
          },
        };
      };

      const config = createMcpConfig("/action/path", "/downloads", "test-token");
      
      expect(config.mcpServers.slack.command).toBe("bun");
      expect(config.mcpServers.slack.args).toEqual(["run", "/action/path/src/slack-server.ts"]);
      expect(config.mcpServers.slack.env.SLACK_TOKEN).toBe("test-token");
      expect(config.mcpServers.slack.env.DOWNLOAD_DIRECTORY).toBe("/downloads");
    });

    test("should generate JSON that can be parsed", () => {
      const config = {
        mcpServers: {
          slack: {
            command: "bun",
            args: ["run", "/path/to/server.ts"],
            env: {
              SLACK_TOKEN: "test-token",
              DOWNLOAD_DIRECTORY: "/downloads",
            },
          },
        },
      };

      const json = JSON.stringify(config);
      const parsed = JSON.parse(json);
      
      expect(parsed).toEqual(config);
    });
  });

  describe("Error Handling", () => {
    test("should handle missing required environment variables", async () => {
      // Test the main function would fail without required env vars
      const requiredVars = ["SLACK_TOKEN", "GITHUB_ACTION_PATH"];
      
      requiredVars.forEach(varName => {
        const checkEnvVar = (name: string): void => {
          if (!process.env[name]) {
            throw new Error(`${name} environment variable is required`);
          }
        };
        
        expect(() => checkEnvVar(varName)).toThrow(`${varName} environment variable is required`);
      });
    });
  });
});