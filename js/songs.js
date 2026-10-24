// Curated deck: big artists from the 60s to today, five of their best-known songs each.
// Years are the song's original release year (earliest of single or parent album), not
// the year of whatever remaster/compilation Spotify happens to serve, so the game stays fair.
// Tracks are matched on Spotify at play time by title + artist.

const ARTISTS = [
  // 60s
  ['The Beatles', [['Twist and Shout', 1963], ['Yesterday', 1965], ['Hey Jude', 1968], ['Here Comes the Sun', 1969], ['Let It Be', 1970]]],
  ['The Rolling Stones', [['(I Can\'t Get No) Satisfaction', 1965], ['Paint It Black', 1966], ['Sympathy for the Devil', 1968], ['Gimme Shelter', 1969], ['Start Me Up', 1981]]],
  ['Elvis Presley', [['Can\'t Help Falling in Love', 1961], ['Return to Sender', 1962], ['Viva Las Vegas', 1964], ['Suspicious Minds', 1969], ['Burning Love', 1972]]],
  ['The Beach Boys', [['Surfin\' U.S.A.', 1963], ['I Get Around', 1964], ['California Girls', 1965], ['Wouldn\'t It Be Nice', 1966], ['Good Vibrations', 1966]]],
  ['Aretha Franklin', [['Respect', 1967], ['Chain of Fools', 1967], ['(You Make Me Feel Like) A Natural Woman', 1967], ['Think', 1968], ['I Say a Little Prayer', 1968]]],
  ['The Supremes', [['Where Did Our Love Go', 1964], ['Baby Love', 1964], ['Stop! In the Name of Love', 1965], ['You Can\'t Hurry Love', 1966], ['You Keep Me Hangin\' On', 1966]]],
  ['Marvin Gaye', [['Ain\'t No Mountain High Enough', 1967], ['I Heard It Through the Grapevine', 1968], ['What\'s Going On', 1971], ['Let\'s Get It On', 1973], ['Sexual Healing', 1982]]],
  ['Bob Dylan', [['Blowin\' in the Wind', 1963], ['The Times They Are A-Changin\'', 1964], ['Like a Rolling Stone', 1965], ['Mr. Tambourine Man', 1965], ['Knockin\' on Heaven\'s Door', 1973]]],
  ['Simon & Garfunkel', [['The Sound of Silence', 1965], ['Mrs. Robinson', 1968], ['The Boxer', 1969], ['Bridge Over Troubled Water', 1970], ['Cecilia', 1970]]],
  ['Creedence Clearwater Revival', [['Proud Mary', 1969], ['Bad Moon Rising', 1969], ['Fortunate Son', 1969], ['Down on the Corner', 1969], ['Have You Ever Seen the Rain', 1970]]],
  ['The Jimi Hendrix Experience', [['Hey Joe', 1966], ['Purple Haze', 1967], ['Foxy Lady', 1967], ['The Wind Cries Mary', 1967], ['All Along the Watchtower', 1968]]],
  ['The Doors', [['Break On Through (To the Other Side)', 1967], ['Light My Fire', 1967], ['People Are Strange', 1967], ['Roadhouse Blues', 1970], ['Riders on the Storm', 1971]]],
  ['The Who', [['My Generation', 1965], ['Pinball Wizard', 1969], ['Baba O\'Riley', 1971], ['Won\'t Get Fooled Again', 1971], ['Who Are You', 1978]]],
  ['Johnny Cash', [['I Walk the Line', 1956], ['Ring of Fire', 1963], ['A Boy Named Sue', 1969], ['Man in Black', 1971], ['Hurt', 2002]]],
  ['Cher', [['Bang Bang (My Baby Shot Me Down)', 1966], ['Gypsys, Tramps & Thieves', 1971], ['If I Could Turn Back Time', 1989], ['Believe', 1998], ['Strong Enough', 1998]]],

  // 70s
  ['Stevie Wonder', [['Signed, Sealed, Delivered I\'m Yours', 1970], ['Superstition', 1972], ['You Are the Sunshine of My Life', 1972], ['Sir Duke', 1976], ['I Just Called to Say I Love You', 1984]]],
  ['Led Zeppelin', [['Whole Lotta Love', 1969], ['Immigrant Song', 1970], ['Black Dog', 1971], ['Stairway to Heaven', 1971], ['Kashmir', 1975]]],
  ['Queen', [['Bohemian Rhapsody', 1975], ['We Will Rock You', 1977], ['Don\'t Stop Me Now', 1978], ['Another One Bites the Dust', 1980], ['Under Pressure', 1981]]],
  ['ABBA', [['Waterloo', 1974], ['Mamma Mia', 1975], ['Dancing Queen', 1976], ['Take a Chance on Me', 1977], ['Gimme! Gimme! Gimme! (A Man After Midnight)', 1979]]],
  ['Elton John', [['Your Song', 1970], ['Tiny Dancer', 1971], ['Rocket Man (I Think It\'s Going to Be a Long, Long Time)', 1972], ['Bennie and the Jets', 1973], ['I\'m Still Standing', 1983]]],
  ['David Bowie', [['Space Oddity', 1969], ['Life on Mars?', 1971], ['Starman', 1972], ['"Heroes"', 1977], ['Let\'s Dance', 1983]]],
  ['Fleetwood Mac', [['Landslide', 1975], ['Go Your Own Way', 1976], ['Dreams', 1977], ['The Chain', 1977], ['Everywhere', 1987]]],
  ['Bee Gees', [['Massachusetts', 1967], ['You Should Be Dancing', 1976], ['How Deep Is Your Love', 1977], ['Stayin\' Alive', 1977], ['Tragedy', 1979]]],
  ['Eagles', [['Take It Easy', 1972], ['Desperado', 1973], ['Take It to the Limit', 1975], ['Hotel California', 1976], ['Life in the Fast Lane', 1976]]],
  ['Pink Floyd', [['Money', 1973], ['Time', 1973], ['Wish You Were Here', 1975], ['Another Brick in the Wall, Pt. 2', 1979], ['Comfortably Numb', 1979]]],
  ['Earth, Wind & Fire', [['Shining Star', 1975], ['Fantasy', 1977], ['September', 1978], ['Boogie Wonderland', 1979], ['Let\'s Groove', 1981]]],
  ['Donna Summer', [['Love to Love You Baby', 1975], ['I Feel Love', 1977], ['Last Dance', 1978], ['Hot Stuff', 1979], ['Bad Girls', 1979]]],
  ['Dolly Parton', [['Coat of Many Colors', 1971], ['Jolene', 1973], ['I Will Always Love You', 1974], ['9 to 5', 1980], ['Islands in the Stream', 1983]]],
  ['Bruce Springsteen', [['Thunder Road', 1975], ['Born to Run', 1975], ['Hungry Heart', 1980], ['Dancing in the Dark', 1984], ['Born in the U.S.A.', 1984]]],
  ['AC/DC', [['T.N.T.', 1975], ['Highway to Hell', 1979], ['Back In Black', 1980], ['You Shook Me All Night Long', 1980], ['Thunderstruck', 1990]]],
  ['Billy Joel', [['Piano Man', 1973], ['Just the Way You Are', 1977], ['My Life', 1978], ['Uptown Girl', 1983], ['We Didn\'t Start the Fire', 1989]]],

  // 80s
  ['Michael Jackson', [['Don\'t Stop \'Til You Get Enough', 1979], ['Billie Jean', 1982], ['Man in the Mirror', 1987], ['Smooth Criminal', 1987], ['Black or White', 1991]]],
  ['Madonna', [['Like a Virgin', 1984], ['Material Girl', 1984], ['Like a Prayer', 1989], ['Vogue', 1990], ['Hung Up', 2005]]],
  ['Prince', [['1999', 1982], ['When Doves Cry', 1984], ['Purple Rain', 1984], ['Kiss', 1986], ['Cream', 1991]]],
  ['Whitney Houston', [['Saving All My Love for You', 1985], ['How Will I Know', 1985], ['I Wanna Dance with Somebody (Who Loves Me)', 1987], ['I Will Always Love You', 1992], ['It\'s Not Right but It\'s Okay', 1999]]],
  ['U2', [['Sunday Bloody Sunday', 1983], ['With or Without You', 1987], ['One', 1991], ['Beautiful Day', 2000], ['Vertigo', 2004]]],
  ['Bon Jovi', [['You Give Love a Bad Name', 1986], ['Livin\' on a Prayer', 1986], ['Bed of Roses', 1992], ['Always', 1994], ['It\'s My Life', 2000]]],
  ['Guns N\' Roses', [['Welcome to the Jungle', 1987], ['Sweet Child O\' Mine', 1987], ['Paradise City', 1987], ['November Rain', 1991], ['Don\'t Cry', 1991]]],
  ['Phil Collins', [['In the Air Tonight', 1981], ['Against All Odds (Take a Look at Me Now)', 1984], ['Sussudio', 1985], ['Another Day in Paradise', 1989], ['You\'ll Be in My Heart', 1999]]],
  ['Tina Turner', [['Let\'s Stay Together', 1983], ['What\'s Love Got to Do with It', 1984], ['We Don\'t Need Another Hero (Thunderdome)', 1985], ['The Best', 1989], ['GoldenEye', 1995]]],
  ['Journey', [['Any Way You Want It', 1980], ['Don\'t Stop Believin\'', 1981], ['Open Arms', 1981], ['Separate Ways (Worlds Apart)', 1983], ['Faithfully', 1983]]],
  ['Depeche Mode', [['Just Can\'t Get Enough', 1981], ['People Are People', 1984], ['Never Let Me Down Again', 1987], ['Personal Jesus', 1989], ['Enjoy the Silence', 1990]]],

  // 90s
  ['Nirvana', [['About a Girl', 1989], ['Smells Like Teen Spirit', 1991], ['Come as You Are', 1991], ['Heart-Shaped Box', 1993], ['All Apologies', 1993]]],
  ['Mariah Carey', [['Vision of Love', 1990], ['Hero', 1993], ['All I Want for Christmas Is You', 1994], ['Fantasy', 1995], ['We Belong Together', 2005]]],
  ['Oasis', [['Supersonic', 1994], ['Live Forever', 1994], ['Wonderwall', 1995], ['Don\'t Look Back in Anger', 1995], ['Stop Crying Your Heart Out', 2002]]],
  ['Spice Girls', [['Wannabe', 1996], ['Say You\'ll Be There', 1996], ['2 Become 1', 1996], ['Spice Up Your Life', 1997], ['Viva Forever', 1998]]],
  ['Britney Spears', [['...Baby One More Time', 1998], ['Oops!...I Did It Again', 2000], ['Toxic', 2003], ['Womanizer', 2008], ['Circus', 2008]]],
  ['Backstreet Boys', [['Quit Playing Games (With My Heart)', 1996], ['Everybody (Backstreet\'s Back)', 1997], ['As Long as You Love Me', 1997], ['I Want It That Way', 1999], ['Shape of My Heart', 2000]]],
  ['Red Hot Chili Peppers', [['Give It Away', 1991], ['Under the Bridge', 1991], ['Californication', 1999], ['Can\'t Stop', 2002], ['Dani California', 2006]]],
  ['TLC', [['Baby-Baby-Baby', 1992], ['Creep', 1994], ['Waterfalls', 1995], ['No Scrubs', 1999], ['Unpretty', 1999]]],
  ['Celine Dion', [['The Power of Love', 1993], ['Because You Loved Me', 1996], ['It\'s All Coming Back to Me Now', 1996], ['My Heart Will Go On', 1997], ['That\'s the Way It Is', 1999]]],
  ['2Pac', [['Dear Mama', 1995], ['California Love', 1995], ['Hit \'Em Up', 1996], ['Ambitionz Az a Ridah', 1996], ['Changes', 1998]]],
  ['Green Day', [['Basket Case', 1994], ['Good Riddance (Time of Your Life)', 1997], ['Minority', 2000], ['American Idiot', 2004], ['Boulevard of Broken Dreams', 2004]]],
  ['Daft Punk', [['Around the World', 1997], ['One More Time', 2000], ['Harder, Better, Faster, Stronger', 2001], ['Get Lucky', 2013], ['Instant Crush', 2013]]],

  // 00s
  ['Eminem', [['My Name Is', 1999], ['The Real Slim Shady', 2000], ['Lose Yourself', 2002], ['Mockingbird', 2004], ['Love the Way You Lie', 2010]]],
  ['Beyoncé', [['Crazy in Love', 2003], ['Irreplaceable', 2006], ['Single Ladies (Put a Ring on It)', 2008], ['Formation', 2016], ['BREAK MY SOUL', 2022]]],
  ['Coldplay', [['Yellow', 2000], ['The Scientist', 2002], ['Fix You', 2005], ['Viva la Vida', 2008], ['A Sky Full of Stars', 2014]]],
  ['Rihanna', [['Pon de Replay', 2005], ['Umbrella', 2007], ['We Found Love', 2011], ['Diamonds', 2012], ['Work', 2016]]],
  ['Linkin Park', [['In the End', 2000], ['Numb', 2003], ['What I\'ve Done', 2007], ['New Divide', 2009], ['Burn It Down', 2012]]],
  ['Amy Winehouse', [['Stronger Than Me', 2003], ['Rehab', 2006], ['You Know I\'m No Good', 2006], ['Back to Black', 2006], ['Tears Dry on Their Own', 2006]]],
  ['The Black Eyed Peas', [['Where Is the Love?', 2003], ['Let\'s Get It Started', 2004], ['My Humps', 2005], ['Boom Boom Pow', 2009], ['I Gotta Feeling', 2009]]],
  ['Lady Gaga', [['Just Dance', 2008], ['Poker Face', 2008], ['Bad Romance', 2009], ['Born This Way', 2011], ['Shallow', 2018]]],
  ['Usher', [['You Make Me Wanna...', 1997], ['U Remind Me', 2001], ['Yeah!', 2004], ['OMG', 2010], ['DJ Got Us Fallin\' in Love', 2010]]],
  ['The Killers', [['Mr. Brightside', 2003], ['Somebody Told Me', 2004], ['When You Were Young', 2006], ['Read My Mind', 2006], ['Human', 2008]]],
  ['Justin Timberlake', [['Cry Me a River', 2002], ['SexyBack', 2006], ['My Love', 2006], ['Mirrors', 2013], ['CAN\'T STOP THE FEELING!', 2016]]],
  ['Katy Perry', [['I Kissed a Girl', 2008], ['Hot n Cold', 2008], ['California Gurls', 2010], ['Firework', 2010], ['Roar', 2013]]],

  // 10s
  ['Adele', [['Rolling in the Deep', 2010], ['Someone Like You', 2011], ['Skyfall', 2012], ['Hello', 2015], ['Easy on Me', 2021]]],
  ['Bruno Mars', [['Just the Way You Are', 2010], ['Locked Out of Heaven', 2012], ['Uptown Funk', 2014], ['24K Magic', 2016], ['Die With A Smile', 2024]]],
  ['Taylor Swift', [['Love Story', 2008], ['We Are Never Ever Getting Back Together', 2012], ['Shake It Off', 2014], ['Cruel Summer', 2019], ['Anti-Hero', 2022]]],
  ['Ed Sheeran', [['The A Team', 2011], ['Thinking Out Loud', 2014], ['Shape of You', 2017], ['Perfect', 2017], ['Bad Habits', 2021]]],
  ['Drake', [['Best I Ever Had', 2009], ['Started From the Bottom', 2013], ['Hotline Bling', 2015], ['One Dance', 2016], ['God\'s Plan', 2018]]],
  ['The Weeknd', [['The Hills', 2015], ['Can\'t Feel My Face', 2015], ['Starboy', 2016], ['Blinding Lights', 2019], ['Save Your Tears', 2020]]],
  ['Imagine Dragons', [['Radioactive', 2012], ['Demons', 2012], ['Believer', 2017], ['Thunder', 2017], ['Enemy', 2021]]],
  ['Miley Cyrus', [['Party in the U.S.A.', 2009], ['Wrecking Ball', 2013], ['Malibu', 2017], ['Midnight Sky', 2020], ['Flowers', 2023]]],
  ['Kendrick Lamar', [['Swimming Pools (Drank)', 2012], ['Alright', 2015], ['HUMBLE.', 2017], ['All The Stars', 2018], ['Not Like Us', 2024]]],
  ['Post Malone', [['White Iverson', 2015], ['rockstar', 2017], ['Sunflower', 2018], ['Circles', 2019], ['I Had Some Help', 2024]]],

  // 20s
  ['Billie Eilish', [['ocean eyes', 2016], ['bad guy', 2019], ['Happier Than Ever', 2021], ['What Was I Made For?', 2023], ['BIRDS OF A FEATHER', 2024]]],
  ['Dua Lipa', [['Be the One', 2015], ['New Rules', 2017], ['Don\'t Start Now', 2019], ['Levitating', 2020], ['Houdini', 2023]]],
  ['Harry Styles', [['Sign of the Times', 2017], ['Watermelon Sugar', 2019], ['Adore You', 2019], ['As It Was', 2022], ['Late Night Talking', 2022]]],
  ['Olivia Rodrigo', [['drivers license', 2021], ['good 4 u', 2021], ['deja vu', 2021], ['vampire', 2023], ['get him back!', 2023]]],
  ['Bad Bunny', [['DÁKITI', 2020], ['Tití Me Preguntó', 2022], ['Me Porto Bonito', 2022], ['Moscow Mule', 2022], ['DtMF', 2025]]],
  ['Sabrina Carpenter', [['Nonsense', 2022], ['Feather', 2023], ['Espresso', 2024], ['Please Please Please', 2024], ['Taste', 2024]]],
];

export const SONGS = ARTISTS.flatMap(([artist, songs]) =>
  songs.map(([title, year]) => ({
    id: `${artist}|${title}`.toLowerCase().replace(/[^a-z0-9|]+/g, '-'),
    artist,
    title,
    year,
  })),
);

export const SONGS_BY_ID = Object.fromEntries(SONGS.map((s) => [s.id, s]));

export const ARTIST_COUNT = ARTISTS.length;

export const decadeOf = (year) => Math.floor(year / 10) * 10;

// Songs before 1960 are rolled into the 60s bucket for filtering purposes.
export const decadeBucket = (year) => Math.max(1960, decadeOf(year));

export const DECADES = [1960, 1970, 1980, 1990, 2000, 2010, 2020];
