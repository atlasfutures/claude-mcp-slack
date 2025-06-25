#!/usr/bin/env node
// Slack MCP Server
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFile } from "fs/promises";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const server = new McpServer({
  name: "Slack Server",
  version: "0.0.1",
});

// Slack image download tool
server.tool(
  "slack_image_download",
  "Download Slack images using authenticated curl command with SLACK_BOT_TOKEN",
  {
    url: z
      .string()
      .describe(
        "Slack image URL to download (e.g., https://files.slack.com/files-tmb/T05EFSVDCLR-F08TC9CP9B8/screenshot_720.png or https://workspace.slack.com/files/U123/F456/image.png)",
      ),
  },
  async ({ url }) => {
    try {
      const slackToken = process.env.SLACK_BOT_TOKEN || process.env.SLACK_TOKEN;
      if (!slackToken) {
        throw new Error("SLACK_BOT_TOKEN or SLACK_TOKEN environment variable is required");
      }

      // Validate that it's a Slack URL (supports both files.slack.com and workspace.slack.com formats)
      const slackUrlPattern = /^https:\/\/(?:files\.slack\.com\/files|[^.]+\.slack\.com\/files\/)/;
      if (!slackUrlPattern.test(url)) {
        throw new Error(
          "URL must be a Slack file URL (e.g., https://files.slack.com/files/... or https://workspace.slack.com/files/...)",
        );
      }

      // Extract file ID from URL
      // Pattern: https://workspace.slack.com/files/USER_ID/FILE_ID/filename
      // or https://files.slack.com/files-pri/TEAM_ID-FILE_ID/filename
      const workspacePattern = /\/files\/[^\/]+\/([^\/]+)/;
      const filesPattern = /\/files-pri\/[^-]+-([^\/]+)/;
      
      let fileIdMatch = url.match(workspacePattern);
      if (!fileIdMatch) {
        fileIdMatch = url.match(filesPattern);
      }
      
      if (!fileIdMatch) {
        throw new Error("Could not extract file ID from Slack URL");
      }
      
      const fileId = fileIdMatch[1];
      
      // Use Slack Files API to get the download URL
      const fileInfoResponse = await execAsync(
        `curl -s -H "Authorization: Bearer ${slackToken}" "https://slack.com/api/files.info?file=${fileId}"`
      );
      
      const fileInfo = JSON.parse(fileInfoResponse.stdout);
      if (!fileInfo.ok) {
        if (fileInfo.error === 'missing_scope') {
          throw new Error(`Slack bot token missing required scope: ${fileInfo.needed}. Current scopes: ${fileInfo.provided}`);
        }
        throw new Error(`Slack API error: ${fileInfo.error || 'Unknown error'}`);
      }
      
      const downloadUrl = fileInfo.file.url_private_download;
      if (!downloadUrl) {
        throw new Error("No download URL available for this file");
      }

      // Execute curl command with the proper download URL
      const curlCommand = `curl -H "Authorization: Bearer ${slackToken}" "${downloadUrl}" -o slack_image.png`;

      await execAsync(curlCommand);

      // Check if the file was downloaded successfully
      try {
        const imageStats = await readFile("slack_image.png");
        const fileSizeKB = Math.round(imageStats.length / 1024);

        return {
          content: [
            {
              type: "text",
              text: `Successfully downloaded Slack image to slack_image.png (${fileSizeKB} KB)\nFrom URL: ${url}`,
            },
          ],
        };
      } catch (readError) {
        throw new Error(
          "Image download may have failed - slack_image.png not found or empty",
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text",
            text: `Error downloading Slack image: ${errorMessage}`,
          },
        ],
        error: errorMessage,
        isError: true,
      };
    }
  },
);

async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.on("exit", () => {
    server.close();
  });
}

runServer().catch(console.error);
