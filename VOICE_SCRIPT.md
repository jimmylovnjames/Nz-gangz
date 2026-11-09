# Voice script

Every spoken line has an id. Record each line as its own file, put the files in the `voice/` folder next to `index.html`, and list them in `voice/manifest.js`:

```js
window.AU_VOICE = { pro_01: 'pro_01.m4a', pro_02: 'pro_02.m4a' };
```

Any format the phone plays works (m4a from the recorder app is fine). Lines without a recording show as subtitles only, so you can add them a few at a time. `{spot}` is filled in with where Darren hangs out (it changes with your hometown), so record it as a general "round the shops" or send me the variants.

The game runs from `src/engine/58-story.js` (SCRIPT); change the wording there and run `node tools/voice-script.mjs` to refresh this file.

## On the couch at Manu's, before the match

_Relaxed, cans open, Friday night._

| id | who | line |
|---|---|---|
| `pro_01` | MANU | Oi. Pass us that other controller, cuz. |
| `pro_02` | YOU | This thing still works? It's older than me. |
| `pro_03` | MANU | Kiwi Knuckle Kings Two, bro. Turbo edition. Classic. |
| `pro_04` | MANU | Rematch. Loser shouts the feed. |
| `pro_05` | YOU | You're on. |

## Manu reacting when you land a hit (random, during the match)

_Short, loud, half-laughing._

| id | who | line |
|---|---|---|
| `bark_hit_1` | MANU | Ohh, cheap shot! |
| `bark_hit_2` | MANU | Bro, stop spamming kick. |
| `bark_hit_3` | MANU | That's lag, that is. Controller's munted. |
| `bark_hit_4` | MANU | Sweet as, sweet as. I'm just warming up. |

## Manu reacting when he lands a hit (random, during the match)

_Gloating._

| id | who | line |
|---|---|---|
| `bark_got_1` | MANU | Get that! Get that! |
| `bark_got_2` | MANU | Too easy, cuz. |
| `bark_got_3` | MANU | Kevo's the champ, eh. |

## After round 1 if you won it

| id | who | line |
|---|---|---|
| `r1_win_1` | MANU | Lucky. That's all that was. |
| `r1_win_2` | YOU | Lucky, aye? Keep telling yourself that. |

## After round 1 if Manu won it

| id | who | line |
|---|---|---|
| `r1_lose_1` | MANU | Told you. Undefeated in this whare. |
| `r1_lose_2` | YOU | Round two, bro. Round two. |

## Round 2: Manu brings up Darren while you both keep playing

_Eyes on the TV, casual, then annoyed about the money._

| id | who | line |
|---|---|---|
| `debt_talk_01` | MANU | Real talk though... you still skint? |
| `debt_talk_02` | YOU | Always, cuz. |
| `debt_talk_03` | MANU | You remember Darren? Skinny fulla from down the road? |
| `debt_talk_04` | YOU | Darren with the Commodore? Yeah. |
| `debt_talk_05` | MANU | He owes me four hundred bucks. Been dodging me three weeks now. |
| `debt_talk_06` | MANU | Every time I go round, his missus reckons he's at work. |
| `debt_talk_07` | YOU | Darren? Work? |
| `debt_talk_08` | MANU | Exactly. |

## Match over, you won

| id | who | line |
|---|---|---|
| `match_win` | MANU | Yeah, yeah. Feed's on me then. |

## Match over, Manu won

| id | who | line |
|---|---|---|
| `match_lose` | MANU | Ha! You're shouting the feed, loser. |

## Manu turns from the TV. The player picks a reply

_Choice lines are spoken by YOU after the player taps them._

| id | who | line |
|---|---|---|
| `offer_01` | MANU | Anyway. Four hundred, bro. I need that. |
| `offer_you_a` | YOU | (choice) Want me to go have a word with him? |
| `offer_you_b` | YOU | (choice) Sounds like your problem, cuz. |

## Player chose "Sounds like your problem, cuz."

| id | who | line |
|---|---|---|
| `offer_02` | MANU | Wow. Thought you were whānau. |
| `offer_you_c` | YOU | (choice) Nah, I'm playing. I'll go have a word. |

