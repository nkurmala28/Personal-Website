/* ============================================================================
   CONTENT FILE for nikhil's watch site.
   Everything you are likely to change lives here. Edit the text between the
   quote marks, save, and the site picks it up on the next load. No rebuild.

   Three rules keep it from breaking:
     1. Keep the quote marks and the comma at the end of each line.
     2. If your text contains a straight double quote, write it as \"
     3. Leave the names on the left of each colon (title:, text: ...) alone.
   If the file ever has a mistake in it, the site falls back to its built-in
   text and still loads, so a typo here cannot take the site down.

   WHERE THINGS ARE, in the order the site shows them
     contact          email, LinkedIn and resume (Start screen and Full set)
     jobs             Strap chapter, one block per job
     jobOrder         the order the straps sit on the display, left to right
     projects         Projects, on the moonphase
     articles         Articles, on the small seconds
     filmCaption      Caption beneath Film in Selected work
     film             Film, in the date window (photos go in the photos folder)
     interests        Caseback, the four parts you can play with
     signedOnTheBack  Caseback, the three engraved lines
     fullSet          Full Specifications, the spec sheet at the end

   Anything still in [SQUARE BRACKETS] is a placeholder. Search the file for
   "[" to find what is left to fill in.
   ============================================================================ */
window.CONTENT = {
  // Set to the deployed shared leaderboard API URL (see leaderboard/README.md).
  soccerLeaderboardUrl: "",


  name: "Nikhil Kurmala",

  /* ---- the two quiet lines under the name on the first screen. tagline is set in the
          body type, education in the small mono labels. Leave either empty to hide it. */
  tagline: "Strategy and Litigation Consulting",
  education: "UCLA · Applied Math + Computing",

  /* ---- contact. resume: put the file in this folder (for example resume.pdf)
          and write its name here. Left empty, the site says "Resume on request". */
  contact: {
    email: "nikhilkurmala28@gmail.com",
    linkedin: "https://www.linkedin.com/in/nikhilk28/",
    resume: "",
  },

  /* ---- Strap chapter: one card per job. chip is the short label under its strap
          on the rail (or its button). years shows under it in small type (write "[years]" until
          you know them), and again on the right of the card. place is where you did the job,
          employer and city (for example "Analysis Group, San Francisco"), shown on the left of
          the card above the paragraph; leave it empty and the years sit there alone. title is
          the card's heading, text its paragraph (start with the work itself: the place and the
          years are already shown above it). link and linkText are optional; leave both empty
          for no link. */
  jobs: {
    consulting: {
      years: "2022 to Present",
      chip: "Consulting",
      place: "Analysis Group, San Francisco",
      title: "Economic Consulting",
      text: "Work with leadership teams to navigate high-stakes business and legal questions, combining market analysis, terabyte-scale data, and strategic storytelling. Predominantly work on antitrust litigation and strategy engagements for Fortune 20 companies across AI, consumer tech, AdTech, and finance.",
      linkText: "My Analysis Group profile",
      link: "https://www.analysisgroup.com/careers/why-analysis-group/our-people/nikhil/",
    },
    quant: {
      years: "2021",
      chip: "Quant Researcher",
      place: "Arch Capital, Remote",
      title: "Quant Research",
      text: "Researched and tested short-term systematic trading strategies, building Python tools to evaluate mean reversion in ETF pairs and presenting findings to senior managers. The work spanned asset pricing, ETF management, and portfolio optimization.",
      linkText: "",
      link: "",
    },
     engineering: {
      years: "2020",
      chip: "Software Engineer",
      place: "Automation Anywhere, Remote",
      title: "Software Engineering",
      text: "Basically built bots before they became ‘Agents.’\n\nWorked with the Enterprise Engineering team building a production JavaScript module for parsing, evaluating UI automation approaches using Python and Selenium, and implemented Automation Anywhere bots to automate interactive forms.",
      linkText: "",
      link: "",
    },
    banking: {
      years: "2018",
      chip: "Investment Banking",
      place: "RiverBridge Investment Advisors",
      title: "Investment banking",
      text: "Interned during senior year of high school, analyzing financials for 300+ SMEs to identify prospective IPO clients and supporting valuations for a fashion label and an EdTech company. Also helped identify and coordinate with potential buyers for a manufacturing facility in South India.",
      linkText: "",
      link: "",
    },
    writing: {
      years: "2019",
      chip: "Journalist",
      place: "WristReview & other publications",
      title: "Independent Watch Blogger",
      text: "Wrote 50+ articles across watch publications, including bylined work for WristReview and ghostwritten pieces for other blogs, specializing in the mechanics behind modern watch movements.",
      linkText: "Read them on Wrist Review",
      link: "https://wristreview.com/?s=NIKHIL+KURMALA",
    },
  },

  /* ---- the order the straps hang on the board, left to right: newest job first.
          Use the names above (consulting, engineering, quant, banking, writing). */
  jobOrder: ["consulting", "quant", "engineering","writing", "banking"],

  /* ---- Projects (moonphase). Add, remove or reorder the blocks freely.
          The button only shows when link has an address in it.
          To show a film of a project: put the file in the photos folder (an .mp4,
          ideally under about 3 MB) and add a line to that project's block, for example
            video: "photos/notch.mp4",
          or, for a still picture instead, image: "photos/notch.jpg",
          Until a project has one, its screen on the dial says "Work in progress". */
  projects: [
    {
      title: "Notch-y",
      text: "Notch-y turns the MacBook notch into a native macOS workspace, with a clipboard history, calendar and meeting alerts, a focus timer, scenic live weather, and music controls that live in the notch itself. Behind it works a staff of AI agents, led by a Planner that shapes your day, with a Reader that summarises whatever you’re looking at and more specialists for the rest of your work.",
      linkText: "See it",
      link: "",
    },
    {
      title: "Whisper",
      text: "Whisper is a native macOS dictation app I built in Swift. It uses Deepgram’s Nova-3 for real-time speech recognition, cleans the transcript with Claude Sonnet, and reads on-screen context through the Accessibility API to spell names correctly. It learns from my corrections, runs fully offline with WhisperKit.\n\nMainly also built this since I didn't want to pay for another subscription.",
      linkText: "See it",
      link: "",
    },
    {
      title: "The Council",
      text: "Can’t make up your mind? Hand it to The Council: five randomly drawn philosophers, refereed by Socrates, argue your question, scheme, flirt, brawl and then vote on a verdict. The AI writes the trash talk, and my code runs the rules (casting, persuasion, alliances, the vote count), so every debate is fair, unpredictable and never the same twice.",
      linkText: "See it",
      link: "",
    },
  ],

  /* ---- Articles (small seconds). Same idea as projects. */
  articlesNote: "These are the bylined ones. I have ghostwritten many more.",
  articles: [
    {
      title: "A Rare Vintage Panerai Radiomir 'Type A' ref.6152 Watch Auctioned For 226.000€",
      text: "Wrist Review, February 2019. A 1953 Radiomir that belonged to an Italian rear admiral sold for nearly twice its top estimate, and its case and movement came from Rolex.",
      linkText: "Read it",
      link: "https://wristreview.com/a-rare-vintage-panerai-radiomir-type-a-ref-6152-watch-auctioned-for-226-000e/",
    },
    {
      title: "Ulysse Nardin Freak X Silicium Marquetry Watch",
      text: "Wrist Review, February 2019. Dials set from about 120 hand-fitted silicon pieces, on a watch with no hands: the movement itself turns once an hour and points to the minutes.",
      linkText: "Read it",
      link: "https://wristreview.com/ulysse-nardin-freak-x-silicium-marquetry-watch/",
    },
    {
      title: "SIHH 2019: Piaget Polo S Green Dial Limited Edition Watch (Live Pics)",
      text: "Wrist Review, January 2019. The green dial Polo S from SIHH, limited to 500 pieces, on Piaget's thin in-house automatic.",
      linkText: "Read it",
      link: "https://wristreview.com/sihh-2019-piaget-polo-s-green-dial-limited-edition-watch-live-pics/",
    },
    {
      title: "Introducing The Oris Aquis Date Relief Watch",
      text: "Wrist Review, February 2019. A diver made to back a swimmer's planned 800 km crossing of Lake Baikal, for water conservation.",
      linkText: "Read it",
      link: "https://wristreview.com/introducing-the-oris-aquis-date-relief-watch/",
    },
  ],

  /* ---- Film (date window). Put each photo in the photos folder and list it
          here. landscape: true for a wide photo, false for a tall one. */
  /* Caption beneath Film in the Selected work section. */
  filmCaption: "Reached the amateur photographer age. Shot on 35mm",
  film: [
    { file: "film-ice-cream-truck.jpg", title: "Ice cream truck", caption: "35mm film.", landscape: false },
    { file: "film-christmas.jpg", title: "Christmas evening", caption: "35mm film.", landscape: false },
    { file: "film-forest-light.jpg", title: "Forest light", caption: "35mm film.", landscape: false },
    { file: "film-husky.jpg", title: "A hello on the sidewalk", caption: "35mm film.", landscape: false },
    { file: "film-winter-train.jpg", title: "Winter train", caption: "35mm film.", landscape: false },
    { file: "film-snow-bicycle.jpg", title: "Snowbound bicycle", caption: "35mm film.", landscape: false },
    { file: "film-carrera.jpg", title: "Carrera", caption: "35mm film.", landscape: false },
    { file: "film-sunset.jpg", title: "Sunset silhouettes", caption: "35mm film.", landscape: true },
    { file: "film-departures.jpg", title: "Departures", caption: "35mm film.", landscape: false },
    { file: "film-river-light.jpg", title: "River light", caption: "35mm film.", landscape: false },
    { file: "film-park-dog.jpg", title: "Afternoon in the park", caption: "35mm film.", landscape: false },
    { file: "film-mountain-valley.jpg", title: "Mountain valley", caption: "35mm film.", landscape: false },
  ],

  /* ---- Caseback: the four parts you can zoom into. list is the short list
          under the text. photos: file names from the photos folder, for
          example ["whistler.jpg", "tahoe.jpg"]. */
  interests: {
    soccer: {
      title: "Soccer",
      text: "Pickup football on Fridays, VOLO league on Thursdays. The first sport I truly fell in love with. A Liverpool fan since I was eight, with the 2012/13 Warrior kit to prove it.",
      photos: [],
    },
    cooking: {
      title: "Cooking and baking",
      text: "Always experimenting with something new, on the stove, in the oven and with my beloved Ninja Creami. Tonight: tofu stir fry noodles. Take the pan by the handle and give it a shake.",
      listTitle: "Lately",
      list: ["Experimenting with textured vegetable protein!", "Concocting random sorbet combinations"],
      photos: [],
    },
    snow: {
      title: "Snowboarding",
      text: "An escapement lets the energy out one controlled turn at a time. On a board, that is the whole idea. I really want to learn to hit the jumps this seasons",
      photos: [],
    },
    music: {
      title: "Music",
      text: "I like most beeps and boops.",
      listTitle: "Top five artists this year",
      // Replace each URL with your favorite song. Blank URLs display plain text.
      list: [
        { name: "Oasis", url: "https://open.spotify.com/search/Oasis" },
        { name: "Empire Of The Sun", url: "https://open.spotify.com/search/Empire%20Of%20The%20Sun" },
        { name: "Loyle Carner", url: "https://open.spotify.com/search/Loyle%20Carner" },
        { name: "Noah Kahan", url: "https://open.spotify.com/search/Noah%20Kahan" },
        { name: "Baby Keem", url: "https://open.spotify.com/search/Baby%20Keem" },
      ],
      photos: [],
      /* the songs the record player plays when the needle drops, in order.
         Put the MP3 files and their cover images in the music folder, then add
         one line per song, for example:
           { file: "music/song.mp3", title: "Song name", artist: "Artist", cover: "music/song.jpg" },
         cover is optional. Each needle drop moves on to the next song.
         This page is public: only add songs you have the right to share
         (your own mixes, or tracks licensed for reuse). */
      tracks: [
        { file: "music/saxophone-jazz-rainy-night.mp3", title: "Saxophone Jazz Rainy Night", artist: "Alex Morgan" },
      ],
    },
  },

  /* ---- Caseback: the three engraved lines. */
  signedOnTheBack: [
    { title: "Made in Singapore", text: "Grew up in Pasir Ris. Still home time." },
    { title: "Finished at UCLA", text: "B.S. Applied Mathematics, Computing, 2023." },
    { title: "Regulated in San Francisco", text: "Home since 2023." },
  ],

  /* ---- Full set: the spec sheet on the last screen. */
  fullSet: {
    city: "San Francisco",
    includedInBox: "Python, SQL, Databricks, AI, Strategy, etc.",
    origin: "Singapore",
    importDuties: "H-1B transfer",
    /* The Full Specifications rows shown are Name, Location (city), Origin,
       Price, Import Duties (importDuties) and Contact (from contact above). papers is not
       shown at the moment (the Box and papers row is hidden), kept here in case it comes back.
       Tools Included (includedInBox) is also kept here; its row is commented out in index.html. */
  },

};
