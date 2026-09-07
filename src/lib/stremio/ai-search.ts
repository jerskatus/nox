import type { InstalledAddon, MetaPreview } from "./types";
import { interpretAsk, type AskTitle } from "./ask";
import { fetchCatalog, loadJsonMany } from "./client";
import { catalogsWithSearch, CINEMETA_URL, resourceUrl } from "./urls";

export type SearchIntent = {
  raw: string;
  ask: boolean;
  type?: "movie" | "series";
  genres: string[];
  moods: string[];
  like?: string;
  yearFrom?: number;
  yearTo?: number;
  terms: string[];
  chips: string[];
  requireAll?: string[];
};

export type RankedTitle = MetaPreview & {
  score: number;
  why: string[];
};

const GENRES = [
  "Action",
  "Adventure",
  "Animation",
  "Biography",
  "Comedy",
  "Crime",
  "Documentary",
  "Drama",
  "Family",
  "Fantasy",
  "History",
  "Horror",
  "Mystery",
  "Romance",
  "Sci-Fi",
  "Sport",
  "Thriller",
  "War",
  "Western",
] as const;

const MOODS: { keys: string[]; genres: string[]; label: string }[] = [
  { keys: ["feel-good", "feel good", "cozy", "comfort", "wholesome", "heartwarming", "uplifting", "happy", "cheerful"], genres: ["Comedy", "Family", "Romance"], label: "feel-good" },
  { keys: ["dark", "grim", "bleak", "gritty", "depressing", "heavy"], genres: ["Drama", "Thriller", "Crime"], label: "dark" },
  { keys: ["mind-bending", "mind bending", "twisty", "cerebral", "trippy", "puzzle", "mindfuck"], genres: ["Mystery", "Sci-Fi", "Thriller"], label: "mind-bending" },
  { keys: ["scary", "creepy", "spooky", "horror", "terrifying", "nightmare"], genres: ["Horror"], label: "scary" },
  { keys: ["romcom", "rom-com", "romantic comedy", "romcoms"], genres: ["Romance", "Comedy"], label: "rom-com" },
  { keys: ["heist", "caper", "bank robbery"], genres: ["Crime", "Action"], label: "heist" },
  { keys: ["space", "astronaut", "galaxy", "outer space", "mars"], genres: ["Sci-Fi", "Adventure"], label: "space" },
  { keys: ["time travel", "time-travel", "time loop", "timeloop"], genres: ["Sci-Fi", "Adventure"], label: "time travel" },
  { keys: ["war", "ww2", "wwii", "vietnam", "battlefield"], genres: ["War", "History"], label: "war" },
  { keys: ["true crime", "serial killer", "murder mystery"], genres: ["Crime", "Documentary"], label: "true crime" },
  { keys: ["anime"], genres: ["Animation"], label: "anime" },
  { keys: ["kids", "family friendly", "for kids", "child friendly", "disney kids"], genres: ["Family", "Animation"], label: "family" },
  { keys: ["superhero", "marvel", "dc", "comic book"], genres: ["Action", "Adventure"], label: "superhero" },
  { keys: ["rainy", "rainy-day", "rainy day"], genres: ["Drama", "Romance"], label: "rainy-day" },
  { keys: ["christmas", "holiday", "xmas", "festive"], genres: ["Comedy", "Family", "Romance"], label: "holiday" },
  { keys: ["coming of age", "coming-of-age", "teen movie", "high school"], genres: ["Drama"], label: "coming of age" },
  { keys: ["funny", "hilarious", "goofy", "silly", "laugh"], genres: ["Comedy"], label: "funny" },
  { keys: ["sad", "tearjerker", "cry", "heartbreaking", "tragic"], genres: ["Drama"], label: "tearjerker" },
  { keys: ["slow burn", "slow-burn"], genres: ["Drama", "Romance"], label: "slow-burn" },
  { keys: ["fast", "adrenaline", "action packed", "action-packed"], genres: ["Action"], label: "adrenaline" },
  { keys: ["steamy", "sexy", "erotic", "spicy"], genres: ["Romance", "Drama"], label: "steamy" },
  { keys: ["campy", "cheesy", "so-bad-it's-good"], genres: ["Comedy", "Horror"], label: "campy" },
  { keys: ["epic", "sweeping"], genres: ["Adventure", "Drama"], label: "epic" },
  { keys: ["quirky", "offbeat", "indie", "wes anderson"], genres: ["Comedy", "Drama"], label: "quirky" },
  { keys: ["smart", "witty", "clever"], genres: ["Comedy", "Drama"], label: "witty" },
  { keys: ["brutal", "violent", "gory", "bloody"], genres: ["Action", "Horror"], label: "brutal" },
  { keys: ["cozy mystery", "cozy crime"], genres: ["Mystery", "Crime"], label: "cozy-mystery" },
  { keys: ["found family", "found-family"], genres: ["Drama", "Adventure"], label: "found-family" },
];

const STOP = new Set([
  "a", "an", "the", "of", "and", "or", "in", "on", "for", "with", "to", "me", "i", "my",
  "want", "wanna", "watch", "watching", "something", "some", "any", "please", "find",
  "looking", "show", "shows", "movie", "movies", "film", "films", "series", "tv",
  "like", "similar", "about", "that", "this", "are", "is", "it", "from", "good",
  "best", "great", "recommend", "recommendation", "recommendations", "suggest",
  "what", "can", "you", "give", "need", "but", "not",
]);

