# 🦇 The Crimson Masquerade - Event Website

A website for the Crimson Masquerade Halloween vampire event.
The host opens it and shares the window on Discord. Guests open the same website on their own screen and see everything live.

## What it does

- **Blood Wheel**: two wheels spin together (the Challenge and the Vampire Bloodline). The result stays on screen for everyone until the next spin.
- **Turns**: the host chooses a mortal (or picks a random one, fairly: everyone plays before someone plays twice). Players spin only on their own turn. The host can spin for anyone.
- **Blood**: every mortal starts with 3 Blood. The host presses "Completed" or "Failed / refused".
- **Out of Blood**: the host chooses DRINK (banished) or TURN (joins the bloodline). Both are out of the race.
- **Final Survivors**: when only 4 eligible mortals remain, a golden banner crowns them.
- Pages for **Mortals**, **Bloodlines** and **Rules**, using your event pictures.
- **Host Panel**: add guests, edit the challenges on the wheel, change settings, restart the event, see the full log.
- **Clean view** button to hide the host tools while you share your screen.

## Step 1: Set up Firebase (free Spark plan)

1. https://console.firebase.google.com -> create a project (Analytics can be off).
2. **Build -> Authentication -> Get started -> Email/Password -> Enable.**
3. **Build -> Realtime Database -> Create database** (any location, start in locked mode).
4. Open the **Rules** tab, paste the whole content of `database.rules.json` from this folder, and **Publish**.
5. **Project settings (gear) -> General -> Your apps -> Web (</>)**: register an app and copy the `firebaseConfig` values into `js/config.js` (make sure `databaseURL` is there).

## Step 2: Put it on GitHub Pages

Upload ALL files (keep `css`, `js`, `images`) to a repository, then **Settings -> Pages -> Deploy from a branch -> main / (root)**.
Your site is live at `https://YOUR-NAME.github.io/REPO-NAME/`.

## Step 3: Become the host (do this BEFORE sharing the link)

1. Open your site, click **Sign in / Register**, and create your own account.
2. A **👑 Claim host** button appears at the top. Click it. Once someone is host, the button disappears for everybody and nobody else can claim it.
3. You now see the **Host Panel**. In **Accounts** you can give other people host rights (👑) too.

## How guests play

- Guests click **Sign in / Register**, choose a username and password (6+ characters). They are added to the event automatically (you can close registration in Host Panel -> Settings).
- On their turn they press the spin button. Only you (hosts) can judge Completed / Failed, pick mortals, edit Blood, and so on.
- Guests you add by hand (Host Panel -> Add mortals) have no account, so only the host spins for them.

## Wheel control (Host Panel -> Challenges on the wheel)

- Add as many challenges as you like: type one per line and press Add.
- ✏️ edits a challenge, ✖ deletes it, **Remove all challenges** empties the wheel, **Reset to default** restores the starter list.
- With more than 10 challenges the wheel shows numbers, and above 60 it shows no labels. The winning challenge is always written in full next to the wheel.

## Good to know

- Passwords are handled by Firebase Authentication (stored hashed by Google, never in your code). Usernames are turned into a hidden email like `name@crimson-masquerade.app`, so there is **no "forgot password"**. If someone forgets it: Firebase console -> Authentication -> Users -> delete that user, then they register again (host: use the ➕ button to re-add them).
- Host rights are enforced by the database rules, not just the page, so guests cannot use host powers even if they edit the site code.
- Small limit: a guest on their turn could technically forge their own spin result by hacking the page. Fine for a friendly Discord event.
- Without Firebase filled in, the site runs in **demo mode** (only in your browser, no accounts, you are host), good for testing.
