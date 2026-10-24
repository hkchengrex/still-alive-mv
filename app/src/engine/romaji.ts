// Romaji for the lyrics (Hepburn, lower case, no macrons), from the kana the lyric data keeps per displayed
// character (lyrics.ts: Word.kana). The particles は, へ and を, written alone, read wa, e and o; 々 repeats the
// reading before it; っ doubles the next consonant; ん before a vowel or y is n'; ー lengthens the vowel before it.

const BASE: Record<string, string> = {
  あ: 'a', い: 'i', う: 'u', え: 'e', お: 'o',
  か: 'ka', き: 'ki', く: 'ku', け: 'ke', こ: 'ko', が: 'ga', ぎ: 'gi', ぐ: 'gu', げ: 'ge', ご: 'go',
  さ: 'sa', し: 'shi', す: 'su', せ: 'se', そ: 'so', ざ: 'za', じ: 'ji', ず: 'zu', ぜ: 'ze', ぞ: 'zo',
  た: 'ta', ち: 'chi', つ: 'tsu', て: 'te', と: 'to', だ: 'da', ぢ: 'ji', づ: 'zu', で: 'de', ど: 'do',
  な: 'na', に: 'ni', ぬ: 'nu', ね: 'ne', の: 'no',
  は: 'ha', ひ: 'hi', ふ: 'fu', へ: 'he', ほ: 'ho', ば: 'ba', び: 'bi', ぶ: 'bu', べ: 'be', ぼ: 'bo',
  ぱ: 'pa', ぴ: 'pi', ぷ: 'pu', ぺ: 'pe', ぽ: 'po',
  ま: 'ma', み: 'mi', む: 'mu', め: 'me', も: 'mo', や: 'ya', ゆ: 'yu', よ: 'yo',
  ら: 'ra', り: 'ri', る: 'ru', れ: 're', ろ: 'ro', わ: 'wa', ゐ: 'i', ゑ: 'e', を: 'o', ゔ: 'vu',
};
const SMALL_Y: Record<string, string> = { ゃ: 'a', ゅ: 'u', ょ: 'o' };
const SMALL_V: Record<string, string> = { ぁ: 'a', ぃ: 'i', ぅ: 'u', ぇ: 'e', ぉ: 'o', ゎ: 'a' };
const PARTICLE: Record<string, string> = { は: 'wa', へ: 'e', を: 'o' };
/** 々 repeating a reading with a voiced (or otherwise changed) start: the repeat's reading. */
const REPEAT: Record<string, string> = { 日々: 'び', 人々: 'びと', 様々: 'ざま', 時々: 'どき', 色々: 'いろ', 我々: 'われ', 次々: 'つぎ', 少々: 'しょう', 段々: 'だん', 堂々: 'どう', 刻々: 'こく', 早々: 'そう', 散々: 'ざん' };

/** Katakana to hiragana (ー and anything else left as is). */
const hira = (s: string) => s.replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));

/** A run of kana as romaji. */
export function kanaToRomaji(kana: string): string {
  const k = Array.from(hira(kana));
  const out: string[] = [];
  let geminate = false;
  for (let i = 0; i < k.length; i++) {
    const ch = k[i]!;
    let r: string;
    if (ch === 'っ') { geminate = true; continue; }
    if (ch === 'ー') { const last = out[out.length - 1] ?? ''; out.push(last.slice(-1).match(/[aeiou]/) ? last.slice(-1) : ''); continue; }
    if (ch === 'ん') {
      const next = BASE[k[i + 1] ?? ''] ?? '';
      out.push(/^[aeiouy]/.test(next) ? "n'" : 'n');
      continue;
    }
    if (BASE[ch] !== undefined) {
      r = BASE[ch]!;
      const nx = k[i + 1] ?? '';
      if (SMALL_Y[nx] && r.endsWith('i')) {
        // きゃ kya, しゃ sha, ちゃ cha, じゃ ja
        const stem = r === 'shi' ? 'sh' : r === 'chi' ? 'ch' : r === 'ji' ? 'j' : r.slice(0, -1) + 'y';
        r = stem + SMALL_Y[nx]!;
        i++;
      } else if (SMALL_V[nx]) {
        // ふぁ fa, てぃ ti, うぇ we
        r = (r === 'u' ? 'w' : r === 'tsu' ? 'ts' : r.slice(0, -1)) + SMALL_V[nx]!;
        i++;
      }
    } else if (SMALL_V[ch] || SMALL_Y[ch]) {
      r = SMALL_V[ch] ?? SMALL_Y[ch]!;
    } else {
      r = /[0-9A-Za-z]/.test(ch) ? ch : ''; // digits and Latin as written; brackets and marks dropped
    }
    if (geminate && r) { r = (r.startsWith('ch') ? 't' : r[0]) + r; geminate = false; }
    out.push(r);
  }
  return out.join('');
}

/**
 * A lyric word as romaji: from its kana per character, spaced at its word breaks (`brk`, displayed-character
 * indices from analysis/lyric_breaks.py), a particle は/へ/を written alone always apart; a word without kana as written.
 */
export function wordRomaji(w: { w: string; kana?: string[]; brk?: number[] }): string {
  return romajiParts(w).map((p) => p.r).join(' ');
}

/** The same, as its words, each with the displayed-character index it starts at (to time it to the singing). */
export function romajiParts(w: { w: string; kana?: string[]; brk?: number[] }): { r: string; i: number }[] {
  if (!w.kana || !w.kana.length) return [{ r: w.w, i: 0 }];
  const chars = Array.from(w.w);
  // the reading per character (々 resolved; a reading given for 々 is kept)
  const ks: string[] = [];
  let prev = '';
  w.kana.forEach((k0, i) => {
    const k = k0 === '々' ? REPEAT[(chars[i - 1] ?? '') + '々'] ?? prev : k0;
    ks.push(k);
    prev = k;
  });
  const cuts = new Set(w.brk ?? []);
  chars.forEach((ch, i) => { if (PARTICLE[ch] && ks[i] === ch) { cuts.add(i); cuts.add(i + 1); } });
  const parts: { r: string; i: number }[] = [];
  let run = '', runChars = '', i0 = 0;
  const flush = () => {
    if (run) parts.push({ r: PARTICLE[runChars] && run === runChars ? PARTICLE[runChars]! : kanaToRomaji(run), i: i0 });
    run = ''; runChars = '';
  };
  ks.forEach((k, i) => { if (cuts.has(i)) flush(); if (!run) i0 = i; run += k; runChars += chars[i] ?? ''; });
  flush();
  return parts.filter((p) => p.r);
}
