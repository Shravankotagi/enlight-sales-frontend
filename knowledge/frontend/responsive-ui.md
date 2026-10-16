# Responsive UI

Breakpoints: mobile under 640px, tablet 640 to 1024px, desktop above 1024px. Desktop keeps the 80% root font size from `index.css`. Below 1024px body text is 14px and form controls are 16px so iOS does not zoom on focus.

The shell uses `h-dvh`. Below 1024px the sidebar is a drawer opened from the top bar. The desktop hover-expand sidebar starts at `lg`.

Shared classes in `index.css`:

- `stack-table` turns a table into labeled cards below 1024px. Each `td` needs `data-label`.
- `mobile-sheet-overlay` removes overlay padding below 640px. `mobile-sheet` makes the panel full screen. `sheet-header` and `sheet-actions` stick to the top and bottom.
- `touch-target` sets a 44px minimum on coarse layouts.

Do not change routes, API calls, or ACL when adjusting these classes.
