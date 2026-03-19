# Security Policy

## Supported Versions

| Version | Supported |
| --- | --- |
| `1.1.x` | Yes |
| `1.0.x` | Yes |

## Reporting a Vulnerability

Please do not report security vulnerabilities in public issues.

Preferred channels:

1. GitHub Security Advisories for this repository
2. Email to `info@q23.de` if private GitHub reporting is not available

Include as much detail as possible:

- Affected version or commit
- Reproduction steps
- Impact assessment
- Any proof-of-concept material needed to validate the issue

## Response Expectations

- Initial acknowledgement within 48 hours
- Triage and remediation planning as soon as impact is confirmed
- Public disclosure target within 90 days, coordinated with the reporter when possible

## Security Model

`mailbox-mcp` is designed around a few core constraints:

- IMAP credentials are never persisted by the server.
- The server requires a shared `ENCRYPTION_KEY` and uses AES-256-GCM for credential tokens.
- Header-based defaults (`x-imap-user` and `x-imap-pass`) are converted into the same encrypted token flow used by `imap_encrypt_credentials`.
- IMAP connections are pooled by user and expire after idle timeout.

## Scope Notes

Examples of issues that are likely security-relevant:

- Credential exposure or accidental persistence
- Weaknesses in encryption or credential parsing
- Header handling bugs that allow cross-user access
- Improper access to mailbox content across sessions

Operational deployment issues such as missing HTTPS, weak host credentials, or insecure environment handling can also create real risk even when the application code is unchanged.
