# 06. Leaderboard

The competitive pull he likes about Duolingo. The hard part is that the user count starts at one, so early on the leaderboard is mostly bots. The whole challenge is making bots believable.

## Weekly leagues

Copy the Duolingo league model. A leaderboard runs for a week, ranks members by XP earned that week, then resets. Weekly reset matters because it gives a fresh climb every week and nobody is frozen in place forever. It also means a bad week is forgotten quickly, which keeps an ADHD user from feeling permanently behind.

## Real users plus bots

Group by grade cohort. When there are enough real kids in a grade to fill a board, use them. Until then, fill the remaining slots with bots so the board looks full and climbable. The mix is handled in code and the user cannot tell which is which.

## Bots are earning rates, not fixed scores

The mistake is giving a bot a static score. Then it sits at 2nd place forever and the illusion breaks. Instead each bot has an earning rate and a personality, and it accrues XP across the week the way a person would.

Design each bot with:

- A weekly XP target range (some bots are grinders, some are casual)
- Daily variation (big days, lazy days, skipped days)
- Active hours (a bot that only gains XP in the evening feels real, one that gains XP at 3am does not)

## Pre-generate the whole week, do not react to him

Critical rule. Bots must not respond to his activity in real time. A bot that passes him the instant he stops playing feels rigged, and kids notice fast. Instead, generate each bot's entire week of activity up front, a timeline of when it will gain how much XP. Then just reveal that timeline on schedule. The board updates on a timer, not in reaction to him.

This is also simpler to build than reactive bots. It is a pre-computed schedule plus a clock.

## Tune the difficulty of the climb

Set the bot distribution so his normal effort lands him mid-pack and a strong week lets him reach the top. Never make the top unreachable, and never make it trivial. He should feel he earned first place when he gets it, and feel that one more session could move him up when he is close.

Every rank has to make sense and stay dynamic. Positions shift through the week as bots earn at different rates. Nobody is glued to a spot.

## Data

See 07 for schema. In short, a leaderboard has a week id and a cohort. Entries reference either a real user or a bot. Bot entries carry a pre-generated activity timeline that a scheduled job reads to update displayed XP.

## Not in v1

- Cross-grade or global boards. Keep cohorts small and same-grade
- Any real-time head to head
- Rewards with real value. XP and rank only