## Player offers to collect the money

| id | who | line |
|---|---|---|
| `offer_03` | MANU | ...For real? You'd do that? |
| `offer_04` | YOU | He knows me. I'll sort it. |
| `offer_05` | MANU | Last I heard he's always hanging round {spot}. |
| `offer_06` | MANU | Bring back the whole four hundred and you're getting a cut. Don't do nothing stupid, eh. |
| `offer_07` | YOU | Me? Never. |

## Street: you walk up to Darren

_Darren is nervous, trying to act casual._

| id | who | line |
|---|---|---|
| `darren_01` | DARREN | Ohh... hey bro. What you doing round this way? |
| `darren_you_1` | YOU | (choice) Manu sent me. You know what this is about. |

## Darren makes excuses; player picks soft or hard

| id | who | line |
|---|---|---|
| `darren_02` | DARREN | Look, I was gonna sort him out, true story. Just had a rough couple of weeks. |
| `darren_you_soft` | YOU | (choice) Half now, rest by Friday. Don't make me come back. |
| `darren_you_hard` | YOU | (choice) Nah. The whole four hundred. Today. |

## Soft route: Darren hands over $200

| id | who | line |
|---|---|---|
| `darren_03` | DARREN | ...Yeah. Yeah, alright. Here's two hundred. Tell him Friday, eh. |

## Hard route: Darren squares up

_Angry, cornered._

| id | who | line |
|---|---|---|
| `darren_04` | DARREN | I told you, I ain't got it! You wanna go, bro? Let's go. |

## Hard route: after you knock Darren down

_Darren winded, on the ground._

| id | who | line |
|---|---|---|
| `darren_05` | DARREN | Alright! Alright... take it. Take it. Four hundred. Happy? |
| `darren_06` | YOU | Should've just paid him, Daz. |

## Talking to Darren again after he has paid

| id | who | line |
|---|---|---|
| `darren_07` | DARREN | I already paid, bro. Leave us alone. |

## Talking to Manu before you have the money

| id | who | line |
|---|---|---|
| `manu_wait` | MANU | Any luck with Darren? He's round {spot}. |

## Back at Manu's with $200

| id | who | line |
|---|---|---|
| `ret_s1` | MANU | Two hundred? ...Better than nothing, I suppose. |
| `ret_s2` | YOU | Rest by Friday. He knows I'll come back. |
| `ret_s3` | MANU | Chur. Here, fifty for your gas. |

## Back at Manu's with the full $400

_Impressed, a bit worried._

| id | who | line |
|---|---|---|
| `ret_h1` | MANU | Bro... the whole four hundred? What'd you do to him? |
| `ret_h2` | YOU | We had a chat. Bit of a loud one. |
| `ret_h3` | MANU | Hard out. Here, a hundred's yours. |

## Manu is impressed and brings up his mate Shorty

_Leaning on the fence, half joking, half serious._

| id | who | line |
|---|---|---|
| `ret_4` | MANU | Bro, real talk... you're good at this, eh. |
| `ret_5` | MANU | My mate Shorty, the fulla I get my green off, he's always moaning. Reckons half the town owes him money. |
| `ret_6` | MANU | Want me to give him your number? |
| `ret_you_yes` | YOU | (choice) Yeah, flick it to him. |
| `ret_you_no` | YOU | (choice) Nah, I'm good, cuz. |

## Player says yes to giving Shorty the number

| id | who | line |
|---|---|---|
| `ret_7` | MANU | Sweet as. He'll flick you a text. Don't tell Aunty. |

## Player says no (Manu does it anyway)

_Grinning._

| id | who | line |
|---|---|---|
| `ret_8` | MANU | Easy money, bro. ...Yeah, I'm giving it to him anyway. |

## Talking to Manu while you wait for Shorty's text

| id | who | line |
|---|---|---|
| `manu_after` | MANU | Shorty text you yet? Keep your phone on you, bro. |

## Shorty's driveway: he sizes you up and lays out the three jobs

_Shorty: big unit, slow talker, always half-annoyed. Sh_06 softer, he likes Pita._

