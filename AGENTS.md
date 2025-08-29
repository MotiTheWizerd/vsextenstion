VSCode Extension Project - Base Development Instructions
🚨 Critical Safety Rules
Rule #1: Always Learn Before You Code

MANDATORY: Before any task, thoroughly explore and understand the existing codebase
MANDATORY: Search and read relevant documentation in docs/ directory
Use file tree exploration, code search, and dependency analysis
Understand the current architecture, patterns, and conventions
Identify related existing functionality before making changes

### Pre‑Development Checklist

- Read relevant docs in `./docs`
- Understand feature requirements and affected routes/components
- Check for similar prior implementations
- Estimate complexity and risk (Low/Medium/High)



### During Development

- Start with types (define interfaces and schemas)
- Write tests alongside code
- Implement incrementally; keep changes focused
- Validate continuously: lint, type‑check, run tests
- Update docs as you go



Rule #2: Keep Files Small and Focused

Maximum 200-300 lines per file (excluding comments)
Each file should have a single, clear responsibility
If a file grows beyond this limit, refactor into smaller modules
Prefer many small, focused files over few large ones

Rule #3: Modular Architecture

Split functionality into reusable modules whenever possible
Create utility functions in dedicated utility files
Use consistent module patterns and exports
Avoid code duplication - extract common logic into shared modules
Follow existing project structure and naming conventions

Rule #4: No Major Changes Without Approval

STOP: Before implementing any significant feature or architectural change, ask for approval
Define "major" as:

Changes affecting multiple files (>3 files)
New dependencies or major dependency updates
API changes or new extension commands
Changes to core functionality or workflows
Performance-critical modifications

Rule #5: Always Update Documentation for Drastic Changes

MANDATORY: Update relevant documentation in docs/ when making drastic changes to features
Document new APIs, changed behavior, or modified workflows
Update usage examples and code samples
Keep documentation in sync with code changes
Present a brief plan and get confirmation before proceeding

📋 Development Workflow
Phase 1: Discovery & Analysis

Codebase Exploration

Map out the project structure
Identify key entry points and main modules
Understand the extension's commands, providers, and services
Review package.json for dependencies and scripts


Documentation Review

Read all relevant docs in docs/ directory
Check README.md and any contributing guidelines
Review any architectural decision records (ADRs)
Look for API documentation and code examples


Impact Assessment

Identify which files/modules will be affected
Check for existing tests related to the change area
Look for similar existing functionality
Assess potential breaking changes



Phase 2: Planning & Design

Create Implementation Plan

List specific files to be created/modified
Define module boundaries and interfaces
Plan for backward compatibility
Consider error handling and edge cases


Get Approval (for major changes)

Present the plan with rationale
Wait for explicit approval before proceeding
Address any feedback or concerns



Phase 3: Implementation

Start Small

Implement minimal viable changes first
Test incrementally
Commit frequently with clear messages


Follow Patterns

Use existing code patterns and conventions
Match the current code style and structure
Reuse existing utilities and helpers


Maintain Quality

Add appropriate error handling
Include JSDoc comments for public APIs
Follow TypeScript best practices
Ensure proper resource cleanup



🛡️ Safety Checks
Before Making Changes

 Have I read the relevant documentation?
 Do I understand the current implementation?
 Is this change really necessary?
 Can I reuse existing functionality?
 Will this break existing features?

During Implementation

 Am I following existing patterns?
 Are my files staying small and focused?
 Am I handling errors appropriately?
 Is my code self-documenting or properly commented?

Before Submitting

 Have I tested the changes thoroughly?
 Do all existing tests still pass?
 Have I updated relevant documentation?
 Is the code ready for review?

File Naming Conventions
Use kebab-case for file names: my-feature.ts
Use descriptive names: document-formatter.ts not formatter.ts
Include file type in name when helpful: types.ts, constants.ts
Group related files in directories

🔧 Code Quality Standards
TypeScript

Use strict TypeScript configuration
Prefer interfaces over types for object shapes
Use proper typing, avoid any
Leverage VSCode API types effectively

Error Handling

Always handle potential errors gracefully
Use try-catch for async operations
Provide meaningful error messages
Log errors appropriately for debugging

Performance

Be mindful of extension activation time
Use lazy loading where possible
Dispose of resources properly
Avoid memory leaks with proper cleanup

Testing

Write tests for new functionality
Maintain existing test coverage
Test edge cases and error conditions
Include integration tests where appropriate

🚫 Common Pitfalls to Avoid

Making changes without understanding the codebase
Creating monolithic files with multiple responsibilities
Implementing features that already exist elsewhere
Breaking existing functionality with "small" changes
Not following the established patterns and conventions
Adding unnecessary dependencies
Ignoring error handling and edge cases
Not testing changes thoroughly before submitting

📞 When to Ask for Help

Always before major architectural changes
When you're unsure about the impact of a change
When you encounter undocumented behavior
When tests are failing and you can't determine why
When you need clarification on requirements
When you're considering adding new dependencies

Remember: It's better to ask questions and move slowly than to break working functionality with hasty changes.