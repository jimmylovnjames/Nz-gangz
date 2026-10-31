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

## Manu points you toward the crews at the square

| id | who | line |
|---|---|---|
| `ret_4` | MANU | Word gets round quick here, eh. Couple of the crews down the square been asking who you are. |
| `ret_5` | MANU | Go see who's keen. Just watch yourself. |
