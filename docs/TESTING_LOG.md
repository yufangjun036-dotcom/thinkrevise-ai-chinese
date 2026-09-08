# ThinkRevise AI testing log

This log preserves evidence of iteration for the course paper and demonstration.

## 2026-09-06 — Chinese prototype, iteration 1

| Check | Expected result | Observed result | Status |
| --- | --- | --- | --- |
| ESLint | No lint errors | Completed with exit code 0 | Pass |
| Production build | TypeScript and routes compile | Next.js webpack build completed; `/` static and `/api/coach` dynamic | Pass |
| Home request | Page is reachable | HTTP 200 | Pass |
| Demo feedback | Works without an API key | HTTP 200, provider `demo`, exactly two feedback cards | Pass |
| Invalid short input | Learner receives a clear error | HTTP 400 with Chinese minimum-length message | Pass |
| Direct rewrite fallback | Produces a separate revision and risk notice | Returned revision, four-item overview, and meaning-risk warning | Pass |
| Desktop home visual check | Clear hierarchy with both entry points | Header, learning thesis, writing preview, and both entry cards render without horizontal overflow | Pass |
| Mobile home at 390 x 844 | Responsive layout without horizontal scrolling | Body and viewport widths both measured 390 px; content stacks correctly | Pass |
| Mobile help-mode screen | Four modes remain usable on a narrow screen | Cards stack to one column; measured content width remains within viewport | Pass |
| Guided vocabulary filter | Beginner environment task returns six relevant words | UI displayed `6 / 6` and six expandable word cards | Pass |
| Learning-mode guardrail | Learner must decide on both feedback cards and explain each decision | Continue button stayed disabled until both decisions and reasons were completed | Pass |
| Reflection guardrail | Transfer sentence and reflection are required | Copy/finish actions stayed disabled until both fields were completed | Pass |
| WebMCP valid input | Structured tool opens the same visible setup flow | `practice` returned `ready` and the practice heading became visible | Pass |
| WebMCP invalid input | Invalid path is rejected without corrupting state | Invalid value rejected; current practice setup remained visible | Pass |
| Guide-mode delayed suggestions | Suggestions appear only after the learner edits the second draft | No suggestion button before editing; one button and two optional suggestions after editing | Pass |
| Four-mode output contract | Each support level reveals only its permitted assistance | Coach: no suggestions/model; guide: two suggestions/no model; model and rewrite: model text; all matched | Pass |
| Custom-topic validation | A learner cannot continue without naming a custom topic | Continue action was disabled until a topic name was entered | Pass |
| Custom theme note | An optional learner note refines vocabulary without becoming a required writing prompt | The note is sent only to custom-topic understanding; the draft page lets the learner choose their own viewpoint | Pass |
| Custom-topic vocabulary | A custom intermediate task still provides the configured number of level-appropriate words | Draft screen displayed eight distinct expandable word cards and `6 / 8` usage guidance | Pass |
| Custom-topic semantic understanding | A free-form Chinese description is interpreted into a concrete writing angle instead of copied as a category label | Live AI inferred a specific platform-and-aesthetic angle and returned eight related English terms without a fixed entertainment label | Pass |
| Dynamic transfer task | The final task reflects the learner's session rather than repeating a fixed question | Custom topic `短视频与大学生注意力` appeared in the transfer prompt | Pass |
| Learning-data regression check | Every topic and level can provide the promised number of unique, eligible words | Twenty draws across all 15 topic/level combinations passed | Pass |
| Request-boundary regression check | Malformed JSON, short drafts, and unknown help modes are rejected | All three cases returned HTTP 400 | Pass |
| API mode regression check | The four modes preserve their different disclosure rules | Automated requests confirmed feedback, hints, suggestions, model text, and provider values | Pass |
| Live target-word tracking | Exact target words used in the learner draft are marked and counted | Five of eight displayed words were identified in a 16-word test draft; `responsibly` did not falsely match `responsible` | Pass |
| Chinese interface consistency | Interface labels are Chinese while English remains only where learners read or write English content | Source check passed; home and all four help-mode cards were inspected in the browser | Pass |
| No-cache response policy | Draft feedback responses should not be stored in ordinary HTTP caches | Invalid and valid API responses returned `Cache-Control: no-store` | Pass |
| Configured-service failure | A configured but unavailable AI service must not break the peer trial | A deliberately invalid test key returned HTTP 200 with labelled demo feedback and a fallback notice | Pass |
| Safeguard regression check | Privacy and prompt-boundary controls remain in the source | Automated check confirmed `store: false`, timeout, no-cache header, server-only key use, and content/instruction separation | Pass |
| Topic-matched demo draft | A classroom shortcut should not insert an unrelated paragraph | Selecting `大学生活` inserted its dedicated university-course draft | Pass |
| Theme-context feedback | Feedback may check whether the draft remains connected to the chosen theme without enforcing a fixed question | The practice flow displays `当前方向：…，你可以自由确定文章观点`; the AI context contains the theme label rather than a prescribed thesis question | Pass |
| Demo length consistency | Every sample should follow the displayed 80–150 word guidance | All five samples measured 90–97 words; the education-and-AI sample displayed 90 words in the browser | Pass |
| Topic-word distribution regression | A regenerated demo draft must use every target word naturally rather than concatenate a vocabulary list | Three additional live generations (including the previous `scholarly`/`annotation`/`automation` set) produced 132–148 words, zero repeated `consider the role of ...` frames, and no sentence containing a target-word pile | Pass |
| Feedback duplicate regression | The same long source sentence must not appear as two separate diagnostic cards | Three help modes and the error-heavy API suite passed quote de-duplication; overlapping long quotes were collapsed while short, distinct error spans remained available | Pass |
| Error-heavy fallback threshold | Live AI that returns too few issues should not be accepted as a deceptively sparse diagnosis | Live validation now raises the minimum issue count for drafts containing several obvious error signals and falls back to the comprehensive deterministic diagnosis when necessary | Pass |
| Minimal-edit second-draft consistency | Adding one stray character must not make unchanged first-draft problems disappear | The server carries forward every still-verbatim prior issue when the second draft has only a minor edit, revalidates all quotes, and separately flags the new incomplete ending | Pass |
| Hybrid obvious-error coverage | Live AI must not omit deterministic spelling, grammar, tense, or common academic-register errors | High-confidence rule-based findings are merged with live semantic feedback before de-duplication, preserving the mode-specific suggestion boundary | Pass |
| Final-version consistency | The complete rewrite must not retain an expression that the same session identified as an obvious spelling, grammar, tense, or academic-register problem | The final AI text is checked and deterministically polished against the same high-confidence rules before it is returned | Pass |
| Strong-draft false-fallback prevention | A well-written draft with fewer than two reliable issues must remain a live-AI result instead of being treated as a service failure | The initial phase now permits zero or one issue when justified, while error-heavy drafts retain the higher coverage threshold | Pass |
| Zero-issue completion path | A draft with no reliably locatable issue must not trap the learner in a revision step that requires an arbitrary edit | The feedback screen offers either returning to the draft or completing the session and explicitly states that the system will not invent issues | Pass |

