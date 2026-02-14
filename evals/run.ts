/**
 * Eval runner entry point.
 * pnpm run eval       - runs evals against Worker (Cloudflare Workers AI). Set EVAL_WORKER_URL (e.g. http://localhost:8787) and run wrangler dev.
 * pnpm run eval:ci    - runs with rule-based/mock in Node (EVAL_USE_MOCK=1), no Worker needed.
 *
 * Threshold: each eval must score >= 7.0/10 to pass. Fail CI if any metric drops below.
 * Set EVAL_OUTPUT_FILE=evals/results.json to write results for regression tracking.
 * Set EVAL_ADMIN_SECRET if your Worker requires Bearer auth for /admin/run-eval.
 */
import { writeFileSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const THRESHOLD = 7.0 / 10
const useMock = process.env.EVAL_USE_MOCK === '1' || process.env.EVAL_USE_MOCK === 'true'
const workerUrl = process.env.EVAL_WORKER_URL?.replace(/\/$/, '')

const CHUNK_SIZE = 6 // avoid worker timeout: each chunk does N LLM calls; 6 * ~3s = ~18s

type EvalFailure =
  | { message: string; expected: string; got: string }
  | { message: string; expected: unknown; got: unknown }
  | { query: string; expectedMatch: string | null; shouldMatch: boolean; got: string | null }

async function runEvalViaWorker(
  evalType: 'intent' | 'food_parsing' | 'vector_search',
  dataset: unknown[]
): Promise<{ passed: boolean; score: number; error?: string; failures?: EvalFailure[] }> {
  const url = `${workerUrl}/admin/run-eval`
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (process.env.EVAL_ADMIN_SECRET) headers['Authorization'] = `Bearer ${process.env.EVAL_ADMIN_SECRET}`

  const doOne = async (chunk: unknown[]): Promise<{ passed: boolean; score: number; error?: string; failures?: EvalFailure[] }> => {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ eval: evalType, dataset: chunk }),
    })
    const text = await res.text()
    let data: { passed?: boolean; score?: number; error?: string; failures?: EvalFailure[] }
    try {
      data = JSON.parse(text) as { passed?: boolean; score?: number; error?: string; failures?: EvalFailure[] }
    } catch {
      const snippet = text.startsWith('<') ? 'HTML error page' : text.slice(0, 200)
      return { passed: false, score: 0, error: `Worker returned non-JSON (${res.status}): ${snippet}` }
    }
    if (!res.ok) return { passed: false, score: 0, error: data.error || res.statusText }
    return { passed: data.passed ?? false, score: data.score ?? 0, error: data.error, failures: data.failures }
  }

  if (dataset.length <= CHUNK_SIZE) {
    return doOne(dataset)
  }
  const chunks: unknown[][] = []
  for (let i = 0; i < dataset.length; i += CHUNK_SIZE) {
    chunks.push(dataset.slice(i, i + CHUNK_SIZE))
  }
  const chunkResults: { passed: boolean; score: number; error?: string; failures?: EvalFailure[] }[] = []
  for (const chunk of chunks) {
    const r = await doOne(chunk)
    chunkResults.push(r)
    if (r.error) return { passed: false, score: 0, error: r.error }
  }
  const totalScore = chunkResults.reduce((sum, r, i) => sum + (r.score ?? 0) * chunks[i].length, 0)
  const totalCount = dataset.length
  const score = totalScore / totalCount
  const passed = score >= THRESHOLD
  const failures = chunkResults.flatMap((r) => r.failures ?? [])
  return { passed, score, failures: failures.length ? failures : undefined }
}

