<script module lang="ts">
	import type { PostMetadata } from '$lib/posts';

	export const metadata: PostMetadata = {
		title: 'I reverse-engineered my volleyball club booking app',
		date: '2026-06-29',
		description:
			'How I intercepted the MonClub app traffic and built a terminal CLI and Discord bot to book, cancel and manage my volleyball sessions straight from the API.'
	};
</script>

<script lang="ts">
	const authMetadata = `{
  "os":      "Android 14",
  "model":   "Phone (2)",
  "brand":   "Nothing",
  "version": "3.6.0"
}`;

	const participantBody = `{
  "isPresent": "yes"   // "no" to cancel (also needs bookingId)
}`;

	const bookingsUrl = `GET /bookings/user/:userId?category=ondemand&temporality=fromToday`;
</script>

<p>
	A friend and I were fed up with the booking system of the <em>MonClub</em> app our volleyball club uses. A slot only
	opens for booking exactly six days (144 hours) in advance, at a precise time. Spots are limited and fill up almost
	instantly, so you have to rush onto the app the very moment booking opens.
</p>

<p>
	In practice that meant being glued to our phones at an exact minute, six days ahead. And we would regularly miss out
	anyway, because we were busy, away from our phones, or simply forgot. So I did the reasonable thing: I
	reverse-engineered the app's booking flow and built my own tool to talk to it directly, a terminal CLI and a Discord
	bot that book, cancel and manage sessions without ever opening the app. No more being glued to a phone at a precise
	minute.
</p>

<p>This is how it works.</p>

<h2>Listening in on the app</h2>

<p>
	MonClub does not expose a public API, so there was nothing to read. I had to watch the app talk to its server. I
	intercepted the app's HTTPS traffic using <a href="https://proxyman.io/">Proxyman</a> on macOS, with an iPhone as the
	client. Proxyman acts as a man-in-the-middle proxy: once you trust its CA certificate on the device, it can decrypt
	the TLS traffic and show you every request and response in clear text.
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
	<li><code>userId</code> identifies the logged-in user. It comes back in the auth response.</li>
	<li>
		<code>customId</code> identifies the club (the tenant). It shows up in every request, sometimes
		in the body and sometimes as a query parameter. It is stable and never changes for a given club,
		so I can treat it as a constant.
	</li>
	<li><code>sessionId</code> identifies a specific session slot. It is the <code>_id</code> of a
		session in the listing response.
	</li>
	<li>
		<code>bookingId</code> identifies a booking record. It is the <code>_id</code> of a booking and
		is required to cancel one.
	</li>
</ul>

<p>
	<code>customId</code> aside, the others are fetched at runtime: log in, list the sessions, list
	the bookings.
</p>

<h2>Authenticating like the real app</h2>

<p>The traffic revealed a two-step authentication flow.</p>

<p>
	<strong>Step 1</strong> is <code>POST /users/custom/authenticate/email/v2</code>, which sends only
	the email address. The server most likely uses this to check whether the account exists and what
	login method it should use.
</p>

<p>
	<strong>Step 2</strong> is <code>POST /users/custom/authenticate/v2</code>, which sends the
	credentials plus some device metadata. It returns a raw JWT (no <code>Bearer</code> prefix) and the
	<code>userId</code>.
</p>

<p>
	The device metadata in the body turned out to be completely cosmetic. The server accepts arbitrary
	values, so the bot just hardcodes a plausible-looking phone:
</p>

<pre>{authMetadata}</pre>

<p>
	After that, the JWT goes out as <code>Authorization: &lt;token&gt;</code> on every subsequent
	request (again, no <code>Bearer</code> prefix). The nice surprise is that the token's expiry is
	about a year, so the bot can simply re-authenticate on every run and never bother with token
	refresh logic.
</p>

<h2>Finding the slots</h2>

<p>
	Listing sessions is <code>POST /nearfilters/favorite/myclub</code>. It returns all upcoming
	sessions for the user's clubs, and the <code>tagName: "myclub"</code> filter scopes the results to
	clubs the user is actually a member of. I found it by capturing the traffic while opening the
	"Sessions" tab. Each session in the response carries its own <code>_id</code>, which is the
	<code>sessionId</code> I need to book it.
