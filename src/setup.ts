#!/usr/bin/env bun
/**
 * Setup script for Claude MCP Slack
 * 
 * Validates inputs and generates MCP configuration for use with claude-code-action
 */

import * as core from "@actions/core";
import { resolve, join } from "path";
import { access } from "fs/promises";

interface McpServerConfig {
  command: string;
  args: string[];
  env: Record<string, string>;
}

interface McpConfig {
  mcpServers: {
    slack: McpServerConfig;
  };
}

/**
 * Validates that the Slack token is properly formatted
 */
function validateSlackToken(token: string): void {
  if (!token) {
    throw new Error("SLACK_TOKEN is required");
  }
  
  // Basic validation for Slack token format
  if (!token.startsWith("xoxb-") && !token.startsWith("xoxp-")) {
    core.warning("Slack token does not appear to be in the expected format (should start with xoxb- or xoxp-)");
  }
  
  if (token.length < 50) {
    throw new Error("Slack token appears to be too short to be valid");
  }
}

/**
 * Validates and normalizes the download directory
 */
function validateDownloadDirectory(dir: string): string {
  if (!dir) {
    return process.env.GITHUB_WORKSPACE || ".";
  }
  
  // If it's a relative path, resolve it relative to the workspace
  if (!dir.startsWith("/")) {
    const workspace = process.env.GITHUB_WORKSPACE || process.cwd();
    return resolve(workspace, dir);
  }
  
  return resolve(dir);
}

/**
 * Creates the MCP configuration for the Slack server
 */
function createMcpConfig(actionPath: string, downloadDir: string): McpConfig {
  const serverPath = join(actionPath, "src", "slack-server.ts");
  
  return {
    mcpServers: {
      slack: {
        command: "bun",
        args: ["run", serverPath],
        env: {
          SLACK_TOKEN: process.env.SLACK_TOKEN!,
          DOWNLOAD_DIRECTORY: downloadDir,
        },
      },
    },
  };
}

/**
 * Validates that the server executable exists
 */
async function validateServerExecutable(actionPath: string): Promise<void> {
  const serverPath = join(actionPath, "src", "slack-server.ts");
  
  try {
    await access(serverPath);
  } catch {
    throw new Error(`Slack server executable not found at: ${serverPath}`);
  }
}

async function main(): Promise<void> {
  try {
    core.info("🚀 Setting up Claude MCP Slack server...");
    
    // Get and validate inputs
    const slackToken = process.env.SLACK_TOKEN;
    const downloadDirectory = process.env.DOWNLOAD_DIRECTORY || ".";
    const actionPath = process.env.GITHUB_ACTION_PATH;
    
    if (!actionPath) {
      throw new Error("GITHUB_ACTION_PATH environment variable is required");
    }
    
    // Validate inputs
    core.info("🔍 Validating Slack token...");
    validateSlackToken(slackToken!);
    
    core.info("📁 Validating download directory...");
    const validatedDownloadDir = validateDownloadDirectory(downloadDirectory);
    
    core.info("🔧 Validating server executable...");
    await validateServerExecutable(actionPath);
    
    // Create MCP configuration
    core.info("⚙️ Generating MCP configuration...");
    const mcpConfig = createMcpConfig(actionPath, validatedDownloadDir);
    
    // Output the configuration
    const mcpConfigJson = JSON.stringify(mcpConfig, null, 2);
    core.setOutput("mcp_config", mcpConfigJson);
    core.setOutput("server_executable", join(actionPath, "src", "slack-server.ts"));
    
    // Log success (without sensitive data)
    core.info("✅ Slack MCP server configured successfully");
    core.info(`📁 Download directory: ${validatedDownloadDir}`);
    core.info("🔧 MCP configuration generated");
    
    // Debug output (masked)
    core.debug("Generated MCP config structure:");
    core.debug(JSON.stringify({
      mcpServers: {
        slack: {
          command: mcpConfig.mcpServers.slack.command,
          args: mcpConfig.mcpServers.slack.args,
          env: {
            ...mcpConfig.mcpServers.slack.env,
            SLACK_TOKEN: "***MASKED***"
          }
        }
      }
    }, null, 2));
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    core.setFailed(`Failed to setup Slack MCP server: ${errorMessage}`);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (import.meta.main) {
  main();
}