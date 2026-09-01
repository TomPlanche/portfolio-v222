<script module lang="ts">
  import type { PostMetadata } from '$lib/posts';

  export const metadata: PostMetadata = {
    title: 'I reverse-engineered my volleyball club booking app.',
    date: '2026-06-29',
    description:
      'How I intercepted the MonClub app traffic and built a terminal CLI and Discord bot to book, cancel and manage my volleyball sessions straight from the API.',
    tags: ['reverse-engineering', 'volleyball', 'rust']
  };
</script>

<script lang="ts">
  import Code from '$lib/components/Code.svelte';
  import CodeBlock from '$lib/components/CodeBlock.svelte';

  const authMetadata = `
    {
    	"os":      "Android 14",
    	"model":   "Phone (2)",
    	"brand":   "Nothing",
    	"version": "3.6.0"
    }
  `;

  const bookingsUrl = `
    GET /bookings/user/:userId?category=ondemand&temporality=fromToday
  `;

  const participantBody = `
    {
    	"isPresent": "yes"   // "no" to cancel (also needs bookingId)
    }
  `;
</script>

<p>
  A friend and I were fed up with the booking system of the <em>MonClub</em> app our volleyball club uses.
</p>

<p>
  A slot only opens for booking exactly six days (144 hours) in advance, at a precise time. Spots
  are limited and fill up almost instantly, so you have to rush onto the app the very moment booking
  opens. In practice that meant being glued to our phones at an exact minute, six days ahead. And we
  would regularly miss out anyway, because we were busy, away from our phones, or simply forgot. So
  I did the reasonable thing: I reverse-engineered the app's booking flow and built my own tool to
  talk to it directly, a terminal CLI and a Discord bot that book, cancel and manage sessions
  without ever opening the app. No more being glued to a phone at a precise minute.
</p>

<p>This is how it works.</p>

<h2>Listening in on the app</h2>

<p>
  MonClub does not expose a public API, so there was nothing to read. I had to watch the app talk to
  its server. I intercepted the app's HTTPS traffic using <a href="https://proxyman.io/">Proxyman</a
  > on macOS, with an iPhone as the client. Proxyman acts as a man-in-the-middle proxy: once you trust
  its CA certificate on the device, it can decrypt the TLS traffic and show you every request and response
  in clear text.
</p>

<p>
  From there it was a matter of using the app like a normal human (opening the "Sessions" tab,
  tapping "Book", tapping "Cancel") and watching which requests fired. Every interesting capture got
  saved so I could study it offline.
</p>

<h2>The IDs that glue everything together</h2>

<p>
  The first thing that became obvious is that every request is built out of a handful of opaque
  MongoDB ObjectIds (24-character hex strings). There are four that matter:
</p>

<ul>
  <li><Code>userId</Code> identifies the logged-in user. It comes back in the auth response.</li>
  <li>
    <Code>customId</Code> identifies the club (the tenant). It shows up in every request, sometimes in
    the body and sometimes as a query parameter. It is stable and never changes for a given club, so I
    can treat it as a constant.
  </li>
  <li>
    <Code>sessionId</Code> identifies a specific session slot. It is the <Code>_id</Code> of a session
    in the listing response.
  </li>
  <li>
    <Code>bookingId</Code> identifies a booking record. It is the <Code>_id</Code> of a booking and is
    required to cancel one.
  </li>
</ul>

<p>
  <Code>customId</Code> aside, the others are fetched at runtime: log in, list the sessions, list the
  bookings.
</p>

<h2>Authenticating like the real app</h2>

<p>The traffic revealed a two-step authentication flow.</p>

<h3>Step 1: does this account exist?</h3>

<p>
  <Code>POST /users/custom/authenticate/email/v2</Code> sends only the email address. The server most
  likely uses this to check whether the account exists and what login method it should use.
</p>

<h3>Step 2: credentials and a fake phone</h3>

<p>
  <Code>POST /users/custom/authenticate/v2</Code> sends the credentials plus some device metadata. It
  returns a raw JWT (no <Code>Bearer</Code> prefix) and the <Code>userId</Code>. The device metadata
  in the body turned out to be completely cosmetic. The server accepts arbitrary values, so the bot
  just hardcodes a plausible-looking phone:
</p>

<CodeBlock code={authMetadata} lang="json" filename="the device the bot pretends to be" />

