export default function Privacy() {
  return (
    <>
      <h1>Privacy</h1>
      <p className="legal-date">Updated October 13, 2026</p>
      <p>
        Cinnamon is a multiplayer word association game. You can play as a guest without creating an
        account.
      </p>
      <h2>Information used to run the game</h2>
      <p>
        The game server processes your display name, room code, guest identifier, connection status,
        submitted words, scores, and game settings. Your name, score, accepted words, and live
        typing are visible to other players in your room. Avoid using your real name or entering
        private information.
      </p>
      <h2>Room chat</h2>
      <p>
        Room chat messages and your display name are shared with other players in the same room. The
        server keeps the latest 50 messages in memory for reconnecting participants. Chat is not
        included in saved match results and is removed when the room expires or the server restarts.
        Hosting logs may still be retained separately. Do not send personal information through
        chat.
      </p>
      <h2>Browser storage</h2>
      <p>
        Your browser stores your display name and preferences for sound, colorblind mode, and
        autocorrection in local storage. A guest identifier and reconnection token are stored in
        session storage for your tab. You can remove these through your browser’s site-data
        controls; doing so can end your session and reset preferences.
      </p>
      <h2>Hosting and match storage</h2>
      <p>
        Vercel hosts the website and Render hosts the game server. These providers may process IP
        addresses, request details, and operational logs to deliver and protect the service. Their
        retention practices are governed by their own policies.
      </p>
      <p>
        Active rooms are kept in server memory and may disappear when empty or when the server
        restarts. If match storage is enabled, completed match records are saved in Supabase,
        including room codes, participant names, guest identifiers, scores, settings, submitted
        words, and timestamps. Such records are not automatically deleted by the current game
        software.
      </p>
      <h2>Word-list tools</h2>
      <p>
        Word lists are expanded using the Datamuse API. The tool sends prompt words
        to Datamuse, not player names or live submissions. Gameplay validation runs on the game
        server using local word data.
      </p>
      <h2>Advertising and tracking</h2>
      <p>
        The game currently does not include advertising or a third-party analytics integration.
        Necessary hosting logs and the browser storage described above are still used.
      </p>
      <h2>Children and privacy questions</h2>
      <p>
        The game does not ask for your age. Do not enter personal information into display names or
        answers. If you believe a child’s personal information has been entered, or you want to ask
        about access or deletion, see <a href="/contact">Contact</a>.
      </p>
      <h2>Changes</h2>
      <p>
        This notice will be updated when the game’s data practices change. Check the date above for
        the latest revision.
      </p>
    </>
  );
}
