'use client'

import { useState, useEffect } from 'react'
import { submitTestSession } from '@/app/(app)/tests/actions'
import { useRouter } from 'next/navigation'

type Option = { label: string; text: string }
type Question = {
  id: string
  text: string
  type: 'radio' | 'checkbox'
  options: Option[]
}

export default function TestTaker({
  testId,
  sessionId,
  timeLimit,
  startedAt,
  questions,
  initialAnswers = {}
}: {
  testId: string
  sessionId: string
  timeLimit: number
  startedAt: string
  questions: Question[]
  initialAnswers?: Record<string, string[]>
}) {
  const router = useRouter()
  const [answers, setAnswers] = useState<Record<string, string[]>>(initialAnswers)
  const [timeLeft, setTimeLeft] = useState<number>(0)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (isSubmitting) return
    setIsSubmitting(true)

    try {
      await submitTestSession(sessionId, testId, answers)
      router.push(`/results/${sessionId}`)
    } catch (err: unknown) {
      if (err instanceof Error) {
        alert(err.message || 'Error submitting test')
      } else {
        alert('Error submitting test')
      }
      setIsSubmitting(false)
    }
  }

  // Initialize timer
  useEffect(() => {
    const sessionStart = new Date(startedAt).getTime()
    const limitMs = timeLimit * 60 * 1000

    const updateTimer = () => {
      const now = new Date().getTime()
      const elapsed = now - sessionStart
      const remaining = Math.max(0, limitMs - elapsed)
      setTimeLeft(remaining)
    }

    updateTimer()
    const int = setInterval(updateTimer, 1000)
    return () => clearInterval(int)
  }, [startedAt, timeLimit])

  // Auto-submit when time runs out
  useEffect(() => {
    if (timeLeft === 0 && !isSubmitting) {
      handleSubmit()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft])

  const formatTime = (ms: number) => {
    const totalSec = Math.floor(ms / 1000)
    const m = Math.floor(totalSec / 60)
    const s = totalSec % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const toggleOption = (qId: string, label: string, isRadio: boolean) => {
    setAnswers(prev => {
      const current = prev[qId] || []
      if (isRadio) {
        return { ...prev, [qId]: [label] }
      } else {
        if (current.includes(label)) {
          return { ...prev, [qId]: current.filter(l => l !== label) }
        } else {
          return { ...prev, [qId]: [...current, label] }
        }
      }
    })
  }

// Moved handle submit above, so we leave this blank natively

  return (
    <div className="mx-auto max-w-4xl pb-16">
      <div className="sticky top-0 z-10 mb-8 border-b border-gray-200 bg-white px-4 py-4 shadow-sm sm:px-6 flex justify-between items-center rounded-b-xl">
        <h2 className="text-xl font-semibold text-gray-800">
          Knowledge Check
        </h2>
        <div className={`text-2xl font-mono font-bold ${timeLeft < 60000 ? 'text-red-600' : 'text-gray-800'}`}>
          {formatTime(timeLeft)}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {questions.map((q, idx) => (
          <div key={q.id} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              <span className="mr-2 text-indigo-600">{idx + 1}.</span>
              {q.text}
            </h3>
            <div className="space-y-3">
              {q.options.map(opt => {
                const isSelected = (answers[q.id] || []).includes(opt.label)
                const isRadio = q.type === 'radio'
                
                return (
                  <label key={opt.label} className={`flex cursor-pointer items-start rounded-lg border p-4 hover:bg-gray-50 ${isSelected ? 'border-indigo-500 bg-indigo-50/50' : 'border-gray-200'}`}>
                    <div className="flex h-5 items-center">
                      <input
                        type={isRadio ? 'radio' : 'checkbox'}
                        name={`question-${q.id}`}
                        value={opt.label}
                        checked={isSelected}
                        onChange={() => toggleOption(q.id, opt.label, isRadio)}
                        className={`h-4 w-4 ${isRadio ? 'rounded-full' : 'rounded'} border-gray-300 text-indigo-600 focus:ring-indigo-600`}
                      />
                    </div>
                    <div className="ml-3 flex flex-col">
                      <span className="text-sm font-medium text-gray-900">
                        {opt.label}. {opt.text}
                      </span>
                    </div>
                  </label>
                )
              })}
            </div>
          </div>
        ))}

        <div className="flex justify-end border-t border-gray-200 pt-6">
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-indigo-600 px-8 py-3 text-lg font-semibold text-white shadow-sm hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Test'}
          </button>
        </div>
      </form>
    </div>
  )
}
