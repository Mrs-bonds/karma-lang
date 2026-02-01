Karma v1.0.0
Simple by default. Powerful only when needed.
The core stays boring. Advanced features are optional and opt-in.

What Is Karma:

Karma is a small, readable language and toolset for building simple, stable, page-based websites without heavy frameworks, endless configuration, or boilerplate fatigue.
It’s for developers who want to ship a clean page, understand it later, and move on.
No hype. No magic. Just calm, predictable tools.

Why Karma Exists:

Modern web tooling often adds complexity faster than it adds value.
Karma takes the opposite approach.
Karma exists to:
Reduce mental load during development
Prioritize readability over clever abstractions
Remove repetition and unnecessary boilerplate
Stay predictable and file-based
Remain beginner-friendly without blocking growth
The goal is not power at all costs.
The goal is clarity first.

What Karma Is (v1.0.0):

A stable core for building page-based websites
File-based and predictable
Opinionated by design
Calm, boring, and intentional

What Karma Is Not:
A plugin marketplace
A heavy framework
A dashboard-driven system
An “everything at once” platform
Those things may come later — only if explicitly enabled.

Who Karma Is For:

Developers who want simple websites without constant setup
People who value clear, readable code
Beginners who don’t want to be punished by their tools
Builders who prefer fewer decisions and fewer dependencies

Who Karma Is Not For:
Complex web applications
Feature-heavy dashboards
Plugin-driven ecosystems

Installation:

Karma runs locally using Node.js and compiles .karma files into usable output.

1. Clone the repository
Copy code
Bash
git clone https://github.com/Mrs-bonds/karma-lang.git
cd karma-lang

2. Install dependencies
Copy code
Bash
npm install
Usage
Compile a .karma file
Copy code
Bash
node karma-compiler.js path/to/file.karma
Compiled output is written to the configured destination.
Run the runtime
Copy code
Bash
node karma-runtime.js
Sample Files

test.karma — demonstrates basic logic handling
home.karma — example of a simple webpage

Roadmap Philosophy
Karma follows one rule:
Start simple. Add power only when needed.
The core will remain stable.
Advanced features will always be optional and opt-in.