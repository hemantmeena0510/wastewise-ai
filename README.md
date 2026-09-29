# WasteWise AI

WasteWise AI is a responsive food-service demand planning demo. It includes a landing page, dashboard, deterministic what-if simulator, predictions, analytics, demo-derived insights, impact estimates, local data management, CSV upload, and workspace settings.

All included records and impact figures are synthetic. The demo engine is rule-based; it is not a trained or evaluated machine-learning model.

## Run locally

```sh
npm install
npm run dev
```

Build the production bundle with `npm run build` and run the automated checks with `npm test`.

## Deploy to GitHub Pages

Push to the `main` branch to build and deploy the site with GitHub Actions. In the repository settings, set **Pages → Build and deployment → Source** to **GitHub Actions**. The workflow builds the app using the repository name as its base path, so it works at the GitHub Pages project URL.

## Demo prediction logic

The prediction service is isolated in `src/engine.js` and can be replaced behind `src/service.js` when a real backend is available. Given valid scenario inputs, the deterministic demo engine estimates demand as:

```text
172 base service meals
+ 64.5% of expected attendance
+ menu, weekday, weather, holiday, and event adjustments
```

The dashboard scenario is calibrated to 687 estimated meals at 800 attendance; changing attendance to 600 yields 558. The prediction range is illustrative, and the displayed confidence percentage is a demo estimate—not model accuracy. Production recommendations apply the configured safety-buffer percentage and round to a convenient 10-meal quantity. Waste risk is based on the current plan's surplus share: LOW below 8%, MEDIUM from 8% to below 18%, and HIGH at 18% or above.

The simulator never submits a production or redistribution action. Redistribution is only suggested when applicable food-safety and organizational requirements are met.

## Demo data and CSV

The app starts with 90 days of synthetic food-item records. User changes, uploads, and settings are stored in the current browser's local storage; no backend or authentication is connected.

CSV upload accepts files up to 5 MB with a header row and these required columns:

```text
date,attendance,menu,food_item,planned_quantity,actual_consumption,leftover,weather,holiday,event
```

`category` is optional. Dates must be valid `YYYY-MM-DD` dates; quantities must be non-negative, consumption cannot exceed planned production, and leftover must equal planned quantity minus actual consumption (within one unit).

## API integration boundary

`src/service.js` defines the local prediction service and the expected API route contract for prediction, simulation, data upload, analytics, predictions, recommendations, impact, and insights. These routes are contracts only; the demo does not make fake network requests.