<p>
  After that, the JWT goes out as <Code>Authorization: &amp;lt;token&amp;gt;</Code> on every subsequent
  request (again, no <Code>Bearer</Code> prefix). The nice surprise is that the token's expiry is about
  a year, so the bot can simply re-authenticate on every run and never bother with token refresh logic.
</p>

<h2>Finding the slots</h2>

<p>
  Listing sessions is <Code>POST /nearfilters/favorite/myclub</Code>. It returns all upcoming
  sessions for the user's clubs, and the <Code>tagName: "myclub"</Code> filter scopes the results to clubs
  the user is actually a member of. I found it by capturing the traffic while opening the "Sessions" tab.
  Each session in the response carries its own <Code>_id</Code>, which is the <Code>sessionId</Code> I
  need to book it.
</p>

<p>To see what is already booked, there is:</p>

<CodeBlock code={bookingsUrl} lang="http" />

<p>
  This returns the user's upcoming bookings. Each entry has a nested <Code>session</Code> array with the
  session details, and a top-level <Code>_id</Code> which is exactly the <Code>bookingId</Code> required
  for cancellation. Swapping the query to <Code>temporality=beforeToday</Code> returns past bookings instead.
  Handy detail: the <Code>session</Code> object also includes <Code>yesParticipants</Code> (an array of
  user ID strings) and <Code>totalQuantityFree</Code> (the capacity as an integer), which is how the app
  shows the "X / Y spots taken" count.
</p>

<h2>Booking (and un-booking)</h2>

<h3>One endpoint, two meanings</h3>

<p>
  This is the part I like the most. Booking and cancelling are the <em>same</em> endpoint: <Code
    >POST /sessions/book/licenseeFromClub</Code
  >.
</p>

<p>
  What decides between the two is the <Code>isPresent</Code> field inside the participant object:
</p>

<ul>
  <li><Code>"yes"</Code> creates a booking.</li>
  <li>
    <Code>"no"</Code> cancels one. In that case the participant object also needs the <Code
      >bookingId</Code
    >.
  </li>
</ul>

<CodeBlock code={participantBody} lang="json" />

<p>
  So the whole "grab my slot" action boils down to: authenticate, find the right <Code
    >sessionId</Code
  >, and POST it with <Code>isPresent: "yes"</Code>.
</p>

<h3>Why 200 OK does not mean booked</h3>

<p>
  There is one subtlety I only spotted after a booking silently failed: a <Code>200 OK</Code> on this
  endpoint does <em>not</em> mean the booking went through. The real outcome lives in the response
  body, not the HTTP status. A confirmed booking comes back either as a record with an <Code
    >_id</Code
  > or with <Code>status: "success"</Code>. A soft rejection returns a different <Code>status</Code> plus
  a message, for example <Code>status: "noCredits"</Code> when the account has hit its reservation limit.
  So the bot treats only an explicit non-<Code>success</Code> status as a failure, and it does not retry
  those, because retrying a "you have no credits left" answer never helps.
</p>

<h3>The waiting list you never asked for</h3>

<p>
  Months later the same class of problem bit me again, in a nastier way. Book a session that is
  already full and the API does not refuse. It answers <Code>200</Code>, hands back a booking record
  with an <Code>_id</Code>, and by every check I had it looks exactly like a confirmed booking. It
  is not. The server has quietly parked you on the session's waiting list, and no spot is being held
  for you.
</p>

<p>
  The tell is in the session, not in the booking response. A session keeps two lists: <Code
    >yesParticipants</Code
  > for the people who actually have a spot, and <Code>maybeParticipants</Code> for the waiting list.
  A full session puts you in the second one. So after a booking that looks successful, the bot re-reads
  the session detail and checks which list it landed in; <Code>maybeParticipants</Code> is reported as
  "not booked" rather than as a win.
</p>

<p>
  Annoyingly, the booking endpoint echoes the session back in several shapes depending on the case:
  sometimes at the top level, sometimes under <Code>session</Code>, sometimes under <Code
    >sessions</Code
  >, and either as one object or as an array of them. The check looks in all of them rather than
  trusting one. This distinction matters more than it looks, because it splits failures in two. "No
  credits left" will never fix itself, so the bot gives up on the spot. "The session is full" fixes
  itself the moment somebody unbooks, so it is worth waiting for.
</p>

<h2>The timing problem, solved by a status code</h2>

