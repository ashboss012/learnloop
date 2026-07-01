# 05. Content Review Pipeline

The safety layer. Generated content does not go straight to him. It is generated offline, queued, reviewed by me, and only then served. This is what makes AI generation safe for fact-heavy subjects.

## Why offline generation

Generation runs ahead of time in batches, not live during a session. Two reasons. It means every question can be reviewed before it is ever served, and it keeps LLM cost bounded and predictable instead of firing on every question a kid answers.

## Content lifecycle

Every question moves through states.

1. draft. Freshly generated, not seen by anyone
2. pending. In the review queue waiting for me
3. published. Approved and eligible to be served
4. rejected. Failed review, kept for reference, never served

The session loop only ever pulls published questions. A published pool is filled in advance so there is always material ready.

## The review view

A simple admin screen, gated to me. Shows pending items one at a time or in a batch.

- See the full question, answer, choices, explanation, and for reading or Tamil the passage or source
- Approve, edit then approve, or reject
- Editing writes the corrected version and marks it published
- Bulk approve for low-risk batches (math, grammar) to keep review fast

## Risk tiers, so review time goes where it matters

Not every subject needs the same scrutiny. Route by risk.

| Tier | Subjects | Review |
|------|----------|--------|
| Auto or light | Math (code-verified), grammar (rule-verified) | Spot check, bulk approve |
| Review required | English reading comprehension | Read every passage and its questions |
| Review mandatory | Tamil, and later history and science | Every item, no exceptions |

This keeps the review load realistic. The subjects that are verifiable in code barely need me. The subjects that are not get full attention.

## Keeping the pool stocked

Track how many published questions exist per skill. When a skill runs low, trigger a generation batch so the pending queue refills and I have something to review before he runs out. Simple threshold check, no fancy scheduling needed at one user.

## Not in v1

- Community or crowd review. It is just me
- Automated fact-checking of generated facts. The human review is the check for now