## 2026-09-07 — Chinese prototype, three-mode revision redesign

| Check | Expected result | Observed result | Status |
| --- | --- | --- | --- |
| Three-mode selection | Revision studio shows only diagnose, local support, and direct rewrite | Three ordered cards displayed; the former duplicate guided mode was removed | Pass |
| Diagnose disclosure | No replacement sentence appears before the learner revises | API returned empty `suggestion` fields and the page showed diagnosis only | Pass |
| Local-support disclosure | Every issue can offer an optional local expression while withholding the full model | Each issue returned a local phrase, sentence, or structural template inside a collapsed control | Pass |
| Direct-rewrite route | Direct mode skips diagnosis cards and learner revision | After submission the page moved directly to the side-by-side original and complete rewrite | Pass |
| Direct-rewrite highlighting | Original problem locations remain visible without showing explanations | Exact quoted spans appeared with red wavy underlines in the locked original | Pass |
| Three-mode API regression | All current modes remain accepted and the removed mode is no longer part of the contract | Automated mode and disclosure assertions passed | Pass |

## 2026-09-07 — Live OpenAI connection check

| Check | Expected result | Observed result | Status |
| --- | --- | --- | --- |
| Local secret handling | The API key is available only to the server and excluded from Git | `.env.local` contained a configured key and matched the repository ignore rules; the secret value was never printed | Pass |
| OpenAI request authentication | The configured credential reaches the selected OpenAI project | The request reached OpenAI without an authentication error | Pass |
| Live feedback generation | The API returns structured feedback with provider `openai` | OpenAI returned HTTP 429 with `credit_balance_exhausted`; the prototype correctly switched to its labelled demo fallback | Blocked by API balance |
| Project verification after diagnostics | Logging changes compile without exposing learner text or credentials | Lint, data, copy, safeguard and production-build checks all passed | Pass |

## 2026-09-07 — Live OpenAI validation after API credit activation

