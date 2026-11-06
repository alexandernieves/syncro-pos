# Packaged modules and custom features

Syncro has three levels:

| Level | What it is | Who has it |
|---|---|---|
| Base | POS, products, inventory, clients, reports… | Every business |
| Catalog module | A packaged vertical (today: `gym`) listed in `catalog.ts` | Turned on from Syncro central (trial or active), never by the business itself |
| Custom feature | A part of a module built for one business | That business; others only with its authorization |

Rules agreed with the business owner of Syncro:

- Everything is free for now.
- A trial lasts 15 days and never turns off by itself; Central lists trials that ended and the team decides.
- Only the owner (`ownerpos` / `owner`) requests modules or functions.
- A custom feature can be offered to other businesses only after the business that asked for it authorizes it (`shareAuthorized: true`).

## Building a custom feature for one business

1. The owner asks from the module ("¿Te falta algo? Pídelo") or from the Tienda. It shows up in Central → Solicitudes with its own thread.
2. Build it inside the module's code (never a copy of the module), behind a feature key, e.g. `gym.lockers`. Gate its API with `assertModule(prisma, businessId, 'gym')` and, if it has its own page, give it a route under the module (`/dashboard/gimnasio/casilleros`).
3. Add it to the module's `features` in `catalog.ts`:
   ```ts
   { key: 'gym.lockers', label: 'Casilleros', route: '/dashboard/gimnasio/casilleros', default: false,
     custom: true, builtFor: '<businessId>', shareAuthorized: false }
   ```
4. Deploy, then in Central → the business sheet → Módulos, turn the feature on. It appears in that business's module menu (before Ajustes). Move the request to "Lista para probar" / "Entregada".
5. If the business agrees to share it, set `shareAuthorized: true`; from then on Central can turn it on for other businesses.

## Where things live

- `catalog.ts`: modules, features, statuses, trial length.
- `module-access.ts`: `assertModule` / cached access check used by the gym guards.
- `business-modules.service.ts`: business view (`/modules/mine`), Central actions (offer, activate, pause, features).
- `module-requests.service.ts`: requests from the Tienda and their timeline; every change is posted to the support chat as a card.
