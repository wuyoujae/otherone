# Project Overview

这是一个名字叫：beyond code的平台，这个平台是AI时代下的敏捷开发管理工具，全部功能为AI开发服务。
他的基本功能就是敏捷开发管理，但是并不是按照传统的sprint等那样

我们需要使用electron框架同时开发web端和desktop端。

# Tech Stack

Frontend: Next.js + electron框架, Lucide Icons, Tailwind CSS, TypeScript Backend: Node.js, TypeScript Database: PostgreSQL, Redis

每次完成任务之后需要检查一下是否同时更新了electron的代码和web的代码

# Self-Testing Loop

After completing any code — whether frontend or backend — you must write test scripts or use every available means to verify correctness. Follow these steps:

1. **Define the test objective.** You should test after completing a meaningful unit of work (e.g., a login API endpoint), not after trivial changes (e.g., writing a single for loop). Aim to test at the granularity of a complete feature or module.

2. **Write test code and test cases with clearly defined expected results.** All test scripts must be placed in the `/test-script` directory. You may use any scripting language or tool for testing — including Python, cURL, shell commands, Bash scripts, or JavaScript — but you must never generate any scripts that could be dangerous or destructive.

3. **Execute the tests safely.** Before running any test command, you must verify it is safe and non-destructive. The following actions are **strictly prohibited** during testing:

   - Killing, terminating, or restarting any running process (e.g., `taskkill`, `kill`, `pkill`, `killall`, or equivalent commands).
   - Stopping or restarting system services, dev servers, or daemons.
   - Modifying environment variables, system configuration, or any files outside the `/test-script` directory.
   - Any command that could affect the stability of the current environment or interfere with other running processes.

   Tests must run in isolation and must not have side effects on the host environment. If a test cannot be executed safely within these constraints — for example, because a port is in use or a process lock exists — **skip the test entirely** and document the reason clearly. Do not attempt workarounds that involve process manipulation.

4. **Identify and resolve all issues** until every test passes. Once testing is complete and all tests pass, clean up all generated artifacts and temporary files.

# Standards & Conventions

All work must strictly adhere to the established standards below. No deviations are permitted.

## Code Standards

### General

1. **Modular and reusable architecture.** Code must be written in a modular, reusable style. Use the following criteria to determine whether something should be extracted into a separate module: *Can it function as an independent module?* and *Does it satisfy reusability requirements?*

   **Example:** A login page contains a login panel and a registration panel. Both panels can function independently, so they should be separate components imported into the login page. Within the login panel, elements like input fields and radio buttons are tightly coupled to that specific context and not reused elsewhere — these should remain inline within the login panel component. However, a CAPTCHA/human verification widget is reused across multiple contexts (e.g., login requests, registration requests), so it must be extracted as a shared component.

   The same principle applies to backend code.

2. **Code readability and cleanliness.** Code must be clean, well-structured, and easy to read. No spaghetti code.

   - Maintain consistent and proper indentation.
   - Minimize inline comments. Keep comments concise or omit them entirely when the code is self-explanatory. All comments must be written in English.
   - All identifiers must have meaningful, descriptive names. File names should use kebab-case (e.g., `user-profile.ts`). Functions and variables must use camelCase (e.g., `getUserProfile`).

3. **Routing and accessibility.** After completing a new page or component, you must configure the relevant routes or integrate it into the application so the user can actually see and interact with the changes. Always provide the correct access URL/route to the user.

### Frontend Standards

1. **Custom component library.** All UI components used in the project must be developed in-house as much as possible (icon libraries are the only exception — external icon libraries such as Lucide are permitted). In particular, the project **must** have a custom message/notification system with the following specifications:
   - Message types: `info`, `success`, `warning`, `error`, `confirm` (two variants: confirm-only, and confirm-with-cancel).
   - Display position: top-center of the viewport.
   - Auto-dismiss after 3 seconds.
   - Multiple messages can stack simultaneously.
   - **Do not use native browser dialogs** (e.g., `alert()`, `confirm()`, or default HTML elements).
   - When building new components, always reference existing pages and components in the codebase to maintain visual and behavioral consistency.
2. **Request handling.** All HTTP requests must go through a centralized request interceptor (e.g., Axios interceptor). The interceptor must be integrated with the custom message component for unified error handling and user feedback.
3. **Visual consistency.** When designing any new component or page, you must reference existing pages and components in the project. The entire project must maintain a unified visual language and design consistency across all views.
4. **Micro-interactions and animations.** When building components or interactive elements, apply appropriate CSS animations and transitions to create a polished, premium feel. The UI must not feel rigid or flat. Examples include:
   - Dropdown menus should animate in with easing/transition effects.
   - Content loading on scroll should use slide-up or fade-in effects.
   - Both **enter** and **exit** animations must be implemented for all transient UI elements.
5. **No emojis.** Emojis are strictly prohibited throughout the project. Use icons exclusively.
6. Mobile responsiveness. All pages must be fully responsive and properly adapted for mobile devices. This is mandatory — no exceptions.

### Backend Standards

#### Database Design

1. **No foreign key constraints.** Tables may have logical relationships (e.g., `user` and `wallet` linked by `user_id`), but foreign key constraints must never be defined at the database level. Referential integrity should be enforced at the application layer.

2. **No database triggers.** All data logic must be handled at the application code level. Do not rely on database-level trigger functions.

3. **UUIDs for all IDs.** All primary keys must be UUIDs, generated at the application layer immediately before the INSERT statement is executed — unless a specific business logic requirement dictates otherwise.

