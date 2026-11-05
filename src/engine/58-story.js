// Story: dialogue box, voice lines, the script, and the prologue director.
// Every line has an id. Drop a recording in voice/ and list it in voice/manifest.js to hear it;
// lines without a recording play as subtitles. See VOICE_SCRIPT.md for the full list.
const CAST = {
  manu: { name: 'MANU', color: '#f3d98c' },
  you: { name: 'YOU', color: '#b8f5e1' },
  darren: { name: 'DARREN', color: '#ff9a7a' },
  shorty: { name: 'SHORTY', color: '#9fd86a' },
  kev: { name: 'KEV', color: '#ffb04a' },
  mikey: { name: 'MIKEY', color: '#7ac8ff' },
  pita: { name: 'UNCLE PITA', color: '#e0c8ff' },
  debtor: { name: 'DEBTOR', color: '#ffd0a0' }, // renamed per hustle
  tipene: { name: 'TIPENE', color: '#e8ba55' },
  rawiri: { name: 'RAWIRI', color: '#c8e0a0' },
  lani: { name: 'AUNTY LANI', color: '#ffb8d8' },
  rival: { name: 'RIVAL', color: '#ff7070' }, // renamed to the rival crew's name
  uce: { name: 'BRO', color: '#d6d6d6' }, aunty: { name: 'AUNTY', color: '#ffc8a8' }, kid: { name: 'KID', color: '#a8e0ff' }, van: { name: 'MR SWIRL', color: '#ff9ccf' }, local: { name: 'LOCAL', color: '#dddddd' },
};
const SCRIPT = {
  proIntro: [
    { who: 'manu', id: 'pro_01', text: 'Oi. Pass us that other controller, cuz.' },
    { who: 'you', id: 'pro_02', text: 'This thing still works? It\'s older than me.' },
    { who: 'manu', id: 'pro_03', text: 'Kiwi Knuckle Kings Two, bro. Turbo edition. Classic.' },
    { who: 'manu', id: 'pro_04', text: 'Rematch. Loser shouts the feed.' },
    { who: 'you', id: 'pro_05', text: 'You\'re on.' },
  ],
  barkYouHit: [
    { who: 'manu', id: 'bark_hit_1', text: 'Ohh, cheap shot!' },
    { who: 'manu', id: 'bark_hit_2', text: 'Bro, stop spamming kick.' },
    { who: 'manu', id: 'bark_hit_3', text: 'That\'s lag, that is. Controller\'s munted.' },
    { who: 'manu', id: 'bark_hit_4', text: 'Sweet as, sweet as. I\'m just warming up.' },
  ],
  barkManuHit: [
    { who: 'manu', id: 'bark_got_1', text: 'Get that! Get that!' },
    { who: 'manu', id: 'bark_got_2', text: 'Too easy, cuz.' },
    { who: 'manu', id: 'bark_got_3', text: 'Kevo\'s the champ, eh.' },
  ],
  round1You: [
    { who: 'manu', id: 'r1_win_1', text: 'Lucky. That\'s all that was.' },
    { who: 'you', id: 'r1_win_2', text: 'Lucky, aye? Keep telling yourself that.' },
  ],
  round1Manu: [
    { who: 'manu', id: 'r1_lose_1', text: 'Told you. Undefeated in this whare.' },
    { who: 'you', id: 'r1_lose_2', text: 'Round two, bro. Round two.' },
  ],
  debt: [
    { who: 'manu', id: 'debt_talk_01', text: 'Real talk though... you still skint?' },
    { who: 'you', id: 'debt_talk_02', text: 'Always, cuz.' },
    { who: 'manu', id: 'debt_talk_03', text: 'You remember Darren? Skinny fulla from down the road?' },
    { who: 'you', id: 'debt_talk_04', text: 'Darren with the Commodore? Yeah.' },
    { who: 'manu', id: 'debt_talk_05', text: 'He owes me four hundred bucks. Been dodging me three weeks now.' },
    { who: 'manu', id: 'debt_talk_06', text: 'Every time I go round, his missus reckons he\'s at work.' },
    { who: 'you', id: 'debt_talk_07', text: 'Darren? Work?' },
    { who: 'manu', id: 'debt_talk_08', text: 'Exactly.' },
  ],
  matchYou: [{ who: 'manu', id: 'match_win', text: 'Yeah, yeah. Feed\'s on me then.' }],
  matchManu: [{ who: 'manu', id: 'match_lose', text: 'Ha! You\'re shouting the feed, loser.' }],
  offer: [
    { who: 'manu', id: 'offer_01', text: 'Anyway. Four hundred, bro. I need that.' },
    { choice: [
      { who: 'you', id: 'offer_you_a', text: 'Want me to go have a word with him?', next: 'offerYes' },
      { who: 'you', id: 'offer_you_b', text: 'Sounds like your problem, cuz.', next: 'offerNo' },
    ] },
  ],
  offerNo: [
    { who: 'manu', id: 'offer_02', text: 'Wow. Thought you were whānau.' },
    { choice: [{ who: 'you', id: 'offer_you_c', text: 'Nah, I\'m playing. I\'ll go have a word.', next: 'offerYes' }] },
  ],
  offerYes: [
    { who: 'manu', id: 'offer_03', text: '...For real? You\'d do that?' },
    { who: 'you', id: 'offer_04', text: 'He knows me. I\'ll sort it.' },
    { who: 'manu', id: 'offer_05', text: 'Last I heard he\'s always hanging round {spot}.' },
    { who: 'manu', id: 'offer_06', text: 'Bring back the whole four hundred and you\'re getting a cut. Don\'t do nothing stupid, eh.' },
    { who: 'you', id: 'offer_07', text: 'Me? Never.', result: 'accepted' },
  ],
  darrenMeet: [
    { who: 'darren', id: 'darren_01', text: 'Ohh... hey bro. What you doing round this way?' },
    { choice: [{ who: 'you', id: 'darren_you_1', text: 'Manu sent me. You know what this is about.', next: 'darrenExcuse' }] },
  ],
  darrenExcuse: [
    { who: 'darren', id: 'darren_02', text: 'Look, I was gonna sort him out, true story. Just had a rough couple of weeks.' },
    { choice: [
      { who: 'you', id: 'darren_you_soft', text: 'Half now, rest by Friday. Don\'t make me come back.', next: 'darrenPays' },
      { who: 'you', id: 'darren_you_hard', text: 'Nah. The whole four hundred. Today.', next: 'darrenFights' },
    ] },
  ],
  darrenPays: [{ who: 'darren', id: 'darren_03', text: '...Yeah. Yeah, alright. Here\'s two hundred. Tell him Friday, eh.', result: 'smooth' }],
  darrenFights: [{ who: 'darren', id: 'darren_04', text: 'I told you, I ain\'t got it! You wanna go, bro? Let\'s go.', result: 'fight' }],
  darrenBeaten: [
    { who: 'darren', id: 'darren_05', text: 'Alright! Alright... take it. Take it. Four hundred. Happy?' },
    { who: 'you', id: 'darren_06', text: 'Should\'ve just paid him, Daz.', result: 'paid' },
  ],
  darrenAgain: [{ who: 'darren', id: 'darren_07', text: 'I already paid, bro. Leave us alone.' }],
  manuWaiting: [{ who: 'manu', id: 'manu_wait', text: 'Any luck with Darren? He\'s round {spot}.' }],
  returnSmooth: [
    { who: 'manu', id: 'ret_s1', text: 'Two hundred? ...Better than nothing, I suppose.' },
    { who: 'you', id: 'ret_s2', text: 'Rest by Friday. He knows I\'ll come back.' },
    { who: 'manu', id: 'ret_s3', text: 'Chur. Here, fifty for your gas.', goto: 'returnEnd' },
  ],
  returnHard: [
    { who: 'manu', id: 'ret_h1', text: 'Bro... the whole four hundred? What\'d you do to him?' },
    { who: 'you', id: 'ret_h2', text: 'We had a chat. Bit of a loud one.' },
    { who: 'manu', id: 'ret_h3', text: 'Hard out. Here, a hundred\'s yours.', goto: 'returnEnd' },
  ],
  returnEnd: [
    { who: 'manu', id: 'ret_4', text: 'Bro, real talk... you\'re good at this, eh.' },
    { who: 'manu', id: 'ret_5', text: 'My mate Shorty, the fulla I get my green off, he\'s always moaning. Reckons half the town owes him money.' },
    { who: 'manu', id: 'ret_6', text: 'Want me to give him your number?' },
    { choice: [
      { who: 'you', id: 'ret_you_yes', text: 'Yeah, flick it to him.', next: 'numberYes' },
      { who: 'you', id: 'ret_you_no', text: 'Nah, I\'m good, cuz.', next: 'numberNo' },
    ] },
  ],
  numberYes: [{ who: 'manu', id: 'ret_7', text: 'Sweet as. He\'ll flick you a text. Don\'t tell Aunty.', result: 'done' }],
  numberNo: [{ who: 'manu', id: 'ret_8', text: 'Easy money, bro. ...Yeah, I\'m giving it to him anyway.', result: 'done' }],
  manuAfter: [{ who: 'manu', id: 'manu_after', text: 'Shorty text you yet? Keep your phone on you, bro.' }],

  // Shorty's place: three people owe him.
  shortyMeet: [
    { who: 'shorty', id: 'sh_01', text: 'So you\'re Manu\'s cousin. Thought you\'d be bigger.' },
    { who: 'you', id: 'sh_02', text: 'Manu said you had a problem.' },
    { who: 'shorty', id: 'sh_03', text: 'Problems, bro. Plural. Three of \'em.' },
    { who: 'shorty', id: 'sh_04', text: 'Kev at the panel shop owes me six hundred. Reckons he forgot. He didn\'t forget.' },
    { who: 'shorty', id: 'sh_05', text: 'Mikey owes three hundred. Skinny little hōha. He runs, every time. Hope you got your running shoes on.' },
    { who: 'shorty', id: 'sh_06', text: 'And Uncle Pita. Hundred and fifty. ...He\'s alright, Pita. Just get it if you can, eh.' },
    { who: 'shorty', id: 'sh_07', text: 'Bring it all back and you get a quarter. Sweet?' },
    { choice: [{ who: 'you', id: 'sh_you_1', text: 'Sweet. Text me where they\'re at.', result: 'jobs' }] },
  ],
  shortyWaiting: [{ who: 'shorty', id: 'sh_wait', text: 'Still waiting on my money, bro. Kev, Mikey, Pita. It\'s all in your phone.' }],

  kevMeet: [
    { who: 'kev', id: 'kev_01', text: 'Who the hell are you?' },
    { choice: [{ who: 'you', id: 'kev_you_1', text: 'Shorty sent me. Six hundred, Kev.', next: 'kevRefuses' }] },
  ],
  kevRefuses: [
    { who: 'kev', id: 'kev_02', text: 'Shorty can come get it himself. Now get off my lot before I put you through the windscreen.' },
    { choice: [{ who: 'you', id: 'kev_you_2', text: 'I\'m not going anywhere.', next: 'kevFights' }] },
  ],
  kevFights: [{ who: 'kev', id: 'kev_03', text: 'Right. Your funeral, boy.', result: 'fight' }],
  kevBeaten: [
    { who: 'kev', id: 'kev_04', text: 'Alright! Alright... it\'s in the till. Take it.' },
    { who: 'you', id: 'kev_05', text: 'Pleasure doing business, Kev.', result: 'paid' },
  ],
  kevAgain: [{ who: 'kev', id: 'kev_06', text: 'You got your money. Piss off.' }],

  mikeyRuns: [{ who: 'mikey', id: 'mikey_01', text: 'Nah nah nah, not today, bro!' }],
  mikeyCaught: [
    { who: 'mikey', id: 'mikey_02', text: 'Okay! Okay! I give up! Bro, you\'re fast.' },
    { who: 'you', id: 'mikey_03', text: 'Three hundred, Mikey.' },
    { who: 'mikey', id: 'mikey_04', text: '...That\'s all I got. Tell Shorty I\'m sorry, eh. Tell him I\'m sorry.', result: 'paid' },
  ],
  mikeyAgain: [{ who: 'mikey', id: 'mikey_05', text: 'I already paid! Leave us alone, man.' }],

  pitaMeet: [
    { who: 'pita', id: 'pita_01', text: 'Kia ora, boy. You\'re one of Shorty\'s, aren\'t you.' },
    { who: 'you', id: 'pita_02', text: 'He says you owe him a hundred and fifty, Uncle.' },
    { who: 'pita', id: 'pita_03', text: 'I know, I know. It\'s for my back, the weed. Doctor won\'t give me nothing that works.' },
    { who: 'pita', id: 'pita_04', text: 'I\'ve got it here. It\'s the mokos\' school uniform money, but... here.' },
    { choice: [
      { who: 'you', id: 'pita_you_take', text: 'Sorry, Uncle. It\'s not personal.', next: 'pitaTake' },
      { who: 'you', id: 'pita_you_cover', text: 'Keep it, Uncle. I\'ll square it with Shorty.', next: 'pitaCover' },
    ] },
  ],
  pitaTake: [{ who: 'pita', id: 'pita_05', text: '...Tell him we\'re square.', result: 'take' }],
  pitaCover: [{ who: 'pita', id: 'pita_06', text: 'Bless you, boy. Your nan raised you right.', result: 'cover' }],
  pitaAgain: [{ who: 'pita', id: 'pita_07', text: 'Look after yourself out there, boy.' }],

  shortyBackAll: [
    { who: 'shorty', id: 'sh_back_1', text: 'Kev, Mikey and Pita? All three? Bro, you\'re a machine.', goto: 'shortyBackEnd' },
  ],
  shortyBackCovered: [
    { who: 'shorty', id: 'sh_back_2', text: 'Pita\'s money smells a lot like your money, bro.' },
    { who: 'you', id: 'sh_back_3', text: 'Money\'s money.' },
    { who: 'shorty', id: 'sh_back_4', text: 'Ha. Fair. Paid is paid.', goto: 'shortyBackEnd' },
  ],
  shortyBackShort: [
    { who: 'shorty', id: 'sh_back_5', text: 'You let Pita off? Soft, bro. That hundred and fifty\'s coming out of your end then.', goto: 'shortyBackEnd' },
  ],
  shortyBackEnd: [
    { who: 'shorty', id: 'sh_back_6', text: 'Here. That\'s your quarter.' },
    { who: 'shorty', id: 'sh_back_7', text: 'Listen. People are talking about you. The crews down at Clendon skate park want to see you.' },
    { who: 'shorty', id: 'sh_back_8', text: 'That\'s a big deal, bro. Don\'t muck it up.', result: 'done' },
  ],
};