const SIMILAR: Record<string, string[]> = {
  inception: ["Interstellar", "The Prestige", "Shutter Island", "Tenet", "Primer"],
  interstellar: ["Inception", "Arrival", "The Martian", "Gravity", "Contact"],
  "the bear": ["The Menu", "Boiling Point", "Chef", "The Restaurant"],
  "breaking bad": ["Better Call Saul", "Narcos", "Ozark", "The Wire", "Snowfall"],
  "the office": ["Parks and Recreation", "Brooklyn Nine-Nine", "Superstore", "Abbott Elementary"],
  "stranger things": ["Dark", "The Umbrella Academy", "Locke & Key", "Wednesday"],
  dune: ["Blade Runner 2049", "Foundation", "Star Wars", "Arrival"],
  parasite: ["Memories of Murder", "Snowpiercer", "Burning", "The Handmaiden"],
  "john wick": ["The Raid", "Nobody", "Atomic Blonde", "Extraction"],
  "game of thrones": ["House of the Dragon", "The Witcher", "Vikings", "The Last Kingdom"],
  "the boys": ["Invincible", "Watchmen", "Gen V", "Jupiter's Legacy"],
  "true detective": ["Mindhunter", "Zodiac", "Mare of Easttown", "The Night Of"],
  "la la land": ["Whiplash", "The Greatest Showman", "Begin Again"],
  "everything everywhere": ["Swiss Army Man", "Being John Malkovich", "The Matrix"],
  "the last of us": ["The Walking Dead", "Station Eleven", "Sweet Tooth"],
  succession: ["Billions", "Industry", "Mad Men", "Veep"],
  "severance": ["Dark", "The Leftovers", "Mr. Robot", "WandaVision"],
  "the godfather": ["Goodfellas", "Casino", "The Irishman", "Once Upon a Time in America"],
  spirited: ["Howl's Moving Castle", "Princess Mononoke", "My Neighbor Totoro", "Your Name"],
  "spirited away": ["Howl's Moving Castle", "Princess Mononoke", "Nausicaä", "Your Name"],
  "pulp fiction": ["Reservoir Dogs", "Snatch", "Lock, Stock and Two Smoking Barrels", "Kill Bill"],
  "fight club": ["American Psycho", "Nightcrawler", "Taxi Driver", "Joker"],
  "the matrix": ["Dark City", "Equilibrium", "Inception", "Blade Runner"],
  "mad max": ["John Wick", "The Raid", "Dredd", "Fury Road"],
  "mad max fury road": ["Dredd", "John Wick", "District 9", "Children of Men"],
  "get out": ["Us", "Nope", "The Invisible Man", "Sorry to Bother You"],
  "hereditary": ["Midsommar", "The Witch", "Saint Maud", "The Babadook"],
  "the shining": ["The Exorcist", "Rosemary's Baby", "The Others", "Session 9"],
  "alien": ["The Thing", "Aliens", "Event Horizon", "Life"],
  "jurassic park": ["Jaws", "Kong: Skull Island", "Super 8", "The Lost World"],
  "jaws": ["Jurassic Park", "The Meg", "Deep Blue Sea", "Open Water"],
  "forrest gump": ["The Green Mile", "Cast Away", "Big Fish", "The Curious Case of Benjamin Button"],
  "the notebook": ["A Walk to Remember", "The Best of Me", "Dear John", "PS I Love You"],
  "10 things i hate about you": ["Clueless", "She's All That", "Can't Hardly Wait", "Easy A"],
  clueless: ["10 Things I Hate About You", "Mean Girls", "Easy A", "Legally Blonde"],
  "mean girls": ["Clueless", "Easy A", "Heathers", "Jawbreaker"],
  "notting hill": ["You've Got Mail", "Love Actually", "Four Weddings and a Funeral", "About Time"],
  "love actually": ["Notting Hill", "The Holiday", "Bridget Jones's Diary", "About Time"],
  "superbad": ["Knocked Up", "Pineapple Express", "Project X", "Booksmart"],
  "the hangover": ["Superbad", "Due Date", "Project X", "We're the Millers"],
  "bridesmaids": ["Trainwreck", "Rough Night", "The House Bunny", "Sisters"],
  "legally blonde": ["Clueless", "13 Going on 30", "The Princess Diaries", "Miss Congeniality"],
  "pride and prejudice": ["Sense and Sensibility", "Emma", "Little Women", "Bridgerton"],
  bridgerton: ["Downton Abbey", "Outlander", "Sanditon", "The Buccaneers"],
  "the crown": ["The Queen", "The King's Speech", "The Gilded Age", "Victoria"],
  "sherlock": ["True Detective", "Luther", "Broadchurch", "Endeavour"],
  "peaky blinders": ["Boardwalk Empire", "Gangs of London", "The Gentlemen", "Taboo"],
  "the wire": ["The Shield", "Bosch", "We Own This City", "The Night Of"],
  narcos: ["Sicario", "Traffic", "ZeroZeroZero", "El Chapo"],
  "better call saul": ["Breaking Bad", "The Lincoln Lawyer", "The Night Of", "Michael Clayton"],
  "black mirror": ["The Twilight Zone", "Westworld", "Devs", "Love, Death & Robots"],
  westworld: ["Black Mirror", "Devs", "Ex Machina", "Humans"],
  "the mandalorian": ["Andor", "The Book of Boba Fett", "Ahsoka", "Rogue One"],
  "andor": ["The Mandalorian", "Rogue One", "Children of Men", "Sicario"],
  "the witcher": ["Game of Thrones", "Shadow and Bone", "The Wheel of Time", "Vikings"],
  "house of the dragon": ["Game of Thrones", "The Witcher", "Vikings", "The Last Kingdom"],
  wednesday: ["The Addams Family", "Stranger Things", "Locke & Key", "Chilling Adventures of Sabrina"],
  "squid game": ["Alice in Borderland", "The Platform", "Battle Royale", "Hunger Games"],
  "the hunger games": ["Divergent", "Battle Royale", "The Maze Runner", "Squid Game"],
  "harry potter": ["The Lord of the Rings", "Percy Jackson", "Fantastic Beasts", "The Golden Compass"],
  "lord of the rings": ["The Hobbit", "Harry Potter", "Dune", "Willow"],
  "the hobbit": ["The Lord of the Rings", "Willow", "Eragon", "Narnia"],
  "star wars": ["Dune", "Guardians of the Galaxy", "Serenity", "The Mandalorian"],
  "guardians of the galaxy": ["Thor: Ragnarok", "The Suicide Squad", "Star Wars", "Galaxy Quest"],
  "iron man": ["The Avengers", "Spider-Man", "Black Panther", "Doctor Strange"],
  "spider-man": ["Iron Man", "The Amazing Spider-Man", "Into the Spider-Verse", "Superman"],
  "batman": ["The Dark Knight", "Joker", "The Batman", "Watchmen"],
  "the dark knight": ["Joker", "The Batman", "Zodiac", "Heat"],
  joker: ["Taxi Driver", "The King of Comedy", "Nightcrawler", "The Dark Knight"],
  "whiplash": ["Black Swan", "Birdman", "Sound of Metal", "Tick, Tick... Boom!"],
  "la la": ["Whiplash", "The Greatest Showman", "Tick, Tick... Boom!"],
  oldboy: ["I Saw the Devil", "Sympathy for Mr. Vengeance", "The Handmaiden", "Decision to Leave"],
  "train to busan": ["Peninsula", "World War Z", "28 Days Later", "#Alive"],
  "your name": ["Weathering with You", "Suzume", "A Silent Voice", "Garden of Words"],
  "attack on titan": ["Vinland Saga", "Demon Slayer", "Jujutsu Kaisen", "Tokyo Ghoul"],
  "demon slayer": ["Jujutsu Kaisen", "Attack on Titan", "My Hero Academia", "Chainsaw Man"],
  "studio ghibli": ["Spirited Away", "Howl's Moving Castle", "Princess Mononoke", "Kiki's Delivery Service"],
  "the menu": ["The Bear", "Ready or Not", "Triangle of Sadness", "Fresh"],
  "knives out": ["Glass Onion", "Clue", "Murder on the Orient Express", "See How They Run"],
  "gone girl": ["The Girl on the Train", "Prisoners", "Zodiac", "Sharp Objects"],
  "no country": ["There Will Be Blood", "Hell or High Water", "Wind River", "Sicario"],
  sicario: ["Sicario", "Zero Dark Thirty", "The Town", "Heat"],
  heat: ["Heat", "The Town", "Den of Thieves", "Collateral"],
  "ocean's": ["Ocean's Eleven", "The Italian Job", "Logan Lucky", "Now You See Me"],
  "now you see me": ["Ocean's Eleven", "The Prestige", "Focus", "Trap"],
  "mission impossible": ["James Bond", "The Bourne Identity", "Jack Reacher", "Atomic Blonde"],
  bourne: ["The Bourne Identity", "Mission: Impossible", "Jack Ryan", "Atomic Blonde"],
  "james bond": ["Mission: Impossible", "The Bourne Identity", "Kingsman", "Atomic Blonde"],
  kingsman: ["Kick-Ass", "The Gentlemen", "Matthew Vaughn", "Scott Pilgrim"],
  "die hard": ["Speed", "Olympus Has Fallen", "The Raid", "John Wick"],
  "top gun": ["Days of Thunder", "Ford v Ferrari", "Rush", "Need for Speed"],
  "fast and furious": ["Need for Speed", "Baby Driver", "Drive", "Gone in 60 Seconds"],
  drive: ["Nightcrawler", "Baby Driver", "Only God Forgives", "The Place Beyond the Pines"],
  "baby driver": ["Drive", "Baby Driver", "Edgar Wright", "Scott Pilgrim vs. the World"],
  "shaun of the dead": ["Hot Fuzz", "Zombieland", "What We Do in the Shadows", "Tucker and Dale vs Evil"],
  "hot fuzz": ["Shaun of the Dead", "The World's End", "21 Jump Street", "The Nice Guys"],
  "what we do in the shadows": ["Shaun of the Dead", "Wellington Paranormal", "Our Flag Means Death", "The Office"],
  "parks and rec": ["The Office", "Brooklyn Nine-Nine", "Superstore", "Abbott Elementary"],
  "brooklyn nine-nine": ["The Office", "Parks and Recreation", "Psych", "Chuck"],
  community: ["The Good Place", "Brooklyn Nine-Nine", "Arrested Development", "30 Rock"],
  "the good place": ["Community", "The Good Place", "Upload", "Russian Doll"],
  "arrested development": ["It's Always Sunny in Philadelphia", "30 Rock", "Veep", "Community"],
  "always sunny": ["Arrested Development", "Curb Your Enthusiasm", "What We Do in the Shadows", "Trailer Park Boys"],
  "curb your enthusiasm": ["Seinfeld", "Veep", "The Rehearsal", "It's Always Sunny in Philadelphia"],
  seinfeld: ["Curb Your Enthusiasm", "The Office", "Frasier", "30 Rock"],
  friends: ["How I Met Your Mother", "New Girl", "The Big Bang Theory", "Happy Endings"],
  "how i met your mother": ["Friends", "New Girl", "Happy Endings", "The Big Bang Theory"],
  "new girl": ["Friends", "Happy Endings", "Brooklyn Nine-Nine", "Superstore"],
  "big bang": ["Friends", "How I Met Your Mother", "The IT Crowd", "Silicon Valley"],
  "silicon valley": ["The IT Crowd", "Halt and Catch Fire", "Superstore", "Mythic Quest"],
  "mad men": ["Succession", "The Crown", "Halt and Catch Fire", "The Americans"],
  "the americans": ["Slow Horses", "The Night Manager", "Homeland", "The Spy"],
  "slow horses": ["The Americans", "Tinker Tailor Soldier Spy", "The Night Manager", "Jack Ryan"],
  "mindhunter": ["True Detective", "Zodiac", "Manhunt", "The Night Of"],
  "fargo": ["No Country for Old Men", "Fargo", "Twin Peaks", "True Detective"],
  "twin peaks": ["The X-Files", "True Detective", "Dark", "The Leftovers"],
  "the leftovers": ["The OA", "Station Eleven", "Dark", "The Returned"],
  dark: ["The OA", "1899", "Stranger Things", "The Leftovers"],
  "mr robot": ["Fight Club", "Mr. Robot", "Devs", "Black Mirror"],
  "the walking dead": ["The Last of Us", "28 Days Later", "Train to Busan", "Fear the Walking Dead"],
  "yellowstone": ["1883", "Mayor of Kingstown", "Longmire", "Justified"],
  justified: ["Longmire", "Justified", "Raylan", "No Country for Old Men"],
  "ozark": ["Breaking Bad", "Ozark", "Bloodline", "Animal Kingdom"],
  "animal kingdom": ["Ozark", "Animal Kingdom", "Snowfall", "Mayans M.C."],
  "euphoria": ["Skins", "Thirteen", "The Idol", "We Are Who We Are"],
  skins: ["Euphoria", "Skins", "The End of the F***ing World", "My Mad Fat Diary"],
  "normal people": ["One Day", "Conversations with Friends", "Fleabag", "The Worst Person in the World"],
  fleabag: ["Catastrophe", "I May Destroy You", "The Worst Person in the World", "After Life"],
  "ted lasso": ["Shrinking", "The Good Place", "Abbott Elementary", "Friday Night Lights"],
  "friday night lights": ["Ted Lasso", "Coach Carter", "Remember the Titans", "All American"],
  "the white lotus": ["The Menu", "Triangle of Sadness", "The Resort", "Nine Perfect Strangers"],
};

