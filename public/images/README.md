# Replaceable image area

Place user-selected website images in this folder. Keep the same filenames when replacing an image so the Chinese and English versions can share identical layout and code.

Recommended rules:

- Use `.webp` or optimized `.jpg` files.
- Keep each image below 500 KB where practical.
- Record the creator, source URL, licence, and date accessed in `docs/IMAGE_GUIDE.md`.
- Do not use copyrighted images without permission.
- Avoid screenshots containing personal data.

No decorative stock image is bundled yet. The current interface uses a product-specific writing preview so the first version remains coherent while the user selects final imagery.

To activate a selected home image without changing the layout, add the file here and update only `homeHeroImage` and `homeHeroAlt` in `app/site-config.ts`. Setting `homeHeroImage` back to `null` restores the built-in writing preview.
