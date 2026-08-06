# Method

Every rule here exists because something was measured. Where a number appears, it was
read off a live endpoint, a vendor's own pricing page, or the run's own artifacts.

---

## 1. What is being measured

A search API bills you twice.

Once at the door, per request, which is the number on the pricing page. Then again, per
token, when its payload lands in your agent's context window. Nobody prints that second
invoice, and for most providers here it is the larger of the two.

```
tokens_per_query = mean prompt_tokens billed to read this arm's payload
llm_$_per_1k     = tokens_per_query x 1000 x input_price / 1e6
api_$_per_1k     = price at the door (see §6)
total_$_per_1k   = api_$_per_1k + llm_$_per_1k
$_per_correct    = total_$_per_1k / (1000 x correct_rate)
```

A cheap request that brings back nothing usable is not cheap. It is wasted.

The cost columns and the quality column are read differently, and the tables say so. At
n=100 the cost figures are exact arithmetic on measured quantities. The quality figures
carry a confidence interval of roughly ±6 points at 90% and ±10 at 60%, which is wider
than most of the gaps in that column.

---

## 2. The questions

**Source: [FreshQA](https://github.com/freshllms/freshqa) (Google), version
2026-04-21.** We did not write the questions, cannot edit them, and the release is
public. Check what we drew.

**Selection is on `next_review`, not on `fact_type`.** FreshQA states, per question,
when its answer will next need re-checking: a date for some, `frequently` or
`occasionally` for others. A question is kept only if that review date is still ahead of
the run, or the authors marked it as rarely moving. `never-changing` and false-premise
questions are excluded.

Filtering on `fact_type: fast-changing` instead is a trap we fell into and measured: it
scoops up the `frequently` bucket and hands you a gold that expired weeks ago. On a run
built that way, 28 of 100 questions had every arm fail together, converging on a newer
answer than the gold. The engines were right and the file was old.

**A benchmark of settled facts can be tuned against once and stays tuned forever.** The
answer to a 2017 trivia question will be the same in 2030. The answer to "which team is
top of the latest Premier League season" will not. Overfitting a retrieval stack to a
moving target buys nothing, so the score has to come from actually going and looking.
This is the property the industry-standard static sets do not have, and it is why the
numbers here differ from the ones vendors publish about themselves.

**Closed-book screen.** Every candidate is put to a model with no search results in
front of it. If it already knows the answer, the question is dropped: it would be
measuring memory instead of the search API. On the published run, 33 of 140 screened
went that way, and the count is in `questions.json`.

**The set is small, and that is a real limit.** After the `next_review` filter, the
false-premise exclusion and the closed-book screen, the TEST split does not yield many
more than a hundred usable questions. n=100 is a ceiling, not a choice.

**Replacement, and why it is not cherry-picking.** A question the field cannot settle
(§3) cannot be scored. Dropping it silently would leave the run short, which is how a
hundred-question benchmark quietly became seventy-nine on an earlier attempt. So the run
loops: any unsettled question is replaced by a fresh draw **of the same `fact_type`**,
never one already drawn, and the loop runs until the full hundred stand. The published
run replaced 21 questions.

The audit trail matters more than the rule. The payloads of every replaced question are
left in `raw/`, which is why there are 125 payloads per arm for 100 scored questions,
and `questions.json` records the substitution. Nothing was removed because an arm did
badly on it: the replacement rule fires on the field failing to agree, before any arm is
scored, and it fires on all arms at once.

---

## 3. The answer key of the day

This is the part of the protocol that is unusual, so it gets the most space.

### The problem

FreshQA's answers were last republished on 2026-04-21 and the announced May update never
arrived. By August, on **13 of the 100 questions in this run**, every arm converged on
one answer and the frozen key rejected all of them:

| question | April key | what the field found |
|---|---|---|
| most recent former UK Prime Minister | Rishi Sunak | Keir Starmer |
| most recent woman to become President of Peru | Dina Boluarte | Keiko Fujimori |
| when did the latest NFL season begin | Sep 4, 2025 | September 9, 2026 |
| latest Nebula award for Best Novel | Someone You Can Build a Nest In | The Buffalo Hunter Hunter |
| most recent public health emergency of international concern | Clade I mpox | Bundibugyo Ebola outbreak |

Graded against the April key, **every arm in this benchmark loses between 8 and 18
points**, mean 13. The arms that lose most are the ones that are most up to date. A
time-sensitive benchmark with a frozen answer key measures how old your index is, not
how good it is, and it punishes the freshest engine hardest.

### The design

There is no neutral referee to appeal to. Checking a fresh fact requires a search
engine, which is the thing under test. So the referee is the field.

**Step one, the reader.** Every arm's payload is put to one model, alone, with the
question and nothing else. It never sees a recorded answer, so it cannot recite a gold it
was not given, only report what its own payload says. It may reply that the results do
not settle the question.

**Step two, the arbiter.** A stronger model sees the answers and never the payloads, and
decides what the field agrees on. It is told that differences of wording, precision or
format count as agreement, that an abstention is not a vote, and that if the systems
genuinely disagree about the fact, or if fewer than half of those that answered agree, it
must refuse to pick a winner. A refusal drops the question and triggers a replacement.

Three properties make this a measurement rather than a circle: the reader cannot see what
it is supposed to say, the key is built from every provider equally so no competitor is
the judge, and disagreement is reported rather than resolved by force.

### One vote per provider

A vendor selling three tiers would otherwise cast three votes, and the maintainer of this
benchmark sells three. That is exactly the objection a reader should raise, so the
electorate is capped at one voice per provider, its most advanced configuration. On the
published run that is eight voters:

`brave-search`, `exa-search`, `firecrawl-search`, `linkup-standard`,
`parallel-advanced`, `serpdive-moby`, `tavily-advanced`, `you-web`

Every arm is still read and still scored against what those eight decide. Only the
electorate is capped. The list is in `gold-meta.json` for each run, next to the key it
produced.

### Where the field agrees

On the published run, 61 questions were unanimous at 8/8 and 13 more stood at 7/8. Of
the questions where some system abstained, 13 were still unanimous among those that
answered. The weakest accepted margin was 3/4. The vote and a one-line reason are
recorded per question in `gold-today.json`.

### Where this design fails, with the case from this run

The field follows what the pages say, and the pages can agree on something that does not
answer the question asked.

> **"What is the current age of the oldest person to sail solo across the Pacific
> Ocean?"**
> Eight systems answered *83 years old*. One, `serpdive-moby`, answered *Kenichi Horie is
> currently 87 years old*. The key became 83.

83 is the age Horie was **during the voyage**, which is what almost every page about him
says. The question asks his current age. The April key said 87 and was right, the field
was wrong, and the one arm that read the question correctly was marked incorrect for it.

That case is the maintainer's own arm, which makes it comfortable to disclose and does
not make it less of a defect. It is left uncorrected in the published numbers, because
hand-editing a key after seeing which arm it penalises is a worse protocol than a key
with a known error rate. **Read the quality column knowing that roughly one question in a
hundred can be wrong in this direction**, on top of the sampling interval.

The same failure has a milder form: when the field lags reality, the key follows the lag.
Two guards are in place. An abstention is never counted as agreement, and a question
below half agreement among those that answered is dropped rather than decided.

### What it costs

Under a dollar per run of 100 questions. The reader is the cheap model and the arbiter is
the expensive one, and they are split that way on measurement: on seventeen real
judgements the reasoning model cost 5.7x and changed one verdict, correctly. It is worth
its price exactly where a single error contaminates the key for every competitor, and
nowhere else.

---

## 4. Grading

Once the key exists, every arm's reader has already said what it found. Grading is
therefore comparing two short strings, which the **SimpleQA protocol** does in one cheap
call per arm per question: CORRECT, INCORRECT, or NOT_ATTEMPTED.

Both keys are graded and both are published: `correct_rate` against the answer of the
day, `correct_rate_april` against the frozen FreshQA key. The gap between the two columns
is not noise, it is what staleness costs each engine.

**The known bias of this protocol.** A reader handed a thin payload sometimes abstains
out of caution, and the abstention is recorded against the API rather than against the
reader. Abstentions do correlate with payload size:

| arm | tokens | correct | incorrect | not attempted |
|---|---:|---:|---:|---:|
| serpdive-krill | 604 | 78 | 7 | **15** |
| serpdive-mako | 1,186 | 88 | 5 | 7 |
| tavily-basic | 1,949 | 88 | 8 | 4 |
| parallel-turbo | 2,487 | 79 | 12 | 9 |
| linkup-standard | 9,838 | 85 | 3 | **12** |
| brave-search | 30,933 | 93 | 5 | 2 |
| exa-search | 40,226 | 93 | 5 | 2 |

The smallest arm abstains most and the two largest abstain least, so **part of the
quality column is a size effect and not a retrieval effect**. It is not a clean function
of size either: `tavily-basic` at 1,949 tokens abstains four times while
`linkup-standard` at five times the volume abstains twelve. The run does not correct for
this, and the raw counts are published so you can.

Tokens in this table are the reader's count, before the conversion in §5.

---

## 5. Tokens

**The token figure is an invoice, not an estimate.** `bin/tokens.mjs` sends every payload
once with a one-token cap and records the `prompt_tokens` the call was charged. No
tokenizer library, no `length / 4`.

**But it is charged on our reader, and you will pay a different model.** A token is not a
universal unit, and repricing is not a multiplication by a price ratio, because the count
itself changes. There is no public Anthropic tokenizer, so `bin/reprice.mjs` obtains the
count the only honest way available: it sends real payloads to both models and measures
the ratio, **per arm**, because a JSON envelope thick with punctuation and a page of prose
do not tokenize alike. Measured on this run:

| | ratio to `claude-sonnet-5` |
|---|---:|
| `firecrawl-search` | 1.468 |
| `brave-search` | 1.552 |
| `parallel-advanced` | 1.575 |
| `serpdive-mako` | 1.594 |
| `serpdive-krill` | 1.607 |
| `you-web` | 1.622 |
| `tavily-advanced` | 1.623 |
| `tavily-basic` | 1.624 |
| `exa-search` | 1.629 |
| `parallel-basic` | 1.630 |
| `linkup-standard` | 1.642 |
| `serpdive-moby` | 1.669 |
| `parallel-turbo` | 1.671 |

Mean 1.608, and the spread between arms is 14%, which is why one global factor is not
used. Sampling three payloads per arm rather than retokenising everything is a cost
decision stated rather than hidden: the full corpus is about 14M tokens, which is $42 at
Sonnet's input rate, while 39 payloads cost about two dollars. Every measured pair is in
`reprice.json`, including the per-arm spread.

The published `tokens_per_query` is therefore the Sonnet count. `results.json` also
carries `tokens_per_query_reader` and `reprice_ratio`, so the conversion is visible and
reversible. **Do not multiply it again.**

Priced on a different model, the ranking between arms does not move. Only the scale does.

---

## 6. Prices

Every figure in [`pricing.json`](./pricing.json) carries a `source` URL and a `checked`
date. A stale line is a bug. Open an issue.

**List pay-as-you-go, always.** Where a vendor publishes a per-request rate with no
commitment, that is the rate used. Volume discounts, annual commitments and promotional
rates are ignored **for every vendor, including the maintainer's own**: SERPdive is priced
at its $7/1k list rate, not the $5/1k promotion running at the time of the run.

**Where there is no pay-as-you-go rate**, the fallback is the cheapest paid plan consumed
in full: `usd_per_month / (units_per_month / units_per_request) * 1000`. That is the most
favourable reading for the vendor. A plan you do not exhaust costs more per request than
what is shown.

**Self-reported consumption wins.** Several APIs state what they billed inside their own
payload: Exa returns `costDollars.total`, Firecrawl returns `creditsUsed`. Where the field
exists the run reads it per request instead of assuming one unit. This is not a detail:
Firecrawl charges 2 credits per search, so an assumed 1 would have understated its price
by half. Each vendor meters itself. We never meter a vendor.

**A missing price is not a free arm.** An arm with no entry in `pricing.json` is reported
unranked. Reading the absent field as zero is what once published Firecrawl at $0.00 and
put it at the top of a cost ranking, and the guard against it is now in `score.mjs`.

**One arm is priced at $0.00 at the door**, `serpdive-krill`, because it costs zero
credits on every plan of its vendor, free or paid. That is its list price and not a
promotion, so it stays in the ranking rather than being quietly excluded, but it is marked
in the table and in the chart. Its payload still costs $2.91 per thousand queries to read,
and it has the lowest quality score of the three arms its vendor sells.

**Free tiers are listed for information and never used in the cost figures.** Every vendor
here has one, so ranking on them would rank nothing.

---

## 7. The arms

**An arm is a vendor in one priced configuration.** `tavily-basic` and `tavily-advanced`
do not cost the same and do not return the same volume of tokens, so they are two arms.
That is the unit you are billed on, so it is the unit measured.

Where a vendor publishes several priced modes, they are all here. Parallel's Search API
has three, `turbo`, `basic` and `advanced`, so it has three arms, exactly as Tavily's two
depths have two. Leaving one out because it is inconvenient would make the field a choice
rather than a measurement.

**Every arm runs its vendor's documented default.** No tuning, no result-count
normalisation, no format flags. If one default returns ten results and another returns
five, that difference is the product decision, and pricing it is the point.

**Payloads ship verbatim**, minus each vendor's own synthesis where it exists (`verdict`
for SERPdive, `answer` for Tavily). The same rule on both sides, because this compares the
material returned, not the summarisers.