// Phone texts (not voiced). {vars} are filled in by the game.
// Chapter One: the run to Southmall, Aunty Lani's dairy, the rival crew, and Manu gets jumped.
Object.assign(SCRIPT, {
  c1Rawiri: [
    { who: 'rawiri', id: 'c1_01', text: 'You Tipene\'s new boy? Took your time.' },
    { who: 'manu', id: 'c1_02', text: 'Traffic, uce. You know Great South Road.' },
    { who: 'rawiri', id: 'c1_03', text: 'Here. Don\'t open it, don\'t lose it, don\'t get pulled over with it.' },
    { who: 'you', id: 'c1_04', text: 'Sweet. Straight to Tipene.' },
  ],
  c1Deliver: [
    { who: 'tipene', id: 'c1_05', text: 'There he is. No cops on your tail? Good.' },
    { who: 'tipene', id: 'c1_06', text: 'Two hundred. And there\'s something else.' },
    { who: 'tipene', id: 'c1_07', text: 'Aunty Lani at the Clendon dairy. She looks after us, we look after her. Go see her.' },
  ],
  c1Hot: [{ who: 'tipene', id: 'c1_08', text: 'You brought the cops here? Lose them first, then come back.' }],
  c1Lani: [
    { who: 'lani', id: 'c1_09', text: 'Oh, you\'re the one Tipene sent. Thank God.' },
    { who: 'lani', id: 'c1_10', text: 'Those {rival} boys keep coming in, filling their pockets, giving my mokos lip.' },
    { who: 'lani', id: 'c1_11', text: 'They hang round the skate park after school. Please, love. Make it stop.' },
    { who: 'you', id: 'c1_12', text: 'Leave it with me, Aunty.' },
  ],
  c1Rivals: [
    { who: 'rival', id: 'c1_13', text: 'Oi. You lost? This is our park.' },
    { who: 'you', id: 'c1_14', text: 'Aunty Lani\'s dairy. You\'re done going in there.' },
    { who: 'rival', id: 'c1_15', text: 'Says who?' },
    { choice: [
      { text: 'Says Tipene. You want that problem?', id: 'c1_c1', result: 'talk' },
      { text: 'Says me. Come on then.', id: 'c1_c2', result: 'fight' },
    ] },
  ],
  c1RivalsBackOff: [{ who: 'rival', id: 'c1_16', text: '...Whatever, bro. Plenty of other dairies.' }],
  c1RivalsFight: [{ who: 'rival', id: 'c1_17', text: 'Tipene\'s not here, egg. Get him, boys.' }],
  c1ManuDown: [
    { who: 'manu', id: 'c1_18', text: 'Cuz... took you long enough.' },
    { who: 'manu', id: 'c1_19', text: 'Those {rival} boys. Said it was for the park. My ribs, bro.' },
    { who: 'you', id: 'c1_20', text: 'Can you walk? Car\'s over here. I\'ll get you home.' },
  ],
  c1Home: [
    { who: 'manu', id: 'c1_21', text: 'Cheers, cuz. Don\'t tell Mum about this.' },
    { who: 'manu', id: 'c1_22', text: 'Tipene rang. He reckons you\'re the real deal now.' },
    { who: 'manu', id: 'c1_23', text: 'Just... watch yourself, eh. This doesn\'t stop now.' },
  ],
});

