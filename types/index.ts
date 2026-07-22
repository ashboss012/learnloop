export type Role = 'student' | 'admin'

export interface UserProfile {
  id: string
  display_name: string
  grade: number
  role: Role
  xp_total: number
}

export interface Skill {
  id: string
  subject: string
  name: string
  slug: string
  parent_id: string | null
  difficulty_order: number
}

export interface SessionQuestion {
  id: string
  session_id: string
  skill_id: string
  prompt: string
  choices: Choice[] | null
  difficulty: number
  position: number
  passage_text: string | null
  // answer and explanation are NOT included — server only
}

export interface Choice {
  label: string
  value: string
}

// Shared by lib/math/generator.ts and lib/english/generator.ts
export interface GeneratedQuestion {
  prompt: string
  choices: Choice[]
  answer: string
  explanation: string
  type: 'multiple_choice'
}

export interface SessionAnswer {
  id: string
  session_id: string
  session_question_id: string
  chosen: string | null
  was_correct: boolean
  attempt_number: number
}

export interface Session {
  id: string
  user_id: string
  skill_id: string
  subject: string
  status: 'active' | 'completed'
  xp_earned: number
  question_count: number
  started_at: string
  completed_at: string | null
}

export interface StreakData {
  current_streak: number
  longest_streak: number
  last_active_date: string | null
  freezes_available: number
}

// What the client receives for a question (NO answer)
export interface ClientQuestion {
  id: string
  prompt: string
  choices: Choice[] | null
  type: 'multiple_choice' | 'text_input'
}

// Response from the grade server action
export interface GradeResult {
  correct: boolean
  correctAnswer: string
  explanation: string
}

// What the session page needs
export interface SessionState {
  sessionId: string
  skillName: string
  queue: string[]        // ordered list of session_question IDs
  totalUnique: number    // number of unique questions (for progress bar)
  completedUnique: number
}
