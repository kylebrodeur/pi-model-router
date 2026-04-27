# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Transparent wait and retry interception for string-based rate limit errors (e.g., "quota will reset after X seconds")
- Ollama auto-sync feature
- Rate-limit fallback with transparent HTTP error handling (402, 429, 503, 529)
- Feature toggles in config (`features` object)
- Scope shim for syncing router profiles to Pi enabled models
- Progressive enhancement (auto-detect qmd-ledger and agent-bus)
- Progressive config files (`model-router.ledger.json`, `model-router.agent-bus.json`, `model-router.essential.json`)
- GitHub issue templates and pull request template
- Code of Conduct

### Changed
- Updated minimum Pi SDK version from 0.68.0 to 0.70.2
- Merged `README_FORK.md` into canonical `README.md`
- Replaced `@sinclair/typebox` peer dependency with `typebox`

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

[Unreleased]: https://github.com/kylebrodeur/pi-model-router/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/kylebrodeur/pi-model-router/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/kylebrodeur/pi-model-router/releases/tag/v0.1.0