// Shorty's ongoing hustles (repeatable side jobs after his chapter).
Object.assign(SCRIPT, {
  hustleMeet: [
    { who: 'debtor', id: 'hus_01', text: 'Yeah? Who\'s asking?' },
    { who: 'you', id: 'hus_02', text: 'Shorty. You owe him {amount}.' },
    { choice: [
      { text: 'Sort it now and we\'re sweet.', id: 'hus_c1', result: 'ask' },
      { text: 'Pay up or I take it off you.', id: 'hus_c2', result: 'threat' },
    ] },
  ],
  hustlePays: [{ who: 'debtor', id: 'hus_03', text: 'Alright, alright. Here. Tell him we\'re square.' }],
  hustleScared: [{ who: 'debtor', id: 'hus_04', text: 'Easy, easy! Take it. Just go, eh.' }],
  hustleRefuses: [{ who: 'debtor', id: 'hus_05', text: 'Shorty can come get it himself. You wanna go, bro?' }],
  hustleBeaten: [{ who: 'debtor', id: 'hus_06', text: 'Okay! Okay. It\'s in my pocket. Take it.' }],
  hustleAgain: [{ who: 'debtor', id: 'hus_07', text: 'I already paid, bro. Leave me alone.' }],
});
// The living street (Run 22): what locals say as you pass (speech bubbles), and the street moments.
Object.assign(SCRIPT, {
  ambGreet: [
    { who: 'local', id: 'amb_g1', text: 'Chur.' }, { who: 'local', id: 'amb_g2', text: 'Sup, uce.' }, { who: 'local', id: 'amb_g3', text: 'Kia ora, bro.' },
    { who: 'local', id: 'amb_g4', text: 'How\'s it, cuz?' }, { who: 'local', id: 'amb_g5', text: 'Sweet as.' }, { who: 'local', id: 'amb_g6', text: 'Malo, bro.' },
    { who: 'local', id: 'amb_g7', text: 'All good, bro?' }, { who: 'local', id: 'amb_g8', text: 'Mean shoes, uce.' },
  ],
  ambNight: [{ who: 'local', id: 'amb_n1', text: 'Bit late to be out, eh.' }, { who: 'local', id: 'amb_n2', text: 'Cold one tonight.' }, { who: 'local', id: 'amb_n3', text: 'Mind how you go, bro.' }],
  ambKnown: [{ who: 'local', id: 'amb_w1', text: 'That\'s the fulla who sorted Darren!' }, { who: 'local', id: 'amb_w2', text: 'Heard about you, uce.' }, { who: 'local', id: 'amb_w3', text: 'Respect, bro.' }, { who: 'local', id: 'amb_w4', text: 'Don\'t want no trouble, eh.' }],
  ambHeat: [{ who: 'local', id: 'amb_h1', text: 'Cops are looking for you, bro.' }, { who: 'local', id: 'amb_h2', text: 'The feds were just round here.' }, { who: 'local', id: 'amb_h3', text: 'Keep your head down, eh.' }],
  ambWeapon: [{ who: 'local', id: 'amb_a1', text: 'Whoa, easy with that, bro.' }, { who: 'local', id: 'amb_a2', text: 'Put that away, eh.' }, { who: 'local', id: 'amb_a3', text: 'Nah, don\'t bring that round here.' }],
  ambKid: [{ who: 'kid', id: 'amb_y1', text: 'Uncle! Watch this!' }, { who: 'kid', id: 'amb_y2', text: 'Hi!' }, { who: 'kid', id: 'amb_y3', text: 'You play league?' }],
  ambBump: [{ who: 'local', id: 'amb_b6', text: 'Oi! Watch it, egg!' }, { who: 'local', id: 'amb_b7', text: 'Bro, what the?' }, { who: 'local', id: 'amb_b8', text: 'Eyes up, uce!' }, { who: 'local', id: 'amb_b9', text: 'Ow! Watch where you\'re going.' }],
  ambFightStart: [{ who: 'local', id: 'amb_f1', text: 'Fight! Fight!' }, { who: 'local', id: 'amb_f2', text: 'Ohhh it\'s going down!' }, { who: 'local', id: 'amb_f3', text: 'Get the phones out!' }, { who: 'local', id: 'amb_f4', text: 'Bro, they\'re scrapping!' }],
  ambFightCheer: [{ who: 'local', id: 'amb_f5', text: 'Ooooh!' }, { who: 'local', id: 'amb_f6', text: 'Get him!' }, { who: 'local', id: 'amb_f7', text: 'Hands up, bro!' }, { who: 'local', id: 'amb_f8', text: 'He felt that!' }, { who: 'local', id: 'amb_f9', text: 'Chur!' }],
  ambFlee: [{ who: 'local', id: 'amb_x1', text: 'Nah, I\'m out!' }, { who: 'local', id: 'amb_x2', text: 'Run!' }, { who: 'local', id: 'amb_x3', text: 'Not getting involved, eh.' }],
  ambSmoke: [
    { who: 'uce', id: 'amb_s1', text: 'Bro. You got a smoke?' },
    { choice: [
      { text: 'Here, have a couple. ($2)', id: 'amb_sc1', result: 'give' },
      { text: 'Nah, sorry bro.', id: 'amb_sc2', result: 'no' },
    ] },
  ],
  ambSmokeYes: [{ who: 'uce', id: 'amb_s2', text: 'Chur, bro. Here, I\'ll tell you something for free.' }],
  ambSmokeNo: [{ who: 'uce', id: 'amb_s3', text: 'All good, eh.' }],
  ambRumour1: [{ who: 'uce', id: 'amb_r1', text: 'Cops like to park up at the Southmall car park. Drive nice round there.' }],
  ambRumour2: [{ who: 'uce', id: 'amb_r2', text: 'That gym on Great South Road. Train there and you hit way harder.' }],
  ambRumour3: [{ who: 'uce', id: 'amb_r3', text: 'Grab an energy drink from the dairy and you can run all day.' }],
  ambRumour4: [{ who: 'uce', id: 'amb_r4', text: 'Shorty always has work if you\'re keen. Keep your phone on.' }],
  ambRumour5: [{ who: 'uce', id: 'amb_r5', text: 'Tap block right as they swing and they\'re wide open. Learnt that the hard way.' }],
  ambRumour6: [{ who: 'uce', id: 'amb_r6', text: 'Ice cream van does the rounds in the day. Follow the music.' }],
  ambBags: [
    { who: 'aunty', id: 'amb_b1', text: 'Son, can you help Aunty carry these to the car?' },
    { choice: [
      { text: 'Yeah, no worries, Aunty.', id: 'amb_bc1', result: 'yes' },
      { text: 'Sorry Aunty, I\'m busy.', id: 'amb_bc2', result: 'no' },
    ] },
  ],
  ambBagsGo: [{ who: 'aunty', id: 'amb_b2', text: 'Oh, bless you. It\'s just over here.' }],
  ambBagsDone: [{ who: 'aunty', id: 'amb_b3', text: 'Thank you, my boy. Here, buy yourself a feed.' }],
  ambBagsLost: [{ who: 'aunty', id: 'amb_b4', text: 'Hmph. Kids these days.' }],
  ambBagsNo: [{ who: 'aunty', id: 'amb_b5', text: 'Okay, dear.' }],
  ambBall: [
    { who: 'kid', id: 'amb_k1', text: 'Uncle! Our ball went over the fence. Can you get it?' },
    { choice: [
      { text: 'Yeah, hold on.', id: 'amb_kc1', result: 'yes' },
      { text: 'Not now, kids.', id: 'amb_kc2', result: 'no' },
    ] },
  ],
  ambBallDone: [{ who: 'kid', id: 'amb_k3', text: 'Chur, uncle! You\'re the best!' }],
  ambVan: [
    { who: 'van', id: 'amb_v1', text: 'Kia ora! One cone? Four bucks.' },
    { choice: [
      { text: 'Hokey pokey, thanks. ($4)', id: 'amb_vc1', result: 'buy' },
      { text: 'Nah, just looking.', id: 'amb_vc2', result: 'no' },
    ] },
  ],
  ambVanBuy: [{ who: 'van', id: 'amb_v2', text: 'There you go, my bro. Don\'t get brain freeze.' }],
  ambVanBroke: [{ who: 'van', id: 'amb_v3', text: 'Sorry bro. No money, no ice cream.' }],
});
const TEXTS = {
  c1Call: [
    { from: 'tipene', text: 'you did good for us. got a run for u tonight' },
    { from: 'tipene', text: 'grab a car, pick up ur cuz manu, see rawiri at the southmall carpark' },
    { from: 'tipene', text: 'bring me what he gives u. dont get pulled over' },
  ],
  c1ManuJumped: [
    { from: 'manu', text: 'bro' },
    { from: 'manu', text: '{rival} boys jumped me at manurewa station 😤' },
    { from: 'manu', text: 'come get me' },
  ],
  hustleNew: [
    { from: 'shorty', text: 'got another one for u' },
    { from: 'shorty', text: '{name} owes {amount}. {street}' },
    { from: 'shorty', text: 'sort it n ill flick u a cut' },
  ],
  hustlePaid: [{ from: 'shorty', text: 'sweet as. sent u {cut} 💸' }],
  shortyHello: [
    { from: 'shorty', text: 'yo its shorty. manus cuz?' },
    { from: 'shorty', text: 'heard u sorted daz out 😂' },
    { from: 'shorty', text: 'got a few ppl taking the piss. come thru, ill make it worth ur while' },
    { from: 'shorty', text: '📍 {shortyPlace}' },
    { from: 'you', text: 'on my way' },
  ],
  shortyJobs: [
    { from: 'shorty', text: 'KEV - {kevPlace} - $600' },
    { from: 'shorty', text: 'MIKEY - {mikeyPlace} - $300. he runs lol' },
    { from: 'shorty', text: 'UNCLE PITA - {pitaPlace} - $150' },
  ],
  shortyDone: [{ from: 'shorty', text: 'all 3 sorted?? come see me' }],
};