const TROPES: { keys: string[]; titles: string[]; chips: string[]; kind?: "movie" | "series" }[] = [
  {
    keys: ["road trip", "roadtrip", "road-trip", "on a trip", "cross country", "cross-country"],
    titles: ["Road Trip", "Thelma & Louise", "Dumb and Dumber", "Little Miss Sunshine", "Superbad", "Harold & Kumar Go to White Castle", "EuroTrip", "Due Date", "Planes, Trains and Automobiles", "National Lampoon's Vacation", "Easy Rider", "Sideways", "Almost Famous", "Stand by Me", "We're the Millers"],
    chips: ["road trip"],
  },
  {
    keys: ["heist", "caper", "bank job", "casino robbery", "steal the"],
    titles: ["Ocean's Eleven", "The Italian Job", "Heat", "Inside Man", "Logan Lucky", "Now You See Me", "The Town", "Den of Thieves", "Baby Driver", "Widows"],
    chips: ["heist"],
  },
  {
    keys: ["time loop", "same day over", "repeating day", "stuck in a loop"],
    titles: ["Groundhog Day", "Palm Springs", "Edge of Tomorrow", "Source Code", "Happy Death Day", "Russian Doll", "The Map of Tiny Perfect Things", "ARQ"],
    chips: ["time loop"],
  },
  {
    keys: ["time travel"],
    titles: ["Back to the Future", "Looper", "12 Monkeys", "Primer", "About Time", "The Time Traveler's Wife", "Arrival", "Interstellar"],
    chips: ["time travel"],
  },
  {
    keys: ["buddy cop", "buddy cops", "cop duo"],
    titles: ["Lethal Weapon", "Bad Boys", "Rush Hour", "21 Jump Street", "The Nice Guys", "Hot Fuzz", "The Other Guys", "Kiss Kiss Bang Bang"],
    chips: ["buddy cop"],
  },
  {
    keys: ["workplace comedy", "office comedy", "job comedy"],
    titles: ["The Office", "Parks and Recreation", "Superstore", "Abbott Elementary", "Industry", "Severance", "The Bear"],
    chips: ["workplace"],
    kind: "series",
  },
  {
    keys: ["found family", "found-family", "makeshift family"],
    titles: ["Guardians of the Galaxy", "The Goonies", "Lilo & Stitch", "The Umbrella Academy", "Stranger Things", "The Mandalorian", "Everything Everywhere All at Once"],
    chips: ["found family"],
  },
  {
    keys: ["enemies to lovers", "hate each other then", "rivals in love"],
    titles: ["10 Things I Hate About You", "Pride & Prejudice", "When Harry Met Sally", "The Proposal", "How to Lose a Guy in 10 Days", "You've Got Mail", "To All the Boys I've Loved Before"],
    chips: ["enemies to lovers", "rom-com"],
  },
  {
    keys: ["fake dating", "fake relationship", "pretend to date", "contract relationship"],
    titles: ["The Proposal", "To All the Boys I've Loved Before", "Can't Buy Me Love", "The Wedding Date", "Set It Up", "What's Your Number?"],
    chips: ["fake dating", "rom-com"],
  },
  {
    keys: ["wedding", "bridesmaid", "bachelor party"],
    titles: ["Bridesmaids", "The Hangover", "Wedding Crashers", "My Best Friend's Wedding", "27 Dresses", "Father of the Bride", "The Wedding Singer"],
    chips: ["wedding"],
  },
  {
    keys: ["high school", "teen movie", "teen comedy"],
    titles: ["Mean Girls", "10 Things I Hate About You", "Clueless", "Superbad", "Easy A", "Booksmart", "Lady Bird", "The Breakfast Club"],
    chips: ["high school"],
  },
  {
    keys: ["coming of age", "growing up"],
    titles: ["Lady Bird", "The Perks of Being a Wallflower", "Stand by Me", "Moonlight", "Boyhood", "Eighth Grade", "The Spectacular Now", "Call Me by Your Name"],
    chips: ["coming of age"],
  },
  {
    keys: ["survival", "stranded", "desert island", "wilderness"],
    titles: ["Cast Away", "The Revenant", "127 Hours", "Into the Wild", "The Martian", "Life of Pi", "Alive", "The Grey"],
    chips: ["survival"],
  },
  {
    keys: ["apocalypse", "end of the world", "post-apocalyptic", "post apocalyptic"],
    titles: ["Children of Men", "Mad Max: Fury Road", "The Road", "A Quiet Place", "28 Days Later", "Station Eleven", "The Last of Us", "Snowpiercer"],
    chips: ["apocalypse"],
  },
  {
    keys: ["zombie", "zombies", "undead"],
    titles: ["28 Days Later", "Shaun of the Dead", "Zombieland", "Train to Busan", "World War Z", "Dawn of the Dead", "The Walking Dead"],
    chips: ["zombies"],
  },
  {
    keys: ["vampire", "vampires"],
    titles: ["Let the Right One In", "What We Do in the Shadows", "Interview with the Vampire", "Only Lovers Left Alive", "The Lost Boys", "Twilight", "True Blood"],
    chips: ["vampires"],
  },
  {
    keys: ["serial killer", "murderer hunting"],
    titles: ["Zodiac", "Se7en", "Mindhunter", "The Silence of the Lambs", "Memories of Murder", "No Country for Old Men", "The Night Of"],
    chips: ["serial killer"],
  },
  {
    keys: ["courtroom", "trial", "lawyer movie", "legal drama"],
    titles: ["A Few Good Men", "To Kill a Mockingbird", "The Verdict", "Philadelphia", "Primal Fear", "The Lincoln Lawyer", "Better Call Saul"],
    chips: ["courtroom"],
  },
  {
    keys: ["spy", "espionage", "secret agent", "cia", "mi6"],
    titles: ["Tinker Tailor Soldier Spy", "The Bourne Identity", "Casino Royale", "Mission: Impossible", "Atomic Blonde", "Slow Horses", "The Americans"],
    chips: ["spy"],
  },
  {
    keys: ["hitman", "assassin", "contract killer"],
    titles: ["John Wick", "Léon: The Professional", "The Killer", "Mr. & Mrs. Smith", "Grosse Pointe Blank", "Atomic Blonde", "Nobody"],
    chips: ["assassin"],
  },
  {
    keys: ["sports", "underdog team", "underdog sports", "football movie", "basketball movie", "boxing"],
    titles: ["Rocky", "Remember the Titans", "Friday Night Lights", "Moneyball", "Coach Carter", "The Blind Side", "Creed", "Rush"],
    chips: ["sports"],
  },
  {
    keys: ["chef", "restaurant", "cooking", "kitchen"],
    titles: ["The Bear", "The Menu", "Chef", "Julie & Julia", "Burnt", "Boiling Point", "Ratatouille"],
    chips: ["kitchen"],
  },
  {
    keys: ["haunted house", "haunted", "ghost story", "ghosts"],
    titles: ["The Conjuring", "The Others", "The Haunting", "Hereditary", "The Babadook", "His House", "Poltergeist"],
    chips: ["haunted"],
  },
  {
    keys: ["home invasion"],
    titles: ["The Strangers", "Don't Breathe", "The Purge", "Funny Games", "Panic Room", "The Gift"],
    chips: ["home invasion"],
  },
  {
    keys: ["space", "astronaut", "on mars", "in space"],
    titles: ["The Martian", "Gravity", "Interstellar", "Alien", "Moon", "First Man", "Apollo 13", "Ad Astra"],
    chips: ["space"],
  },
  {
    keys: ["robots", "ai", "artificial intelligence", "android"],
    titles: ["Ex Machina", "Her", "The Terminator", "Blade Runner 2049", "A.I. Artificial Intelligence", "I, Robot", "The Creator"],
    chips: ["AI"],
  },
  {
    keys: ["musical", "singing", "song and dance"],
    titles: ["La La Land", "Whiplash", "The Greatest Showman", "Tick, Tick... Boom!", "West Side Story", "Chicago", "Les Misérables"],
    chips: ["musical"],
  },
  {
    keys: ["christmas", "xmas", "holiday movie"],
    titles: ["Love Actually", "The Holiday", "Home Alone", "Elf", "Die Hard", "It's a Wonderful Life", "The Santa Clause", "Klaus"],
    chips: ["christmas"],
  },
  {
    keys: ["heist crew", "one last job"],
    titles: ["Heat", "The Town", "Logan Lucky", "Widows", "Ocean's Eleven"],
    chips: ["one last job"],
  },
  {
    keys: ["small town", "small-town"],
    titles: ["Fargo", "Twin Peaks", "Stranger Things", "Sharp Objects", "Three Billboards Outside Ebbing, Missouri", "The Truman Show"],
    chips: ["small town"],
  },
  {
    keys: ["based on a true story", "true story", "based on true"],
    titles: ["Spotlight", "The Social Network", "Catch Me If You Can", "The Wolf of Wall Street", "Ford v Ferrari", "Apollo 13", "Schindler's List"],
    chips: ["true story"],
  },
  {
    keys: ["con artist", "grifter", "scam", "catfish"],
    titles: ["Catch Me If You Can", "The Sting", "American Hustle", "Focus", "The Talented Mr. Ripley", "Inventing Anna"],
    chips: ["con"],
  },
  {
    keys: ["revenge", "payback", "get even"],
    titles: ["Kill Bill", "Oldboy", "John Wick", "The Count of Monte Cristo", "Gone Girl", "Promising Young Woman", "Taken"],
    chips: ["revenge"],
  },
  {
    keys: ["disaster", "earthquake", "tsunami", "volcano", "asteroid"],
    titles: ["Twister", "The Day After Tomorrow", "Armageddon", "Deep Impact", "2012", "San Andreas", "Don't Look Up"],
    chips: ["disaster"],
  },
  {
    keys: ["pirates", "pirate"],
    titles: ["Pirates of the Caribbean: The Curse of the Black Pearl", "Captain Phillips", "The Goonies", "Our Flag Means Death", "Treasure Island"],
    chips: ["pirates"],
  },
  {
    keys: ["western", "cowboys", "wild west"],
    titles: ["The Good, the Bad and the Ugly", "True Grit", "No Country for Old Men", "The Hateful Eight", "3:10 to Yuma", "Tombstone", "Yellowstone"],
    chips: ["western"],
  },
  {
    keys: ["prison", "jailbreak", "escape from prison"],
    titles: ["The Shawshank Redemption", "Escape from Alcatraz", "The Great Escape", "Cool Hand Luke", "Papillon", "Prison Break", "The Green Mile"],
    chips: ["prison"],
  },
  {
    keys: ["whodunit", "who done it", "murder mystery dinner", "detective mystery"],
    titles: ["Knives Out", "Clue", "Murder on the Orient Express", "Gone Girl", "The Girl with the Dragon Tattoo", "Zodiac", "See How They Run"],
    chips: ["whodunit"],
  },
];