| Check | Expected result | Observed result | Status |
| --- | --- | --- | --- |
| Live provider | All three help modes use the configured OpenAI model rather than the fallback | Coach, local-support and direct-rewrite responses all returned provider `openai` | Pass |
| High-density diagnosis | A deliberately error-heavy draft produces substantially more than two issues | Coach returned 16 items, local support 17, and direct rewrite 15 in the final run | Pass |
| Highlight integrity | Every returned quotation is a continuous span from the learner's original draft | All three modes passed exact case-insensitive source matching; unlocatable AI quotations are now removed at the server boundary | Pass |
| Chinese feedback categories | Live feedback keeps interface labels understandable for the Chinese prototype | A follow-up live coach run returned 16 items and every category contained Chinese text | Pass |
| Disclosure boundaries | Coach and rewrite expose no local replacement suggestions; local support provides one per issue | All mode-specific assertions passed | Pass |
| Complete academic version | Every mode prepares a non-empty corrected version without returning the original unchanged | All three modes passed | Pass |
| Browser-visible provider | The learner sees that the result came from live AI | The academic-revision demo flow displayed `实时 AI 反馈` and the learner verification warning | Pass |
| Full verification | Source, data, Chinese copy, safeguards and production build remain valid | `npm run verify` completed successfully after the live-output validation changes | Pass |

## Safeguards implemented

- The API key is read only on the server and is never included in browser code.
- Requests set `store: false` when live OpenAI feedback is used.
- Live AI calls use a 45-second default timeout (configurable only within 5–60 seconds) before the classroom fallback is used.
- API responses use `Cache-Control: no-store`.
- Drafts shorter than 20 or longer than 6,000 non-whitespace characters are rejected; spaces and line breaks do not consume the learner-facing allowance, while a separate raw-size guard prevents whitespace abuse.
- Writing-task context is limited to 500 characters before it can be included in an AI request.
- Unknown help modes, goals over 200 characters, and self-check fields over 500 characters are rejected at the server boundary.
- Re-requesting feedback clears the previous response, revision, final text, and copy state before displaying a new result.
- The prompt prohibits invented facts, data, authors, sources, and citations.
- The prompt treats drafts, goals, and self-check answers as learner content rather than executable instructions.
- The original draft is retained and never automatically overwritten.
- The two learning modes require learner self-checking and a learner-authored second draft.
- Direct rewrite is clearly labelled as an editing mode with lower learning participation.
- A no-key/API-failure demo path preserves classroom trial access.

## Remaining validation

- Visual and interaction review on desktop and mobile after the user confirms the design.
- Chinese/English parity audit after the Chinese version is complete.
- Anonymous/incognito access test after deployment.

## 2026-09-08 — Path-specific limits and in-context revision feedback

| Check | Expected result | Observed result | Status |
| --- | --- | --- | --- |
| Topic-writing word limit | Topic practice shows a 300-word limit and does not accept a 301st word | A browser test pasted 305 distinct tokens; the controlled field retained exactly 300 and displayed `300 / 300 词 · 已达到上限` | Pass |
| Academic-revision character limit | Academic revision allows 6,000 letters, numbers and punctuation in total without charging spaces or line breaks against that allowance | The original and second-draft fields display both English words and non-whitespace characters; client and server share the same counter, with a separate raw-size guard for whitespace abuse | Pass |
| In-context issue feedback | The learner can read an issue without scrolling back to a separate summary list | Clicking the underlined `teh` opened its spelling explanation and correction beside the source location | Pass |
| Pinned feedback while editing | A selected explanation remains visible while the learner edits the second draft | After pinning the spelling issue, focus and text changes in the right editor did not close the feedback | Pass |
| Issue navigation | Previous and next controls move between exact marked locations | Browser navigation moved from issue 1 (`teh`) to issue 2 (`students is`), updated the `2 / 16` label, focused the matching underline, and replaced the visible explanation | Pass |
| Responsive fallback | Narrow screens do not depend on hover or a three-column layout | At the narrow browser width, the two panes stacked vertically and the pinned explanation remained available; CSS uses a bottom-sheet presentation at phone width | Pass |

## 2026-09-08 — Full live-AI regression and hidden-issue audit

