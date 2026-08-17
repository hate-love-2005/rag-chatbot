import puppeteer from 'puppeteer';
import path from 'path';

const svgPath = path.resolve(process.cwd(), 'docs-rag-chatbot', 'architecture.svg');
const outPath = path.resolve(process.cwd(), 'docs-rag-chatbot', 'architecture.png');

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  // Match the SVG's declared size
  await page.setViewport({ width: 1200, height: 800 });
  const url = 'file://' + svgPath;
  await page.goto(url, { waitUntil: 'networkidle2' });
  try {
    await page.waitForSelector('svg', { timeout: 3000 });
  } catch (e) {
    // continue even if selector not found
  }
  await page.screenshot({ path: outPath, omitBackground: false });
  await browser.close();
  console.log(`Saved PNG to ${outPath}`);
})();