export const ASK_PROMPTS = [
  "Feel-good 90s romcoms",
  "Shows like The Bear",
  "Dark mind-bending sci-fi",
  "Korean thrillers",
  "Cozy rainy-day movies",
  "Heist movies from the 2000s",
  "Best friends on a road trip",
  "Enemies to lovers",
  "Time-loop movies",
];

export function parseIntent(raw: string): SearchIntent {
  const q = raw.trim();
  const lower = ` ${q.toLowerCase()} `;

  let type: "movie" | "series" | undefined;
  const wantsShow = /\b(shows?|series|tv|anime)\b/.test(lower);
  const wantsMovie = /\b(movies?|films?)\b/.test(lower);
  if (wantsShow && !wantsMovie) type = "series";
  if (wantsMovie && !wantsShow) type = "movie";
  if (!type && /\b(romcom|rom-com|romcoms|heist)\b/.test(lower)) type = "movie";

  const genres: string[] = [];
  for (const genre of GENRES) {
    const needle = genre.toLowerCase().replace("-", " ");
    if (lower.includes(` ${needle} `) || lower.includes(` ${genre.toLowerCase()} `)) {
      genres.push(genre);
    }
  }
  if (/\bsci[\s-]?fi\b|science fiction/.test(lower) && !genres.includes("Sci-Fi")) genres.push("Sci-Fi");
  if (/\bk-?drama|korean/.test(lower) && !genres.includes("Drama")) genres.push("Drama");
  if (/\bk-?drama\b/.test(lower)) type = type ?? "series";
  if (/\b(funny|hilarious|comedy)\b/.test(lower) && !genres.includes("Comedy")) genres.push("Comedy");
  if (/\b(sad|tearjerker|cry)\b/.test(lower) && !genres.includes("Drama")) genres.push("Drama");
  if (/\b(scary|horror|creepy)\b/.test(lower) && !genres.includes("Horror")) genres.push("Horror");

  const moods: string[] = [];
  const romcom = /\b(romcom|rom-com|romcoms|romantic comedy|romantic comedies)\b/.test(lower);
  for (const mood of MOODS) {
    if (!mood.keys.some((key) => lower.includes(key)) && !(romcom && mood.label === "rom-com")) continue;
    moods.push(mood.label);
    for (const genre of mood.genres) {
      if (romcom && genre === "Family") continue;
      if (!genres.includes(genre)) genres.push(genre);
    }
  }

  let requireAll: string[] | undefined;
  if (moods.includes("rom-com")) {
    type = type ?? "movie";
    genres.splice(0, genres.length, ...["Romance", "Comedy", ...genres.filter((g) => g !== "Family" && g !== "Romance" && g !== "Comedy")]);
    requireAll = ["Romance", "Comedy"];
  }

  let yearFrom: number | undefined;
  let yearTo: number | undefined;
  const decade = lower.match(/\b(19|20)(\d)0s\b/);
  if (decade) {
    yearFrom = Number(decade[1] + decade[2] + "0");
    yearTo = yearFrom + 9;
  }
  const year = lower.match(/\b((?:19|20)\d{2})\b/);
  if (year && !decade) {
    const n = Number(year[1]);
    yearFrom = n - 1;
    yearTo = n + 1;
  }
  if (/\b(90s|nineties)\b/.test(lower)) {
    yearFrom = 1990;
    yearTo = 1999;
  }
  if (/\b(80s|eighties)\b/.test(lower)) {
    yearFrom = 1980;
    yearTo = 1989;
  }
  if (/\b(2000s|two thousands)\b/.test(lower)) {
    yearFrom = 2000;
    yearTo = 2009;
  }

  let like: string | undefined;
  const likeMatch = q.match(/\b(?:like|similar to)\s+(.+?)(?:\s+but\b|$)/i);
  if (likeMatch?.[1]) {
    like = likeMatch[1]
      .replace(/\b(movies?|films?|shows?|series|tv)\b/gi, "")
      .replace(/[?.!,]+$/g, "")
      .trim();
    if (like.length < 2) like = undefined;
  }

  const terms = q
    .toLowerCase()
    .replace(/[^a-z0-9\s:'-]/g, " ")
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 1 && !STOP.has(part));

  const ask =
    Boolean(like || moods.length || yearFrom || (genres.length && q.split(/\s+/).length >= 3)) ||
    /\b(about|vibe|mood|recommend|something)\b/.test(lower) ||
    q.split(/\s+/).length >= 5;

  const chips: string[] = [];
  if (type === "series") chips.push("TV shows");
  if (type === "movie") chips.push("Movies");
  chips.push(...moods);
  chips.push(...genres.slice(0, 3));
  if (yearFrom && yearTo) chips.push(yearFrom === yearTo - 9 ? `${yearFrom}s` : `${yearFrom}–${yearTo}`);
  if (like) chips.push(`like ${like}`);

  return {
    raw: q,
    ask,
    type,
    genres: genres.slice(0, 3),
    moods,
    like,
    yearFrom,
    yearTo,
    terms,
    chips: unique(chips),
    requireAll,
  };
}

export async function nameSearch(query: string, addons: InstalledAddon[]): Promise<{
  intent: SearchIntent;
  items: RankedTitle[];
}> {
  const q = query.trim();
  const intent: SearchIntent = {
    raw: q,
    ask: false,
    genres: [],
    moods: [],
    terms: [q],
    chips: [],
  };
  const catalogs = catalogsWithSearch(addons)
    .sort((a, b) => Number(b.addonName === "Cinemeta") - Number(a.addonName === "Cinemeta"))
    .slice(0, 8);
  const urls = catalogs.map((catalog) =>
    resourceUrl(catalog.transportUrl, "catalog", catalog.type, catalog.id, { search: q }),
  );
  const results = urls.length ? await loadJsonMany(urls) : [];
  const seen = new Set<string>();
  const pool: MetaPreview[] = [];
  for (const result of results) {
    if (!result.ok) continue;
    const metas = ((result.data as { metas?: MetaPreview[] }).metas ?? []) as MetaPreview[];
    for (const item of metas) {
      if (!item?.id || !item.name) continue;
      const key = `${item.type}:${item.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      pool.push(item);
    }
  }

  const needle = q.toLowerCase();
  const items = pool
    .map((item) => {
      const name = item.name.toLowerCase();
      let score = 0;
      const why: string[] = [];
      if (name === needle) {
        score += 140;
        why.push("Exact title");
      } else if (name.startsWith(needle)) {
        score += 90;
        why.push("Title starts with");
      } else if (name.includes(needle)) {
        score += 55;
        why.push("Title match");
      } else {
        const words = needle.split(/\s+/).filter((w) => w.length > 1);
        const hits = words.filter((w) => name.includes(w)).length;
        if (hits === 0) return { ...item, score: 0, why };
        score += hits === words.length ? 32 : hits * 8;
      }
      const rating = Number(item.imdbRating);
      if (!Number.isNaN(rating) && rating > 0) score += rating;
      return { ...item, score, why };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 48);

  return { intent, items };
}

export async function runSearch(
  query: string,
  addons: InstalledAddon[],
  mode: "smart" | "title",
) {
  if (mode === "title") return nameSearch(query, addons);
  return smartSearch(query, addons);
}

export async function smartSearch(query: string, addons: InstalledAddon[]): Promise<{
  intent: SearchIntent;
  items: RankedTitle[];
}> {
  const intent = parseIntent(query);

  if (intent.ask) {
    const grok = await interpretAsk({ data: { query } });
    const wanted: AskTitle[] = grok.ok
      ? grok.titles
      : tropeTitles(intent);
    if (grok.ok) {
      if (grok.type) intent.type = grok.type;
      intent.chips = unique([...grok.chips, ...intent.chips]).slice(0, 8);
    }
    if (wanted.length) {
      const resolved = await resolveNamedTitles(wanted, intent);
      if (resolved.length > 0) return { intent, items: resolved };
    }
    // Plot queries must not fall through to raw keyword search (that is how
    // "best friends / road trip" became Friends + Going in Style).
    if (intent.ask && !intent.like) return { intent, items: [] };
  }
  const catalogs = catalogsWithSearch(addons)
    .sort((a, b) => Number(b.addonName === "Cinemeta") - Number(a.addonName === "Cinemeta"))
    .slice(0, 6);
  const types = intent.type ? [intent.type] : ["movie", "series"];

  if (intent.like) {
    const seedRows = await Promise.all(
      types.map((type) => fetchCatalog(CINEMETA_URL, type, "top", { search: intent.like })),
    );
    const flat = seedRows.flat();
    const needle = intent.like.toLowerCase();
    const exact = flat.filter((item) => item.name.toLowerCase() === needle);
    const named = flat
      .filter((item) => item.name.toLowerCase().includes(needle))
      .sort((a, b) => a.name.length - b.name.length);
    const seed = (exact[0] ?? named[0] ?? flat[0]) as MetaPreview | undefined;
    if (seed?.genres?.length) {
      for (const genre of seed.genres) {
        if (!intent.genres.includes(genre) && GENRES.includes(genre as (typeof GENRES)[number])) {
          intent.genres.push(genre);
        }
      }
      intent.genres = intent.genres.slice(0, 3);
      intent.chips = unique([...intent.chips, ...intent.genres]);
    }
  }

  const urls: string[] = [];
  const searchTerms = unique(
    [
      intent.like,
      intent.like ? undefined : moodSearchTerm(intent),
      intent.like ? undefined : intent.terms.filter((t) => !["romcom", "romcoms", "rom-com", "feel-good", "90s", "80s"].includes(t)).slice(0, 3).join(" "),
      ...(intent.like ? similarTitles(intent.like).slice(0, 2) : []),
    ].filter((term): term is string => Boolean(term && term.trim().length >= 2)),
  ).slice(0, 3);

  for (const term of searchTerms) {
    for (const catalog of catalogs) {
      if (intent.type && catalog.type !== intent.type && catalog.type !== "tv") continue;
      urls.push(resourceUrl(catalog.transportUrl, "catalog", catalog.type, catalog.id, { search: term }));
    }
  }

  for (const title of seedTitles(intent)) {
    for (const type of types) {
      urls.push(resourceUrl(CINEMETA_URL, "catalog", type, "top", { search: title }));
    }
  }

  const genreFetches = types.flatMap((type) =>
    intent.genres.slice(0, 2).map((genre) => fetchCatalog(CINEMETA_URL, type, "top", { genre })),
  );

  const [searchResults, ...genreRows] = await Promise.all([
    urls.length ? loadJsonMany(urls) : Promise.resolve([]),
    ...genreFetches,
  ]);

  const pool: MetaPreview[] = [];
  const seen = new Set<string>();

  function add(item: MetaPreview | undefined) {
    if (!item?.id || !item.name) return;
    const key = `${item.type}:${item.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    pool.push(item);
  }

  if (Array.isArray(searchResults)) {
    for (const result of searchResults) {
      if (!result.ok) continue;
      const metas = ((result.data as { metas?: MetaPreview[] }).metas ?? []) as MetaPreview[];
      for (const meta of metas) add(meta);
    }
  }

  for (const row of genreRows) {
    if (!Array.isArray(row)) continue;
    for (const meta of row) add(meta);
  }

  const ranked = pool
    .map((item) => scoreItem(item, intent))
    .filter((item) => {
      if (intent.type && item.type !== intent.type) return false;
      if (intent.yearFrom && intent.yearTo) {
        const year = itemYear(item);
        if (year && (year < intent.yearFrom || year > intent.yearTo)) return false;
      }
      if (intent.moods.includes("rom-com")) {
        const have = (item.genres ?? []).map((g) => g.toLowerCase());
        if (have.some((g) => g === "war" || g === "horror" || g === "documentary")) return false;
      }
      if (intent.requireAll?.length) {
        const have = (item.genres ?? []).map((g) => g.toLowerCase());
        if (have.length > 0 && intent.requireAll.some((need) => !have.includes(need.toLowerCase()))) {
          return false;
        }
      }
      return item.score > 0;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 48);

  return { intent, items: ranked };
}

function scoreItem(item: MetaPreview, intent: SearchIntent): RankedTitle {
  let score = 8;
  const why: string[] = [];
  const name = item.name.toLowerCase();
  const hay = `${name} ${(item.description ?? "").toLowerCase()} ${(item.genres ?? []).join(" ").toLowerCase()}`;
  const year = itemYear(item);
  const genres = item.genres ?? [];

  if (intent.like) {
    const likeName = intent.like.toLowerCase();
    if (name === likeName) {
      score += 110;
      why.push("Exact match");
    } else if (name.startsWith(likeName)) {
      score += 24;
    }
    for (const title of similarTitles(intent.like)) {
      if (name === title.toLowerCase() || name.includes(title.toLowerCase())) {
        score += 42;
        why.push(`Similar to ${intent.like}`);
      }
    }
  }

  for (const term of intent.terms) {
    if (intent.like && intent.like.toLowerCase().includes(term)) continue;
    if (name.includes(term)) score += 18;
    else if (hay.includes(term)) score += 6;
  }

  let genreHits = 0;
  for (const genre of intent.genres) {
    if (genres.some((g) => g.toLowerCase() === genre.toLowerCase())) {
      genreHits += 1;
      score += 16;
    }
  }
  if (intent.requireAll?.length) {
    const have = genres.map((g) => g.toLowerCase());
    const matched = intent.requireAll.filter((need) => have.includes(need.toLowerCase()));
    if (matched.length === intent.requireAll.length) {
      score += 40;
      why.push(intent.requireAll.join(" + "));
    }
  }
  const seeds = seedTitles(intent).map((title) => title.toLowerCase());
  if (seeds.some((seed) => name === seed || name.includes(seed) || seed.includes(name))) score += 70;
  if (genreHits) why.push(intent.genres.slice(0, 2).join(" · "));

  if (intent.yearFrom && intent.yearTo && year) {
    if (year >= intent.yearFrom && year <= intent.yearTo) {
      score += 22;
      why.push(String(year));
    }
  }

  const rating = Number(item.imdbRating);
  if (!Number.isNaN(rating) && rating > 0) score += rating * 1.4;

  if (intent.type && item.type === intent.type) score += 8;

  if (intent.moods.length && genreHits) why.push(...intent.moods.slice(0, 1));

  return { ...item, score, why: unique(why).slice(0, 3) };
}

function moodSearchTerm(intent: SearchIntent) {
  if (intent.moods.includes("rom-com")) return "romantic comedy";
  if (intent.moods.includes("heist")) return "heist";
  if (intent.moods.includes("true crime")) return "true crime";
  return undefined;
}

function seedTitles(intent: SearchIntent) {
  if (!intent.moods.includes("rom-com")) return [];
  if (intent.yearFrom === 1990) {
    return [
      "10 Things I Hate About You",
      "Notting Hill",
      "Clueless",
      "You've Got Mail",
      "The Wedding Singer",
      "Sleepless in Seattle",
      "My Best Friend's Wedding",
      "There's Something About Mary",
      "Pretty Woman",
      "While You Were Sleeping",
      "She's All That",
      "Never Been Kissed",
    ];
  }
  if (intent.yearFrom === 2000) {
    return ["How to Lose a Guy in 10 Days", "13 Going on 30", "Love Actually", "The Proposal"];
  }
  return ["Crazy Rich Asians", "Anyone But You", "Set It Up", "Notting Hill"];
}

function similarTitles(like: string) {
  const key = like.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
  const hit = Object.entries(SIMILAR).find(([name]) => key.includes(name) || name.includes(key));
  return hit?.[1] ?? [];
}

function itemYear(item: MetaPreview) {
  const raw = String(item.year ?? item.releaseInfo ?? "");
  const match = raw.match(/(19|20)\d{2}/);
  return match ? Number(match[0]) : null;
}

function unique(items: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const key = item.trim();
    if (!key || seen.has(key.toLowerCase())) continue;
    seen.add(key.toLowerCase());
    out.push(key);
  }
  return out;
}

function tropeTitles(intent: SearchIntent): AskTitle[] {
  const q = intent.raw.toLowerCase();
  const out: AskTitle[] = [];
  for (const trope of TROPES) {
    if (!trope.keys.some((key) => q.includes(key))) continue;
    intent.chips = unique([...trope.chips, ...intent.chips]);
    if (trope.kind) intent.type = intent.type ?? trope.kind;
    for (const name of trope.titles) {
      out.push({
        name,
        type: trope.kind ?? intent.type ?? "movie",
        why: trope.chips[0] ?? "match",
      });
    }
  }
  return out.slice(0, 16);
}

async function resolveNamedTitles(wanted: AskTitle[], intent: SearchIntent): Promise<RankedTitle[]> {
  const types = intent.type ? [intent.type] : ["movie", "series"];
  const urls = wanted.flatMap((title) =>
    types
      .filter((type) => !title.type || title.type === type || types.length === 1)
      .slice(0, 1)
      .map((type) => resourceUrl(CINEMETA_URL, "catalog", type, "top", { search: title.name })),
  );
  const results = urls.length ? await loadJsonMany(urls.slice(0, 24)) : [];
  const ranked: RankedTitle[] = [];
  const seen = new Set<string>();

  wanted.forEach((want, index) => {
    const needle = want.name.toLowerCase();
    const year = want.year;
    const pool: MetaPreview[] = [];
    for (const result of results) {
      if (!result.ok) continue;
      const metas = ((result.data as { metas?: MetaPreview[] }).metas ?? []) as MetaPreview[];
      for (const meta of metas) pool.push(meta);
    }
    const match = pickNamed(pool, needle, year);
    if (!match) return;
    const key = `${match.type}:${match.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    ranked.push({
      ...match,
      score: 1000 - index,
      why: want.why ? [want.why] : [],
    });
  });

  return ranked;
}

function pickNamed(pool: MetaPreview[], needle: string, year?: number) {
  const compact = needle.replace(/[^a-z0-9]+/g, " ").trim();
  const scored = pool
    .map((item) => {
      const name = item.name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      let score = 0;
      if (name === compact) score += 100;
      else if (name.startsWith(compact)) score += 70;
      else if (compact.startsWith(name) && name.length > 4) score += 50;
      else if (name.includes(compact) && Math.abs(name.length - compact.length) < 12) score += 30;
      else return null;
      const y = itemYear(item);
      if (year && y) {
        if (y === year) score += 20;
        else if (Math.abs(y - year) <= 1) score += 8;
        else if (Math.abs(y - year) > 8) score -= 25;
      }
      return { item, score };
    })
    .filter((row): row is { item: MetaPreview; score: number } => Boolean(row))
    .sort((a, b) => b.score - a.score);
  return scored[0]?.item;
}