4. Numeric enums for all statuses and types.

    All enumerations and statuses should use integer values (e.g., 

   ```
   0
   ```

   , 

   ```
   1
   ```

   , 

   ```
   2
   ```

   ). Follow these conventions:

   - **Binary/boolean-like statuses** (e.g., account status: active vs. disabled): Use `0` for the normal/default state, and any non-zero value for abnormal states. For example: `0` = active, `1` = disabled.
   - **Multi-value categorical enums** (e.g., subscription tiers where all values are equally valid categories): Start from `1`. For example: `1` = Free, `2` = Pro, `3` = Ultra.

5. Schema management workflow.

   - First, update `/prisma/db.sql` — this file serves as the single source of truth for the entire database schema.
   - Then, synchronize the Prisma schema accordingly. Prisma must be properly configured to support production database migrations.
   - Maintain a `/prisma/usage.md` document that provides step-by-step migration instructions. Every step must be accurate and verified.

6. **Backward compatibility for schema changes.** When adding a new column to an existing table, the column **must** be nullable to ensure backward compatibility with existing data. Failing to do so will cause Prisma migration errors.

7. **Legacy data compatibility.** When adding new columns, always ensure proper handling and compatibility with pre-existing data records.

#### API Design

1. **Comprehensive edge case handling.** API handler logic must account for as many edge cases as possible. Before writing any backend logic, you must:
   - Enumerate all possible edge cases and boundary conditions.
   - Reason through each scenario thoroughly.
   - Then implement the logic based on the provided database design. You are encouraged to propose adjustments to the database schema if your analysis reveals improvements. The provided design is a reference — the goal is to produce the most robust, professional, and reliable API possible.
2. **Logic-driven database design (core principle).** This principle is mandatory. The database schema should only reflect what is needed for the features currently being developed — never design ahead for features that don't exist yet. For example: when building a login feature, you only need fields like verification code, password, username, user ID, and created timestamp. Do not preemptively add columns for unrelated features like membership tiers. When a membership feature is later developed, you can add the necessary columns at that time. **The logic drives the schema, not the other way around.**

#### Code Standards

1. **RESTful API conventions.** All API responses must follow RESTful API design principles. The frontend request interceptor must handle responses accordingly.
2. **Industry-standard project structure.** The project directory layout must follow current industry best practices for maintainability and scalability.

## Configuration & Development Standards

1. **Internationalization (i18n).** Before writing any frontend code — whether a page, component, or feature — always check for existing i18n configuration first. Configure all supported languages and ensure no i18n entries are missed.
2. **Integration testing workflow.** After completing both frontend and backend code, test each side independently first. Once individual tests pass, integrate the backend with the frontend and perform an end-to-end integration test to ensure everything works together without errors.
3. **Environment variables.** Any configurable values must be read from environment variables. Maintain a `.env.example` file that documents all required environment variables, enabling quick setup when deploying to production.
4. **`.gitignore` maintenance.** Keep `.gitignore` up to date. Configuration files containing secrets, test scripts, and generated artifacts should all be included.
5. **Test script management.** Maintain a `/test-script` directory dedicated to test scripts. After tests pass and the scripts are no longer needed, delete them promptly to keep the repository clean.
6. **User acceptance test guidance.** After completing each task, provide clear instructions on how I can manually verify and test the deliverable. Even though you will run your own tests, I will also perform independent verification — so you must tell me exactly how to test.
7. Port conflict resolution. This machine may run multiple projects simultaneously. If a port is already in use, never terminate the process occupying it. Instead, increment the port number and retry until a free port is found (e.g., if 3000 is occupied, try 3001, then 3002, and so on). Once a free port is confirmed, update all relevant configuration files (e.g., .env, next.config.js) accordingly and notify the user of the port being used.

# Design Principles

Think about how large-scale tech companies approach development — that is our standard. You are not building a toy project; you are building an **enterprise-grade commercial application**. The following factors must be considered at all times:

1. **Security.** All data handling must follow the highest security standards. This includes but is not limited to:
   - Data encryption at rest and in transit, with proper decryption workflows.
   - CAPTCHA / human verification for sensitive operations.
   - Thorough validation and sanitization at every interaction layer.
   - Beyond data security, consider **privacy compliance** and **legal safety**. When using third-party libraries, prefer open-source libraries with permissive commercial-use licenses to avoid legal risks. If no suitable library exists, build the functionality in-house.
2. **Performance.** Performance must be continuously monitored and optimized. Issues such as memory leaks or other hazardous conditions are unacceptable. Always use the most performant approach available. After completing any feature, review it for potential performance issues and optimization opportunities. Loading speed is critical — apply every applicable optimization technique. **Example:** For an image upload feature where users upload ~3MB images, add a compression middleware before storing to object storage. Compress images to ~25KB (or the smallest reasonable size) using the best available compression algorithm, then upload the compressed version.
3. **Stability & Resilience.** The application must not crash unexpectedly. Implement proper fallback strategies for all failure-prone operations. **Example:** When calling AI model APIs, if all model endpoints fail, there must be a graceful degradation strategy in place. Every possible failure scenario must have a defined fallback plan. No design decision should ever compromise the platform's reliability.
4. **User Experience (UX).** User interaction is paramount. Design everything from the user's perspective, applying established UX principles such as:
   - **The principle of least effort** — minimize the cognitive and physical effort required from users.
   - Apply these principles to both frontend interactions and backend logic design (e.g., sensible defaults, progressive disclosure, forgiving input handling).

If you are unsure about current industry best practices before starting development, you may use the search tool to research how leading companies handle the specific challenge, document your findings, and then proceed with development.

# Requirements

After completing each task, you must say: "My task is complete! I'm so happy!!! Jay, do you have any other requirements? I will keep working hard!!!!"

# Response Language

All responses and explanations must be in Chinese. Code and comments may be in English.