class VoiceBank {
  constructor() { this.files = window.AU_VOICE || {}; this.audio = null; }
  has(id) { return !!this.files[id]; }
  // Resolves with the clip length (seconds) once playing, or null if there is no recording.
  play(id) {
    this.stop();
    if (!this.has(id)) return Promise.resolve(null);
    return new Promise(resolve => {
      const a = new Audio('voice/' + this.files[id]); this.audio = a;
      a.onloadedmetadata = () => resolve(a.duration || null);
      a.onerror = () => resolve(null);
      a.play().catch(() => resolve(null));
    });
  }
  stop() { if (this.audio) { this.audio.pause(); this.audio = null; } }
  pause(p) { if (this.audio) p ? this.audio.pause() : this.audio.play().catch(() => { }); }
}

class Dialogue {
  constructor() {
    this.box = $('dialogue'); this.who = $('dlgWho'); this.text = $('dlgText'); this.choices = $('dlgChoices');
    this.voice = new VoiceBank();
    this.seq = null; this.i = 0; this.line = null; this.t = 0; this.dur = 0; this.typed = 0; this.vars = {}; this.done = null; this.result = null; this.paused = false;
    this.box.addEventListener('click', e => { if (e.target.closest('button')) return; this.advance(); });
  }
  get active() { return !!this.seq; }
  get waitingChoice() { return !!(this.line && this.line.choice); }
  fill(s) { return s.replace(/\{(\w+)\}/g, (_, k) => this.vars[k] ?? ''); }
  run(key, vars, done) {
    this.vars = { ...this.vars, ...vars }; this.done = done; this.result = null;
    this.load(key);
  }
  load(key) { this.seq = SCRIPT[key]; this.key = key; this.i = 0; this.show(); }
  // One-off line from a pool, only when nothing else is being said.
  bark(key) {
    if (this.seq) return false;
    const pool = SCRIPT[key]; const line = pool[Math.floor(Math.random() * pool.length)];
    this.seq = [line]; this.key = key; this.i = 0; this.done = null; this.show(); return true;
  }
  show() {
    const line = this.line = this.seq[this.i];
    this.box.classList.add('show'); this.choices.innerHTML = '';
    if (line.choice) {
      this.who.textContent = 'YOU'; this.who.style.color = CAST.you.color; this.text.textContent = '';
      line.choice.forEach((c, k) => {
        const b = document.createElement('button'); b.textContent = this.fill(c.text); b.onclick = () => this.choose(k); this.choices.appendChild(b);
      });
      this.box.classList.add('choosing');
      return;
    }
    this.box.classList.remove('choosing');
    const cast = CAST[line.who] || CAST.you;
    this.who.textContent = cast.name; this.who.style.color = cast.color;
    this.full = this.fill(line.text); this.typed = 0; this.text.textContent = ''; this.t = 0;
    this.dur = 1.3 + this.full.length * 0.055;
    const token = this.token = {};
    this.voice.play(line.id).then(d => { if (token === this.token && d) this.dur = Math.max(this.dur * 0.5, d + 0.35); });
  }
  choose(k) {
    const c = this.line?.choice?.[k]; if (!c) return;
    // The chosen reply is spoken as a normal line, then the story branches.
    this.seq = [{ who: c.who || 'you', id: c.id, text: c.text, next: c.next, result: c.result }]; this.i = 0; this.show();
  }
  advance() {
    if (!this.seq || this.waitingChoice) return;
    if (this.typed < this.full.length) { this.typed = this.full.length; this.text.textContent = this.full; return; }
    this.nextLine();
  }
  nextLine() {
    const line = this.line;
    this.voice.stop();
    if (line.result !== undefined) this.result = line.result;
    if (line.next) return this.load(line.next);
    if (line.goto) return this.load(line.goto);
    this.i++;
    if (this.i < this.seq.length) return this.show();
    this.close();
  }
  close() {
    const done = this.done, result = this.result;
    this.seq = null; this.line = null; this.done = null; this.box.classList.remove('show', 'choosing');
    if (done) done(result);
  }
  stop() { this.voice.stop(); this.seq = null; this.line = null; this.done = null; this.box.classList.remove('show', 'choosing'); }
  update(dt) {
    if (!this.seq || this.waitingChoice || this.paused) return;
    this.t += dt;
    if (this.typed < this.full.length) { this.typed = Math.min(this.full.length, this.typed + dt * 38); this.text.textContent = this.full.slice(0, Math.floor(this.typed)); }
    if (this.t > this.dur) this.nextLine();
  }
  setPaused(p) { this.paused = p; this.voice.pause(p); }
}

