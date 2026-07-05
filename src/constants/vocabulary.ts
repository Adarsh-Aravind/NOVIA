export interface VocabWord {
  word: string;
  meaning: string;
  example: string;
}

/**
 * Offline daily-vocabulary deck. The "word of the day" is chosen deterministically
 * from the day-of-year so both partners always see the same word (see getWordOfDay).
 * Keep entries partner-friendly and generally useful.
 */
export const VOCABULARY: VocabWord[] = [
  { word: 'Serendipity', meaning: 'A pleasant surprise; finding something good without looking for it.', example: 'Meeting you was pure serendipity.' },
  { word: 'Ephemeral', meaning: 'Lasting for a very short time.', example: 'The sunset was ephemeral but unforgettable.' },
  { word: 'Cherish', meaning: 'To protect and care for someone lovingly.', example: 'I cherish every quiet morning with you.' },
  { word: 'Eloquent', meaning: 'Fluent and persuasive in speaking or writing.', example: 'Her eloquent toast moved the whole room.' },
  { word: 'Resilient', meaning: 'Able to recover quickly from difficulties.', example: 'We are resilient when we face problems together.' },
  { word: 'Wanderlust', meaning: 'A strong desire to travel and explore the world.', example: 'Our shared wanderlust keeps the map full of pins.' },
  { word: 'Solace', meaning: 'Comfort in a time of distress or sadness.', example: 'Your voice is my solace after a hard day.' },
  { word: 'Luminous', meaning: 'Full of or shedding light; radiant.', example: 'Her smile was luminous across the café.' },
  { word: 'Candor', meaning: 'The quality of being open and honest.', example: 'I appreciate the candor in our conversations.' },
  { word: 'Nostalgia', meaning: 'A sentimental longing for the past.', example: 'That song fills me with nostalgia for our first trip.' },
  { word: 'Endeavor', meaning: 'To try hard to achieve something; an attempt.', example: 'We endeavor to be kinder every single day.' },
  { word: 'Gregarious', meaning: 'Fond of company; sociable.', example: 'He is gregarious and makes friends everywhere.' },
  { word: 'Meticulous', meaning: 'Showing great attention to detail.', example: 'She is meticulous when planning our weekends.' },
  { word: 'Benevolent', meaning: 'Kind, well-meaning, and generous.', example: 'Their benevolent gesture surprised us both.' },
  { word: 'Tranquil', meaning: 'Calm, peaceful, and quiet.', example: 'The lake was tranquil at dawn.' },
  { word: 'Vivid', meaning: 'Producing strong, clear images in the mind.', example: 'I still have vivid memories of that evening.' },
  { word: 'Amiable', meaning: 'Having a friendly and pleasant manner.', example: 'Your amiable nature puts everyone at ease.' },
  { word: 'Fortitude', meaning: 'Courage in pain or adversity.', example: 'She handled the news with quiet fortitude.' },
  { word: 'Whimsical', meaning: 'Playfully quaint or fanciful.', example: 'He left me a whimsical little note in my bag.' },
  { word: 'Empathy', meaning: 'The ability to understand another’s feelings.', example: 'Empathy is the heart of a strong relationship.' },
  { word: 'Radiant', meaning: 'Sending out light; shining brightly.', example: 'You looked radiant at the celebration.' },
  { word: 'Diligent', meaning: 'Showing careful and persistent effort.', example: 'He is diligent about our shared savings goals.' },
  { word: 'Buoyant', meaning: 'Cheerful and optimistic.', example: 'Her buoyant mood lifted the whole trip.' },
  { word: 'Sincere', meaning: 'Free from pretense; genuine.', example: 'A sincere apology can mend almost anything.' },
  { word: 'Idyllic', meaning: 'Extremely happy, peaceful, or picturesque.', example: 'We spent an idyllic afternoon by the sea.' },
  { word: 'Astute', meaning: 'Having sharp, accurate judgment.', example: 'That was an astute observation about our budget.' },
  { word: 'Gratitude', meaning: 'The quality of being thankful.', example: 'I feel deep gratitude for our little life.' },
  { word: 'Effervescent', meaning: 'Vivacious and enthusiastic.', example: 'Her effervescent laugh is contagious.' },
  { word: 'Steadfast', meaning: 'Firmly loyal and unwavering.', example: 'Your steadfast support means everything.' },
  { word: 'Quaint', meaning: 'Attractively unusual or old-fashioned.', example: 'We found a quaint bookshop downtown.' },
  { word: 'Jubilant', meaning: 'Feeling or expressing great happiness.', example: 'We were jubilant when the news arrived.' },
  { word: 'Pensive', meaning: 'Engaged in deep or serious thought.', example: 'You seemed pensive on the drive home.' },
  { word: 'Harmonious', meaning: 'Free from disagreement; well matched.', example: 'We keep a harmonious home together.' },
  { word: 'Zenith', meaning: 'The highest point; the peak.', example: 'That summer was the zenith of our adventures.' },
  { word: 'Affable', meaning: 'Friendly, good-natured, easy to talk to.', example: 'Your affable manner won over my family.' },
  { word: 'Reverie', meaning: 'A state of pleasant, dreamy thought.', example: 'I drifted into a reverie about our future.' },
  { word: 'Tenacious', meaning: 'Persistent and determined.', example: 'She is tenacious about the goals we set.' },
  { word: 'Placid', meaning: 'Calm and not easily upset.', example: 'His placid temperament balances mine.' },
  { word: 'Enchant', meaning: 'To fill with great delight; charm.', example: 'The little village enchanted us both.' },
  { word: 'Fervent', meaning: 'Showing intense, passionate feeling.', example: 'He made a fervent promise to always listen.' },
  { word: 'Convivial', meaning: 'Friendly and lively; enjoyable together.', example: 'It was a convivial dinner with old friends.' },
  { word: 'Sublime', meaning: 'Of great excellence or beauty.', example: 'The mountain view was simply sublime.' },
  { word: 'Ardent', meaning: 'Very enthusiastic or passionate.', example: 'She is an ardent supporter of my dreams.' },
  { word: 'Mellifluous', meaning: 'Sweet or musical; pleasant to hear.', example: 'His mellifluous voice calmed the baby.' },
  { word: 'Prudent', meaning: 'Acting with care and forethought.', example: 'Being prudent with money eased our stress.' },
  { word: 'Vibrant', meaning: 'Full of energy and life.', example: 'The market was vibrant with colour and sound.' },
  { word: 'Genuine', meaning: 'Truly what something is said to be; authentic.', example: 'Your kindness always feels genuine.' },
  { word: 'Serene', meaning: 'Calm, peaceful, and untroubled.', example: 'The garden felt serene in the evening light.' },
  { word: 'Devotion', meaning: 'Great love, loyalty, or dedication.', example: 'Her devotion to us never wavers.' },
  { word: 'Exquisite', meaning: 'Extremely beautiful and delicate.', example: 'You picked out an exquisite little gift.' },
  { word: 'Optimism', meaning: 'Hopefulness about the future.', example: 'Your optimism carries us through rough patches.' },
  { word: 'Tender', meaning: 'Gentle, kind, and affectionate.', example: 'He gave a tender squeeze of my hand.' },
  { word: 'Vigilant', meaning: 'Keeping careful watch for trouble.', example: 'We stay vigilant about each other’s health.' },
  { word: 'Cordial', meaning: 'Warm and friendly.', example: 'They gave us a cordial welcome.' },
  { word: 'Blossom', meaning: 'To develop and flourish.', example: 'Our friendship blossomed into love.' },
  { word: 'Ineffable', meaning: 'Too great to be expressed in words.', example: 'The joy of that day was ineffable.' },
  { word: 'Gallant', meaning: 'Brave and attentive, especially to others.', example: 'That was a gallant thing you did for her.' },
  { word: 'Bliss', meaning: 'Perfect happiness; great joy.', example: 'A slow Sunday with you is pure bliss.' },
  { word: 'Astonish', meaning: 'To surprise or impress greatly.', example: 'You astonish me with your patience.' },
  { word: 'Poignant', meaning: 'Evoking a keen sense of sadness or emotion.', example: 'It was a poignant goodbye at the station.' },
  { word: 'Cordiality', meaning: 'Sincere friendliness and warmth.', example: 'The cordiality between our families is lovely.' },
  { word: 'Aspire', meaning: 'To direct one’s hopes toward a goal.', example: 'We aspire to travel every continent together.' },
  { word: 'Graceful', meaning: 'Elegant and pleasing in movement or manner.', example: 'She has such a graceful way of speaking.' },
  { word: 'Nurture', meaning: 'To care for and encourage growth.', example: 'We nurture each other’s ambitions.' },
  { word: 'Radiance', meaning: 'Great brightness or warmth.', example: 'There was a radiance about you today.' },
  { word: 'Wholesome', meaning: 'Good for well-being; morally beneficial.', example: 'We had a wholesome day at the farmers market.' },
  { word: 'Endearing', meaning: 'Inspiring affection.', example: 'Your sleepy morning voice is endearing.' },
  { word: 'Fathom', meaning: 'To understand deeply after thought.', example: 'I can’t fathom my days without you.' },
  { word: 'Cascade', meaning: 'A small waterfall; to fall in stages.', example: 'Ideas cascaded from us during the road trip.' },
  { word: 'Halcyon', meaning: 'Denoting a happy, peaceful period.', example: 'Those were the halcyon days of our first year.' },
  { word: 'Beacon', meaning: 'A guiding light or signal.', example: 'You are my beacon when things get dark.' },
  { word: 'Cherubic', meaning: 'Having a sweet, innocent face.', example: 'The baby gave a cherubic little grin.' },
  { word: 'Solicitous', meaning: 'Showing caring concern for someone.', example: 'He was solicitous when I felt unwell.' },
  { word: 'Verve', meaning: 'Vigour, spirit, and enthusiasm.', example: 'She tackled the project with real verve.' },
  { word: 'Kindred', meaning: 'Similar in kind; deeply connected.', example: 'We are kindred spirits, you and I.' },
  { word: 'Rejuvenate', meaning: 'To make someone feel young or fresh again.', example: 'A weekend away rejuvenated us both.' },
  { word: 'Charisma', meaning: 'Compelling charm that inspires others.', example: 'His quiet charisma drew everyone in.' },
  { word: 'Wistful', meaning: 'Having a gentle, longing sadness.', example: 'She looked wistful at the old photographs.' },
  { word: 'Bountiful', meaning: 'Large in amount; generous.', example: 'We shared a bountiful home-cooked feast.' },
  { word: 'Illuminate', meaning: 'To light up; to make clear.', example: 'Your explanation illuminated the whole idea.' },
  { word: 'Fondness', meaning: 'Tender, warm affection.', example: 'I remember our early dates with great fondness.' },
  { word: 'Intrepid', meaning: 'Fearless and adventurous.', example: 'We make an intrepid pair of travellers.' },
  { word: 'Serendipitous', meaning: 'Happening by happy chance.', example: 'It was a serendipitous run-in at the bookstore.' },
  { word: 'Comely', meaning: 'Pleasant to look at; attractive.', example: 'You looked especially comely tonight.' },
  { word: 'Bespoke', meaning: 'Custom-made for a particular person.', example: 'He wrote me a bespoke little poem.' },
  { word: 'Elated', meaning: 'Extremely happy and excited.', example: 'We were elated to hear the good news.' },
  { word: 'Grace', meaning: 'Courteous goodwill; simple elegance.', example: 'You handled that with so much grace.' },
  { word: 'Mirth', meaning: 'Amusement, especially as shown in laughter.', example: 'The kitchen was full of mirth all evening.' },
  { word: 'Adore', meaning: 'To love and respect deeply.', example: 'I adore the way you hum while cooking.' },
  { word: 'Serein', meaning: 'Fine rain falling from a clear sky.', example: 'A soft serein caught us on the walk home.' },
  { word: 'Effulgent', meaning: 'Shining brightly; radiant.', example: 'The city was effulgent under the fireworks.' },
  { word: 'Compassion', meaning: 'Sympathetic concern for others’ suffering.', example: 'You show such compassion to strangers.' },
  { word: 'Jovial', meaning: 'Cheerful and friendly.', example: 'Your dad was in a jovial mood at dinner.' },
  { word: 'Treasure', meaning: 'To value highly and keep carefully.', example: 'I treasure the ordinary days most of all.' },
  { word: 'Sanctuary', meaning: 'A place of safety and refuge.', example: 'Home is our sanctuary from the world.' },
  { word: 'Delight', meaning: 'Great pleasure and joy.', example: 'It is a delight to wake up beside you.' },
  { word: 'Winsome', meaning: 'Attractive or appealing in a charming way.', example: 'She has the most winsome laugh.' },
  { word: 'Uplift', meaning: 'To raise someone’s spirits.', example: 'Your messages uplift me on long days.' },
  { word: 'Felicity', meaning: 'Intense happiness.', example: 'We found real felicity in the small routines.' },
];

/** Zero-based day-of-year (0–365). Deterministic for both partners on the same date. */
function dayOfYearIndex(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/** The vocabulary word for a given date (defaults to today). */
export function getWordOfDay(date: Date = new Date()): VocabWord {
  return VOCABULARY[dayOfYearIndex(date) % VOCABULARY.length];
}
