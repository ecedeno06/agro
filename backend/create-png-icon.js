import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from './src/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Un PNG base64 válido de un ícono de seguridad/candado verde (64x64)
const base64Png = `iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAACXBIWXMAAAsTAAALEwEAmpwYAAAEc0lEQVR4nO2bX2hTZxzHP+f8aXZt13ZdTds6W9222lFwdTggCspm04eCDw4GQfBBhD544atvPgjiC/rggyI+CIIvIgwyUFAchfZhK0x0a1m31nXZ2n/b1iR7zu/xId2SpElumqZp0pPvFw6He3KSc77f8zv/fl/O4XA4HM47iLKywuv1+v1+/xHn1wN+v/9kMBjcW1ZWhvMOwuv1+oPBoJzD4fhtwOFwuAAsAedl1q/X6z2yLwIej8dpt9vDwWDwo44e9ftEUTwrguPxeJxer/eQ3+8f+DcCPhuPx1MoFOL3CPhs/B8EHA6Hw+FwOAA+AGZl1q/X6z2yrxZw2Gw25x7C6/X6/X7/kffw+/1f/g0BB/A1sCDj/Xq93iP7/wXcbvew1+uVczgcvw04HA6Hw+Fw7CG8Xq8/GAzKOe8gdrs9GAwGd5WWlvoLhcIBYKPM+i0K/f1+/wnnd12lpaV+v98/6Pf7/3A4HA6Hw+FwOAAuA98Bs3Leu1y+fPlL9x4Cq80/4Pf7j/T399vl/wM+G0+hUMjvF/DZ+D8I2O12u8PhcDgAm4D3gVmZ9ev1eo/s3wTcbvew1+uVczgcvw04HA5HkQvw/Xq9Xm5hYeGL/fv3+51O56/A82b+/+T+/fsLpVKp/5tvvnEuLCx8PzMz4wG+M/P/N/gWmAEOAg+AQSATiUQ2ATsw5HxeZ115v99fUqlUdrlcruOpVGp8bGwMQAHeM3MfqVQqu4LB4HvgE2AAiAKbMdb9rJn7NxgMDplv/qOjo60Anue+1+sdtNvtzfX19debm5vf2u32zwuFQgT4s62t7Stguamp6Xk0Gn07Nja22tra2tfz8/M3gVfAZeAm0AnE/w+A2+1erKysPKdUKgXsdnt0bW3teVdXVyvAg9zX3dzc/HpqaupxV1dXKzg2bnd1de3r+k86nc59MzMzfwO/A4vAj8B14Dq/3b/b7Z7PZDI5x3Eu/5wEHo6Pj+cA5nNfbWpqepROpyfT6fRkd3d3M8BDjHV6ZWVl74kTJx5ms9mXlUrlbWdn5ytg5k0A2O322Ww2++vg4GAroAKNqVRqPBgMdgF/5b6uubm5b25ubn69t7fXDfDRrVu3/nQcpwZ4mJqaGkyn078EAgEP0Ab09fb2tgJ0X7x4cR/w16u2trbfXF1dzQBX8d+4g9+P19PT8/fU1NSv3d3drfjvFjY1NTXv2bPnU0Kh0FsHDhxoBgbwPwR6Aabx/+Vp/FdwL2/gL/03x3Gs1tbWTwD+AhbW1taW8fv15wBfgXngFnATfxm3gD+AdD7/M74X7uV3gTngN2ABmAMeAEvAT/iLWASW8fsB+/DbwAP81QO/u7b21g+1/iVdXV2f49+3Z/EX/hJ/7U/jD0wW4Gv8u7QIvAJ+w1/jQyAQ6Aa+w1+rLfx1eAx8hH/7r/HbvgH0/wMAZg2b8Y9k6wAAAABJRU5ErkJggg==`;

const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
  <defs>
    <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#22c55e"/>
      <stop offset="100%" stop-color="#15803d"/>
    </linearGradient>
  </defs>
  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="url(#shieldGrad)" stroke="#166534" stroke-width="1.5"/>
  <rect x="9" y="11" width="6" height="5" rx="1" fill="#ffffff"/>
  <path d="M10 11V9a2 2 0 0 1 4 0v2" fill="none" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"/>
</svg>`;

const pngBuffer = Buffer.from(base64Png, 'base64');

const pathsToEnsure = [
  path.join(__dirname, '../frontEnd/public/assets/icons'),
  path.join(__dirname, '../frontEnd/src/assets/icons'),
  path.join(__dirname, '../public/assets/icons')
];

for (const dir of pathsToEnsure) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(path.join(dir, 'seguridad.png'), pngBuffer);
  fs.writeFileSync(path.join(dir, 'seguridad.svg'), svgContent);
  console.log(`Archivos escritos en ${dir}`);
}

async function updateDb() {
  try {
    const res = await query("UPDATE public.menus SET icono = '/assets/icons/seguridad.svg' WHERE id = 4");
    console.log('Menú 4 actualizado a SVG:', res.rowCount);
  } catch (e) {
    console.error(e);
  }
}

updateDb();
