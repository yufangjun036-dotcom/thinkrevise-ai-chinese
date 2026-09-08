# ThinkRevise AI (Chinese) architecture

## Purpose

ThinkRevise AI supports multilingual university students who can obtain polished English from generative AI but may not understand the changes or transfer the learning to a new task. The architecture therefore makes learner actions visible before and after AI assistance.

## System map

```text
Browser learning workspace
  ├─ Guided writing setup
  ├─ Academic revision setup
  ├─ Draft and self-check
  ├─ Comprehensive writing diagnosis
  ├─ Side-by-side revision
  └─ Transfer task and reflection
           │
           ▼
POST /api/custom-topic (server only, custom-description understanding)
POST /api/demo-draft (server only, target-word-matched practice draft)
POST /api/coach (server only)
  ├─ validates byte size, text length, modes, and prior-feedback bounds
  ├─ applies per-visitor and global rate, daily, and concurrency controls
  ├─ applies learning and integrity instructions
  ├─ requests JSON Schema output from the OpenAI Responses API
  ├─ merges high-confidence language rules with contextual AI feedback
  ├─ independently re-analyses the learner's second draft
  └─ returns a clearly labelled deterministic demo response when no key is configured or the API fails
```

## Why this build type

The prototype uses custom Next.js code because the learning design depends on conditional support levels, a multi-stage learner-controlled workflow, input validation, before/after comparison, and a reliable classroom fallback. The interface remains a single-page working surface so peers do not need accounts, installation, or technical knowledge.

## Meaningful AI role

AI is used for open-ended language diagnosis and revision support: identifying all reliably detectable language and academic-writing problems in a learner's own draft, quoting the exact problem locations, explaining actionable corrections, and producing local examples or a full revision only when the selected support level permits it. Ordinary interface transitions, word counts, vocabulary selection, validation, and progress tracking are handled deterministically rather than being presented as AI.

The guided-writing entrance offers four curated topics plus a custom-topic path. Curated topics provide a broad theme background and filter the vocabulary bank by subject and level; they do not prescribe a thesis or fixed writing question. For a custom description, the server asks the live model to infer a concrete topic angle from the learner's Chinese description (rather than copying it as a category label), then returns strongly related English target words with definitions, collocations and examples. An optional learner note can refine that vocabulary draw. The inferred angle is not presented as a required argument. A neutral local word pool is used only if the live understanding route is unavailable.
Target-word use is detected locally with whole-word matching as the learner types. This gives immediate practice feedback without sending draft text to an additional service or presenting deterministic string matching as AI.

## Data flow and privacy

1. The learner removes personal information and enters a draft in the browser.
2. For a custom guided-writing topic, the browser first sends the Chinese description, optional angle note and level to `/api/custom-topic`; the server returns the inferred direction and English target words. The draft request then sends only the draft, selected goal, support mode, and self-check to `/api/coach`. For guided writing, it also sends the current theme context so feedback can check whether the learner's own viewpoint stays connected to the chosen theme, without assessing compliance with a fixed question.
3. The server accepts 20–6,000 non-whitespace characters for academic revision. Spaces and line breaks do not consume this learner-facing allowance; a separate 12,000-character raw-input ceiling prevents whitespace-heavy abuse.
4. The server also rejects unknown support modes and bounds goal/self-check lengths before constructing the AI request.
5. If live AI is configured, the server sends the task with `store: false`; the API key stays in server environment variables.
6. Every route response uses `Cache-Control: no-store`; the application has no account, analytics, or essay database. Same-tab recovery uses browser `sessionStorage` and is cleared on a deliberate restart.
7. A UUID-shaped anonymous session identifier supports local rate limiting. It is generated with a mobile-compatible random-byte method rather than depending on secure-context-only browser APIs.
8. The result is returned to the current page.

## Learning safeguards

- The original draft is locked and displayed separately from revisions.
- Diagnose and local-support modes require a self-check before feedback.
- Diagnosis covers all reliably identifiable issues, within a maximum of 36 items, and marks each quoted location in the original draft.
- Diagnose mode gives rules and directions without replacement sentences.
- Local-support mode places optional phrase- or sentence-level examples inside collapsed controls, while the learner remains responsible for the full revision.
- A complete model text is delayed until after a learner attempt in both learning modes.
- Full rewrite is labelled as editing rather than evidence of independent learning.
- The AI prompt prohibits invented facts, data, authors, sources, and citations.
- The AI prompt explicitly treats learner fields as content, not instructions, to reduce prompt-injection risk.
- Confidence and meaning-risk notices encourage verification.
- The final transfer task changes with the learner's chosen topic or first feedback priority, so reflection tests application rather than repeating one fixed AI-related answer.

## Reliability strategy

The peer trial must remain interactive when an API key, network connection, quota, or model is unavailable. A deterministic fallback therefore checks a broad set of deliberately demonstrated spelling, grammar, academic-style, structure, and argument patterns, then returns a limited rewrite. Live diagnosis calls use a 45-second default timeout, clamped to 5–60 seconds when configured; custom-topic understanding uses a separate 20-second timeout because it runs before writing starts. The interface clearly labels fallback output as demo feedback so it is not misrepresented as live AI.

The selected default model and structured-output capability are documented by the [official GPT-5.4 Mini model page](https://developers.openai.com/api/docs/models/gpt-5.4-mini). The use of `instructions`, `max_output_tokens`, `store: false`, and `text.format` follows the [official Responses API reference](https://developers.openai.com/api/reference/cli/resources/responses/methods/create).

The local release command builds the application, validates the 36-case benchmark data, starts a separate forced-demo server, runs all three API contracts plus second-draft and failure-recovery checks, and then closes that server. It never uses the configured paid key. Production deployment still requires a separate production key, a project spend cap, and shared or platform-level rate limiting when more than one server instance is used.

## Chinese/English parity plan

The Chinese build is validated first. Before duplication, all user-visible copy will be moved into a dedicated language module. The English project will then be copied from the validated Chinese source and will replace only that language module plus language metadata. A parity check will compare routes, component structure, styles, data identifiers, API schema, prompts, validation limits, and interaction tests across both projects.

## Image replacement plan

User-selected images will be stored under `public/images`. Chinese and English versions will reference identical filenames and dimensions. Source, licence, and access date must be recorded in `docs/IMAGE_GUIDE.md` before an image is used.
The optional home image is controlled in `app/site-config.ts`; a null value preserves the built-in interface preview, while a local image path swaps into the same reserved layout area.