// Prologue director: lounge camera, the match, banter and the offer, then hands over to the street.
class Prologue {
  constructor(lounge, game, dialogue) {
    this.lounge = lounge; this.mg = game; this.dlg = dialogue; this.active = false; this.barkCool = 0; this.debtQueued = false;
    game.on((type, d) => this.onGame(type, d));
    const held = this.mg.input;
    document.querySelectorAll('[data-mg]').forEach(b => {
      const k = b.dataset.mg, hold = k === 'left' || k === 'right' || k === 'block';
      b.addEventListener('pointerdown', e => { e.preventDefault(); if (hold) held[k] = true; else this.mg.press(k); b.setPointerCapture?.(e.pointerId); });
      for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, () => { if (hold) held[k] = false; });
    });
    const keys = { KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', KeyL: 'block', ShiftLeft: 'block', KeyJ: 'punch', KeyK: 'kick', KeyI: 'special', Space: 'special' };
    addEventListener('keydown', e => { if (!this.active || e.repeat) return; const k = keys[e.code]; if (!k) return; if (k === 'left' || k === 'right' || k === 'block') held[k] = true; else this.mg.press(k); });
    addEventListener('keyup', e => { const k = keys[e.code]; if (k === 'left' || k === 'right' || k === 'block') held[k] = false; });
    $('mgSkip').addEventListener('click', () => this.skip());
  }
  start(vars, onDone) {
    this.active = true; this.onDone = onDone; this.vars = vars; this.debtQueued = false; this.debtDone = false; this.ended = false;
    document.body.classList.add('prologue'); document.body.classList.remove('mg');
    this.lounge.look = 'cousin'; this.lounge.aimAt(this.lounge.cousinHead(), true);
    this.mg.stop(); this.mg.phase = 'off';
    fadeIn();
    this.dlg.run('proIntro', vars, () => { this.lounge.look = 'tv'; document.body.classList.add('mg'); this.mg.start(); });
  }
  onGame(type, d) {
    if (!this.active) return;
    if (type === 'hit' && !d.blocked && this.barkCool <= 0 && Math.random() < 0.45) {
      if (this.dlg.bark(d.by === 1 ? 'barkYouHit' : 'barkManuHit')) this.barkCool = 7;
      if (d.by === 1) this.lounge.cousin.hit();
    }
    if (type === 'roundEnd' && d.round === 1) { this.dlg.stop(); this.dlg.run(d.winner === 1 ? 'round1You' : 'round1Manu', this.vars, null); this.lounge.cousin.react = d.winner === 1 ? -1 : 1; }
    if (type === 'round' && d.round === 2 && !this.debtQueued) { this.debtQueued = true; this.debtAt = 3.5; }
    if (type === 'match') this.endMatch(d.winner);
  }
  endMatch(winner) {
    if (this.ended) return; this.ended = true;
    document.body.classList.remove('mg');
    this.lounge.cousin.react = winner === 1 ? -1 : 1;
    const after = () => {
      this.lounge.look = 'cousin';
      this.dlg.run(winner === 1 ? 'matchYou' : 'matchManu', this.vars, () => this.dlg.run('offer', this.vars, r => { if (r === 'accepted') this.finish(); }));
    };
    // The debt conversation always happens, even after a quick match or a skip.
    if (!this.debtDone) { this.dlg.stop(); this.lounge.look = 'cousin'; this.debtDone = true; this.dlg.run('debt', this.vars, after); }
    else if (this.dlg.active) { const prev = this.dlg.done; this.dlg.done = r => { prev?.(r); after(); }; }
    else after();
  }
  // Leaving to the menu mid-prologue (pause > restart, or importing a save).
  abort() { if (!this.active) return; this.active = false; this.mg.stop(); this.dlg.stop(); document.body.classList.remove('prologue', 'mg'); fadeIn(); }
  skip() { if (!this.active) return; this.dlg.stop(); if (this.mg.phase === 'off') this.mg.start(); this.mg.finish(); }
  finish() {
    fadeOut(() => {
      this.active = false; this.mg.stop();
      document.body.classList.remove('prologue', 'mg');
      this.onDone?.();
      setTimeout(fadeIn, 120);
    });
  }
  update(dt, paused) {
    if (!this.active) return;
    this.dlg.setPaused(paused);
    if (paused) return;
    this.barkCool -= dt;
    if (this.debtQueued && !this.debtDone && this.mg.phase === 'fight') {
      this.debtAt -= dt;
      if (this.debtAt <= 0 && !this.dlg.active) { this.debtDone = true; this.dlg.run('debt', this.vars, null); }
    }
    this.mg.update(dt);
    this.mg.draw();
    this.dlg.update(dt);
    this.lounge.update(dt, this.dlg.active && this.dlg.line?.who === 'manu');
  }
}
function fadeOut(then) { const f = $('fade'); f.style.opacity = '1'; setTimeout(then, 700); }
function fadeIn() { const f = $('fade'); f.style.opacity = '0'; }