| id | who | line |
|---|---|---|
| `sh_01` | SHORTY | So you're Manu's cousin. Thought you'd be bigger. |
| `sh_02` | YOU | Manu said you had a problem. |
| `sh_03` | SHORTY | Problems, bro. Plural. Three of 'em. |
| `sh_04` | SHORTY | Kev at the panel shop owes me six hundred. Reckons he forgot. He didn't forget. |
| `sh_05` | SHORTY | Mikey owes three hundred. Skinny little hōha. He runs, every time. Hope you got your running shoes on. |
| `sh_06` | SHORTY | And Uncle Pita. Hundred and fifty. ...He's alright, Pita. Just get it if you can, eh. |
| `sh_07` | SHORTY | Bring it all back and you get a quarter. Sweet? |
| `sh_you_1` | YOU | (choice) Sweet. Text me where they're at. |

## Talking to Shorty before the jobs are done

| id | who | line |
|---|---|---|
| `sh_wait` | SHORTY | Still waiting on my money, bro. Kev, Mikey, Pita. It's all in your phone. |

## Kev's panel shop yard

_Kev: older, rough as, wiping his hands on a rag._

| id | who | line |
|---|---|---|
| `kev_01` | KEV | Who the hell are you? |
| `kev_you_1` | YOU | (choice) Shorty sent me. Six hundred, Kev. |

## Kev tells you to get lost

| id | who | line |
|---|---|---|
| `kev_02` | KEV | Shorty can come get it himself. Now get off my lot before I put you through the windscreen. |
| `kev_you_2` | YOU | (choice) I'm not going anywhere. |

## Kev squares up

| id | who | line |
|---|---|---|
| `kev_03` | KEV | Right. Your funeral, boy. |

## After you knock Kev down

_Kev winded._

| id | who | line |
|---|---|---|
| `kev_04` | KEV | Alright! Alright... it's in the till. Take it. |
| `kev_05` | YOU | Pleasure doing business, Kev. |

## Kev after he's paid

| id | who | line |
|---|---|---|
| `kev_06` | KEV | You got your money. Piss off. |

## Mikey sees you coming and bolts

_Shouted over his shoulder, already running._

| id | who | line |
|---|---|---|
| `mikey_01` | MIKEY | Nah nah nah, not today, bro! |

## You catch Mikey

_Mikey out of breath, panicking._

| id | who | line |
|---|---|---|
| `mikey_02` | MIKEY | Okay! Okay! I give up! Bro, you're fast. |
| `mikey_03` | YOU | Three hundred, Mikey. |
| `mikey_04` | MIKEY | ...That's all I got. Tell Shorty I'm sorry, eh. Tell him I'm sorry. |

## Mikey after he's paid

| id | who | line |
|---|---|---|
| `mikey_05` | MIKEY | I already paid! Leave us alone, man. |

## Uncle Pita at his front door, the grandkids inside

_Pita: koro, gentle, tired, a bit embarrassed. Player picks: take it, or cover it._

| id | who | line |
|---|---|---|
| `pita_01` | UNCLE PITA | Kia ora, boy. You're one of Shorty's, aren't you. |
| `pita_02` | YOU | He says you owe him a hundred and fifty, Uncle. |
| `pita_03` | UNCLE PITA | I know, I know. It's for my back, the weed. Doctor won't give me nothing that works. |
| `pita_04` | UNCLE PITA | I've got it here. It's the mokos' school uniform money, but... here. |
| `pita_you_take` | YOU | (choice) Sorry, Uncle. It's not personal. |
| `pita_you_cover` | YOU | (choice) Keep it, Uncle. I'll square it with Shorty. |

## Player takes Pita's money

_Quiet._

| id | who | line |
|---|---|---|
| `pita_05` | UNCLE PITA | ...Tell him we're square. |

## Player lets Pita keep it

_Warm._

| id | who | line |
|---|---|---|
| `pita_06` | UNCLE PITA | Bless you, boy. Your nan raised you right. |

## Pita after it's sorted

| id | who | line |
|---|---|---|
| `pita_07` | UNCLE PITA | Look after yourself out there, boy. |

## Back at Shorty's with every cent

_Impressed._

| id | who | line |
|---|---|---|
| `sh_back_1` | SHORTY | Kev, Mikey and Pita? All three? Bro, you're a machine. |

