# Share and invite · notes

## The idea
Share is one dialog in two columns: on the left the link and who opens it as what, on the right how someone new gets in, a person or an agent, side by side because the brief's selling moment is that they join the same way. The link carries the rule in one sentence ("Leads and admins open it as owners, members as contributors, everyone else observes") and the apricot callout says plainly what an outsider gets: observer, watch and ask for a brief, nothing more until someone here raises them. An agent's row is the same row as a person's, with a `henosis join` command and a one-time key for runners and harnesses, and when it joins the mark's arcs close in its row and its owner is told.

## What to keep
- The two-column split, Share (link, roles) left and Invite (person, agent) right, so the dialog explains the whole membership story at a glance; on mobile it stacks into one sheet.
- Copied as a real state: the button turns ok-green and draws its check, instead of a toast.
- The observer callout: eye on a surface disc, serif headline "Outside Payments, it opens as *observer*", one line of what they can and cannot do.
- People rows with role words from the spec, "driving" on solid apricot with the driver ring on the avatar, "owner" as a plain word with no chevron because Ana cannot demote herself here; the picker opens inline under the row, not as a popover, with one line per role and the hand-off warning on Driver ("Bo has the baton; picking this hands it to Dee") and the foot "You own this session, so you can change a role. Dee is told."
- Invite a person: one field, a found row with the matched letters in chocolate and "not on Payments yet" in warn amber, the Guest/Member segment that rewrites the consequence beside it ("Cy opens as observer · Bo or Dee can raise him"), a pending invite with a pulsing amber dot and Resend/Revoke as ghost buttons.
- The users.json fold for people who run `henosis serve`, kept honest to the phase-0 identity file but folded away.
- Invite an agent: the joined row on apricot wash with the arcs-close mark, "09:52 · Dee was told" on the right; a live agent from the rail with Add to crew; then the terminal path, a navy code block with the key words in apricot, a one-time key that is good for 15 minutes and one use, and the closing rule "Same manners, same gate… its owner answers for it; it never votes."
- Dark: status colours lift, the code block drops to the darker rail navy, the right column keeps its faint surface-2 tint so the split still reads.

## Open questions
- The app's Share today is a drawer with a role `select`; this dialog adds Guest/Member on the project membership and a Revoke for pending invites, none of which exist yet. Is the dialog the new Share, or does the right column live on the project page under Invite?
- `henosis join --as agent` and the one-time key are drawn, not built; today an agent is created by `henosis serve` running it. Should the key be minted per session (as drawn) or per project, so one runner can host several agents?
- "Add to crew" names an existing live agent into Invoice rollout; the spec says only an owner or lead names a crew. Should the button be hidden for contributors, or shown disabled with the reason?
- Changing Dee to Driver takes the baton from Bo while he is present. Should that be a hand-off request to Bo rather than an owner's override?
- Pending invites: who may revoke, the inviter (Bo) or any owner (Ana, drawn)?
- Mobile: the right column sits below the fold; a two-tab sheet (Share / Invite) may be better than one long scroll.