| Check | Expected result | Observed result | Status |
| --- | --- | --- | --- |
| Full source verification | Lint, topic data, Chinese copy, safeguards, TypeScript and production build remain valid | `npm run verify` passed all checks; 15 topic/level combinations were validated | Pass |
| Three live help modes | Diagnose, local-support and direct-rewrite modes keep distinct disclosure behavior | Live regression returned 25, 26 and 28 exact, locatable issues respectively; only local-support exposed optional local examples, while direct rewrite skipped diagnostic explanations in the UI | Pass |
| Demo generation stability | Two independent target-word sets produce distinct 80–150 word drafts with every word and deliberate learner errors | Two live drafts contained all eight terms, were 97 and 115 words, and included spelling, agreement and tense errors | Pass |
| Demo retry repair | A missing target word or incomplete private issue label must not discard an otherwise usable draft | Retry now revises the rejected draft with the exact validator failure, targets 105–125 words, preserves existing terms, and locally completes private validation labels | Pass |
| No mechanical placeholder as normal output | The learner should not see the repetitive local template while live AI is still working | The button now shows a disabled generating state and waits for the live draft; the local template is used only as an explicitly labelled timeout/failure fallback | Pass |
| Custom-topic interpretation | Free descriptions should be semantically understood rather than mapped to a fixed entertainment label | Plant-growing, solo-travel and group-project descriptions produced three distinct inferred directions and eight relevant words each, without generic stopwords | Pass |
| Minimal-edit second draft in browser | Adding only one trailing character must retain all unchanged issues and add the new problem | The browser flow changed from 7 initial issues to 8 remaining issues; all 7 unchanged items remained and `. c` was newly identified and underlined | Pass |
| Final-version regression | Automatic cleanup must not introduce capitalization errors inside a sentence | A browser run exposed `so This discussion suggests`; the deterministic cleanup now lowercases that phrase after coordinating/subordinating conjunctions, and the API regression rejects recurrence | Pass |
| Direct-rewrite interface | Editing mode should show only the marked original and completed version, without diagnostic cards | Browser test showed the original with red underlines beside a 112-word academic rewrite and no explanation-card stage | Pass |
| Long-input and practice limits | Academic revision permits 6,000 non-whitespace characters while topic writing remains 300 words | Both counters and server-side rejection rules were rechecked; automated malformed, short and oversized-input checks passed | Pass |

Observed live response time varied by task complexity: short mode checks were about 2–3 seconds, ordinary full feedback about 6–7 seconds, and the heaviest second-draft stress case about 9 seconds. The product should present 10 seconds as a target rather than a guaranteed upper bound because upstream model latency varies.

## 2026-09-08 — Independent second-draft analysis with difference-aware reconciliation

| Check | Expected result | Observed result | Status |
| --- | --- | --- | --- |
| Independent second-draft diagnosis | The second draft is checked against the full original rubric rather than only the first issue list | The revision prompt now performs a fresh full-text diagnosis before consulting the original and prior feedback for comparison | Pass |
| One-error correction | Changing only `People is` to `People are` records the agreement issue as resolved without erasing unchanged issues | Browser reproduction displayed 8 initial issues, 1 resolved issue and 7 original issues still present | Pass |
| Difference-aware categories | A larger second-draft total must explain where each item came from | The API assigns every revision issue to `remaining`, `changed`, or `supplemental`; the UI separately shows resolved, remaining, changed-location and supplemental counts | Pass |
| Latent issue attribution | A concern already present in an almost unchanged sentence must not be blamed on the learner's correction | Near-match reconciliation classifies `People are often unsure about this.` as a supplemental discovery rather than a problem caused by changing `is` to `are` | Pass |
| Mislabelled issue rejection | A complete sentence or short sentence must not be accepted as incomplete or overlong | Live results labelled as sentence fragments are rejected when they form a complete sentence; “overlong” labels require at least 30 words | Pass |
| Broad spelling-quote rejection | A spelling item should identify a local word or phrase, not mark a whole sentence containing unrelated errors | Spelling feedback spanning more than four words is rejected at the validation boundary | Pass |
| Overlapping issue de-duplication | Near-identical spans such as `It helped my authorship` and `helped my authorship` should appear once | Substantially overlapping spans are now merged even when the AI assigns different category names | Pass |
| Regression suite | Stress, minor edit, one correction and final rewrite all remain valid | API regression passed with independent reanalysis, comparison accounting, locatable quotes and final-version cleanup | Pass |

## 2026-09-08 — Accuracy benchmark foundation

| Check | Expected result | Observed result | Status |
| --- | --- | --- | --- |
| Gold-set structure | The benchmark contains at least 30 uniquely identified, locatable cases with valid categories | After internal audit and ambiguity removal, dataset validation passed for 36 cases: 33 initial drafts and 3 second-draft comparisons | Pass |
| Separated judgement tiers | Objective language accuracy is not mixed into one score with context-dependent academic advice | The audited gold set contains 33 objective issues and 21 advisory issues with separate metrics | Pass |
| Second-draft coverage | The benchmark tests resolved, remaining and newly introduced issues | Three revision cases cover a single correction, a new error introduced during revision and a complete register cleanup | Pass |
| Cost-safe default | Ordinary verification must not silently call the paid API | `npm run benchmark:validate` validates only local data; live runs require the explicit `RUN_LIVE_BENCHMARK=1` switch | Pass |
| Live scoring smoke test | One selected case reaches the real endpoint and produces a scored report | Audited dataset 0.2.0 case `obj-spelling-teh` completed through the live provider in 2,711 ms with 1.0 objective recall, 1.0 precision against gold, 1.0 correction acceptance, 1.0 quote locatability and zero duplicates | Pass |
| Failed-run integrity | A failed benchmark case must not make automation appear successful | The runner records per-case failures and sets a non-zero process exit status whenever any selected case fails | Pass |
| Speculative collocation rejection | A valid collocation must not be presented as an error merely because another wording is possible | The first five-case pilot exposed `evaluate feedback` as an admitted-valid but “slightly awkward” suggestion; after adding the validation boundary, an isolated live rerun returned only the real `teh` spelling error in 2,630 ms | Pass after fix |

