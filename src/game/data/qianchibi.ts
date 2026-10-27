export interface EvidenceOption {
  text: string;
  correct: boolean;
}

export interface QianChibiStage {
  id: string;
  title: string;
  emotion: string;
  excerpt: string;
  promptWords: string[];
  clues: { label: string; quote: string }[];
  emotionQuestion: string;
  emotionOptions: { text: string; correct: boolean }[];
  emotionHint: string;
  emotionExplanation: string;
  evidenceQuestion: string;
  evidenceOptions: EvidenceOption[];
  evidenceHint: string;
  evidenceExplanation: string;
  summary: string;
}

// Text is aligned to the Taiwan High School Chinese Learning Center entry:
// https://cerclearning.tp.edu.tw/classical/datapage/153
export const QIAN_CHIBI_STAGES: QianChibiStage[] = [
  {
    id: 'moonlit-river',
    title: '月出東山',
    emotion: '開闊自在',
    excerpt: '清風徐來，水波不興。……少焉，月出於東山之上，徘徊於斗牛之間。白露橫江，水光接天。',
    promptWords: ['清風', '水波', '明月', '白露', '江天'],
    clues: [
      { label: '清風', quote: '清風徐來，水波不興。' },
      { label: '明月', quote: '月出於東山之上，徘徊於斗牛之間。' },
      { label: '白露與江天', quote: '白露橫江，水光接天。' },
    ],
    emotionQuestion: '這些景物和「飄飄乎如遺世獨立」一段，帶出哪種感受？',
    emotionOptions: [
      { text: '開闊自在，帶著飄然之感', correct: true },
      { text: '局促焦躁，急著離開江面', correct: false },
      { text: '憤怒不滿，想與客人爭辯', correct: false },
    ],
    emotionHint: '回看「水光接天」和「羽化而登仙」的景象與語氣。',
    emotionExplanation: '江天相接的開闊景象，配上「飄飄乎」「羽化而登仙」的想像，支持自在、飄然的解讀。',
    evidenceQuestion: '選出最能支持這種感受的原文。',
    evidenceOptions: [
      { text: '浩浩乎如馮虛御風，而不知其所止；飄飄乎如遺世獨立，羽化而登仙。', correct: true },
      { text: '哀吾生之須臾，羨長江之無窮。', correct: false },
      { text: '托遺響於悲風。', correct: false },
    ],
    evidenceHint: '找出直接寫出「飄飄」與「登仙」想像的句子。',
    evidenceExplanation: '這句把泛舟感受比作御風、遺世與登仙，直接支持開闊自在的情緒解讀。',
    summary: '先是夜遊赤壁時的開闊自在與飄然之感。',
  },
  {
    id: 'flute-and-guest',
    title: '洞簫聲起',
    emotion: '悲慨低迴',
    excerpt: '於是飲酒樂甚，扣舷而歌之。……客有吹洞簫者，倚歌而和之。其聲嗚嗚然，如怨如慕，如泣如訴；餘音嫋嫋，不絕如縷。',
    promptWords: ['扣舷歌唱', '洞簫', '如怨如慕', '如泣如訴', '餘音'],
    clues: [
      { label: '扣舷而歌', quote: '於是飲酒樂甚，扣舷而歌之。' },
      { label: '洞簫應和', quote: '客有吹洞簫者，倚歌而和之。' },
      { label: '簫聲情緒', quote: '其聲嗚嗚然，如怨如慕，如泣如訴。' },
    ],
    emotionQuestion: '簫聲出現後，這一段的氣氛如何變化？',
    emotionOptions: [
      { text: '由宴飲之樂轉向悲慨低迴', correct: true },
      { text: '由安靜轉向熱鬧喧嘩', correct: false },
      { text: '情緒完全沒有變化', correct: false },
    ],
    emotionHint: '注意簫聲被比作「怨」「慕」「泣」「訴」時，情緒色彩如何改變。',
    emotionExplanation: '前面寫「飲酒樂甚」，接著簫聲「如怨如慕，如泣如訴」，形成由樂轉悲的情緒變化。',
    evidenceQuestion: '哪一句最直接寫出簫聲的悲涼感？',
    evidenceOptions: [
      { text: '其聲嗚嗚然，如怨如慕，如泣如訴；餘音嫋嫋，不絕如縷。', correct: true },
      { text: '月出於東山之上，徘徊於斗牛之間。', correct: false },
      { text: '客喜而笑，洗盞更酌。', correct: false },
    ],
    evidenceHint: '選擇含有「怨」「泣」等聲音感受的句子。',
    evidenceExplanation: '這句以「怨」「慕」「泣」「訴」描寫簫聲，直接支持氣氛轉為悲慨的判斷。',
    summary: '洞簫聲引出客的悲慨，氣氛由樂轉悲。',
  },
  {
    id: 'water-and-moon',
    title: '水月之理',
    emotion: '豁達共享',
    excerpt: '哀吾生之須臾，羨長江之無窮。……蘇子曰：「客亦知夫水與月乎？逝者如斯，而未嘗往也；盈虛者如彼，而卒莫消長也。」',
    promptWords: ['蜉蝣', '長江', '水月', '清風', '明月'],
    clues: [
      { label: '生命短暫', quote: '哀吾生之須臾，羨長江之無窮。' },
      { label: '水的變與不變', quote: '逝者如斯，而未嘗往也。' },
      { label: '月的盈與虛', quote: '盈虛者如彼，而卒莫消長也。' },
    ],
    emotionQuestion: '蘇子談水月後，文章的心境走向哪裡？',
    emotionOptions: [
      { text: '從悲慨轉向豁達，並看見共享自然之樂', correct: true },
      { text: '更加執著於人生短暫與失落', correct: false },
      { text: '轉為憤怒，責怪客人掃興', correct: false },
    ],
    emotionHint: '比較客的「哀」「羨」與蘇子談完水月後「客喜而笑」的變化。',
    emotionExplanation: '蘇子用水月說明變化與不變，接著指出清風明月可以共享；結尾寫客人喜而笑，呈現由悲慨轉向豁達。',
    evidenceQuestion: '選出最能支持「共享自然之樂」的原文。',
    evidenceOptions: [
      { text: '惟江上之清風，與山間之明月，耳得之而為聲，目遇之而成色；取之無禁，用之不竭。', correct: true },
      { text: '哀吾生之須臾，羨長江之無窮。', correct: false },
      { text: '其聲嗚嗚然，如怨如慕，如泣如訴。', correct: false },
    ],
    evidenceHint: '找出同時提到江上清風、山間明月，以及可取用不竭的句子。',
    evidenceExplanation: '蘇子將清風明月視為可由彼此共享的自然之樂，和客最後「喜而笑」相呼應。',
    summary: '蘇子借水月回應客的悲慨，最後轉向豁達與共享。',
  },
];
