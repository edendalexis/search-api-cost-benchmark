// THE QUESTIONS COME FROM SOMEONE ELSE, AND THEIR ANSWERS MOVE.
//
// The set is FreshQA (Google): questions that require up-to-date knowledge, each
// labelled with how fast its answer changes, with the answers re-checked and
// republished by its authors. We take the ones whose gold is still certified
// valid at run time.
//
// That label is the whole reason this set is here. A benchmark built on settled
// facts can be tuned against once and stays tuned forever — the answer to a
// 2017 trivia question will be the same in 2030. The answer to "which team is
// at the top of the latest Premier League season" will not. Overfitting a
// retrieval stack to a moving target buys nothing, so the score has to come
// from actually going and looking.
//
// A run draws N questions with a seed, keeps only the ones the screening model
// CANNOT already answer from memory, and freezes the result into the run
// directory. From that point the run never touches the source file again.

/**
 * Seeded shuffle order. Same seed, same draw, on any machine — which is what
 * lets somebody add their provider six months from now and land on exactly the
 * questions our published table was scored on.
 */
export function shuffled(items, seed) {
  let a = seed | 0;
  const rand = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = items.slice();
  for (let k = 0; k < out.length; k++) {
    const j = k + Math.floor(rand() * (out.length - k));
    [out[k], out[j]] = [out[j], out[k]];
  }
  return out;
}

/**
 * THE JUDGE — one call, no answer generation.
 *
 * The obvious protocol is two models: one writes an answer from the payload,
 * another grades that answer against the gold. We ran it, and it measured the
 * wrong thing. A reader handed a short payload abstains out of caution, so
 * "I don't know" was recorded as the API's failure rather than the reader's;
 * abstentions tracked payload SIZE, not payload quality (26 on the smallest
 * arm, 3 on the largest). And the reader was not reproducible: gpt-oss-120b
 * changed its own grade on 10% of questions when handed the identical payload
 * twice at temperature 0.
 *
 * So the question is put to the judge directly: is the answer in there. It has
 * the question, the gold and the payload, and it generates nothing — there is
 * no answer to hedge, hallucinate or decline.
 *
 * Measured against the two-step protocol on one arm, 100 questions, same
 * payloads: two-step 48/100, this 61/100, and an audit of every negative by
 * claude-opus-5 put the truth at 62/100. The two-step understated by 14 points,
 * and it understated compact payloads hardest.
 *
 * THE QUOTE IS NOT DECORATION. Requiring the judge to copy out the sentence
 * before ruling makes each YES checkable by hand and by string match: on the
 * published run, every single YES carried a quote found verbatim in the
 * payload. A verdict can be waved through; a citation cannot.
 *
 * What this measures is stated plainly: whether the search API returned the
 * material needed to answer. Not whether one particular model then said so.
 */
export const judgePrompt = (question, gold, payload) =>
  'You are checking whether a search API returned the material needed to answer a question.\n\n'
  + `QUESTION: ${question}\n`
  + `CORRECT ANSWER: ${gold}\n\n`
  + 'Below is the raw payload the API returned. Decide whether a competent reader could derive the '
  + 'correct answer from it — the wording will differ, and a small computation (a date difference, a '
  + 'count, a sum) is allowed. Loose topical relevance is NOT enough: the specific fact must be there.\n\n'
  + 'Reply on two lines, nothing else:\n'
  + 'QUOTE: the exact sentence from the payload that carries the answer, or NONE\n'
  + 'VERDICT: YES or NO\n\n'
  + `PAYLOAD:\n${payload}`;

/** Reads the judge's two lines. An unparseable reply is its own outcome. */
export const readVerdict = (raw) => {
  const v = /VERDICT:\s*(YES|NO)/i.exec(String(raw));
  const q = /QUOTE:\s*(.+)/i.exec(String(raw));
  const quote = q ? q[1].trim().replace(/^["']|["']$/g, '') : '';
  if (!v) return { verdict: 'UNPARSED', quote };
  return { verdict: v[1].toUpperCase() === 'YES' ? 'ANSWERED' : 'MISSED', quote };
};

/**
 * Closed book: what the screening model says with no search results in front of
 * it. A question it already knows measures its memory, not the search API, and
 * is dropped before the run.
 */
export const closedBookPrompt = (question) =>
  'Answer the following question with a short, direct answer. '
  + 'Do not hedge; if you genuinely do not know, reply exactly "I don\'t know".\n\n'
  + `Question: ${question}`;

/** Grades the closed-book answer, for the screen only — never for the run. */
export const screenPrompt = (question, gold, predicted) =>
  'Grade a predicted answer against the gold target. Reply with exactly one letter.\n\n'
  + "A = CORRECT: the prediction contains the gold answer's information. "
  + 'Where several gold targets are given, separated by " | ", matching ANY ONE of them is CORRECT.\n'
  + 'B = INCORRECT: the prediction contradicts the gold target.\n'
  + "C = NOT_ATTEMPTED: the prediction declines or says it doesn't know.\n\n"
  + `Question: ${question}\nGold target: ${gold}\nPredicted answer: ${predicted}\n\n`
  + 'Reply with A, B, or C only.';

export const readScreen = (raw) => {
  const m = String(raw).trim().match(/^[ABC]/);
  return m ? { A: 'CORRECT', B: 'INCORRECT', C: 'NOT_ATTEMPTED' }[m[0]] : 'UNPARSED';
};
