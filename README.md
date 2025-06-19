# Claude MCP Slack

A standalone GitHub Action that provides Slack MCP (Model Context Protocol) server functionality for Claude Code Action, enabling secure Slack image downloads and integrations.

## Features

- 🔐 **Secure Slack Integration**: Authenticated access to Slack files using Bot User OAuth tokens
- 📁 **Flexible File Management**: Customizable download directories with security validation
- 🐳 **Docker Support**: Run locally or in containers with proper security constraints
- 🛡️ **Security First**: Input validation, path traversal prevention, and secure token handling
- 🧪 **Comprehensive Testing**: Unit, integration, and security test suites
- ⚡ **Easy Integration**: Drop-in compatibility with claude-code-action

## Quick Start

### Basic Usage

```yaml
name: Example Workflow
on:
  issues:
    types: [opened]
  issue_comment:
    types: [created]

jobs:
  claude-response:
    runs-on: ubuntu-latest
    steps:
      - name: Setup Slack MCP
        uses: atlasfutures/claude-mcp-slack@v1
        with:
          slack_token: ${{ secrets.SLACK_TOKEN }}
        id: slack-mcp

      - name: Claude Code Action  
        uses: anthropics/claude-code-action@main
        with:
          mcp_config: ${{ steps.slack-mcp.outputs.mcp_config }}
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
```

### Advanced Configuration

```yaml
- name: Setup Slack MCP
  uses: atlasfutures/claude-mcp-slack@v1
  with:
    slack_token: ${{ secrets.SLACK_TOKEN }}
    download_directory: "./slack-assets"
  id: slack-mcp

- name: Claude Code Action with Multiple MCP Servers
  uses: anthropics/claude-code-action@main
  with:
    mcp_config: |
      {
        "mcpServers": {
          "slack": ${{ steps.slack-mcp.outputs.mcp_config }}.mcpServers.slack,
          "custom": {
            "command": "node",
            "args": ["custom-server.js"],
            "env": {
              "API_KEY": "${{ secrets.CUSTOM_API_KEY }}"
            }
          }
        }
      }
    anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
```

## Configuration

### Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `slack_token` | Slack Bot User OAuth Token (xoxb-*) | ✅ | - |
| `download_directory` | Directory for downloaded files | ❌ | `"."` |

### Outputs

| Output | Description |
|--------|-------------|
| `mcp_config` | JSON configuration for claude-code-action |
| `server_executable` | Path to the Slack MCP server |

### Environment Variables

The action sets up the following environment variables for the MCP server:

- `SLACK_TOKEN`: Your Slack Bot User OAuth Token
- `DOWNLOAD_DIRECTORY`: Resolved absolute path for downloads

## Slack Bot Setup

### 1. Create a Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Click "Create New App" → "From scratch"
3. Name your app and select your workspace

### 2. Configure Bot Token Scopes

Under **OAuth & Permissions**, add these Bot Token Scopes:

```
files:read      # Read file content and metadata
```

### 3. Install to Workspace

1. Click "Install to Workspace"
2. Copy the "Bot User OAuth Token" (starts with `xoxb-`)
3. Add it to your repository secrets as `SLACK_TOKEN`

### 4. Example Bot Usage

Once configured, Claude can download Slack images:

```
@claude Please analyze this screenshot from our Slack channel: https://files.slack.com/files-tmb/T05EFSVDCLR-F08TC9CP9B8/screenshot_720.png
```

## Available MCP Tools

### `slack_image_download`

Downloads images from Slack with authentication.

**Parameters:**
- `url` (required): Slack file URL (must start with `https://files.slack.com/`)
- `filename` (optional): Custom filename (will be sanitized)

**Example:**
```json
{
  "tool": "slack_image_download",
  "arguments": {
    "url": "https://files.slack.com/files-tmb/T05EFSVDCLR-F08TC9CP9B8/screenshot_720.png",
    "filename": "screenshot.png"
  }
}
```

### `slack_health_check`

Checks the health and configuration of the Slack MCP server.

**Example:**
```json
{
  "tool": "slack_health_check",
  "arguments": {}
}
```

## Security Features

### Input Validation
- URL validation (must be Slack files domain)
- Token format verification
- Path traversal prevention
- Filename sanitization

### Secure Execution
- Non-root container execution
- Read-only filesystem (except download directory)
- Resource limits (file size, timeout)
- No shell metacharacter injection

### Token Security
- Environment variable isolation
- No token logging or exposure
- Secure token format validation

## Development

### Local Setup

```bash
# Clone repository
git clone https://github.com/atlasfutures/claude-mcp-slack.git
cd claude-mcp-slack

# Install dependencies
bun install

# Run tests
bun test

# Type check
bun run typecheck

# Format code
bun run format
```

### Docker Development

```bash
# Build and run with docker-compose
docker-compose up claude-mcp-slack-dev

# Or build manually
docker build -t claude-mcp-slack .
docker run -e SLACK_TOKEN=your-token claude-mcp-slack
```

### Testing

```bash
# Run all tests
bun test

# Run specific test suites
bun run test:unit
bun run test:integration
bun run test:security

# Run with coverage
bun test --coverage
```

## Troubleshooting

### Common Issues

**"SLACK_TOKEN environment variable is required"**
- Ensure your Slack token is properly set in repository secrets
- Verify the token starts with `xoxb-` or `xoxp-`

**"URL must be a Slack file URL"**
- Only URLs starting with `https://files.slack.com/` are supported
- Ensure the URL is from a Slack file, not a regular message

**"Permission denied" errors**
- Check that your Slack bot has `files:read` scope
- Verify the bot is installed in the workspace where the file is located

**Download failures**
- Ensure the file hasn't been deleted from Slack
- Check that the file is accessible to your bot
- Verify network connectivity and firewall settings

### Debug Mode

Enable debug logging by setting `ACTIONS_STEP_DEBUG=true` in your repository secrets.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass (`bun test`)
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Add tests for all new features
- Update documentation for API changes
- Ensure security tests pass
- Use conventional commit messages

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- 📖 [Documentation](https://github.com/atlasfutures/claude-mcp-slack/wiki)
- 🐛 [Bug Reports](https://github.com/atlasfutures/claude-mcp-slack/issues)
- 💬 [Discussions](https://github.com/atlasfutures/claude-mcp-slack/discussions)

## Related Projects

- [claude-code-action](https://github.com/anthropics/claude-code-action) - Official Claude GitHub Action
- [MCP SDK](https://github.com/modelcontextprotocol/sdk) - Model Context Protocol SDK