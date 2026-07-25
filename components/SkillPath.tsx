import StartSessionButton from '@/components/StartSessionButton'
import { startingTier } from '@/lib/mastery'
import { SKILL_ICONS, SKILL_COLORS } from '@/lib/skillDisplay'
import type { Skill } from '@/types'

interface Props {
  skills: Skill[]
  tierBySkill: Map<string, number>
  dueForReview: Set<string>
  grade: number
  diagnosticDone: boolean
}

// Duolingo-style winding path: nodes snake left/right around a centerline
// (a sine wave by index, so it's deterministic with no lookup table) with
// a dashed line straight down the middle behind them.
export default function SkillPath({ skills, tierBySkill, dueForReview, grade, diagnosticDone }: Props) {
  return (
    <div className="relative py-2">
      <div
        className="absolute left-1/2 top-0 bottom-0"
        style={{ borderLeft: '4px dashed var(--border)', marginLeft: -2 }}
      />
      <div className="relative flex flex-col items-center gap-5">
        {skills.map((skill, i) => {
          const offsetX = Math.round(Math.sin(i * 0.9) * 76)
          return (
            <div key={skill.id} style={{ transform: `translateX(${offsetX}px)` }}>
              <StartSessionButton
                skill={skill}
                color={SKILL_COLORS[skill.slug] ?? '#6c63ff'}
                icon={SKILL_ICONS[skill.slug] ?? '📐'}
                tier={tierBySkill.get(skill.id) ?? startingTier(skill.slug, grade)}
                diagnosticDone={diagnosticDone}
                dueForReview={dueForReview.has(skill.id)}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