## Back at Shorty's, you paid Pita's share yourself

_Shorty sees right through it._

| id | who | line |
|---|---|---|
| `sh_back_2` | SHORTY | Pita's money smells a lot like your money, bro. |
| `sh_back_3` | YOU | Money's money. |
| `sh_back_4` | SHORTY | Ha. Fair. Paid is paid. |

## Back at Shorty's, you let Pita off

_Unimpressed._

| id | who | line |
|---|---|---|
| `sh_back_5` | SHORTY | You let Pita off? Soft, bro. That hundred and fifty's coming out of your end then. |

## Shorty pays your cut and points you to the crews

| id | who | line |
|---|---|---|
| `sh_back_6` | SHORTY | Here. That's your quarter. |
| `sh_back_7` | SHORTY | Listen. People are talking about you. The crews down at Clendon skate park want to see you. |
| `sh_back_8` | SHORTY | That's a big deal, bro. Don't muck it up. |

## Chapter One: the Southmall car park, Rawiri hands over the parcel

_Manu is riding with you._

| id | who | line |
|---|---|---|
| `c1_01` | RAWIRI | You Tipene's new boy? Took your time. |
| `c1_02` | MANU | Traffic, uce. You know Great South Road. |
| `c1_03` | RAWIRI | Here. Don't open it, don't lose it, don't get pulled over with it. |
| `c1_04` | YOU | Sweet. Straight to Tipene. |

## Back at the skate park: Tipene (the crew fixer) takes the parcel

_Calm, in charge._

| id | who | line |
|---|---|---|
| `c1_05` | TIPENE | There he is. No cops on your tail? Good. |
| `c1_06` | TIPENE | Two hundred. And there's something else. |
| `c1_07` | TIPENE | Aunty Lani at the Clendon dairy. She looks after us, we look after her. Go see her. |

## Tipene if the cops followed you

_Sharp._

| id | who | line |
|---|---|---|
| `c1_08` | TIPENE | You brought the cops here? Lose them first, then come back. |

## Clendon Dairy: Aunty Lani, who runs it

_Tired, worried for her grandkids. {rival} is the rival crew name._

| id | who | line |
|---|---|---|
| `c1_09` | AUNTY LANI | Oh, you're the one Tipene sent. Thank God. |
| `c1_10` | AUNTY LANI | Those {rival} boys keep coming in, filling their pockets, giving my mokos lip. |
| `c1_11` | AUNTY LANI | They hang round the skate park after school. Please, love. Make it stop. |
| `c1_12` | YOU | Leave it with me, Aunty. |

## Clendon skate park: the rival crew boys

_Cocky teenagers._

| id | who | line |
|---|---|---|
| `c1_13` | RIVAL CREW | Oi. You lost? This is our park. |
| `c1_14` | YOU | Aunty Lani's dairy. You're done going in there. |
| `c1_15` | RIVAL CREW | Says who? |
| `c1_c1` | YOU | (choice) Says Tipene. You want that problem? |
| `c1_c2` | YOU | (choice) Says me. Come on then. |

## Rivals back down

| id | who | line |
|---|---|---|
| `c1_16` | RIVAL CREW | ...Whatever, bro. Plenty of other dairies. |

## Rivals start a fight

| id | who | line |
|---|---|---|
| `c1_17` | RIVAL CREW | Tipene's not here, egg. Get him, boys. |

## Manurewa station: Manu after he got jumped

_Hurt, trying to laugh it off._

| id | who | line |
|---|---|---|
| `c1_18` | MANU | Cuz... took you long enough. |
| `c1_19` | MANU | Those {rival} boys. Said it was for the park. My ribs, bro. |
| `c1_20` | YOU | Can you walk? Car's over here. I'll get you home. |

## Outside Manu's place, end of Chapter One

_Grateful, then serious._

| id | who | line |
|---|---|---|
| `c1_21` | MANU | Cheers, cuz. Don't tell Mum about this. |
| `c1_22` | MANU | Tipene rang. He reckons you're the real deal now. |
| `c1_23` | MANU | Just... watch yourself, eh. This doesn't stop now. |

