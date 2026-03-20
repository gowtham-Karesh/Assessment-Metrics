'use client'

import { useState } from 'react'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { useRouter } from 'next/navigation'
import { createTestAction, ParsedQuestion } from './actions'

export default function CreateTestPage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [timeLimit, setTimeLimit] = useState<number | ''>('')
  const [file, setFile] = useState<File | null>(null)
  
  const [preview, setPreview] = useState<ParsedQuestion[]>([])
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg('')
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return
    setFile(selectedFile)

    const fileExt = selectedFile.name.split('.').pop()?.toLowerCase()
    
    try {
      if (fileExt === 'csv') {
        parseCSV(selectedFile)
      } else if (fileExt === 'xlsx' || fileExt === 'xls') {
        await parseExcel(selectedFile)
      } else {
        setErrorMsg('Unsupported file format. Please upload a .csv or .xlsx file.')
      }
    } catch (err) {
      setErrorMsg('Error parsing file. Ensure it follows the required format.')
    }
  }

  const parseRow = (row: any): ParsedQuestion | null => {
    // Normalize keys to allow for slight variations
    const normalizeKey = (key: string) => key.toLowerCase().replace(/[\s_]+/g, '')
    const normalizedRow: any = {}
    for (const key in row) {
      if (row.hasOwnProperty(key)) {
        normalizedRow[normalizeKey(key)] = row[key]
      }
    }

    const question = normalizedRow['question'] || normalizedRow['questions']
    const optionA = normalizedRow['optiona'] || normalizedRow['option1']
    const optionB = normalizedRow['optionb'] || normalizedRow['option2']
    const optionC = normalizedRow['optionc'] || normalizedRow['option3']
    const optionD = normalizedRow['optiond'] || normalizedRow['option4']
    const answer = normalizedRow['answer'] || normalizedRow['correctanswer']
    
    if (!question || !optionA || !optionB || !answer) {
      return null
    }

    let typeStr = String(normalizedRow['type'] || normalizedRow['ismultioption'] || 'radio').trim().toLowerCase()
    if (typeStr === 'y' || typeStr === 'yes') typeStr = 'checkbox' // Map 'Y' to checkbox
    const questionType = typeStr === 'checkbox' ? 'checkbox' : 'radio'
    
    // Handle answers: parse commas or semicolons, map "1" -> "A", "2" -> "B", etc.
    let answerStr = String(answer).replace(/;/g, ',')
    const correctAnswers = answerStr.toUpperCase().split(',').map((s: string) => {
      const v = s.trim()
      if (v === '1') return 'A'
      if (v === '2') return 'B'
      if (v === '3') return 'C'
      if (v === '4') return 'D'
      return v
    })

    const options = [
      { label: 'A', text: String(optionA), isCorrect: correctAnswers.includes('A') },
      { label: 'B', text: String(optionB), isCorrect: correctAnswers.includes('B') }
    ]

    if (optionC && String(optionC).trim()) {
      options.push({ label: 'C', text: String(optionC), isCorrect: correctAnswers.includes('C') })
    }
    if (optionD && String(optionD).trim()) {
      options.push({ label: 'D', text: String(optionD), isCorrect: correctAnswers.includes('D') })
    }

    return {
      text: String(question),
      type: questionType as 'radio' | 'checkbox',
      options
    }
  }

  const parseCSV = (file: File) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      complete: (results) => {
        const parsedData: ParsedQuestion[] = []
        results.data.forEach((row: any) => {
          const q = parseRow(row)
          if (q) parsedData.push(q)
        })
        if (parsedData.length === 0) {
          setErrorMsg('No valid questions found. Ensure columns include Question, Option A, Option B, and Answer.')
        } else {
          setErrorMsg('')
        }
        setPreview(parsedData)
      },
      error: () => setErrorMsg('Failed to parse CSV')
    })
  }

  const parseExcel = async (file: File) => {
    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const json = XLSX.utils.sheet_to_json(worksheet)
      
      const parsedData: ParsedQuestion[] = []
      json.forEach((row: any) => {
        const q = parseRow(row)
        if (q) parsedData.push(q)
      })
      if (parsedData.length === 0) {
        setErrorMsg('No valid questions found. Ensure columns include Question, Option A, Option B, and Answer.')
      } else {
        setErrorMsg('')
      }
      setPreview(parsedData)
    } catch (e) {
      setErrorMsg('Failed to parse Excel file')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title || !timeLimit || preview.length === 0) {
      setErrorMsg('Please fill all fields and provide a valid questions file.')
      return
    }

    setLoading(true)
    setErrorMsg('')
    
    const res = await createTestAction(title, Number(timeLimit), preview)
    
    if (res.error) {
      setErrorMsg(res.error)
      setLoading(false)
    } else {
      router.push(`/dashboard`)
    }
  }

  return (
    <div className="mx-auto max-w-3xl rounded-xl border bg-white p-8 shadow-sm">
      <h1 className="mb-6 text-3xl font-bold text-gray-900">Create New Test</h1>
      
      {errorMsg && (
        <div className="mb-6 rounded-md bg-red-50 p-4 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700">Test Title</label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="mt-1 block w-full rounded-md border-gray-300 border p-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              placeholder="e.g. JavaScript Basics"
            />
          </div>
          <div>
            <label htmlFor="timeLimit" className="block text-sm font-medium text-gray-700">Time Limit (minutes)</label>
            <input
              type="number"
              id="timeLimit"
              value={timeLimit}
              onChange={(e) => setTimeLimit(Number(e.target.value))}
              required
              min="1"
              className="mt-1 block w-full rounded-md border-gray-300 border p-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              placeholder="e.g. 15"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Upload Questions (CSV/Excel)</label>
          <div className="mt-2 flex items-center justify-center rounded-lg border border-dashed border-gray-300 px-6 py-10 hover:bg-gray-50">
            <div className="text-center">
              <div className="mt-4 flex text-sm leading-6 text-gray-600">
                <label
                  htmlFor="file-upload"
                  className="relative cursor-pointer rounded-md bg-white font-semibold text-indigo-600 focus-within:outline-none focus-within:ring-2 focus-within:ring-indigo-600 focus-within:ring-offset-2 hover:text-indigo-500"
                >
                  <span>Upload a file</span>
                  <input id="file-upload" name="file-upload" type="file" className="sr-only" accept=".csv, .xlsx, .xls" onChange={handleFileChange} />
                </label>
                <p className="pl-1">or drag and drop</p>
              </div>
              <p className="text-xs leading-5 text-gray-600">CSV, XLSX up to 10MB</p>
            </div>
          </div>
          {file && <p className="mt-2 text-sm text-gray-500">Selected file: {file.name}</p>}
        </div>

        {preview.length > 0 && (
          <div className="rounded-md bg-gray-50 p-4">
            <h3 className="text-md font-medium text-gray-800">Preview</h3>
            <p className="text-sm text-gray-500 mb-4">Successfully parsed {preview.length} questions.</p>
            <ul className="max-h-60 overflow-y-auto space-y-2 border border-gray-200 rounded p-2 bg-white">
              {preview.map((q, i) => (
                <li key={i} className="text-sm text-gray-700 pb-2 border-b last:border-0 last:pb-0">
                  <span className="font-semibold">Q{i + 1}:</span> {q.text} <span className="text-xs text-gray-400 bg-gray-100 rounded px-1 ml-1">{q.type}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={loading || preview.length === 0}
            className="rounded-md bg-indigo-600 px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving Test...' : 'Create Test'}
          </button>
        </div>
      </form>
    </div>
  )
}
