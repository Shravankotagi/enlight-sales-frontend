# Responsive UI

Breakpoints: mobile under 640px, tablet 640 to 1024px, desktop above 1024px. Desktop keeps the 80% root font size from `index.css`. Below 1024px body text is 14px and form controls are 16px so iOS does not zoom on focus.

The shell uses `h-dvh`. Below 1024px the sidebar is a drawer opened from the top bar (`-translate-x-full` to `translate-x-0`). Above 1024px (`lg`), the sidebar features a stationary spacer rail (`w-72` open, `w-20` collapsed) and a floating hover-enlarge panel (`w-[22rem]`). All sidebar width and drawer transitions complete in 200 ms using a Lenis-style ease-out curve (`cubic-bezier(0.2, 0, 0, 1)`).

Shared classes and accessibility rules in `index.css`:

- `stack-table` turns a table into labeled cards below 1024px. Each `td` needs `data-label`.
- `mobile-sheet-overlay` removes overlay padding below 640px. `mobile-sheet` makes the panel full screen. `sheet-header` and `sheet-actions` stick to the top and bottom.
- `touch-target` sets a 44px minimum on coarse layouts.
- `@media (prefers-reduced-motion: reduce)` sets animation/transition durations to 0.01ms globally for users with reduced motion enabled in their operating system.

Do not change routes, API calls, or ACL when adjusting these classes.
