'use server'

import { createClient } from '@/utils/supabase/server'

export type ParsedQuestion = {
  text: string
  type: 'radio' | 'checkbox'
  options: Array<{ label: string; text: string; isCorrect: boolean }>
}

export async function createTestAction(
  title: string,
  timeLimit: number,
  parsedQuestions: ParsedQuestion[]
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Insert test
  const { data: test, error: testError } = await supabase
    .from('tests')
    .insert({ title, time_limit_minutes: timeLimit, created_by: user.id })
    .select('id')
    .single()

  if (testError || !test) {
    return { error: 'Failed to create test: ' + testError?.message }
  }

  try {
    // Insert questions and options sequentially mapping the foreign keys
    for (const q of parsedQuestions) {
      const { data: newQ, error: qError } = await supabase
        .from('questions')
        .insert({ test_id: test.id, question_text: q.text, type: q.type })
        .select('id')
        .single()

      if (qError || !newQ) throw new Error('Error inserting question: ' + qError?.message)

      const optionsToInsert = q.options.map(opt => ({
        question_id: newQ.id,
        label: opt.label,
        option_text: opt.text,
        is_correct: opt.isCorrect
      }))

      const { error: optError } = await supabase.from('options').insert(optionsToInsert)
      if (optError) throw new Error('Error inserting options: ' + optError?.message)
    }

    return { success: true, testId: test.id }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
