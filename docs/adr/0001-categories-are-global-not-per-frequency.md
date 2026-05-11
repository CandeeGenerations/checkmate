# Categories are global, not per-Frequency

Items can be tagged with at most one **Category** (e.g. "Kitchen", "Yard", "Finances"). Categories live in a single global pool shared across all four Frequencies (daily, weekly, monthly, quarterly), rather than being scoped per-Frequency. Concretely, `items.categoryId` is a nullable FK to a single `categories` table — not a per-frequency category table or a (frequency, category) composite.

We chose global because the user's mental model of a Category is a *domain area* of life ("Kitchen" spans wiping counters daily, mopping weekly, and deep-cleaning the fridge monthly). Per-Frequency categories would force users to define and rename the same concept four times, and the surprise cost of renaming "Kitchen" in one view and not seeing it change elsewhere outweighs the visual cost of occasionally rendering a Category that happens to have no items in the current view (which we mitigate by hiding empty sections per view).

## Consequences

- An item's position is `(frequency, category, sortOrder)` rather than `(frequency, sortOrder)`. The existing `/api/items/reorder` endpoint and its consumers need to thread `categoryId` through.
- A Category section is hidden from a view when no Item in that view belongs to it — so a Category used only for daily items doesn't pollute the Monthly view.
- Deleting a Category sets `categoryId = NULL` on its Items (they become Uncategorized) — items survive Category deletion, since the Category is just a label, not a container.
