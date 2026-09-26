# A1 TRADERS POS

Static GitHub Pages edition. Open index.html#pos for billing or home.html for the landing page.

Inventory, settings and sales stay in the visitor browser (IndexedDB). This repository contains only application code, demo products and bundled assets, not local customer records or secrets. Export a backup from localhost and restore it in the hosted app to transfer your data.

GitHub Pages does not run the receipt-sharing/cloud-sync backend. Local billing, PDF downloads, printing and browser-supported PDF sharing work. Public receipt URLs and cloud snapshots need a separately hosted backend. The static workspace has no server sign-in; each visitor has their own local data.

Publish: Repository Settings > Pages > Deploy from a branch > main > /(root).
