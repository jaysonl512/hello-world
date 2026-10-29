# Hitline: a Hitster-style music timeline game

A two-player music timeline game for your TV, powered by Spotify. A mystery song plays and you
place it in your timeline of cards. Get the year order right and you keep the card. First to 10
cards wins.

- **1,366 songs from 336 artists, 50s → today**: big artists (usually five songs each), 90s/2000s rock, and well-known one-hit wonders. Includes
  a few 50s classics like Chuck Berry and Johnny Cash's "I Walk the Line".
- **TV-sized cards and scoreboard**: card counts, progress bars, ★ tokens, and both timelines
  on screen the whole time.
- **Plays through Spotify**: in the browser tab (cast the tab and the audio goes with it) or on
  any Spotify Connect device, such as the Spotify app on your TV.
- **Saves the game**: refresh or close the tab and you can resume where you left off.

## Rules

1. Each player starts with one face-up card and **no tokens**.
2. On your turn a mystery song plays. Tap the **+** where you think it belongs in your
   timeline, oldest on the left and newest on the right. Then **Lock it in**.
3. Name the **artist and title** to earn **+1 ★**, even if you got the year wrong. The host
   taps the button on the reveal screen.
4. At the **start of your turn, before the song plays**, you can trade **3 ★** to **steal any
   card** you choose from your opponent's timeline. Tokens earned on a turn can only be
   spent on a later turn.
5. First to the target (default 10 cards) wins.

## Setup (one time, about 5 minutes)

You need **Spotify Premium** for playback. Without it the game still works in silent mode,
and you can play the music yourself.

### 1. Host the page

Spotify only redirects back to HTTPS pages or to `http://127.0.0.1`. Pick one of these:

- **GitHub Pages** (recommended): in the repo go to *Settings → Pages*, set *Source* to
  *Deploy from a branch*, and pick the branch and the `/ (root)` folder. The game will be at
  `https://<your-username>.github.io/hello-world/`.
- **Locally**: run `python3 -m http.server 8000` in this folder and open
  **`http://127.0.0.1:8000/`**. Spotify rejects `localhost`, so use `127.0.0.1`.

### 2. Create a Spotify app

1. Go to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) and click
   **Create app**.
2. **Redirect URI**: paste the exact URL from step 1, trailing `/` included. The setup screen
   shows it too, and you can click it to copy.
3. Under *Which API/SDKs are you planning to use?*, tick **Web API** and **Web Playback SDK**.
4. Save, then copy the **Client ID**.
5. If you'll log in with a different Spotify account than the one that owns the app, add that
   account under the app's *User Management* (dev-mode apps only allow listed users).

### 3. Connect

Open the game, paste the Client ID into the Spotify panel, and click **Connect**. You only need
to do this once per browser.

## Playing on the TV

Music always plays on the device the game is open on. Choose where the sound goes on that
device, not in the game.

**From a phone (iPhone or Android).** Songs play through the Spotify app on the phone, so keep
Spotify open in the background. Mirror the screen to the TV (iPhone: Control Center → Screen
Mirroring). To hear the music on a speaker or TV, pick it with **AirPlay or Bluetooth**. Don't use
Spotify's own device list: speakers like Sonos block outside apps there, and the next song comes
back to the phone anyway.

**From a laptop.** In Chrome, open the ⋮ menu, choose **Cast…**, pick your TV (Chromecast /
Google TV / Android TV), and use *Sources → Cast tab*. The music plays in the tab, so it goes
to the TV with the picture. Click ⛶ for fullscreen.

Keyboard: **Space** pauses or resumes the song.

## Why the years are curated

Spotify's track data often shows the year of a remaster or compilation. For example, a 1965
song can show up as 2009. Every card's year here is the song's **original release year** (the
earlier of single or album), so the timeline is fair. The game only uses Spotify to find and
play the track. To add or change songs, edit `js/songs.js`.

## Project layout

```
index.html        page shell
css/style.css     TV-first styling (scales from phone to 4K)
js/songs.js       the deck: artists, songs, original years
js/game.js        pure game rules (placement, challenges, tokens, winner)
js/spotify.js     PKCE login, track search, Web Playback SDK / Connect playback
js/app.js         UI rendering and event handling
```

No build step and no backend. It's plain ES modules served as static files.
