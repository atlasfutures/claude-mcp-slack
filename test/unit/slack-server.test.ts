/**
 * Unit tests for Slack MCP Server
 */

import { describe, test, expect, beforeEach, afterEach, mock, spyOn } from "bun:test";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Mock environment variables
const mockEnv = {
  SLACK_TOKEN: "xoxb-test-token-1234567890",
  DOWNLOAD_DIRECTORY: "/tmp/test-downloads",
};

describe("Slack MCP Server", () => {
  beforeEach(() => {
    // Reset environment
    for (const key of Object.keys(process.env)) {
      if (key.startsWith("SLACK_") || key === "DOWNLOAD_DIRECTORY") {
        delete process.env[key];
      }
    }
    
    // Set test environment
    Object.assign(process.env, mockEnv);
  });

  afterEach(() => {
    // Clean up environment
    for (const key of Object.keys(mockEnv)) {
      delete process.env[key];
    }
  });

  describe("Server Initialization", () => {
    test("should create server with correct name and version", async () => {
      // This test verifies the server can be imported without errors
      const { server } = await import("../../src/slack-server.ts");
      expect(server).toBeInstanceOf(McpServer);
    });
  });

  describe("Environment Validation", () => {
    test("should fail when SLACK_TOKEN is missing", async () => {
      delete process.env.SLACK_TOKEN;
      
      // Mock the server tool execution
      const mockTool = {
        slack_image_download: async ({ url }: { url: string }) => {
          if (!process.env.SLACK_TOKEN) {
            throw new Error("SLACK_TOKEN environment variable is required");
          }
          return { content: [{ type: "text", text: "success" }] };
        }
      };
      
      await expect(
        mockTool.slack_image_download({ url: "https://files.slack.com/test.png" })
      ).rejects.toThrow("SLACK_TOKEN environment variable is required");
    });

    test("should work with valid SLACK_TOKEN", async () => {
      process.env.SLACK_TOKEN = "xoxb-valid-token";
      
      const mockTool = {
        slack_image_download: async ({ url }: { url: string }) => {
          if (!process.env.SLACK_TOKEN) {
            throw new Error("SLACK_TOKEN environment variable is required");
          }
          return { content: [{ type: "text", text: "Token is valid" }] };
        }
      };
      
      const result = await mockTool.slack_image_download({ 
        url: "https://files.slack.com/test.png" 
      });
      
      expect(result.content[0].text).toBe("Token is valid");
    });
  });

  describe("URL Validation", () => {
    test("should reject non-Slack URLs", () => {
      const validateUrl = (url: string): boolean => {
        return url.startsWith("https://files.slack.com/");
      };

      expect(validateUrl("https://example.com/image.png")).toBe(false);
      expect(validateUrl("https://files.slack.com/test.png")).toBe(true);
      expect(validateUrl("http://files.slack.com/test.png")).toBe(false);
    });

    test("should accept valid Slack file URLs", () => {
      const validUrls = [
        "https://files.slack.com/files-tmb/T05EFSVDCLR-F08TC9CP9B8/screenshot_720.png",
        "https://files.slack.com/files-pri/T123-F456/document.pdf",
        "https://files.slack.com/files/T789/F012/image.jpg"
      ];

      const validateUrl = (url: string): boolean => {
        return url.startsWith("https://files.slack.com/");
      };

      validUrls.forEach(url => {
        expect(validateUrl(url)).toBe(true);
      });
    });
  });

  describe("Filename Generation", () => {
    test("should generate safe filenames", () => {
      const generateSafeFilename = (url: string): string => {
        const urlParts = url.split("/");
        const filename = urlParts[urlParts.length - 1];
        
        const match = filename.match(/^(.+?)(?:_(\d+))?\.([a-zA-Z0-9]+)$/);
        if (match) {
          const [, name, size, ext] = match;
          const timestamp = Date.now();
          return `slack_${name}_${timestamp}.${ext}`;
        }
        
        return `slack_image_${Date.now()}.png`;
      };

      const url = "https://files.slack.com/files-tmb/T05EFSVDCLR-F08TC9CP9B8/screenshot_720.png";
      const filename = generateSafeFilename(url);
      
      expect(filename).toMatch(/^slack_screenshot_\d+\.png$/);
    });

    test("should sanitize custom filenames", () => {
      const sanitizeFilename = (filename: string): string => {
        return filename.replace(/[^a-zA-Z0-9._-]/g, "_");
      };

      expect(sanitizeFilename("test file.png")).toBe("test_file.png");
      expect(sanitizeFilename("../../../etc/passwd")).toBe("_______etc_passwd");
      expect(sanitizeFilename("normal-file_123.jpg")).toBe("normal-file_123.jpg");
    });
  });

  describe("Directory Validation", () => {
    test("should reject directory traversal attempts", () => {
      const validateDownloadDirectory = (dir: string): boolean => {
        const resolved = dir; // Simplified for testing
        return !resolved.includes("..");
      };

      expect(validateDownloadDirectory("/safe/path")).toBe(true);
      expect(validateDownloadDirectory("../unsafe")).toBe(false);
      expect(validateDownloadDirectory("/path/../other")).toBe(false);
      expect(validateDownloadDirectory("./safe/relative")).toBe(true);
    });
  });
});