async function main() {
  const results: { name: string; passed: boolean; score?: number; error?: string; failures?: EvalFailure[] }[] = []

  if (useMock) {
    console.log('Running evals with rule-based / mock (CI mode)')
    try {
      const { runIntentClassificationEval } = await import('./intent-classification.eval')
      const r1 = await runIntentClassificationEval(true)
      results.push({ name: 'intent-classification', passed: r1.passed, score: r1.score, error: r1.error })
    } catch (e) {
      results.push({ name: 'intent-classification', passed: false, error: String(e) })
    }
    try {
      const { runFoodParsingEval } = await import('./food-parsing.eval')
      const r2 = await runFoodParsingEval(true)
      results.push({ name: 'food-parsing', passed: r2.passed, score: r2.score, error: r2.error })
    } catch (e) {
      results.push({ name: 'food-parsing', passed: false, error: String(e) })
    }
    try {
      const { runVectorSearchEval } = await import('./vector-search.eval')
      const r3 = await runVectorSearchEval(true)
      results.push({ name: 'vector-search', passed: r3.passed, score: r3.score, error: r3.error })
    } catch (e) {
      results.push({ name: 'vector-search', passed: false, error: String(e) })
    }
  } else if (workerUrl) {
    console.log('Running evals via Worker (Cloudflare Workers AI) at', workerUrl)
    const datasetsDir = join(__dirname, 'datasets')
    try {
      const intentData = JSON.parse(readFileSync(join(datasetsDir, 'intent-classification.json'), 'utf-8'))
      const r1 = await runEvalViaWorker('intent', intentData)
      results.push({ name: 'intent-classification', passed: r1.passed, score: r1.score, error: r1.error, failures: r1.failures })
    } catch (e) {
      results.push({ name: 'intent-classification', passed: false, error: String(e) })
    }
    try {
      const foodData = JSON.parse(readFileSync(join(datasetsDir, 'food-parsing.json'), 'utf-8'))
      const r2 = await runEvalViaWorker('food_parsing', foodData)
      results.push({ name: 'food-parsing', passed: r2.passed, score: r2.score, error: r2.error, failures: r2.failures })
    } catch (e) {
      results.push({ name: 'food-parsing', passed: false, error: String(e) })
    }
    try {
      const vectorData = JSON.parse(readFileSync(join(datasetsDir, 'vector-search.json'), 'utf-8'))
      const r3 = await runEvalViaWorker('vector_search', vectorData)
      results.push({ name: 'vector-search', passed: r3.passed, score: r3.score, error: r3.error, failures: r3.failures })
    } catch (e) {
      results.push({ name: 'vector-search', passed: false, error: String(e) })
    }
  } else {
    console.error('Set EVAL_WORKER_URL (e.g. http://localhost:8787) and run "wrangler dev", then "pnpm run eval". Or use "pnpm run eval:ci" for mock.')
    process.exit(1)
  }

  const report = {
    timestamp: new Date().toISOString(),
    useMock,
    workerUrl: workerUrl || undefined,
    threshold: THRESHOLD,
    results,
    passed: results.every((r) => r.passed),
  }
  console.log(JSON.stringify({ results: report.results }, null, 2))
  const summary = results.map((r) => `${r.name}: ${r.passed ? 'PASS' : 'FAIL'}${r.score != null ? ` (${(r.score * 100).toFixed(0)}%)` : ''}`).join(' | ')
  console.log('Summary:', summary)

  for (const r of results) {
    if (r.failures?.length) {
      console.log('\nFailed cases for', r.name + ':')
      for (const f of r.failures) {
        if ('query' in f) {
          console.log('  -', JSON.stringify(f.query), '| shouldMatch:', f.shouldMatch, '| expected:', f.expectedMatch, '| got:', f.got)
        } else if (r.name === 'intent-classification') {
          console.log('  -', JSON.stringify(f.message), '→ expected:', f.expected, 'got:', f.got)
        } else {
          console.log('  -', JSON.stringify(f.message))
          console.log('    expected:', JSON.stringify(f.expected))
          console.log('    got:     ', JSON.stringify(f.got))
        }
      }
    }
  }

  const outputPath = process.env.EVAL_OUTPUT_FILE
  if (outputPath) {
    const abs = join(process.cwd(), outputPath)
    writeFileSync(abs, JSON.stringify(report, null, 2), 'utf-8')
    console.log('Wrote report to', abs)
  }

  process.exit(report.passed ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