## 2026-09-08 — Accuracy benchmark staged live audit

| Check | Expected result | Observed result | Status |
| --- | --- | --- | --- |
| First ten objective cases | Spelling, agreement, tense, noun form and word form are located and corrected without objective false positives | Across two five-case batches, objective recall, precision against gold, correction acceptance and quote locatability were all 1.0; duplicate rate was 0 | Pass |
| Unsupported noun-collocation advice | A natural phrase such as `an automated recommendation` is not marked wrong without a concrete linguistic basis | Manual review identified the medium-confidence collocation item as a false positive; the general validator now rejects hedged or non-actionable collocation claims | Pass after fix |
| Cross-category duplicate | A longer collocation card must not repeat a precise, high-confidence language correction inside the same span | `use AI careful` originally appeared both as `careful → carefully` and as a broader collocation item; the de-duplicator now retains only the precise word-form correction | Pass after fix |
| Focused post-fix rerun | Both affected cases return only their single gold-standard issue | `obj-agreement-people-is` and `obj-wordform-careful` each returned one item; all objective metrics and quote locatability remained 1.0 | Pass |
| Articles and initial register cases | Article errors and representative academic-register issues remain detectable after stricter filtering | Five cases covering `a university`, uncountable `evidence`, `Nowadays`, personal opinion and `really good` achieved complete objective and advisory coverage | Pass |
| Extra argument advice adjudication | Gold-unmatched advisory feedback is manually checked rather than automatically counted as correct or false | Two additional argument-development suggestions were supported by the source text: one unsupported policy claim and one unexplained causal step | Accepted advisory findings |
| Benchmark category synonym handling | Correct feedback is not failed merely because the model uses a synonymous Chinese category | `未经论证的强调` initially fell through to the argument family because it contains `论证`; category precedence and explicit absolute-claim matching were corrected and the affected cases returned full advisory coverage | Pass after scorer fix |
| Strong-text false-positive audit | Correct academic sentences must not be marked merely because another wording is possible | Live runs exposed false advice for `evaluate ... against ...`, `provided that`, `clearly defined targets`, and claims that already contained a `when` qualifier; self-negating, hedged, truncated-context and ignored-qualifier feedback is now rejected | Pass after fix |
| Multiple absolute expressions | Two distinct absolute claims in one sentence must both be found | The original single-match rule found `always` but skipped the later `no one`; a second position-aware rule now reports both without duplicating either location | Pass after fix |
| Mixed-error drafts | Simultaneous spelling, grammar, tense, word-form and academic-register problems remain locatable and correctly corrected | Four mixed drafts were tested. After adding `compare sources careful → carefully` and correcting semantic family scoring, the affected reruns reached full objective recall, objective precision, correction acceptance and advisory coverage with zero duplicates | Pass after fix |
| Sentence-structure cases | Dependent fragments, run-on sentences and comma splices are all distinguished from valid short sentences | The first run revealed over-aggressive fragment/long-sentence filters and a missing punctuation category mapping. Context-aware filtering plus a high-precision local run-on detector restored all three structure cases | Pass after fix |
| Cross-length structure de-duplication | A whole-sentence run-on diagnosis and a shorter boundary diagnosis must not appear as two problems | Mapping punctuation and sentence-connection labels to one structure family reduced the run-on result from two overlapping cards to one | Pass after fix |
| Exact second-draft quote matching | A corrected word must not retain an old issue merely because the old quote is a prefix of the new word | `It help` was incorrectly found inside `It helps`; all first/second-draft quote reconciliation now requires word boundaries. The focused rerun detected both original issues as resolved and the newly introduced agreement error | Pass after fix |
| Final source verification | All source checks remain valid after the accuracy fixes | Lint, learning data, text limits, Chinese copy, safeguards, benchmark dataset validation, TypeScript and production build all passed via `npm run verify` | Pass |

This staged run exercised all 36 benchmark cases at least once through the live endpoint. Because fixes were applied between batches, the evidence is a sequence of dated reports rather than one claim that an earlier full snapshot already contained the later corrections. Focused post-fix reports are retained for each discovered regression.

