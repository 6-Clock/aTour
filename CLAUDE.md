# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**aTour** — early-stage project with a `frontend/` and `backend/` directory split. No application code exists yet; only directory scaffolding is in place.

## Repository Structure

- `frontend/` — client-side code (to be built out)
- `backend/` — server-side code (to be built out)

## Environment

Secrets and configuration go in `.env` (git-ignored). Never commit `.env`.

## Branch Strategy

Branch protection is configured on `main`. Work on feature branches and open PRs to merge.

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
- Author a backlog-ready spec/issue → invoke /spec
