#!/usr/bin/env node
/**
 * Slack MCP Server
 * 
 * Provides Slack integration capabilities for Claude Code Action including:
 * - Authenticated image downloads from Slack
 * - Secure token handling
 * - Enhanced error reporting
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFile, access, mkdir } from "fs/promises";
import { exec } from "child_process";
import { promisify } from "util";
import { join, dirname, resolve } from "path";

const execAsync = promisify(exec);

// Input validation schemas
const SlackImageUrlSchema = z
  .string()
  .url("Must be a valid URL")
  .refine(
    (url) => url.startsWith("https://files.slack.com/"),
    "URL must be a Slack file URL starting with https://files.slack.com/"
  );

const server = new McpServer({
  name: "Slack Server",
  version: "1.0.0",
});

/**
 * Validates and sanitizes the download directory path
 */
function validateDownloadDirectory(dir: string): string {
  // Resolve to absolute path and normalize
  const resolved = resolve(dir);
  
  // Basic security check - prevent directory traversal
  if (resolved.includes("..") || !resolved.startsWith(process.cwd())) {
    throw new Error("Invalid download directory: path traversal not allowed");
  }
  
  return resolved;
}

/**
 * Ensures the download directory exists
 */
async function ensureDirectoryExists(dirPath: string): Promise<void> {
  try {
    await access(dirPath);
  } catch {
    await mkdir(dirPath, { recursive: true });
  }
}

/**
 * Generates a safe filename from a Slack URL
 */
function generateSafeFilename(url: string): string {
  const urlParts = url.split("/");
  const filename = urlParts[urlParts.length - 1];
  
  // Extract file ID and extension if possible
  const match = filename.match(/^(.+?)(?:_(\d+))?\.([a-zA-Z0-9]+)$/);
  if (match) {
    const [, name, size, ext] = match;
    const timestamp = Date.now();
    return `slack_${name}_${timestamp}.${ext}`;
  }
  
  // Fallback to generic name with timestamp
  return `slack_image_${Date.now()}.png`;
}

// Slack image download tool
server.tool(
  "slack_image_download",
  "Download Slack images using authenticated curl command with SLACK_TOKEN. Supports secure file handling and custom download directories.",
  {
    url: z
      .string()
      .describe(
        "Slack image URL to download (e.g., https://files.slack.com/files-tmb/T05EFSVDCLR-F08TC9CP9B8/screenshot_720.png)"
      ),
    filename: z
      .string()
      .optional()
      .describe(
        "Optional custom filename for the downloaded image (will be sanitized for security)"
      ),
  },
  async ({ url, filename }) => {
    try {
      // Validate input
      const validatedUrl = SlackImageUrlSchema.parse(url);
      
      const slackToken = process.env.SLACK_TOKEN;
      if (!slackToken) {
        throw new Error("SLACK_TOKEN environment variable is required");
      }

      // Validate and setup download directory
      const downloadDir = validateDownloadDirectory(
        process.env.DOWNLOAD_DIRECTORY || "."
      );
      await ensureDirectoryExists(downloadDir);

      // Generate safe filename
      const safeFilename = filename 
        ? filename.replace(/[^a-zA-Z0-9._-]/g, "_")
        : generateSafeFilename(validatedUrl);
      
      const fullPath = join(downloadDir, safeFilename);

      // Execute curl command with proper escaping
      const curlCommand = [
        "curl",
        "-H", `Authorization: Bearer ${slackToken}`,
        "-L", // Follow redirects
        "-f", // Fail silently on HTTP errors
        "--max-time", "30", // 30 second timeout
        "--max-filesize", "50000000", // 50MB max file size
        `"${validatedUrl}"`,
        "-o", `"${fullPath}"`
      ].join(" ");

      const { stdout, stderr } = await execAsync(curlCommand);

      // Verify the download was successful
      try {
        const imageData = await readFile(fullPath);
        const fileSizeKB = Math.round(imageData.length / 1024);
        
        if (imageData.length === 0) {
          throw new Error("Downloaded file is empty");
        }

        return {
          content: [
            {
              type: "text",
              text: `✅ Successfully downloaded Slack image to ${fullPath} (${fileSizeKB} KB)\nFrom URL: ${validatedUrl}`,
            },
          ],
        };
      } catch (readError) {
        throw new Error(
          `Image download failed - file not found or empty: ${readError instanceof Error ? readError.message : String(readError)}`
        );
      }
    } catch (error) {
      let errorMessage: string;
      
      if (error instanceof z.ZodError) {
        errorMessage = `Invalid input: ${error.errors.map(e => e.message).join(", ")}`;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      } else {
        errorMessage = String(error);
      }

      return {
        content: [
          {
            type: "text",
            text: `❌ Error downloading Slack image: ${errorMessage}`,
          },
        ],
        error: errorMessage,
        isError: true,
      };
    }
  }
);

/**
 * Health check tool for server diagnostics
 */
server.tool(
  "slack_health_check",
  "Check the health and configuration of the Slack MCP server",
  {},
  async () => {
    try {
      const hasToken = !!process.env.SLACK_TOKEN;
      const downloadDir = process.env.DOWNLOAD_DIRECTORY || ".";
      
      let dirExists = false;
      try {
        await access(validateDownloadDirectory(downloadDir));
        dirExists = true;
      } catch {
        dirExists = false;
      }

      return {
        content: [
          {
            type: "text",
            text: `🏥 Slack MCP Server Health Check\n` +
                  `Token configured: ${hasToken ? "✅" : "❌"}\n` +
                  `Download directory: ${downloadDir}\n` +
                  `Directory accessible: ${dirExists ? "✅" : "❌"}\n` +
                  `Server version: 1.0.0`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Health check failed: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        error: String(error),
        isError: true,
      };
    }
  }
);

async function runServer() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    // Graceful shutdown handling
    const shutdown = () => {
      console.error("Shutting down Slack MCP server...");
      server.close();
      process.exit(0);
    };
    
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
    process.on("exit", () => {
      server.close();
    });
    
    console.error("Slack MCP server started successfully");
  } catch (error) {
    console.error("Failed to start Slack MCP server:", error);
    process.exit(1);
  }
}

// Only run server if this file is executed directly
if (import.meta.main) {
  runServer().catch((error) => {
    console.error("Unhandled error in Slack MCP server:", error);
    process.exit(1);
  });
}

export { server, runServer };