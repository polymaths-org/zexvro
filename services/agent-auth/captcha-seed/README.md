# Captcha seed photo bank

Committed SVG seed tiles (8 variants × 12 labels) so Gate image captchas work without a curated Kaggle bank.

Docker copies this tree to `/app/captcha-assets` at image build.

To replace with real photos later:
1. Put files in `captcha-assets/verified/<label>/`
2. Or rebuild via `node scripts/rebuild-captcha-bank.mjs`
3. Ensure Dockerfile still copies the bank into the image