**A vendor's deeper mode is not always measurable.** Linkup publishes `depth: deep` at
$0.05 a search against `standard`'s $0.005, and it is genuinely a different engine: 7.0 s
against 2.0 s, more results, more tokens. It is still absent, because its cache is
depth-blind. On the same query, the second call returns the first one's payload byte for
byte, in either order, in three probes of four, while still charging and still spending its
own latency. Measuring both depths over one question set is therefore impossible, and
splitting the questions between them would break the one thing that makes every arm
comparable, which is that all arms answer the same 100. Tavily's cache behaves the same
way, which is why calls within a vendor are ordered cheapest first.

---

## 8. Failures

**A call that fails is still a request you paid for.** HTTP 5xx or a timeout is counted in
the denominator and its answer is NOT_ATTEMPTED. An unstable API should be penalised, not
excused by exclusion.

**Sequential, one call in flight per arm.** Latency is measured on its own on the wire, and
a vendor's rate limiter is never the thing being benchmarked.

**Resume is by payload, not by journal.** A payload already on disk is already collected.
Trusting only the run journal meant a run whose `raw/` had been reused paid for thirteen
hundred calls it did not need.

---

## 9. What this does not prove

**That the payloads are authentic.** No hash can prove that. A dishonest maintainer could
fabricate a competitor's response. The countermeasure is not cryptographic: the raw
payloads are in this repository, the questions are frozen before collection, and anyone
with keys can re-run the whole thing and compare. Do that rather than trust this.

**That the quality column separates the top arms.** It does not, at n=100. Read it with
§1's interval.

**That this is your workload.** These are single-shot factual questions whose answers
move. An agent that issues follow-up queries, or works a domain the set does not cover,
will see a different ranking. The cost mechanism generalises. The specific numbers belong
to this profile.

**That a correct reading is a correct agent.** This measures what came back and whether a
reader could state the answer from it. Your model, your prompt and your extraction are
separate variables, and large ones.

---

## Disclosure

Maintained by the author of SERPdive, which is three of the thirteen arms.

SERPdive is priced at its list rate rather than the promotion running at the time. Its
most advanced tier casts exactly one vote in the answer key, like every other provider.
Its results are published as they came out, including `serpdive-moby` finishing eleventh
of thirteen on cost, and including the one documented case in §3 where the consensus key
is wrong and the arm it penalises is ours.

Every payload, every grade, every price and the answer key itself are in this repository.
