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
     film             Film, in the date window (photos go in the photos folder)
     interests        Caseback, the four parts you can play with
     signedOnTheBack  Caseback, the three engraved lines
     fullSet          Full set, the spec sheet at the end

   Anything still in [SQUARE BRACKETS] is a placeholder. Search the file for
   "[" to find what is left to fill in.
   ============================================================================ */
window.CONTENT = {

  name: "Nikhil Kurmala",

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
      years: "2023 to now",
      chip: "Consulting",
      place: "Analysis Group, San Francisco",
      title: "Economic consulting",
      text: "Antitrust, pricing and market strategy for Fortune 100 clients across AI, consumer tech, adtech and energy. I turn messy data into the evidence a case or a launch decision rests on.",
      linkText: "My Analysis Group profile",
      link: "https://www.analysisgroup.com/careers/why-analysis-group/our-people/nikhil/",
    },
    engineering: {
      years: "[years]",
      chip: "Engineering",
      place: "[EMPLOYER, CITY]",
      title: "Software engineering",
      text: "[ONE LINE ON WHAT YOU BUILT]",
      linkText: "",
      link: "",
    },
    quant: {
      years: "[years]",
      chip: "Quant",
      place: "[EMPLOYER, CITY]",
      title: "Quant research",
      text: "[ONE LINE ON WHAT YOU MODELED]",
      linkText: "",
      link: "",
    },
    banking: {
      years: "[years]",
      chip: "Banking",
      place: "[EMPLOYER, CITY]",
      title: "Investment banking",
      text: "[ONE LINE ON THE DEALS OR COVERAGE]",
      linkText: "",
      link: "",
    },
    writing: {
      years: "2019",
      chip: "Journalism",
      place: "Wrist Review",
      title: "Watch journalism",
      text: "My own blog and a Wrist Review byline, plus a lot of ghostwriting.",
      linkText: "Read them on Wrist Review",
      link: "https://wristreview.com/?s=NIKHIL+KURMALA",
    },
  },

  /* ---- the order the straps hang on the board, left to right: newest job first.
          Use the names above (consulting, engineering, quant, banking, writing). */
  jobOrder: ["consulting", "engineering", "quant", "banking", "writing"],

  /* ---- Projects (moonphase). Add, remove or reorder the blocks freely.
          The button only shows when link has an address in it. */
  projects: [
    {
      title: "Notch",
      text: "A Mac notch app with agents built in. Drop in a resume or an article and get a summary.",
      linkText: "See it",
      link: "",
    },
    {
      title: "Overflow clone",
      text: "[ONE OR TWO LINES ON WHAT IT DOES]",
      linkText: "See it",
      link: "",
    },
    {
      title: "On device agents",
      text: "Open source models running locally, on my own data.",
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
    {
      title: "Everything on Wrist Review",
      text: "The rest of my pieces for them, in one list.",
      linkText: "See them all",
      link: "https://wristreview.com/?s=NIKHIL+KURMALA",
    },
  ],

  /* ---- Film (date window). Put each photo in the photos folder and list it
          here. landscape: true for a wide photo, false for a tall one. */
  film: [
    { file: "01.jpg", title: "Husky crossing", caption: "[WHERE AND WHEN]. 35mm film.", landscape: false },
    { file: "02.jpg", title: "Counter seat",   caption: "[WHERE AND WHEN]. 35mm film.", landscape: false },
    { file: "03.jpg", title: "Snow platform",  caption: "[WHERE AND WHEN]. 35mm film.", landscape: false },
    { file: "04.jpg", title: "No parking",     caption: "[WHERE AND WHEN]. 35mm film.", landscape: false },
    { file: "05.jpg", title: "Limit 40",       caption: "[WHERE AND WHEN]. 35mm film.", landscape: true  },
    { file: "06.jpg", title: "Carrera",        caption: "[WHERE AND WHEN]. 35mm film.", landscape: false },
    { file: "07.jpg", title: "Departures",     caption: "[WHERE AND WHEN]. 35mm film.", landscape: false },
  ],

  /* ---- Caseback: the four parts you can zoom into. list is the short list
          under the text. photos: file names from the photos folder, for
          example ["whistler.jpg", "tahoe.jpg"]. */
  interests: {
    soccer: {
      title: "Football",
      text: "Pickup football on Fridays, pickup volleyball on Thursdays. A Liverpool fan since I was eight, with the old Warrior kit to prove it.",
      listTitle: "On the pitch",
      list: ["[Your league or team]", "[A favorite Liverpool memory]"],
      photos: [],
    },
    cooking: {
      title: "Cooking and baking",
      text: "Always experimenting with something new, on the stove, in the oven and in the ice cream maker. Tonight: tofu stir fry noodles. Take the pan by the handle and give it a shake.",
      listTitle: "Lately",
      list: ["[Something you cooked]", "[Something you baked]", "[An ice cream flavor]"],
      photos: [],
    },
    snow: {
      title: "Snowboarding",
      text: "An escapement lets the energy out one controlled turn at a time. On a board, that is the whole idea.",
      listTitle: "Where I have ridden",
      list: ["[Mountain 1]", "[Mountain 2]", "[Mountain 3]"],
      photos: [],
    },
    music: {
      title: "Music",
      text: "Electronic, mostly, and festivals like Outside Lands.",
      listTitle: "Top five artists this year",
      list: ["[Artist 1]", "[Artist 2]", "[Artist 3]", "[Artist 4]", "[Artist 5]"],
      photos: [],
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
    role: "Senior Analyst",
    employer: "Analysis Group",
    employerLink: "https://www.analysisgroup.com/careers/why-analysis-group/our-people/nikhil/",
    city: "San Francisco",
    includedInBox: "Python, PySpark, SQL, Databricks, Azure OpenAI",
    origin: "Singapore. B.S. Applied Mathematics, UCLA, 2023.",
    importDuties: "A standard H-1B transfer. No lottery, any time of year, and no $100,000 fee for a transfer within the US.",
    papers: "Current H-1B, in its first year, so plenty of time on the clock. I can start as soon as the transfer is filed.",
  },

};