## 2026-09-08 — Consolidated 36-case live snapshot and final focused fixes

| Check | Expected result | Observed result | Status |
| --- | --- | --- | --- |
| One-version full live run | Every benchmark case completes against one production build | All 36 cases completed with no request failure; average end-to-end case time was 2,569 ms | Pass |
| Objective language accuracy | Clear spelling, grammar, tense, noun-form, word-form and sentence-structure errors are found without objective false positives | Recall 1.0, precision against gold 1.0, accepted correction rate 1.0 and quote locatability 1.0; duplicate rate 0 | Pass |
| Independent revision accuracy | Resolved, unchanged and newly introduced second-draft issues are distinguished | Resolved accuracy 1.0, remaining recall 1.0 and new-issue recall 1.0 | Pass |
| Advisory coverage in consolidated run | Gold-standard academic-writing concerns are detected | Coverage was 0.9524; the sole miss was the overbroad thesis `Technology affects society in many ways.` | Follow-up required |
| Overbroad thesis focused fix | An empty `many ways` thesis receives a specific centre-claim diagnosis | A deterministic, locatable thesis rule was added; focused live rerun reached advisory coverage 1.0 | Pass after fix |
| Strong-text advisory review | Optional stylistic expansion is not confused with an objective language error | The consolidated run had zero strong-text objective false positives. Focused validation additionally removed advice that ignored adjacent complements/mechanisms or admitted the wording was already valid; two strong cases then returned zero items | Pass after fix |
| Self-contradictory noun-form advice | The system must reject advice claiming `every` requires a singular noun when the quoted noun is already singular | The full-run model incorrectly challenged `every source`; a semantic boundary check was added, and the focused rerun returned only `Students is → Students are` with all objective metrics at 1.0 | Pass after fix |

The consolidated report is `reports/accuracy/2026-09-07T19-44-49-189Z.json`. The retained focused reports `2026-09-07T19-47-37-268Z` and `2026-09-07T19-49-07-216Z` document fixes applied after that snapshot; intermediate debugging reports remain local and are excluded from Git. Therefore the 0.9524 advisory figure is historical evidence, not a claim about the final focused build.

## 2026-09-08 — Long input, boundary and recovery validation (Phase 4C)

| Check | Expected result | Observed result | Status |
| --- | --- | --- | --- |
| Exact input ceiling | Exactly 6,000 non-whitespace characters are accepted and 6,001 are rejected | The no-key production server accepted 6,000 and returned an explicit demo provider; 6,001 returned a clear 400 response | Pass |
| Raw-size abuse guard | Large whitespace payloads cannot bypass transport limits | A valid sentence followed by 12,000 spaces was rejected with a format-cleanup message | Pass |
| Revision comparison limits | Oversized original drafts and excessive or oversized prior-feedback data are rejected | Original drafts over 6,000, more than 36 prior items, and prior fields over 500 characters each returned explicit 400 responses | Pass |
| Word and multilingual paste | Curly quotation marks, em dashes, non-breaking spaces, long paragraphs, British spelling and mixed Chinese/English do not crash the route | The combined paste case returned a complete, labelled demo diagnosis with `Cache-Control: no-store` | Pass |
| Malformed request | Invalid JSON does not create a blank response | The route returned a Chinese `请求格式无效` error and no-store header | Pass |
| Duplicate submission | A rapid double click starts only one logical analysis flow | Browser automation clicked the analysis action twice simultaneously; the guarded request entered one feedback stage with one response object | Pass |
| Navigation and unmount cancellation | Requests no longer update a page after the learner leaves the step | All four request types now keep one active controller, abort on back/reset/unmount, and propagate cancellation to the OpenAI request | Pass |
| Refresh recovery | Refreshing the tab does not erase active writing work | The browser refreshed during the draft step and restored the same 106-word draft, main-point self-check, weakness selection, goal and step, with a visible recovery notice | Pass |
| Damaged response recovery | A non-JSON server response produces a learner-facing message and preserves text | Shared client parsing now reports a format error with an explicit preservation message; the action can be retried | Pass |
| Upstream failure fallback | Authentication, balance, network or upstream failures cannot masquerade as live AI | An invalid-key server returned a clearly labelled demo provider and failure notice in 657 ms, with no caching | Pass |
| Latency evidence | Typical live work remains close to the 10-second experience target | The 36-case live report recorded 37 timings: median 2,320 ms, p95 4,582 ms and maximum 4,799 ms; earlier heavy second-draft stress was about 9 seconds | Pass, target not guarantee |
| Full source/build validation | Recovery changes do not break the production build | Lint and the production build passed after the changes; the dedicated `npm run test:recovery` suite passed | Pass |

