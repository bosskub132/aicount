# Task Completion Checklist

When a coding task is completed, perform these steps:

1. **Lint:** Run `npm run lint` and fix any errors
2. **Build check:** Run `npm run build` to ensure no TypeScript or build errors
3. **Verify styling:** Ensure all styling uses Tailwind utilities and CSS variables (no hardcoded colors)
4. **Check icons:** Confirm only `lucide-react` icons are used
5. **Review imports:** Verify `@/` path alias is used consistently
6. **Server vs Client:** Confirm `"use client"` is only added where necessary