<p>
  My first worry was timing: the app insists a slot only opens 144 hours before the session, so I
  assumed I would have to fire a perfectly-timed request at the exact second. The
  reverse-engineering gave me a calmer answer.
</p>

<p>
  If you POST a booking for a session the server is not ready to accept yet, it replies with <Code
    >409 Conflict</Code
  >. That is not really an error in my case; it just means "not open yet".
</p>

<blockquote>
  <p>
    409 Conflict on the booking endpoint means the slot is not yet open. This is expected for
    sessions that open at a specific time, which is why the bot retries on 409.
  </p>
</blockquote>

<p>
  That single status code turns a stressful timing game into a boring loop. Instead of firing one
  perfectly-timed request at the exact second, my booking flow just submits, and on a <Code
    >409</Code
  > it retries every few seconds until a deadline I set. The first time the server stops returning 409,
  the booking has gone through. I never have to trust that my clock and the server's clock agree down
  to the millisecond; the server itself tells me when I am allowed in.
</p>

<h2>The best part: there is no real time limit</h2>

<p>
  Here is the kicker I did not expect. That "six days in advance" rule? It is only enforced in the
  app itself. The server does not check it at all. The 144-hour window is a client-side restriction:
  the app refuses to show you the button early, but the booking endpoint behind it has no such
  guard.
</p>

<p>
  So once I was talking to the API directly, the whole premise of the stress disappeared. I am not
  limited to the next six days anymore. I can book any session I want, whenever I want, with no time
  limit at all. The bot does not just win the race to the slot; it ignores the starting line
  entirely.
</p>

<h2>What I actually built</h2>

<p>
  None of this is a screen-tapping macro. It is a small Rust program that speaks the API directly,
  and it comes in two flavours.
</p>

<h3>The terminal CLI</h3>

<p>
  It logs in, then drops me into a menu: list every upcoming session, book one (with the 409-retry
  loop above), view or cancel my existing bookings, browse past sessions, or even compare the
  attendee lists of two sessions to see who else is coming. When more than one account is
  configured, it also asks who to book for, so a single run can grab the same slot for several
  people. There is also a <Code>prebook</Code> command for the rare genuinely time-gated slot: I pick
  a session and a target time, and it sleeps until then before running the same retry loop. An <Code
    >export</Code
  > command writes my upcoming sessions out as a calendar file, which I come back to at the end.
</p>

<h3>The Discord bot</h3>

<p>
  Same powers, exposed as slash commands (<Code>/list</Code>, <Code>/book</Code>, <Code
    >/cancel</Code
  >, <Code>/prebook</Code>, <Code>/bookings</Code>, a per-booking <Code>/booking</Code> detail view, and
  the <Code>/notify</Code>, <Code>/watchbook</Code> and <Code>/export</Code> commands below), so a friend
  and I can book straight from our group chat. If a single-target <Code>/book</Code> comes back with a
  409, a background task keeps retrying and sends a follow-up message once the slot is confirmed.
</p>

<h2>Booking for the whole group</h2>

<h3>Several accounts, one command</h3>

<p>
  The feature that turned this from "my tool" into "our tool" is multi-user booking. Each of us has
  our own MonClub account, so the bot can hold several sets of credentials at once: the primary
  account comes from the environment, and extra people live in a small gitignored <Code
    >users.json</Code
  > that maps each account to a Discord user. Once that is set up, <Code>/book</Code> and <Code
    >/cancel</Code
  > take an optional list of people (<Code>@tom @nils</Code>, raw Discord ids, labels, or <Code
    >@everyone</Code
  > for every configured account), and the bot books or cancels for all of them in one command. Cancelling
  is per-person: for each target it looks up <em>that</em> account's own booking for the session and cancels
  it.
</p>

<h3>All or nothing</h3>

<p>
  Booking a group brought a problem a single booking never had: partial failure. If I book four
  people and the third one is out of credits, I do not want to end up with two friends booked and
  two not, especially for a slot where the remaining spots may already be gone. So group bookings
  are <strong>atomic</strong>. The bot books each account in turn, and the moment one fails, for any
  reason (no credits, an error, or the slot simply not being open yet), it rolls back by cancelling
  every booking it already made in that batch. Either the whole group gets in, or nobody does and
  the state is left exactly as it was. It is the same all-or-nothing guarantee a database
  transaction gives you, built out of two API calls and a bit of bookkeeping.
</p>

