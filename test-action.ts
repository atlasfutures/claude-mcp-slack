#!/usr/bin/env bun
/**
 * Simple test script to validate the action setup
 */

import { join } from "path";

// Mock @actions/core for testing
const mockCore = {
  info: (message: string) => console.log(`INFO: ${message}`),
  debug: (message: string) => console.log(`DEBUG: ${message}`),
  warning: (message: string) => console.log(`WARNING: ${message}`),
  setFailed: (message: string) => {
    console.error(`FAILED: ${message}`);
    process.exit(1);
  },
  setOutput: (name: string, value: string) => {
    console.log(`OUTPUT ${name}: ${value}`);
  },
};

// Set up test environment
process.env.SLACK_TOKEN = "xoxb-test-token-1234567890123456789012345678901234567890";
process.env.GITHUB_ACTION_PATH = "/Users/chilang/code/claude-mcp-slack";
process.env.DOWNLOAD_DIRECTORY = "./test-downloads";

// Test token validation
function validateSlackToken(token: string): void {
  if (!token) {
    throw new Error("SLACK_TOKEN is required");
  }
  
  if (token.length < 50) {
    throw new Error("Slack token appears to be too short to be valid");
  }
  
  if (!token.startsWith("xoxb-") && !token.startsWith("xoxp-")) {
    mockCore.warning("Slack token does not appear to be in the expected format (should start with xoxb- or xoxp-)");
  }
}

// Test directory validation
function validateDownloadDirectory(dir: string): string {
  if (!dir) {
    return process.env.GITHUB_WORKSPACE || ".";
  }
  
  if (!dir.startsWith("/")) {
    const workspace = process.env.GITHUB_WORKSPACE || process.cwd();
    return join(workspace, dir);
  }
  
  return dir;
}

// Test MCP config creation
function createMcpConfig(actionPath: string, downloadDir: string) {
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

async function main() {
  try {
    mockCore.info("🚀 Testing Claude MCP Slack setup...");
    
    // Get inputs
    const slackToken = process.env.SLACK_TOKEN!;
    const downloadDirectory = process.env.DOWNLOAD_DIRECTORY!;
    const actionPath = process.env.GITHUB_ACTION_PATH!;
    
    // Validate
    mockCore.info("🔍 Validating Slack token...");
    validateSlackToken(slackToken);
    
    mockCore.info("📁 Validating download directory...");
    const validatedDownloadDir = validateDownloadDirectory(downloadDirectory);
    
    // Create config
    mockCore.info("⚙️ Generating MCP configuration...");
    const mcpConfig = createMcpConfig(actionPath, validatedDownloadDir);
    
    // Output
    const mcpConfigJson = JSON.stringify(mcpConfig, null, 2);
    mockCore.setOutput("mcp_config", mcpConfigJson);
    mockCore.setOutput("server_executable", join(actionPath, "src", "slack-server.ts"));
    
    mockCore.info("✅ Test completed successfully!");
    mockCore.info(`📁 Download directory: ${validatedDownloadDir}`);
    
    console.log("\n🔧 Generated MCP Configuration:");
    console.log(JSON.stringify(mcpConfig, null, 2));
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    mockCore.setFailed(`Test failed: ${errorMessage}`);
  }
}

main();