The dedicated recovery suite defaults to a local server started without `OPENAI_API_KEY`, so ordinary boundary testing does not spend paid API credit. Session recovery uses browser `sessionStorage`: it is limited to the current browser tab/session and is cleared when the learner deliberately returns home and restarts.

## 2026-09-08 — Privacy, security and cost controls (Phase 4D)

| Check | Expected result | Observed result | Status |
| --- | --- | --- | --- |
| Byte-level request limits | Oversized bodies are rejected before unbounded JSON parsing | Coach, custom-topic and demo-draft returned 413, a Chinese recovery message and `no-store` for payloads above 320 KiB, 4 KiB and 16 KiB respectively | Pass |
| Per-visitor concurrency | Repeated clicks or parallel tabs cannot start overlapping paid requests for one visitor | A second active request returns 429 and `Retry-After`; release is idempotent | Pass |
| Rate and daily limits | A visitor cannot rapidly consume the key | Defaults are 5 requests/minute and 20/day per visitor; the unit test reached both the concurrency and frequency rejection paths | Pass |
| Global cost fuse | Public traffic has a local hard request-count ceiling | Defaults are 100 AI requests/day and 3 concurrent requests per running instance; the simulated global cap returned 503 before an upstream call | Pass locally |
| Prompt injection boundary | Drafts and topic descriptions cannot replace server instructions or request secrets | All three route prompts explicitly treat learner input as data; source tests enforce those statements and no user input enters headers or authentication | Pass |
| Privacy transparency | Learners can understand what is transmitted and retained | `/privacy` explains transmitted fields, same-tab recovery, no essay database, OpenAI retention boundaries, learner responsibilities and limits | Pass |
| Provider retention wording | `store: false` is not misrepresented as guaranteed zero retention | The notice follows official OpenAI documentation: API data is not used for training unless opted in, while default abuse-monitoring logs may retain prompts/responses for up to 30 days | Pass |
| Browser security headers | Common embedding, MIME and browser-permission risks are reduced | Production responses include `X-Frame-Options: DENY`, `nosniff`, `no-referrer`, and disabled camera, microphone and geolocation policies | Pass |
| No sensitive logging | Operational logs do not contain complete learner text or secrets | Route logs contain only mode/phase, timing, token counts and short internal error categories | Pass |
| Full verification | Security controls do not regress learning flows or accuracy fixtures | `npm run verify`, the 36-case dataset validation, production build and recovery suite all passed without paid API calls | Pass |

The in-memory limiter protects local, single-instance and small peer trials. It is intentionally not described as distributed-attack protection: a shared persistent limiter or hosting-platform firewall remains a mandatory production-deployment gate, together with a separate production key and project hard spend limit.

## 2026-09-08 — Always-visible Chinese meanings for target vocabulary

| Check | Expected result | Observed result | Status |
| --- | --- | --- | --- |
| Curated vocabulary coverage | Every target word from the four 200-word topic banks has a real Chinese meaning rather than a topic-placeholder sentence | All 640 unique curated/fallback words received a validated Simplified Chinese meaning; the data check rejects missing meanings and the old `相关学术概念` placeholder | Pass |
| Immediate visibility | Learners can understand a target word without first opening its hint | Each card now displays the Chinese meaning directly beneath the English word | Pass |
| Expanded hint | Opening a word keeps the meaning and also shows collocation and example information | Browser verification expanded `irrigation` and displayed `中文：灌溉`, its collocation and example | Pass |
| Custom-topic compatibility | AI-generated custom-topic words use the same interface | The existing custom-topic schema already requires a concise Chinese definition, which now appears in the always-visible meaning position | Pass |
| Representative browser draw | A real topic draw displays readable, word-specific translations | An environment draw displayed `irrigation 灌溉`, `adaptation 适应`, `urban 城市的`, `reuse 再利用`, `food-security 粮食安全`, `weather 天气` and `biodiversity 生物多样性` | Pass |
| Full regression | Vocabulary changes do not break other checks or the production build | `npm run verify` passed learning-data, limits, Chinese copy, safeguards, benchmark validation, lint, TypeScript and production build | Pass |

The translations are generated once and stored with the project. Displaying them does not make an API request and does not spend API credit during ordinary use.

## 2026-09-08 — Consolidated local release gate (Phase 4E, automated portion)