## Shorty's side jobs: you turn up at the debtor's place (DEBTOR = whoever owes, name changes each job)

_{amount} is the dollar amount, e.g. "three hundred". Record a general version._

| id | who | line |
|---|---|---|
| `hus_01` | DEBTOR | Yeah? Who's asking? |
| `hus_02` | YOU | Shorty. You owe him {amount}. |
| `hus_c1` | YOU | (choice) Sort it now and we're sweet. |
| `hus_c2` | YOU | (choice) Pay up or I take it off you. |

## Debtor pays when asked

| id | who | line |
|---|---|---|
| `hus_03` | DEBTOR | Alright, alright. Here. Tell him we're square. |

## Debtor pays after you lean on him

_Rattled._

| id | who | line |
|---|---|---|
| `hus_04` | DEBTOR | Easy, easy! Take it. Just go, eh. |

## Debtor refuses and squares up

| id | who | line |
|---|---|---|
| `hus_05` | DEBTOR | Shorty can come get it himself. You wanna go, bro? |

## Debtor after you knock him down

_Winded._

| id | who | line |
|---|---|---|
| `hus_06` | DEBTOR | Okay! Okay. It's in my pocket. Take it. |

## Talking to a debtor who already paid

| id | who | line |
|---|---|---|
| `hus_07` | DEBTOR | I already paid, bro. Leave me alone. |

## ambGreet

| id | who | line |
|---|---|---|
| `amb_g1` | local | Chur. |
| `amb_g2` | local | Sup, uce. |
| `amb_g3` | local | Kia ora, bro. |
| `amb_g4` | local | How's it, cuz? |
| `amb_g5` | local | Sweet as. |
| `amb_g6` | local | Malo, bro. |
| `amb_g7` | local | All good, bro? |
| `amb_g8` | local | Mean shoes, uce. |

## ambNight

| id | who | line |
|---|---|---|
| `amb_n1` | local | Bit late to be out, eh. |
| `amb_n2` | local | Cold one tonight. |
| `amb_n3` | local | Mind how you go, bro. |

## ambKnown

| id | who | line |
|---|---|---|
| `amb_w1` | local | That's the fulla who sorted Darren! |
| `amb_w2` | local | Heard about you, uce. |
| `amb_w3` | local | Respect, bro. |
| `amb_w4` | local | Don't want no trouble, eh. |

## ambHeat

| id | who | line |
|---|---|---|
| `amb_h1` | local | Cops are looking for you, bro. |
| `amb_h2` | local | The feds were just round here. |
| `amb_h3` | local | Keep your head down, eh. |

## ambWeapon

| id | who | line |
|---|---|---|
| `amb_a1` | local | Whoa, easy with that, bro. |
| `amb_a2` | local | Put that away, eh. |
| `amb_a3` | local | Nah, don't bring that round here. |

## ambKid

| id | who | line |
|---|---|---|
| `amb_y1` | kid | Uncle! Watch this! |
| `amb_y2` | kid | Hi! |
| `amb_y3` | kid | You play league? |

## ambBump

| id | who | line |
|---|---|---|
| `amb_b6` | local | Oi! Watch it, egg! |
| `amb_b7` | local | Bro, what the? |
| `amb_b8` | local | Eyes up, uce! |
| `amb_b9` | local | Ow! Watch where you're going. |

## ambFightStart

| id | who | line |
|---|---|---|
| `amb_f1` | local | Fight! Fight! |
| `amb_f2` | local | Ohhh it's going down! |
| `amb_f3` | local | Get the phones out! |
| `amb_f4` | local | Bro, they're scrapping! |

## ambFightCheer

| id | who | line |
|---|---|---|
| `amb_f5` | local | Ooooh! |
| `amb_f6` | local | Get him! |
| `amb_f7` | local | Hands up, bro! |
| `amb_f8` | local | He felt that! |
| `amb_f9` | local | Chur! |

## ambFlee

| id | who | line |
|---|---|---|
| `amb_x1` | local | Nah, I'm out! |
| `amb_x2` | local | Run! |
| `amb_x3` | local | Not getting involved, eh. |

## ambSmoke