<h2>Waiting instead of racing</h2>

<p>
  Ignoring the booking window solved the sessions that are merely early. It did nothing for the two
  cases where the honest answer is "not yet": a session whose window has not opened, and a session
  that is full right now. Both are a waiting game, so the bot waits.
</p>

<h3>/notify, when I want to book it myself</h3>

<p>
  The smallest version is just an alert. <Code>/notify</Code> takes a session that is not bookable yet
  and pings me in the channel when it crosses its booking window, which the bot works out as the session's
  start minus <Code>BOOKING_WINDOW_HOURS</Code> (144 by default, the club's six days). It books nothing;
  it only tells me the door is open.
</p>

<h3>/watchbook, when I want the spot</h3>

<p>
  <Code>/watchbook</Code> is <Code>/notify</Code> and <Code>/book</Code> welded together, and it waits
  through both reasons a session can turn you away. If the window is not open yet, it uses the fast 409
  loop from earlier, because the server can still answer 409 right at the boundary. If the session is
  full, it drops to a much slower poll, every <Code>WATCH_POLL_INTERVAL</Code> seconds (a minute by default),
  and keeps at it until the session actually starts. Somebody cancels two days out, the bot takes their
  spot.
</p>

<p>
  The part I like is that it never reads the free capacity to decide whether to try. It just tries.
  Reading "one spot left" and then booking it is two requests with a gap in between, and that gap is
  exactly where someone else takes it. Attempting the booking is one request that both finds the
  spot and claims it. The waiting-list check above is what makes that safe: a full session accepts
  the request, so "did it work" cannot be read off the status code. Two deliberate differences from
  the group booking above. A rejection that waiting cannot fix (<Code>noCredits</Code>, <Code
    >noMembership</Code
  >) stops the watch immediately, since polling for days would not help. And unlike an atomic group <Code
    >/book</Code
  >, several people on one <Code>/watchbook</Code> are watched independently: spots free up one at a time,
  and turning one down because the others are not available yet would be daft.
</p>

<h3>Watching for sessions that do not exist yet</h3>

<p>
  The last watcher does not care about any particular session. Given a channel id, the bot polls the
  listing in the background and announces anything it has not seen before. The only subtlety is the
  first poll: it records what is already there without saying a word. Otherwise the channel would
  get the entire current listing every time the bot restarts, and only sessions that show up in a <em
    >later</em
  > poll are actually news.
</p>

<h2>Putting the sessions in my calendar</h2>

<p>
  The newest addition has nothing to do with beating anyone to anything. Both interfaces export
  upcoming bookings as an iCalendar file: <Code>export</Code> in the CLI, <Code>/export</Code> in Discord,
  which replies with the <Code>.ics</Code> as an attachment. Import it into Apple Calendar, Google Calendar
  or Outlook and the volleyball sits next to everything else. It costs a single request whatever the number
  of sessions, because everything an event needs is already in the bookings listing: the name, the start,
  the venue address, and, for the notes, the booked/total count, the coaches and the participants list.
  Two details took most of the thought. Times are written as UTC instants derived from the API's own timestamps
  rather than from the French wall-clock string it also returns (<Code>19H30</Code>), so they land
  at the right local time in any calendar app. And each event's UID comes from the session id, which
  makes it stable: re-importing an updated file refreshes the existing entries instead of leaving me
  with two copies of every session. Exporting several people into one file prefixes the UID and the
  summary per account so their events do not collide. The writer itself is a hundred-odd lines
  rather than a dependency. The fiddly parts of the format, escaping text, folding lines at 75
  octets, CRLF endings, are a few lines each, and one <Code>VEVENT</Code> shape did not feel worth a crate.
</p>

<h2>Was it worth it?</h2>

<p>
  Honestly, yes. The actual API surface is tiny: two auth calls, one listing call, one bookings
  call, a session-detail call, and one endpoint that both books and cancels. Most of the work was
  the watching and the figuring-out, not the code. Everything I have added since, the watchers, the
  waiting-list check, the calendar export, has been built on that same handful of calls; I have not
  had to go back to Proxyman once. And now, instead of setting an alarm for a random minute six days
  from now, I book from my terminal or a Discord message whenever it suits me, and we get to play
  volleyball. If you want the gory details, the full write-up and the raw traffic captures live in
  the <a href="https://github.com/TomPlanche/monclub-bot">monclub-bot repository</a>.
</p>
