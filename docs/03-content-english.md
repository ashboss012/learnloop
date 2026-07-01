# 03. Content: English

English splits into two very different problems. Grammar is rule-based and verifiable like math. Reading comprehension is fact-adjacent and needs grounding. Treat them separately.

## Grammar

Grammar is close to math in that the rules are fixed and answers are checkable. Build it the same way, from templates and rules rather than freeform LLM output.

- Parts of speech, subject-verb agreement, tenses, punctuation, capitalization, plurals
- Generate items from rule templates with a word bank
- The correct answer is determined by the rule, so it is verifiable in code
- Distractors are the common wrong forms

This is safe to generate at scale with light or no review.

## Reading comprehension

Here is the clean trick. Do not pull copyrighted passages and quiz them. Have the AI write an original passage at a 4th grade level, then generate questions answerable only from that passage. The passage is net new so there is no copyright issue, and it is self-contained so the questions are checkable against the text in front of you.

Flow:

1. Generate an original short passage at target reading level on a kid-friendly topic.
2. Generate comprehension questions grounded strictly in that passage (main idea, detail, vocabulary in context, inference).
3. The passage plus questions go to the review queue (see 05). This is the subject where a human read matters most, because an inference question can be subtly wrong even when the passage is fine.

If you ever want real leveled passages instead of generated ones, use openly licensed sources built for this, for example public-domain texts or education sites that permit reuse. Confirm the license first. Original generation avoids the question entirely, so prefer it for v1.

## Vocabulary

Word plus definition plus usage. Ground definitions in a known word list for the grade so the model is not inventing meanings. Verifiable against the list. Question types include definition match, fill in the blank, synonym or antonym.

## Reading level control

Keep passages at grade level. Do not trust the model's self-assessment of difficulty. Sanity check with a readability measure in code (for example a Flesch-Kincaid style score) and reject passages outside the target band before they reach the review queue.

## Cost

Passage and question generation is LLM work but it runs offline in batches and each batch is small. Cheap. See 09 for the model choice.

## Not in v1

- Writing or essay grading. Open-ended scoring is hard and error-prone, keep everything auto-checkable for now
- Spelling audio dictation, add once audio is in place for Tamil