| id | who | line |
|---|---|---|
| `amb_s1` | uce | Bro. You got a smoke? |
| `amb_sc1` | YOU | (choice) Here, have a couple. ($2) |
| `amb_sc2` | YOU | (choice) Nah, sorry bro. |

## ambSmokeYes

| id | who | line |
|---|---|---|
| `amb_s2` | uce | Chur, bro. Here, I'll tell you something for free. |

## ambSmokeNo

| id | who | line |
|---|---|---|
| `amb_s3` | uce | All good, eh. |

## ambRumour1

| id | who | line |
|---|---|---|
| `amb_r1` | uce | Cops like to park up at the Southmall car park. Drive nice round there. |

## ambRumour2

| id | who | line |
|---|---|---|
| `amb_r2` | uce | That gym on Great South Road. Train there and you hit way harder. |

## ambRumour3

| id | who | line |
|---|---|---|
| `amb_r3` | uce | Grab an energy drink from the dairy and you can run all day. |

## ambRumour4

| id | who | line |
|---|---|---|
| `amb_r4` | uce | Shorty always has work if you're keen. Keep your phone on. |

## ambRumour5

| id | who | line |
|---|---|---|
| `amb_r5` | uce | Tap block right as they swing and they're wide open. Learnt that the hard way. |

## ambRumour6

| id | who | line |
|---|---|---|
| `amb_r6` | uce | Ice cream van does the rounds in the day. Follow the music. |

## ambBags

| id | who | line |
|---|---|---|
| `amb_b1` | aunty | Son, can you help Aunty carry these to the car? |
| `amb_bc1` | YOU | (choice) Yeah, no worries, Aunty. |
| `amb_bc2` | YOU | (choice) Sorry Aunty, I'm busy. |

## ambBagsGo

| id | who | line |
|---|---|---|
| `amb_b2` | aunty | Oh, bless you. It's just over here. |

## ambBagsDone

| id | who | line |
|---|---|---|
| `amb_b3` | aunty | Thank you, my boy. Here, buy yourself a feed. |

## ambBagsLost

| id | who | line |
|---|---|---|
| `amb_b4` | aunty | Hmph. Kids these days. |

## ambBagsNo

| id | who | line |
|---|---|---|
| `amb_b5` | aunty | Okay, dear. |

## ambBall

| id | who | line |
|---|---|---|
| `amb_k1` | kid | Uncle! Our ball went over the fence. Can you get it? |
| `amb_kc1` | YOU | (choice) Yeah, hold on. |
| `amb_kc2` | YOU | (choice) Not now, kids. |

## ambBallDone

| id | who | line |
|---|---|---|
| `amb_k3` | kid | Chur, uncle! You're the best! |

## ambVan

| id | who | line |
|---|---|---|
| `amb_v1` | van | Kia ora! One cone? Four bucks. |
| `amb_vc1` | YOU | (choice) Hokey pokey, thanks. ($4) |
| `amb_vc2` | YOU | (choice) Nah, just looking. |

## ambVanBuy

| id | who | line |
|---|---|---|
| `amb_v2` | van | There you go, my bro. Don't get brain freeze. |

## ambVanBroke

| id | who | line |
|---|---|---|
| `amb_v3` | van | Sorry bro. No money, no ice cream. |

## ambFear

| id | who | line |
|---|---|---|
| `amb_fe1` | local | Sweet, sweet. No trouble here, bro. |
| `amb_fe2` | local | All good, uce. We're going. |
| `amb_fe3` | local | Eyes down, eyes down. |
| `amb_fe4` | local | Don't want any beef, man. |
| `amb_fe5` | local | Easy, easy. We're sweet. |

## ambRespect

| id | who | line |
|---|---|---|
| `amb_re1` | local | Chur, my bro! Good to see you round. |
| `amb_re2` | local | There's the main man! |
| `amb_re3` | local | Kia ora, uce. Heard what you did. Mean. |
| `amb_re4` | local | Respect, bro. |
| `amb_re5` | local | You need anything, you just ask, eh. |

## ambDislike

