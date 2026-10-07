# Members drawer · notes

## The idea
One field adds anyone: type a name and the list offers people from the organisation and agents from live sessions side by side, each agent carrying its status, owner, crew, what it is on and its spend, so adding "Invoice rollout" is a choice about a working agent, not a label; a session that has ended stays in the list but greyed with "not live · can't join", which teaches the rule without a dialog. Roles are a chip on each person's row (Creator, Host, Member) that is a menu only on the rows you may change, and removal is inline: the row's Remove reveals a confirm that says what stays (the log, what she read) and offers the one linked decision, "also remove Billing page, her agent". The drawer ends with a short Changes ledger (joined, left, by whom) that the group log keeps, so membership is as replayable as the chat, and an agent joining fires the mark's arcs-close in a toast with Undo.

## What to keep
- The single add field with the `↑↓ ↵` hint and the mixed result list: person rows in sans, agent rows in serif with the live dot on the avatar, the matched letters in chocolate, tokens in mono, and the greyed "not live · can't join" row.
- The picker foot: "Mentioning an agent steers its session; its owner is told when it joins."
- Role chips: Creator on solid apricot, Host on apricot wash, Member plain; chevron only where it is a menu; the Creator option disabled with the reason ("Dee hands it on, not you").
- Leave on your own row, Remove in danger red only on hover, the inline confirm with the danger rule, "Remove Ana" as the one solid button, Keep as ghost, and the "Also remove her agent" checkbox.
- Agent rows: owner · status · what it is on in italic serif; Open always; the lock "Cy or Dee" where you may not remove; the just-joined row on apricot wash with the avatar ripple.
- The two one-line rules under each section, and the Changes ledger with the mark for joins and the minus ring for leaves; "Never sent to the agents."
- Dark: the toast lifts to surface-3 and the agent mention to #3A4458 so navy does not vanish into navy.
- Mobile: the drawer is a sheet with a handle; the role menu is the open state there, the picker on desktop; a bottom fade shows the sheet scrolls.

## Open questions
- The app today has only `createdBy`; Host is a new role. Is it worth a field on the group, or is "anyone in the group can add, only the creator and the owner of an agent can remove" enough?
- Should an agent in a group hear everything, as an option for groups made for one agent ("#billing-page")? The drawer assumes mentions only.
- When a person is removed, should her agents go with her by default (checkbox on) or stay (checkbox off, as drawn)? Staying keeps work alive; going matches "her agent".
- A session that ends takes its agent out of the group; should the row linger as "left · session ended" for a day so the ledger and the stream agree?
- The picker hides the first rows of the list while it is open; a wider drawer with People and Agents side by side would avoid it, at the cost of a 640px panel.