| Check | Expected result | Observed result | Status |
| --- | --- | --- | --- |
| One-command local gate | One command runs the main non-paid release checks | `npm run verify:release` completed lint, data, limits, Chinese copy, safeguards, security, benchmark validation, build, isolated API, second-draft, recovery and checklist checks | Pass |
| Paid-credit isolation | Routine release checks cannot silently use the configured key | The suite starts a separate server with forced demo mode and reports that no paid API request was made | Pass |
| No-key second-draft parity | Demo fallback keeps the same difference-aware second-draft contract | The first gate run exposed a missing comparison object; the fallback path now adds the same resolved, remaining, changed and supplemental comparison | Pass after fix |
| Single-character change identity | A newly appended letter is not confused with a letter inside an old sentence | The old overlap check matched `c` to an unrelated old sentence containing the same letter; sub-three-character containment is now rejected unless the quote is exactly equal | Pass after fix |
| Accurate duplicate test | Independent `i` capitalisation and `useing` spelling findings both remain visible | The API regression helper now applies the same minimum-span rule instead of treating one letter inside another word as a duplicate | Pass after fix |
| English parity baseline | Future translation instructions match the current product | The stale four-mode wording was corrected to the three identifiers `coach`, `model`, and `rewrite`; the validated Chinese version is explicitly the source of truth | Pass after fix |
| Accessibility source gate | Core semantics cannot silently disappear during later edits | The release gate enforces `zh-CN`, keyboard focus styles, announced errors, dialog and close labels for inline guidance, reduced-motion support and narrow-screen stacking | Pass |

The automated portion is complete. This does not replace the outstanding manual release evidence: 390×844, 430×932, one real phone, controlled live-AI sampling, a signed-out public link and independent review of the academic-English gold set.

## 2026-09-08 — First real-phone compatibility finding

| Check | Expected result | Observed result | Status |
| --- | --- | --- | --- |
| LAN HTTP session identifier | A phone opening the local network address can submit an analysis request | Mobile WebKit reported `crypto.randomUUID is not a function` because that method is unavailable in some non-secure HTTP contexts | Failed, then fixed |
| Compatible anonymous identifier | Session generation works without relying on `randomUUID` | The client now uses `crypto.getRandomValues` to create a UUID-shaped anonymous rate-limit identifier, with a non-security fallback for legacy browsers | Pass in source/build checks; phone retest required |
| Regression protection | The incompatible direct call cannot return unnoticed | Security and recovery tests require the compatible generator and reject an unconditional `crypto.randomUUID()` assignment | Pass |
| Same-phone submission retest | Refreshing the updated LAN page allows the learner to submit the analysis | The learner confirmed that the previous mobile error no longer appeared and reported no problem after the fix | Pass |
| Real-phone academic-revision journey | Red-line guidance, learner editing, independent second-draft analysis and final comparison remain usable on touch | The learner completed the full academic-English revision journey on the same phone and confirmed that the complete flow passed | Pass |
| Real-phone guided-writing journey | Topic selection, redraw, target-word meanings and tracking, matched demo generation, diagnosis and revision remain usable on touch | The learner completed the full guided topic-writing journey on the same phone and confirmed that the complete flow passed | Pass |
| Real-phone live-provider identity | A successful phone journey is visibly distinguishable from demo fallback | The learner confirmed that the result displayed the green `实时 AI 反馈` status rather than the orange demo label | Pass |
| Real-phone local-support mode | The middle support level reveals issue-level examples without supplying a complete replacement draft | The learner confirmed green live-AI status and expandable local examples; screenshot evidence shows the `仅供参考，不是整篇替代稿` boundary and a single-word correction for `teh` | Pass |
| Real-phone direct-rewrite mode | Editing mode skips diagnosis cards and immediately presents the marked original plus complete rewrite | The learner confirmed all five expected behaviours: green live-AI status, no diagnosis-card stage, direct comparison, mobile vertical stacking and explicit editing-mode labelling | Pass |

## 2026-09-09 — Touch-target and keyboard runtime audit

| Check | Expected result | Observed result | Status |
| --- | --- | --- | --- |
| Revision-loop controls | Previous, next and step-dot controls provide at least a 44×44 CSS-pixel touch target | Local production runtime measured all six controls at approximately 45×45 pixels | Pass |
| Revision setup controls | Every button in the setup step provides at least a 44-pixel-high touch target | The first audit found the brand return button at about 42 pixels and the back button at about 35 pixels; both were raised to 44 pixels and the repeated runtime audit found no undersized button | Pass after fix |
| Keyboard focus | Keyboard users can see which control is focused | The first Tab stop displayed a solid 3-pixel focus outline on the brand navigation button | Pass |
| Accessible naming | Interactive controls are exposed with usable names | The landing page and revision setup step contained no unnamed button, input, textarea or select control | Pass |
| Structural semantics | The active page keeps one main region, one level-one heading and the correct document language | Runtime inspection returned one `main`, one `h1` and `lang="zh-CN"` | Pass |

This runtime audit used the locally built production version. It verifies actual rendered control sizes at the available browser viewport, but it does not replace the outstanding 390×844 and 430×932 visual screenshots or a fresh narrow-screen keyboard/touch walkthrough.
