# Checkmate — Domain Context

A glossary of the domain language used in Checkmate. Only terms that are meaningful to users / domain experts belong here. Implementation details (table names, file paths, function signatures) do not.

## Glossary

### Category

An optional grouping label attached to an Item. An Item belongs to at most one Category; a Category can hold any number of Items across any Frequency. Categories are **global** — the same Category pool is shared across all Frequencies.

Categories are **not** required — an Item with no Category is _Uncategorized_.

A Category Section is hidden from a view when no Item in that view belongs to it (empty Categories don't take up visual space in a Frequency they happen not to be used in).

The _Uncategorized_ bucket renders **first** in every view — above the named Category sections — so views containing no categorized items look identical to the pre-Category world.

Categories have a **user-defined order** that is global (same across all views). Dragging a Category section header reorders the section as a block — the Items inside follow it. Dragging within a section reorders Items _within_ that Category; dragging an Item across sections re-assigns its Category.

### Section

A visual grouping in a view. The most common grouping axis is Category, in which case a Section is rendered with a collapsible sub-header. "Section" is a presentation term — Items do not have sections, views render sections.

(Other axes can also drive sections, e.g. the Weekly view's day columns are sections by day-of-week. The Category sub-headers live _inside_ those columns — in Weekly, every day-column is itself sub-grouped by Category, with Uncategorized first.)

### Item

A recurring to-do. Each Item has exactly one Frequency and at most one Category.

A Category has: a **name** (required, unique — case-insensitive and whitespace-trimmed), an optional **color**, an optional **emoji/icon**, and a sort order. Color and emoji are purely glanceability aids — they appear on the section header and may appear as a chip on the Item row, but they carry no behavior.

Deleting a Category does **not** delete its Items — they become Uncategorized. The delete confirmation surfaces the count: _"This will move N item(s) to Uncategorized."_

### Frequency

One of: `daily`, `weekly`, `monthly`, `quarterly`. Determines the period over which an Item recurs.

### Completion

A record that an Item was checked off on a specific calendar date. Completions are kept forever; whether an Item is "done this period" is derived from completion history under the Item's _current_ Frequency.

### Period

The calendar window an Item's Completion is scoped to. Weeks start Sunday; quarters are calendar-aligned (Q1=Jan–Mar, …).