</p>

<p>To see what is already booked, there is:</p>

<pre>{bookingsUrl}</pre>

<p>
	This returns the user's upcoming bookings. Each entry has a nested <code>session</code> array with
	the session details, and a top-level <code>_id</code> which is exactly the <code>bookingId</code>
	required for cancellation. Swapping the query to <code>temporality=beforeToday</code> returns past
	bookings instead. Handy detail: the <code>session</code> object also includes
	<code>yesParticipants</code> (an array of user ID strings) and <code>totalQuantityFree</code> (the
	capacity as an integer), which is how the app shows the "X / Y spots taken" count.
</p>

<h2>Booking (and un-booking)</h2>

<p>
	This is the part I like the most. Booking and cancelling are the <em>same</em> endpoint:
	<code>POST /sessions/book/licenseeFromClub</code>. What decides between the two is the
	<code>isPresent</code> field inside the participant object:
</p>

<ul>
	<li><code>"yes"</code> creates a booking.</li>
	<li>
		<code>"no"</code> cancels one. In that case the participant object also needs the
		<code>bookingId</code>.
	</li>
</ul>

<pre>{participantBody}</pre>

<p>
	So the whole "grab my slot" action boils down to: authenticate, find the right
	<code>sessionId</code>, and POST it with <code>isPresent: "yes"</code>.
</p>

<h2>The timing problem, solved by a status code</h2>

<p>
	My first worry was timing: the app insists a slot only opens 144 hours before the session, so I
	assumed I would have to fire a perfectly-timed request at the exact second. The
	reverse-engineering gave me a calmer answer.
</p>

<p>
	If you POST a booking for a session the server is not ready to accept yet, it replies with
	<code>409 Conflict</code>. That is not really an error in my case; it just means "not open yet".
</p>

<blockquote>
	409 Conflict on the booking endpoint means the slot is not yet open. This is expected for sessions
	that open at a specific time, which is why the bot retries on 409.
</blockquote>

<p>
	That single status code turns a stressful timing game into a boring loop. Instead of firing one
	perfectly-timed request at the exact second, my booking flow just submits, and on a
	<code>409</code> it retries every few seconds until a deadline I set. The first time the server
	stops returning 409, the booking has gone through. I never have to trust that my clock and the
	server's clock agree down to the millisecond; the server itself tells me when I am allowed in.
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

<p>
	The first is an interactive terminal CLI. It logs in, then drops me into a menu: list every
	upcoming session, book one (with the 409-retry loop above), view or cancel my existing bookings,
	browse past sessions, or even compare the attendee lists of two sessions to see who else is coming.
	There is also a <code>prebook</code> command for the rare genuinely time-gated slot: I pick a
	session and a target time, and it sleeps until then before running the same retry loop.
</p>

<p>
	The second is a Discord bot with the same powers, exposed as slash commands (<code>/list</code>,
	<code>/book</code>, <code>/cancel</code>, <code>/bookings</code>, and a per-booking
	<code>/booking</code> detail view), so a friend and I can book straight from our group chat. If a
	<code>/book</code> comes back with a 409, a background task keeps retrying and sends a follow-up
	message once the slot is confirmed.
</p>

<h2>Was it worth it?</h2>

<p>
	Honestly, yes. The actual API surface is tiny: two auth calls, one listing call, one bookings call,
	a session-detail call, and one endpoint that both books and cancels. Most of the work was the
	watching and the figuring-out, not the code. And now, instead of setting an alarm for a random
	minute six days from now, I book from my terminal or a Discord message whenever it suits me, and we
	get to play volleyball.
</p>

<p>
	If you want the gory details, the full write-up and the raw traffic captures live in the
	<a href="https://github.com/TomPlanche/monclub-bot">monclub-bot repository</a>.
</p>

<style lang="scss">
  pre {
    font-family: 'monocraft', monospace;
  }
</style>
