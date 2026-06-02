/**
 * Curated 5-letter vocabulary for Auravord — workplace communication, delivery, and leadership.
 * Daily solutions are drawn only from {@link WORDLE_SOLUTIONS}. Guesses accept standard English five-letter
 * words from `five-letter-allowlist.json` (derived from dwyl/english-words `words_alpha`) plus any solution.
 */
import fiveLetterAllowlist from "./five-letter-allowlist.json";

const RAW = `
adapt agile align argue audio aware basic bench board boost brain brand brave brief bring broad build
cabin carry catch chair chart chase chose claim class clean clear clerk click climb close coach coast
color coral count court cover craft crash crawl cream crime crisp cross crowd crown curve dance death
debit defer delay delta dense depth digit diner draft drain drama drawn dread dream dress drove eager
early earth eight elite email embed enact enjoy enter entry envoy epoch equal equip erect error erupt
essay ethos every exact excel exert exist extra faint faith false favor feast fence ferry fever fewer
fiber field fifth fifty fight final first flame flash fleet flesh float flock floor fluid focus forge
forth forty forum found frame frank fraud fresh front froze fruit fully gauge ghost giant given giver
gloss glove grace grade grand grant grape graph grasp grass grave great greed green greet grief grill
group grown guard guest guide guild habit happy harsh haste hatch heard heart heavy hello hence honor
horse hotel house human humor ideal image imply index inner input issue joint judge juice label labor
large laser later latch layer learn lease least leave legal lemon level lever light limit linen liner
lobby local logic loose lower loyal lucid lucky lumen lyric major maker march match maybe medal media
merit merry metal meter micro might minor model money month moral motor mount music naval nerve never
newer night noble noise north notch novel nurse occur ocean offer often olive onion opera orbit order
other ought owner oxide paint panel paper party paste patch pause peace peach penal penny perch phase
phone photo piano piece pilot pitch pivot place plain plane plant plate plaza pluck point polar porch
power press price pride prime print prior prize probe proof prose proud prove pulse punch pupil purge
purse queen query quest queue quiet quilt quote radar radio raise rally range rapid ratio reach react
ready realm rebel refer relay relic renew reply reset retry revel rhyme rider ridge rifle right rigid
rival river rivet robot rocky rogue rough round route royal rural rusty safer saint salad salon salsa
sandy satin sauce savor scale scalp scare scarf scene scent scope score scour scout seize sense serve
setup seven sever shade shady shaft shake shape share shark sharp shave shelf shell shift shine shiny
shirt shock shoot shore short shout shown shrug sight sigma silly since skill slate slave sleep slick
slide slope small smart smash smell smile smoke snack snake sneak sober solid solve sorry sound south
space spare spark speak speed spell spend spent spice spicy spike spill spine split spoil spoke spoon
sport spray squad stack staff stage stain stake stale stamp stand stare stark start state steam steel
steep steer stick stiff still sting stock stone stood stool stoop store storm story stout stove strap
straw stray strip stuck study stuff style sugar suite super surer surge sushi swamp swarm swear sweat
sweep sweet swell swept swift swing swirl sword table taboo tacit taken taker tally taper tardy taste
teach teary tempo tenet tenor tense tenth terra terse thank theft theme there these thick thief thigh
thing think third those three threw thumb tidal tiger tight timer timid title toast today token tonic
tooth topic torch total touch tough tower toxic trace track trade trail train trait trash treat trend
trial tribe trick tried trite troll troop trout truce truck truly trunk trust truth tulip tutor tweak
tweet twice twine twist ultra uncle under union unite unity until upper upset urban usage usual utter
vague valid valor value valve vault venue verge verse video vigil vigor vinyl viral virus visit vista
vital vivid vocal vodka vogue voice vomit voter vouch wager wagon waist waste watch water weave wedge
weigh weird whale wheat wheel where which while white whole widen wider widow width wield woman women
world worry worse worst worth would wound woven write wrong wrote yacht yearn yeast yield young youth
zesty zonal
`;

const parsed = [...new Set(RAW.split(/\s+/).filter((w) => /^[a-z]{5}$/.test(w)))].sort((a, b) =>
  a.localeCompare(b),
);

if (parsed.length < 80) {
  throw new Error(`WORDLE_SOLUTIONS: expected at least 80 five-letter words, got ${parsed.length}`);
}

export const WORDLE_SOLUTIONS: readonly string[] = parsed;

/** Anchor for puzzle # — same calendar day worldwide (UTC). */
export const WORDLE_EPOCH_UTC_MS = Date.UTC(2025, 0, 1);

/** All valid guess words: English alphabet words (dwyl/english-words `words_alpha`) plus curated solutions. */
const GUESS_ALLOW_SET = new Set<string>(fiveLetterAllowlist as string[]);
for (const w of WORDLE_SOLUTIONS) GUESS_ALLOW_SET.add(w);

function hashDayKey(ymd: string): number {
  let h = 2166136261;
  for (let i = 0; i < ymd.length; i++) {
    h ^= ymd.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h >>> 0);
}

/** YYYY-MM-DD in UTC for deterministic daily rotation. */
export function getUtcDateKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Daily solution word — identical for every player on the same UTC calendar day.
 */
export function getDailyWord(date: Date = new Date()): string {
  const ymd = getUtcDateKey(date);
  const idx = hashDayKey(ymd) % WORDLE_SOLUTIONS.length;
  return WORDLE_SOLUTIONS[idx]!;
}

/** 1-based puzzle index for share cards (days since epoch + 1). */
export function getDailyPuzzleNumber(date: Date = new Date()): number {
  const start = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const days = Math.floor((start - WORDLE_EPOCH_UTC_MS) / 86_400_000);
  return Math.max(1, days + 1);
}

/** True if `word` is a valid five-letter English dictionary guess (solutions pool is separate). */
export function isAllowedGuess(word: string): boolean {
  return GUESS_ALLOW_SET.has(word.toLowerCase());
}

export const WORD_LENGTH = 5;
export const MAX_GUESSES = 6;
