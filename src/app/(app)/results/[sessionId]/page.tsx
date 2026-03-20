import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export default async function ResultsPage({
  params
}: {
  params: Promise<{ sessionId: string }>
}) {
  const resolvedParams = await params
  const { sessionId } = resolvedParams
  const supabase = await createClient()

  // Fetch session with results
  const { data: session, error: sessionErr } = await supabase
    .from('test_sessions')
    .select(`
      id, score, finished_at, test_id,
      tests ( title )
    `)
    .eq('id', sessionId)
    .single()

  if (sessionErr || !session || !session.finished_at) {
    notFound()
  }

  // Fetch answers to show breakdown
  const { data: sessionAnswers, error: saErr } = await supabase
    .from('session_answers')
    .select(`
      selected_option_ids,
      questions (
        id, question_text, type,
        options ( label, option_text, is_correct )
      )
    `)
    .eq('session_id', sessionId)

  if (saErr || !sessionAnswers) {
    return <div>Error loading result details.</div>
  }

  type ResultOption = { label: string; option_text: string; is_correct: boolean }
  type ResultQuestion = { id: string; question_text: string; type: string; options: ResultOption[] }

  // Compute pass/fail from score (70% threshold)
  const totalQuestions = sessionAnswers.length
  const passed = totalQuestions > 0 && (session.score ?? 0) / totalQuestions >= 0.7

  // Helper to determine if an answer is fully correct
  const getIsCorrect = (selected: string[], options: ResultOption[]) => {
    const correctOptions = options.filter(o => o.is_correct).map(o => o.label)
    return selected.length === correctOptions.length &&
           selected.every(l => correctOptions.includes(l)) &&
           correctOptions.every(l => selected.includes(l))
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-3xl font-extrabold text-gray-900">
          {(session.tests as unknown as { title: string } | null)?.title} - Results
        </h1>
        <div className="mt-6 flex flex-col items-center justify-center space-y-4">
          <div className="flex h-32 w-32 items-center justify-center rounded-full bg-gray-50 border-4 border-indigo-100 shadow-inner text-4xl font-black text-indigo-600">
            {session.score} / {totalQuestions}
          </div>

          <div className="mt-4 flex items-center gap-2">
            {passed ? (
              <span className="inline-flex items-center rounded-full bg-green-100 px-4 py-1.5 text-lg font-bold text-green-800">
                <svg className="mr-1.5 h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Passed
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-red-100 px-4 py-1.5 text-lg font-bold text-red-800">
                <svg className="mr-1.5 h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Failed
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-6 rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 border-b pb-4">Detailed Breakdown</h2>

        <div className="space-y-8">
          {sessionAnswers.map((ans, idx) => {
            const questions = ans.questions as unknown as ResultQuestion
            const isFullyCorrect = getIsCorrect(ans.selected_option_ids || [], questions.options)

            return (
              <div key={questions.id} className="rounded-lg border bg-gray-50 p-6 shadow-sm">
                <div className="flex items-start justify-between">
                  <h3 className="text-lg font-medium text-gray-900 w-10/12">
                    <span className="mr-2 text-indigo-600 font-bold">{idx + 1}.</span>
                    {questions.question_text}
                  </h3>
                  <div className="w-2/12 flex justify-end">
                     {isFullyCorrect ? (
                        <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 border border-green-200">
                          Correct
                        </span>
                     ) : (
                        <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800 border border-red-200">
                          Incorrect
                        </span>
                     )}
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  {questions.options.map((opt) => {
                    const isSelected = (ans.selected_option_ids || []).includes(opt.label)
                    const isCorrectAnswer = opt.is_correct

                    let bgClass = "bg-white border-gray-200 text-gray-700"

                    if (isSelected && isCorrectAnswer) {
                      bgClass = "bg-green-50 border-green-300 text-green-800 shadow-sm"
                    } else if (isSelected && !isCorrectAnswer) {
                      bgClass = "bg-red-50 border-red-300 text-red-800 shadow-sm"
                    } else if (!isSelected && isCorrectAnswer) {
                      bgClass = "bg-emerald-50 border-emerald-300 text-emerald-800 shadow-sm opacity-75 border-dashed"
                    }

                    return (
                      <div key={opt.label} className={`flex items-center justify-between rounded-md border p-3 ${bgClass}`}>
                         <div className="flex items-center">
                            <span className="font-bold mr-3">{opt.label}.</span>
                            <span>{opt.option_text}</span>
                         </div>
                         <div className="flex gap-2">
                            {isSelected && <span className="text-xs font-semibold px-2 py-1 bg-white/60 rounded">Your Answer</span>}
                            {isCorrectAnswer && <span className="text-xs font-semibold px-2 py-1 bg-white/60 rounded flex items-center"><svg className="h-4 w-4 mr-1 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> Correct Answer</span>}
                         </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-10 flex justify-center pb-4 border-t pt-8">
          <Link
            href="/dashboard"
            className="rounded-md bg-indigo-600 px-8 py-3 text-base font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
