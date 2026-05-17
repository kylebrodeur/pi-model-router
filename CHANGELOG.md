# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-05-17

### Added
- Transparent wait and retry interception for string-based rate limit errors
- Ollama auto-sync feature
- Rate-limit fallback with transparent HTTP error handling
- Feature toggles in config (`features` object)
- Scope shim for syncing router profiles to Pi enabled models
- Progressive enhancement (auto-detect qmd-ledger and agent-bus)

### Changed
- **BREAKING:** Migrate from `@mariozechner/pi-coding-agent` to `@earendil-works/pi-coding-agent` v0.75.0
- Update `detectPlugins` to use `pi.getAllTools()` for Pi v0.74.1+ compatibility
- Updated minimum Pi SDK version to `>=0.75.0`
- Replaced `@sinclair/typebox` peer dependency with `typebox`

## [0.1.4] - 2026-04-27

### Added
- Wait/retry interception for string-based rate limit errors

## [0.1.3] - 2026-04-24

## [0.1.2] - 2026-04-23

### Fixed
- Config merge bug where features/ollamaSync/rateLimitFallback were dropped

## [0.1.1] - 2025-04-22

### Fixed
- Config merge bug where `features`, `ollamaSync`, and `rateLimitFallback` were dropped during global/project merge

## [0.1.0] - 2025-04-21

### Added
- Initial fork from `yeliu84/pi-model-router`
- Feature toggles system
- Ollama sync module
- Rate-limit fallback module
- Scope shim module
- Progressive enhancement with plugin detection

[Unreleased]: https://github.com/kylebrodeur/pi-model-router/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/kylebrodeur/pi-model-router/compare/v0.1.4...v0.2.0
[0.1.4]: https://github.com/kylebrodeur/pi-model-router/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/kylebrodeur/pi-model-router/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/kylebrodeur/pi-model-router/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/kylebrodeur/pi-model-router/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/kylebrodeur/pi-model-router/releases/tag/v0.1.0