| id | who | line |
|---|---|---|
| `amb_di1` | local | Here's trouble. |
| `amb_di2` | local | Keep walking, eh. |
| `amb_di3` | local | Not you again. |
| `amb_di4` | local | Egg. |
| `amb_di5` | local | Go on, get. |

## evPartyB

| id | who | line |
|---|---|---|
| `ev_pb1` | local | Turn it up! |
| `ev_pb2` | local | Cuz! Grab a plate! |
| `ev_pb3` | local | Who's on the speaker? |
| `ev_pb4` | local | Chur chur! |
| `ev_pb5` | local | Aye, this song! |
| `ev_pb6` | local | Another round, another round! |

## evParty

| id | who | line |
|---|---|---|
| `ev_p1` | host | Kia ora! Come in, come in. There's heaps of kai out the back. |
| `ev_pc1` | YOU | (choice) Grab a plate. (+40 health) |
| `ev_pc2` | YOU | (choice) Have a dance. |
| `ev_pc3` | YOU | (choice) All good, just passing. |

## evPartyFeed

| id | who | line |
|---|---|---|
| `ev_p2` | host | Get into it. The boil-up's still hot. |

## evPartyDance

| id | who | line |
|---|---|---|
| `ev_p3` | host | Ayyy, look at those moves! Uce can dance! |

## evPartyNo

| id | who | line |
|---|---|---|
| `ev_p4` | host | Nah. Not you. Keep walking, we don't want trouble here. |

## evCopB

| id | who | line |
|---|---|---|
| `ev_cb1` | cop | Licence, please. |
| `ev_cb2` | cop | Do you know how fast you were going? |
| `ev_cb3` | cop | Stay in the vehicle, please. |
| `ev_cb4` | cop | Have you had anything to drink tonight? |
| `ev_cb5` | cop | Whose car is this? |

## evCopNotice

| id | who | line |
|---|---|---|
| `ev_cn1` | cop | Oi. You. I know your face. |
| `ev_cn2` | cop | Hey! Don't go far, mate. |

## evCop

| id | who | line |
|---|---|---|
| `ev_c1` | cop | Nothing to see here. Move along, please. |

## evCopHeat

| id | who | line |
|---|---|---|
| `ev_c2` | cop | Hold on. You match a description. Don't go anywhere. |

## evScuffleB

| id | who | line |
|---|---|---|
| `ev_sb1` | local | Come on then! |
| `ev_sb2` | local | Say it again, I dare you! |
| `ev_sb3` | local | You wanna go, uce?! |
| `ev_sb4` | local | Hold my phone! |
| `ev_sb5` | local | Ooooh! |
| `ev_sb6` | local | Get him! |

## evScuffle

| id | who | line |
|---|---|---|
| `ev_s1` | local | Stay out of it, bro. This is between them. |
| `ev_sc1` | YOU | (choice) Oi! Break it up, both of you. |
| `ev_sc2` | YOU | (choice) Ten bucks on the big fella. ($10) |
| `ev_sc3` | YOU | (choice) Leave them to it. |

## evScuffleStop

| id | who | line |
|---|---|---|
| `ev_s2` | local | ...Yeah, all good. Didn't know it was you, bro. We're done. |

## evScuffleTurn

| id | who | line |
|---|---|---|
| `ev_s3` | local | Who do you think you are? You want some too? |

## evBetWin

| id | who | line |
|---|---|---|
| `ev_s4` | local | Ahh, the big fella dropped him! Here's your ten. |

## evBetLose

| id | who | line |
|---|---|---|
| `ev_s5` | local | Ohhh, the big fella's down! Bad luck, your tenner's mine. |

## evBetBroke

| id | who | line |
|---|---|---|
| `ev_s6` | local | No money, no bet, egg. |

## evThiefB

| id | who | line |
|---|---|---|
| `ev_tb1` | local | Oh, crap! |
| `ev_tb2` | local | Gotta go! |
| `ev_tb3` | local | Wasn't me! |

## evThiefCaught

| id | who | line |
|---|---|---|
| `ev_t1` | local | That's my car! You got him? Legend, bro. Here, take this for your trouble. |

## evRacers

| id | who | line |
|---|---|---|
| `ev_r1` | local | Ayyy! Watch this skid! Stay out of the circle though, they don't stop. |
